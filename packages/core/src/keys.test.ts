import { describe, expect, it } from 'vitest';
import { defaultKeyName, isUniqueKeyName, KEY_SERVICES, parseKeyRecords, type KeyRecord } from './keys.js';

const key = (id: string, service: KeyRecord['service'], name: string): KeyRecord => ({ id, service, name, last4: 'abcd' });

describe('defaultKeyName', () => {
  it('starts at 1', () => {
    expect(defaultKeyName('DeepSeek', [])).toBe('DeepSeek key 1');
  });

  it('takes the lowest free number', () => {
    expect(defaultKeyName('DeepSeek', ['DeepSeek key 1', 'deepseek KEY 3'])).toBe('DeepSeek key 2');
  });
});

describe('isUniqueKeyName', () => {
  const keys = [key('a', 'deepseek', 'Work'), key('b', 'kimi', 'Home')];

  it('rejects the same name for the same provider, in any case', () => {
    expect(isUniqueKeyName(' work ', 'deepseek', keys)).toBe(false);
  });

  it('allows the same name for another provider', () => {
    expect(isUniqueKeyName('Work', 'kimi', keys)).toBe(true);
  });

  it('ignores the key that the user renames', () => {
    expect(isUniqueKeyName('Work', 'deepseek', keys, 'a')).toBe(true);
  });
});

describe('parseKeyRecords', () => {
  it('keeps valid rows and drops the rest', () => {
    const stored = [
      { id: 'a', service: 'deepseek', name: 'Work', last4: '1234', secret: 'never kept' },
      { id: 'b', service: 'claude', name: 'Not a key provider', last4: '1234' },
      { id: 3, service: 'kimi', name: 'Bad id', last4: '1234' },
      null,
    ];
    expect(parseKeyRecords(stored)).toEqual([{ id: 'a', service: 'deepseek', name: 'Work', last4: '1234' }]);
  });

  it('reads anything that is not a list as no keys', () => {
    expect(parseKeyRecords(undefined)).toEqual([]);
    expect(parseKeyRecords({})).toEqual([]);
  });

  it('knows the Key providers', () => {
    expect(KEY_SERVICES).toEqual(['deepseek', 'kimi', 'openrouter', 'anthropic', 'openai']);
  });
});
