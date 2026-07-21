# V1 product bar - AI Quota Tool

**Status:** Implemented product bar (packages at 0.7.1).  
**Source:** [Spec: V1 dual-mode honest quota bar (gap closure)](https://github.com/BasantPandey/AIQuotaTool/issues/10) plus wayfinder map [Map: V1 gap-closure specification](https://github.com/BasantPandey/AIQuotaTool/issues/1) decisions.  
**Not this document:** Marketplace / Chrome Web Store publish, Effect-TS, or requiring a real Copilot remaining-% API.

---

## 1. Product story

AI Quota Tool is a **dual-mode equal** monorepo:

| Surface | Role |
| --- | --- |
| **Chrome MV3 extension** | First-class: browser session cookies + content scripts + popup; optional WS **client** push to VS Code |
| **VS Code extension** | First-class: SecretStorage session secrets + Node poller + webview + status bar; optional WS **server** on `127.0.0.1:54321` |

Either works alone. Together they merge readings with **freshest-wins by `lastUpdated`**. WebSocket is optional enrichment, never a hard dependency.

Services: **Claude**, **GitHub Copilot**, **OpenAI Codex**.

---

## 2. Requirements and acceptance

### 2.1 Dual-mode and merge

| ID | Requirement | Acceptance |
| --- | --- | --- |
| D1 | Chrome and VS Code both first-class | Each surface can show Claude/Codex without the other extension |
| D2 | Optional WS bridge | VS Code poller works with no Chrome; Chrome popup works with no VS Code; WS URL is `ws://127.0.0.1:54321` |
| D3 | Freshest-wins | Same service: higher `lastUpdated` wins; equal time prefers richer defined fields (`preferQuotaState` / `mergeQuotaStates`) |
| D4 | Chrome partial poll | Failed services do not wipe successful/other stored readings (`mergeQuotaStates`) |
| D5 | Chrome content scripts | claude.ai / chatgpt.com bridge can push quota when SW fetch is blocked |
| D6 | Chrome alarms | Poll and WS keepalive alarms recreated on install, startup, and SW wake |
| D7 | VS Code poll refresh | `pollNow` after credential save and when opening the dashboard |

### 2.2 Claude and Codex

| ID | Requirement | Acceptance |
| --- | --- | --- |
| Q1 | Real usage mapping | Shared pure `mapClaudeUsage` / `mapCodexUsage` in `@ai-quota-tool/core`; hosts do not re-implement remaining math |
| Q2 | Session + weekly remaining | When API exposes windows, UI shows remaining % and reset times (and Claude sub-buckets when present) |

### 2.3 Copilot honesty

| ID | Requirement | Acceptance |
| --- | --- | --- |
| C1 | No fake full remaining | Never invent `sessionPct`/`weeklyPct` of 100 when usage is unknown |
| C2 | Seat-only path | `GET /user/copilot` status → pure `mapCopilotSeatStatus` (no-plan / seat active usage unknown / auth unavailable) |
| C3 | No undocumented usage % API | Chrome must not call undocumented `/user/copilot/usage` as a V1 remaining source |

Research: [docs/research/copilot-usage-surfaces.md](./research/copilot-usage-surfaces.md).

### 2.4 Credentials and security

| ID | Requirement | Acceptance |
| --- | --- | --- |
| S1 | Two honest paths | Chrome: live browser sessions, **does not** store session keys. VS Code: **does** store Claude `sessionKey` + ChatGPT session token in SecretStorage |
| S2 | Forbidden claim | Product-wide "no credentials stored" is false and must not appear as truth |
| S3 | VS Code lifecycle | Validate-before-persist (Save & Test), replace, explicit clear; GitHub via OAuth |
| S4 | Auth failure (Claude/Codex) | Pure `sessionAuthFailureAction`: drop ring, **keep** secret, require re-auth signal (status bar + dashboard + setup) |
| S5 | Disclosure | VS Code: persistent setup privacy warning + README. Chrome: Settings privacy disclosure. Localhost WS spoof disclosed |
| S6 | Hard rules | Never log secrets; no developer backend for credentials; SecretStorage only for VS Code session secrets; Chrome must not persist session keys as auth secrets in `chrome.storage` |

Research: [docs/research/store-session-cookie-policy.md](./research/store-session-cookie-policy.md).

### 2.5 Pressure UI

| ID | Requirement | Acceptance |
| --- | --- | --- |
| P1 | Honest pressure | `pressureRemaining` / `lowestPressureAmong` - honesty-only states never count as 100% |
| P2 | Chrome badge | Red/amber `!` only from real remaining %; clear when none |
| P3 | VS Code status bar | Min of defined session/weekly for labels and low-quota color |

### 2.6 Notifications

| ID | Requirement | Acceptance |
| --- | --- | --- |
| N1 | Reset alerts | **Chrome owns** reset notifications for V1; VS Code system reset notifications are not required |

### 2.7 Quality spine and packaging

| ID | Requirement | Acceptance |
| --- | --- | --- |
| T1 | Core pure tests | Vitest on merge, mappers, copilot honesty, session-auth, pressure |
| T2 | CI | GitHub Actions: install, type-check, test, build |
| T3 | Lint | Optional; do not block V1 on a large lint rewrite |
| T4 | Permission hygiene | Chrome: only needed permissions/hosts (no unused `cookies` API, no unused page hosts) |

### 2.8 Docs

| ID | Requirement | Acceptance |
| --- | --- | --- |
| Doc1 | Root README + ARCHITECTURE | Dual-mode equal, credentials truth, merge rule, security model |
| Doc2 | Package agent notes | Match real fetchers / poller / honesty (no "all placeholders") |
| Doc3 | CHANGELOG / versions | VS Code + Chrome packaging coherent (0.7.1+) |

---

## 3. Out of scope (this bar)

- Chrome Web Store / VS Code Marketplace **publish** (privacy policy URL, CWS Limited Use certification, full affirmative consent UX - post-V1 backlog)
- Requiring a **real** Copilot remaining-quota % API
- Effect-TS migration
- Authenticated localhost WebSocket (disclose-only local trust for V1)
- Full extension E2E automation
- VS Code reset notifications as a ship gate

---

## 4. Ordered implementation backlog (for follow-on work)

Most of this bar is **already implemented** on `main` (0.7.1). Remaining / post-V1 items:

1. **Store publish package** - privacy policy artifact, CWS dashboard fields, Marketplace privacy; use research notes under `docs/research/`
2. **Optional Copilot remaining** - only if GitHub documents a real individual remaining metric; keep honesty builders until then
3. **Reduce host fetch duplication** - Claude/Codex validate vs poll fetch still duplicated in VS Code host (pure mappers already shared)
4. **Close wayfinder map tickets** - product decisions above supersede open grilling for implementation; close or re-scope map when this file is accepted as destination
5. **Lint** - add only if low-cost and non-blocking

---

## 5. Core pure seams (tested)

| Seam | Role |
| --- | --- |
| `preferQuotaState` / `upsertQuotaState` / `mergeQuotaStates` | Freshest-wins dual-source merge |
| `mapClaudeUsage` / `mapCodexUsage` | API JSON → `QuotaState` remaining % |
| `copilot*` builders / `mapCopilotSeatStatus` | Honest non-percentage Copilot states |
| `sessionAuthFailureAction` | Claude/Codex 401 path: drop ring, keep secret, re-auth |
| `pressureRemaining` / `lowestPressureAmong` | Badge/status pressure without inventing 100% |

---

## 6. Done when

V1 product bar is met when:

- Dual-mode works alone or together with freshest-wins  
- Copilot never shows fake full remaining  
- Credentials and architecture docs are truthful  
- Core pure seams are tested in CI  
- Claude/Codex still report real remaining where APIs succeed  

Marketplace publish is **not** required for this bar.
