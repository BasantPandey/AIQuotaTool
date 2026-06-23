import * as vscode from 'vscode';
import type { QuotaState } from '@ai-quota-tool/core';
import { QuotaWsServer } from './ws-server.js';
import { QuotaPanel } from './quota-panel.js';
import { QuotaStatusBar } from './status-bar.js';
import { CredentialManager } from './credentials.js';
import { QuotaPoller } from './quota-poller.js';
import { CredentialPanel } from './credential-panel.js';

const OPEN_PANEL_COMMAND = 'aiQuotaTool.openPanel';
const CONFIGURE_COMMAND = 'aiQuotaTool.configure';

async function getGithubToken(): Promise<string | undefined> {
  try {
    const session = await vscode.authentication.getSession('github', ['read:user'], {
      createIfNone: false,
    });
    return session?.accessToken;
  } catch {
    return undefined;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const credentials = new CredentialManager(context.secrets);
  const poller = new QuotaPoller();
  const wsServer = new QuotaWsServer();
  const panel = new QuotaPanel(context.extensionUri);
  const statusBar = new QuotaStatusBar(OPEN_PANEL_COMMAND, CONFIGURE_COMMAND);
  const credPanel = new CredentialPanel(context.extensionUri, credentials);

  // Show setup prompt if no credentials are saved yet
  credentials.hasAny().then((hasAny) => {
    if (!hasAny) statusBar.showSetupPrompt();
  }).catch(() => { /* ignore */ });

  // Standalone polling — fetches quota directly from Node.js (no Chrome needed).
  poller.start(() => credentials.get(), getGithubToken);
  poller.onUpdate((states: QuotaState[]) => {
    statusBar.update(states);
    panel.pushStates(states);
  });

  // Chrome extension push — if Chrome is running it overrides the polled data.
  wsServer.start();
  wsServer.onStateChange((states: QuotaState[]) => {
    for (const s of states) poller.merge(s);
    statusBar.update(poller.getLatestStates());
    panel.pushStates(poller.getLatestStates());
  });
  wsServer.onDisconnect(() => {
    const current = poller.getLatestStates();
    if (current.length === 0) {
      statusBar.showDisconnected();
      panel.pushStates([], true);
    }
  });

  const openCmd = vscode.commands.registerCommand(OPEN_PANEL_COMMAND, () => {
    panel.open();
    const current = poller.getLatestStates();
    panel.pushStates(current, current.length === 0);
  });

  const configureCmd = vscode.commands.registerCommand(CONFIGURE_COMMAND, async () => {
    await credPanel.open();
    // After the panel opens, re-start the poller to pick up any newly saved credentials.
    poller.stop();
    poller.start(() => credentials.get(), getGithubToken);
  });

  context.subscriptions.push(
    openCmd,
    configureCmd,
    { dispose: () => wsServer.stop() },
    { dispose: () => poller.stop() },
    { dispose: () => statusBar.dispose() },
  );
}

export function deactivate(): void {
  // cleanup handled via context.subscriptions
}
