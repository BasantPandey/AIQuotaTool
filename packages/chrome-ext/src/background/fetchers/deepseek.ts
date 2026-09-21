import type { QuotaState } from '@ai-quota-tool/core';
import {
  deepseekApiKeyInvalid,
  deepseekApiKeyRequired,
  deepseekBalanceUnreadable,
  mapDeepSeekBalance,
} from '@ai-quota-tool/core';
import { readApiKey } from '../api-keys.js';
import type { ServiceFetcher } from './base.js';

/**
 * DeepSeek API balance. Official GET /user/balance with a user-pasted key.
 * The key stays in chrome.storage.local and is sent only to api.deepseek.com.
 * Network and server errors throw so the last good reading is kept.
 */

const BALANCE_URL = 'https://api.deepseek.com/user/balance';

export class DeepSeekFetcher implements ServiceFetcher {
  readonly serviceId = 'deepseek' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();
    const token = await readApiKey('deepseek');
    if (!token) return deepseekApiKeyRequired(now);

    let res: Response;
    try {
      res = await fetch(BALANCE_URL, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      throw new Error('DeepSeek balance request failed');
    }

    if (res.status === 401 || res.status === 403) return deepseekApiKeyInvalid(now);
    if (!res.ok) throw new Error(`DeepSeek balance request failed (${res.status})`);

    try {
      return mapDeepSeekBalance(await res.json(), now);
    } catch {
      return deepseekBalanceUnreadable(now);
    }
  }
}
