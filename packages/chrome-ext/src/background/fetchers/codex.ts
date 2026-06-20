import type { QuotaState } from '@ai-quota-tool/core';
import { calcPct } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

/**
 * TODO (endpoint discovery): Inspect DevTools → Network on platform.openai.com
 * or the OpenAI dashboard while logged in. Look for a usage or billing endpoint.
 * The public API also exposes:
 *   GET https://api.openai.com/v1/usage?date=YYYY-MM-DD  (requires API key header)
 *
 * Determine whether the dashboard uses session cookies (browser session) or
 * whether an API key is required. If an API key is needed, add a settings UI
 * so the user can paste their key.
 *
 * Replace CODEX_USAGE_ENDPOINT and response parsing below.
 */
const CODEX_USAGE_ENDPOINT = 'https://platform.openai.com/api/usage'; // PLACEHOLDER

export class CodexFetcher implements ServiceFetcher {
  readonly serviceId = 'codex' as const;

  async fetch(): Promise<QuotaState> {
    const res = await fetch(CODEX_USAGE_ENDPOINT, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Codex usage API returned ${res.status}`);
    }

    // TODO: Replace with real field names once endpoint is discovered
    const data = await res.json() as Record<string, unknown>;

    const sessionUsed = (data['sessionUsed'] as number) ?? 0;
    const sessionLimit = (data['sessionLimit'] as number) ?? 100;
    const weeklyUsed = (data['weeklyUsed'] as number) ?? 0;
    const weeklyLimit = (data['weeklyLimit'] as number) ?? 100;
    const sessionResetsAt = Date.parse((data['sessionResetsAt'] as string) ?? new Date(Date.now() + 5 * 3600_000).toISOString());
    const weeklyResetsAt = Date.parse((data['weeklyResetsAt'] as string) ?? new Date(Date.now() + 7 * 86400_000).toISOString());

    return {
      service: 'codex',
      sessionPct: calcPct(sessionUsed, sessionLimit),
      weeklyPct: calcPct(weeklyUsed, weeklyLimit),
      sessionResetsAt,
      weeklyResetsAt,
      lastUpdated: Date.now(),
    };
  }
}
