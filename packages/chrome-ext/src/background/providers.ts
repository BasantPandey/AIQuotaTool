import { CHROME_SERVICES } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './fetchers/base.js';
import { ClaudeFetcher } from './fetchers/claude.js';
import { CodexFetcher } from './fetchers/codex.js';
import { CopilotFetcher } from './fetchers/copilot.js';
import { CursorFetcher } from './fetchers/cursor.js';
import { GeminiFetcher } from './fetchers/gemini.js';
import { GrokFetcher } from './fetchers/grok.js';

/** Services that a browser session or GitHub sign-in reads. API keys poll one by one in key-fetchers.ts. */
export type AccountServiceId = Exclude<(typeof CHROME_SERVICES)[number], { auth: 'api_key' }>['id'];

/**
 * One factory per account service. Adding an account service without a factory
 * fails this file's type check.
 */
const FETCHER_FACTORIES = {
  claude: () => new ClaudeFetcher(),
  copilot: () => new CopilotFetcher(),
  codex: () => new CodexFetcher(),
  grok: () => new GrokFetcher(),
  gemini: () => new GeminiFetcher(),
  cursor: () => new CursorFetcher(),
} satisfies Record<AccountServiceId, () => ServiceFetcher>;

export function createFetchers(): ServiceFetcher[] {
  return CHROME_SERVICES.flatMap((service) => (service.auth === 'api_key' ? [] : [FETCHER_FACTORIES[service.id]()]));
}
