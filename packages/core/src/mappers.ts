import type { ClaudeSubcategory, QuotaState } from './types.js';
import { calcPct } from './utils.js';

// ──── Claude usage API shape (claude.ai) ────────────────────────────────────

export interface ClaudeUsageBucket {
  utilization: number;
  resets_at: string | null;
}

export interface ClaudeUsageResponse {
  five_hour: ClaudeUsageBucket | null;
  seven_day: ClaudeUsageBucket | null;
  seven_day_sonnet: ClaudeUsageBucket | null;
  seven_day_opus: ClaudeUsageBucket | null;
  seven_day_cowork: ClaudeUsageBucket | null;
  seven_day_omelette: ClaudeUsageBucket | null;
}

/**
 * Map a Claude organizations usage JSON payload to QuotaState.
 * Pure: no network. `lastUpdated` defaults to Date.now() for host convenience.
 */
export function mapClaudeUsage(
  data: ClaudeUsageResponse,
  lastUpdated: number = Date.now(),
): QuotaState {
  const subcategories: ClaudeSubcategory[] = [];

  if (data.seven_day_sonnet != null) {
    const pct = calcPct(data.seven_day_sonnet.utilization, 100);
    subcategories.push({
      name: 'Sonnet',
      usedPct: data.seven_day_sonnet.utilization,
      label: `${pct}% left`,
    });
  }
  if (data.seven_day_omelette != null) {
    const pct = calcPct(data.seven_day_omelette.utilization, 100);
    subcategories.push({
      name: 'Designs',
      usedPct: data.seven_day_omelette.utilization,
      label: `${pct}% left`,
    });
  }
  if (data.seven_day_cowork != null) {
    const pct = calcPct(data.seven_day_cowork.utilization, 100);
    subcategories.push({
      name: 'Daily Routines',
      usedPct: data.seven_day_cowork.utilization,
      label: `${pct}% left`,
    });
  }

  const session = claudeWindow(data.five_hour);
  const weekly = claudeWindow(data.seven_day);

  return {
    service: 'claude',
    ...(session && { sessionPct: session.pct }),
    ...(session?.resetsAt != null && { sessionResetsAt: session.resetsAt }),
    ...(weekly && { weeklyPct: weekly.pct }),
    ...(weekly?.resetsAt != null && { weeklyResetsAt: weekly.resetsAt }),
    ...(subcategories.length > 0 && { subcategories }),
    ...(!session && !weekly && { honesty: 'usage_unknown' as const }),
    lastUpdated,
  };
}

function claudeWindow(
  bucket: ClaudeUsageBucket | null | undefined,
): { pct: number; resetsAt: number | undefined } | undefined {
  if (typeof bucket?.utilization !== 'number') return undefined;
  const ms = bucket.resets_at ? Date.parse(bucket.resets_at) : NaN;
  return { pct: calcPct(bucket.utilization, 100), resetsAt: Number.isNaN(ms) ? undefined : ms };
}

// ──── Codex / ChatGPT wham usage shape ──────────────────────────────────────

/** Shape from openai/codex `RateLimitWindowSnapshot`. Times are Unix seconds. */
export interface WhamWindow {
  used_percent: number;
  limit_window_seconds?: number;
  reset_after_seconds?: number;
  reset_at?: number;
}

export interface WhamUsageResponse {
  plan_type?: string;
  rate_limit?: {
    limit_reached?: boolean;
    primary_window?: WhamWindow | null;
    secondary_window?: WhamWindow | null;
  };
  primary_window?: WhamWindow | null;
  secondary_window?: WhamWindow | null;
}

const DAY_SECONDS = 86_400;
const MONTH_SECONDS = 28 * DAY_SECONDS;

function remainingFromUsedPct(usedPct: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - usedPct)));
}

function resetMs(window: WhamWindow, lastUpdated: number): number | undefined {
  if (typeof window.reset_at === 'number') return window.reset_at * 1000;
  if (typeof window.reset_after_seconds === 'number') return lastUpdated + window.reset_after_seconds * 1000;
  return undefined;
}

/**
 * Map a ChatGPT Codex wham/usage JSON payload to QuotaState.
 * A window of 28 days or longer is monthly (the free plan has one 30-day window).
 * A window of one day or longer is weekly. Without `limit_window_seconds`,
 * the primary window is the session and the secondary window is weekly.
 * Pure: no network.
 */
export function mapCodexUsage(
  data: WhamUsageResponse,
  lastUpdated: number = Date.now(),
): QuotaState {
  const state: QuotaState = { service: 'codex', lastUpdated };
  const windows = [
    { window: data.rate_limit?.primary_window ?? data.primary_window, weekly: false },
    { window: data.rate_limit?.secondary_window ?? data.secondary_window, weekly: true },
  ];

  for (const { window, weekly: byPosition } of windows) {
    if (typeof window?.used_percent !== 'number') continue;
    const seconds = window.limit_window_seconds;
    const weekly = typeof seconds === 'number' ? seconds >= DAY_SECONDS : byPosition;
    const pct = remainingFromUsedPct(window.used_percent);
    const resetsAt = resetMs(window, lastUpdated);
    if (typeof seconds === 'number' && seconds >= MONTH_SECONDS) {
      state.monthlyPct = pct;
      if (resetsAt != null) state.monthlyResetsAt = resetsAt;
    } else if (weekly) {
      state.weeklyPct = pct;
      if (resetsAt != null) state.weeklyResetsAt = resetsAt;
    } else {
      state.sessionPct = pct;
      if (resetsAt != null) state.sessionResetsAt = resetsAt;
    }
  }

  if (state.sessionPct == null && state.weeklyPct == null && state.monthlyPct == null) state.honesty = 'usage_unknown';
  return state;
}
