// Node.js fetchers — no CORS restrictions, uses credentials from SecretStorage.
// This is the standalone path: VS Code fetches quota directly without Chrome.
import type { QuotaState, ClaudeSubcategory } from '@ai-quota-tool/core';
import { calcPct } from '@ai-quota-tool/core';
import type { Credentials } from './credentials.js';

type GetGithubToken = () => Promise<string | undefined>;

const POLL_INTERVAL_MS = 60_000;

// ──── Claude ────────────────────────────────────────────────────────────────

interface ClaudeOrg { uuid: string }

interface ClaudeUsageBucket {
  utilization: number;
  resets_at: string;
}

interface ClaudeUsageResponse {
  five_hour: ClaudeUsageBucket;
  seven_day: ClaudeUsageBucket;
  seven_day_sonnet: ClaudeUsageBucket | null;
  seven_day_opus: ClaudeUsageBucket | null;
  seven_day_cowork: ClaudeUsageBucket | null;
  seven_day_omelette: ClaudeUsageBucket | null;
}

async function fetchClaude(sessionKey: string): Promise<QuotaState> {
  const headers = {
    'Accept': 'application/json',
    'Cookie': `sessionKey=${sessionKey}`,
  };

  const orgRes = await fetch('https://claude.ai/api/organizations', { headers });
  if (!orgRes.ok) throw new Error(`Claude orgs API: ${orgRes.status}`);
  const orgs = await orgRes.json() as ClaudeOrg[];
  const orgId = orgs[0]?.uuid;
  if (!orgId) throw new Error('No Claude org found');

  const usageRes = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, { headers });
  if (!usageRes.ok) throw new Error(`Claude usage API: ${usageRes.status}`);
  const data = await usageRes.json() as ClaudeUsageResponse;

  const subcategories: ClaudeSubcategory[] = [];
  if (data.seven_day_sonnet != null) {
    const pct = calcPct(data.seven_day_sonnet.utilization, 100);
    subcategories.push({ name: 'Sonnet', usedPct: data.seven_day_sonnet.utilization, label: `${pct}% left` });
  }
  if (data.seven_day_omelette != null) {
    const pct = calcPct(data.seven_day_omelette.utilization, 100);
    subcategories.push({ name: 'Designs', usedPct: data.seven_day_omelette.utilization, label: `${pct}% left` });
  }
  if (data.seven_day_cowork != null) {
    const pct = calcPct(data.seven_day_cowork.utilization, 100);
    subcategories.push({ name: 'Daily Routines', usedPct: data.seven_day_cowork.utilization, label: `${pct}% left` });
  }

  return {
    service: 'claude',
    sessionPct: calcPct(data.five_hour.utilization, 100),
    weeklyPct: calcPct(data.seven_day.utilization, 100),
    sessionResetsAt: Date.parse(data.five_hour.resets_at),
    weeklyResetsAt: Date.parse(data.seven_day.resets_at),
    ...(subcategories.length > 0 && { subcategories }),
    lastUpdated: Date.now(),
  };
}

// ──── GitHub Copilot ────────────────────────────────────────────────────────

interface CopilotSeatResponse {
  copilot_plan?: string;
}

async function fetchCopilot(token: string): Promise<QuotaState> {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const seatRes = await fetch('https://api.github.com/user/copilot', { headers });
  if (seatRes.status === 404) throw new Error('No active Copilot subscription');
  if (!seatRes.ok) throw new Error(`Copilot seat API: ${seatRes.status}`);

  const seat = await seatRes.json() as CopilotSeatResponse;
  const isPaid = seat.copilot_plan && seat.copilot_plan !== 'free';

  // Paid plans moved to usage-based billing (June 2026) — no fixed quota.
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1, 1, );
  nextMonth.setHours(0, 0, 0, 0);
  const resetsAt = nextMonth.getTime();

  return {
    service: 'copilot',
    sessionPct: isPaid ? 100 : 100,
    weeklyPct: isPaid ? 100 : 100,
    sessionResetsAt: resetsAt,
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
        creds.claudeSessionKey ? fetchClaude(creds.claudeSessionKey) : Promise.reject('no credential'),
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
