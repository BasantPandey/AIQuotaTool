import type { QuotaState } from '@ai-quota-tool/core';
import { mapCodexUsage, sessionExpired, type WhamUsageResponse } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// Confirmed via reverse-engineering of chatgpt.com network traffic.
const CODEX_USAGE_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';

export class CodexFetcher implements ServiceFetcher {
  readonly serviceId = 'codex' as const;

  async fetch(): Promise<QuotaState> {
    const res = await fetch(CODEX_USAGE_ENDPOINT, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        Referer: 'https://chatgpt.com/codex/settings/usage',
      },
    });

    // 401 = session truly expired: drop the ring, signal re-auth.
    // 403 from the service worker is usually a bot check, not auth - throw so
    // the freshest-wins merge keeps the content bridge's last good reading.
    if (res.status === 401) {
      return sessionExpired('codex');
    }
    if (!res.ok) {
      throw new Error(`Codex usage API returned ${res.status}`);
    }

    const data = (await res.json()) as WhamUsageResponse;
    return mapCodexUsage(data);
  }
}
