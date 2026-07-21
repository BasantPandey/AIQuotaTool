# AI Quota Tool

Monitor your remaining AI quota for **Claude**, **GitHub Copilot**, and **OpenAI Codex** — all in one dashboard.

Ships as two extensions from a single TypeScript monorepo:

| Extension | What it does |
|---|---|
| **Chrome extension** (MV3) | Fetches quota data using your existing browser session, shows a popup, and pushes data to VS Code |
| **VS Code extension** | Displays live quota in a webview panel and a status bar item (`Claude 3% \| Codex 24%`) |

The two extensions talk over a local WebSocket (`ws://127.0.0.1:54321`). Each works standalone — the Chrome extension functions without VS Code open, and VS Code gracefully shows a "not connected" state when Chrome isn't running.

---

## How it works

```
Chrome Extension (MV3)
  └─ Service worker polls each AI service every 60 s
       using your existing login session (cookies)
  └─ Writes results to chrome.storage.local → popup reads
  └─ Pushes quota_update over WebSocket → VS Code

VS Code Extension
  └─ Standalone poller (optional session secrets in SecretStorage)
  └─ WebSocket server on 127.0.0.1:54321 (optional Chrome push)
  └─ Relays data to webview panel via postMessage
  └─ Updates status bar item
```

**Credentials:** The Chrome extension uses your existing browser cookies and does not store them. The VS Code extension **can store** Claude/ChatGPT session cookies in VS Code SecretStorage for standalone mode — treat those as passwords and clear them anytime via **Set Up Accounts**. See `packages/vscode-ext/README.md` Privacy section.

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- Chrome (for the browser extension)
- VS Code 1.95+ (for the editor extension)

---

## Getting started

```bash
pnpm install          # install all workspace dependencies
pnpm turbo build      # build all packages in dependency order
```

### Load the Chrome extension

1. Run `pnpm --filter @ai-quota-tool/chrome-ext build`
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** → select `packages/chrome-ext/dist/`

### Install the VS Code extension

```bash
pnpm --filter ai-quota-tool-vscode run package   # produces a .vsix file
```

Then install the `.vsix` via **Extensions → Install from VSIX…** in VS Code.

---

## Development

```bash
# Watch mode for Chrome extension (rebuilds on save)
pnpm --filter @ai-quota-tool/chrome-ext dev

# Preview shared UI components with mock data (localhost:5173)
pnpm --filter @ai-quota-tool/ui dev

# Typecheck everything
pnpm turbo type-check

# Regenerate icons
node scripts/generate-icons.mjs
```

---

## Monorepo structure

```
packages/
  core/        Shared TypeScript types (QuotaState, WsMessage) and pure utilities
  ui/          Shared React 19 components — no data fetching, used by both extensions
  chrome-ext/  Chrome MV3 extension
  vscode-ext/  VS Code extension
docs/
  ARCHITECTURE.md   Full system diagram and design decisions
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system diagram, WebSocket protocol, security model, and open engineering tasks.

---

## Status

| Task | Status |
|---|---|
| Endpoint discovery — Claude, Codex | Done |
| Endpoint discovery — Copilot `GET /user/copilot/usage` | Needs DevTools verification on `github.com/settings/billing` |
| Implement fetchers with real endpoints — Claude, Codex | Done |
| Implement Copilot fetcher with real usage endpoint | Blocked by above |
| Verify persistent WebSocket in MV3 service worker | Done |
| Migrate fetchers + WS layer to [Effect](https://effect.website/) for typed errors and composability | TODO (post-endpoint-discovery) |
| Publish to Chrome Web Store + VS Code Marketplace | Post-v1 |

To discover the Copilot usage endpoint: log into github.com, open DevTools → Network, navigate to `github.com/settings/billing/summary`, and find the XHR returning completion/chat quota remaining.

---

## Stack

- TypeScript (strict mode throughout)
- React 19 + React Compiler
- TanStack Query v5
- Vite 6
- pnpm workspaces + Turborepo
