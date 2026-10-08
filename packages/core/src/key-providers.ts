import type { QuotaState } from './types.js';

const record = (value: unknown): Record<string, unknown> | null =>
  value != null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * xAI `GET /v1/billing/teams/{team_id}/prepaid/balance` (management key).
 * `total.val` is the prepaid ledger in USD cents, inverted: "-1000" is $10.00 left.
 * https://docs.x.ai/developers/rest-api-reference/management/billing
 */
export function mapXaiPrepaidBalance(body: unknown, lastUpdated: number = Date.now()): QuotaState {
  const raw = record(record(body)?.total)?.val;
  const cents = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(cents)) return { service: 'xai', honesty: 'balance_unreadable', lastUpdated };
  const left = Math.max(0, -cents) / 100;
  const available = left > 0;
  return {
    service: 'xai',
    balance: { available, infos: [{ currency: 'USD', total: left.toFixed(2) }] },
    ...(available ? {} : { honesty: 'balance_empty' as const }),
    lastUpdated,
  };
}

/**
 * Cursor Admin API `POST /teams/spend` pages. Each member has `spendCents` for the current billing cycle.
 * https://cursor.com/docs/account/teams/admin-api
 */
export function mapCursorTeamSpend(pages: readonly unknown[], lastUpdated: number = Date.now()): QuotaState {
  let cents = 0;
  for (const page of pages) {
    const members = record(page)?.teamMemberSpend;
    if (!Array.isArray(members)) return { service: 'cursor-team', honesty: 'usage_unknown', lastUpdated };
    for (const member of members) {
      const spend = finite(record(member)?.spendCents);
      if (spend == null) return { service: 'cursor-team', honesty: 'usage_unknown', lastUpdated };
      cents += spend;
    }
  }
  return { service: 'cursor-team', spend: { amount: cents / 100, currency: 'USD', scope: 'org' }, lastUpdated };
}

/**
 * GitHub `GET /users/{username}/settings/billing/premium_request/usage` for this month.
 * `grossQuantity` counts the premium requests used. `netAmount` is the USD billed after the plan allowance.
 * https://docs.github.com/en/rest/billing/usage
 */
export function mapCopilotPremiumUsage(body: unknown, lastUpdated: number = Date.now()): QuotaState {
  const items = record(body)?.usageItems;
  if (!Array.isArray(items)) return { service: 'copilot-premium', honesty: 'usage_unknown', lastUpdated };
  let used = 0;
  let billed = 0;
  for (const item of items) {
    const quantity = finite(record(item)?.grossQuantity);
    const amount = finite(record(item)?.netAmount);
    if (quantity == null || amount == null) return { service: 'copilot-premium', honesty: 'usage_unknown', lastUpdated };
    used += quantity;
    billed += amount;
  }
  return {
    service: 'copilot-premium',
    creditsUsed: Math.round(used * 100) / 100,
    spend: { amount: Math.round(billed * 100) / 100, currency: 'USD', scope: 'account' },
    lastUpdated,
  };
}
