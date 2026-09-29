import type { QuotaState, ChromeServiceId } from '@ai-quota-tool/core';

export interface ServiceFetcher {
  readonly serviceId: ChromeServiceId;
  /**
   * Fetch the current quota state for this service using the user's existing
   * browser session (cookies are sent automatically by fetch() in the
   * extension's service worker when credentials: 'include' is used).
   */
  fetch(): Promise<QuotaState>;
}
