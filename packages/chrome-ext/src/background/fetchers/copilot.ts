import type { QuotaState } from '@ai-quota-tool/core';
import { calcPct } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

/**
 * TODO (endpoint discovery): Inspect DevTools → Network on github.com/copilot
 * or github.com/settings/billing while logged in. Find the XHR that returns
 * your Copilot usage/quota. The GitHub REST API also has:
 *   GET /orgs/{org}/copilot/usage  (requires org admin)
 *   GET /user/copilot  (individual usage — check if this exists)
 *
 * Replace COPILOT_USAGE_ENDPOINT and the response parsing below.
 */
const COPILOT_USAGE_ENDPOINT = 'https://api.github.com/copilot_internal/user'; // PLACEHOLDER

export class CopilotFetcher implements ServiceFetcher {
  readonly serviceId = 'copilot' as const;

  async fetch(): Promise<QuotaState> {
    const res = await fetch(COPILOT_USAGE_ENDPOINT, {
      credentials: 'include',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      throw new Error(`Copilot usage API returned ${res.status}`);
    }

    // TODO: Replace with real field names once endpoint is discovered
    const data = await res.json() as Record<string, unknown>;

    const sessionUsed = (data['sessionUsed'] as number) ?? 0;
    const sessionLimit = (data['sessionLimit'] as number) ?? 100;
    const weeklyUsed = (data['weeklyUsed'] as number) ?? 0;
    const weeklyLimit = (data['weeklyLimit'] as number) ?? 100;
    const sessionResetsAt = Date.parse((data['sessionResetsAt'] as string) ?? new Date(Date.now() + 5 * 3600_000).toISOString());
    const weeklyResetsAt = Date.parse((data['weeklyResetsAt'] as string) ?? new Date(Date.now() + 7 * 86400_000).toISOString());

    return {
      service: 'copilot',
      sessionPct: calcPct(sessionUsed, sessionLimit),
      weeklyPct: calcPct(weeklyUsed, weeklyLimit),
      sessionResetsAt,
      weeklyResetsAt,
      lastUpdated: Date.now(),
    };
  }
}
