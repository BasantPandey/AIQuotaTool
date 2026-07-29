import type { GrokRateLimitsResponse, QuotaState } from '@ai-quota-tool/core';
import {
  combineGrokQuotaState,
  extractGrokWeeklyUsage,
  grokNotConnected,
  mapGrokRateLimits,
  mapGrokWeeklyUsage,
} from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

/**
 * Consumer Grok on grok.com — live browser session only (no stored keys).
 * Session: POST /rest/rate-limits → mapGrokRateLimits
 * Weekly (optional): Connect-RPC GetGrokCreditsConfig → extract + mapGrokWeeklyUsage
 * Remaining math stays pure in core (never invent 100%).
 */

const GROK_ORIGIN = 'https://grok.com';

const WEEKLY_CONNECT_PATHS = [
  '/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig',
  '/grok_api_v2.GrokBuildBilling/GetGrokUsageInfo',
] as const;

export class GrokFetcher implements ServiceFetcher {
  readonly serviceId = 'grok' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();

    try {
      const res = await fetch(`${GROK_ORIGIN}/rest/rate-limits`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Referer: `${GROK_ORIGIN}/`,
          Origin: GROK_ORIGIN,
        },
        body: JSON.stringify({ requestKind: 'DEFAULT', modelName: 'grok-3' }),
      });
      if (res.status === 401 || res.status === 403) {
        return grokNotConnected(now);
      }
      if (!res.ok) {
        return grokNotConnected(now);
      }
      const data = (await res.json()) as GrokRateLimitsResponse;
      const session = mapGrokRateLimits(data, now);
      const weekly = await this.fetchWeekly(now);
      return combineGrokQuotaState(session, weekly, now);
    } catch {
      return grokNotConnected(now);
    }
  }

  private async fetchWeekly(now: number): Promise<QuotaState | null> {
    for (const path of WEEKLY_CONNECT_PATHS) {
      try {
        const res = await fetch(`${GROK_ORIGIN}${path}`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
            Referer: `${GROK_ORIGIN}/`,
            Origin: GROK_ORIGIN,
          },
          body: '{}',
        });
        if (!res.ok) continue;
        const extracted = extractGrokWeeklyUsage(await res.json());
        if (!extracted) continue;
        return mapGrokWeeklyUsage(extracted, now);
      } catch {
        // optional enrichment
      }
    }
    return null;
  }
}
