// Node.js poller — credentials from SecretStorage; remaining math in core pure mappers.
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { connectionIdOf, connectionKindOf, sessionAuthFailureAction, upsertQuotaState } from '@ai-quota-tool/core';
import type { Credentials } from './credentials.js';
import type { KeyWithSecret } from './key-store.js';
import { fetchClaudeUsage, fetchCodexUsage, fetchCopilotUsage, fetchGrokUsage, fetchKeyReading } from './session-fetch.js';

export interface PollSources {
  credentials: () => Promise<Credentials>;
  /** The VS Code GitHub session token, when the user connected Copilot. */
  githubToken: () => Promise<string | undefined>;
  keys: () => Promise<KeyWithSecret[]>;
}

type UpdateListener = (states: QuotaState[]) => void;

interface Job {
  /** Connection id: the provider id for an Account, the Key id for a Key. */
  id: string;
  service: ServiceId;
  promise: Promise<QuotaState>;
}

const POLL_INTERVAL_MS = 60_000;
/** GitHub does not document copilot_internal/user. Poll it no more often than every 5 minutes. */
const COPILOT_INTERVAL_MS = 5 * 60_000;

function accountJob(service: ServiceId, secret: string | undefined, fetch: (secret: string) => Promise<QuotaState>): Job[] {
  return secret ? [{ id: service, service, promise: fetch(secret) }] : [];
}

// ──── Poller ────────────────────────────────────────────────────────────────

export class QuotaPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<UpdateListener> = new Set();
  private latestStates: QuotaState[] = [];
  /** Session-cookie services whose last poll was an auth failure (secret kept). */
  private reauthNeeded: Set<ServiceId> = new Set();
  private sources: PollSources | null = null;
  private pollPromise: Promise<void> | null = null;
  /** If pollNow is requested while a poll is in-flight, run one more after it finishes. */
  private pendingPoll = false;
  /** The next Copilot poll runs at or after this time (ms). */
  private copilotDueAt = 0;

  onUpdate(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLatestStates(): QuotaState[] {
    return this.latestStates;
  }

  /** Session-cookie services that need replace/clear after invalid/expired session. */
  getReauthNeeded(): ServiceId[] {
    return [...this.reauthNeeded];
  }

  start(sources: PollSources): void {
    this.sources = sources;
    void this.pollNow();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.pollNow(), POLL_INTERVAL_MS);
  }

  /** Poll Copilot in the next poll, for example after a sign-in. */
  pollCopilotSoon(): void {
    this.copilotDueAt = 0;
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Run one poll immediately (e.g. after credentials change).
   * Concurrent callers share the in-flight poll; if a request arrives mid-poll
   * (e.g. second credential saved), one more poll runs after the current finishes.
   */
  async pollNow(): Promise<void> {
    if (!this.sources) return;

    if (this.pollPromise) {
      this.pendingPoll = true;
      await this.pollPromise;
      return;
    }

    this.pollPromise = (async () => {
      do {
        this.pendingPoll = false;
        await this.runPoll();
      } while (this.pendingPoll);
    })().finally(() => {
      this.pollPromise = null;
    });

    await this.pollPromise;
  }

  private async runPoll(): Promise<void> {
    const sources = this.sources;
    if (!sources) return;

    const copilotDue = Date.now() >= this.copilotDueAt;
    const [creds, githubToken, keys] = await Promise.all([
      sources.credentials(),
      copilotDue ? sources.githubToken() : Promise.resolve(undefined),
      sources.keys(),
    ]);
    if (githubToken) this.copilotDueAt = Date.now() + COPILOT_INTERVAL_MS;

    const jobs: Job[] = [
      ...accountJob('claude', creds.claudeSessionKey, fetchClaudeUsage),
      ...accountJob('copilot', githubToken, fetchCopilotUsage),
      ...accountJob('codex', creds.codexSessionToken, fetchCodexUsage),
      ...accountJob('grok', creds.grokSsoCookie, fetchGrokUsage),
      ...keys.map(({ key, secret }): Job => ({
        id: key.id,
        service: key.service,
        promise: fetchKeyReading(key.service, secret).then((s) => ({ ...s, connectionId: key.id, kind: 'key' })),
      })),
    ];

    const results = await Promise.allSettled(jobs.map((j) => j.promise));

    // A Key removed since the last poll leaves no stale chip.
    const keyIds = new Set(keys.map(({ key }) => key.id));
    const kept = this.latestStates.filter((s) => connectionKindOf(s) !== 'key' || keyIds.has(connectionIdOf(s)));
    let changed = kept.length !== this.latestStates.length;
    this.latestStates = kept;

    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const { id, service } = jobs[i]!;
      if (r.status === 'fulfilled') {
        this.upsert(r.value);
        this.reauthNeeded.delete(service);
        changed = true;
      } else {
        // Never log secrets — only status/reason strings from our Error messages.
        console.error('[ai-quota-tool] poller:', service, r.reason instanceof Error ? r.reason.message : r.reason);
        const action = sessionAuthFailureAction(service, r.reason);
        if (action) {
          // keepSecret is policy (do not clear SecretStorage here).
          if (action.dropRing && this.removeConnection(id)) changed = true;
          if (action.requireReauthSignal && !this.reauthNeeded.has(service)) {
            this.reauthNeeded.add(service);
            changed = true;
          }
        }
      }
    }

    if (changed) {
      this.listeners.forEach((fn) => fn(this.latestStates));
    }
  }

  /** Merge a single state (from WS push) using freshest-wins. */
  merge(incoming: QuotaState): void {
    this.latestStates = upsertQuotaState(this.latestStates, incoming);
    this.listeners.forEach((fn) => fn(this.latestStates));
  }

  /** Remove a connection reading (after sign-out, Key removal, or auth failure). */
  dropConnection(id: string): void {
    const ring = this.removeConnection(id);
    const reauth = this.reauthNeeded.delete(id as ServiceId);
    if (ring || reauth) {
      this.listeners.forEach((fn) => fn(this.latestStates));
    }
  }

  /** Tell listeners to show the latest readings again, for example after a Key budget change. */
  emit(): void {
    this.listeners.forEach((fn) => fn(this.latestStates));
  }

  /** Clear re-auth flag after a successful Save & Test (before poll). */
  clearReauth(service: ServiceId): void {
    if (this.reauthNeeded.delete(service)) {
      this.listeners.forEach((fn) => fn(this.latestStates));
    }
  }

  private upsert(incoming: QuotaState): void {
    this.latestStates = upsertQuotaState(this.latestStates, incoming);
  }

  private removeConnection(id: string): boolean {
    const next = this.latestStates.filter((s) => connectionIdOf(s) !== id);
    if (next.length === this.latestStates.length) return false;
    this.latestStates = next;
    return true;
  }
}
