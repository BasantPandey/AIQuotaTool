import type { QuotaState } from '@ai-quota-tool/core';
import { mapClaudeUsage, type ClaudeUsageResponse } from '@ai-quota-tool/core';
import type { ServiceFetcher } from './base.js';

// Endpoint discovered via DevTools on claude.ai/new#settings/usage.
// The org UUID is user-specific — must be fetched from /api/organizations first.
const CLAUDE_ORGS_ENDPOINT = 'https://claude.ai/api/organizations';

interface ClaudeOrg {
  uuid: string;
}

export class ClaudeFetcher implements ServiceFetcher {
  readonly serviceId = 'claude' as const;

  async fetch(): Promise<QuotaState> {
    const orgRes = await fetch(CLAUDE_ORGS_ENDPOINT, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!orgRes.ok) throw new Error(`Claude orgs API returned ${orgRes.status}`);
    const orgs = (await orgRes.json()) as ClaudeOrg[];
    const orgId = orgs[0]?.uuid;
    if (!orgId) throw new Error('No Claude organization found');

    const res = await fetch(`https://claude.ai/api/organizations/${orgId}/usage`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Claude usage API returned ${res.status}`);

    const data = (await res.json()) as ClaudeUsageResponse;
    return mapClaudeUsage(data);
  }
}
