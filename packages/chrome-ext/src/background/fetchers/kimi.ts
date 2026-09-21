import type { QuotaState } from '@ai-quota-tool/core';
import {
  kimiApiKeyInvalid,
  kimiApiKeyRequired,
  kimiBalanceUnreadable,
  mapKimiBalance,
} from '@ai-quota-tool/core';
import { readApiKey } from '../api-keys.js';
import type { ServiceFetcher } from './base.js';

/**
 * Kimi (Moonshot AI) API balance. Official GET /v1/users/me/balance with a
 * user-pasted key. The key stays in chrome.storage.local and is sent only to
 * api.moonshot.ai. Network and server errors throw so the last good reading
 * is kept. https://platform.kimi.ai/docs/api/balance
 */

const BALANCE_URL = 'https://api.moonshot.ai/v1/users/me/balance';

export class KimiFetcher implements ServiceFetcher {
  readonly serviceId = 'kimi' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();
    const token = await readApiKey('kimi');
    if (!token) return kimiApiKeyRequired(now);

    let res: Response;
    try {
      res = await fetch(BALANCE_URL, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      throw new Error('Kimi balance request failed');
    }

    if (res.status === 401 || res.status === 403) return kimiApiKeyInvalid(now);
    if (!res.ok) throw new Error(`Kimi balance request failed (${res.status})`);

    try {
      return mapKimiBalance(await res.json(), now);
    } catch {
      return kimiBalanceUnreadable(now);
    }
  }
}
