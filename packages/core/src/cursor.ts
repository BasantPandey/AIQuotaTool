import type { QuotaState } from './types.js';

/**
 * Cursor dashboard payload: GET https://cursor.com/api/usage-summary with the
 * WorkosCursorSessionToken cookie. Unofficial, so every field is checked.
 * Amounts are cents. Pro plans have two pools (auto and api); the pool with
 * the least remaining is the pressure value.
 * See docs/research/cursor-usage-surfaces.md on branch research/cursor-quota.
 */

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function remainingFromUsed(usedPct: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - usedPct)));
}

function planUsedPercents(plan: Record<string, unknown>): number[] {
  const pools = [num(plan.autoPercentUsed), num(plan.apiPercentUsed)].filter(
    (value): value is number => value != null,
  );
  if (pools.length > 0) return pools;
  const total = num(plan.totalPercentUsed);
  if (total != null) return [total];
  const used = num(plan.used);
  const limit = num(plan.limit);
  if (used != null && limit != null && limit > 0) return [(used / limit) * 100];
  return [];
}

export function cursorUsageUnknown(lastUpdated: number = Date.now()): QuotaState {
  return { service: 'cursor', honesty: 'usage_unknown', lastUpdated };
}

export function mapCursorUsageSummary(body: unknown, lastUpdated: number = Date.now()): QuotaState {
  if (body == null || typeof body !== 'object') return cursorUsageUnknown(lastUpdated);
  const record = body as Record<string, unknown>;
  if (record.isUnlimited === true) return cursorUsageUnknown(lastUpdated);

  const usage = record.individualUsage;
  if (usage == null || typeof usage !== 'object') return cursorUsageUnknown(lastUpdated);
  const plan = (usage as Record<string, unknown>).plan;
  if (plan == null || typeof plan !== 'object') return cursorUsageUnknown(lastUpdated);

  const usedPercents = planUsedPercents(plan as Record<string, unknown>);
  if (usedPercents.length === 0) return cursorUsageUnknown(lastUpdated);

  const state: QuotaState = {
    service: 'cursor',
    monthlyPct: remainingFromUsed(Math.max(...usedPercents)),
    lastUpdated,
  };
  const resetsAt =
    typeof record.billingCycleEnd === 'string' ? Date.parse(record.billingCycleEnd) : NaN;
  if (Number.isFinite(resetsAt)) state.monthlyResetsAt = resetsAt;
  return state;
}
