import type { QuotaState } from '@ai-quota-tool/core';
import {
  connectionIdOf,
  connectionKindOf,
  formatAccountBalance,
  formatMoney,
  isConnectedReading,
  keyCardType,
  keyPercent,
  QUOTA_HONESTY_LABELS,
} from '@ai-quota-tool/core';

export interface KeyView {
  /** The large number: a balance, "68% left", or a spend. */
  headline: string;
  /** What the number means, for example "account balance" or "$3.20 of $10.00 key limit". */
  detail: string;
  /** The Shows column of the Keys table. */
  shows: string;
  /** Remaining percent, only from a real cap. */
  pct?: number;
  /** Nothing left: the value shows in red. */
  empty: boolean;
}

export function keyReading(readings: QuotaState[], id: string): QuotaState | undefined {
  return readings.find((s) => connectionIdOf(s) === id && connectionKindOf(s) === 'key');
}

export function keyView(reading: QuotaState | undefined): KeyView {
  if (reading == null) return { headline: 'Waiting', detail: 'Reading the key', shows: 'Waiting for data', empty: false };
  const type = isConnectedReading(reading) ? keyCardType(reading) : undefined;
  const empty = reading.honesty === 'balance_empty';
  if (type === 'balance') {
    const info = reading.balance!.infos[0]!;
    return { headline: formatAccountBalance(info.total, info.currency), detail: 'account balance', shows: 'Account balance', empty };
  }
  const spend = reading.spend;
  if (type === 'limit' && spend?.limit != null) {
    const pct = keyPercent(reading)!;
    return {
      headline: `${pct}% left`,
      detail: `${formatMoney(spend.amount, spend.currency)} of ${formatMoney(spend.limit, spend.currency)} key limit`,
      shows: 'Spend vs key limit',
      pct,
      empty: pct === 0,
    };
  }
  if (type === 'spend' && spend != null) {
    return {
      headline: formatMoney(spend.amount, spend.currency),
      detail: spend.scope === 'org' ? 'org spend this month' : 'this month',
      shows: 'Spend only',
      empty: false,
    };
  }
  if (reading.honesty === 'api_key_invalid') {
    return { headline: 'Key rejected', detail: 'Remove the key and add a new one', shows: 'Key rejected', empty: false };
  }
  const text = reading.honesty != null ? QUOTA_HONESTY_LABELS[reading.honesty] : 'No data';
  return { headline: 'No data', detail: text, shows: 'No data', empty: false };
}
