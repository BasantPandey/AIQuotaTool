import * as vscode from 'vscode';
import {
  applyKeyBudgets,
  defaultKeyName,
  isValidBudget,
  keyCardType,
  connectionIdOf,
  isAdminKeyService,
  isUniqueKeyName,
  KEY_SERVICES,
  normalizeApiKey,
  SERVICE_IDS,
  SERVICE_LABELS,
  type ServiceId,
} from '@ai-quota-tool/core';
import { BROWSER_PROVIDERS, geminiFromPaste } from './browser-providers.js';
import { browserSignIn, findBrowser } from './browser-signin.js';
import type { CopilotAuth } from './copilot-auth.js';
import type { CookieAccount, CredentialManager } from './credentials.js';
import type { KeyStore } from './key-store.js';
import type { QuotaPanel } from './quota-panel.js';
import type { QuotaPoller } from './quota-poller.js';
import {
  normalizeCodexSessionToken,
  validateClaudeSession,
  validateCodexSession,
  validateCursorSession,
  validateGeminiSession,
  validateGrokSession,
  validateKey,
} from './session-fetch.js';
import type {
  AccountRow,
  AccountService,
  FormStatus,
  SignInMethod,
  PanelSnapshot,
  WebviewMessage,
} from './webview/protocol.js';

const ACCOUNT_SERVICES: readonly AccountService[] = SERVICE_IDS.filter(
  (id): id is AccountService =>
    id === 'claude' || id === 'copilot' || id === 'codex' || id === 'grok' || id === 'gemini' || id === 'cursor',
);

function settings() {
  const config = vscode.workspace.getConfiguration('aiQuotaTool');
  return { browserPath: config.get<string>('browserPath', 'auto'), browserSignIn: config.get<boolean>('browserSignIn', true) };
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function userFacingSessionError(service: CookieAccount, e: unknown): string {
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
    if (service === 'cursor') return 'Cursor session invalid or expired - sign in again';
    if (service === 'gemini') return 'Google session invalid or expired - sign in again';
  }
  return msg;
}

/** Allow a paste of "sso=..." or of the raw JWT value. */
function grokSsoValue(cookie: string): string {
  return cookie.includes('=') ? (cookie.match(/(?:^|;\s*)sso=([^;]+)/i)?.[1] ?? cookie).trim() : cookie.trim();
}

/** Handles panel actions, and builds the snapshot that the panel shows. */
export class PanelController {
  /** Status text from the last sign-in in this window, for example "Connected as Jane". */
  private details = new Map<AccountService, string>();

  constructor(
    private readonly panel: QuotaPanel,
    private readonly credentials: CredentialManager,
    private readonly copilot: CopilotAuth,
    private readonly keys: KeyStore,
    private readonly poller: QuotaPoller,
    /** Non-secret extension storage (the notice flags) and a folder for the temporary browser profile. */
    private readonly storage: { state: vscode.Memento; dir: string },
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
      case 'account_browser_sign_in':
        await this.browserSignIn(msg.service);
        break;
      case 'github_sign_in':
        await this.githubSignIn();
        break;
      case 'key_add':
        await this.addKey(msg.service, msg.name, msg.value, msg.adminConfirmed);
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
    const [creds, githubToken] = await Promise.all([this.credentials.get(), this.copilot.token()]);
    const secrets: Record<AccountService, string | undefined> = { ...creds, copilot: githubToken };
    const reauth = this.poller.getReauthNeeded();
    // Copilot is connected but the VS Code GitHub session is gone: the user signs in again.
    const ended = (service: AccountService) =>
      reauth.includes(service) || (service === 'copilot' && this.copilot.isSignedIn() && !githubToken);
    const accounts = ACCOUNT_SERVICES.map((service): AccountRow => {
      const status = ended(service) ? 'ended' : !secrets[service] ? 'none' : 'connected';
      const detail = status === 'connected' ? this.details.get(service) : undefined;
      return { service, status, method: this.method(service), ...(detail != null ? { detail } : {}) };
    });
    const keys = this.keys.list();
    return { readings: applyKeyBudgets(this.poller.getLatestStates(), keys), accounts, keys };
  }

  private method(service: AccountService): SignInMethod {
    if (service === 'copilot') return 'github';
    const { browserPath, browserSignIn: on } = settings();
    return on && BROWSER_PROVIDERS[service] != null && findBrowser(browserPath) != null ? 'browser' : 'paste';
  }

  /**
   * Open a new browser profile, wait for the user, read only the named cookie, and delete the profile.
   * Before the first sign-in for a provider, a modal says what happens and links to the provider terms.
   */
  private async browserSignIn(service: AccountService): Promise<void> {
    const provider = BROWSER_PROVIDERS[service];
    if (service === 'copilot' || provider == null) return;
    const label = SERVICE_LABELS[service];
    const host = provider.target.host;
    const cookie = provider.target.names.join(' and ');
    const browser = findBrowser(settings().browserPath);
    if (browser == null) {
      this.form({ target: service, status: 'error', detail: 'No Chrome or Edge found. Set aiQuotaTool.browserPath, or paste the cookie.' });
      return;
    }
    const noticeKey = `aiQuotaTool.noticeSeen.${service}`;
    if (!this.storage.state.get<boolean>(noticeKey)) {
      const answer = await vscode.window.showInformationMessage(
        `Sign in to ${label} in a new browser window`,
        {
          modal: true,
          detail:
            `The extension opens Chrome or Edge with a new, separate profile. You sign in on the real ${host} site. The extension never sees your password.\n\n` +
            `After you click Done, it reads only the ${cookie} cookie, stores it in VS Code SecretStorage, and deletes the profile. ` +
            `It sends the cookie only to ${host}, to read your usage every 5 minutes while VS Code has focus.\n\n` +
            `Your use of ${label} follows its terms: ${provider.terms}`,
        },
        'Open browser',
      );
      if (answer !== 'Open browser') return;
      await this.storage.state.update(noticeKey, true);
    }

    this.form({ target: service, status: 'testing', detail: `Sign in to ${label} in the browser window. Then click Done in VS Code.` });
    let cookies: Record<string, string> | null;
    try {
      cookies = await browserSignIn({
        browser,
        storageDir: this.storage.dir,
        startUrl: provider.startUrl,
        target: provider.target,
        waitForUser: async (browserClosed) => {
          const choice = vscode.window.showInformationMessage(
            `Sign in to ${label} in the browser window. Then click Done.`,
            'Done',
            'Cancel',
          );
          const answer = await Promise.race([choice, browserClosed.then(() => 'Done' as const)]);
          return answer === 'Done' ? 'done' : 'cancel';
        },
      });
    } catch (e) {
      this.form({ target: service, status: 'error', detail: errorText(e) });
      return;
    }
    if (cookies == null) {
      this.form({ target: service, status: 'idle' });
      return;
    }
    const value = provider.toSecret(cookies);
    if (!value) {
      this.form({ target: service, status: 'error', detail: `No ${cookie} cookie found. Sign in fully on ${host}, then click Done. Or paste the cookie.` });
      return;
    }
    if (await this.saveAccount(service, value)) {
      void vscode.window.showInformationMessage(`Stored the ${label} session cookie in VS Code SecretStorage. The browser profile is deleted.`);
    }
  }

  private form(form: FormStatus): void {
    this.panel.post({ type: 'form_status', form });
  }

  /** Test the value with one usage call, then store it. Returns true when it is stored. */
  private async saveAccount(service: AccountService, raw: string): Promise<boolean> {
    if (service === 'copilot') return false;
    const value = service === 'grok' ? grokSsoValue(raw) : service === 'gemini' ? (geminiFromPaste(raw) ?? '') : raw.trim();
    if (!value || (service === 'codex' && !normalizeCodexSessionToken(value))) {
      this.form({ target: service, status: 'error', detail: 'The value is empty. Paste it again.' });
      return false;
    }
    this.form({ target: service, status: 'testing' });
    try {
      if (service === 'claude') {
        const name = await validateClaudeSession(value);
        await this.credentials.set('claude', value);
        this.details.set(service, `Connected as ${name}`);
      } else if (service === 'codex') {
        await validateCodexSession(value);
        // Keep the multi-line form (.0 on line 1, .1 on line 2) so the Cookie header keeps both parts.
        await this.credentials.set('codex', value);
      } else if (service === 'grok') {
        await validateGrokSession(value);
        await this.credentials.set('grok', value);
      } else if (service === 'cursor') {
        await validateCursorSession(value);
        await this.credentials.set('cursor', value);
      } else {
        await validateGeminiSession(value);
        await this.credentials.set('gemini', value);
      }
    } catch (e) {
      this.form({ target: service, status: 'error', detail: userFacingSessionError(service, e) });
      return false;
    }
    this.form({ target: service, status: 'ok' });
    this.poller.clearReauth(service);
    this.poller.pollSoon(service);
    await this.refresh();
    await this.poller.pollNow();
    return true;
  }

  private async signOut(service: AccountService): Promise<void> {
    if (service === 'copilot') await this.copilot.signOut();
    else await this.credentials.clear(service);
    this.details.delete(service);
    this.form({ target: service, status: 'idle' });
    this.poller.dropConnection(service);
    await this.refresh();
  }

  /** One VS Code consent dialog for the built-in GitHub sign-in. No device code. */
  private async githubSignIn(): Promise<void> {
    this.form({ target: 'copilot', status: 'testing' });
    try {
      await this.copilot.signIn();
    } catch {
      this.form({ target: 'copilot', status: 'error', detail: 'GitHub sign-in did not finish. Click Sign in with GitHub to try again.' });
      return;
    }
    this.form({ target: 'copilot', status: 'ok' });
    this.poller.pollSoon('copilot');
    await this.refresh();
    await this.poller.pollNow();
  }

  private async addKey(service: ServiceId, rawName: string, rawValue: string, adminConfirmed: boolean): Promise<void> {
    if (!KEY_SERVICES.includes(service)) return;
    if (isAdminKeyService(service) && !adminConfirmed) {
      this.form({ target: 'add_key', status: 'error', detail: 'Tick the box to confirm that this is an Admin key.' });
      return;
    }
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
    const key = await this.keys.add(service, name, value);
    this.poller.pollSoon(key.id);
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
