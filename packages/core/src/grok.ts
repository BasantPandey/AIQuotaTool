import type { QuotaState } from './types.js';
import { calcPct } from './utils.js';

/**
 * Pure Grok QuotaState builders and mappers.
 * Hosts must never invent remaining % (especially never invent 100 when unknown).
 *
 * VS Code: store grok.com `sso` cookie and POST /rest/rate-limits (same path as Claude sessionKey).
 * SuperGrok Settings → Usage weekly used% remains a conditional map via mapGrokWeeklyUsage.
 */

export function grokUsageUnknown(lastUpdated: number = Date.now()): QuotaState {
  return {
    service: 'grok',
    honesty: 'usage_unknown',
    lastUpdated,
  };
}

export function grokNotConnected(lastUpdated: number = Date.now()): QuotaState {
  return {
    service: 'grok',
    honesty: 'not_connected',
    lastUpdated,
  };
}

/**
 * VS Code empty slot when no Grok secret is saved yet (and no fresher Chrome push).
 * Setup path: paste grok.com `sso` cookie in Set Up Accounts.
 */
export function grokBrowserSessionRequired(lastUpdated: number = Date.now()): QuotaState {
  return {
    service: 'grok',
    honesty: 'browser_session_required',
    lastUpdated,
  };
}

// ──── grok.com /rest/rate-limits (session short-window) ─────────────────────

/** First-party rate-limit window bucket (low/high effort). */
export interface GrokEffortRateLimits {
  remainingQueries?: number;
  totalQueries?: number;
  waitTimeSeconds?: number;
  cost?: number;
}

/**
 * Body shape observed on POST https://grok.com/rest/rate-limits
 * (`requestKind` + `modelName`). Field names match first-party JSON.
 */
export interface GrokRateLimitsResponse {
  remainingQueries?: number;
  totalQueries?: number;
  remainingTokens?: number;
  totalTokens?: number;
  windowSizeSeconds?: number;
  lowEffortRateLimits?: GrokEffortRateLimits;
  highEffortRateLimits?: GrokEffortRateLimits;
}

function finiteNonNeg(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Map grok.com rate-limits JSON → QuotaState session remaining %.
 * Prefers token window (remainingTokens/totalTokens); falls back to query counts.
 * Invalid/missing counters → usage_unknown (never invent 100).
 */
export function mapGrokRateLimits(
  data: GrokRateLimitsResponse,
  lastUpdated: number = Date.now(),
): QuotaState {
  const remainingTokens = finiteNonNeg(data.remainingTokens);
  const totalTokens = finiteNonNeg(data.totalTokens);
  const remainingQueries = finiteNonNeg(data.remainingQueries);
  const totalQueries = finiteNonNeg(data.totalQueries);

  let remaining: number | undefined;
  let total: number | undefined;

  if (remainingTokens != null && totalTokens != null && totalTokens > 0) {
    remaining = remainingTokens;
    total = totalTokens;
  } else if (remainingQueries != null && totalQueries != null && totalQueries > 0) {
    remaining = remainingQueries;
    total = totalQueries;
  } else {
    // Nested low-effort window as last resort
    const low = data.lowEffortRateLimits;
    const lowRem = finiteNonNeg(low?.remainingQueries);
    const lowTot = finiteNonNeg(low?.totalQueries);
    if (lowRem != null && lowTot != null && lowTot > 0) {
      remaining = lowRem;
      total = lowTot;
    }
  }

  if (remaining == null || total == null || total <= 0) {
    return grokUsageUnknown(lastUpdated);
  }

  const used = Math.max(0, total - remaining);
  const sessionPct = calcPct(used, total);

  const waitSec =
    finiteNonNeg(data.lowEffortRateLimits?.waitTimeSeconds) ??
    finiteNonNeg(data.windowSizeSeconds);

  const state: QuotaState = {
    service: 'grok',
    sessionPct,
    lastUpdated,
  };
  if (waitSec != null && waitSec > 0) {
    state.sessionResetsAt = lastUpdated + Math.round(waitSec * 1000);
  }
  return state;
}

/**
 * First-party SuperGrok weekly pool fields (Settings → Usage contract).
 * `usedPct` is percentage USED (0–100), matching the documented Usage UI.
 */
export interface GrokWeeklyUsageInput {
  usedPct: number;
  /** Unix timestamp (ms) when the weekly pool resets, if known. */
  weeklyResetsAt?: number;
}

/**
 * Map SuperGrok weekly used % → QuotaState remaining weekly %.
 * Pure: no network. Invalid usedPct fails closed to usage_unknown (never invent 100).
 */
export function mapGrokWeeklyUsage(
  input: GrokWeeklyUsageInput,
  lastUpdated: number = Date.now(),
): QuotaState {
  const used = input.usedPct;
  // Fail closed: only accept a real 0–100 used % (never clamp garbage into “full remaining”).
  if (!Number.isFinite(used) || used < 0 || used > 100) {
    return grokUsageUnknown(lastUpdated);
  }
  const weeklyPct = Math.max(0, Math.min(100, Math.round(100 - used)));
  const state: QuotaState = {
    service: 'grok',
    weeklyPct,
    lastUpdated,
  };
  if (input.weeklyResetsAt != null && Number.isFinite(input.weeklyResetsAt)) {
    state.weeklyResetsAt = input.weeklyResetsAt;
  }
  return state;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value != null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return undefined;
}

function readProtobufTimestampMs(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const t = Date.parse(value);
    return Number.isFinite(t) ? t : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value);
  }
  const rec = asRecord(value);
  if (!rec) return undefined;
  // Connect/protobuf JSON: { seconds, nanos } or { seconds: "123" }
  const sec = readNumber(rec, ['seconds']);
  if (sec == null) return undefined;
  const nanos = readNumber(rec, ['nanos']) ?? 0;
  return Math.round(sec * 1000 + nanos / 1e6);
}

function readResetMs(obj: Record<string, unknown>): number | undefined {
  const ms = readNumber(obj, [
    'weeklyResetsAt',
    'weekly_resets_at',
    'resetsAt',
    'resets_at',
    'resetAt',
    'reset_at',
  ]);
  if (ms != null) {
    return ms < 1e12 ? Math.round(ms * 1000) : Math.round(ms);
  }
  for (const key of ['weeklyResetAt', 'weekly_reset_at', 'resetTime', 'reset_time', 'end']) {
    const v = obj[key];
    if (typeof v === 'string') {
      const t = Date.parse(v);
      if (Number.isFinite(t)) return t;
    }
    const proto = readProtobufTimestampMs(v);
    if (proto != null) return proto;
  }
  // Nested currentPeriod.end (Settings → Usage / GetGrokCreditsConfig)
  const period = asRecord(obj['currentPeriod']) ?? asRecord(obj['current_period']);
  if (period) {
    const end = readProtobufTimestampMs(period['end']) ?? readResetMs(period);
    if (end != null) return end;
  }
  return undefined;
}

/**
 * Extract SuperGrok-style weekly used% from an unknown JSON body.
 * Accepts only explicit used-percentage fields in 0–100 — never free-tier message counts.
 *
 * First-party Settings → Usage (client) shape from GetGrokCreditsConfig:
 * `{ config: { creditUsagePercent, currentPeriod: { type, start, end }, productUsage: [...] } }`
 */
export function extractGrokWeeklyUsage(data: unknown): GrokWeeklyUsageInput | null {
  const root = asRecord(data);
  if (!root) return null;

  // Prefer Settings → Usage shaped objects only (not short-window rate-limit bags).
  const nestedCandidates: Array<Record<string, unknown> | null> = [
    root,
    asRecord(root['config']),
    asRecord(root['usage']),
    asRecord(root['weekly']),
    asRecord(root['weeklyUsage']),
    asRecord(root['weekly_usage']),
  ];

  for (const obj of nestedCandidates) {
    if (!obj) continue;
    // Ignore pure short-window rate-limit bags (remainingQueries without used%).
    if (
      obj['remainingQueries'] != null &&
      obj['creditUsagePercent'] == null &&
      obj['usedPct'] == null &&
      obj['usagePercent'] == null &&
      obj['usagePercentage'] == null
    ) {
      continue;
    }
    const usedPct = readNumber(obj, [
      'creditUsagePercent', // SuperGrok pool used% (first-party Settings UI)
      'credit_usage_percent',
      'usedPct',
      'used_pct',
      'usagePercentage',
      'usage_percentage',
      'usagePercent',
      'usage_percent',
      'percentUsed',
      'percent_used',
      'usedPercentage',
      'used_percentage',
      'percent', // select() helper on credits config
    ]);
    if (usedPct == null) continue;
    if (usedPct < 0 || usedPct > 100) continue;
    const weeklyResetsAt = readResetMs(obj);
    return weeklyResetsAt != null ? { usedPct, weeklyResetsAt } : { usedPct };
  }
  return null;
}

/**
 * Merge short-window (rate-limits) session reading with SuperGrok weekly pool reading.
 * Pure: no network. Never invents missing windows.
 */
export function combineGrokQuotaState(
  session: QuotaState | null | undefined,
  weekly: QuotaState | null | undefined,
  lastUpdated: number = Date.now(),
): QuotaState {
  const sessionPct =
    session?.service === 'grok' && session.sessionPct != null ? session.sessionPct : undefined;
  const sessionResetsAt =
    session?.service === 'grok' && session.sessionResetsAt != null
      ? session.sessionResetsAt
      : undefined;
  const weeklyPct =
    weekly?.service === 'grok' && weekly.weeklyPct != null ? weekly.weeklyPct : undefined;
  const weeklyResetsAt =
    weekly?.service === 'grok' && weekly.weeklyResetsAt != null
      ? weekly.weeklyResetsAt
      : undefined;

  if (sessionPct == null && weeklyPct == null) {
    // Prefer the more specific honesty if either side has one.
    if (session?.honesty != null) return { ...session, lastUpdated };
    if (weekly?.honesty != null) return { ...weekly, lastUpdated };
    return grokUsageUnknown(lastUpdated);
  }

  const state: QuotaState = {
    service: 'grok',
    lastUpdated,
  };
  if (sessionPct != null) state.sessionPct = sessionPct;
  if (sessionResetsAt != null) state.sessionResetsAt = sessionResetsAt;
  if (weeklyPct != null) state.weeklyPct = weeklyPct;
  if (weeklyResetsAt != null) state.weeklyResetsAt = weeklyResetsAt;
  return state;
}
