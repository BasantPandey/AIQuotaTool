# packages/chrome-ext

Chrome Manifest V3 extension. **V2: fully standalone, first-class product** - side panel dashboard, no VS Code dependency, no WebSocket push.

## Entry points
| File | Role |
|---|---|
| `src/background/worker.ts` | Service worker - poll, freshest-wins storage merge, badge, low-quota/reset notifications, GitHub connect/disconnect messages |
| `src/background/github-auth.ts` | GitHub OAuth (PKCE) via `chrome.identity.launchWebAuthFlow`; token in `chrome.storage.local` |
| `src/content/quota-bridge.ts` | Page-origin fetch for claude.ai / chatgpt.com |
| `src/sidepanel/index.tsx` | Side panel app - consent gate, dashboard, accounts; storage via TanStack Query → `QuotaDashboard` |
| `src/sidepanel/AccountsSection.tsx` | Per-service connection rows; Copilot Connect/Disconnect drives the worker |

## Data flow
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

## GitHub OAuth
- Self-registered GitHub OAuth App + PKCE; **client id placeholder in `github-auth.ts` must be filled before store release**
- Callback `https://<extension-id>.chromiumapp.org/`; token exchange at `github.com/login/oauth/access_token` (public client, no secret)
- `identity` permission shows no install warning; manifest `oauth2` section is Google-only, unused

## Permissions
- `storage`, `alarms`, `notifications`, `identity`, `sidePanel` - no `cookies` API
- Hosts: claude.ai, chatgpt.com, api.github.com, github.com (token exchange only), grok.com - named hosts only, never `<all_urls>`

## Key patterns
- Panel: `useSuspenseQuery` + `storage.onChanged` invalidation (push freshness, no `refetchInterval`)
- All decision logic is pure in `@ai-quota-tool/core` (`deriveBadge`, `decideLowQuotaAlerts`, `buildGitHubAuthorizeUrl` / `extractAuthorizationCode`, `deriveConnections`); Chrome APIs stay thin glue, verified by manual E2E

## Build
Vite → `dist/worker.js`, `dist/sidepanel.js`, `dist/content.js`, `dist/src/sidepanel/index.html`. Load `dist/` unpacked in Chrome; action click opens the side panel.
