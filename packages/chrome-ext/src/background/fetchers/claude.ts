import type { QuotaState, ClaudeSubcategory } from '@ai-quota-tool/core';
import { calcPct } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// Endpoint discovered via DevTools on claude.ai/new#settings/usage.
// The org UUID is user-specific — must be fetched from /api/organizations first.
// Response: { five_hour: { utilization, resets_at }, seven_day: { utilization, resets_at },
//             seven_day_sonnet, seven_day_opus, seven_day_cowork, seven_day_omelette, ... }
const CLAUDE_ORGS_ENDPOINT = 'https://claude.ai/api/organizations';

interface ClaudeOrg {
  uuid: string;
}

interface ClaudeUsageBucket {
  utilization: number;   // 0–100, percent USED
  resets_at: string;     // ISO 8601
}

interface ClaudeUsageResponse {
  five_hour: ClaudeUsageBucket;
  seven_day: ClaudeUsageBucket;
  seven_day_sonnet: ClaudeUsageBucket | null;
  seven_day_opus: ClaudeUsageBucket | null;
  seven_day_cowork: ClaudeUsageBucket | null;   // "Daily Routines" bucket
  seven_day_omelette: ClaudeUsageBucket | null;
}

export class ClaudeFetcher implements ServiceFetcher {
  readonly serviceId = 'claude' as const;

  async fetch(): Promise<QuotaState> {
    // Step 1: resolve the user's active org UUID (varies per account)
    const orgRes = await fetch(CLAUDE_ORGS_ENDPOINT, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!orgRes.ok) throw new Error(`Claude orgs API returned ${orgRes.status}`);
    const orgs = await orgRes.json() as ClaudeOrg[];
    const orgId = orgs[0]?.uuid;
    if (!orgId) throw new Error('No Claude organization found');

    // Step 2: fetch usage for that org
    const res = await fetch(
      `https://claude.ai/api/organizations/${orgId}/usage`,
      {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      },
    );

    if (!res.ok) {
      throw new Error(`Claude usage API returned ${res.status}`);
    }

    const data = await res.json() as ClaudeUsageResponse;

    const sessionResetsAt = Date.parse(data.five_hour.resets_at);
    const weeklyResetsAt = Date.parse(data.seven_day.resets_at);

    // Build subcategory rows only for buckets the plan exposes
    const subcategories: ClaudeSubcategory[] = [];

    if (data.seven_day_sonnet != null) {
      const pct = calcPct(data.seven_day_sonnet.utilization, 100);
      subcategories.push({ name: 'Sonnet', usedPct: data.seven_day_sonnet.utilization, label: `${pct}% left` });
    }
    if (data.seven_day_omelette != null) {
      const pct = calcPct(data.seven_day_omelette.utilization, 100);
      subcategories.push({ name: 'Designs', usedPct: data.seven_day_omelette.utilization, label: `${pct}% left` });
    }
    if (data.seven_day_cowork != null) {
      const pct = calcPct(data.seven_day_cowork.utilization, 100);
      subcategories.push({ name: 'Daily Routines', usedPct: data.seven_day_cowork.utilization, label: `${pct}% left` });
    }

    return {
      service: 'claude',
      sessionPct: calcPct(data.five_hour.utilization, 100),
      weeklyPct: calcPct(data.seven_day.utilization, 100),
      sessionResetsAt,
      weeklyResetsAt,
      ...(subcategories.length > 0 && { subcategories }),
      lastUpdated: Date.now(),
    };
  }
}
