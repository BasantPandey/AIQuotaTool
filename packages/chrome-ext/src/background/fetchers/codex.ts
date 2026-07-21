import type { QuotaState } from '@ai-quota-tool/core';
import { mapCodexUsage, type WhamUsageResponse } from '@ai-quota-tool/core';
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

    if (!res.ok) {
      throw new Error(`Codex usage API returned ${res.status}`);
    }

    const data = (await res.json()) as WhamUsageResponse;
    return mapCodexUsage(data);
  }
}
