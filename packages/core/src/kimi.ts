import type { AccountBalance, ProviderBalance, QuotaState } from './types.js';

/**
 * Documented Kimi (Moonshot AI) balance payload:
 * GET https://api.moonshot.ai/v1/users/me/balance
 * Amounts are numbers in USD. There is no remaining-percent cap.
 * https://platform.kimi.ai/docs/api/balance
 */

interface ParsedKimiBalance {
  available: boolean;
  info: AccountBalance;
}

function readAmount(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatAmount(value: number): string {
  // Keep full precision without floating-point noise (balances are USD cents-scale).
  return value.toFixed(5).replace(/\.?0+$/, '') || '0';
}

function parseKimiBalance(body: unknown): ParsedKimiBalance | null {
  if (body == null || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (record.code !== 0 || record.status !== true) return null;
  if (record.data == null || typeof record.data !== 'object') return null;
  const data = record.data as Record<string, unknown>;

  const available = readAmount(data.available_balance);
  const voucher = readAmount(data.voucher_balance);
  const cash = readAmount(data.cash_balance);
  if (available == null || voucher == null || cash == null) return null;

  return {
    available: available > 0,
    info: {
      currency: 'USD',
      total: formatAmount(available),
      granted: formatAmount(voucher),
      toppedUp: formatAmount(cash),
    },
  };
}

export function kimiApiKeyRequired(lastUpdated: number = Date.now()): QuotaState {
  return { service: 'kimi', honesty: 'api_key_required', lastUpdated };
}

export function kimiApiKeyInvalid(lastUpdated: number = Date.now()): QuotaState {
  return { service: 'kimi', honesty: 'api_key_invalid', lastUpdated };
}

export function kimiBalanceUnreadable(lastUpdated: number = Date.now()): QuotaState {
  return { service: 'kimi', honesty: 'balance_unreadable', lastUpdated };
}

/**
 * Map a Kimi `/v1/users/me/balance` JSON body to a quota reading.
 * Never sets session or weekly percents. An unusable body is honesty-only.
 * `available_balance <= 0` keeps the amounts and sets `balance_empty`
 * (Moonshot documents this as the point new requests get rejected).
 */
export function mapKimiBalance(body: unknown, lastUpdated: number = Date.now()): QuotaState {
  const parsed = parseKimiBalance(body);
  if (!parsed) return kimiBalanceUnreadable(lastUpdated);

  const balance: ProviderBalance = { available: parsed.available, infos: [parsed.info] };
  if (!parsed.available) {
    return { service: 'kimi', balance, honesty: 'balance_empty', lastUpdated };
  }
  return { service: 'kimi', balance, lastUpdated };
}
