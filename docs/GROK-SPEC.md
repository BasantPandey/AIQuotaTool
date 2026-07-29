# Grok consumer product bar - AI Quota Tool

**Status:** **Locked product bar** (wayfinder destination).  
**Path:** `docs/GROK-SPEC.md`  
**Map:** [Map: Grok consumer usage product bar](https://github.com/BasantPandey/AIQuotaTool/issues/19)

**Sources (decisions live on tickets; this file is the assembled bar):**

| Ticket | Role |
| --- | --- |
| [Research: Grok consumer usage surfaces and honest limits](https://github.com/BasantPandey/AIQuotaTool/issues/20) | Surfaces, go/no-go for remaining % |
| [Grilling: Grok dual-mode auth path for product bar](https://github.com/BasantPandey/AIQuotaTool/issues/21) | Chrome / VS Code auth |
| [Grilling: Grok card UX and effort/remaining honesty](https://github.com/BasantPandey/AIQuotaTool/issues/22) | Card known vs unknown, effort, tiers |
| [Grilling: Grok ServiceId and domain model for product bar](https://github.com/BasantPandey/AIQuotaTool/issues/23) | ServiceId, honesty enum, windows |
| Research note | [`docs/research/grok-consumer-usage-surfaces.md`](./research/grok-consumer-usage-surfaces.md) |

**Not this document:** xAI developer API RPS/TPM as the primary card; inventing free-tier message caps; Chrome Web Store / Marketplace publish for a Grok-enabled release; Effect-TS; other new services.

**Implementation note:** Dual-mode wiring may already exist on `main` (honesty-first). This bar locks **product acceptance**. Live SuperGrok weekly % remains **conditional** until a first-party Settings → Usage payload is validated.

---

## 1. Product story

AI Quota Tool treats **consumer Grok** (grok.com web / SuperGrok-style subscription usage) as a **fourth dual-mode service** alongside Claude, Copilot, and Codex.

| Surface | Grok role |
| --- | --- |
| **Chrome MV3** | First-class: live **grok.com** browser session only; never store Grok session keys as auth secrets |
| **VS Code** | Always shows a Grok slot; **no** Grok SecretStorage / Set Up Accounts paste. State from Chrome WS push or honesty-only + deep-link `https://grok.com` |

Either surface can show Grok honestly alone (Chrome: connected/unknown or weekly when known; VS Code alone: “use Chrome”). Together, Chrome can push fresher Grok `QuotaState` over `ws://127.0.0.1:54321` with **freshest-wins** merge.

**Never invent remaining %** (especially never invent `100` when usage is unknown).

---

## 2. Requirements and acceptance

### 2.1 Auth and dual-mode

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-A1 | Chrome live session | Host permission + session-backed fetch for **grok.com** only; no Grok keys in `chrome.storage` as auth secrets |
| G-A2 | Host scope | **grok.com** only for this bar; **x.com** Grok deferred |
| G-A3 | No VS Code Grok secret | Set Up Accounts has no Grok paste field; SecretStorage has no Grok key |
| G-A4 | VS Code presence | Dashboard always includes a Grok row (Chrome merge or `browser_session_required` honesty) |
| G-A5 | Deep-link | Honesty / unknown UI offers open **https://grok.com** (no guessed Settings deep path required) |
| G-A6 | Auth failure | Chrome: clear stale remaining on not-connected; no “keep secret + re-auth paste”. VS Code: no Grok re-auth secret flow. Grok is **not** an `isSessionCookieService` |
| G-A7 | Disclosure | Dual-path honesty: Chrome Settings + VS Code README / setup privacy - live grok.com session; VS Code does not store Grok secrets |

### 2.2 Usage honesty and remaining %

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-U1 | No public consumer remaining API | Do not claim a documented third-party remaining-% REST API exists |
| G-U2 | Conditional weekly % | Map SuperGrok weekly **used % → remaining %** only from first-party used% in **0–100** (pure `mapGrokWeeklyUsage` or equivalent). Invalid/out-of-range → honesty, not clamped invent |
| G-U3 | Fail closed | Missing/invalid payload → honesty (`usage_unknown` / `not_connected` / `browser_session_required`); never invent rings |
| G-U4 | Free / Premium short windows | No hardcoded “N messages / 2h” or blog caps. Honesty only. Card still shown for free users |
| G-U5 | Effort / mode buckets | **No effort UI.** No DEFAULT/REASONING/DEEPSEARCH absolute caps. No product commitment to third-party mode counters |
| G-U6 | Weekly empty ≠ total lockout | Weekly **0%** shows as 0% remaining (+ reset if known). Do **not** claim Grok is fully unusable solely from weekly exhaustion (free Chat/Voice may remain) |
| G-U7 | Developer API | Out of scope for the consumer Grok card |
| G-U8 | Session window | **No** Grok `sessionPct` for this bar (weekly only when known) |

### 2.3 Domain model

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-D1 | ServiceId | `ServiceId` includes `'grok'` as peer of claude / copilot / codex |
| G-D2 | Labels / URL | `SERVICE_LABELS.grok` = Grok; `SERVICE_URLS.grok` = `grok.com`; distinct color |
| G-D3 | Honesty values | Extend shared `QuotaHonesty` with `usage_unknown`, `not_connected`, `browser_session_required`; keep Copilot seat values; do not overload seat labels for Grok |
| G-D4 | Merge / pressure | Existing freshest-wins merge and pressure helpers apply; honesty never counts as 100% pressure |
| G-D5 | Subcategories | Not required for Grok bar; Claude sub-buckets stay Claude-only |
| G-D6 | Windows | Known SuperGrok pool → `weeklyPct` + optional `weeklyResetsAt` only |

### 2.4 UI

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-I1 | Dashboard card | Shared UI lists Grok with other services |
| G-I2 | Known weekly | When `weeklyPct` present: weekly ring + optional reset; no session ring; no effort/mode sub-rows |
| G-I3 | Unknown / honesty | Honesty label + deep-link; no fake rings |
| G-I4 | Pending / VS Code alone | Hint: Chrome on grok.com; VS Code does not store Grok secrets |
| G-I5 | Tier copy | Card title **Grok** only for this bar; SuperGrok / X Premium badges deferred until first-party plan signal |

### 2.5 Quality

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-T1 | Pure seam tests | Vitest (or equivalent) on Grok honesty builders, weekly map, session-auth exclusion of Grok |
| G-T2 | Hosts thin | Chrome/VS Code call pure core mapping; do not re-implement remaining math in hosts |

---

## 3. Core pure seams (product-level)

| Seam | Role |
| --- | --- |
| Grok honesty builders | `usage_unknown` / `not_connected` / `browser_session_required` → `QuotaState` without % |
| Weekly map | First-party used% (0–100) → `weeklyPct` remaining (+ optional reset) |
| Optional extract | Parse usage-shaped JSON only when fields are explicit used% in 0–100 |
| Session-cookie policy | Claude/Codex only; Grok false |
| Merge / pressure | Service-agnostic; honesty never invents full remaining |

---

## 4. Ordered implement backlog

### Bar acceptance (product)

1. Auth dual-mode as G-A*  
2. Honesty + weekly mapping as G-U* / G-D*  
3. UI as G-I*  
4. Pure seams tested as G-T*  
5. This locked bar document  

### Follow-on engineering (after bar; not required to lock the bar)

1. Capture first-party Settings → Usage JSON schema from a SuperGrok session  
2. Wire proven payload through weekly map (Chrome fetcher and/or content bridge)  
3. Optional product breakdown UI if payload + product re-scope  
4. Tier badges only from first-party plan label  
5. Logo/branding polish if needed  
6. Marketplace / store listing copy for a Grok-enabled release  

### Explicitly deferred

- x.com as auth host  
- VS Code paste of grok.com cookies into SecretStorage  
- Developer API key as consumer Grok  
- Invented free-tier or Premium absolute message caps  
- Effort meter / mode remaining gauges without first-party numbers  

---

## 5. Out of scope (this bar)

- Implementing product code **as part of the wayfinder map** (map destination is this written bar; separate implement efforts may land code)  
- Chrome Web Store / Marketplace **publish** for a Grok-enabled build  
- Primary bar for **xAI API developer** rate limits (RPS/TPM)  
- Effect-TS migration  
- Other new services beyond Grok  
- Automating login, bypassing rate limits, or scraping behind CAPTCHA  

---

## 6. Done when

This **product bar** is met when:

1. Dual-mode auth story for Grok is locked and truthful (Chrome live session; no VS Code Grok secret)  
2. Grok never shows invented remaining % (especially never 100% when unknown)  
3. Domain model locks `grok` ServiceId, honesty values, weekly-only window, no required subcategories  
4. Card UX locks weekly ring when known; honesty when unknown; no effort UI; Grok title only  
5. Ordered backlog and out of scope are written  
6. This file is the canonical assembled artifact linked from the map  

**Ship-quality honesty-only Grok** (no weekly ring until payload validation) is an **acceptable** state under this bar. Live SuperGrok weekly % is a **conditional** enhancement after first-party payload proof.
