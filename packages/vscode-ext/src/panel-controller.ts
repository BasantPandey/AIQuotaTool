import * as vscode from 'vscode';
import {
  applyKeyBudgets,
  type DeviceCode,
  defaultKeyName,
  isValidBudget,
  keyCardType,
  connectionIdOf,
  isUniqueKeyName,
  KEY_SERVICES,
  normalizeApiKey,
  pollDeviceToken,
  requestDeviceCode,
  SERVICE_IDS,
  SERVICE_LABELS,
  type ServiceId,
} from '@ai-quota-tool/core';
import type { CredentialManager } from './credentials.js';
import type { KeyStore } from './key-store.js';
import type { QuotaPanel } from './quota-panel.js';
import type { QuotaPoller } from './quota-poller.js';
import {
  normalizeCodexSessionToken,
  validateClaudeSession,
  validateCodexSession,
  validateGrokSession,
  validateKey,
} from './session-fetch.js';
import type {
  AccountRow,
  AccountService,
  FormStatus,
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
    private readonly keys: KeyStore,
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
        await this.addKey(msg.service, msg.name, msg.value);
        break;
      case 'key_update':
        await this.updateKey(msg.id, msg.name, msg.budget);
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
    const keys = this.keys.list();
    return { readings: applyKeyBudgets(this.poller.getLatestStates(), keys), accounts, keys };
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
    this.poller.dropConnection(service);
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

  private async addKey(service: ServiceId, rawName: string, rawValue: string): Promise<void> {
    if (!KEY_SERVICES.includes(service)) return;
    const existing = this.keys.list();
    const name = rawName.trim() || defaultKeyName(SERVICE_LABELS[service], existing.filter((k) => k.service === service).map((k) => k.name));
    const value = normalizeApiKey(rawValue);
    if (!isUniqueKeyName(name, service, existing)) {
      this.form({ target: 'add_key', status: 'error', detail: `A ${SERVICE_LABELS[service]} key with this name exists. Type a different name.` });
      return;
    }
    if (value == null) {
      this.form({ target: 'add_key', status: 'error', detail: 'This does not look like an API key. Paste the full key on one line.' });
      return;
    }
    this.form({ target: 'add_key', status: 'testing' });
    try {
      await validateKey(service, value);
    } catch (e) {
      this.form({ target: 'add_key', status: 'error', detail: errorText(e) });
      return;
    }
    await this.keys.add(service, name, value);
    this.form({ target: 'add_key', status: 'ok' });
    await this.refresh();
    await this.poller.pollNow();
  }

  private async updateKey(id: string, rawName: string, budget: number | null): Promise<void> {
    const target = `edit:${id}`;
    const key = this.keys.list().find((k) => k.id === id);
    if (!key) return;
    const name = rawName.trim();
    if (!name) {
      this.form({ target, status: 'error', detail: 'Type a name.' });
      return;
    }
    if (!isUniqueKeyName(name, key.service, this.keys.list(), id)) {
      this.form({ target, status: 'error', detail: `A ${SERVICE_LABELS[key.service]} key with this name exists.` });
      return;
    }
    if (budget != null) {
      const reading = this.poller.getLatestStates().find((s) => connectionIdOf(s) === id);
      if (reading == null || keyCardType(reading) !== 'spend') {
        this.form({ target, status: 'error', detail: 'Only a Spend only Key can have a budget.' });
        return;
      }
      if (!isValidBudget(budget)) {
        this.form({ target, status: 'error', detail: 'Type a budget that is more than 0.' });
        return;
      }
    }
    await this.keys.update(id, name, budget ?? undefined);
    this.form({ target, status: 'ok' });
    this.poller.emit();
    await this.refresh();
  }

  private async removeKey(id: string): Promise<void> {
    const key = this.keys.list().find((k) => k.id === id);
    if (!key) return;
    const answer = await vscode.window.showWarningMessage(
      `Remove the key "${key.name}"?`,
      { modal: true, detail: 'This deletes the key from VS Code SecretStorage. To use it again, add it again.' },
      'Remove',
    );
    if (answer !== 'Remove') return;
    await this.keys.remove(id);
    this.poller.dropConnection(id);
    await this.refresh();
  }
}
