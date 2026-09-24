# packages/chrome-ext

Chrome Manifest V3 extension. **V2: fully standalone, first-class product** - side panel dashboard, no VS Code dependency, no WebSocket push.

## Entry points
| File | Role |
|---|---|
| `src/background/worker.ts` | Service worker - poll, freshest-wins storage merge, badge, low-quota/reset notifications, GitHub connect/disconnect messages |
| `src/background/github-auth.ts` | GitHub OAuth (PKCE) via `chrome.identity.launchWebAuthFlow`; token in `chrome.storage.local` |
| `src/content/quota-bridge.ts` | Page-origin fetch for claude.ai / chatgpt.com |
| `src/sidepanel/index.tsx` | Side panel app - welcome screen with provider picker, dashboard of `ProviderCard`s, header summary |
| `src/sidepanel/ProvidersView.tsx` | Providers screen - on/off switch per provider, Copilot connect, API keys, session status |
| `src/sidepanel/styles.css` | Design tokens (`--aq-*`) for dark and light (`prefers-color-scheme`) |
| `store/art.html` + `scripts/store-assets.mjs` | Store icon, tile, marquee and screenshots from the real panel |

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
- **DeepSeek** - official `GET https://api.deepseek.com/user/balance` with a user-pasted API key (`chrome.storage.local` key `apiKeys`, removed on disconnect, never synced). Card shows currency amounts (granted vs topped-up), never a percent. 401/403 drops the amount (`api_key_invalid`). A funded balance does not move the toolbar badge; an empty balance does.

Fetchers are registered in `src/background/providers.ts`, one factory per `ServiceId` from `@ai-quota-tool/core`.

## GitHub OAuth
- Self-registered GitHub OAuth App + PKCE; **client id placeholder in `github-auth.ts` must be filled before store release**
- The store forbids the manifest `key` field and assigns the extension ID on first upload. Register the callback `https://<store-assigned-id>.chromiumapp.org/` after that upload
- Token exchange at `github.com/login/oauth/access_token` (public client, no secret)
- `identity` permission shows no install warning; manifest `oauth2` section is Google-only, unused

## Permissions
- `storage`, `alarms`, `notifications`, `identity`, `sidePanel` - no `cookies` API
- Hosts: claude.ai, chatgpt.com, api.github.com, github.com (token exchange only), grok.com, gemini.google.com, cursor.com, api.deepseek.com, api.moonshot.ai - named hosts only, never `<all_urls>`

## Key patterns
- Panel: `useSuspenseQuery` + `storage.onChanged` invalidation (push freshness, no `refetchInterval`)
- All decision logic is pure in `@ai-quota-tool/core` (`deriveBadge`, `decideLowQuotaAlerts`, `buildGitHubAuthorizeUrl` / `extractAuthorizationCode`, `deriveConnections`); Chrome APIs stay thin glue, verified by manual E2E

## Build
Vite → `dist/worker.js`, `dist/sidepanel.js`, `dist/content.js`, `dist/src/sidepanel/index.html`. Load `dist/` unpacked in Chrome; action click opens the side panel.
