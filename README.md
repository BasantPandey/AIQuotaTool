# AI Quota Tool

Monitor your remaining AI quota for **Claude**, **GitHub Copilot**, **OpenAI Codex**, and (optionally) **Grok** - primarily as a **VS Code extension**.

## Product surface (V1)

| Surface | Role |
|---|---|
| **VS Code extension** | **First-class V1 product:** SecretStorage credentials, standalone poller, webview dashboard, status bar |
| **Chrome extension** | Optional / legacy package in the monorepo - **not** a V1 acceptance gate. May push readings to VS Code over localhost WebSocket if both are installed |

**V1 bar:** [`docs/V1-SPEC.md`](docs/V1-SPEC.md) (VS Code only).  
**Grok bar:** [`docs/GROK-SPEC.md`](docs/GROK-SPEC.md).

---

## How it works (VS Code)

```
VS Code Extension
  - Standalone Node poller (Claude sessionKey, Codex session token, GitHub OAuth)
  - SecretStorage for Claude/Codex session secrets (treat like passwords)
  - Webview dashboard + status bar (min session/weekly remaining; honest Copilot states)
  - Optional: receive Chrome WS push on 127.0.0.1:54321 (not required for V1)
```

**Credentials:** VS Code **stores** Claude and ChatGPT session cookies in SecretStorage - never claim product-wide “no credentials stored.” Validate on save (Save & Test), replace, clear via **Set Up Accounts**. Expired sessions drop the ring and show re-auth; secrets are not auto-deleted. See `packages/vscode-ext/README.md`.

**Copilot:** Seat/plan can be detected; remaining usage % is often unavailable from GitHub. The UI shows honest status instead of inventing 100% remaining.

**Grok:** See [`docs/GROK-SPEC.md`](docs/GROK-SPEC.md). VS Code does not store Grok secrets; honesty or optional Chrome push only until first-party weekly used% is validated.

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- VS Code 1.95+ (for the editor extension)

---

## Getting started

```bash
pnpm install          # install all workspace dependencies
pnpm turbo build      # build all packages in dependency order
pnpm turbo test       # core pure-function tests
pnpm turbo type-check
```

### Install the VS Code extension

```bash
pnpm --filter ai-quota-tool-vscode run package   # produces a .vsix file
```

Then install the `.vsix` via **Extensions → Install from VSIX…** in VS Code. Run **AI Quota Tool: Set Up Accounts**.

### Publish to Visual Studio Marketplace (maintainers)

Manual GitHub Actions workflow **Publish VS Code extension** (version bump + `vsce publish`).  
Setup and dry-run steps: [`packages/vscode-ext/README.md`](packages/vscode-ext/README.md#publishing-maintainers).  
Publisher UI: https://marketplace.visualstudio.com/manage/publishers/basantpandey

### Optional: Chrome extension (legacy)

```bash
pnpm --filter @ai-quota-tool/chrome-ext build
```

Load `packages/chrome-ext/dist/` as unpacked in `chrome://extensions` if you want optional browser-session push. Not required for the V1 product bar.

---

## Development

```bash
# Preview shared UI components with mock data (localhost:5173)
pnpm --filter @ai-quota-tool/ui dev

# Typecheck / test / build
pnpm turbo type-check
pnpm turbo test
pnpm turbo build

# Watch mode for Chrome package (optional)
pnpm --filter @ai-quota-tool/chrome-ext dev

# Regenerate icons
node scripts/generate-icons.mjs
```

CI (GitHub Actions) runs install, type-check, test, and build on push/PR.

---

## Monorepo structure

```
packages/
  core/        Shared types, pure merge/mappers/honesty, utils (+ vitest)
  ui/          Shared React 19 components — no data fetching
  vscode-ext/  VS Code extension (V1 product surface)
  chrome-ext/  Optional Chrome MV3 package (not a V1 gate)
docs/
  ARCHITECTURE.md   Architecture and design decisions
  V1-SPEC.md        V1 product bar (VS Code only)
  GROK-SPEC.md      Consumer Grok product bar
  research/         Primary-source research notes
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/V1-SPEC.md`](docs/V1-SPEC.md), and [`docs/GROK-SPEC.md`](docs/GROK-SPEC.md).

---

## Status

| Task | Status |
|---|---|
| VS Code standalone poller + dashboard + status bar | Done (V1 bar) |
| Claude + Codex real usage mapping (core pure mappers) | Done |
| Honest Copilot (no fake 100% remaining) | Done |
| Credential clear / privacy disclosure (VS Code) | Done |
| Session auth failure re-auth cue (keep secret) | Done |
| Core unit tests + CI | Done |
| VS Code-only V1-SPEC rewrite | Done |
| Consumer Grok honesty path | Done (see GROK-SPEC; weekly % conditional) |
| Optional Chrome package | Present; not a V1 gate |
| Real Copilot remaining-% API (if GitHub ever exposes one) | Optional follow-up |
| Effect-TS migration | Post-v1 |
| Marketplace publish | Optional workflow (not a bar gate) |

---

## Stack

- TypeScript (strict mode throughout)
- pnpm + Turborepo monorepo
- React 19 + React Compiler (shared UI / webviews)
- TanStack Query v5 (where used)
- Vitest for core pure seams
