# packages/vscode-ext

VS Code extension. **V1 product surface** - first-class standalone quota monitor (SecretStorage + poller). Optional Chrome WebSocket push (if present) merges with freshest-wins; Chrome is not a V1 gate.

## Entry points
| File | Role |
|---|---|
| `src/extension.ts` | `activate` — poller, credentials, WS, panel, status bar, setup |
| `src/quota-poller.ts` | Poll loop; uses `session-fetch`; `upsertQuotaState`; `pollNow` after save |
| `src/session-fetch.ts` | Shared Claude/Codex/Copilot HTTP fetch + core pure mappers (poller + Save & Test) |
| `src/credentials.ts` | SecretStorage Claude sessionKey / Codex token; clear methods |
| `src/credential-panel.ts` | Set Up Accounts host; Save & Test via `session-fetch`; clear |
| `src/ws-server.ts` | WebSocket server `127.0.0.1:54321` — optional Chrome sink |
| `src/quota-panel.ts` | WebviewPanel host — dashboard webview |
| `src/status-bar.ts` | Status bar: min(session, weekly); setup / re-auth prompts |
| `src/webview/index.tsx` | Dashboard React app (push via `setQueryData`) |
| `src/webview/credential-setup/index.tsx` | Setup UI + privacy disclosure |

## IPC flow
```
QuotaPoller ──upsert──▶ latestStates ◀── merge(WS from Chrome)
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       quota-panel / webview            status-bar
```

## Two tsconfigs — important
- `tsconfig.json` — Node extension host (no DOM). Excludes `src/webview/`.
- `tsconfig.webview.json` — browser webview (DOM). Used by Vite.

Do NOT add DOM types to `tsconfig.json` and do NOT use Node APIs in `src/webview/`.

## Graceful degradation
- No credentials / no data → Set Up Accounts (not “Chrome not connected”).
- Poller works with zero Chrome.
- Auth 401/403 on Claude/Codex: `sessionAuthFailureAction` → drop ring, **keep** SecretStorage, `getReauthNeeded()` → status bar re-auth cue; secrets never logged.
- **Grok:** no SecretStorage path; poller injects `grokBrowserSessionRequired` when no Grok state yet; optional Chrome WS merge can replace with fresher readings (see GROK-SPEC).

## Build
1. esbuild `src/extension.ts` → `dist/extension.js` (Node CJS, external vscode)
2. Vite webviews → `dist/webview/`

Package: `pnpm --filter ai-quota-tool-vscode run package` → `.vsix` (gitignored).
