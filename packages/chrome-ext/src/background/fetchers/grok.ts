import type { GrokRateLimitsResponse, QuotaState } from '@ai-quota-tool/core';
import { grokNotConnected, mapGrokRateLimits } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

/**
 * Consumer Grok on grok.com — live browser session only (no stored keys).
 * Uses the same first-party POST /rest/rate-limits path as VS Code SecretStorage.
 * Remaining math stays in pure `mapGrokRateLimits` (never invent 100%).
 */

const GROK_ORIGIN = 'https://grok.com';

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
      return mapGrokRateLimits(data, now);
    } catch {
      return grokNotConnected(now);
    }
  }
}
