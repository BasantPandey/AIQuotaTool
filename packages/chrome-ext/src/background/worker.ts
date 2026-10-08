import type { LowQuotaArmed, PanelMessage, QuotaState, ChromeServiceId } from '@ai-quota-tool/core';
import {
  connectionIdOf,
  connectionKindOf,
  decideLowQuotaAlerts,
  DEFAULT_ENABLED_SERVICES,
  deriveBadge,
  ENABLED_SERVICES_KEY,
  filterEnabled,
  initialLowQuotaArmed,
  isUniqueKeyName,
  mergeQuotaStates,
  needsTeamId,
  resolveEnabledServices,
  serviceById,
  upsertQuotaState,
} from '@ai-quota-tool/core';
import {
  notifyLowQuota,
  scheduleResetNotifications,
  clearResetNotifications,
  handleAlarm,
} from './notifications.js';
import { addKey, cleanSecret, keysWithSecrets, listKeys, migrateLegacyKeys, removeKey, updateKey } from './api-keys.js';
import { fetchKeyReading, validateKey } from './key-fetchers.js';
import { disconnectGitHub, GITHUB_TOKEN_STORAGE_KEY } from './github-auth.js';
import { createFetchers } from './providers.js';

const POLL_ALARM = 'quota-poll';
const POLL_INTERVAL_MINUTES = 1;
const LOW_QUOTA_ARMED_KEY = 'lowQuotaArmed';
/** Legacy V1 alarm from the removed WS client - cleared once on install. */
const LEGACY_WS_KEEPALIVE_ALARM = 'ws-keepalive';

const fetchers = createFetchers();

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

async function readEnabled(): Promise<ChromeServiceId[]> {
  const stored = await chrome.storage.local.get([ENABLED_SERVICES_KEY]);
  return resolveEnabledServices(stored[ENABLED_SERVICES_KEY]);
}

/** Merge readings into storage, keeping only providers the user turned on. */
async function storeMerged(
  merge: (existing: QuotaState[]) => QuotaState[],
  enabled: ChromeServiceId[],
): Promise<void> {
  const stored = await chrome.storage.local.get(['quotaStates']);
  const existing: QuotaState[] = (stored['quotaStates'] as QuotaState[] | undefined) ?? [];
  const keyIds = new Set((await listKeys()).map((key) => key.id));
  // Plan readings follow the provider switches. A key reading stays while its key exists.
  const merged = merge(existing).filter((state) =>
    connectionKindOf(state) === 'key'
      ? keyIds.has(connectionIdOf(state))
      : serviceById(state.service).auth !== 'api_key' && filterEnabled([state], enabled).length === 1,
  );
  await chrome.storage.local.set({ quotaStates: merged, lastPollAt: Date.now() });
  await afterMerge(merged);
}

/** Side effects that follow every storage merge. */
async function afterMerge(merged: QuotaState[]): Promise<void> {
  scheduleResetNotifications(merged);
  updateBadge(merged);
  await checkLowQuota(merged);
}

async function pollAll(): Promise<void> {
  const enabled = await readEnabled();
  const active = fetchers.filter((f) => enabled.includes(f.serviceId));
  const keys = await keysWithSecrets();
  const results = await Promise.allSettled([
    ...active.map((f) => f.fetch()),
    ...keys.map(({ key, secret }) => fetchKeyReading(key, secret)),
  ]);

  const states: QuotaState[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      states.push(result.value);
    } else {
      console.error('[ai-quota-tool] Fetch failed:', result.reason);
    }
  }

  // Freshest-wins merge with content-script / prior SW readings; partial polls keep other services.
  await storeMerged((existing) => mergeQuotaStates(existing, states), enabled);
}

// Merge a single service's state (pushed by the content script) into storage.
async function mergeSingleQuotaState(incoming: QuotaState): Promise<void> {
  await storeMerged((existing) => upsertQuotaState(existing, incoming), await readEnabled());
}

// The side panel stores the GitHub token after device flow sign-in. Read Copilot at once.
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes[GITHUB_TOKEN_STORAGE_KEY]?.newValue) pollAll().catch(console.error);
});

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

// Content scripts push quota data; the side panel drives GitHub disconnect.
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
    if (msg.type === 'github_disconnect') {
      disconnectGitHub()
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
    if (msg.type === 'api_key_add' || msg.type === 'api_key_update' || msg.type === 'api_key_remove') {
      const action =
        msg.type === 'api_key_add'
          ? addCheckedKey(msg)
          : msg.type === 'api_key_update'
            ? updateCheckedKey(msg)
            : removeKeyAndReading(msg.id);
      action
        .then(() => sendResponse({ ok: true }))
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

/** Test the key with one call, then store it with its first reading. Throws a message for the user. */
async function addCheckedKey(msg: Extract<PanelMessage, { type: 'api_key_add' }>): Promise<void> {
  const secret = cleanSecret(msg.service, msg.apiKey);
  const teamId = msg.teamId?.trim() ?? '';
  if (needsTeamId(msg.service) && !teamId) throw new Error('Paste the team ID.');
  const name = msg.name.trim();
  if (name && !isUniqueKeyName(name, msg.service, await listKeys())) throw new Error('Another key for this provider has this name.');
  const draft = { id: 'draft', service: msg.service, name, last4: secret.slice(-4), ...(teamId ? { teamId } : {}) };
  const reading = await validateKey(draft, secret);
  const key = await addKey(msg.service, name, secret, teamId || undefined);
  await storeMerged((existing) => upsertQuotaState(existing, { ...reading, connectionId: key.id }), await readEnabled());
}

/** A rename saves at once. A new secret or team ID gets the test call first, and its reading replaces the old one. */
async function updateCheckedKey(msg: Extract<PanelMessage, { type: 'api_key_update' }>): Promise<void> {
  const row = (await keysWithSecrets()).find(({ key }) => key.id === msg.id);
  if (!row) throw new Error('This key is not saved any more.');
  const { key } = row;
  const name = msg.name.trim();
  if (!name) throw new Error('Type a name for the key.');
  if (!isUniqueKeyName(name, key.service, await listKeys(), key.id)) throw new Error('Another key for this provider has this name.');
  const secret = msg.apiKey?.trim() ? cleanSecret(key.service, msg.apiKey) : undefined;
  const teamId = msg.teamId?.trim();
  if (needsTeamId(key.service) && teamId === '') throw new Error('Paste the team ID.');
  const changed = secret != null || (teamId != null && teamId !== key.teamId);
  const reading = changed
    ? await validateKey({ ...key, ...(teamId ? { teamId } : {}) }, secret ?? row.secret)
    : undefined;
  await updateKey(key.id, { name, ...(secret ? { secret } : {}), ...(teamId ? { teamId } : {}) });
  if (reading) await storeMerged((existing) => upsertQuotaState(existing, { ...reading, connectionId: key.id }), await readEnabled());
}

async function removeKeyAndReading(id: string): Promise<void> {
  await removeKey(id);
  await storeMerged((existing) => existing, await readEnabled());
}

// Top-level call runs on every SW activation (install, startup, and every alarm wake-up).
ensureAlarms();

/** Users from before the provider list keep every plan provider. New users pick them on the welcome screen. */
async function migrateEnabledServices(): Promise<void> {
  const stored = await chrome.storage.local.get([ENABLED_SERVICES_KEY]);
  if (stored[ENABLED_SERVICES_KEY] !== undefined) return;
  await chrome.storage.local.set({ [ENABLED_SERVICES_KEY]: DEFAULT_ENABLED_SERVICES });
}

chrome.runtime.onInstalled.addListener(() => {
  migrateLegacyKeys()
    .then(migrateEnabledServices)
    .then(pollAll)
    .catch(console.error);
  ensureAlarms();
  // One-time cleanup of the removed V1 WS client's keepalive alarm.
  chrome.alarms.clear(LEGACY_WS_KEEPALIVE_ALARM);
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
