import type { QuotaState } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// Confirmed via reverse-engineering of chatgpt.com network traffic.
// The web app calls this endpoint while a Codex session is active.
// Auth is handled automatically by the browser session cookie (credentials: 'include').
const CODEX_USAGE_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage';

interface WhamWindow {
  used_percent: number;  // 0–100, percent USED
  reset_at: string;      // ISO 8601 timestamp
}

// Response shape varies slightly between ChatGPT plan tiers.
// Windows may be nested under rate_limit or hoisted to the top level.
interface WhamUsageResponse {
  plan_type?: string;
  rate_limit?: {
    limit_reached?: boolean;
    primary_window?: WhamWindow;    // ~5-hour rolling window (maps to sessionPct)
    secondary_window?: WhamWindow;  // ~7-day rolling window (maps to weeklyPct)
  };
  primary_window?: WhamWindow;
  secondary_window?: WhamWindow;
}

function extractWindow(
  data: WhamUsageResponse,
  key: 'primary_window' | 'secondary_window',
): WhamWindow | undefined {
  return data.rate_limit?.[key] ?? data[key];
}

function parseResetAt(value: string | undefined): number {
  if (!value) return Date.now() + 5 * 3600_000;
  const ms = Date.parse(value);
  return isNaN(ms) ? Date.now() + 5 * 3600_000 : ms;
}

function remainingPct(usedPct: number | undefined): number {
  return Math.max(0, Math.min(100, Math.round(100 - (usedPct ?? 0))));
}

export class CodexFetcher implements ServiceFetcher {
  readonly serviceId = 'codex' as const;

  async fetch(): Promise<QuotaState> {
    const res = await fetch(CODEX_USAGE_ENDPOINT, {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        // Required — the endpoint checks Referer to confirm browser context.
        Referer: 'https://chatgpt.com/codex/settings/usage',
      },
    });

    if (!res.ok) {
      throw new Error(`Codex usage API returned ${res.status}`);
    }

    const data = await res.json() as WhamUsageResponse;

    const fiveHour = extractWindow(data, 'primary_window');
    const weekly = extractWindow(data, 'secondary_window');

    return {
      service: 'codex',
      sessionPct: remainingPct(fiveHour?.used_percent),
      weeklyPct: remainingPct(weekly?.used_percent),
      sessionResetsAt: parseResetAt(fiveHour?.reset_at),
      weeklyResetsAt: parseResetAt(weekly?.reset_at),
      lastUpdated: Date.now(),
    };
  }
}
