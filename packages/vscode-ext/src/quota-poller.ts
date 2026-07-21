// Node.js fetchers — no CORS restrictions, uses credentials from SecretStorage.
// This is the standalone path: VS Code fetches quota directly without Chrome.
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import {
  copilotAuthUnavailable,
  copilotNoPlan,
  copilotSeatActiveUsageUnknown,
  mapClaudeUsage,
  mapCodexUsage,
  upsertQuotaState,
  type ClaudeUsageResponse,
  type WhamUsageResponse,
} from '@ai-quota-tool/core';
import type { Credentials } from './credentials.js';

/** True when a fetch failure looks like expired/invalid session credentials. */
function isAuthFailure(reason: unknown): boolean {
  const msg = reason instanceof Error ? reason.message : String(reason);
  return /\b401\b|\b403\b|invalid or expired|No Claude org/i.test(msg);
}

type GetGithubToken = () => Promise<string | undefined>;
type GetCredentials = () => Promise<Credentials>;
type UpdateListener = (states: QuotaState[]) => void;

const POLL_INTERVAL_MS = 60_000;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ──── Claude (claude.ai session usage — same data the Chrome extension uses) ─

interface ClaudeOrg {
  uuid: string;
}

async function fetchClaude(sessionKey: string): Promise<QuotaState> {
  const headers = {
    Accept: 'application/json',
    Cookie: `sessionKey=${sessionKey}`,
    'User-Agent': BROWSER_UA,
    Referer: 'https://claude.ai/',
    Origin: 'https://claude.ai',
  };

  const orgRes = await fetch('https://claude.ai/api/organizations', { headers });
  if (orgRes.status === 401 || orgRes.status === 403) {
    throw new Error(`Claude orgs API: ${orgRes.status} invalid or expired session key`);
  }
  if (!orgRes.ok) throw new Error(`Claude orgs API: ${orgRes.status}`);
  const orgs = (await orgRes.json()) as ClaudeOrg[];
  const orgId = orgs[0]?.uuid;
  if (!orgId) throw new Error('No Claude org found');

  const usageRes = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, {
    headers,
  });
  if (usageRes.status === 401 || usageRes.status === 403) {
    throw new Error(`Claude usage API: ${usageRes.status} invalid or expired session key`);
  }
  if (!usageRes.ok) throw new Error(`Claude usage API: ${usageRes.status}`);
  const data = (await usageRes.json()) as ClaudeUsageResponse;
  return mapClaudeUsage(data);
}

// ──── GitHub Copilot ────────────────────────────────────────────────────────
// No public remaining-% API for individuals — return honest states only.

async function fetchCopilot(token: string): Promise<QuotaState> {
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const now = Date.now();
  const seatRes = await fetch('https://api.github.com/user/copilot', { headers });
  if (seatRes.status === 404) return copilotNoPlan(now);
  if (!seatRes.ok) return copilotAuthUnavailable(now);
  return copilotSeatActiveUsageUnknown(now);
}

// ──── Codex ─────────────────────────────────────────────────────────────────

async function fetchCodex(sessionToken: string): Promise<QuotaState> {
  const res = await fetch('https://chatgpt.com/backend-api/wham/usage', {
    headers: {
      Accept: 'application/json',
      Cookie: `__Secure-next-auth.session-token=${sessionToken}`,
      Referer: 'https://chatgpt.com/codex/settings/usage',
      'User-Agent': BROWSER_UA,
      Origin: 'https://chatgpt.com',
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Codex usage API: ${res.status} invalid or expired session token`);
  }
  if (!res.ok) throw new Error(`Codex usage API: ${res.status}`);
  const data = (await res.json()) as WhamUsageResponse;
  return mapCodexUsage(data);
}

// ──── Poller ────────────────────────────────────────────────────────────────

export class QuotaPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<UpdateListener> = new Set();
  private latestStates: QuotaState[] = [];
  private getCredentials: GetCredentials | null = null;
  private getGithubToken: GetGithubToken | null = null;
  private pollPromise: Promise<void> | null = null;
  /** If pollNow is requested while a poll is in-flight, run one more after it finishes. */
  private pendingPoll = false;

  onUpdate(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLatestStates(): QuotaState[] {
    return this.latestStates;
  }

  start(getCredentials: GetCredentials, getGithubToken: GetGithubToken): void {
    this.getCredentials = getCredentials;
    this.getGithubToken = getGithubToken;
    void this.pollNow();
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => void this.pollNow(), POLL_INTERVAL_MS);
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
    if (!this.getCredentials || !this.getGithubToken) return;

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
    const getCredentials = this.getCredentials;
    const getGithubToken = this.getGithubToken;
    if (!getCredentials || !getGithubToken) return;

    const [creds, githubToken] = await Promise.all([getCredentials(), getGithubToken()]);

    const jobs: Array<{ service: ServiceId; promise: Promise<QuotaState> }> = [
      {
        service: 'claude',
        promise: creds.claudeSessionKey
          ? fetchClaude(creds.claudeSessionKey)
          : Promise.reject('no credential'),
      },
      {
        service: 'copilot',
        promise: githubToken ? fetchCopilot(githubToken) : Promise.reject('no credential'),
      },
      {
        service: 'codex',
        promise: creds.codexSessionToken
          ? fetchCodex(creds.codexSessionToken)
          : Promise.reject('no credential'),
      },
    ];

    const results = await Promise.allSettled(jobs.map((j) => j.promise));

    let changed = false;
    for (let i = 0; i < results.length; i++) {
      const r = results[i]!;
      const service = jobs[i]!.service;
      if (r.status === 'fulfilled') {
        this.upsert(r.value);
        changed = true;
      } else if (r.reason !== 'no credential') {
        // Never log secrets — only status/reason strings from our Error messages.
        console.error(
          '[ai-quota-tool] poller:',
          service,
          r.reason instanceof Error ? r.reason.message : r.reason,
        );
        if (isAuthFailure(r.reason) && (service === 'claude' || service === 'codex')) {
          if (this.removeService(service)) changed = true;
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

  /** Remove a service reading (e.g. after clear or auth failure). */
  dropService(service: ServiceId): void {
    if (this.removeService(service)) {
      this.listeners.forEach((fn) => fn(this.latestStates));
    }
  }

  private upsert(incoming: QuotaState): void {
    this.latestStates = upsertQuotaState(this.latestStates, incoming);
  }

  private removeService(service: ServiceId): boolean {
    const next = this.latestStates.filter((s) => s.service !== service);
    if (next.length === this.latestStates.length) return false;
    this.latestStates = next;
    return true;
  }
}
