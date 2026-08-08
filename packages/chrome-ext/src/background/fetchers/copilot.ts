import type { QuotaState } from '@ai-quota-tool/core';
import { copilotAuthUnavailable, mapCopilotSeatStatus } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';
import { GITHUB_TOKEN_STORAGE_KEY } from '../github-auth.js';

// GitHub has no official per-user remaining-quota % API for individuals
// (docs/research/chrome-identity-github-oauth.md). Seat presence only -
// never invent remaining percentages.

const COPILOT_SEAT_ENDPOINT = 'https://api.github.com/user/copilot';

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

export class CopilotFetcher implements ServiceFetcher {
  readonly serviceId = 'copilot' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();
    const stored = await chrome.storage.local.get([GITHUB_TOKEN_STORAGE_KEY]);
    const token = stored[GITHUB_TOKEN_STORAGE_KEY] as string | undefined;
    if (!token) return copilotAuthUnavailable(now);

    const seatRes = await fetch(COPILOT_SEAT_ENDPOINT, {
      headers: { ...GITHUB_HEADERS, Authorization: `Bearer ${token}` },
    });
    return mapCopilotSeatStatus(seatRes.status, now);
  }
}
