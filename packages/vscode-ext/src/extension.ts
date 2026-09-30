import * as vscode from 'vscode';
import { applyKeyBudgets, type QuotaState } from '@ai-quota-tool/core';
import { QuotaWsServer } from './ws-server.js';
import { QuotaPanel } from './quota-panel.js';
import { QuotaStatusBar } from './status-bar.js';
import { CredentialManager } from './credentials.js';
import { KeyStore } from './key-store.js';
import { CopilotAuth } from './copilot-auth.js';
import { QuotaPoller } from './quota-poller.js';
import { PanelController } from './panel-controller.js';

const OPEN_PANEL_COMMAND = 'aiQuotaTool.openPanel';
const CONFIGURE_COMMAND = 'aiQuotaTool.configure';

export function activate(context: vscode.ExtensionContext): void {
  const credentials = new CredentialManager(context.secrets);
  const keys = new KeyStore(context.globalState, context.secrets);
  const copilot = new CopilotAuth(context.globalState);
  const poller = new QuotaPoller();
  const wsServer = new QuotaWsServer();
  const panel = new QuotaPanel(context.extensionUri);
  const statusBar = new QuotaStatusBar(OPEN_PANEL_COMMAND, CONFIGURE_COMMAND);
  const controller = new PanelController(panel, credentials, copilot, keys, poller);
  panel.onMessage((msg) => controller.handle(msg));

  const applyStates = (states: QuotaState[]): void => {
    const reauth = poller.getReauthNeeded();
    if (reauth.length > 0) {
      statusBar.showReauthPrompt(reauth);
    } else {
      const keyList = keys.list();
      statusBar.update(applyKeyBudgets(states, keyList), keyList);
    }
    if (panel.isOpen) void controller.refresh();
  };

  poller.onUpdate(applyStates);
  // Move 0.9.x API keys to named Keys before the first poll reads the Key list. Delete the old GitHub token.
  void Promise.all([keys.moveLegacy(), credentials.deleteLegacyGithubToken()])
    .catch((e: unknown) => console.error('[ai-quota-tool] key move:', e instanceof Error ? e.message : e))
    .then(async () => {
      if (!(await credentials.hasAny()) && !copilot.isSignedIn() && keys.list().length === 0) statusBar.showSetupPrompt();
      // Standalone polling — fetches quota directly from Node.js (no Chrome needed).
      poller.start({
        credentials: () => credentials.get(),
        githubToken: () => copilot.token(),
        keys: () => keys.withSecrets(),
        focused: () => vscode.window.state.focused,
      });
    });

  // Accounts poll only while VS Code has focus. Catch up when the window gets focus again.
  const focusWatch = vscode.window.onDidChangeWindowState((state) => {
    if (state.focused) void poller.pollNow();
  });

  // Chrome extension push — merges into polled state (both sources coexist).
  wsServer.start();
  wsServer.onStateChange((states: QuotaState[]) => {
    for (const s of states) poller.merge(s);
  });

  const openCmd = vscode.commands.registerCommand(OPEN_PANEL_COMMAND, async () => {
    panel.open('usage');
    // Kick a poll when opening so data is fresh after setup / long idle.
    await poller.pollNow();
  });

  const configureCmd = vscode.commands.registerCommand(CONFIGURE_COMMAND, () => {
    panel.open('accounts');
  });

  context.subscriptions.push(
    openCmd,
    configureCmd,
    focusWatch,
    { dispose: () => wsServer.stop() },
    { dispose: () => poller.stop() },
    { dispose: () => statusBar.dispose() },
  );
}

export function deactivate(): void {
  // cleanup handled via context.subscriptions
}
