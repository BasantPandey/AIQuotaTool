// Messages between the extension host and the panel webview. Types only: both tsconfigs import this file.
import type { KeyRecord, QuotaState, ServiceId } from '@ai-quota-tool/core';

export type PanelTab = 'usage' | 'accounts' | 'keys';

export type AccountService = 'claude' | 'copilot' | 'codex' | 'grok';

export type AccountStatus = 'connected' | 'ended' | 'none';

export interface AccountRow {
  service: AccountService;
  status: AccountStatus;
  /** For example "Connected as Jane". */
  detail?: string;
}

/** A Key as the panel sees it. It never holds the key value. */
export type KeyRow = KeyRecord;

export interface PanelSnapshot {
  readings: QuotaState[];
  accounts: AccountRow[];
  keys: KeyRow[];
}

/** Progress of one form: an Account sign-in (target = service), the add key form ("add_key"), or a Key edit ("edit:<key id>"). */
export interface FormStatus {
  target: string;
  status: 'idle' | 'testing' | 'ok' | 'error';
  detail?: string;
}

export type HostMessage =
  | { type: 'snapshot'; snapshot: PanelSnapshot }
  | { type: 'show_tab'; tab: PanelTab }
  | { type: 'form_status'; form: FormStatus };

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'account_save'; service: AccountService; value: string }
  | { type: 'account_sign_out'; service: AccountService }
  | { type: 'github_sign_in' }
  /** `adminConfirmed`: the user ticked "This is an Admin key" (needed for an Admin key provider). */
  | { type: 'key_add'; service: ServiceId; name: string; value: string; adminConfirmed: boolean }
  /** A null budget clears it. */
  | { type: 'key_update'; id: string; name: string; budget: number | null }
  | { type: 'key_remove'; id: string }
  | { type: 'open_external'; url: string };
