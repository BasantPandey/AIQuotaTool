# packages/chrome-ext

Chrome Manifest V3 extension. Owns browser-session quota fetching. Runs standalone; VS Code connection is optional.

## Entry points
| File | Role |
|---|---|
| `src/background/worker.ts` | Service worker — poll, freshest-wins storage merge, alarms, WS push |
| `src/content/quota-bridge.ts` | Page-origin fetch for claude.ai / chatgpt.com |
| `src/popup/index.tsx` | Popup UI — storage via TanStack Query → `QuotaDashboard` |
| `src/popup/SettingsTab.tsx` | Accounts tab + minimal privacy disclosure (browser sessions, no stored keys, optional localhost WS) |

## Data flow
1. Alarms every 60s (recreated on install, startup, SW wake)
2. Fetchers in parallel; **merge** into `chrome.storage.local` with `mergeQuotaStates` (partial success keeps other services)
3. Content script `content_quota` → `upsertQuotaState`
4. Optional `ws-client` push to VS Code; keepalive alarm
5. Reset timestamps → notifications

## Fetchers
- **Claude** — real orgs + usage APIs; mapped with `mapClaudeUsage`
- **Codex** — real wham/usage; mapped with `mapCodexUsage`
- **Copilot** — seat check; honest builders when usage % unknown (**never fake 100% remaining**)

## Permissions
- `storage`, `alarms`, `notifications` - no `cookies` API (session cookies via `credentials: 'include'` + host permissions)
- Hosts: claude.ai, chatgpt.com, api.github.com, localhost WS - not github.com page or api.openai.com

## Key patterns
- Popup: `useSuspenseQuery` + `refetchInterval: 5_000` + `storage.onChanged` invalidation
- WS reconnect is alarm/poll driven (SW suspension kills heap timers)

## Build
Vite → `dist/worker.js`, `dist/popup.js`, content bundle, `dist/src/popup/index.html`. Load `dist/` unpacked in Chrome.
