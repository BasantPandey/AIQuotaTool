# AI Quota Tool — Architecture

## Overview

AI Quota Tool monitors remaining session and weekly quotas for **Claude**, **GitHub Copilot**, **Codex**, and **Grok**.

**V1 product surface:** the **VS Code extension** (standalone poller, SecretStorage, webview, status bar). See [`docs/V1-SPEC.md`](./V1-SPEC.md).

- **VS Code extension** — first-class: SecretStorage session secrets + GitHub OAuth, Node poller, webview, status bar; optional WebSocket **server** on `127.0.0.1:54321` (legacy Chrome push only).
- **Chrome extension** — optional / legacy monorepo package (browser session cookies, popup, optional WS **client**). **Not** a V1 acceptance gate.

Shared `QuotaState` model in `@ai-quota-tool/core`. Optional dual-source merge uses **freshest-wins** by `lastUpdated` when Chrome push is present.

---

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Browser (Chrome)                  │
│  ┌──────────────────────────────────────────────┐   │
│  │         Chrome Extension (MV3)               │   │
│  │  Service worker: fetchers + alarms           │   │
│  │  Content scripts: claude.ai / chatgpt.com    │   │
│  │  chrome.storage.local ← freshest-wins merge  │   │
│  │  Popup (React + @ai-quota-tool/ui)           │   │
│  │  WS client ──────────────────────────────────┼───┼──▶ 127.0.0.1:54321
│  └──────────────────────────────────────────────┘   │
│  Cookies: claude.ai, github.com, chatgpt.com,       │
│           grok.com (live session; keys not stored)  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   VS Code (Node.js)                 │
│  ┌──────────────────────────────────────────────┐   │
│  │  QuotaPoller (SecretStorage + GitHub OAuth)  │   │
│  │  WS server :54321 (optional Chrome push)     │   │
│  │  upsert/merge freshest-wins                  │   │
│  │  Webview + status bar (shared UI pkg)        │   │
│  │  Credential setup (session keys / clear)     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

### Chrome
1. Poll every ~60s (`chrome.alarms`) — Claude, Copilot, Codex, Grok fetchers via `Promise.allSettled`.
2. Content scripts on claude.ai / chatgpt.com push fresher page-origin readings.
3. Merge into `chrome.storage.local` with `mergeQuotaStates` / `upsertQuotaState` (do not wipe other services on partial poll).
4. Popup reads storage; optional `quota_update` to VS Code.
5. Reset alarms → Chrome notifications (VS Code does not own reset notifications in V1).
6. **Grok:** live `grok.com` session only; honesty-first until SuperGrok weekly used% payload is validated; never store session keys.

### VS Code
1. `QuotaPoller` every 60s using stored Claude/Codex/Grok secrets and GitHub OAuth token.
2. Pure mappers: `mapClaudeUsage` / `mapCodexUsage` / `mapGrokRateLimits` (+ weekly combine) from `@ai-quota-tool/core`.
3. Copilot: honest builders when remaining % is unavailable (no fake 100%).
4. **Grok:** SecretStorage `sso` cookie → `POST /rest/rate-limits` (+ SuperGrok weekly when available). No secret and no fresher Chrome push → inject `grokBrowserSessionRequired` so the slot is always present.
5. Chrome WS payloads merge with `upsertQuotaState` (freshest-wins).
6. Status bar shows min(session, weekly) remaining; amber below 10%. Empty → Set Up Accounts.

### Merge rule
- Higher `lastUpdated` wins for the same `service`.
- Equal timestamps: prefer richer optional fields (`sessionPct`, `weeklyPct`, resets, subcategories, `honesty`).
- Equal richness: prefer incoming.

---

## WebSocket Protocol

Messages are JSON-serialized `WsMessage` (`packages/core`).

```
Chrome → VS Code:
  { type: "quota_update", payload: QuotaState[] }
  { type: "ping" }

VS Code → Chrome:
  { type: "pong" }
  { type: "error", message: string }
```

VS Code does not push to Chrome. Localhost only (`127.0.0.1`). Any local process could spoof the channel — documented local-trust model.

---

## IPC: Why VS Code runs the server

Chrome Manifest V3 service workers **cannot** bind TCP ports. VS Code extensions run in Node.js and can. Topology: VS Code = server, Chrome = client.

---

## Package Structure

```
AIQuotaTool/
├── packages/
│   ├── core/           # types, merge, mappers, copilot/grok honesty, utils (+ vitest)
│   ├── ui/             # pure React display
│   ├── chrome-ext/     # MV3 worker, content scripts, popup
│   └── vscode-ext/     # poller, credentials, WS, webviews, status bar
└── docs/ARCHITECTURE.md
```

### Core exports (high value)
- `QuotaState`, `QuotaHonesty`, `WsMessage`, `ServiceId`
- `mergeQuotaStates`, `upsertQuotaState`, `preferQuotaState`
- `mapClaudeUsage`, `mapCodexUsage`
- `copilotSeatActiveUsageUnknown`, `copilotNoPlan`, `copilotAuthUnavailable`
- `grokUsageUnknown`, `grokNotConnected`, `grokBrowserSessionRequired`, `mapGrokWeeklyUsage`
- `calcPct`, `formatTimeRemaining`, `pctToColor`

---

## Data Model (`packages/core/src/types.ts`)

```typescript
type ServiceId = 'claude' | 'copilot' | 'codex' | 'grok';

type QuotaHonesty =
  | 'seat_active_usage_unknown'
  | 'no_plan'
  | 'auth_unavailable'
  | 'usage_unknown'
  | 'not_connected'
  | 'browser_session_required';

interface QuotaState {
  service: ServiceId;
  sessionPct?: number;       // 0–100 REMAINING; omit if unknown
  weeklyPct?: number;
  sessionResetsAt?: number;
  weeklyResetsAt?: number;
  subcategories?: ClaudeSubcategory[];
  honesty?: QuotaHonesty;    // when percentages intentionally absent
  lastUpdated: number;
}
```

---

## Product bars

- V1 (**VS Code only**, Claude / Copilot / Codex): [`docs/V1-SPEC.md`](./V1-SPEC.md)
- Consumer Grok: [`docs/GROK-SPEC.md`](./GROK-SPEC.md)
- Research notes: [`docs/research/`](./research/)

---

## Security Model

Product-wide “no credentials stored” is **false**.

- **VS Code (V1 bar):** **does store** Claude `sessionKey`, ChatGPT session tokens, and Grok `sso` cookies in SecretStorage — password-grade secrets. GitHub Copilot uses VS Code OAuth. Lifecycle: validate-before-persist (Save & Test), replace, explicit clear. On 401/403: drop the ring, **keep** the secret, re-auth signal — never invent full remaining. Pure policy: `sessionAuthFailureAction` in `@ai-quota-tool/core` (Claude/Codex/Grok).
- **Chrome (optional package):** may use live browser sessions without storing session keys; not a V1 gate. Grok on Chrome uses live `grok.com` session + `/rest/rate-limits` if that package is used.
- **Localhost WebSocket** (optional): `127.0.0.1` only; any process on the machine could spoof the channel (disclosed local-trust model). Not required for VS Code standalone.
- **Hard rules:** never log secrets; no developer backend for credentials/quota; VS Code session secrets only in SecretStorage.
- **Store publish** is post-V1 bar; product + README disclosure is the V1 bar.

---

## Chrome Extension Badge

After each poll, `updateBadge` in `worker.ts` uses `lowestPressureAmong` from core:
- Red `!` — any defined remaining below 5%
- Amber `!` — below 10%
- Clear — otherwise, or when every state is honesty-only / has no remaining %  
(Honesty-only states never invent 100% remaining for badge math.)

---

## VS Code empty / setup state

When there is no quota state (and optional Chrome disconnect leaves no polled data):
- Status bar: **Set up accounts** (setup command)
- Dashboard: dual-mode empty copy (VS Code Set Up Accounts **or** Chrome signed-in sessions)

Not Chrome-only “not connected” as the primary story.

---

## Open Tasks (Engineering)

| # | Task | Status |
|---|------|--------|
| 1 | Claude usage mapping | Done |
| 2 | Codex usage mapping | Done |
| 3 | Dual-mode poller + credentials | Done |
| 4 | Freshest-wins merge | Done |
| 5 | Honest Copilot (no fake remaining %) | Done |
| 6 | Core tests + CI | Done |
| 7 | Real Copilot remaining-% if GitHub exposes a public API | Optional |
| 8 | Effect-TS typed errors | Post-v1 |
| 9 | Store publish (CWS + Marketplace) | Post-v1 |
