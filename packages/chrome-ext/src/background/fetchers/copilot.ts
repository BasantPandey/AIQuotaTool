import type { QuotaState } from '@ai-quota-tool/core';
import { calcPct } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// GitHub has no public per-user quota API. The endpoints below are the best
// available candidates discoverable from DevTools on github.com/settings/billing.
//
// ENDPOINT DISCOVERY STEPS (still required):
//   1. Log into github.com, open DevTools → Network
//   2. Navigate to github.com/settings/billing/summary
//   3. Find the XHR that returns Copilot completions/chat remaining this month
//   4. Replace COPILOT_USAGE_ENDPOINT and update CopilotUsageResponse below
//
// Seat info (plan, status) — confirmed public endpoint:
const COPILOT_SEAT_ENDPOINT = 'https://api.github.com/user/copilot';
// Usage endpoint — unconfirmed; likely exists given the billing UI shows live data:
const COPILOT_USAGE_ENDPOINT = 'https://api.github.com/user/copilot/usage'; // PLACEHOLDER

const GITHUB_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

interface CopilotSeatResponse {
  copilot_plan?: string; // 'free' | 'pro' | 'pro_plus' | 'business' | 'enterprise'
}

// TODO: Replace with real field names once endpoint is discovered.
interface CopilotUsageResponse {
  completions_used?: number;
  completions_limit?: number;
  chat_used?: number;
  chat_limit?: number;
  billing_cycle_resets_at?: string;  // ISO 8601
}

// Copilot Free: 2000 completions + 50 chat per month.
// Paid plans moved to usage-based (token) billing in June 2026.
const FREE_COMPLETIONS_LIMIT = 2000;
const FREE_CHAT_LIMIT = 50;

function nextMonthlyResetMs(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
}

export class CopilotFetcher implements ServiceFetcher {
  readonly serviceId = 'copilot' as const;

  async fetch(): Promise<QuotaState> {
    // Verify seat is active before attempting usage fetch.
    const seatRes = await fetch(COPILOT_SEAT_ENDPOINT, {
      credentials: 'include',
      headers: GITHUB_HEADERS,
    });

    if (seatRes.status === 404) {
      throw new Error('No active GitHub Copilot subscription on this account');
    }
    if (!seatRes.ok) {
      throw new Error(`Copilot seat API returned ${seatRes.status}`);
    }

    const seat = await seatRes.json() as CopilotSeatResponse;
    const isPaidPlan = seat.copilot_plan && seat.copilot_plan !== 'free';

    // Attempt usage fetch — will fail until real endpoint is discovered.
    const usageRes = await fetch(COPILOT_USAGE_ENDPOINT, {
      credentials: 'include',
      headers: GITHUB_HEADERS,
    });

    if (!usageRes.ok) {
      // Paid plans on usage-based billing have no fixed completion quota.
      // Return 100% remaining as a stand-in until the real endpoint is found.
      const weeklyResetsAt = nextMonthlyResetMs();
      return {
        service: 'copilot',
        sessionPct: isPaidPlan ? 100 : 0,
        weeklyPct: isPaidPlan ? 100 : 0,
        sessionResetsAt: weeklyResetsAt,
        weeklyResetsAt,
        lastUpdated: Date.now(),
      };
    }

    const data = await usageRes.json() as CopilotUsageResponse;

    const completionsLimit = data.completions_limit ?? FREE_COMPLETIONS_LIMIT;
    const chatLimit = data.chat_limit ?? FREE_CHAT_LIMIT;
    const completionsPct = calcPct(data.completions_used ?? 0, completionsLimit);
    const chatPct = calcPct(data.chat_used ?? 0, chatLimit);
    const resetsAt = data.billing_cycle_resets_at
      ? Date.parse(data.billing_cycle_resets_at)
      : nextMonthlyResetMs();

    return {
      service: 'copilot',
      // session → completions (primary per-month bucket for Free tier)
      sessionPct: completionsPct,
      // weekly → chat (secondary bucket; maps loosely — both are monthly limits)
      weeklyPct: chatPct,
      sessionResetsAt: resetsAt,
      weeklyResetsAt: resetsAt,
      lastUpdated: Date.now(),
    };
  }
}
