import { describe, expect, it } from 'vitest';
import { extractBatchexecutePayload, mapGeminiUsage } from './gemini.js';

const RAW = `)]}'

188
[["wrb.fr","jSf9Qc","[2,[[48384,0,2,[[1790777593,651754000]]],[2400,0,1,[[1790230393,651662000]]]],false]",null,null,null,"generic"],["di",222]]
25
[["e",4,null,null,224]]
`;

describe('extractBatchexecutePayload', () => {
  it('returns the inner JSON for the RPC id', () => {
    expect(extractBatchexecutePayload(RAW, 'jSf9Qc')).toEqual([
      2,
      [
        [48384, 0, 2, [[1790777593, 651754000]]],
        [2400, 0, 1, [[1790230393, 651662000]]],
      ],
      false,
    ]);
  });

  it('returns undefined for another id or a bad body', () => {
    expect(extractBatchexecutePayload(RAW, 'other')).toBeUndefined();
    expect(extractBatchexecutePayload('nope', 'jSf9Qc')).toBeUndefined();
  });
});

describe('mapGeminiUsage', () => {
  it('maps the 5-hour window to session and the weekly window to weekly', () => {
    const payload = [2, [[48384, 12096, 2, [[1790777593, 0]]], [2400, 600, 1, [[1790230393, 0]]]], false];
    expect(mapGeminiUsage(payload, 5)).toEqual({
      service: 'gemini',
      sessionPct: 75,
      sessionResetsAt: 1790230393000,
      weeklyPct: 75,
      weeklyResetsAt: 1790777593000,
      lastUpdated: 5,
    });
  });

  it('reads zero usage as 100% left', () => {
    const payload = extractBatchexecutePayload(RAW, 'jSf9Qc');
    const state = mapGeminiUsage(payload, 1);
    expect(state.sessionPct).toBe(100);
    expect(state.weeklyPct).toBe(100);
  });

  it('never invents a percent from an unknown shape', () => {
    for (const payload of [undefined, null, [], [2, 'x'], [2, [[0, 0, 1, []]]], [2, [[10, 20, 1, []]]]]) {
      expect(mapGeminiUsage(payload, 1)).toEqual({ service: 'gemini', honesty: 'usage_unknown', lastUpdated: 1 });
    }
  });
});
