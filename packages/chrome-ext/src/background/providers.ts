import type { ServiceId } from '@ai-quota-tool/core';
import { SERVICES } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './fetchers/base.js';
import { ClaudeFetcher } from './fetchers/claude.js';
import { CodexFetcher } from './fetchers/codex.js';
import { CopilotFetcher } from './fetchers/copilot.js';
import { CursorFetcher } from './fetchers/cursor.js';
import { DeepSeekFetcher } from './fetchers/deepseek.js';
import { GeminiFetcher } from './fetchers/gemini.js';
import { GrokFetcher } from './fetchers/grok.js';
import { KimiFetcher } from './fetchers/kimi.js';

/**
 * One factory per catalog service. Adding a ServiceId without a factory
 * fails this file's type check.
 */
const FETCHER_FACTORIES = {
  claude: () => new ClaudeFetcher(),
  copilot: () => new CopilotFetcher(),
  codex: () => new CodexFetcher(),
  grok: () => new GrokFetcher(),
  gemini: () => new GeminiFetcher(),
  cursor: () => new CursorFetcher(),
  deepseek: () => new DeepSeekFetcher(),
  kimi: () => new KimiFetcher(),
} satisfies Record<ServiceId, () => ServiceFetcher>;

export function createFetchers(): ServiceFetcher[] {
  return SERVICES.map((service) => FETCHER_FACTORIES[service.id]());
}
