import * as vscode from 'vscode';
import type { QuotaState } from '@ai-quota-tool/core';
import { SERVICE_LABELS } from '@ai-quota-tool/core';

/** Lowest defined remaining % (session or weekly); undefined if no percentages. */
function pressureRemaining(state: QuotaState): number | undefined {
  const vals: number[] = [];
  if (state.sessionPct != null) vals.push(state.sessionPct);
  if (state.weeklyPct != null) vals.push(state.weeklyPct);
  if (vals.length === 0) return undefined;
  return Math.min(...vals);
}

export class QuotaStatusBar {
  private item: vscode.StatusBarItem;

  constructor(
    private readonly openPanelCommand: string,
    private readonly configureCommand: string,
  ) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = openPanelCommand;
    this.item.tooltip = 'Click to open AI Quota Tool dashboard';
    this.item.text = '$(pulse) AI Quota';
    this.item.show();
  }

  update(states: QuotaState[]): void {
    if (states.length === 0) {
      this.item.text = '$(pulse) AI Quota';
      this.item.command = this.openPanelCommand;
      this.item.color = undefined;
      return;
    }

    const parts: string[] = [];
    for (const s of states) {
      const pct = pressureRemaining(s);
      if (pct != null) {
        parts.push(`${SERVICE_LABELS[s.service]} ${pct}%`);
      } else if (s.honesty === 'seat_active_usage_unknown') {
        parts.push(`${SERVICE_LABELS[s.service]} ·`);
      }
    }
    this.item.text = parts.length > 0 ? `$(pulse) ${parts.join(' | ')}` : '$(pulse) AI Quota';
    this.item.command = this.openPanelCommand;

    const pressures = states
      .map(pressureRemaining)
      .filter((n): n is number => n != null);
    const lowest = pressures.length > 0 ? Math.min(...pressures) : 100;
    this.item.color =
      lowest < 10 ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
  }

  showSetupPrompt(): void {
    this.item.text = '$(key) AI Quota: Set up accounts';
    this.item.command = this.configureCommand;
    this.item.tooltip = 'Click to configure your AI service accounts';
    this.item.color = undefined;
  }

  /** Empty dual-mode state — prefer setup over Chrome-only "not connected". */
  showDisconnected(): void {
    this.showSetupPrompt();
    this.item.tooltip =
      'No quota data yet. Set up accounts, or wait for the Chrome extension if you use it.';
  }

  dispose(): void {
    this.item.dispose();
  }
}
