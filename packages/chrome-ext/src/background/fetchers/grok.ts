import type { QuotaState } from '@ai-quota-tool/core';
import { grokNotConnected, grokUsageUnknown } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

/**
 * Consumer Grok on grok.com — live browser session only (no stored keys).
 *
 * No public documented remaining-% API yet. SuperGrok Settings → Usage used% is a
 * conditional GO only after a first-party payload is validated. Until then this
 * fetcher fails closed to honesty states (never invent remaining %, never probe
 * undocumented rate-limit paths).
 *
 * Pure mappers `mapGrokWeeklyUsage` / `extractGrokWeeklyUsage` in core are ready
 * when a validated session payload is available (content bridge or proven URL).
 */

const GROK_ORIGIN = 'https://grok.com';

export class GrokFetcher implements ServiceFetcher {
  readonly serviceId = 'grok' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();

    try {
      const res = await fetch(`${GROK_ORIGIN}/`, {
        credentials: 'include',
        headers: { Accept: 'text/html,application/json' },
      });
      if (res.status === 401 || res.status === 403 || !res.ok) {
        return grokNotConnected(now);
      }
      // Session cookies may be present, but weekly used% is not available without
      // a proven first-party usage schema — honesty only.
      return grokUsageUnknown(now);
    } catch {
      return grokNotConnected(now);
    }
  }
}
