import * as vscode from 'vscode';
import type { QuotaState } from '@ai-quota-tool/core';
import { SERVICE_LABELS } from '@ai-quota-tool/core';

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

    const parts = states
      .filter((s) => s.weeklyPct != null)
      .map((s) => `${SERVICE_LABELS[s.service]} ${s.weeklyPct}%`);
    this.item.text = parts.length > 0 ? `$(pulse) ${parts.join(' | ')}` : '$(pulse) AI Quota';
    this.item.command = this.openPanelCommand;

    const lowest = Math.min(...states.map((s) => s.weeklyPct ?? 100));
    this.item.color = lowest < 10 ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
  }

  showSetupPrompt(): void {
    this.item.text = '$(key) AI Quota: Set up accounts';
    this.item.command = this.configureCommand;
    this.item.tooltip = 'Click to configure your AI service accounts';
    this.item.color = undefined;
  }

  showDisconnected(): void {
    this.item.text = '$(debug-disconnect) AI Quota (not connected)';
    this.item.command = this.openPanelCommand;
    this.item.color = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  dispose(): void {
    this.item.dispose();
  }
}
