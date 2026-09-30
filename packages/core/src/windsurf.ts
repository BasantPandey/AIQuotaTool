import type { QuotaState } from './types.js';

/**
 * Windsurf (Devin Desktop) GetPlanStatus, a Connect RPC in protobuf. Not documented.
 * Field numbers come from CodexBar (WindsurfWebFetcher.swift). They are not official.
 *
 * Request:  1 auth_token (string), 2 include_top_up_status (bool).
 * Response: 1 plan_status {
 *   1 plan_info { 2 plan_name }, 14 daily_quota_remaining_percent, 15 weekly_quota_remaining_percent,
 *   17 daily_quota_reset_at_unix, 18 weekly_quota_reset_at_unix }
 */

type Field = { wire: 0; value: number } | { wire: 2; value: Uint8Array };

function readVarint(bytes: Uint8Array, start: number): [number, number] {
  let value = 0;
  let scale = 1;
  let i = start;
  for (;;) {
    if (i >= bytes.length) throw new Error('truncated varint');
    const b = bytes[i++]!;
    value += (b & 0x7f) * scale;
    if ((b & 0x80) === 0) return [value, i];
    scale *= 128;
    if (scale > 2 ** 63) throw new Error('varint too long');
  }
}

/** Top-level fields of one message. Wire types 1 and 5 are skipped. A bad buffer throws. */
function readFields(bytes: Uint8Array): Map<number, Field> {
  const fields = new Map<number, Field>();
  let i = 0;
  while (i < bytes.length) {
    const [key, next] = readVarint(bytes, i);
    i = next;
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      const [value, after] = readVarint(bytes, i);
      fields.set(field, { wire: 0, value });
      i = after;
    } else if (wire === 2) {
      const [length, after] = readVarint(bytes, i);
      if (after + length > bytes.length) throw new Error('truncated field');
      fields.set(field, { wire: 2, value: bytes.subarray(after, after + length) });
      i = after + length;
    } else if (wire === 1) {
      i += 8;
    } else if (wire === 5) {
      i += 4;
    } else {
      throw new Error(`unsupported wire type ${wire}`);
    }
  }
  return fields;
}

function writeVarint(value: number, out: number[]): void {
  let v = value;
  while (v >= 0x80) {
    out.push((v % 128) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
}

/** Protobuf body of GetPlanStatusRequest. */
export function encodeWindsurfPlanStatusRequest(authToken: string): Uint8Array {
  const token = new TextEncoder().encode(authToken);
  const out: number[] = [];
  writeVarint((1 << 3) | 2, out);
  writeVarint(token.length, out);
  out.push(...token);
  writeVarint((2 << 3) | 0, out);
  writeVarint(1, out);
  return Uint8Array.from(out);
}

const varint = (fields: Map<number, Field>, n: number) => {
  const f = fields.get(n);
  return f?.wire === 0 ? f.value : undefined;
};

/**
 * Proto3 leaves out a field with the value 0. So a window with a reset time and no percent has 0% left.
 * A window with neither is not in the plan. A percent above 100 is not a known shape.
 */
function windowPct(fields: Map<number, Field>, pctField: number, resetField: number): { pct: number; resetsAt?: number } | null | undefined {
  const pct = varint(fields, pctField);
  const reset = varint(fields, resetField);
  if (pct == null && reset == null) return undefined;
  const value = pct ?? 0;
  if (value > 100) return null;
  return reset != null && reset > 0 ? { pct: value, resetsAt: reset * 1000 } : { pct: value };
}

export function mapWindsurfPlanStatus(body: Uint8Array, lastUpdated: number = Date.now()): QuotaState {
  const unknown: QuotaState = { service: 'windsurf', honesty: 'usage_unknown', lastUpdated };
  let status: Map<number, Field>;
  try {
    const top = readFields(body).get(1);
    if (top?.wire !== 2) return unknown;
    status = readFields(top.value);
  } catch {
    return unknown;
  }
  const daily = windowPct(status, 14, 17);
  const weekly = windowPct(status, 15, 18);
  if (daily === null || weekly === null || (daily == null && weekly == null)) return unknown;

  const state: QuotaState = { service: 'windsurf', lastUpdated };
  if (daily) {
    state.sessionPct = daily.pct;
    state.sessionLabel = 'Daily';
    if (daily.resetsAt != null) state.sessionResetsAt = daily.resetsAt;
  }
  if (weekly) {
    state.weeklyPct = weekly.pct;
    if (weekly.resetsAt != null) state.weeklyResetsAt = weekly.resetsAt;
  }
  return state;
}
