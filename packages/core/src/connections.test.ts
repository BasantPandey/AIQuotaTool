import { describe, expect, it } from 'vitest';
import { deriveConnections, isConnectedReading } from './connections.js';
import type { QuotaState } from './types.js';

function state(partial: Partial<QuotaState> & { service: QuotaState['service'] }): QuotaState {
  return { lastUpdated: 1, ...partial };
}

describe('isConnectedReading', () => {
  it('treats real remaining percentages as connected', () => {
    expect(isConnectedReading(state({ service: 'claude', sessionPct: 50 }))).toBe(true);
    expect(isConnectedReading(state({ service: 'grok', weeklyPct: 100 }))).toBe(true);
  });

  it('treats verified-but-percentage-less honesty as connected', () => {
    expect(
      isConnectedReading(state({ service: 'copilot', honesty: 'seat_active_usage_unknown' })),
    ).toBe(true);
    expect(isConnectedReading(state({ service: 'copilot', honesty: 'no_plan' }))).toBe(true);
    expect(isConnectedReading(state({ service: 'grok', honesty: 'usage_unknown' }))).toBe(true);
  });

  it('treats sign-in-required honesty as not connected', () => {
    expect(isConnectedReading(state({ service: 'grok', honesty: 'not_connected' }))).toBe(false);
    expect(
      isConnectedReading(state({ service: 'copilot', honesty: 'auth_unavailable' })),
    ).toBe(false);
    expect(
      isConnectedReading(state({ service: 'grok', honesty: 'browser_session_required' })),
    ).toBe(false);
    expect(
      isConnectedReading(state({ service: 'claude', honesty: 'session_expired' })),
    ).toBe(false);
  });

  it('treats an empty reading as not connected', () => {
    expect(isConnectedReading(state({ service: 'codex' }))).toBe(false);
  });
});

describe('deriveConnections', () => {
  it('reports every service, connected or not', () => {
    const connections = deriveConnections([
      state({ service: 'claude', sessionPct: 50 }),
      state({ service: 'grok', honesty: 'not_connected' }),
    ]);
    expect(connections).toEqual({
      claude: true,
      copilot: false,
      codex: false,
      grok: false,
    });
  });

  it('reports all services as not connected for an empty list', () => {
    expect(deriveConnections([])).toEqual({
      claude: false,
      copilot: false,
      codex: false,
      grok: false,
    });
  });
});
