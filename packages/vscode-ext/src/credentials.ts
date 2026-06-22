import * as vscode from 'vscode';

const KEY_CLAUDE_COOKIE = 'aiQuotaTool.claudeSessionKey';
const KEY_GITHUB_TOKEN = 'aiQuotaTool.githubToken';
const KEY_CODEX_COOKIE = 'aiQuotaTool.codexSessionToken';

export interface Credentials {
  claudeSessionKey: string | undefined;
  githubToken: string | undefined;
  codexSessionToken: string | undefined;
}

export class CredentialManager {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(): Promise<Credentials> {
    const [claudeSessionKey, githubToken, codexSessionToken] = await Promise.all([
      this.secrets.get(KEY_CLAUDE_COOKIE),
      this.secrets.get(KEY_GITHUB_TOKEN),
      this.secrets.get(KEY_CODEX_COOKIE),
    ]);
    return { claudeSessionKey, githubToken, codexSessionToken };
  }

  async configure(): Promise<void> {
    const claude = await vscode.window.showInputBox({
      title: 'AI Quota Tool — Claude session key',
      prompt: 'Open claude.ai → DevTools → Application → Cookies → copy the "sessionKey" value',
      password: true,
      placeHolder: 'sk-ant-sid02-…',
      ignoreFocusOut: true,
    });
    if (claude !== undefined) {
      await this.secrets.store(KEY_CLAUDE_COOKIE, claude);
    }

    const github = await vscode.window.showInputBox({
      title: 'AI Quota Tool — GitHub Personal Access Token',
      prompt: 'github.com → Settings → Developer settings → Personal access tokens (read:user scope)',
      password: true,
      placeHolder: 'ghp_…',
      ignoreFocusOut: true,
    });
    if (github !== undefined) {
      await this.secrets.store(KEY_GITHUB_TOKEN, github);
    }

    const codex = await vscode.window.showInputBox({
      title: 'AI Quota Tool — ChatGPT session token',
      prompt: 'Open chatgpt.com → DevTools → Application → Cookies → copy "__Secure-next-auth.session-token" value',
      password: true,
      placeHolder: 'eyJhbGci…',
      ignoreFocusOut: true,
    });
    if (codex !== undefined) {
      await this.secrets.store(KEY_CODEX_COOKIE, codex);
    }

    vscode.window.showInformationMessage('AI Quota Tool: credentials saved. Fetching quota now…');
  }
}
