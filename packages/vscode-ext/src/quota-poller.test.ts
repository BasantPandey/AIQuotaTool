import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONNECTION_INTERVAL_MS, QuotaPoller } from './quota-poller.js';

const calls = vi.hoisted((): string[] => []);
vi.mock('./session-fetch.js', () => {
  const reading = (service: string) => async () => {
    calls.push(service);
    return { service, sessionPct: 50, lastUpdated: Date.now() };
  };
  return {
    fetchClaudeUsage: reading('claude'),
    fetchCodexUsage: reading('codex'),
    fetchCopilotUsage: reading('copilot'),
    fetchGrokUsage: reading('grok'),
    fetchKeyReading: async (service: string) => {
      calls.push(`key:${service}`);
      return { service, spend: { amount: 1, currency: 'USD', scope: 'key' }, lastUpdated: Date.now() };
    },
  };
});

function sources(focused: { value: boolean }) {
  return {
    credentials: async () => ({ claudeSessionKey: 'sk', codexSessionToken: undefined, grokSsoCookie: undefined }),
    githubToken: async () => 'gh',
    keys: async () => [{ key: { id: 'k1', service: 'openrouter' as const, name: 'K', last4: 'abcd' }, secret: 's' }],
    focused: () => focused.value,
  };
}

describe('QuotaPoller schedule', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  it('polls each connection at most every 5 minutes', async () => {
    const poller = new QuotaPoller();
    poller.start(sources({ value: true }));
    await poller.pollNow();
    expect(calls.sort()).toEqual(['claude', 'copilot', 'key:openrouter']);

    calls.length = 0;
    vi.setSystemTime(CONNECTION_INTERVAL_MS - 1);
    await poller.pollNow();
    expect(calls).toEqual([]);

    vi.setSystemTime(CONNECTION_INTERVAL_MS);
    await poller.pollNow();
    expect(calls.sort()).toEqual(['claude', 'copilot', 'key:openrouter']);
    poller.stop();
  });

  it('polls Accounts only while VS Code has focus; Keys still poll', async () => {
    const focused = { value: false };
    const poller = new QuotaPoller();
    poller.start(sources(focused));
    await poller.pollNow();
    expect(calls).toEqual(['key:openrouter']);

    calls.length = 0;
    focused.value = true;
    await poller.pollNow();
    expect(calls.sort()).toEqual(['claude', 'copilot']);
    poller.stop();
  });

  it('pollSoon makes one connection due at once', async () => {
    const poller = new QuotaPoller();
    poller.start(sources({ value: true }));
    await poller.pollNow();
    calls.length = 0;
    poller.pollSoon('claude');
    await poller.pollNow();
    expect(calls).toEqual(['claude']);
    poller.stop();
  });
});
