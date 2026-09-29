import type { QuotaState, ServiceId } from './types.js';
import { calcPct } from './utils.js';
import { formatAccountBalance } from './balance.js';

/** How a Key card shows its number. */
export type KeyCardType = 'balance' | 'limit' | 'spend';

export function keyCardType(reading: QuotaState): KeyCardType | undefined {
  if (reading.balance != null) return 'balance';
  if (reading.spend?.limit != null) return 'limit';
  if (reading.spend != null) return 'spend';
  return undefined;
}

/** Remaining percent, only from a provider cap. Otherwise undefined: never an invented percent. */
export function keyPercent(reading: QuotaState): number | undefined {
  const spend = reading.spend;
  if (spend?.limit == null) return undefined;
  return calcPct(spend.amount, spend.limit);
}

export function formatMoney(amount: number, currency: string): string {
  return formatAccountBalance(amount.toFixed(2), currency);
}

/** The provider rejected the stored key (401 or 403). */
export function apiKeyInvalid(service: ServiceId, lastUpdated: number = Date.now()): QuotaState {
  return { service, honesty: 'api_key_invalid', lastUpdated };
}
