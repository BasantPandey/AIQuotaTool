import * as vscode from 'vscode';
import type { QuotaState } from '@ai-quota-tool/core';
import { QuotaWsServer } from './ws-server.js';
import { QuotaPanel } from './quota-panel.js';
import { QuotaStatusBar } from './status-bar.js';

const OPEN_PANEL_COMMAND = 'aiQuotaTool.openPanel';

export function activate(context: vscode.ExtensionContext): void {
  const wsServer = new QuotaWsServer();
  const panel = new QuotaPanel(context.extensionUri);
  const statusBar = new QuotaStatusBar(OPEN_PANEL_COMMAND);

  wsServer.start();

  wsServer.onStateChange((states: QuotaState[]) => {
    statusBar.update(states);
    panel.pushStates(states);
  });

  wsServer.onDisconnect(() => {
    statusBar.showDisconnected();
    panel.pushStates([], true);
  });

  const openCmd = vscode.commands.registerCommand(OPEN_PANEL_COMMAND, () => {
    panel.open();

    const current = wsServer.getLatestStates();
    panel.pushStates(current, current.length === 0);
  });

  context.subscriptions.push(
    openCmd,
    { dispose: () => wsServer.stop() },
    { dispose: () => statusBar.dispose() },
  );
}

export function deactivate(): void {
  // cleanup handled via context.subscriptions
}
