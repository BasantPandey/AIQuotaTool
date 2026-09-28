import type { QuotaState } from './types.js';

/**
 * Gemini app usage. Private batchexecute RPC `jSf9Qc` on gemini.google.com
 * (the Settings > Usage limits page). Captured in issue #66.
 * Payload: [version, windows[], flag]. Each window: [limit, used, type, [[resetSeconds, nanos]]].
 * Type 1 = 5-hour window (session). Type 2 = weekly.
 */

export const GEMINI_USAGE_RPC = 'jSf9Qc';

/** Inner payload of one RPC from a batchexecute response body (after the `)]}'` guard). */
export function extractBatchexecutePayload(body: string, rpcId: string): unknown {
  for (const line of body.split('\n')) {
    if (!line.startsWith('[[')) continue;
    let frames: unknown;
    try {
      frames = JSON.parse(line);
    } catch {
      continue;
    }
    if (!Array.isArray(frames)) continue;
    for (const frame of frames) {
      if (Array.isArray(frame) && frame[0] === 'wrb.fr' && frame[1] === rpcId && typeof frame[2] === 'string') {
        try {
          return JSON.parse(frame[2]);
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

export function geminiUsageUnknown(lastUpdated: number = Date.now()): QuotaState {
  return { service: 'gemini', honesty: 'usage_unknown', lastUpdated };
}

interface Window {
  pct: number;
  resetsAt?: number;
}

function readWindow(raw: unknown): (Window & { type: number }) | undefined {
  if (!Array.isArray(raw)) return undefined;
  const [limit, used, type, reset] = raw;
  if (typeof limit !== 'number' || typeof used !== 'number' || typeof type !== 'number') return undefined;
  // ponytail: used > limit means the field order changed; refuse rather than guess.
  if (limit <= 0 || used < 0 || used > limit) return undefined;
  const pct = Math.round(((limit - used) / limit) * 100);
  const seconds = Array.isArray(reset) && Array.isArray(reset[0]) ? reset[0][0] : undefined;
  return typeof seconds === 'number' && seconds > 0 ? { type, pct, resetsAt: seconds * 1000 } : { type, pct };
}

export function mapGeminiUsage(payload: unknown, lastUpdated: number = Date.now()): QuotaState {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) return geminiUsageUnknown(lastUpdated);
  const windows = (payload[1] as unknown[]).map(readWindow);
  const session = windows.find((w) => w?.type === 1);
  const weekly = windows.find((w) => w?.type === 2);
  if (!session && !weekly) return geminiUsageUnknown(lastUpdated);

  const state: QuotaState = { service: 'gemini', lastUpdated };
  if (session) {
    state.sessionPct = session.pct;
    if (session.resetsAt != null) state.sessionResetsAt = session.resetsAt;
  }
  if (weekly) {
    state.weeklyPct = weekly.pct;
    if (weekly.resetsAt != null) state.weeklyResetsAt = weekly.resetsAt;
  }
  return state;
}
