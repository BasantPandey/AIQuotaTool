/**
 * Shared Node fetch helpers for VS Code host (poller + Save & Test).
 * Remaining % math stays in @ai-quota-tool/core pure mappers only.
 */
import { request as httpsRequest } from 'node:https';
import {
  apiKeyInvalid,
  combineGrokQuotaState,
  copilotAuthUnavailable,
  cursorUsageUnknown,
  mapCursorUsageSummary,
  extractBatchexecutePayload,
  GEMINI_USAGE_RPC,
  geminiUsageUnknown,
  mapGeminiUsage,
  mapCopilotUser,
  deepseekApiKeyInvalid,
  deepseekBalanceUnreadable,
  extractGrokWeeklyUsage,
  kimiApiKeyInvalid,
  kimiBalanceUnreadable,
  mapClaudeUsage,
  mapCodexUsage,
  mapCopilotSeatStatus,
  mapDeepSeekBalance,
  mapGrokRateLimits,
  mapGrokWeeklyUsage,
  isAdminKeyService,
  mapAnthropicCost,
  mapKimiBalance,
  mapOpenAICost,
  mapOpenRouterKey,
  monthStartUtc,
  type ClaudeUsageResponse,
  type GrokRateLimitsResponse,
  type QuotaState,
  type ServiceId,
  SERVICE_LABELS,
  type WhamUsageResponse,
} from '@ai-quota-tool/core';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface ClaudeOrg {
  uuid: string;
  name?: string;
}

function claudeHeaders(sessionKey: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Cookie: `sessionKey=${sessionKey}`,
    'User-Agent': BROWSER_UA,
    Referer: 'https://claude.ai/',
    Origin: 'https://claude.ai',
  };
}

/**
 * Build a Cookie header for ChatGPT session auth.
 *
 * NextAuth splits large sessions into `.0` / `.1` cookies. Those must be sent
 * under the original names — joining values into one cookie does NOT work.
 *
 * Accepted paste forms:
 * - Full Cookie header from Network (best): `__Secure-next-auth.session-token.0=…; __Secure-next-auth.session-token.1=…`
 * - Two lines: bare `.0` value then bare `.1` value
 * - Single unchunked value (rare): one `__Secure-next-auth.session-token` cookie
 */
export function codexCookieHeader(raw: string): string {
  let s = raw.trim().replace(/^cookie:\s*/i, '');
  if (!s) return '';

  // Already a Cookie header with named pairs
  if (/__Secure-next-auth\.session-token/i.test(s) && s.includes('=')) {
    // Keep only next-auth session-token cookies (drop unrelated noise if user pasted a huge Cookie:).
    // Split on ';' (a real Cookie header) AND newlines (user pasted "name=value" pairs one per line).
    const parts = s.split(/[;\r\n]+/).map((p) => p.trim()).filter(Boolean);
    const sessionParts = parts.filter((p) =>
      /^__Secure-next-auth\.session-token(?:\.\d+)?\s*=/i.test(p),
    );
    if (sessionParts.length > 0) return sessionParts.join('; ');
    return s;
  }

  // Bare chunk values: line1 = .0, line2 = .1 (or more)
  const lines = s
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return lines
      .map((value, i) => {
        const v = value.replace(/^__Secure-next-auth\.session-token(?:\.\d+)?\s*=\s*/i, '');
        return `__Secure-next-auth.session-token.${i}=${v}`;
      })
      .join('; ');
  }

  // Single bare value (unchunked)
  const one = lines[0] ?? s;
  const bare = one.replace(/^__Secure-next-auth\.session-token(?:\.\d+)?\s*=\s*/i, '');
  return `__Secure-next-auth.session-token=${bare}`;
}

/** True when input looks non-empty after Cookie construction. */
export function normalizeCodexSessionToken(raw: string): string {
  return codexCookieHeader(raw).trim();
}

function codexBrowserHeaders(cookieRaw: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Cookie: codexCookieHeader(cookieRaw),
    Referer: 'https://chatgpt.com/',
    'User-Agent': BROWSER_UA,
    Origin: 'https://chatgpt.com',
  };
}

function isHtmlBody(text: string): boolean {
  const t = text.trimStart().slice(0, 200).toLowerCase();
  return t.startsWith('<!doctype') || t.startsWith('<html') || t.includes('just a moment');
}

/**
 * Exchange session cookie for short-lived ChatGPT accessToken
 * (GET /api/auth/session) — required by backend-api/wham/usage.
 */
async function fetchCodexAccessToken(sessionRaw: string): Promise<string> {
  const cookie = codexCookieHeader(sessionRaw);
  if (!cookie) {
    throw new Error('Codex session cookie is empty');
  }

  const res = await fetch('https://chatgpt.com/api/auth/session', {
    headers: codexBrowserHeaders(sessionRaw),
  });
  const text = await res.text();

  if (isHtmlBody(text) || res.status === 403) {
    throw new Error(
      'ChatGPT blocked the request (Cloudflare/HTML). In DevTools Network, open any chatgpt.com request, copy the full Cookie request header, and paste that into Set Up Accounts.',
    );
  }
  if (res.status === 401) {
    throw new Error(
      'ChatGPT session API: 401 invalid or expired — paste BOTH session-token.0 and .1 (full values, double-click to copy)',
    );
  }
  if (!res.ok) {
    throw new Error(`ChatGPT session API: ${res.status}`);
  }

  let data: { accessToken?: string; access_token?: string; user?: unknown };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error('ChatGPT session API returned non-JSON (check cookie paste)');
  }

  const token = data.accessToken ?? data.access_token;
  if (typeof token !== 'string' || !token) {
    // Empty {} is the usual “cookies not accepted” response (HTTP 200).
    throw new Error(
      'ChatGPT did not return accessToken (cookie not accepted). Paste line1=.0 and line2=.1 full values, or paste the full Cookie header from Network → /api/auth/session.',
    );
  }
  return token;
}

async function loadClaudeOrgs(sessionKey: string): Promise<ClaudeOrg[]> {
  const orgRes = await fetch('https://claude.ai/api/organizations', {
    headers: claudeHeaders(sessionKey),
  });
  if (orgRes.status === 401 || orgRes.status === 403) {
    throw new Error(`Claude orgs API: ${orgRes.status} invalid or expired session key`);
  }
  if (!orgRes.ok) throw new Error(`Claude orgs API: ${orgRes.status}`);
  return (await orgRes.json()) as ClaudeOrg[];
}

/** Validate Claude session; returns org display name for setup UI. */
export async function validateClaudeSession(sessionKey: string): Promise<string> {
  const orgs = await loadClaudeOrgs(sessionKey);
  const org = orgs[0];
  if (!org) throw new Error('No Claude org found');
  return org.name ?? org.uuid;
}

/** Poll Claude usage via pure mapClaudeUsage. */
export async function fetchClaudeUsage(sessionKey: string): Promise<QuotaState> {
  const orgs = await loadClaudeOrgs(sessionKey);
  const orgId = orgs[0]?.uuid;
  if (!orgId) throw new Error('No Claude org found');

  const usageRes = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, {
    headers: claudeHeaders(sessionKey),
  });
  if (usageRes.status === 401 || usageRes.status === 403) {
    throw new Error(`Claude usage API: ${usageRes.status} invalid or expired session key`);
  }
  if (!usageRes.ok) throw new Error(`Claude usage API: ${usageRes.status}`);
  const data = (await usageRes.json()) as ClaudeUsageResponse;
  return mapClaudeUsage(data);
}

/** Validate Codex session by hitting the same usage endpoint as the poller. */
export async function validateCodexSession(sessionToken: string): Promise<void> {
  await fetchCodexUsage(sessionToken);
}

/**
 * Poll Codex usage via pure mapCodexUsage.
 * Auth: session cookies (.0/.1 names preserved) → /api/auth/session accessToken → Bearer on wham/usage.
 */
export async function fetchCodexUsage(sessionToken: string): Promise<QuotaState> {
  if (!codexCookieHeader(sessionToken)) throw new Error('Codex session token is empty');

  const accessToken = await fetchCodexAccessToken(sessionToken);
  const res = await fetch('https://chatgpt.com/backend-api/wham/usage', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      Cookie: codexCookieHeader(sessionToken),
      'User-Agent': BROWSER_UA,
      Referer: 'https://chatgpt.com/codex/settings/usage',
      Origin: 'https://chatgpt.com',
    },
  });
  const text = await res.text();
  if (isHtmlBody(text)) {
    throw new Error('Codex usage API blocked (HTML/Cloudflare)');
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Codex usage API: ${res.status} invalid or expired session token`);
  }
  if (!res.ok) throw new Error(`Codex usage API: ${res.status}`);
  const data = JSON.parse(text) as WhamUsageResponse;
  return mapCodexUsage(data);
}

/**
 * Copilot quota from `copilot_internal/user` (the source that VS Code itself uses).
 * An unknown shape or a 404 falls back to the seat check. It never invents 100%.
 */
export async function fetchCopilotUsage(token: string): Promise<QuotaState> {
  const res = await fetch('https://api.github.com/copilot_internal/user', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return copilotAuthUnavailable();
  if (res.ok) {
    const state = mapCopilotUser(await res.json().catch(() => null));
    if (state != null) return state;
  }
  return fetchCopilotSeat(token);
}

/**
 * Cursor monthly usage from the dashboard endpoint with the WorkosCursorSessionToken cookie. Not documented.
 * 401 is an ended session. 403 is often a bot check, so it throws and the last reading stays.
 */
export async function fetchCursorUsage(sessionToken: string): Promise<QuotaState> {
  const res = await fetch('https://cursor.com/api/usage-summary', {
    headers: {
      Accept: 'application/json',
      Cookie: `WorkosCursorSessionToken=${sessionToken}`,
      'User-Agent': BROWSER_UA,
      Referer: 'https://cursor.com/dashboard',
      Origin: 'https://cursor.com',
    },
  });
  if (res.status === 401) throw new Error('Cursor usage API: 401 invalid or expired session');
  if (!res.ok) throw new Error(`Cursor usage API: ${res.status}`);
  try {
    return mapCursorUsageSummary(await res.json(), Date.now());
  } catch {
    return cursorUsageUnknown();
  }
}

/** Test a Cursor session with the same call as the poller. */
export async function validateCursorSession(sessionToken: string): Promise<void> {
  await fetchCursorUsage(sessionToken);
}

/**
 * Google sends response headers larger than the 16 KB limit of Node fetch ("Headers Overflow Error").
 * node:https accepts a larger limit. Redirects are not followed: a redirect to sign-in means no session.
 */
function googleRequest(
  url: string,
  options: { method?: 'GET' | 'POST'; headers: Record<string, string>; body?: string },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, { method: options.method ?? 'GET', headers: options.headers, maxHeaderSize: 256 * 1024 }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (text += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
      res.on('error', reject);
    });
    req.setTimeout(30_000, () => req.destroy(new Error('Gemini request timed out')));
    req.on('error', reject);
    req.end(options.body);
  });
}

function pageToken(html: string, key: string): string | undefined {
  return new RegExp(`"${key}":"([^"]+)"`).exec(html)?.[1];
}

/**
 * Gemini 5-hour and weekly windows: private batchexecute RPC behind gemini.google.com/usage (#66).
 * The page tokens (at = SNlM0e, bl = cfb2h) come from the app HTML. The secret is a Cookie header.
 */
export async function fetchGeminiUsage(cookieHeader: string): Promise<QuotaState> {
  const origin = 'https://gemini.google.com';
  const headers = { Cookie: cookieHeader, 'User-Agent': BROWSER_UA };
  const page = await googleRequest(`${origin}/app`, { headers });
  // A redirect to the Google sign-in page, or no XSRF token, means the session is not signed in.
  if (page.status >= 300 && page.status < 400) throw new Error('Gemini page: 401 invalid or expired session');
  if (page.status !== 200) throw new Error(`Gemini page: ${page.status}`);
  const at = pageToken(page.text, 'SNlM0e');
  const bl = pageToken(page.text, 'cfb2h');
  if (!at || !bl) throw new Error('Gemini page: 401 invalid or expired session');
  const body = new URLSearchParams({ 'f.req': JSON.stringify([[[GEMINI_USAGE_RPC, '[]', null, 'generic']]]), at }).toString();
  const res = await googleRequest(
    `${origin}/_/BardChatUi/data/batchexecute?rpcids=${GEMINI_USAGE_RPC}&source-path=%2Fusage&bl=${encodeURIComponent(bl)}&rt=c`,
    { method: 'POST', headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body },
  );
  if (res.status === 401 || res.status === 403) throw new Error(`Gemini usage RPC: ${res.status} invalid or expired session`);
  if (res.status !== 200) throw new Error(`Gemini usage RPC: ${res.status}`);
  const payload = extractBatchexecutePayload(res.text, GEMINI_USAGE_RPC);
  return payload === undefined ? geminiUsageUnknown() : mapGeminiUsage(payload, Date.now());
}

/** Test a Gemini session with the same calls as the poller. */
export async function validateGeminiSession(cookieHeader: string): Promise<void> {
  await fetchGeminiUsage(cookieHeader);
}

/** Copilot seat status → honest QuotaState (never invents remaining %). */
export async function fetchCopilotSeat(token: string): Promise<QuotaState> {
  const seatRes = await fetch('https://api.github.com/user/copilot', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  return mapCopilotSeatStatus(seatRes.status);
}

function grokHeaders(ssoCookie: string): Record<string, string> {
  // Community first-party clients send both sso and sso-rw (often same JWT value).
  const cookie = `sso=${ssoCookie}; sso-rw=${ssoCookie}`;
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Cookie: cookie,
    'User-Agent': BROWSER_UA,
    Referer: 'https://grok.com/',
    Origin: 'https://grok.com',
  };
}

/** Validate Grok session by hitting the same rate-limits endpoint as the poller. */
export async function validateGrokSession(ssoCookie: string): Promise<void> {
  await fetchGrokUsage(ssoCookie);
}

/**
 * First-party Connect-RPC methods that return SuperGrok pool used%
 * (Settings → Usage / creditUsagePercent). Fail closed when path/auth fails.
 */
const GROK_WEEKLY_CONNECT_PATHS = [
  '/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig',
  '/grok_api_v2.GrokBuildBilling/GetGrokUsageInfo',
] as const;

async function fetchGrokRateLimitsSession(ssoCookie: string): Promise<QuotaState> {
  const res = await fetch('https://grok.com/rest/rate-limits', {
    method: 'POST',
    headers: grokHeaders(ssoCookie),
    body: JSON.stringify({ requestKind: 'DEFAULT', modelName: 'grok-3' }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Grok rate-limits API: ${res.status} invalid or expired session cookie`);
  }
  if (!res.ok) throw new Error(`Grok rate-limits API: ${res.status}`);
  const data = (await res.json()) as GrokRateLimitsResponse;
  return mapGrokRateLimits(data);
}

/**
 * Best-effort weekly SuperGrok pool via Connect-RPC JSON.
 * Returns null when no path yields a valid used% (never invents remaining).
 */
async function fetchGrokWeeklyPool(ssoCookie: string): Promise<QuotaState | null> {
  const headers = {
    ...grokHeaders(ssoCookie),
    'Connect-Protocol-Version': '1',
  };
  for (const path of GROK_WEEKLY_CONNECT_PATHS) {
    try {
      const res = await fetch(`https://grok.com${path}`, {
        method: 'POST',
        headers,
        body: '{}',
      });
      if (res.status === 401 || res.status === 403) {
        // Same session as rate-limits; bubble only if rate-limits already succeeded.
        continue;
      }
      if (!res.ok) continue;
      const data: unknown = await res.json();
      const extracted = extractGrokWeeklyUsage(data);
      if (!extracted) continue;
      return mapGrokWeeklyUsage(extracted);
    } catch {
      // Try next path — weekly is optional enrichment.
    }
  }
  return null;
}

/**
 * Poll Grok: short-window rate-limits (session) + optional SuperGrok weekly pool.
 * Pure mappers only; never invent remaining % when payloads lack counters.
 */
export async function fetchGrokUsage(ssoCookie: string): Promise<QuotaState> {
  const now = Date.now();
  const session = await fetchGrokRateLimitsSession(ssoCookie);
  const weekly = await fetchGrokWeeklyPool(ssoCookie);
  return combineGrokQuotaState(session, weekly, now);
}

/**
 * DeepSeek API balance. Official GET /user/balance with a user-pasted key.
 * 401/403 return an honesty state (not thrown) so a stored-but-rejected key
 * shows "API key rejected" instead of a generic poll error. Network and
 * other HTTP errors throw so the poller keeps the last good reading.
 */
export async function fetchDeepSeekBalance(apiKey: string): Promise<QuotaState> {
  const now = Date.now();
  const res = await fetch('https://api.deepseek.com/user/balance', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) return deepseekApiKeyInvalid(now);
  if (!res.ok) throw new Error(`DeepSeek balance API: ${res.status}`);
  try {
    return mapDeepSeekBalance(await res.json(), now);
  } catch {
    return deepseekBalanceUnreadable(now);
  }
}

/**
 * Kimi (Moonshot AI) API balance. Official GET /v1/users/me/balance with a
 * user-pasted key. Same honesty-vs-throw split as DeepSeek above.
 * https://platform.kimi.ai/docs/api/balance
 */
export async function fetchKimiBalance(apiKey: string): Promise<QuotaState> {
  const now = Date.now();
  const res = await fetch('https://api.moonshot.ai/v1/users/me/balance', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) return kimiApiKeyInvalid(now);
  if (!res.ok) throw new Error(`Kimi balance API: ${res.status}`);
  try {
    return mapKimiBalance(await res.json(), now);
  } catch {
    return kimiBalanceUnreadable(now);
  }
}

/** OpenRouter spend and cap for this one key. https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key */
export async function fetchOpenRouterKey(apiKey: string): Promise<QuotaState> {
  const now = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401 || res.status === 403) return apiKeyInvalid('openrouter', now);
  if (!res.ok) throw new Error(`OpenRouter key API: ${res.status}`);
  return mapOpenRouterKey(await res.json().catch(() => null), now);
}

/** A cost report of one month has at most 31 daily buckets, so one page is normal. The cap stops a bad cursor loop. */
const MAX_COST_PAGES = 5;

/**
 * Get every page of an Admin cost report. A 401 or 403 means the provider rejected the key.
 * https://platform.claude.com/docs/en/api/beta/organization/cost_report/retrieve
 * https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/usage/methods/costs
 */
async function fetchCostPages(
  label: string,
  url: (page: string | null) => string,
  headers: Record<string, string>,
): Promise<unknown[] | 'rejected'> {
  const pages: unknown[] = [];
  let page: string | null = null;
  for (let i = 0; i < MAX_COST_PAGES; i++) {
    const res = await fetch(url(page), { headers: { Accept: 'application/json', ...headers } });
    if (res.status === 401 || res.status === 403) return 'rejected';
    if (!res.ok) throw new Error(`${label} cost API: ${res.status}`);
    const body = (await res.json().catch(() => null)) as { has_more?: unknown; next_page?: unknown } | null;
    pages.push(body);
    if (body?.has_more !== true || typeof body.next_page !== 'string') break;
    page = body.next_page;
  }
  return pages;
}

const pageParam = (page: string | null) => (page ? `&page=${encodeURIComponent(page)}` : '');

/** Org spend this month from an Anthropic Admin key. */
export async function fetchAnthropicCost(apiKey: string): Promise<QuotaState> {
  const now = Date.now();
  const start = encodeURIComponent(monthStartUtc(now).toISOString());
  const pages = await fetchCostPages(
    'Anthropic',
    (page) => `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${start}&limit=31${pageParam(page)}`,
    { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
  );
  return pages === 'rejected' ? apiKeyInvalid('anthropic', now) : mapAnthropicCost(pages, now);
}

/** Org spend this month from an OpenAI Admin key. */
export async function fetchOpenAICost(apiKey: string): Promise<QuotaState> {
  const now = Date.now();
  const start = Math.floor(monthStartUtc(now).getTime() / 1000);
  const pages = await fetchCostPages(
    'OpenAI',
    (page) => `https://api.openai.com/v1/organization/costs?start_time=${start}&limit=31${pageParam(page)}`,
    { Authorization: `Bearer ${apiKey}` },
  );
  return pages === 'rejected' ? apiKeyInvalid('openai', now) : mapOpenAICost(pages, now);
}

const KEY_FETCHERS: Partial<Record<ServiceId, (apiKey: string) => Promise<QuotaState>>> = {
  deepseek: fetchDeepSeekBalance,
  kimi: fetchKimiBalance,
  openrouter: fetchOpenRouterKey,
  anthropic: fetchAnthropicCost,
  openai: fetchOpenAICost,
};

/** One reading for a Key. A rejected key gives an honesty state; other failures throw. */
export function fetchKeyReading(service: ServiceId, apiKey: string): Promise<QuotaState> {
  const fetcher = KEY_FETCHERS[service];
  if (!fetcher) return Promise.reject(new Error(`${SERVICE_LABELS[service]} does not take a Key`));
  return fetcher(apiKey);
}

/** The free test call before a Key is saved. Throws when the provider rejects the key. */
export async function validateKey(service: ServiceId, apiKey: string): Promise<void> {
  const state = await fetchKeyReading(service, apiKey);
  if (state.honesty === 'api_key_invalid') {
    throw new Error(
      isAdminKeyService(service)
        ? `The provider rejected this key. Use a ${SERVICE_LABELS[service]} Admin key from the org settings.`
        : `The provider rejected this ${SERVICE_LABELS[service]} API key.`,
    );
  }
}
