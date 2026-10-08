# packages/chrome-ext

Chrome Manifest V3 extension. **V2: fully standalone, first-class product** - side panel dashboard, no VS Code dependency, no WebSocket push.

## Entry points
| File | Role |
|---|---|
| `src/background/worker.ts` | Service worker - poll, freshest-wins storage merge, badge, low-quota/reset notifications, GitHub connect/disconnect messages |
| `src/background/github-auth.ts` | GitHub OAuth device flow (no client secret); the side panel runs it; token in `chrome.storage.local` |
| `src/content/quota-bridge.ts` | Page-origin fetch for claude.ai / chatgpt.com |
| `src/sidepanel/index.tsx` | Side panel app - welcome screen with provider picker, `LowestLimit` card, dashboard of `ProviderCard`s |
| `src/sidepanel/ProvidersView.tsx` | Providers screen: Plans tab (on/off switch per plan provider, Copilot connect, session status) and API keys tab |
| `src/sidepanel/KeysView.tsx` | API keys tab: provider dropdown, add form (name, key, team ID, admin confirm), key list with inline edit (name, team ID, new key) and two-step remove |
| `src/background/api-keys.ts` | Named key store: `apiKeyList` (no secrets) and `apiKeySecrets` (by key id) in `chrome.storage.local`; moves the 3.2 `apiKeys` map on install |
| `src/background/key-fetchers.ts` | One fetch function for each key provider; the test call before a key is saved |
| `src/sidepanel/styles.css` | Panel shell only (top bar, welcome, providers rows). Tokens, cards and buttons come from `@ai-quota-tool/ui/styles.css` |
| `store/art.html` + `scripts/store-assets.mjs` | Store icon, tile, marquee and screenshots from the real panel |
| `store/promo.html` + `store/panel.html` | How-to video (search, add, providers, keys, data). The real built panel runs with in-memory storage. Record with `node scripts/promo-video.mjs --video chrome` |

## Data flow
0. Provider list: `enabledServices` in `chrome.storage.local` (`resolveEnabledServices`). Only enabled fetchers run; `filterEnabled` drops removed providers from `quotaStates` (no card, badge, or alerts)
1. Alarms every 60s (recreated on install, startup, SW wake)
2. Fetchers in parallel; **merge** into `chrome.storage.local` with `mergeQuotaStates` (partial success keeps other services)
3. Content script `content_quota` → `upsertQuotaState`
4. After each merge: `deriveBadge` → action badge; `decideLowQuotaAlerts` (persisted latch) → notifications; reset timestamps → per-service alarms
5. Side panel never polls - it re-renders on `chrome.storage.onChanged`

## Fetchers
- **Claude** - real orgs + usage APIs; mapped with `mapClaudeUsage`
- **Codex** - real wham/usage; mapped with `mapCodexUsage`
- **Copilot** - seat check with the stored GitHub OAuth token (`Authorization: Bearer`); honest builders when usage % unknown (**never fake 100% remaining**); no token → `copilotAuthUnavailable`
- **Grok** - live `grok.com` session only; honesty-first (`grokUsageUnknown` / `grokNotConnected`); weekly % only via pure `mapGrokWeeklyUsage` when first-party used% is available. **Never store Grok session keys.**
- **Gemini** - private batchexecute RPC `jSf9Qc` (issue #66); tokens `SNlM0e`/`cfb2h` from the app HTML; pure `mapGeminiUsage` (type 1 = 5-hour session, type 2 = weekly). Also runs in the content bridge on gemini.google.com
- **Cursor** - `GET https://cursor.com/api/usage-summary` with the session cookie (unofficial). Pure `mapCursorUsageSummary`; lowest pool remaining becomes `monthlyPct`. Bad shape → `usage_unknown`
## API keys (named keys)
- The user adds many named keys for each provider on the API keys tab. Each key reads on its own; its reading has `kind: 'key'` and `connectionId` = key id.
- Key providers have no on/off switch. A saved key is read on each poll; a removed key drops its reading.
- Before save, the worker makes one test call (`validateKey`). 401/403 gives "Key rejected"; other failures keep the last good reading.
- Secrets stay in `chrome.storage.local` (never synced) and go only to their own provider. The panel shows the last 4 characters.
- **DeepSeek** - `GET https://api.deepseek.com/user/balance`. Currency amounts, never a percent. A funded balance does not move the toolbar badge; an empty balance does.
- **Kimi** - `GET https://api.moonshot.ai/v1/users/me/balance`.
- **Anthropic / OpenAI** - Admin key; org cost report for this month (`mapAnthropicCost` / `mapOpenAICost`).
- **xAI** - management key plus team ID; `GET https://management-api.x.ai/v1/billing/teams/{team_id}/prepaid/balance` (`mapXaiPrepaidBalance`: inverted cents ledger).
- **Cursor Team** - team Admin API key (Basic auth); `POST https://api.cursor.com/teams/spend` (`mapCursorTeamSpend`). Team plans only.
- **Copilot premium** - fine-grained GitHub token with the Plan permission (read); `GET /users/{login}/settings/billing/premium_request/usage` (`mapCopilotPremiumUsage`). Personal plans only.

Fetchers are registered in `src/background/providers.ts`, one factory per `ChromeServiceId` from `@ai-quota-tool/core`. Catalog rows with `vscodeOnly: true` (Key providers such as OpenRouter) are not in `CHROME_SERVICES`, so Chrome never shows them.

## GitHub OAuth
- GitHub OAuth App `Ov23liNRlhzedfjImsrQ` with **device flow** turned on. The web flow needs a client secret, so the extension does not use it
- The side panel asks `github.com/login/device/code` for a code, shows it, and polls `login/oauth/access_token`. Shared flow in core (`requestDeviceCode`, `pollDeviceToken`), also used by VS Code
- The worker polls quota when the token appears in storage. No silent re-auth: OAuth App tokens do not expire on a schedule; after a revoke the card shows "Sign in needed"
- No `identity` permission and no callback URL

## Permissions
- `storage`, `alarms`, `notifications`, `sidePanel` - no `cookies` API, no `identity`
- Hosts: claude.ai, chatgpt.com, api.github.com, github.com (token exchange only), grok.com, gemini.google.com, cursor.com, api.deepseek.com, api.moonshot.ai - named hosts only, never `<all_urls>`
- Optional hosts (`optional_host_permissions`): api.anthropic.com, api.openai.com, management-api.x.ai, api.cursor.com. The add form asks for one inside the click (`KEY_ORIGINS`), so an update shows no new permission prompt

## Key patterns
- Panel: `useSuspenseQuery` + `storage.onChanged` invalidation (push freshness, no `refetchInterval`)
- All decision logic is pure in `@ai-quota-tool/core` (`deriveBadge`, `decideLowQuotaAlerts`, `nextDevicePollStep`, `deriveConnections`); Chrome APIs stay thin glue, verified by manual E2E

## Build
Vite → `dist/worker.js`, `dist/sidepanel.js`, `dist/content.js`, `dist/src/sidepanel/index.html`. Load `dist/` unpacked in Chrome; action click opens the side panel.

Store upload: bump `version` in `manifest.json` and `package.json`, build, then run `pnpm --filter @ai-quota-tool/chrome-ext zip`. Upload `ai-quota-tool-chrome-<version>.zip` (gitignored).
