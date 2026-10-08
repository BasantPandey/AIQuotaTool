import type { KeyRecord } from './keys.js';
import type { QuotaState, ServiceId } from './types.js';
import { connectionIdOf, connectionKindOf } from './merge.js';
import { calcPct } from './utils.js';
import { formatAccountBalance } from './balance.js';
import { isConnectedReading } from './connections.js';
import { QUOTA_HONESTY_LABELS } from './types.js';

/** How a Key card shows its number. A Spend only card with a user budget is still 'spend'. */
export type KeyCardType = 'balance' | 'limit' | 'spend';

export function keyCardType(reading: QuotaState): KeyCardType | undefined {
  if (reading.balance != null) return 'balance';
  if (reading.spend?.limit != null) return 'limit';
  if (reading.spend != null) return 'spend';
  return undefined;
}

/**
 * Remaining percent, only from a provider cap or a user budget.
 * Spend with neither has no percent: never an invented one.
 */
export function keyPercent(reading: QuotaState): number | undefined {
  const spend = reading.spend;
  if (spend == null) return undefined;
  if (spend.limit != null) return calcPct(spend.amount, spend.limit);
  if (spend.budget != null && spend.budget > 0) return calcPct(spend.amount, spend.budget);
  return undefined;
}

/**
 * Copy each Key budget into its Spend only reading. The budget is user data, so it lives in the Key
 * list, but the percent math reads it from the reading. A reading with a provider cap keeps no budget.
 */
export function applyKeyBudgets(readings: readonly QuotaState[], keys: readonly KeyRecord[]): QuotaState[] {
  return readings.map((reading) => {
    if (connectionKindOf(reading) !== 'key' || reading.spend == null || reading.spend.limit != null) return reading;
    const budget = keys.find((k) => k.id === connectionIdOf(reading))?.budget;
    const { budget: _old, ...spend } = reading.spend;
    return { ...reading, spend: budget != null ? { ...spend, budget } : spend };
  });
}

export function formatMoney(amount: number, currency: string): string {
  return formatAccountBalance(amount.toFixed(2), currency);
}

/** The provider rejected the stored key (401 or 403). */
export function apiKeyInvalid(service: ServiceId, lastUpdated: number = Date.now()): QuotaState {
  return { service, honesty: 'api_key_invalid', lastUpdated };
}

export interface KeyDescription {
  /** The large number: a balance, "68% left", or a spend. */
  headline: string;
  /** What the number means, for example "account balance" or "$3.20 of $10.00 key limit". */
  detail: string;
  /** What kind of number the Key shows, for the Keys table. */
  shows: string;
  /** Remaining percent, only from a real cap or a user budget. */
  pct?: number;
  /** Nothing left. */
  empty: boolean;
}

/** Words for one Key reading. The panel and the status bar tooltip use the same words. */
export function describeKey(reading: QuotaState | undefined): KeyDescription {
  if (reading == null) return { headline: 'Waiting', detail: 'Reading the key', shows: 'Waiting for data', empty: false };
  const type = isConnectedReading(reading) ? keyCardType(reading) : undefined;
  const spend = reading.spend;
  if (type === 'balance') {
    const info = reading.balance!.infos[0]!;
    return {
      headline: formatAccountBalance(info.total, info.currency),
      detail: 'account balance',
      shows: 'Account balance',
      empty: reading.honesty === 'balance_empty',
    };
  }
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
  if (type === 'spend' && spend != null && reading.creditsUsed != null) {
    return {
      headline: `${reading.creditsUsed.toLocaleString('en-US')} requests`,
      detail: `this month - ${formatMoney(spend.amount, spend.currency)} billed`,
      shows: 'Requests used',
      empty: false,
    };
  }
  if (type === 'spend' && spend != null) {
    const scope = spend.scope === 'org' ? 'org spend' : 'this month';
    const pct = keyPercent(reading);
    if (pct != null && spend.budget != null) {
      return {
        headline: `${pct}% left`,
        detail: `${formatMoney(spend.amount, spend.currency)} of ${formatMoney(spend.budget, spend.currency)} budget${spend.scope === 'org' ? ' - org spend' : ''}`,
        shows: 'Spend vs budget',
        pct,
        empty: pct === 0,
      };
    }
    return { headline: formatMoney(spend.amount, spend.currency), detail: scope, shows: 'Spend only', empty: false };
  }
  if (reading.honesty === 'api_key_invalid') {
    return { headline: 'Key rejected', detail: 'Remove the key and add a new one', shows: 'Key rejected', empty: false };
  }
  const text = reading.honesty != null ? QUOTA_HONESTY_LABELS[reading.honesty] : 'No data';
  return { headline: 'No data', detail: text, shows: 'No data', empty: false };
}
