export type ServiceId = 'claude' | 'copilot' | 'codex' | 'grok';

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
  /** VS Code has no stored secret for this service; use Chrome browser session. */
  | 'browser_session_required';

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
  /** Claude-only breakdown by sub-bucket */
  subcategories?: ClaudeSubcategory[];
  /**
   * Set when remaining percentages are intentionally absent so the UI can show
   * an honest status instead of inventing 100% remaining.
   */
  honesty?: QuotaHonesty;
  /** Unix timestamp (ms) of the last successful poll */
  lastUpdated: number;
}

/** User-facing copy for honesty states (shared by UI hosts). */
export const QUOTA_HONESTY_LABELS: Record<QuotaHonesty, string> = {
  seat_active_usage_unknown: 'Connected — remaining usage % not available',
  no_plan: 'No active Copilot plan on this account',
  auth_unavailable: 'Could not verify Copilot access — sign in to GitHub',
  usage_unknown: 'Connected — remaining usage % not available',
  not_connected: 'Not signed in — open grok.com while signed in',
  browser_session_required:
    'Use Chrome on grok.com (or link Chrome → VS Code) — no Grok secret stored here',
};

export type WsMessage =
  | { type: 'quota_update'; payload: QuotaState[] }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'error'; message: string };

export const SERVICE_LABELS: Record<ServiceId, string> = {
  claude: 'Claude',
  copilot: 'Copilot',
  codex: 'Codex',
  grok: 'Grok',
};

export const SERVICE_COLORS: Record<ServiceId, string> = {
  claude: '#1a1a2e',
  copilot: '#2ea44f',
  codex: '#0066ff',
  grok: '#111111',
};

export const SERVICE_URLS: Record<ServiceId, string> = {
  claude: 'claude.ai',
  copilot: 'github.com',
  codex: 'chatgpt.com',
  grok: 'grok.com',
};
