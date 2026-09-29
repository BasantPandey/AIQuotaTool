// Messages between the extension host and the panel webview. Types only: both tsconfigs import this file.
import type { QuotaState, ServiceId } from '@ai-quota-tool/core';

export type PanelTab = 'usage' | 'accounts' | 'keys';

export type AccountService = 'claude' | 'copilot' | 'codex' | 'grok';

export type AccountStatus = 'connected' | 'ended' | 'none';

export interface AccountRow {
  service: AccountService;
  status: AccountStatus;
  /** For example "Connected as Jane". */
  detail?: string;
}

export interface KeyRow {
  id: string;
  service: ServiceId;
  name: string;
  last4: string;
}

export interface PanelSnapshot {
  readings: QuotaState[];
  accounts: AccountRow[];
  keys: KeyRow[];
}

/** Progress of one form: an Account sign-in (target = service) or the add key form (target = "add_key"). */
export interface FormStatus {
  target: string;
  status: 'idle' | 'testing' | 'ok' | 'error';
  detail?: string;
}

export type HostMessage =
  | { type: 'snapshot'; snapshot: PanelSnapshot }
  | { type: 'show_tab'; tab: PanelTab }
  | { type: 'form_status'; form: FormStatus }
  | { type: 'github_device'; userCode: string | null };

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'account_save'; service: AccountService; value: string }
  | { type: 'account_sign_out'; service: AccountService }
  | { type: 'github_sign_in' }
  | { type: 'github_open' }
  | { type: 'github_cancel' }
  | { type: 'key_add'; service: ServiceId; value: string }
  | { type: 'key_remove'; id: string }
  | { type: 'open_external'; url: string };
