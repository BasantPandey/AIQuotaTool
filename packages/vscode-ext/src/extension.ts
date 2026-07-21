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

  const applyStates = (states: QuotaState[]): void => {
    const reauth = poller.getReauthNeeded();
    if (reauth.length > 0) {
      statusBar.showReauthPrompt(reauth);
    } else {
      statusBar.update(states);
    }
    panel.pushStates(states, states.length === 0 && reauth.length === 0, reauth);
  };

  // Show setup prompt if no credentials are saved yet
  credentials
    .hasAny()
    .then((hasAny) => {
      if (!hasAny) statusBar.showSetupPrompt();
    })
    .catch(() => {
      /* ignore */
    });

  // Standalone polling — fetches quota directly from Node.js (no Chrome needed).
  poller.start(() => credentials.get(), getGithubToken);
  poller.onUpdate(applyStates);

  // After Save & Test (or Done), clear re-auth flag and re-poll.
  credPanel.setOnSaved((service) => {
    if (service === 'claude' || service === 'codex') {
      poller.clearReauth(service);
    }
    void poller.pollNow();
  });
  // After clear, drop that service's reading (do not leave stale healthy rings).
  credPanel.setOnCleared((service) => {
    poller.dropService(service);
    applyStates(poller.getLatestStates());
  });

  // Chrome extension push — merges into polled state (both sources coexist).
  wsServer.start();
  wsServer.onStateChange((states: QuotaState[]) => {
    for (const s of states) poller.merge(s);
  });
  wsServer.onDisconnect(() => {
    const current = poller.getLatestStates();
    if (current.length === 0) {
      // Prefer session-expired re-auth over generic setup when secrets failed auth.
      applyStates(current);
    }
  });

  const openCmd = vscode.commands.registerCommand(OPEN_PANEL_COMMAND, async () => {
    panel.open();
    // Kick a poll when opening so data is fresh after setup / long idle.
    await poller.pollNow();
    applyStates(poller.getLatestStates());
  });

  const configureCmd = vscode.commands.registerCommand(CONFIGURE_COMMAND, async () => {
    await credPanel.open();
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
