import type { KeyRecord, QuotaState, ServiceId } from '@ai-quota-tool/core';
import {
  apiKeyInvalid,
  deepseekBalanceUnreadable,
  isAdminKeyService,
  kimiBalanceUnreadable,
  mapAnthropicCost,
  mapCopilotPremiumUsage,
  mapCursorTeamSpend,
  mapDeepSeekBalance,
  mapKimiBalance,
  mapOpenAICost,
  mapXaiPrepaidBalance,
  monthStartUtc,
  SERVICE_LABELS,
} from '@ai-quota-tool/core';

/**
 * One reading for one named API key. Each secret goes only to its own provider.
 * A 401 or 403 gives a "Key rejected" state. Other failures throw, so the last good reading stays.
 */
type KeyFetcher = (secret: string, key: KeyRecord, now: number) => Promise<QuotaState>;

async function getJson(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(`Could not reach ${new URL(url).host}. Check the connection and the site access of the extension.`);
  }
}

const bearer = (secret: string) => ({ Accept: 'application/json', Authorization: `Bearer ${secret}` });

async function balance(
  service: 'deepseek' | 'kimi',
  url: string,
  secret: string,
  now: number,
): Promise<QuotaState> {
  const res = await getJson(url, { headers: bearer(secret) });
  if (res.status === 401 || res.status === 403) return apiKeyInvalid(service, now);
  if (!res.ok) throw new Error(`${SERVICE_LABELS[service]} balance API returned ${res.status}`);
  const body: unknown = await res.json().catch(() => null);
  try {
    return service === 'deepseek' ? mapDeepSeekBalance(body, now) : mapKimiBalance(body, now);
  } catch {
    return service === 'deepseek' ? deepseekBalanceUnreadable(now) : kimiBalanceUnreadable(now);
  }
}

/** A cost report of one month has at most 31 daily buckets, so one page is normal. The cap stops a bad cursor loop. */
const MAX_PAGES = 5;

async function costPages(
  service: 'anthropic' | 'openai',
  url: (page: string | null) => string,
  headers: Record<string, string>,
): Promise<unknown[] | 'rejected'> {
  const pages: unknown[] = [];
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await getJson(url(page), { headers: { Accept: 'application/json', ...headers } });
    if (res.status === 401 || res.status === 403) return 'rejected';
    if (!res.ok) throw new Error(`${SERVICE_LABELS[service]} cost API returned ${res.status}`);
    const body = (await res.json().catch(() => null)) as { has_more?: unknown; next_page?: unknown } | null;
    pages.push(body);
    if (body?.has_more !== true || typeof body.next_page !== 'string') break;
    page = body.next_page;
  }
  return pages;
}

const pageParam = (page: string | null) => (page ? `&page=${encodeURIComponent(page)}` : '');

const FETCHERS: Partial<Record<ServiceId, KeyFetcher>> = {
  deepseek: (secret, _key, now) => balance('deepseek', 'https://api.deepseek.com/user/balance', secret, now),
  kimi: (secret, _key, now) => balance('kimi', 'https://api.moonshot.ai/v1/users/me/balance', secret, now),

  // https://platform.claude.com/docs/en/api/beta/organization/cost_report/retrieve
  async anthropic(secret, _key, now) {
    const start = encodeURIComponent(monthStartUtc(now).toISOString());
    const pages = await costPages(
      'anthropic',
      (page) => `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${start}&limit=31${pageParam(page)}`,
      { 'x-api-key': secret, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    );
    return pages === 'rejected' ? apiKeyInvalid('anthropic', now) : mapAnthropicCost(pages, now);
  },

  // https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/usage/methods/costs
  async openai(secret, _key, now) {
    const start = Math.floor(monthStartUtc(now).getTime() / 1000);
    const pages = await costPages(
      'openai',
      (page) => `https://api.openai.com/v1/organization/costs?start_time=${start}&limit=31${pageParam(page)}`,
      { Authorization: `Bearer ${secret}` },
    );
    return pages === 'rejected' ? apiKeyInvalid('openai', now) : mapOpenAICost(pages, now);
  },

  // https://docs.x.ai/developers/rest-api-reference/management/billing
  async xai(secret, key, now) {
    if (!key.teamId) throw new Error('Add the xAI team ID for this key.');
    const res = await getJson(
      `https://management-api.x.ai/v1/billing/teams/${encodeURIComponent(key.teamId)}/prepaid/balance`,
      { headers: bearer(secret) },
    );
    if (res.status === 401 || res.status === 403) return apiKeyInvalid('xai', now);
    if (res.status === 404) throw new Error('xAI did not find this team. Check the team ID.');
    if (!res.ok) throw new Error(`xAI billing API returned ${res.status}`);
    return mapXaiPrepaidBalance(await res.json().catch(() => null), now);
  },

  // https://cursor.com/docs/account/teams/admin-api - Basic auth with the key as the user name.
  async 'cursor-team'(secret, _key, now) {
    const pages: unknown[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await getJson('https://api.cursor.com/teams/spend', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Basic ${btoa(`${secret}:`)}` },
        body: JSON.stringify({ page, pageSize: 100 }),
      });
      if (res.status === 401 || res.status === 403) return apiKeyInvalid('cursor-team', now);
      if (!res.ok) throw new Error(`Cursor Admin API returned ${res.status}`);
      const body = (await res.json().catch(() => null)) as { totalPages?: unknown } | null;
      pages.push(body);
      if (typeof body?.totalPages !== 'number' || page >= body.totalPages) break;
    }
    return mapCursorTeamSpend(pages, now);
  },

  // https://docs.github.com/en/rest/billing/usage - a fine-grained token with the "Plan" user permission (read).
  async 'copilot-premium'(secret, _key, now) {
    const headers = { ...bearer(secret), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    const userRes = await getJson('https://api.github.com/user', { headers });
    if (userRes.status === 401 || userRes.status === 403) return apiKeyInvalid('copilot-premium', now);
    if (!userRes.ok) throw new Error(`GitHub user API returned ${userRes.status}`);
    const login = ((await userRes.json().catch(() => null)) as { login?: unknown } | null)?.login;
    if (typeof login !== 'string') throw new Error('GitHub did not return the account name.');
    const month = new Date(now);
    const res = await getJson(
      `https://api.github.com/users/${encodeURIComponent(login)}/settings/billing/premium_request/usage?year=${month.getUTCFullYear()}&month=${month.getUTCMonth() + 1}`,
      { headers },
    );
    if (res.status === 401 || res.status === 403) return apiKeyInvalid('copilot-premium', now);
    if (res.status === 404) throw new Error('GitHub has no premium request report for this account. It needs a personal Copilot plan.');
    if (!res.ok) throw new Error(`GitHub billing API returned ${res.status}`);
    return mapCopilotPremiumUsage(await res.json().catch(() => null), now);
  },
};

/** One reading for a key, marked with the key id so the merge keeps each key apart. */
export async function fetchKeyReading(key: KeyRecord, secret: string): Promise<QuotaState> {
  const fetcher = FETCHERS[key.service];
  if (!fetcher) throw new Error(`${SERVICE_LABELS[key.service]} does not take an API key in Chrome.`);
  const state = await fetcher(secret, key, Date.now());
  return { ...state, connectionId: key.id, kind: 'key' };
}

/** The test call before a key is saved. Throws a message for the user when the provider rejects the key. */
export async function validateKey(key: KeyRecord, secret: string): Promise<QuotaState> {
  const state = await fetchKeyReading(key, secret);
  if (state.honesty === 'api_key_invalid') {
    throw new Error(
      isAdminKeyService(key.service)
        ? `The provider rejected this key. Use a ${SERVICE_LABELS[key.service]} admin or management key.`
        : `The provider rejected this ${SERVICE_LABELS[key.service]} key.`,
    );
  }
  return state;
}
