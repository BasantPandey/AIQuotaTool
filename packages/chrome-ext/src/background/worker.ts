import type { QuotaState } from '@ai-quota-tool/core';
import { ClaudeFetcher } from './fetchers/claude.js';
import { CopilotFetcher } from './fetchers/copilot.js';
import { CodexFetcher } from './fetchers/codex.js';
import { initWsClient, pushQuotaUpdate, sendPing } from './ws-client.js';
import { scheduleResetNotifications, handleAlarm } from './notifications.js';

const POLL_ALARM = 'quota-poll';
const WS_KEEPALIVE_ALARM = 'ws-keepalive';
const POLL_INTERVAL_MINUTES = 1;

const fetchers = [new ClaudeFetcher(), new CopilotFetcher(), new CodexFetcher()];

function updateBadge(states: QuotaState[]): void {
  const lowest = Math.min(
    ...states.map((s) => Math.min(s.sessionPct ?? 100, s.weeklyPct ?? 100)),
  );
  if (lowest < 5) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#d73a49' });
  } else if (lowest < 10) {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#e3b341' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function pollAll(): Promise<void> {
  // Re-establish WS each poll — socket may be null if SW was suspended since last wake-up.
  initWsClient();

  const results = await Promise.allSettled(fetchers.map((f) => f.fetch()));

  const states: QuotaState[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      states.push(result.value);
    } else {
      console.error('[ai-quota-tool] Fetch failed:', result.reason);
    }
  }

  if (states.length === 0) return;

  // Merge with any content-script pushes already in storage so a partial SW poll
  // does not wipe a fresher Claude/Codex reading from the page context.
  const stored = await chrome.storage.local.get(['quotaStates']);
  const existing: QuotaState[] =
    (stored['quotaStates'] as QuotaState[] | undefined) ?? [];
  const byService = new Map(existing.map((s) => [s.service, s]));
  for (const s of states) byService.set(s.service, s);
  const merged = Array.from(byService.values());

  await chrome.storage.local.set({ quotaStates: merged, lastPollAt: Date.now() });
  pushQuotaUpdate(merged);
  scheduleResetNotifications(merged);
  updateBadge(merged);
}

// Merge a single service's state (pushed by the content script) into storage.
async function mergeQuotaState(incoming: QuotaState): Promise<void> {
  const result = await chrome.storage.local.get(['quotaStates']);
  const existing: QuotaState[] = (result['quotaStates'] as QuotaState[] | undefined) ?? [];
  const merged = [...existing.filter((s) => s.service !== incoming.service), incoming];
  await chrome.storage.local.set({ quotaStates: merged, lastPollAt: Date.now() });
  pushQuotaUpdate(merged);
  updateBadge(merged);
  scheduleResetNotifications([incoming]);
}

function ensureAlarms(): void {
  chrome.alarms.create(POLL_ALARM, {
    delayInMinutes: 0,
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
  chrome.alarms.create(WS_KEEPALIVE_ALARM, {
    delayInMinutes: 1,
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
}

// Content scripts on claude.ai / chatgpt.com push quota data here (bypasses CORS / bot checks).
chrome.runtime.onMessage.addListener((msg: { type: string; payload?: QuotaState }) => {
  if (msg.type === 'content_quota' && msg.payload) {
    mergeQuotaState(msg.payload).catch(console.error);
  }
});

// Top-level call runs on every SW activation (install, startup, and every alarm wake-up).
// This is the primary reconnect path after suspension clears the heap.
initWsClient();
ensureAlarms();

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarms();
  pollAll().catch(console.error);
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarms();
  pollAll().catch(console.error);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    pollAll().catch(console.error);
  } else if (alarm.name === WS_KEEPALIVE_ALARM) {
    initWsClient();
    sendPing();
  } else {
    handleAlarm(alarm);
  }
});
