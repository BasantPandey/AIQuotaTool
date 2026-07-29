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
 * ChatGPT may split the session cookie into `.0` / `.1` when large.
 * Parse paste into ordered chunks (preserve boundaries for Cookie header).
 * Accept: one full value, two lines (.0 then .1), or name=value lines.
 */
export function parseCodexSessionChunks(raw: string): string[] {
  const lines = raw
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const pieces: string[] = [];
  for (const line of lines) {
    const eq = line.match(/^__Secure-next-auth\.session-token(?:\.\d+)?\s*=\s*(.+)$/i);
    if (eq?.[1]) {
      pieces.push(eq[1].trim());
      continue;
    }
    // One bare value per line (preferred for .0 / .1 paste)
    if (!/\s/.test(line)) {
      pieces.push(line);
      continue;
    }
    // Space-separated bare values on one line (last resort)
    for (const part of line.split(/\s+/).filter(Boolean)) {
      const bare = part.replace(/^__Secure-next-auth\.session-token(?:\.\d+)?\s*=\s*/i, '');
      if (bare) pieces.push(bare);
    }
  }
  return pieces.filter(Boolean);
}

/** Joined storage form (still works if only one unchunked cookie). */
export function normalizeCodexSessionToken(raw: string): string {
  return parseCodexSessionChunks(raw).join('').trim();
}

/**
 * Cookie header matching the browser: when ChatGPT split the session cookie,
 * send `.0` + `.1` separately (NextAuth reassembles by index). Single cookie
 * when there is only one part.
 */
export function codexCookieHeader(raw: string): string {
  const chunks = parseCodexSessionChunks(raw);
  if (chunks.length === 0) return '';
  if (chunks.length === 1) {
    // If a previously-joined long token was stored, re-split for next-auth chunk reader.
    const t = chunks[0]!;
    if (t.length > 3800) {
      // Browser typically fills .0 near 4KB; rest goes to .1
      const cut = 3800;
      return [
        `__Secure-next-auth.session-token.0=${t.slice(0, cut)}`,
        `__Secure-next-auth.session-token.1=${t.slice(cut)}`,
      ].join('; ');
    }
    return `__Secure-next-auth.session-token=${t}`;
  }
  return chunks.map((c, i) => `__Secure-next-auth.session-token.${i}=${c}`).join('; ');
}

function codexBrowserHeaders(raw: string): Record<string, string> {
  return {
    Accept: 'application/json',
    Cookie: codexCookieHeader(raw),
    Referer: 'https://chatgpt.com/',
    'User-Agent': BROWSER_UA,
    Origin: 'https://chatgpt.com',
  };
}

/**
 * Exchange session cookie for short-lived ChatGPT accessToken
 * (GET /api/auth/session) — required by backend-api/wham/usage.
 */
async function fetchCodexAccessToken(sessionRaw: string): Promise<string> {
  const res = await fetch('https://chatgpt.com/api/auth/session', {
    headers: codexBrowserHeaders(sessionRaw),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `ChatGPT session API: ${res.status} invalid or expired session cookie (need both .0 and .1 if split)`,
    );
  }
  if (!res.ok) throw new Error(`ChatGPT session API: ${res.status}`);
  const data = (await res.json()) as { accessToken?: string; access_token?: string; user?: unknown };
  const token = data.accessToken ?? data.access_token;
  if (typeof token !== 'string' || !token) {
    throw new Error(
      'ChatGPT session returned no accessToken — paste full session-token (.0 then .1 if the browser shows two rows)',
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
 * Auth: session cookie (chunked .0/.1) → /api/auth/session accessToken → Bearer on wham/usage.
 */
export async function fetchCodexUsage(sessionToken: string): Promise<QuotaState> {
  const chunks = parseCodexSessionChunks(sessionToken);
  if (chunks.length === 0) throw new Error('Codex session token is empty');

  const accessToken = await fetchCodexAccessToken(sessionToken);
  const res = await fetch('https://chatgpt.com/backend-api/wham/usage', {
    headers: {
      ...codexBrowserHeaders(sessionToken),
      Authorization: `Bearer ${accessToken}`,
      Referer: 'https://chatgpt.com/codex/settings/usage',
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Codex usage API: ${res.status} invalid or expired session token`);
  }
  if (!res.ok) throw new Error(`Codex usage API: ${res.status}`);
  const data = (await res.json()) as WhamUsageResponse;
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
