/**
 * Shared Node fetch helpers for VS Code host (poller + Save & Test).
 * Remaining % math stays in @ai-quota-tool/core pure mappers only.
 */
import {
  combineGrokQuotaState,
  extractGrokWeeklyUsage,
  mapClaudeUsage,
  mapCodexUsage,
  mapCopilotSeatStatus,
  mapGrokRateLimits,
  mapGrokWeeklyUsage,
  type ClaudeUsageResponse,
  type GrokRateLimitsResponse,
  type QuotaState,
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
    // Keep only next-auth session-token cookies (drop unrelated noise if user pasted a huge Cookie:)
    const parts = s.split(';').map((p) => p.trim()).filter(Boolean);
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
