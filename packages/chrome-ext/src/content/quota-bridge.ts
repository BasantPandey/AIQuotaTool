// Runs inside the claude.ai / chatgpt.com / gemini.google.com page context, so fetch() is same-origin
// — bypassing the CORS restrictions that block extension service workers from
// hitting these internal quota APIs.
import type { QuotaState } from '@ai-quota-tool/core';
import { ClaudeFetcher } from '../background/fetchers/claude.js';
import { CodexFetcher } from '../background/fetchers/codex.js';
import { GeminiFetcher } from '../background/fetchers/gemini.js';

type BridgeFetcher = { fetch(): Promise<QuotaState> };

const SITE_FETCHERS: Partial<Record<string, BridgeFetcher>> = {
  'claude.ai': new ClaudeFetcher(),
  'chatgpt.com': new CodexFetcher(),
  'gemini.google.com': new GeminiFetcher(),
};

async function fetchAndReport(): Promise<void> {
  const fetcher = SITE_FETCHERS[location.hostname];
  if (!fetcher) return;

  try {
    const state = await fetcher.fetch();
    chrome.runtime.sendMessage({ type: 'content_quota', payload: state });
  } catch (err) {
    // Not logged in, API shape changed, etc. — non-fatal.
    console.debug('[ai-quota-tool] content bridge:', err);
  }
}

fetchAndReport();
setInterval(fetchAndReport, 5 * 60 * 1000);
