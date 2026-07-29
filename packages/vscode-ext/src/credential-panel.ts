import * as vscode from 'vscode';
import type { CredentialManager } from './credentials.js';
import { validateClaudeSession, validateCodexSession } from './session-fetch.js';

// ── Panel host ──────────────────────────────────────────────────────────────

type WvMsg = Record<string, string>;

function userFacingSessionError(service: 'claude' | 'codex', e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/\b401\b|\b403\b|invalid or expired/i.test(msg)) {
    return service === 'claude'
      ? 'Session key invalid or expired — paste a fresh sessionKey cookie'
      : 'Session token invalid or expired — paste a fresh session cookie';
  }
  return msg;
}


export type SavedCredentialService = 'claude' | 'codex' | 'github';

export class CredentialPanel {
  private panel: vscode.WebviewPanel | null = null;
  private onSaved: ((service?: SavedCredentialService) => void | Promise<void>) | null = null;
  private onCleared: ((service: 'claude' | 'codex') => void | Promise<void>) | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly credentials: CredentialManager,
  ) {}

  /** Called after a credential is saved successfully so the poller can refresh. */
  setOnSaved(handler: (service?: SavedCredentialService) => void | Promise<void>): void {
    this.onSaved = handler;
  }

  /** Called after a secret is cleared so the host can drop that service's quota state. */
  setOnCleared(handler: (service: 'claude' | 'codex') => void | Promise<void>): void {
    this.onCleared = handler;
  }

  async open(): Promise<void> {
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'aiQuotaTool.credentialSetup',
      'AI Quota Tool — Set Up Accounts',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
        retainContextWhenHidden: true,
      },
    );

    this.panel.webview.html = this.buildHtml();

    this.panel.webview.onDidReceiveMessage(async (msg: WvMsg) => {
      switch (msg['type']) {
        case 'credential_setup_ready':
          await this.sendInitialStatus();
          break;
        case 'save_test_claude':
          await this.handleSaveTestClaude(msg['key'] ?? '');
          break;
        case 'save_test_codex':
          await this.handleSaveTestCodex(msg['token'] ?? '');
          break;
        case 'github_signin':
          await this.handleGithubSignIn();
          break;
        case 'clear_claude':
          await this.handleClearClaude();
          break;
        case 'clear_codex':
          await this.handleClearCodex();
          break;
        case 'open_external':
          if (msg['url']) await vscode.env.openExternal(vscode.Uri.parse(msg['url']));
          break;
        case 'close_panel':
          this.panel?.dispose();
          // Await refresh so the dashboard is not empty for ~60s after setup.
          await this.onSaved?.();
          await vscode.commands.executeCommand('aiQuotaTool.openPanel');
          break;
      }
    });

    this.panel.onDidDispose(() => {
      this.panel = null;
    });
  }

  private send(service: string, status: string, detail = ''): void {
    this.panel?.webview.postMessage({ type: 'credential_status', service, status, detail });
  }

  private async sendInitialStatus(): Promise<void> {
    const creds = await this.credentials.get();

    if (creds.claudeSessionKey) {
      this.send('claude', 'testing');
      try {
        const name = await validateClaudeSession(creds.claudeSessionKey);
        this.send('claude', 'ok', `Connected as ${name}`);
      } catch {
        this.send(
          'claude',
          'error',
          'Session invalid or expired — paste a fresh sessionKey or Clear saved key',
        );
      }
    }

    if (creds.codexSessionToken) {
      this.send('codex', 'testing');
      try {
        await validateCodexSession(creds.codexSessionToken);
        this.send('codex', 'ok', 'Connected');
      } catch {
        this.send(
          'codex',
          'error',
          'Session invalid or expired — paste a fresh session cookie or Clear saved key',
        );
      }
    }

    try {
      const session = await vscode.authentication.getSession('github', ['read:user'], {
        createIfNone: false,
      });
      if (session) this.send('github', 'ok', `Connected as @${session.account.label}`);
    } catch {
      // not signed in — stay in idle state
    }
  }

  private async handleSaveTestClaude(key: string): Promise<void> {
    if (!key) {
      this.send('claude', 'error', 'Key is empty');
      return;
    }
    try {
      const name = await validateClaudeSession(key);
      await this.credentials.setClaudeKey(key);
      this.send('claude', 'ok', `Connected as ${name}`);
      await this.onSaved?.('claude');
    } catch (e) {
      this.send('claude', 'error', userFacingSessionError('claude', e));
    }
  }

  private async handleSaveTestCodex(token: string): Promise<void> {
    if (!token) {
      this.send('codex', 'error', 'Token is empty');
      return;
    }
    try {
      await validateCodexSession(token);
      await this.credentials.setCodexToken(token);
      this.send('codex', 'ok', 'Connected');
      await this.onSaved?.('codex');
    } catch (e) {
      this.send('codex', 'error', userFacingSessionError('codex', e));
    }
  }

  private async handleGithubSignIn(): Promise<void> {
    try {
      const session = await vscode.authentication.getSession('github', ['read:user'], {
        createIfNone: true,
      });
      this.send('github', 'ok', `Connected as @${session.account.label}`);
      await this.onSaved?.('github');
    } catch {
      this.send('github', 'error', 'Sign-in cancelled or failed');
    }
  }

  private async handleClearClaude(): Promise<void> {
    await this.credentials.clearClaudeKey();
    this.send('claude', 'idle', '');
    await this.onCleared?.('claude');
  }

  private async handleClearCodex(): Promise<void> {
    await this.credentials.clearCodexToken();
    this.send('codex', 'idle', '');
    await this.onCleared?.('codex');
  }

  private buildHtml(): string {
    const webview = this.panel!.webview;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'credential-setup.js'),
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--vscode-editor-background); font-family: var(--vscode-font-family); }
    code { font-family: var(--vscode-editor-font-family); background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 3px; font-size: 0.9em; }
  </style>
  <title>AI Quota Tool — Setup</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
