import * as vscode from 'vscode';
import type { CredentialManager } from './credentials.js';

// ── Validation helpers (same endpoints as quota-poller) ──────────────────────

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function testClaude(sessionKey: string): Promise<string> {
  const headers = {
    Accept: 'application/json',
    Cookie: `sessionKey=${sessionKey}`,
    'User-Agent': BROWSER_UA,
    Referer: 'https://claude.ai/',
    Origin: 'https://claude.ai',
  };
  const orgRes = await fetch('https://claude.ai/api/organizations', { headers });
  if (!orgRes.ok) throw new Error(`HTTP ${orgRes.status}`);
  const orgs = (await orgRes.json()) as Array<{ uuid: string; name?: string }>;
  const org = orgs[0];
  if (!org) throw new Error('No organisation found');
  return org.name ?? org.uuid;
}

async function testCodex(sessionToken: string): Promise<void> {
  const res = await fetch('https://chatgpt.com/backend-api/wham/usage', {
    headers: {
      Accept: 'application/json',
      Cookie: `__Secure-next-auth.session-token=${sessionToken}`,
      Referer: 'https://chatgpt.com/codex/settings/usage',
      'User-Agent': BROWSER_UA,
      Origin: 'https://chatgpt.com',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

// ── Panel host ──────────────────────────────────────────────────────────────

type WvMsg = Record<string, string>;

export class CredentialPanel {
  private panel: vscode.WebviewPanel | null = null;
  private onSaved: (() => void | Promise<void>) | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly credentials: CredentialManager,
  ) {}

  /** Called after a credential is saved successfully so the poller can refresh. */
  setOnSaved(handler: () => void | Promise<void>): void {
    this.onSaved = handler;
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
        const name = await testClaude(creds.claudeSessionKey);
        this.send('claude', 'ok', `Connected as ${name}`);
      } catch {
        this.send('claude', 'error', 'Saved key is invalid — please re-enter');
      }
    }

    if (creds.codexSessionToken) {
      this.send('codex', 'testing');
      try {
        await testCodex(creds.codexSessionToken);
        this.send('codex', 'ok', 'Connected');
      } catch {
        this.send('codex', 'error', 'Saved token is invalid — please re-enter');
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
      const name = await testClaude(key);
      await this.credentials.setClaudeKey(key);
      this.send('claude', 'ok', `Connected as ${name}`);
      this.onSaved?.();
    } catch (e) {
      this.send('claude', 'error', e instanceof Error ? e.message : String(e));
    }
  }

  private async handleSaveTestCodex(token: string): Promise<void> {
    if (!token) {
      this.send('codex', 'error', 'Token is empty');
      return;
    }
    try {
      await testCodex(token);
      await this.credentials.setCodexToken(token);
      this.send('codex', 'ok', 'Connected');
      this.onSaved?.();
    } catch (e) {
      this.send('codex', 'error', e instanceof Error ? e.message : String(e));
    }
  }

  private async handleGithubSignIn(): Promise<void> {
    try {
      const session = await vscode.authentication.getSession('github', ['read:user'], {
        createIfNone: true,
      });
      this.send('github', 'ok', `Connected as @${session.account.label}`);
      this.onSaved?.();
    } catch {
      this.send('github', 'error', 'Sign-in cancelled or failed');
    }
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
