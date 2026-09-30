import type { ClaudeSubcategory, QuotaState } from './types.js';

/**
 * GET https://api.github.com/copilot_internal/user with the VS Code GitHub session token.
 * Not documented by GitHub. The rules follow the VS Code parser (chatEntitlementService.ts):
 * - `percent_remaining` is 0..100 REMAINING. Clamp it.
 * - Skip a snapshot with `unlimited: false` and entitlement 0 (no allowance).
 * - `entitlement` was a number and is now a string. Accept both.
 * - `unlimited: true` with `credits_used` shows credits used, never a percent.
 * - Reset: the snapshot `quota_reset_at` (Unix seconds), then `quota_reset_date_utc`, then
 *   `quota_reset_date`, then `limited_user_reset_date`.
 */

const QUOTAS = [
  ['premium_interactions', 'Premium requests'],
  ['chat', 'Chat'],
  ['completions', 'Completions'],
] as const;

interface Limited {
  label: string;
  pct: number;
  resetsAt: number | undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function dateMs(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/** Returns null for a shape that is not known, so the host falls back to the seat check. */
export function mapCopilotUser(body: unknown, lastUpdated: number = Date.now()): QuotaState | null {
  if (body == null || typeof body !== 'object') return null;
  const user = body as Record<string, unknown>;
  const snapshots = user.quota_snapshots;
  if (snapshots == null || typeof snapshots !== 'object') return null;

  const planReset =
    dateMs(user.quota_reset_date_utc) ?? dateMs(user.quota_reset_date) ?? dateMs(user.limited_user_reset_date);
  const limited: Limited[] = [];
  let creditsUsed: number | undefined;
  let known = false;

  for (const [key, label] of QUOTAS) {
    const snap = (snapshots as Record<string, unknown>)[key];
    if (snap == null || typeof snap !== 'object') continue;
    const s = snap as Record<string, unknown>;
    if (typeof s.unlimited !== 'boolean') return null;
    known = true;
    if (s.unlimited) {
      const used = num(s.credits_used);
      if (used != null) creditsUsed = (creditsUsed ?? 0) + used;
      continue;
    }
    const entitlement = num(s.entitlement);
    if (entitlement === 0) continue;
    const pct = num(s.percent_remaining);
    if (pct == null) return null;
    const resetSeconds = num(s.quota_reset_at);
    limited.push({
      label,
      pct: Math.round(Math.max(0, Math.min(100, pct))),
      // A real Free plan response sends quota_reset_at: 0 on each snapshot. 0 means "not set".
      resetsAt: resetSeconds != null && resetSeconds > 0 ? resetSeconds * 1000 : planReset,
    });
  }
  if (!known) return null;

  const state: QuotaState = { service: 'copilot', lastUpdated };
  if (limited.length > 0) {
    const lowest = limited.reduce((a, b) => (b.pct < a.pct ? b : a));
    state.monthlyPct = lowest.pct;
    if (lowest.resetsAt != null) state.monthlyResetsAt = lowest.resetsAt;
    const allEqual = limited.every((q) => q.pct === lowest.pct);
    state.monthlyLabel = limited.length === 1 ? lowest.label : allEqual ? 'Monthly' : `${lowest.label} (lowest)`;
    if (limited.length > 1) {
      state.subcategories = limited.map(
        (q): ClaudeSubcategory => ({ name: q.label, usedPct: 100 - q.pct, label: `${q.pct}% left` }),
      );
    }
  }
  if (creditsUsed != null) state.creditsUsed = creditsUsed;
  // Signed in, but no limited quota and no credit count: say so, never 100%.
  if (limited.length === 0 && creditsUsed == null) state.honesty = 'seat_active_usage_unknown';
  return state;
}
