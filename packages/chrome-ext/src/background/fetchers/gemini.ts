import type { QuotaState } from '@ai-quota-tool/core';
import {
  extractBatchexecutePayload,
  GEMINI_USAGE_RPC,
  geminiUsageUnknown,
  mapGeminiUsage,
  sessionExpired,
} from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// Private RPC behind gemini.google.com/usage (issue #66). The page tokens
// (at = SNlM0e, bl = cfb2h) come from the app HTML; cookies carry auth.
const ORIGIN = 'https://gemini.google.com';

function pageToken(html: string, key: string): string | undefined {
  return new RegExp(`"${key}":"([^"]+)"`).exec(html)?.[1];
}

export class GeminiFetcher implements ServiceFetcher {
  readonly serviceId = 'gemini' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();
    const page = await fetch(`${ORIGIN}/app`, { credentials: 'include' });
    if (!page.ok) throw new Error(`Gemini page returned ${page.status}`);
    const html = await page.text();
    const at = pageToken(html, 'SNlM0e');
    const bl = pageToken(html, 'cfb2h');
    // No XSRF token means no signed-in session.
    if (!at || !bl) return sessionExpired('gemini', now);

    const body = new URLSearchParams({
      'f.req': JSON.stringify([[[GEMINI_USAGE_RPC, '[]', null, 'generic']]]),
      at,
    });
    const res = await fetch(
      `${ORIGIN}/_/BardChatUi/data/batchexecute?rpcids=${GEMINI_USAGE_RPC}&source-path=%2Fusage&bl=${encodeURIComponent(bl)}&rt=c`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
      },
    );
    if (res.status === 401) return sessionExpired('gemini', now);
    if (!res.ok) throw new Error(`Gemini usage RPC returned ${res.status}`);
    const payload = extractBatchexecutePayload(await res.text(), GEMINI_USAGE_RPC);
    return payload === undefined ? geminiUsageUnknown(now) : mapGeminiUsage(payload, now);
  }
}
