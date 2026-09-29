import * as vscode from 'vscode';
import { type DeviceCode, pollDeviceToken, requestDeviceCode, SERVICE_IDS, SERVICE_LABELS } from '@ai-quota-tool/core';
import type { CredentialManager } from './credentials.js';
import type { QuotaPanel } from './quota-panel.js';
import type { QuotaPoller } from './quota-poller.js';
import {
  normalizeCodexSessionToken,
  validateClaudeSession,
  validateCodexSession,
  validateDeepSeekApiKey,
  validateGrokSession,
  validateKimiApiKey,
} from './session-fetch.js';
import type {
  AccountRow,
  AccountService,
  FormStatus,
  KeyRow,
  PanelSnapshot,
  WebviewMessage,
} from './webview/protocol.js';

const ACCOUNT_SERVICES: readonly AccountService[] = SERVICE_IDS.filter(
  (id): id is AccountService => id === 'claude' || id === 'copilot' || id === 'codex' || id === 'grok',
);

async function postJson(url: string, body: Record<string, string>): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function abortableSleep(signal: AbortSignal): (ms: number) => Promise<boolean> {
  return (ms) =>
    new Promise((resolve) => {
      if (signal.aborted) return resolve(false);
      const timer = setTimeout(() => resolve(!signal.aborted), ms);
      signal.addEventListener('abort', () => (clearTimeout(timer), resolve(false)), { once: true });
    });
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function userFacingSessionError(service: 'claude' | 'codex' | 'grok', e: unknown): string {
  const msg = errorText(e);
  if (service === 'codex') {
    // Prefer detailed Codex/ChatGPT guidance (accessToken / chunk cookies / Cloudflare).
    if (/accessToken|cookie not accepted|\.0|\.1|Cloudflare|Cookie header/i.test(msg)) {
      return msg;
    }
    if (/\b401\b|\b403\b|invalid or expired/i.test(msg)) {
      return (
        'ChatGPT session rejected. Double-click cookie Values (not truncated …). ' +
        'Paste .0 on line 1 and .1 on line 2, or paste the full Cookie header from Network → api/auth/session.'
      );
    }
    return msg;
  }
  if (/\b401\b|\b403\b|invalid or expired/i.test(msg)) {
    if (service === 'claude') return 'Session key invalid or expired - paste a fresh sessionKey cookie';
    if (service === 'grok') return 'sso cookie invalid or expired - paste a fresh sso cookie from grok.com';
  }
  return msg;
}

/** Allow a paste of "sso=..." or of the raw JWT value. */
function grokSsoValue(cookie: string): string {
  return cookie.includes('=') ? (cookie.match(/(?:^|;\s*)sso=([^;]+)/i)?.[1] ?? cookie).trim() : cookie.trim();
}

/** Handles panel actions, and builds the snapshot that the panel shows. */
export class PanelController {
  /** Running GitHub device flow. Cancel, a new sign-in, or a sign-out aborts it. */
  private githubAbort: AbortController | null = null;
  private githubCode: DeviceCode | null = null;
  /** Status text from the last sign-in in this window, for example "Connected as Jane". */
  private details = new Map<AccountService, string>();

  constructor(
    private readonly panel: QuotaPanel,
    private readonly credentials: CredentialManager,
    private readonly poller: QuotaPoller,
  ) {}

  async refresh(): Promise<void> {
    this.panel.pushSnapshot(await this.snapshot());
  }

  async handle(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        await this.refresh();
        break;
      case 'account_save':
        await this.saveAccount(msg.service, msg.value);
        break;
      case 'account_sign_out':
        await this.signOut(msg.service);
        break;
      case 'github_sign_in':
        await this.githubSignIn();
        break;
      case 'github_open':
        if (this.githubCode) {
          await vscode.env.clipboard.writeText(this.githubCode.userCode);
          await vscode.env.openExternal(vscode.Uri.parse(this.githubCode.verificationUri));
        }
        break;
      case 'github_cancel':
        this.githubAbort?.abort();
        this.form({ target: 'copilot', status: 'idle' });
        break;
      case 'key_add':
        await this.addKey(msg.service, msg.value);
        break;
      case 'key_remove':
        await this.removeKey(msg.id);
        break;
      case 'open_external':
        if (/^https:\/\//.test(msg.url)) await vscode.env.openExternal(vscode.Uri.parse(msg.url));
        break;
    }
  }

  private async snapshot(): Promise<PanelSnapshot> {
    const [creds, githubToken] = await Promise.all([this.credentials.get(), this.credentials.getGithubToken()]);
    const secrets: Record<AccountService, string | undefined> = {
      claude: creds.claudeSessionKey,
      copilot: githubToken,
      codex: creds.codexSessionToken,
      grok: creds.grokSsoCookie,
    };
    const reauth = this.poller.getReauthNeeded();
    const accounts = ACCOUNT_SERVICES.map((service): AccountRow => {
      const status = !secrets[service] ? 'none' : reauth.includes(service) ? 'ended' : 'connected';
      const detail = status === 'connected' ? this.details.get(service) : undefined;
      return { service, status, ...(detail != null ? { detail } : {}) };
    });
    const keys: KeyRow[] = [];
    for (const [service, value] of [
      ['deepseek', creds.deepseekApiKey],
      ['kimi', creds.kimiApiKey],
    ] as const) {
      if (value) keys.push({ id: service, service, name: `${SERVICE_LABELS[service]} key 1`, last4: value.slice(-4) });
    }
    return { readings: this.poller.getLatestStates(), accounts, keys };
  }

  private form(form: FormStatus): void {
    this.panel.post({ type: 'form_status', form });
  }

  private async saveAccount(service: AccountService, raw: string): Promise<void> {
    if (service === 'copilot') return;
    const value = service === 'grok' ? grokSsoValue(raw) : raw.trim();
    if (!value || (service === 'codex' && !normalizeCodexSessionToken(value))) {
      this.form({ target: service, status: 'error', detail: 'The value is empty. Paste it again.' });
      return;
    }
    this.form({ target: service, status: 'testing' });
    try {
      if (service === 'claude') {
        const name = await validateClaudeSession(value);
        await this.credentials.setClaudeKey(value);
        this.details.set(service, `Connected as ${name}`);
      } else if (service === 'codex') {
        await validateCodexSession(value);
        // Keep the multi-line form (.0 on line 1, .1 on line 2) so the Cookie header keeps both parts.
        await this.credentials.setCodexToken(value);
      } else {
        await validateGrokSession(value);
        await this.credentials.setGrokSso(value);
      }
    } catch (e) {
      this.form({ target: service, status: 'error', detail: userFacingSessionError(service, e) });
      return;
    }
    this.form({ target: service, status: 'ok' });
    this.poller.clearReauth(service);
    await this.refresh();
    await this.poller.pollNow();
  }

  private async signOut(service: AccountService): Promise<void> {
    if (service === 'claude') await this.credentials.clearClaudeKey();
    else if (service === 'codex') await this.credentials.clearCodexToken();
    else if (service === 'grok') await this.credentials.clearGrokSso();
    else {
      this.githubAbort?.abort();
      await this.credentials.clearGithubToken();
    }
    this.details.delete(service);
    this.form({ target: service, status: 'idle' });
    this.poller.dropService(service);
    await this.refresh();
  }

  /** GitHub device flow: show the code in the webview, poll until the user approves, store the token. */
  private async githubSignIn(): Promise<void> {
    this.githubAbort?.abort();
    const abort = new AbortController();
    this.githubAbort = abort;
    this.form({ target: 'copilot', status: 'testing' });
    try {
      const code = await requestDeviceCode(postJson);
      this.githubCode = code;
      this.panel.post({ type: 'github_device', userCode: code.userCode });
      const token = await pollDeviceToken(code, { post: postJson, sleep: abortableSleep(abort.signal), now: Date.now });
      if (token == null) return;
      await this.credentials.setGithubToken(token);
      this.form({ target: 'copilot', status: 'ok' });
      await this.refresh();
      await this.poller.pollNow();
    } catch (e) {
      if (!abort.signal.aborted) {
        this.form({ target: 'copilot', status: 'error', detail: errorText(e) || 'GitHub sign-in failed. Try again.' });
      }
    } finally {
      if (this.githubAbort === abort) {
        this.githubAbort = null;
        this.githubCode = null;
        this.panel.post({ type: 'github_device', userCode: null });
      }
    }
  }

  private async addKey(service: string, raw: string): Promise<void> {
    const value = raw.trim();
    if (service !== 'deepseek' && service !== 'kimi') return;
    if (!value) {
      this.form({ target: 'add_key', status: 'error', detail: 'The API key is empty.' });
      return;
    }
    this.form({ target: 'add_key', status: 'testing' });
    try {
      if (service === 'deepseek') {
        await validateDeepSeekApiKey(value);
        await this.credentials.setDeepSeekApiKey(value);
      } else {
        await validateKimiApiKey(value);
        await this.credentials.setKimiApiKey(value);
      }
    } catch (e) {
      this.form({ target: 'add_key', status: 'error', detail: errorText(e) });
      return;
    }
    this.form({ target: 'add_key', status: 'ok' });
    await this.refresh();
    await this.poller.pollNow();
  }

  private async removeKey(id: string): Promise<void> {
    if (id === 'deepseek') await this.credentials.clearDeepSeekApiKey();
    else if (id === 'kimi') await this.credentials.clearKimiApiKey();
    else return;
    this.poller.dropService(id);
    await this.refresh();
  }
}
