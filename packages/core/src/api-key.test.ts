import { describe, expect, it } from 'vitest';
import { normalizeApiKey } from './api-key.js';

describe('normalizeApiKey', () => {
  it('trims and strips a Bearer prefix and wrapping quotes', () => {
    expect(normalizeApiKey('  Bearer sk-abc12345  ')).toBe('sk-abc12345');
    expect(normalizeApiKey('"sk-abc12345"')).toBe('sk-abc12345');
  });

  it('rejects empty, short, multi-line, and oversized values', () => {
    expect(normalizeApiKey('   ')).toBeNull();
    expect(normalizeApiKey('short')).toBeNull();
    expect(normalizeApiKey('sk-abc\n12345')).toBeNull();
    expect(normalizeApiKey(`sk-${'a'.repeat(300)}`)).toBeNull();
  });
});
