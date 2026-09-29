# packages/vscode-ext

VS Code extension. **V1 product surface** - first-class standalone quota monitor (SecretStorage + poller). Optional Chrome WebSocket push (if present) merges with freshest-wins; Chrome is not a V1 gate.

## Entry points
| File | Role |
|---|---|
| `src/extension.ts` | `activate` — poller, credentials, WS, panel, status bar, setup |
| `src/quota-poller.ts` | Poll loop; uses `session-fetch`; `upsertQuotaState`; `pollNow` after save |
| `src/session-fetch.ts` | Shared Claude/Codex/Copilot/Grok HTTP + core pure mappers (poller + Save & Test) |
| `src/credentials.ts` | SecretStorage Account secrets: Claude sessionKey / Codex token / Grok sso / GitHub token |
| `src/key-store.ts` | Named Keys: list in `globalState` (`aiQuotaTool.keys`, no secrets), value in SecretStorage (`aiQuotaTool.key.<id>`). Moves 0.9.x DeepSeek and Kimi secrets on start. Tested with vitest |
| `src/panel-controller.ts` | Panel actions (sign in, sign out, add and remove Keys) and the snapshot that the panel shows. Runs the GitHub device flow from `@ai-quota-tool/core` |
| `src/ws-server.ts` | WebSocket server `127.0.0.1:54321` — optional Chrome sink |
| `src/quota-panel.ts` | The one WebviewPanel: Usage, Accounts, and Keys tabs. `open(tab)` shows a tab |
| `src/status-bar.ts` | Status bar: min(session, weekly); setup / re-auth prompts |
| `src/webview/index.tsx` | Panel React app with three tabs (push via `setQueryData`) |
| `src/webview/protocol.ts` | Types only: messages between the host and the webview. Both tsconfigs import it |

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
- No credentials / no data → the Usage tab links to the Accounts tab. The Set Up Accounts command opens the Accounts tab.
- Poller works with zero Chrome.
- Auth 401/403 on Claude/Codex/Grok: `sessionAuthFailureAction` → drop ring, **keep** SecretStorage, `getReauthNeeded()` → status bar re-auth cue; secrets never logged.
- **Grok:** SecretStorage `sso` cookie (same Claude-style paste flow); `POST /rest/rate-limits` + pure `mapGrokRateLimits`. No secret → no reading (the Accounts tab shows "Not signed in"); optional Chrome WS merge still freshest-wins.

## Build
1. esbuild `src/extension.ts` → `dist/extension.js` (Node CJS, external vscode)
2. Vite webview → `dist/webview/`. The panel links one stylesheet, `dist/webview/webview.css` (shared `@ai-quota-tool/ui` styles plus the VS Code theme map).

Package: `pnpm --filter ai-quota-tool-vscode run package` → `.vsix` (gitignored).
