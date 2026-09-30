import * as vscode from 'vscode';
import type { KeyRecord, QuotaState, ServiceId } from '@ai-quota-tool/core';
import {
  connectionIdOf,
  connectionKindOf,
  describeKey,
  lowestPressureAmong,
  pressureRemaining,
  SERVICE_LABELS,
} from '@ai-quota-tool/core';

export class QuotaStatusBar {
  private item: vscode.StatusBarItem;

  constructor(
    private readonly openPanelCommand: string,
    private readonly configureCommand: string,
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = openPanelCommand;
    this.item.tooltip = 'Click to open the AI Quota Tool panel';
    this.item.text = '$(pulse) AI Quota';
    this.item.show();
  }

  /**
   * The text shows Accounts only. The tooltip lists each Key with its headline number.
   * The color counts Keys with a real percent (cap or budget) and an empty balance.
   */
  update(states: QuotaState[], keys: readonly KeyRecord[]): void {
    const parts: string[] = [];
    for (const s of states) {
      if (connectionKindOf(s) !== 'account') continue;
      const pct = pressureRemaining(s);
      if (pct != null) {
        parts.push(`${SERVICE_LABELS[s.service]} ${pct}%`);
      } else if (s.honesty === 'seat_active_usage_unknown') {
        parts.push(`${SERVICE_LABELS[s.service]} ·`);
      }
    }
    this.item.text = parts.length > 0 ? `$(pulse) ${parts.join(' | ')}` : '$(pulse) AI Quota';
    this.item.command = this.openPanelCommand;

    const keyLines = keys.map((key) => {
      const reading = states.find((s) => connectionKindOf(s) === 'key' && connectionIdOf(s) === key.id);
      return `${key.name} (${SERVICE_LABELS[key.service]}): ${describeKey(reading).headline}`;
    });
    this.item.tooltip = ['Click to open the AI Quota Tool panel', ...(keyLines.length > 0 ? ['', 'Keys:', ...keyLines] : [])].join('\n');

    const lowest = lowestPressureAmong(states);
    const emptyBalance = states.some((s) => s.honesty === 'balance_empty');
    // No percentage pressure (empty or honesty-only) is not treated as 100% remaining.
    this.item.backgroundColor =
      emptyBalance || (lowest != null && lowest < 10)
        ? new vscode.ThemeColor('statusBarItem.warningBackground')
        : undefined;
  }

  showSetupPrompt(): void {
    this.item.text = '$(key) AI Quota: Set up accounts';
    this.item.command = this.configureCommand;
    this.item.tooltip = 'Click to configure your AI service accounts';
    this.item.backgroundColor = undefined;
  }

  /** Empty dual-mode state — prefer setup over Chrome-only "not connected". */
  showDisconnected(): void {
    this.showSetupPrompt();
    this.item.tooltip =
      'No quota data yet. Set up accounts, or wait for the Chrome extension if you use it.';
  }

  /**
   * An Account session ended (401 or 403). The secret stays. A click opens the Accounts tab,
   * where the row shows "Sign in again" (decision on #88: no pop-up).
   */
  showReauthPrompt(services: ServiceId[]): void {
    const labels = services.map((s) => SERVICE_LABELS[s]).join(', ');
    this.item.text =
      services.length === 1 ? `$(key) AI Quota: ${labels} session ended` : `$(key) AI Quota: ${services.length} sessions ended`;
    this.item.command = this.configureCommand;
    this.item.tooltip = `Session ended: ${labels}. Click to open the Accounts tab and sign in again.`;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }

  dispose(): void {
    this.item.dispose();
  }
}
