import type { LowQuotaArmed, PanelMessage, QuotaState, ServiceId } from '@ai-quota-tool/core';
import {
  decideLowQuotaAlerts,
  DEFAULT_ENABLED_SERVICES,
  deriveBadge,
  ENABLED_SERVICES_KEY,
  filterEnabled,
  initialLowQuotaArmed,
  mergeQuotaStates,
  resolveEnabledServices,
  upsertQuotaState,
} from '@ai-quota-tool/core';
import {
  notifyLowQuota,
  scheduleResetNotifications,
  clearResetNotifications,
  handleAlarm,
} from './notifications.js';
import {
  API_KEYS_STORAGE_KEY,
  clearServiceApiKey,
  saveServiceApiKey,
  type StoredApiKeys,
} from './api-keys.js';
import {
  connectGitHub,
  disconnectGitHub,
  trySilentGitHubReauth,
} from './github-auth.js';
import { createFetchers } from './providers.js';

const POLL_ALARM = 'quota-poll';
const POLL_INTERVAL_MINUTES = 1;
const LOW_QUOTA_ARMED_KEY = 'lowQuotaArmed';
/** Legacy V1 alarm from the removed WS client - cleared once on install. */
const LEGACY_WS_KEEPALIVE_ALARM = 'ws-keepalive';

const fetchers = createFetchers();
const copilotFetcher = fetchers.find((fetcher) => fetcher.serviceId === 'copilot');

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

async function readEnabled(): Promise<ServiceId[]> {
  const stored = await chrome.storage.local.get([ENABLED_SERVICES_KEY]);
  return resolveEnabledServices(stored[ENABLED_SERVICES_KEY]);
}

/** Merge readings into storage, keeping only providers the user turned on. */
async function storeMerged(
  merge: (existing: QuotaState[]) => QuotaState[],
  enabled: ServiceId[],
): Promise<void> {
  const stored = await chrome.storage.local.get(['quotaStates']);
  const existing: QuotaState[] = (stored['quotaStates'] as QuotaState[] | undefined) ?? [];
  const merged = filterEnabled(merge(existing), enabled);
  await chrome.storage.local.set({ quotaStates: merged, lastPollAt: Date.now() });
  await afterMerge(merged);
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
  if (!copilotFetcher) return states;
  const fresh = await copilotFetcher.fetch();
  return states.map((s) => (s.service === 'copilot' ? fresh : s));
}

async function pollAll(): Promise<void> {
  const enabled = await readEnabled();
  const active = fetchers.filter((f) => enabled.includes(f.serviceId));
  const results = await Promise.allSettled(active.map((f) => f.fetch()));

  let states: QuotaState[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      states.push(result.value);
    } else {
      console.error('[ai-quota-tool] Fetch failed:', result.reason);
    }
  }

  states = await recoverCopilotIfTokenDied(states);

  // Freshest-wins merge with content-script / prior SW readings; partial polls keep other services.
  await storeMerged((existing) => mergeQuotaStates(existing, states), enabled);
}

// Merge a single service's state (pushed by the content script) into storage.
async function mergeSingleQuotaState(incoming: QuotaState): Promise<void> {
  await storeMerged((existing) => upsertQuotaState(existing, incoming), await readEnabled());
}

// The Providers screen writes the list; drop removed providers and poll new ones.
chrome.storage.local.onChanged.addListener((changes) => {
  const change = changes[ENABLED_SERVICES_KEY];
  if (!change) return;
  const before = resolveEnabledServices(change.oldValue);
  const after = resolveEnabledServices(change.newValue);
  clearResetNotifications(before.filter((id) => !after.includes(id)));
  pollAll().catch(console.error);
});

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
    if (msg.type === 'api_key_connect' || msg.type === 'api_key_disconnect') {
      const action =
        msg.type === 'api_key_connect'
          ? saveServiceApiKey(msg.service, msg.apiKey)
          : clearServiceApiKey(msg.service);
      action
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
      return true;
    }
    return;
  },
);

// Top-level call runs on every SW activation (install, startup, and every alarm wake-up).
ensureAlarms();

/**
 * Users from before the provider list keep every provider that has a saved
 * API key. New users pick providers on the welcome screen.
 */
async function migrateEnabledServices(): Promise<void> {
  const stored = await chrome.storage.local.get([ENABLED_SERVICES_KEY, API_KEYS_STORAGE_KEY]);
  if (stored[ENABLED_SERVICES_KEY] !== undefined) return;
  const keys = (stored[API_KEYS_STORAGE_KEY] as StoredApiKeys | undefined) ?? {};
  const withKeys = Object.keys(keys) as ServiceId[];
  await chrome.storage.local.set({
    [ENABLED_SERVICES_KEY]: resolveEnabledServices([...DEFAULT_ENABLED_SERVICES, ...withKeys]),
  });
}

chrome.runtime.onInstalled.addListener(() => {
  migrateEnabledServices().catch(console.error);
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
