import type { QuotaState, ServiceId } from '@ai-quota-tool/core';
import { SERVICE_LABELS } from '@ai-quota-tool/core';

const ALARM_PREFIX_SESSION = 'quota-reset-session-';
const ALARM_PREFIX_WEEKLY = 'quota-reset-weekly-';

export function scheduleResetNotifications(states: QuotaState[]): void {
  for (const state of states) {
    const sessionAlarmName = `${ALARM_PREFIX_SESSION}${state.service}`;
    const weeklyAlarmName = `${ALARM_PREFIX_WEEKLY}${state.service}`;

    const sessionDelayMs = state.sessionResetsAt - Date.now();
    const weeklyDelayMs = state.weeklyResetsAt - Date.now();

    if (sessionDelayMs > 0) {
      chrome.alarms.create(sessionAlarmName, { when: state.sessionResetsAt });
    }
    if (weeklyDelayMs > 0) {
      chrome.alarms.create(weeklyAlarmName, { when: state.weeklyResetsAt });
    }
  }
}

export function handleAlarm(alarm: chrome.alarms.Alarm): void {
  if (alarm.name.startsWith(ALARM_PREFIX_SESSION)) {
    const service = alarm.name.slice(ALARM_PREFIX_SESSION.length) as ServiceId;
    chrome.notifications.create(`notif-session-${service}`, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: `${SERVICE_LABELS[service]} session reset`,
      message: "Your session quota has refreshed — you're ready to go.",
    });
  } else if (alarm.name.startsWith(ALARM_PREFIX_WEEKLY)) {
    const service = alarm.name.slice(ALARM_PREFIX_WEEKLY.length) as ServiceId;
    chrome.notifications.create(`notif-weekly-${service}`, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: `${SERVICE_LABELS[service]} weekly quota reset`,
      message: 'Your weekly quota has refreshed — full capacity restored.',
    });
  }
}
