import { describe, expect, it } from 'vitest';
import { formatTimeRemaining } from './utils.js';

const M = 60_000;
const H = 60 * M;

describe('formatTimeRemaining', () => {
  it('shows hours and minutes below one day', () => {
    expect(formatTimeRemaining(2 * H + 59 * M)).toBe('2h 59m');
    expect(formatTimeRemaining(47 * M)).toBe('47m');
    expect(formatTimeRemaining(30_000)).toBe('<1m');
    expect(formatTimeRemaining(0)).toBe('now');
  });

  it('shows days and hours from one day up', () => {
    expect(formatTimeRemaining(94 * H + 59 * M)).toBe('3d 22h');
    expect(formatTimeRemaining(48 * H)).toBe('2d');
    expect(formatTimeRemaining(24 * H + 30 * M)).toBe('1d');
  });
});
