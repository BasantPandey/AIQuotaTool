import { describe, expect, it } from 'vitest';
import { DEFAULT_ENABLED_SERVICES, filterEnabled, resolveEnabledServices } from './enabled.js';

describe('resolveEnabledServices', () => {
  it('uses the default list when nothing is stored', () => {
    expect(resolveEnabledServices(undefined)).toEqual(DEFAULT_ENABLED_SERVICES);
    expect(DEFAULT_ENABLED_SERVICES).toEqual(['claude', 'copilot', 'codex', 'grok', 'gemini', 'cursor']);
  });

  it('keeps catalog order and drops unknown or repeated ids', () => {
    expect(resolveEnabledServices(['kimi', 'nope', 'claude', 'kimi'])).toEqual(['claude', 'kimi']);
  });

  it('keeps an empty list (the user removed every provider)', () => {
    expect(resolveEnabledServices([])).toEqual([]);
  });

  it('falls back to the default for a value that is not a list', () => {
    expect(resolveEnabledServices('claude')).toEqual(DEFAULT_ENABLED_SERVICES);
  });
});

describe('filterEnabled', () => {
  it('drops readings for removed providers', () => {
    const states = [
      { service: 'claude' as const, lastUpdated: 1 },
      { service: 'grok' as const, lastUpdated: 1 },
    ];
    expect(filterEnabled(states, ['grok'])).toEqual([{ service: 'grok', lastUpdated: 1 }]);
  });
});
