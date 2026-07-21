import type { ClaudeSubcategory, QuotaState } from './types.js';
import { calcPct } from './utils.js';

// ──── Claude usage API shape (claude.ai) ────────────────────────────────────

export interface ClaudeUsageBucket {
  utilization: number;
  resets_at: string;
}

export interface ClaudeUsageResponse {
  five_hour: ClaudeUsageBucket;
  seven_day: ClaudeUsageBucket;
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

  return {
    service: 'claude',
    sessionPct: calcPct(data.five_hour.utilization, 100),
    weeklyPct: calcPct(data.seven_day.utilization, 100),
    sessionResetsAt: Date.parse(data.five_hour.resets_at),
    weeklyResetsAt: Date.parse(data.seven_day.resets_at),
    ...(subcategories.length > 0 && { subcategories }),
    lastUpdated,
  };
}

// ──── Codex / ChatGPT wham usage shape ──────────────────────────────────────

export interface WhamWindow {
  used_percent: number;
  reset_at: string;
}

export interface WhamUsageResponse {
  plan_type?: string;
  rate_limit?: {
    limit_reached?: boolean;
    primary_window?: WhamWindow;
    secondary_window?: WhamWindow;
  };
  primary_window?: WhamWindow;
  secondary_window?: WhamWindow;
}

function extractWindow(
  data: WhamUsageResponse,
  key: 'primary_window' | 'secondary_window',
): WhamWindow | undefined {
  return data.rate_limit?.[key] ?? data[key];
}

function parseResetAt(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? fallbackMs : ms;
}

function remainingFromUsedPct(usedPct: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round(100 - (usedPct ?? 0))));
}

/**
 * Map a ChatGPT Codex wham/usage JSON payload to QuotaState.
 * Pure: no network.
 */
export function mapCodexUsage(
  data: WhamUsageResponse,
  lastUpdated: number = Date.now(),
): QuotaState {
  const fiveHour = extractWindow(data, 'primary_window');
  const weekly = extractWindow(data, 'secondary_window');
  const fallbackReset = lastUpdated + 5 * 3600_000;

  return {
    service: 'codex',
    sessionPct: remainingFromUsedPct(fiveHour?.used_percent),
    weeklyPct: remainingFromUsedPct(weekly?.used_percent),
    sessionResetsAt: parseResetAt(fiveHour?.reset_at, fallbackReset),
    weeklyResetsAt: parseResetAt(weekly?.reset_at, fallbackReset),
    lastUpdated,
  };
}
