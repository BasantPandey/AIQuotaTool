# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is
A pnpm + Turborepo monorepo. **V1 product surface is the VS Code extension** (see `docs/V1-SPEC.md`):
- **VS Code extension** — standalone poller (SecretStorage session secrets + GitHub OAuth), webview, status bar; optional WS server on `127.0.0.1:54321`
- **Chrome extension** — optional/legacy package in the monorepo; **not** a V1 acceptance gate

## Packages
| Package | npm name | Purpose |
|---|---|---|
| `packages/core` | `@ai-quota-tool/core` | Shared types + pure utilities (merge, mappers, copilot/grok honesty, session-auth policy) — no DOM, no Node, no React |
| `packages/ui` | `@ai-quota-tool/ui` | Shared React 19 components — pure display, no data fetching |
| `packages/vscode-ext` | `ai-quota-tool-vscode` | **V1 product:** poller, credentials, optional WS server, webview, status bar |
| `packages/chrome-ext` | `@ai-quota-tool/chrome-ext` | Optional Chrome MV3 package (not a V1 gate) |

Build order enforced by Turbo: `core` → `ui` → `chrome-ext` / `vscode-ext` (parallel).

## Commands

```bash
# Workspace-wide
pnpm install                              # install all workspace deps
pnpm turbo build                          # build all packages in dependency order
pnpm turbo type-check                     # typecheck all packages
pnpm turbo test                           # core pure-function tests (vitest)
pnpm turbo lint                           # lint (if package scripts exist)
pnpm turbo clean                          # remove all dist/ folders

# Per-package (use --filter to scope)
pnpm --filter @ai-quota-tool/ui dev       # Vite dev server with mock data at localhost:5173
pnpm --filter @ai-quota-tool/chrome-ext build   # Vite → dist/ (load as unpacked extension)
pnpm --filter @ai-quota-tool/chrome-ext dev     # Vite watch mode for Chrome
pnpm --filter ai-quota-tool-vscode build  # esbuild host + vite webview → dist/
pnpm --filter ai-quota-tool-vscode run package  # vsce → .vsix

# Utilities
node scripts/generate-icons.mjs           # regenerate PNG icons
```

**Local VS Code testing:** Build/package vscode-ext, install `.vsix`, run **Set Up Accounts**.

**Optional Chrome:** Build chrome-ext, load `packages/chrome-ext/dist/` unpacked - not required for V1.

## Architecture: VS Code primary (V1)
- **VS Code standalone (required path):** `QuotaPoller` fetches Claude (sessionKey cookie), Codex (ChatGPT session token), Copilot (GitHub OAuth seat). Credentials in SecretStorage. Empty → Set Up Accounts.
- **Grok:** no VS Code SecretStorage; honesty slot and/or optional Chrome WS merge (see `docs/GROK-SPEC.md`).
- **Optional Chrome push:** if used, WS client → VS Code server `:54321`; merge with **freshest-wins** via `mergeQuotaStates` / `upsertQuotaState`. Not a V1 ship dependency.
- VS Code never initiates messages to Chrome.

## WebSocket protocol (`WsMessage` from `@ai-quota-tool/core`)
```
Chrome → VS Code:  { type: "quota_update", payload: QuotaState[] }
                   { type: "ping" }
VS Code → Chrome:  { type: "pong" }
                   { type: "error", message: string }
```

## Chrome extension data flow
1. `chrome.alarms` `quota-poll` every 60 s → fetchers in parallel (`Promise.allSettled`)
2. Results **merge** into `chrome.storage.local` `quotaStates` (freshest-wins; partial poll keeps other services)
3. Content scripts on claude.ai / chatgpt.com push `content_quota` → same merge path
4. Popup: `useSuspenseQuery` + `refetchInterval: 5000` + `onChanged` invalidation
5. Optional push over WebSocket (`ws-client.ts`); alarms recreated on install/startup/SW wake
6. Reset timestamps → per-service alarms → `chrome.notifications`

## VS Code extension data flow
```
QuotaPoller (SecretStorage + GitHub OAuth)
        │
        ▼
  upsertQuotaState  ◀── Chrome WS quota_update (freshest-wins)
        │
        ├─▶ status-bar.ts  (min of sessionPct/weeklyPct; amber < 10%)
        └─▶ quota-panel → webview (queryClient.setQueryData — push, no poll)
```
Empty state / no data → **Set Up Accounts** (not Chrome-only messaging).

## Fetchers / mappers (not placeholders for Claude/Codex)
- **Claude / Codex:** real endpoints; parse via pure `mapClaudeUsage` / `mapCodexUsage` in `@ai-quota-tool/core`.
- **Copilot:** seat check only for remaining %; use `copilotSeatActiveUsageUnknown` / `copilotNoPlan` / `copilotAuthUnavailable` — **never invent 100% remaining**.
- **Grok:** live grok.com session in Chrome; pure `mapGrokWeeklyUsage` / honesty builders — **never invent 100% remaining**. See `docs/GROK-SPEC.md`.

## Core pure seams (tested)
- `preferQuotaState` / `upsertQuotaState` / `mergeQuotaStates`
- `mapClaudeUsage` / `mapCodexUsage`
- Copilot honesty builders + `mapCopilotSeatStatus` + `QuotaHonesty`
- Grok honesty builders + `mapGrokWeeklyUsage` / `extractGrokWeeklyUsage`
- `sessionAuthFailureAction` (Claude/Codex 401/403: drop ring, keep secret, re-auth signal; Grok is not a session-cookie service)
- `pressureRemaining` / `lowestPressureAmong` (badge/status pressure; no inventing 100%)

## VS Code extension: two tsconfigs — critical
- `tsconfig.json` — Node.js extension host (`lib: ["ES2022"]`, no DOM). Excludes `src/webview/`.
- `tsconfig.webview.json` — Browser React bundle (`lib: ["ES2022", "DOM"]`). Used by Vite.

**Do not** add DOM types to `tsconfig.json`. **Do not** use Node.js APIs in `src/webview/`.

Build: esbuild bundles `extension.ts` → `dist/extension.js`; Vite builds webviews.

## Stack rules
- **React Compiler** is enabled (`babel-plugin-react-compiler`) — do not add `useMemo` or `useCallback`
- **Suspense + ErrorBoundary everywhere** — no `isLoading`/`isError` conditionals in components
- **`@ai-quota-tool/ui` components are pure display** — no async logic, no routing, no state management
- **`@ai-quota-tool/core`** must remain importable in browser, service worker, and Node.js
- **`calcPct(used, limit)`** returns percentage **REMAINING** (not used)
- TanStack Query v5: popup uses `useSuspenseQuery`; VS Code webview uses `queryClient.setQueryData` (push pattern)
