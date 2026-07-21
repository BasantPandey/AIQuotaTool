import type { QuotaState } from '@ai-quota-tool/core';
import { mapCopilotSeatStatus } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// GitHub has no public per-user remaining-quota % API for individuals (2026 research).
// Seat presence only — never invent remaining percentages.

const COPILOT_SEAT_ENDPOINT = 'https://api.github.com/user/copilot';

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

export class CopilotFetcher implements ServiceFetcher {
  readonly serviceId = 'copilot' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();
    const seatRes = await fetch(COPILOT_SEAT_ENDPOINT, {
      credentials: 'include',
      headers: GITHUB_HEADERS,
    });
    return mapCopilotSeatStatus(seatRes.status, now);
  }
}
