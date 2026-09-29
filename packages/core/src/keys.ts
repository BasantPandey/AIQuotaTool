import type { ServiceId } from './services.js';
import { SERVICES } from './services.js';

/** A named API key. Holds no secret: the host keeps the value in secret storage under the id. */
export interface KeyRecord {
  id: string;
  service: ServiceId;
  name: string;
  /** The last 4 characters of the key. The only part of the value that the UI shows. */
  last4: string;
}

/** Providers that take a Key, in catalog order. */
export const KEY_SERVICES: readonly ServiceId[] = SERVICES.filter((s) => s.auth === 'api_key').map((s) => s.id);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "<Label> key N" with the lowest N that no existing name uses. */
export function defaultKeyName(label: string, existingNames: readonly string[]): string {
  for (let n = 1; ; n++) {
    const name = `${label} key ${n}`;
    if (!existingNames.some((e) => sameName(e, name))) return name;
  }
}

/** A name is unique for each provider. The match ignores case and outer spaces. */
export function isUniqueKeyName(
  name: string,
  service: ServiceId,
  keys: readonly KeyRecord[],
  exceptId?: string,
): boolean {
  return !keys.some((k) => k.service === service && k.id !== exceptId && sameName(k.name, name));
}

/** Read a stored Key list. Drops rows that are not valid, so bad storage never breaks the panel. */
export function parseKeyRecords(stored: unknown): KeyRecord[] {
  if (!Array.isArray(stored)) return [];
  return stored.flatMap((row): KeyRecord[] => {
    if (row == null || typeof row !== 'object') return [];
    const r = row as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.last4 !== 'string') return [];
    const service = KEY_SERVICES.find((s) => s === r.service);
    if (service == null) return [];
    return [{ id: r.id, service, name: r.name, last4: r.last4 }];
  });
}
