import type { LowQuotaAlert, QuotaState, ServiceId } from '@ai-quota-tool/core';
import { SERVICE_LABELS } from '@ai-quota-tool/core';

const ALARM_PREFIX_SESSION = 'quota-reset-session-';
const ALARM_PREFIX_WEEKLY = 'quota-reset-weekly-';
const ALARM_PREFIX_MONTHLY = 'quota-reset-monthly-';

/** Fire low-quota alerts; stable per-service IDs make repeats update, not stack. */
export function notifyLowQuota(alerts: LowQuotaAlert[]): void {
  for (const alert of alerts) {
    chrome.notifications.create(`notif-low-${alert.service}`, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title:
        alert.kind === 'balance'
          ? `${SERVICE_LABELS[alert.service]} balance empty`
          : `${SERVICE_LABELS[alert.service]} quota low`,
      message:
        alert.kind === 'balance'
          ? 'API balance is empty. Top up to keep calling the API.'
          : `Only ${Math.round(alert.pct)}% remaining in the current window.`,
    });
  }
}

export function scheduleResetNotifications(states: QuotaState[]): void {
  for (const state of states) {
    const sessionAlarmName = `${ALARM_PREFIX_SESSION}${state.service}`;
    const weeklyAlarmName = `${ALARM_PREFIX_WEEKLY}${state.service}`;

    if (state.sessionResetsAt != null && state.sessionResetsAt - Date.now() > 0) {
      chrome.alarms.create(sessionAlarmName, { when: state.sessionResetsAt });
    }
    if (state.weeklyResetsAt != null && state.weeklyResetsAt - Date.now() > 0) {
      chrome.alarms.create(weeklyAlarmName, { when: state.weeklyResetsAt });
    }
    const monthlyAlarmName = `${ALARM_PREFIX_MONTHLY}${state.service}`;
    if (state.monthlyResetsAt != null && state.monthlyResetsAt - Date.now() > 0) {
      chrome.alarms.create(monthlyAlarmName, { when: state.monthlyResetsAt });
    }
  }
}

export function clearResetNotifications(services: ServiceId[]): void {
  for (const service of services) {
    for (const prefix of [ALARM_PREFIX_SESSION, ALARM_PREFIX_WEEKLY, ALARM_PREFIX_MONTHLY]) {
      chrome.alarms.clear(`${prefix}${service}`);
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
      message: "Your session quota has refreshed - you're ready to go.",
    });
  } else if (alarm.name.startsWith(ALARM_PREFIX_WEEKLY)) {
    const service = alarm.name.slice(ALARM_PREFIX_WEEKLY.length) as ServiceId;
    chrome.notifications.create(`notif-weekly-${service}`, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: `${SERVICE_LABELS[service]} weekly quota reset`,
      message: 'Your weekly quota has refreshed - full capacity restored.',
    });
  } else if (alarm.name.startsWith(ALARM_PREFIX_MONTHLY)) {
    const service = alarm.name.slice(ALARM_PREFIX_MONTHLY.length) as ServiceId;
    chrome.notifications.create(`notif-monthly-${service}`, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: `${SERVICE_LABELS[service]} monthly quota reset`,
      message: 'Your monthly quota has refreshed.',
    });
  }
}
