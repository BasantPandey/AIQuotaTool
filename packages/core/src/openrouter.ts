import type { QuotaState } from './types.js';

/**
 * GET https://openrouter.ai/api/v1/key with a normal key. All numbers are USD for this one key.
 * `limit` is the cap on the key, or null. `limit_remaining` is the part of the cap that is left.
 * `limit_reset` is how often the cap resets ("monthly"), not a date.
 */

function money(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function mapOpenRouterKey(body: unknown, lastUpdated: number = Date.now()): QuotaState {
  const data = (body as { data?: Record<string, unknown> } | null)?.data;
  if (data == null || typeof data !== 'object') {
    return { service: 'openrouter', honesty: 'usage_unknown', lastUpdated };
  }
  const limit = money(data.limit);
  const remaining = money(data.limit_remaining);
  if (limit != null && remaining != null) {
    const amount = Math.max(0, limit - remaining);
    return { service: 'openrouter', spend: { amount, currency: 'USD', limit, scope: 'key' }, lastUpdated };
  }
  const monthly = money(data.usage_monthly);
  if (monthly != null) {
    return { service: 'openrouter', spend: { amount: monthly, currency: 'USD', scope: 'key' }, lastUpdated };
  }
  return { service: 'openrouter', honesty: 'usage_unknown', lastUpdated };
}
