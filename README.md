# AI Quota Tool

Monitor your remaining AI quota for **Claude**, **GitHub Copilot**, and **OpenAI Codex** - all in one dashboard.

Ships as two **first-class** extensions from a single TypeScript monorepo (dual-mode equal):

| Extension | What it does |
|---|---|
| **Chrome extension** (MV3) | Fetches quota via browser session cookies (and content scripts), popup UI, optional push to VS Code |
| **VS Code extension** | Standalone poller with SecretStorage credentials, webview dashboard, status bar; optional receive from Chrome |

Either works alone. Together they merge readings with **freshest-wins** (`lastUpdated`).

---

## How it works

```
Chrome Extension (MV3)
  - Service worker + content scripts poll / push quota
  - chrome.storage.local → popup
  - Optional WS client → ws://127.0.0.1:54321

VS Code Extension
  - Standalone Node poller (Claude sessionKey, Codex session token, GitHub OAuth)
  - Optional WS server on 127.0.0.1:54321 (Chrome push, freshest-wins merge)
  - Webview dashboard + status bar (min session/weekly remaining)
```

**Credentials (two honest paths):** Chrome uses live browser session cookies and does **not** store session keys (Settings discloses this). VS Code **stores** Claude/ChatGPT session cookies in SecretStorage for standalone mode - treat them like passwords; validate on save, clear anytime via **Set Up Accounts**. Expired sessions surface a re-auth cue; secrets are not auto-deleted. Never claim product-wide "no credentials stored." See `packages/vscode-ext/README.md` and `docs/ARCHITECTURE.md` security model.

**Copilot:** Seat/plan can be detected; remaining usage % is often unavailable from GitHub. The UI shows honest status instead of inventing 100% remaining.

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
pnpm turbo test       # core pure-function tests
pnpm turbo type-check
```

### Load the Chrome extension

1. Run `pnpm --filter @ai-quota-tool/chrome-ext build`
2. Open `chrome://extensions`, enable **Developer mode**
3. Click **Load unpacked** → select `packages/chrome-ext/dist/`

### Install the VS Code extension

```bash
pnpm --filter ai-quota-tool-vscode run package   # produces a .vsix file
```

Then install the `.vsix` via **Extensions → Install from VSIX…** in VS Code. Run **AI Quota Tool: Set Up Accounts**.

---

## Development

```bash
# Watch mode for Chrome extension (rebuilds on save)
pnpm --filter @ai-quota-tool/chrome-ext dev

# Preview shared UI components with mock data (localhost:5173)
pnpm --filter @ai-quota-tool/ui dev

# Typecheck / test / build
pnpm turbo type-check
pnpm turbo test
pnpm turbo build

# Regenerate icons
node scripts/generate-icons.mjs
```

CI (GitHub Actions) runs install, type-check, test, and build on push/PR.

---

## Monorepo structure

```
packages/
  core/        Shared types, pure merge/mappers/copilot builders, utils
  ui/          Shared React 19 components — no data fetching
  chrome-ext/  Chrome MV3 extension
  vscode-ext/  VS Code extension (poller + optional WS)
docs/
  ARCHITECTURE.md   Dual-mode architecture and design decisions
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for diagrams, protocol, merge rules, and security.

---

## Status

| Task | Status |
|---|---|
| Dual-mode equal (Chrome + VS Code standalone) | Done (V1 bar) |
| Claude + Codex real usage mapping | Done (shared pure mappers in core) |
| Freshest-wins dual-source merge | Done |
| Honest Copilot (no fake 100% remaining) | Done |
| Credential clear / privacy disclosure (VS Code) | Done |
| Session auth failure re-auth cue (keep secret) | Done |
| Chrome Settings privacy disclosure | Done |
| Honest pressure (badge/status) + seat-status mapper | Done |
| Core unit tests + CI | Done |
| Real Copilot remaining-% API (if GitHub ever exposes one) | Optional follow-up |
| Effect-TS migration | Post-v1 |
| Publish to Chrome Web Store + VS Code Marketplace | Post-v1 |

---

## Stack

- TypeScript (strict mode throughout)
- React 19 + React Compiler
- TanStack Query v5
- Vite 6 / esbuild
- Vitest (core pure seams)
- pnpm workspaces + Turborepo
