import type { QuotaState, ServiceId } from './types.js';
import { SERVICES } from './services.js';

/** chrome.storage.local key for the providers the user turned on. */
export const ENABLED_SERVICES_KEY = 'enabledServices';

/** Session and GitHub providers start on. API-key providers need a key, so they start off. */
export const DEFAULT_ENABLED_SERVICES: ServiceId[] = SERVICES.filter(
  (service) => service.auth !== 'api_key',
).map((service) => service.id);

/** Stored value to a clean list in catalog order. A non-list value means "never set". */
export function resolveEnabledServices(stored: unknown): ServiceId[] {
  if (!Array.isArray(stored)) return [...DEFAULT_ENABLED_SERVICES];
  return SERVICES.map((service) => service.id).filter((id) => stored.includes(id));
}

export function filterEnabled(states: QuotaState[], enabled: readonly ServiceId[]): QuotaState[] {
  return states.filter((state) => enabled.includes(state.service));
}
