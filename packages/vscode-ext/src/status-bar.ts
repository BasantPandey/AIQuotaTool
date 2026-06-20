import * as vscode from 'vscode';
import type { QuotaState } from '@ai-quota-tool/core';
import { SERVICE_LABELS } from '@ai-quota-tool/core';

export class QuotaStatusBar {
  private item: vscode.StatusBarItem;

  constructor(command: string) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = command;
    this.item.tooltip = 'Click to open AI Quota Tool dashboard';
    this.item.text = '$(pulse) AI Quota';
    this.item.show();
  }

  update(states: QuotaState[]): void {
    if (states.length === 0) {
      this.item.text = '$(pulse) AI Quota';
      return;
    }

    const parts = states.map((s) => `${SERVICE_LABELS[s.service]} ${s.weeklyPct}%`);
    this.item.text = `$(pulse) ${parts.join(' | ')}`;

    const lowest = Math.min(...states.map((s) => s.weeklyPct));
    this.item.color = lowest < 10 ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined;
  }

  showDisconnected(): void {
    this.item.text = '$(debug-disconnect) AI Quota (not connected)';
    this.item.color = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  dispose(): void {
    this.item.dispose();
  }
}
