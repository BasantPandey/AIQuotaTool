import type { QuotaState, ServiceId } from './types.js';

/** Start of the current month in UTC. Admin cost reports sum from here. */
export function monthStartUtc(now: number): Date {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

type Cost = { amount: number; currency: string };

function orgSpend(service: ServiceId, cost: Cost | null, lastUpdated: number): QuotaState {
  if (cost == null) return { service, honesty: 'usage_unknown', lastUpdated };
  return { service, spend: { amount: cost.amount, currency: cost.currency, scope: 'org' }, lastUpdated };
}

/** Sum every bucket result on every page. Returns null when a page is not the expected shape. */
function sumPages(pages: readonly unknown[], readResult: (result: unknown) => Cost | null): Cost | null {
  let amount = 0;
  let currency = 'USD';
  for (const page of pages) {
    const data = (page as { data?: unknown } | null)?.data;
    if (!Array.isArray(data)) return null;
    for (const bucket of data) {
      const results = (bucket as { results?: unknown } | null)?.results;
      if (!Array.isArray(results)) return null;
      for (const result of results) {
        const cost = readResult(result);
        if (cost == null) return null;
        amount += cost.amount;
        currency = cost.currency;
      }
    }
  }
  return { amount, currency };
}

/**
 * Anthropic `GET /v1/organizations/cost_report` pages for this month.
 * `amount` is a decimal string in cents: "123.45" USD is $1.23.
 */
export function mapAnthropicCost(pages: readonly unknown[], lastUpdated: number = Date.now()): QuotaState {
  const cost = sumPages(pages, (result) => {
    const r = result as { amount?: unknown; currency?: unknown } | null;
    const cents = typeof r?.amount === 'string' ? Number(r.amount) : NaN;
    if (!Number.isFinite(cents) || typeof r?.currency !== 'string') return null;
    return { amount: cents / 100, currency: r.currency.toUpperCase() };
  });
  return orgSpend('anthropic', cost, lastUpdated);
}

/**
 * OpenAI `GET /v1/organization/costs` pages for this month.
 * `amount.value` is a number in dollars, `amount.currency` is "usd".
 */
export function mapOpenAICost(pages: readonly unknown[], lastUpdated: number = Date.now()): QuotaState {
  const cost = sumPages(pages, (result) => {
    const amount = (result as { amount?: { value?: unknown; currency?: unknown } } | null)?.amount;
    if (typeof amount?.value !== 'number' || !Number.isFinite(amount.value) || typeof amount.currency !== 'string') {
      return null;
    }
    return { amount: amount.value, currency: amount.currency.toUpperCase() };
  });
  return orgSpend('openai', cost, lastUpdated);
}
