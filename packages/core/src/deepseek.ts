import type { AccountBalance, ProviderBalance, QuotaState } from './types.js';

/**
 * Documented DeepSeek balance payload:
 * GET https://api.deepseek.com/user/balance
 * Amounts are decimal strings. There is no remaining-percent cap.
 */

interface ParsedDeepSeekBalance {
  is_available: boolean;
  infos: AccountBalance[];
}

function readDecimal(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed)) return null;
  return trimmed;
}

function readInfo(value: unknown): AccountBalance | null {
  if (value == null || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.currency !== 'string') return null;
  const currency = row.currency.trim();
  if (currency.length < 3 || currency.length > 8) return null;
  const total = readDecimal(row.total_balance);
  const granted = readDecimal(row.granted_balance);
  const toppedUp = readDecimal(row.topped_up_balance);
  if (total == null || granted == null || toppedUp == null) return null;
  return { currency, total, granted, toppedUp };
}

function parseDeepSeekBalance(body: unknown): ParsedDeepSeekBalance | null {
  if (body == null || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  if (typeof record.is_available !== 'boolean') return null;
  if (!Array.isArray(record.balance_infos)) return null;
  const infos: AccountBalance[] = [];
  for (const entry of record.balance_infos) {
    const info = readInfo(entry);
    if (info) infos.push(info);
  }
  if (infos.length === 0) return null;
  return { is_available: record.is_available, infos };
}

function isZero(amount: string): boolean {
  return Number(amount) === 0;
}

export function deepseekApiKeyRequired(lastUpdated: number = Date.now()): QuotaState {
  return { service: 'deepseek', honesty: 'api_key_required', lastUpdated };
}

export function deepseekApiKeyInvalid(lastUpdated: number = Date.now()): QuotaState {
  return { service: 'deepseek', honesty: 'api_key_invalid', lastUpdated };
}

export function deepseekBalanceUnreadable(lastUpdated: number = Date.now()): QuotaState {
  return { service: 'deepseek', honesty: 'balance_unreadable', lastUpdated };
}

/**
 * Map a DeepSeek `/user/balance` JSON body to a quota reading.
 * Never sets session or weekly percents. An unusable body is honesty-only.
 * Empty or unavailable funds keep the amounts and set `balance_empty`.
 */
export function mapDeepSeekBalance(body: unknown, lastUpdated: number = Date.now()): QuotaState {
  const parsed = parseDeepSeekBalance(body);
  if (!parsed) return deepseekBalanceUnreadable(lastUpdated);

  const depleted =
    !parsed.is_available || parsed.infos.every((info) => isZero(info.total));
  const balance: ProviderBalance = {
    available: parsed.is_available,
    infos: parsed.infos,
  };
  if (depleted) {
    return { service: 'deepseek', balance, honesty: 'balance_empty', lastUpdated };
  }
  return { service: 'deepseek', balance, lastUpdated };
}
