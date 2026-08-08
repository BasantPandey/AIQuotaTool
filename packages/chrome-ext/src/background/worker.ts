import type { LowQuotaArmed, PanelMessage, QuotaState } from '@ai-quota-tool/core';
import {
  decideLowQuotaAlerts,
  deriveBadge,
  initialLowQuotaArmed,
  mergeQuotaStates,
  upsertQuotaState,
} from '@ai-quota-tool/core';
import { ClaudeFetcher } from './fetchers/claude.js';
import { CopilotFetcher } from './fetchers/copilot.js';
import { CodexFetcher } from './fetchers/codex.js';
import { GrokFetcher } from './fetchers/grok.js';
import {
  notifyLowQuota,
  scheduleResetNotifications,
  handleAlarm,
} from './notifications.js';
import {
  connectGitHub,
  disconnectGitHub,
  trySilentGitHubReauth,
} from './github-auth.js';

const POLL_ALARM = 'quota-poll';
const POLL_INTERVAL_MINUTES = 1;
const LOW_QUOTA_ARMED_KEY = 'lowQuotaArmed';
/** Legacy V1 alarm from the removed WS client - cleared once on install. */
const LEGACY_WS_KEEPALIVE_ALARM = 'ws-keepalive';

const copilotFetcher = new CopilotFetcher();
const fetchers = [
  new ClaudeFetcher(),
  copilotFetcher,
  new CodexFetcher(),
  new GrokFetcher(),
];

// Guard against re-auth loops: GitHub rate-limits token creation (10/hour).
// The flag resets on each service worker activation.
let silentReauthAttempted = false;

function updateBadge(states: QuotaState[]): void {
  const badge = deriveBadge(states);
  chrome.action.setBadgeText({ text: badge.text });
  chrome.action.setBadgeBackgroundColor({ color: badge.color });
}

/** Low-quota alerts with a persisted per-service latch (alerts once per drop). */
async function checkLowQuota(states: QuotaState[]): Promise<void> {
  const stored = await chrome.storage.local.get([LOW_QUOTA_ARMED_KEY]);
  const armed =
    (stored[LOW_QUOTA_ARMED_KEY] as LowQuotaArmed | undefined) ??
    initialLowQuotaArmed();
  const decision = decideLowQuotaAlerts(states, armed);
  if (decision.alerts.length > 0) notifyLowQuota(decision.alerts);
  await chrome.storage.local.set({ [LOW_QUOTA_ARMED_KEY]: decision.armed });
}

/** Side effects that follow every storage merge. */
async function afterMerge(merged: QuotaState[]): Promise<void> {
  scheduleResetNotifications(merged);
  updateBadge(merged);
  await checkLowQuota(merged);
}

/**
 * A 401 from the Copilot seat check with a stored token means the token died.
 * Try one silent re-auth (the user already authorized the app, so GitHub
 * auto-completes), then re-fetch Copilot so the panel recovers without a
 * manual reconnect.
 */
async function recoverCopilotIfTokenDied(states: QuotaState[]): Promise<QuotaState[]> {
  if (silentReauthAttempted) return states;
  const copilot = states.find((s) => s.service === 'copilot');
  if (copilot?.honesty !== 'auth_unavailable') return states;
  silentReauthAttempted = true;
  if (!(await trySilentGitHubReauth())) return states;
  const fresh = await copilotFetcher.fetch();
  return states.map((s) => (s.service === 'copilot' ? fresh : s));
}

async function pollAll(): Promise<void> {
  const results = await Promise.allSettled(fetchers.map((f) => f.fetch()));

  let states: QuotaState[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      states.push(result.value);
    } else {
      console.error('[ai-quota-tool] Fetch failed:', result.reason);
    }
  }

  if (states.length === 0) return;
  states = await recoverCopilotIfTokenDied(states);

  // Freshest-wins merge with content-script / prior SW readings; partial polls keep other services.
  const stored = await chrome.storage.local.get(['quotaStates']);
  const existing: QuotaState[] =
    (stored['quotaStates'] as QuotaState[] | undefined) ?? [];
  const merged = mergeQuotaStates(existing, states);

  await chrome.storage.local.set({ quotaStates: merged, lastPollAt: Date.now() });
  await afterMerge(merged);
}

// Merge a single service's state (pushed by the content script) into storage.
async function mergeSingleQuotaState(incoming: QuotaState): Promise<void> {
  const result = await chrome.storage.local.get(['quotaStates']);
  const existing: QuotaState[] = (result['quotaStates'] as QuotaState[] | undefined) ?? [];
  const merged = upsertQuotaState(existing, incoming);
  await chrome.storage.local.set({ quotaStates: merged, lastPollAt: Date.now() });
  await afterMerge(merged);
}

function ensureAlarms(): void {
  chrome.alarms.create(POLL_ALARM, {
    delayInMinutes: 0,
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
}

// Toolbar action opens the side panel (Chrome 114+).
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => console.error('[ai-quota-tool] sidePanel setup:', err));

// Content scripts push quota data; the side panel drives GitHub connect/disconnect.
chrome.runtime.onMessage.addListener(
  (
    msg: PanelMessage,
    _sender,
    sendResponse: (response: { ok: boolean; error?: string }) => void,
  ) => {
    if (msg.type === 'content_quota' && msg.payload) {
      mergeSingleQuotaState(msg.payload).catch(console.error);
      return;
    }
    if (msg.type === 'github_connect' || msg.type === 'github_disconnect') {
      const action = msg.type === 'github_connect' ? connectGitHub : disconnectGitHub;
      action()
        .then(async () => {
          await pollAll();
          sendResponse({ ok: true });
        })
        .catch((err: unknown) => {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        });
      return true; // async sendResponse
    }
    return;
  },
);

// Top-level call runs on every SW activation (install, startup, and every alarm wake-up).
ensureAlarms();

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarms();
  // One-time cleanup of the removed V1 WS client's keepalive alarm.
  chrome.alarms.clear(LEGACY_WS_KEEPALIVE_ALARM);
  pollAll().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarms();
  pollAll().catch(console.error);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    pollAll().catch(console.error);
  } else {
    handleAlarm(alarm);
  }
});
