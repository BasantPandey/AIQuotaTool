import type { QuotaState } from '@ai-quota-tool/core';
import {
  calcPct,
  copilotAuthUnavailable,
  copilotNoPlan,
  copilotSeatActiveUsageUnknown,
} from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// GitHub has no public per-user remaining-quota % API for individuals.
// Seat info is public; usage % is only shown if a real endpoint returns limits.

const COPILOT_SEAT_ENDPOINT = 'https://api.github.com/user/copilot';
// Unconfirmed placeholder — success path maps real used/limit fields only when present.
const COPILOT_USAGE_ENDPOINT = 'https://api.github.com/user/copilot/usage';

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

interface CopilotUsageResponse {
  completions_used?: number;
  completions_limit?: number;
  chat_used?: number;
  chat_limit?: number;
  billing_cycle_resets_at?: string;
}

export class CopilotFetcher implements ServiceFetcher {
  readonly serviceId = 'copilot' as const;

  async fetch(): Promise<QuotaState> {
    const now = Date.now();
    const seatRes = await fetch(COPILOT_SEAT_ENDPOINT, {
      credentials: 'include',
      headers: GITHUB_HEADERS,
    });

    if (seatRes.status === 404) {
      return copilotNoPlan(now);
    }

    if (!seatRes.ok) {
      // Not authenticated / CORS / insufficient access — do not invent remaining %.
      return copilotAuthUnavailable(now);
    }

    const usageRes = await fetch(COPILOT_USAGE_ENDPOINT, {
      credentials: 'include',
      headers: GITHUB_HEADERS,
    });

    if (!usageRes.ok) {
      return copilotSeatActiveUsageUnknown(now);
    }

    const data = (await usageRes.json()) as CopilotUsageResponse;
    const hasCompletions =
      data.completions_used !== undefined && data.completions_limit !== undefined && data.completions_limit > 0;
    const hasChat =
      data.chat_used !== undefined && data.chat_limit !== undefined && data.chat_limit > 0;

    if (!hasCompletions && !hasChat) {
      return copilotSeatActiveUsageUnknown(now);
    }

    const usageResetsAt = data.billing_cycle_resets_at
      ? Date.parse(data.billing_cycle_resets_at)
      : undefined;

    const state: QuotaState = {
      service: 'copilot',
      lastUpdated: now,
    };
    if (hasCompletions) {
      state.sessionPct = calcPct(data.completions_used!, data.completions_limit!);
      if (usageResetsAt !== undefined) state.sessionResetsAt = usageResetsAt;
    }
    if (hasChat) {
      state.weeklyPct = calcPct(data.chat_used!, data.chat_limit!);
      if (usageResetsAt !== undefined) state.weeklyResetsAt = usageResetsAt;
    }
    return state;
  }
}
