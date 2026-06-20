import type { QuotaState } from '@ai-quota-tool/core';
import { ClaudeFetcher } from './fetchers/claude.js';
import { CopilotFetcher } from './fetchers/copilot.js';
import { CodexFetcher } from './fetchers/codex.js';
import { initWsClient, pushQuotaUpdate } from './ws-client.js';
import { scheduleResetNotifications, handleAlarm } from './notifications.js';

const POLL_ALARM = 'quota-poll';
const POLL_INTERVAL_MINUTES = 1;

const fetchers = [new ClaudeFetcher(), new CopilotFetcher(), new CodexFetcher()];

async function pollAll(): Promise<void> {
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

  await chrome.storage.local.set({ quotaStates: states, lastPollAt: Date.now() });
  pushQuotaUpdate(states);
  scheduleResetNotifications(states);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(POLL_ALARM, {
    delayInMinutes: 0,
    periodInMinutes: POLL_INTERVAL_MINUTES,
  });
  initWsClient();
});

chrome.runtime.onStartup.addListener(() => {
  initWsClient();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === POLL_ALARM) {
    pollAll().catch(console.error);
  } else {
    handleAlarm(alarm);
  }
});
