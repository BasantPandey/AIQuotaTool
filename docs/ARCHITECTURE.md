# AI Quota Tool — Architecture

## Overview

AI Quota Tool monitors remaining session and weekly quotas for Claude Code, GitHub Copilot, and Codex. It ships as two extensions from a single TypeScript monorepo:

- **Chrome extension** — fetches quota data using the user's existing browser session (OAuth cookies). Displays a popup. Pushes data to VS Code.
- **VS Code extension** — displays the same quota UI inside a webview panel. Runs the WebSocket server that receives data from Chrome.

---

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Chrome)                  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │         Chrome Extension (MV3)               │   │
│  │                                              │   │
│  │  ┌─────────────────┐   ┌──────────────────┐  │   │
│  │  │ Service Worker  │   │     Popup        │  │   │
│  │  │                 │   │  (React + UI pkg)│  │   │
│  │  │ • ClaudeFetcher │   │                  │  │   │
│  │  │ • CopilotFetcher│──▶│  chrome.storage  │  │   │
│  │  │ • CodexFetcher  │   │  .local (read)   │  │   │
│  │  │                 │   └──────────────────┘  │   │
│  │  │ Polls every 60s │                          │   │
│  │  │ Writes to       │                          │   │
│  │  │ chrome.storage  │                          │   │
│  │  │                 │                          │   │
│  │  │ WS Client ──────┼──────────────────────────┼───┼──▶ localhost:54321
│  │  │ (pushes on poll)│                          │   │
│  │  │                 │                          │   │
│  │  │ Alarm Scheduler │                          │   │
│  │  │ (reset notifs)  │                          │   │
│  │  └─────────────────┘                          │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  Authenticated sessions: claude.ai, github.com,     │
│  openai.com  (cookies used automatically)           │
└─────────────────────────────────────────────────────┘

                         WS (ws://)
                    quota_update messages
                            │
                            ▼
┌─────────────────────────────────────────────────────┐
│                   VS Code (Node.js)                 │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │          VS Code Extension                   │   │
│  │                                              │   │
│  │  ┌──────────────┐   ┌───────────────────┐   │   │
│  │  │  WS Server   │   │   Webview Panel   │   │   │
│  │  │ :54321       │──▶│  (React + UI pkg) │   │   │
│  │  │              │   │                   │   │   │
│  │  │  In-memory   │   │  postMessage IPC  │   │   │
│  │  │  QuotaState[]│   └───────────────────┘   │   │
│  │  └──────────────┘                            │   │
│  │                                              │   │
│  │  ┌──────────────┐                            │   │
│  │  │ Status Bar   │  "Claude 3% | Codex 24%"  │   │
│  │  └──────────────┘                            │   │
│  │                                              │   │
│  │  Graceful degradation: shows "Chrome ext     │   │
│  │  not connected" when port 54321 is empty     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

1. **Poll (every 60 seconds)**: Chrome service worker calls each service's quota API using the user's existing auth cookies.
2. **Local storage**: Results written to `chrome.storage.local` — the popup reads from here independently of VS Code.
3. **Push to VS Code**: Service worker (as WebSocket client) sends a `quota_update` message to `ws://localhost:54321`. If VS Code is not running, the connection attempt silently fails; Chrome still works standalone.
4. **VS Code display**: WS server receives the message, updates in-memory state, and `postMessage`s the new data into the webview. Status bar item also updates.
5. **Notifications**: Chrome `chrome.alarms` API fires at each service's reset timestamp. On alarm, `chrome.notifications.create` shows a system notification.

---

## WebSocket Protocol

Messages are JSON-serialized `WsMessage` (defined in `packages/core`).

```
Chrome → VS Code:
  { type: "quota_update", payload: QuotaState[] }
  { type: "ping" }

VS Code → Chrome:
  { type: "pong" }
  { type: "error", message: string }
```

VS Code is a passive data sink — it never initiates a push to Chrome.

---

## IPC: Why VS Code runs the server

Chrome Manifest V3 service workers **cannot** bind TCP ports or run a server. They can only initiate outbound connections. VS Code extensions run in Node.js and can bind any localhost port. This dictates the topology: VS Code = server, Chrome = client.

---

## Package Structure

```
AIQuotaTool/
├── package.json              # root (private, scripts only)
├── pnpm-workspace.yaml       # workspace: packages/*
├── turbo.json                # build pipeline
├── tsconfig.base.json        # shared TS compiler options
├── docs/
│   └── ARCHITECTURE.md       # this file
└── packages/
    ├── core/                 # shared types + pure utilities
    │   └── src/
    │       ├── types.ts      # QuotaState, WsMessage, ServiceId, ClaudeSubcategory
    │       ├── utils.ts      # formatTimeRemaining, calcPct
    │       └── index.ts
    │
    ├── ui/                   # shared React components (no data fetching)
    │   └── src/
    │       ├── components/
    │       │   ├── QuotaCard.tsx
    │       │   ├── ProgressRing.tsx
    │       │   ├── SubcategoryRow.tsx
    │       │   └── ServiceHeader.tsx
    │       ├── QuotaDashboard.tsx   # root component (list of QuotaCards)
    │       ├── dev.tsx              # Vite dev-server entry with mock data
    │       └── index.ts
    │
    ├── chrome-ext/           # Chrome Manifest V3 extension
    │   ├── manifest.json
    │   └── src/
    │       ├── background/
    │       │   ├── worker.ts         # entry: poll loop, orchestrates all below
    │       │   ├── ws-client.ts      # WebSocket client → VS Code
    │       │   ├── notifications.ts  # chrome.alarms + chrome.notifications
    │       │   └── fetchers/
    │       │       ├── base.ts       # ServiceFetcher interface
    │       │       ├── claude.ts     # ClaudeFetcher (TODO: real endpoint)
    │       │       ├── copilot.ts    # CopilotFetcher (TODO: real endpoint)
    │       │       └── codex.ts      # CodexFetcher (TODO: real endpoint)
    │       └── popup/
    │           ├── index.html
    │           └── index.tsx         # reads chrome.storage.local → QuotaDashboard
    │
    └── vscode-ext/           # VS Code extension
        └── src/
            ├── extension.ts          # activate/deactivate entry
            ├── ws-server.ts          # WebSocket server on :54321
            ├── quota-panel.ts        # WebviewPanel host
            └── status-bar.ts         # StatusBarItem
```

---

## Data Model (`packages/core/src/types.ts`)

```typescript
type ServiceId = 'claude' | 'copilot' | 'codex';

interface ClaudeSubcategory {
  name: 'Sonnet' | 'Designs' | 'Daily Routines';
  usedPct: number;   // 0–100, percentage USED
  label: string;     // display string, e.g. "97% left"
}

interface QuotaState {
  service: ServiceId;
  sessionPct: number;       // 0–100, percentage REMAINING
  weeklyPct: number;        // 0–100, percentage REMAINING
  sessionResetsAt: number;  // Unix timestamp (ms)
  weeklyResetsAt: number;   // Unix timestamp (ms)
  subcategories?: ClaudeSubcategory[];  // Claude-only
  lastUpdated: number;      // Unix timestamp (ms)
}

type WsMessage =
  | { type: 'quota_update'; payload: QuotaState[] }
  | { type: 'ping' }
  | { type: 'pong' }
  | { type: 'error'; message: string };
```

---

## Security Model

- **No credential storage.** Chrome uses existing browser session cookies — the extension never sees passwords.
- **Localhost-only WebSocket.** The VS Code server binds only `127.0.0.1:54321`, not `0.0.0.0`. No external access.
- **Minimal permissions.** Chrome extension requests only the specific host permissions needed for each service's API endpoint (added during endpoint discovery phase).
- **Local-only data.** All quota data lives in `chrome.storage.local` and VS Code in-memory state. Nothing leaves the machine.

---

## Open Tasks (Engineering)

| # | Task | Status |
|---|------|--------|
| 1 | Endpoint discovery — find real API URLs + response shapes for Claude, Copilot, Codex | **TODO** |
| 2 | Implement `ClaudeFetcher`, `CopilotFetcher`, `CodexFetcher` with real endpoints | Blocked by #1 |
| 3 | Verify MV3 service worker can maintain a persistent WebSocket client connection | **TODO** |
| 4 | Publish to Chrome Web Store and VS Code Marketplace | Post-v1 |
