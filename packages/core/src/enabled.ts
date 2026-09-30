import type { QuotaState } from './types.js';
import { CHROME_SERVICES, type ChromeServiceId } from './services.js';

/** chrome.storage.local key for the providers the user turned on. */
export const ENABLED_SERVICES_KEY = 'enabledServices';

/** Session and GitHub providers start on. API-key providers need a key, so they start off. */
export const DEFAULT_ENABLED_SERVICES: ChromeServiceId[] = CHROME_SERVICES.filter(
  (service) => service.auth !== 'api_key',
).map((service) => service.id);

/** Stored value to a clean list in catalog order. A non-list value means "never set". */
export function resolveEnabledServices(stored: unknown): ChromeServiceId[] {
  if (!Array.isArray(stored)) return [...DEFAULT_ENABLED_SERVICES];
  return CHROME_SERVICES.map((service) => service.id).filter((id) => stored.includes(id));
}

export function filterEnabled(states: QuotaState[], enabled: readonly ChromeServiceId[]): QuotaState[] {
  return states.filter((state) => (enabled as readonly string[]).includes(state.service));
}
