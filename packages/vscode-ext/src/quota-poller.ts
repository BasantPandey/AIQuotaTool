// Node.js fetchers — no CORS restrictions, uses credentials from SecretStorage.
// This is the standalone path: VS Code fetches quota directly without Chrome.
import type { QuotaState } from '@ai-quota-tool/core';
import { calcPct } from '@ai-quota-tool/core';
import type { Credentials } from './credentials.js';

type GetGithubToken = () => Promise<string | undefined>;

const POLL_INTERVAL_MS = 60_000;
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ──── Claude (official Anthropic API) ───────────────────────────────────────

async function fetchClaude(apiKey: string): Promise<QuotaState> {
  // GET /v1/models is lightweight (no token cost) and returns rate-limit headers
  const res = await fetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Accept': 'application/json',
    },
  });
  if (res.status === 401) throw new Error('Invalid API key — check console.anthropic.com');
  if (!res.ok) throw new Error(`Claude API: ${res.status}`);

  const tokensLimit = Number(res.headers.get('anthropic-ratelimit-tokens-limit') ?? 0);
  const tokensRemaining = Number(res.headers.get('anthropic-ratelimit-tokens-remaining') ?? 0);
  const tokensReset = res.headers.get('anthropic-ratelimit-tokens-reset');
  const reqsLimit = Number(res.headers.get('anthropic-ratelimit-requests-limit') ?? 0);
  const reqsRemaining = Number(res.headers.get('anthropic-ratelimit-requests-remaining') ?? 0);
  const reqsReset = res.headers.get('anthropic-ratelimit-requests-reset');

  const now = Date.now();
  const sessionPct = tokensLimit > 0 ? Math.round((tokensRemaining / tokensLimit) * 100) : 100;
  const weeklyPct = reqsLimit > 0 ? Math.round((reqsRemaining / reqsLimit) * 100) : 100;

  return {
    service: 'claude',
    sessionPct,
    weeklyPct,
    sessionResetsAt: tokensReset ? Date.parse(tokensReset) : now + 60_000,
    weeklyResetsAt: reqsReset ? Date.parse(reqsReset) : now + 60_000,
    lastUpdated: now,
  };
}

// ──── GitHub Copilot ────────────────────────────────────────────────────────

async function fetchCopilot(token: string): Promise<QuotaState> {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
  nextMonth.setHours(0, 0, 0, 0);
  const resetsAt = nextMonth.getTime();

  const seatRes = await fetch('https://api.github.com/user/copilot', { headers });
  if (seatRes.status === 404) throw new Error('No active Copilot subscription');

  // Non-404 failure (e.g. 403 insufficient scope) — still show the card with 100% remaining
  // rather than hiding it entirely, since we know the user is authenticated.
  // ponytail: show connected state even when quota API is unreachable
  if (!seatRes.ok) {
    return { service: 'copilot', weeklyPct: 100, weeklyResetsAt: resetsAt, lastUpdated: Date.now() };
  }

  return {
    service: 'copilot',
    weeklyPct: 100,
    weeklyResetsAt: resetsAt,
    lastUpdated: Date.now(),
  };
}

// ──── Codex ─────────────────────────────────────────────────────────────────

interface WhamWindow {
  used_percent: number;
  reset_at: string;
}

interface WhamUsageResponse {
  rate_limit?: { primary_window?: WhamWindow; secondary_window?: WhamWindow };
  primary_window?: WhamWindow;
  secondary_window?: WhamWindow;
}

async function fetchCodex(sessionToken: string): Promise<QuotaState> {
  const res = await fetch('https://chatgpt.com/backend-api/wham/usage', {
    headers: {
      'Accept': 'application/json',
      'Cookie': `__Secure-next-auth.session-token=${sessionToken}`,
      'Referer': 'https://chatgpt.com/codex/settings/usage',
      'User-Agent': BROWSER_UA,
      'Origin': 'https://chatgpt.com',
    },
  });
  if (!res.ok) throw new Error(`Codex usage API: ${res.status}`);
  const data = await res.json() as WhamUsageResponse;

  const primary = data.rate_limit?.primary_window ?? data.primary_window;
  const secondary = data.rate_limit?.secondary_window ?? data.secondary_window;
  const remaining = (pct?: number) => Math.max(0, Math.min(100, Math.round(100 - (pct ?? 0))));
  const resetMs = (val?: string) => val ? Date.parse(val) : Date.now() + 5 * 3600_000;

  return {
    service: 'codex',
    sessionPct: remaining(primary?.used_percent),
    weeklyPct: remaining(secondary?.used_percent),
    sessionResetsAt: resetMs(primary?.reset_at),
    weeklyResetsAt: resetMs(secondary?.reset_at),
    lastUpdated: Date.now(),
  };
}

// ──── Poller ────────────────────────────────────────────────────────────────

type UpdateListener = (states: QuotaState[]) => void;

export class QuotaPoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<UpdateListener> = new Set();
  private latestStates: QuotaState[] = [];

  onUpdate(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLatestStates(): QuotaState[] {
    return this.latestStates;
  }

  start(getCredentials: () => Promise<Credentials>, getGithubToken: GetGithubToken): void {
    const poll = async () => {
      const [creds, githubToken] = await Promise.all([getCredentials(), getGithubToken()]);
      const results = await Promise.allSettled([
        creds.claudeApiKey ? fetchClaude(creds.claudeApiKey) : Promise.reject('no credential'),
        githubToken ? fetchCopilot(githubToken) : Promise.reject('no credential'),
        creds.codexSessionToken ? fetchCodex(creds.codexSessionToken) : Promise.reject('no credential'),
      ]);

      const states: QuotaState[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') states.push(r.value);
        else if (r.reason !== 'no credential') {
          console.error('[ai-quota-tool] poller:', r.reason);
        }
      }

      if (states.length > 0) {
        this.latestStates = states;
        this.listeners.forEach((fn) => fn(states));
      }
    };

    poll();
    this.timer = setInterval(poll, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Merge a single state (from WS push) and notify listeners. */
  merge(incoming: QuotaState): void {
    this.latestStates = [
      ...this.latestStates.filter((s) => s.service !== incoming.service),
      incoming,
    ];
    this.listeners.forEach((fn) => fn(this.latestStates));
  }
}
