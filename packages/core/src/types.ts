import type { ServiceId } from './services.js';

export type { ServiceId, ServiceAuth } from './services.js';
export {
  SERVICES,
  SERVICE_IDS,
  SERVICE_LABELS,
  SERVICE_COLORS,
  SERVICE_URLS,
  serviceById,
} from './services.js';

export type ClaudeSubcategoryName = 'Sonnet' | 'Designs' | 'Daily Routines';

export interface ClaudeSubcategory {
  name: ClaudeSubcategoryName;
  /** 0–100, percentage USED */
  usedPct: number;
  /** Human-readable label, e.g. "97% left" */
  label: string;
}

/**
 * Honest non-percentage states when remaining % is unknown or not applicable.
 * When set, sessionPct/weeklyPct must not be fabricated — omit them instead.
 */
export type QuotaHonesty =
  /** Seat/plan present; GitHub does not expose remaining % we can show. */
  | 'seat_active_usage_unknown'
  /** No active Copilot subscription/plan for this account. */
  | 'no_plan'
  /** Could not verify seat (auth, scope, network, or CORS). */
  | 'auth_unavailable'
  /** Authenticated (or host reachable) but no first-party remaining % payload. */
  | 'usage_unknown'
  /** Browser session not signed in for this service (Chrome live session path). */
  | 'not_connected'
  /** Browser session expired or missing (Chrome live session path; drop the ring). */
  | 'session_expired'
  /**
   * No usable Grok reading yet — set up a grok.com sso cookie in VS Code,
   * or use the optional Chrome live session path.
   */
  | 'browser_session_required'
  /** No API key stored for a balance provider. */
  | 'api_key_required'
  /** Stored API key was rejected (401/403). Drop any stale balance. */
  | 'api_key_invalid'
  /** Balance parsed, and the provider reports nothing left to spend. */
  | 'balance_empty'
  /** Authenticated, but the balance payload was not usable. */
  | 'balance_unreadable';

/** One currency bucket inside a prepaid provider balance. Amounts stay decimal strings. */
export interface AccountBalance {
  currency: string;
  /** Total available, including granted credit and topped-up funds. */
  total: string;
  granted: string;
  toppedUp: string;
}

/** Prepaid balance reading. This is money left, not a remaining percent. */
export interface ProviderBalance {
  /** Provider flag: the balance can still pay for API calls. */
  available: boolean;
  infos: AccountBalance[];
}

export interface QuotaState {
  service: ServiceId;
  /** 0–100, percentage REMAINING in the current session window. Omit if the service has no session quota. */
  sessionPct?: number;
  /** 0–100, percentage REMAINING in the current weekly window. Omit if the service has no weekly quota. */
  weeklyPct?: number;
  /** Unix timestamp (ms) when the session resets. Omit when sessionPct is absent. */
  sessionResetsAt?: number;
  /** Unix timestamp (ms) when the weekly window resets. Omit when weeklyPct is absent. */
  weeklyResetsAt?: number;
  /** 0–100, percentage REMAINING in the current billing month. Omit if the service has no monthly quota. */
  monthlyPct?: number;
  /** Unix timestamp (ms) when the billing month resets. Omit when monthlyPct is absent. */
  monthlyResetsAt?: number;
  /** Claude-only breakdown by sub-bucket */
  subcategories?: ClaudeSubcategory[];
  /**
   * Set when remaining percentages are intentionally absent so the UI can show
   * an honest status instead of inventing 100% remaining.
   */
  honesty?: QuotaHonesty;
  /**
   * Prepaid balance for providers that bill from a topped-up account.
   * Omit sessionPct and weeklyPct — there is no percent cap to invent.
   */
  balance?: ProviderBalance;
  /** Unix timestamp (ms) of the last successful poll */
  lastUpdated: number;
}

/** User-facing copy for honesty states (shared by UI hosts). */
export const QUOTA_HONESTY_LABELS: Record<QuotaHonesty, string> = {
  seat_active_usage_unknown: 'Connected - remaining usage % not available',
  no_plan: 'No active Copilot plan on this account',
  auth_unavailable: 'Could not verify Copilot access - sign in to GitHub',
  usage_unknown: 'Connected - remaining usage % not available',
  not_connected: 'Not signed in - open grok.com while signed in',
  session_expired: 'Session expired - sign in again on the service website',
  browser_session_required:
    'Set up a grok.com sso cookie in Set Up Accounts (or use Chrome on grok.com)',
  api_key_required: 'Add an API key to see your balance',
  api_key_invalid: 'API key rejected - paste a new key',
  balance_empty: 'No balance left - top up to keep calling the API',
  balance_unreadable: 'Connected - balance response was not usable',
};

export type WsMessage =
  | { type: 'quota_update'; payload: QuotaState[] }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'error'; message: string };

/** Messages the Chrome side panel sends to the service worker. */
export type PanelMessage =
  | { type: 'github_connect' }
  | { type: 'github_disconnect' }
  | { type: 'api_key_connect'; service: ServiceId; apiKey: string }
  | { type: 'api_key_disconnect'; service: ServiceId }
  | { type: 'content_quota'; payload: QuotaState };


