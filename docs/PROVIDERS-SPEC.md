# Providers, Accounts, and Keys - AI Quota Tool for VS Code

**Status:** **Built, except two open points.** Section 14 lists them. Each open point in this file says **Open** and links its ticket. Real-account results from 2026-09-30 are in section 15.  
**Path:** `docs/PROVIDERS-SPEC.md`  
**Map:** [Wayfinder: VS Code Accounts and Keys for all providers](https://github.com/BasantPandey/AIQuotaTool/issues/84)  
**Product:** `packages/vscode-ext` only. Pure logic goes in `packages/core`. Display parts go in `packages/ui`.

**Sources (decisions live on tickets; this file assembles them):**

| Ticket | Role |
| --- | --- |
| [Browser sign-in window from VS Code](https://github.com/BasantPandey/AIQuotaTool/issues/85) | Two-phase browser sign-in |
| [Account provider data sources](https://github.com/BasantPandey/AIQuotaTool/issues/86) | Account endpoints and verdicts |
| [Key usage and balance APIs](https://github.com/BasantPandey/AIQuotaTool/issues/87) | Key endpoints and verdicts |
| [How Keys show](https://github.com/BasantPandey/AIQuotaTool/issues/89) | Key cards, budget, status bar, Key data model |
| [Accounts and Keys screen](https://github.com/BasantPandey/AIQuotaTool/issues/90) | Panel with three tabs |
| [Copilot usage endpoint](https://github.com/BasantPandey/AIQuotaTool/issues/96) | Copilot Account source and token |
| [Marketplace rules for browser sign-in](https://github.com/BasantPandey/AIQuotaTool/issues/97) | Disclosure, privacy, code rules |

Research notes (on `research/*` branches):
[vscode-browser-sign-in.md](https://github.com/BasantPandey/AIQuotaTool/blob/research/vscode-browser-sign-in/docs/research/vscode-browser-sign-in.md),
[account-provider-sources.md](https://github.com/BasantPandey/AIQuotaTool/blob/research/account-provider-sources/docs/research/account-provider-sources.md),
[key-usage-apis.md](https://github.com/BasantPandey/AIQuotaTool/blob/research/key-usage-apis/docs/research/key-usage-apis.md),
[copilot-usage-endpoint.md](https://github.com/BasantPandey/AIQuotaTool/blob/research/copilot-usage-endpoint/docs/research/copilot-usage-endpoint.md),
[marketplace-browser-sign-in.md](https://github.com/BasantPandey/AIQuotaTool/blob/research/marketplace-browser-sign-in/docs/research/marketplace-browser-sign-in.md).  
Prototype: branch [`prototype/accounts-keys`](https://github.com/BasantPandey/AIQuotaTool/tree/prototype/accounts-keys).

**Not this document:** the Chrome extension; password forms; reading CLI credential files; more than one Account for each provider.

---

## 1. Product story

Today the user copies a session cookie from browser DevTools and pastes it into VS Code. This is slow and hard. This release removes that step.

The extension shows two kinds of connection. They are separate in the UI and in the data model.

| Term | Meaning | Example | Shows |
| --- | --- | --- | --- |
| **Account** | A consumer plan on the provider website | Claude Max, ChatGPT Plus | Plan limits: session, weekly, or monthly percent left |
| **Key** | An API key that the user adds and names | "Work org" Anthropic Admin key | Balance, spend with a limit, or spend only |

Rules:

- Each provider has **one Account** and **many named Keys**.
- An Account signs in on the real provider website, in a real browser window. The user can use Google sign-in, 2FA, or a passkey. The extension never sees the password.
- A provider ships only if it has a data source with real numbers.
- **Never invent remaining percent.** Never show 100% when the number is not known.

---

## 2. Provider catalog

Verdict words: **Ship**, **Ship (high risk)**, **Opt-in** (Admin key only), **Blocked** (waits for a ticket), **No-ship**.

### 2.1 Accounts

| Provider | Sign-in | Credential | Windows | Verdict |
| --- | --- | --- | --- | --- |
| Claude | Browser window | Cookie `sessionKey` on `claude.ai` | Session (5 h), weekly, weekly per model | **Ship** |
| ChatGPT / Codex | Browser window | Cookie `__Secure-next-auth.session-token` (can be split in `.0` and `.1`) on `chatgpt.com` | Session (5 h), weekly | **Ship** |
| Copilot | VS Code built-in GitHub sign-in | `vscode.authentication.getSession('github', ['read:user'])` | Premium requests, chat, completions (monthly) | **Ship** |
| Cursor | Browser window (sign-in goes through `accounts.x.ai`) | Cookie `WorkosCursorSessionToken` on `cursor.com` | Monthly, per pool | **Ship** |
| Perplexity | Browser window | Cookie `__Secure-next-auth.session-token` or `__Secure-authjs.session-token` on `www.perplexity.ai` | Monthly credits | **No-ship** (for now): Cloudflare blocks every Node request, and the credits endpoint gives 404 ([#112](https://github.com/BasantPandey/AIQuotaTool/issues/112)) |
| Grok | Browser window | Cookies `sso` and `sso-rw` on `grok.com` | Short rolling window | **Ship** (session window only) |
| Windsurf | Browser window | The sign-in moved to Devin (`app.devin.ai`, `auth1_session`). The research values no longer exist. | Daily, weekly | **No-ship** (for now): no working auth for GetPlanStatus ([#113](https://github.com/BasantPandey/AIQuotaTool/issues/113)) |
| Gemini | Browser window | Google cookies `__Secure-1PSID`, `__Secure-1PSIDTS`, `__Secure-1PSIDCC` | Session (5 h), weekly | **Ship (high risk)** - see section 12 |
| Kiro | - | Only known auth reads CLI credential files | - | **No-ship** |

### 2.2 Keys

| Provider | Key type | Card type | Scope label | Verdict |
| --- | --- | --- | --- | --- |
| OpenRouter | Normal key | Spend with a limit, or Spend only when the key has no limit | Per key | **Ship** |
| DeepSeek | Normal key | Balance | "account balance" | **Ship** (built) |
| Kimi (Moonshot) | Normal key | Balance | "account balance" | **Ship** (built) |
| Anthropic | Admin key only | Spend only | "org spend" | **Opt-in** |
| OpenAI | Admin key only | Spend only | "org spend" | **Opt-in** |
| Mistral | Admin key only | - | - | **No-ship** (for now): the documented Admin API gives no limit amount and no total cost ([#108](https://github.com/BasantPandey/AIQuotaTool/issues/108)) |
| xAI | Management key only | Balance | "team balance" | **Blocked** - [Check xAI and Z.ai key numbers](https://github.com/BasantPandey/AIQuotaTool/issues/92) |
| Z.ai (GLM Coding Plan) | Normal key | Percent (5 h tokens, monthly MCP) | Account | **Blocked** - [Check xAI and Z.ai key numbers](https://github.com/BasantPandey/AIQuotaTool/issues/92) |
| Groq | - | - | - | **No-ship** (headers only on paid calls) |
| Google AI Studio | - | - | - | **No-ship** (no API) |

---

## 3. Account sign-in (browser window)

### 3.1 Flow

1. The user clicks **Sign in** on the Accounts tab.
2. Before the first sign-in for a provider, the extension shows a modal. The modal names the provider and says what happens (section 11.3). Buttons: **Open browser**, **Cancel**.
3. **Phase 1.** The extension starts Chrome or Edge with a new, empty `--user-data-dir` in the extension storage folder. It passes **no debug flag**. It opens the provider sign-in page.
4. The user signs in on the real site.
5. The user clicks **Done** in a VS Code notification, or closes the browser window.
6. The extension closes the browser gracefully (Windows: `taskkill /PID <pid>` with no `/F`; macOS and Linux: `SIGTERM`).
7. **Phase 2.** The extension starts the same profile with `--headless --remote-debugging-pipe`. It reads the named cookie with `Storage.getCookies`, or the named `localStorage` keys with `DOMStorage.getDOMStorageItems` on a stubbed frame. Phase 2 makes no network request.
8. The extension closes the browser and deletes the profile folder in a `finally` path. It also deletes it on error or cancel.
9. The extension stores only the named value in SecretStorage. It makes one usage call to test it. It shows "Connected" or an error.

### 3.2 Why two phases

Every debug flag sets `navigator.webdriver` to true. Google then blocks sign-in with "This browser or app may not be secure". Phase 1 has no debug flag, so sign-in works. Do not use a flag that hides the automation signal.

### 3.3 Rules

- Start a browser only from an explicit user command. No start on activation.
- Use only a profile folder that the extension made. Never pass the default profile. Never read the user's own browser.
- Read only the named cookie for the named domain. Drop all other cookies after the read.
- Never log a cookie or token value, also not in error messages.
- Send each value only to a fixed host list (section 4). No host from settings or from the network.
- No new npm dependency. Raw CDP over the pipe is about 40 lines of Node. It needs no WebSocket and works on Node 20 (VS Code 1.95).
- `package.json` gets `"extensionKind": ["ui", "workspace"]`, so the browser starts on the user's own computer in remote sessions.
- macOS does not quit the browser when the window closes. The **Done** button must close it.

### 3.4 Settings

- `aiQuotaTool.browserPath`: `auto` (default: find Chrome, then Edge) or a full path.
- `aiQuotaTool.browserSignIn`: `true` (default). `false` hides the browser button and shows the paste path only.

### 3.5 Paste fallback

The paste path stays for every browser-window provider, as **Paste instead** on the Accounts tab. It uses the same test call and the same disclosure. A pasted Cookie header keeps only the named cookies. When `aiQuotaTool.browserSignIn` is `false`, or no Chrome or Edge is found, the paste path is the only path.

### 3.6 Copilot

- The extension calls `vscode.authentication.getSession('github', ['read:user'], { createIfNone: true })`. The user sees one VS Code consent dialog. No device code.
- Our own device-flow token does not work with `copilot_internal/user`. GitHub accepts only tokens from its own apps. The VS Code extension drops its own device flow. The Chrome extension keeps it.

---

## 4. Account data sources

| Provider | Request | Host list | Mapper notes |
| --- | --- | --- | --- |
| Claude | `GET /api/organizations`, then `GET /api/organizations/{orgId}/usage` | `claude.ai` | `mapClaudeUsage`. `five_hour`, `seven_day`, and `resets_at` can be null (fixed in PR #95). |
| ChatGPT / Codex | `GET /api/auth/session` (gets `accessToken`), then `GET /backend-api/wham/usage` with Bearer | `chatgpt.com` | `mapCodexUsage`. `reset_at` is Unix seconds. A window of one day or more is weekly (fixed in PR #95). |
| Copilot | `GET /copilot_internal/user` with Bearer | `api.github.com` | `mapCopilotUser`. Read `quota_snapshots.{premium_interactions, chat, completions}`: `percent_remaining`, `unlimited`, `entitlement` (number or string), `quota_reset_at` (Unix seconds; **0 means not set**, then use `quota_reset_date_utc`). Unlimited: show "N AI credits used". 404 or unknown shape: fall back to the seat check. |
| Cursor | `GET /api/usage-summary` | `cursor.com` | Existing mapper. Lowest pool wins. |
| Perplexity | `GET /rest/billing/credits?version=2.18&source=default` with `Origin` and `Referer` headers | `www.perplexity.ai` | New mapper. Monthly percent = recurring used / recurring grant. No percent for query limits. |
| Grok | `POST /rest/rate-limits` | `grok.com` | `mapGrokRateLimits`. Test `modelName` values `fast`, `thinking`, `heavy` and the older `grok-3` before the build. No weekly pool on cookie only. |
| Windsurf | `POST /_backend/exa.seat_management_pb.SeatManagementService/GetPlanStatus` (Connect RPC, protobuf) | `windsurf.com` | New mapper. `daily_quota_remaining_percent`, `weekly_quota_remaining_percent`, reset times in Unix seconds. Protobuf field numbers are not official. |
| Gemini | `POST /_/BardChatUi/data/batchexecute?rpcids=jSf9Qc` with page tokens `SNlM0e` and `cfb2h` | `gemini.google.com` | Existing mapper. Google response headers are larger than the 16 KB limit of Node `fetch`: use `node:https` with a larger `maxHeaderSize`. A redirect to sign-in, or no page token, is an ended session. |

A Cloudflare challenge is a network problem, not an ended session. Keep the secret and the last reading.

---

## 5. Session lifetime

Decided in [Session lifetime and sign-in again](https://github.com/BasantPandey/AIQuotaTool/issues/88):

- The profile is deleted after the read (section 3.1). There is no silent refresh. The user signs in again when a session ends.
- A 401 or 403 follows `sessionAuthFailureAction`: drop the reading, keep the secret. The card, the status bar ("<Provider> session ended"), and the Accounts tab show "Session ended" with **Sign in again**. There is no pop-up.
- A Cloudflare challenge is a network problem, not an ended session. Keep the secret and the last reading.
- A graceful browser close deletes cookies with no expiry date. Every target cookie in section 15 has an expiry date, so none is lost.
- **Open:** Chrome DBSC can bind Google cookies to the device. A 4-hour check of a copied Gemini session runs in [Gemini browser sign-in](https://github.com/BasantPandey/AIQuotaTool/issues/114).

---

## 6. Keys

### 6.1 Add, edit, and remove

- **Add:** on the Keys tab, the user clicks **Add key**. The form has provider, name, and API key. The default name is "<Provider> key 1", "<Provider> key 2", and so on. A name is unique for each provider.
- **Admin key:** for Anthropic, OpenAI, Mistral, and xAI, the form shows a tick box: "This is an Admin key. It can manage your whole org." **Test and save** stays off until the user ticks it.
- **Test and save:** the extension makes one free call with the key. It saves the key only if the call works.
- **Show:** after save, the UI shows only the last 4 characters. The full value never goes back to the webview.
- **Edit:** the user can change the name and the budget. To change the key value, the user removes the Key and adds it again.
- **Remove:** the user confirms. The extension deletes the secret and the card.

### 6.2 Card types

The card shows the number that the provider gives. It does not convert it.

| Type | Card shows | Example |
| --- | --- | --- |
| **Balance** | A large money value and the scope label | "$12.40 account balance" |
| **Spend with a limit** | A bar with the real percent left, and the reset date if the provider gives one | "$3.20 of $10 key limit - 68% left" |
| **Spend only** | Spend this month, no bar | "$42.10 this month" |

Each card shows the Key name, the provider, and the last 4 characters. It says "account balance" or "org spend" when the number is not for one key.

### 6.3 Budget

- A **Spend only** Key can have an optional monthly budget. The card then shows "$42.10 of $100 budget - 58% left", with a bar. The label says "budget".
- **Spend with a limit** and **Balance** Keys have no budget field.
- With no budget, the card shows only the spend. It never shows a percent.

### 6.4 Key data sources

| Provider | Request | Test call | Numbers |
| --- | --- | --- | --- |
| OpenRouter | `GET https://openrouter.ai/api/v1/key` | Same | `usage_monthly`, `limit`, `limit_remaining`, and `limit_reset` (how often the limit resets, not a date). Percent left = `limit_remaining / limit`, only when `limit` is not null. |
| DeepSeek | `GET https://api.deepseek.com/user/balance` | Same | Existing mapper |
| Kimi | `GET https://api.moonshot.ai/v1/users/me/balance` | Same | Existing mapper |
| Anthropic (Admin) | `GET https://api.anthropic.com/v1/organizations/cost_report` | Same, one day | Sum of cost for the current month, in USD |
| OpenAI (Admin) | `GET https://api.openai.com/v1/organization/costs` | Same, one day | Sum of cost for the current month, in USD |
| Mistral (Admin) | `GET https://api.mistral.ai/v1/admin/usage` and `/v1/admin/spend-limit` | `/v1/admin/spend-limit` | Month cost and spend limit |

A breakdown by key for Admin keys is not in this release (map fog).

---

## 7. The panel

One VS Code panel replaces the dashboard and Set Up Accounts. It has three tabs. The tab labels show counts, for example "Accounts (3)" and "Keys (5)".

### 7.1 Usage (default tab)

- "Accounts" group: one `ProviderCard` for each connected Account.
- "Keys" group: one chip for each Key. A chip shows the logo, the Key name, and the headline number (balance, "68% left", or spend).
- Accounts that are not signed in do not show on this tab.

### 7.2 Accounts

One row for each Account provider in catalog order:

| Column | Values |
| --- | --- |
| Name and logo | Provider name |
| Method | "Opens Chrome or Edge" or "VS Code GitHub sign-in" |
| Status | "Connected - <plan>", "Session ended", "Not signed in" |
| Action | "Sign in", "Sign in again", "Sign in with GitHub", "Sign out" |

### 7.3 Keys

- **Add key** button, which opens the form in section 6.1.
- A table with one row for each Key: name, provider (with "(Admin)"), last 4 characters, what it shows ("Account balance", "Spend vs key limit", "Spend vs budget", "Spend only"), and edit and remove buttons.

### 7.4 Logos

Perplexity, Windsurf, OpenRouter, Anthropic, OpenAI, Mistral, xAI, and Z.ai need logos in `packages/ui/src/components/logos.tsx`.

---

## 8. Status bar

- The text shows Accounts only, as today. Keys get no text entry.
- A Key with a real percent (provider limit or user budget) joins the lowest-percent check. It can turn the status bar amber below 10%.
- A Balance Key at zero turns the status bar amber, as DeepSeek does today.
- A Spend only Key with no budget never changes the status bar.
- The tooltip lists every Key with its headline number.

---

## 9. Data model

### 9.1 Readings

- Today there is one `QuotaState` for each `ServiceId`. Many Keys need one reading for each Key.
- Add `connectionId: string` to `QuotaState`. An Account uses its `ServiceId` as the id. A Key uses its Key id.
- `upsertQuotaState`, `preferQuotaState`, and `mergeQuotaStates` match on `connectionId`, not on `service`. Freshest wins, as today.
- Add `kind: 'account' | 'key'` so the UI and the status bar can split them.
- Key readings add `spend?: { amount: number; currency: string; limit?: number; budget?: number; resetsAt?: number; scope: 'key' | 'account' | 'org' }`. `balance` stays as it is.
- New `ServiceId` values: `perplexity`, `windsurf`, `openrouter`, `anthropic`, `openai`, `mistral`, and after [Check xAI and Z.ai key numbers](https://github.com/BasantPandey/AIQuotaTool/issues/92), `xai` and `zai`. Each gets a row in `SERVICES` with `auth: 'session' | 'oauth' | 'api_key'`.

### 9.2 Storage

| Data | Where | Key |
| --- | --- | --- |
| Account secret | SecretStorage | `aiQuotaTool.account.<serviceId>` |
| Key secret | SecretStorage | `aiQuotaTool.key.<keyId>` |
| Key list: id, provider, name, admin flag, budget, last 4 | `globalState` | `aiQuotaTool.keys` |
| First-sign-in notice seen | `globalState` | `aiQuotaTool.noticeSeen.<serviceId>` |

`keyId` is a random UUID. Nothing secret goes in `globalState`.

### 9.3 Pure seams in core (with tests)

- New mappers: `mapCopilotUser`, `mapPerplexityCredits`, `mapWindsurfPlanStatus`, `mapOpenRouterKey`, `mapAnthropicCost`, `mapOpenAICost`, `mapMistralUsage`.
- `keyCardType(reading)` returns `balance`, `limit`, or `spend`.
- `keyPercent(reading)` returns a percent only for a provider limit or a user budget.
- `defaultKeyName(provider, existing)` and `isUniqueKeyName`.
- `lowestPressureAmong` takes Key readings that have a real percent.

---

## 10. Polling

| Connection | Interval | Status |
| --- | --- | --- |
| Copilot Account | 5 min or longer | Decided ([Copilot usage endpoint](https://github.com/BasantPandey/AIQuotaTool/issues/96)) |
| Other Accounts | 5 min or longer, only while the VS Code window has focus | Decided ([Provider terms risk for Account polling](https://github.com/BasantPandey/AIQuotaTool/issues/99)) |
| Keys | 5 min or longer | Built. Spend data from Admin APIs changes slowly. |

Back off on HTTP 429.

---

## 11. Privacy, listing, and Marketplace

No Marketplace rule blocks a browser sign-in or a cookie read. The rules require clear disclosure.

### 11.1 README (first screen)

- "To sign in, this extension opens Chrome or Edge in a new, separate profile."
- "After you sign in, it reads one session cookie from that profile, stores it in VS Code SecretStorage, and deletes the profile."
- "It sends the cookie only to the same provider, to read your usage. There is no server of ours."
- A list of each provider, its cookie or `localStorage` keys, and the only host that receives it.
- "It never reads your own browser profile."
- "Your use of each service follows that service's terms", with links.
- Links to the privacy policy and to the source on GitHub.

### 11.2 `package.json`

- `description` names the browser sign-in and the session cookie.
- `extensionKind: ["ui", "workspace"]`.
- `displayName` and `keywords` do not suggest an official product of a provider.
- No new activation event.
- The two settings in section 3.4.

### 11.3 In-product text

- Before the first browser start for a provider: the modal in section 3.1. It says the user signs in on the real site and the extension never sees the password.
- After the read: a message that names the stored value and says the profile is deleted.
- The paste path shows the same disclosure.

### 11.4 Privacy policy (`PRIVACY.md`, VS Code section)

The VS Code section exists since PR #100. For this release, add:

- What is read: one named cookie for each provider, or the named `localStorage` keys for Windsurf.
- What is not read: other cookies, browsing history, chats, prompts, passwords, the default browser profile.
- The temporary profile: where it is made, and that it is deleted after the read, also on error or cancel.
- Every host that receives a secret.
- How long a secret is kept: until the user clears it, signs in again, or uninstalls.
- The Copilot token comes from the VS Code GitHub sign-in.
- Update "Last updated".

### 11.5 Release check

The README, the `description`, the privacy policy, and the panel text must say the same thing. Check them before each release.

---

## 12. Risks

| Risk | Effect | What we do |
| --- | --- | --- |
| **Provider terms.** Anthropic, OpenAI, xAI, Perplexity, and Cursor forbid automated access to the consumer site. | A provider can complain. Microsoft can then remove the extension. | Decided on [#99](https://github.com/BasantPandey/AIQuotaTool/issues/99): ship with the risk. Poll every 5 minutes, only with focus. Show a notice with a terms link before the first sign-in for each provider. |
| **Undocumented endpoints.** No Account source in section 4 is in official docs. | A shape change breaks a card. | Defensive mappers. Unknown shape gives "usage unknown", never 100%. |
| **Copilot shape changes.** `copilot_internal/user` changed 7 times in 2026. | Wrong numbers. | Accept number or string for `entitlement`. Fall back to the seat check. |
| **Gemini DBSC.** Google can bind cookies to the device. | The Gemini session can end in hours. | Label Gemini as high risk in the Accounts tab. Measure in [Test sign-in cookies with real accounts](https://github.com/BasantPandey/AIQuotaTool/issues/94). |
| **Session-only cookies.** A graceful close deletes cookies with no expiry date. | Phase 2 finds nothing for that provider. | Measured on 2026-09-30: every target cookie has an expiry date (section 15). Paste stays. |
| **Research goes out of date.** Perplexity and Windsurf changed after the research. | A provider stops working. | Test each provider with a real account before it ships. |
| **Admin keys.** An Admin key can manage the whole org. | High damage if leaked. | Separate tick box. SecretStorage only. Only the last 4 characters show. |

---

## 13. Move from 0.9.x

Built (0.9.x to this release):

- Existing Claude, Codex, and Grok secrets move to `aiQuotaTool.account.<serviceId>` on first start. They stay connected. No sign-in is needed.
- The existing DeepSeek and Kimi keys become named Keys "DeepSeek key 1" and "Kimi key 1".
- The old GitHub device-flow token is deleted. Copilot asks for the VS Code GitHub sign-in once.
- Each move keeps a newer value at the new name.
- The move runs once and is safe to run again.

---

## 14. Open items

| Ticket | What it decides | Sections |
| --- | --- | --- |
| [Gemini browser sign-in](https://github.com/BasantPandey/AIQuotaTool/issues/114) and [Test sign-in cookies with real accounts](https://github.com/BasantPandey/AIQuotaTool/issues/94) | Does DBSC end a copied Gemini session within hours | 5, 12 |
| [Check xAI and Z.ai key numbers](https://github.com/BasantPandey/AIQuotaTool/issues/92) | xAI balance unit; Z.ai percent meaning | 2.2, 9.1 |

Not in this release: a breakdown by key for Admin keys (section 6.4).

When all open items close, [Write PROVIDERS-SPEC.md](https://github.com/BasantPandey/AIQuotaTool/issues/91) removes the **Draft** status.

---

## 15. Real-account results (2026-09-30)

Windows 10, Chrome, the two-phase flow. Only names, expiry, and value lengths were recorded. Each profile was deleted.

| Provider | Value | Expiry | Phase 2 reads it | Usage call |
| --- | --- | --- | --- | --- |
| Claude | `sessionKey` | 2026-10-28 | yes | works |
| ChatGPT / Codex | `__Secure-next-auth.session-token.0` and `.1` | 2026-12-29 | yes | works |
| Grok | `sso`, `sso-rw` | 2027-03-29 | yes | works |
| Cursor | `WorkosCursorSessionToken` | 2026-11-29 | yes | works |
| Gemini | `__Secure-1PSID`, `__Secure-1PSIDTS`, `__Secure-1PSIDCC` | 2027-09-30 or later | yes | works (DBSC check open) |
| Perplexity | `__Secure-next-auth.session-token` | 2026-10-30 | yes | blocked by Cloudflare; credits endpoint 404 |
| Windsurf | `devin_*` localStorage | - | not present | sign-in moved to Devin |
| Copilot | VS Code GitHub token (tested with the GitHub CLI token) | - | - | works; `quota_reset_at` is 0 on a Free plan |
