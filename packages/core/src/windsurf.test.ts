import { describe, expect, it } from 'vitest';
import { encodeWindsurfPlanStatusRequest, mapWindsurfPlanStatus } from './windsurf.js';

const NOW = 1_700_000_000_000;

// Small protobuf writer for test inputs.
function varint(v: number): number[] {
  const out: number[] = [];
  while (v >= 0x80) {
    out.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
  return out;
}
const vfield = (n: number, v: number) => [...varint(n * 8), ...varint(v)];
const lfield = (n: number, bytes: number[]) => [...varint(n * 8 + 2), ...varint(bytes.length), ...bytes];
const text = (s: string) => [...new TextEncoder().encode(s)];
const response = (status: number[]) => Uint8Array.from(lfield(1, status));

describe('encodeWindsurfPlanStatusRequest', () => {
  it('writes field 1 (token) and field 2 (true)', () => {
    expect([...encodeWindsurfPlanStatusRequest('ab')]).toEqual([0x0a, 2, 0x61, 0x62, 0x10, 1]);
  });
});

describe('mapWindsurfPlanStatus', () => {
  it('reads daily and weekly percent left with reset times', () => {
    const state = mapWindsurfPlanStatus(
      response([
        ...lfield(1, lfield(2, text('Pro'))),
        ...lfield(3, vfield(1, 1_800_000_000)),
        ...vfield(14, 62),
        ...vfield(15, 31),
        ...vfield(17, 1_790_000_000),
        ...vfield(18, 1_790_500_000),
      ]),
      NOW,
    );
    expect(state).toMatchObject({
      service: 'windsurf',
      sessionPct: 62,
      sessionLabel: 'Daily',
      sessionResetsAt: 1_790_000_000_000,
      weeklyPct: 31,
      weeklyResetsAt: 1_790_500_000_000,
    });
    expect(state.honesty).toBeUndefined();
  });

  it('a window with a reset time and no percent has 0% left (proto3 leaves out 0)', () => {
    const state = mapWindsurfPlanStatus(response([...vfield(15, 40), ...vfield(17, 1_790_000_000), ...vfield(18, 1_790_500_000)]), NOW);
    expect(state.sessionPct).toBe(0);
    expect(state.weeklyPct).toBe(40);
  });

  it('a plan with no quota fields is usage unknown, never 100%', () => {
    const state = mapWindsurfPlanStatus(response(lfield(1, lfield(2, text('Free')))), NOW);
    expect(state.honesty).toBe('usage_unknown');
    expect(state.sessionPct).toBeUndefined();
  });

  it('bad bytes or a percent above 100 are usage unknown', () => {
    expect(mapWindsurfPlanStatus(Uint8Array.from([0x0a, 50, 1]), NOW).honesty).toBe('usage_unknown');
    expect(mapWindsurfPlanStatus(new Uint8Array(), NOW).honesty).toBe('usage_unknown');
    expect(mapWindsurfPlanStatus(response(vfield(14, 250)), NOW).honesty).toBe('usage_unknown');
  });
});
