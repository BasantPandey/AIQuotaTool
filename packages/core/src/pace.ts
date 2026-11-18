import type { QuotaSample, QuotaState } from './types.js';
import { formatTimeRemaining } from './utils.js';

/** The device keeps this many samples for one connection. */
export const QUOTA_HISTORY_CAP = 48;

const MIN_PACE_SAMPLES = 3;
const MIN_PACE_SPAN_MS = 10 * 60 * 1000;

function isReading(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function storedHistory(state: QuotaState): readonly QuotaSample[] | undefined {
  if (state.history == null || state.history.length === 0) return undefined;
  return state.history;
}

/** One sample for each window that already has a percent and a reset time. */
export function samplesFrom(state: QuotaState): QuotaSample[] {
  const pairs: Array<[number | undefined, number | undefined]> = [
    [state.sessionPct, state.sessionResetsAt],
    [state.weeklyPct, state.weeklyResetsAt],
    [state.monthlyPct, state.monthlyResetsAt],
  ];
  const samples: QuotaSample[] = [];
  for (const [remaining, resetAt] of pairs) {
    if (!isReading(remaining) || !isReading(resetAt)) continue;
    samples.push({ at: state.lastUpdated, remaining, limit: 100, resetAt });
  }
  return samples;
}

/** Keep the newest samples. Drop a repeat of the same time and reset. */
export function appendSamples(
  history: readonly QuotaSample[],
  added: readonly QuotaSample[],
): QuotaSample[] {
  const merged = [...history];
  for (const sample of added) {
    const seen = merged.some((item) => item.at === sample.at && item.resetAt === sample.resetAt);
    if (!seen) merged.push(sample);
  }
  merged.sort((a, b) => a.at - b.at || a.resetAt - b.resetAt);
  return merged.slice(-QUOTA_HISTORY_CAP);
}

/**
 * Samples to keep after this poll.
 * A newer poll appends. An older poll does not.
 * The same poll time does not append again.
 */
export function historyForPreferred(
  previous: QuotaState | undefined,
  incoming: QuotaState,
  preferred: QuotaState,
): readonly QuotaSample[] | undefined {
  if (previous == null) return storedHistory(preferred) ?? nonempty(samplesFrom(preferred));

  if (incoming.lastUpdated < previous.lastUpdated) return storedHistory(previous);

  if (incoming.lastUpdated === previous.lastUpdated) {
    const base = storedHistory(previous) ?? storedHistory(incoming) ?? [];
    return nonempty(appendSamples(base, samplesFrom(preferred)));
  }

  const base = storedHistory(previous) ?? samplesFrom(previous);
  const extra = storedHistory(incoming) ?? samplesFrom(incoming);
  return nonempty(appendSamples(base, extra));
}

function nonempty(samples: readonly QuotaSample[]): QuotaSample[] | undefined {
  return samples.length > 0 ? [...samples] : undefined;
}

interface PaceWindow {
  label: string;
  resetAt: number;
}

function paceWindows(state: QuotaState): PaceWindow[] {
  const windows: PaceWindow[] = [];
  if (isReading(state.sessionPct) && isReading(state.sessionResetsAt)) {
    windows.push({ label: 'the session', resetAt: state.sessionResetsAt });
  }
  if (isReading(state.weeklyPct) && isReading(state.weeklyResetsAt)) {
    windows.push({ label: 'the weekly window', resetAt: state.weeklyResetsAt });
  }
  if (isReading(state.monthlyPct) && isReading(state.monthlyResetsAt)) {
    windows.push({
      label: state.monthlyLabel ?? 'the monthly window',
      resetAt: state.monthlyResetsAt,
    });
  }
  return windows;
}

/**
 * Short pace line for the window that runs out first.
 * Returns nothing when the samples are too few, too brief, flat, or rising.
 */
export function paceWarning(state: QuotaState): string | null {
  const history = storedHistory(state);
  if (history == null) return null;

  let best: { label: string; ms: number } | undefined;
  for (const window of paceWindows(state)) {
    const samples = history
      .filter((sample) => sample.resetAt === window.resetAt)
      .sort((a, b) => a.at - b.at);
    if (samples.length < MIN_PACE_SAMPLES) continue;
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (first == null || last == null) continue;
    const span = last.at - first.at;
    if (span < MIN_PACE_SPAN_MS) continue;
    if (last.remaining >= first.remaining) continue;
    const drop = first.remaining - last.remaining;
    const ms = (last.remaining / drop) * span;
    if (best == null || ms < best.ms) best = { label: window.label, ms };
  }

  if (best == null) return null;
  if (best.ms <= 0) return `At this pace, ${best.label} runs out now.`;
  return `At this pace, ${best.label} runs out in ${formatTimeRemaining(best.ms)}.`;
}
