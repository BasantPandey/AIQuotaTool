import type { QuotaState } from './types.js';

/**
 * GET https://www.perplexity.ai/rest/billing/credits?version=2.18&source=default (not documented).
 * Amounts are cents. `credit_grants[]` has `type` (recurring, promotional, purchased) and `amount_cents`.
 * Usage spends the recurring grant first (CodexBar), so recurring used = min(total usage, recurring grant).
 * The monthly percent comes only from a recurring grant. Query limits have no total, so no percent.
 */
function cents(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function mapPerplexityCredits(body: unknown, lastUpdated: number = Date.now()): QuotaState {
  const unknown: QuotaState = { service: 'perplexity', honesty: 'usage_unknown', lastUpdated };
  if (body == null || typeof body !== 'object') return unknown;
  const b = body as Record<string, unknown>;
  const used = cents(b.total_usage_cents);
  if (!Array.isArray(b.credit_grants) || used == null) return unknown;

  let recurring = 0;
  for (const grant of b.credit_grants) {
    const g = grant as { type?: unknown; amount_cents?: unknown } | null;
    const amount = cents(g?.amount_cents);
    if (amount == null) return unknown;
    if (g?.type === 'recurring') recurring += amount;
  }
  // No monthly grant (for example the free plan): there is no pool to give a percent for.
  if (recurring === 0) return unknown;

  const left = recurring - Math.min(used, recurring);
  const state: QuotaState = {
    service: 'perplexity',
    monthlyPct: Math.round((left / recurring) * 100),
    monthlyLabel: 'Monthly credits',
    lastUpdated,
  };
  const renewal = cents(b.renewal_date_ts);
  if (renewal != null) state.monthlyResetsAt = renewal * 1000;
  return state;
}
