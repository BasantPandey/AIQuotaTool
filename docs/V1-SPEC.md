# V1 product bar - AI Quota Tool (VS Code only)

**Status:** Locked product bar for the **VS Code extension**.  
**Source:** [Spec: VS Code-only V1 honest quota bar](https://github.com/BasantPandey/AIQuotaTool/issues/25) plus wayfinder map [Map: V1 gap-closure specification](https://github.com/BasantPandey/AIQuotaTool/issues/1) (re-scoped VS Code-only).  
**Packages:** `0.7.2+` (`ai-quota-tool-vscode` and supporting `core` / `ui`).  
**Not this document:** Chrome extension as a first-class surface, Marketplace/CWS publish as a ship gate, Effect-TS, or requiring a real Copilot remaining-% API.  
**Grok:** separate bar - [`docs/GROK-SPEC.md`](./GROK-SPEC.md). Do not block this V1 bar on SuperGrok live weekly payload work.

---

## 1. Product story

AI Quota Tool’s **V1 product surface is the VS Code extension** (`ai-quota-tool-vscode`):

| Component | Role |
| --- | --- |
| **QuotaPoller** | Standalone Node fetch of Claude / Copilot / Codex using SecretStorage + GitHub OAuth |
| **Webview dashboard** | Shared UI cards for remaining rings and honest non-percentage states |
| **Status bar** | Min of defined session/weekly remaining; setup / re-auth cues |
| **Set Up Accounts** | Save & Test, replace, clear; privacy disclosure |

**Chrome is not required** for V1. A Chrome package may remain in the monorepo as optional/legacy (e.g. optional localhost WebSocket push) but is **not** a V1 acceptance surface, CI product gate, or implement target under this bar.

Services in this bar: **Claude**, **GitHub Copilot**, **OpenAI Codex**.

---

## 2. Requirements and acceptance

### 2.1 Standalone VS Code

| ID | Requirement | Acceptance |
| --- | --- | --- |
| V1 | Standalone first-class | VS Code shows Claude/Codex/Copilot with no Chrome installed |
| V2 | Poll refresh | `pollNow` after credential save and when opening the dashboard |
| V3 | Optional WS | If a localhost WS server still exists, it is **optional enrichment** only - not a ship dependency |
| V4 | Empty state | No credentials / no data → **Set Up Accounts** (not “Chrome not connected”) |

### 2.2 Claude and Codex

| ID | Requirement | Acceptance |
| --- | --- | --- |
| Q1 | Real usage mapping | Pure `mapClaudeUsage` / `mapCodexUsage` in `@ai-quota-tool/core`; host does not re-implement remaining math |
| Q2 | Session + weekly remaining | When API exposes windows, UI shows remaining % and reset times (Claude sub-buckets when present) |

### 2.3 Copilot honesty

| ID | Requirement | Acceptance |
| --- | --- | --- |
| C1 | No fake full remaining | Never invent `sessionPct`/`weeklyPct` of 100 when usage is unknown |
| C2 | Seat-only path | `GET /user/copilot` status → pure `mapCopilotSeatStatus` (no-plan / seat active usage unknown / auth unavailable) |
| C3 | No invented usage API | Do not call undocumented usage endpoints as a remaining-% source |

Research: [docs/research/copilot-usage-surfaces.md](./research/copilot-usage-surfaces.md).

### 2.4 Credentials and security

| ID | Requirement | Acceptance |
| --- | --- | --- |
| S1 | Honest storage story | VS Code **does store** Claude `sessionKey` + ChatGPT session token in SecretStorage |
| S2 | Forbidden claim | Product-wide “no credentials stored” is false and must not appear as truth |
| S3 | Lifecycle | Validate-before-persist (Save & Test), replace, explicit clear; GitHub via OAuth |
| S4 | Auth failure | Pure `sessionAuthFailureAction`: drop ring, **keep** secret, re-auth signal (status bar + dashboard + setup) |
| S5 | Disclosure | Persistent setup privacy warning + VS Code README |
| S6 | Hard rules | Never log secrets; no developer backend for credentials; SecretStorage only for session secrets |

Research: [docs/research/store-session-cookie-policy.md](./research/store-session-cookie-policy.md) (sensitivity of session cookies; store-publish package is post-V1).

### 2.5 Pressure UI

| ID | Requirement | Acceptance |
| --- | --- | --- |
| P1 | Honest pressure | `pressureRemaining` / `lowestPressureAmong` - honesty-only states never count as 100% |
| P2 | VS Code status bar | Min of defined session/weekly for labels and low-quota color |

### 2.6 Notifications

| ID | Requirement | Acceptance |
| --- | --- | --- |
| N1 | Reset alerts | **VS Code system reset notifications are not required** for V1 |

### 2.7 Quality spine

| ID | Requirement | Acceptance |
| --- | --- | --- |
| T1 | Core pure tests | Vitest on merge (if used), mappers, copilot honesty, session-auth, pressure |
| T2 | CI | GitHub Actions: install, type-check, test, build |
| T3 | Lint | Optional; do not block V1 on a large lint rewrite |
| T4 | Build path | Successful monorepo build for packages needed to ship VS Code (`core` → `ui` → `vscode-ext`) |

### 2.8 Docs

| ID | Requirement | Acceptance |
| --- | --- | --- |
| Doc1 | Root README + this file | VS Code primary / standalone; credentials truth; Chrome not a V1 gate |
| Doc2 | VS Code README + agent notes | Match real poller, honesty, SecretStorage lifecycle |
| Doc3 | Versions | VS Code packaging coherent (0.7.2+) |

---

## 3. Out of scope (this bar)

- **Chrome extension** as a first-class V1 acceptance surface (features, packaging, CWS, dual-mode equal ship story)
- Deleting the Chrome package from the monorepo (separate decision)
- Visual Studio Marketplace / Chrome Web Store **publish** as a bar gate
- Requiring a **real** Copilot remaining-quota % API
- Effect-TS migration
- Full extension E2E automation
- VS Code system reset notifications as a ship gate
- Grok SuperGrok live usage payload validation (see GROK-SPEC)

---

## 4. Ordered implementation backlog

### Done / largely present on main

1. Core pure mappers, Copilot honesty, session-auth policy, pressure + tests  
2. VS Code poller, credentials, dashboard, status bar, re-auth cues  
3. CI install / type-check / test / build  
4. VS Code setup privacy + README credentials section  

### Remaining / follow-on

1. Keep docs in sync with this VS Code-only bar  
2. ~~Reduce VS Code host fetch duplication~~ - shared `session-fetch` module (poller + Save & Test)  
3. Optional Copilot remaining % only if GitHub documents a real individual metric  
4. Marketplace publish via existing workflow when ready (not a bar gate) - pipeline implemented (`publish-vscode.yml`)  
5. ~~Close dual-mode wayfinder leftovers~~ - map #1 and tickets #7–#9 closed/superseded; dual-mode PRD #10 superseded by #25  


---

## 5. Core pure seams (tested)

| Seam | Role |
| --- | --- |
| `preferQuotaState` / `upsertQuotaState` / `mergeQuotaStates` | Optional merge (e.g. legacy WS); not a dual-mode ship gate |
| `mapClaudeUsage` / `mapCodexUsage` | API JSON → `QuotaState` remaining % |
| `copilot*` builders / `mapCopilotSeatStatus` | Honest non-percentage Copilot states |
| `sessionAuthFailureAction` | Claude/Codex 401 path: drop ring, keep secret, re-auth |
| `pressureRemaining` / `lowestPressureAmong` | Status pressure without inventing 100% |

---

## 6. Done when

V1 product bar is met when:

- VS Code standalone works without Chrome  
- Copilot never shows fake full remaining  
- Credentials docs and setup disclosure are truthful (secrets are stored)  
- Core pure seams are tested in CI  
- Claude/Codex still report real remaining where APIs succeed  
- Product docs do **not** require dual-mode equal for ship  

Marketplace publish is **not** required for this bar.
