import type { QuotaState } from '@ai-quota-tool/core';
import { cursorUsageUnknown, mapCursorUsageSummary, sessionExpired } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// Dashboard endpoint on cursor.com. The WorkosCursorSessionToken cookie
// rides along with credentials: 'include'.
const USAGE_SUMMARY_URL = 'https://cursor.com/api/usage-summary';

export class CursorFetcher implements ServiceFetcher {
  readonly serviceId = 'cursor' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();
    const res = await fetch(USAGE_SUMMARY_URL, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401) return sessionExpired('cursor', now);
    // 403 is often a bot check; throw so the last good reading stays.
    if (!res.ok) throw new Error(`Cursor usage API returned ${res.status}`);
    try {
      return mapCursorUsageSummary(await res.json(), now);
    } catch {
      return cursorUsageUnknown(now);
    }
  }
}
