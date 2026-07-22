# Grok consumer product bar - AI Quota Tool

**Status:** Product bar + initial dual-mode wiring (honesty-first).  
**Sources:**
- [Map: Grok consumer usage product bar](https://github.com/BasantPandey/AIQuotaTool/issues/19)
- [Research: Grok consumer usage surfaces and honest limits](https://github.com/BasantPandey/AIQuotaTool/issues/20)
- [Grilling: Grok dual-mode auth path for product bar](https://github.com/BasantPandey/AIQuotaTool/issues/21)
- Research note: [`docs/research/grok-consumer-usage-surfaces.md`](./research/grok-consumer-usage-surfaces.md)

**Not this document:** xAI developer API RPS/TPM as the primary card; implementing reverse-engineered free-tier message caps; store publish for a Grok-enabled release.

---

## 1. Product story

AI Quota Tool treats **consumer Grok** (grok.com web / SuperGrok-style subscription usage) as a **fourth dual-mode service** alongside Claude, Copilot, and Codex.

| Surface | Grok role |
| --- | --- |
| **Chrome MV3** | First-class: live **grok.com** browser session only; never store Grok session keys |
| **VS Code** | Always shows a Grok slot; **no** Grok SecretStorage / setup paste. State from Chrome WS push or honesty-only + deep-link `https://grok.com` |

Either surface can show Grok honestly alone (Chrome may show connected/unknown; VS Code alone shows “use Chrome”). Together, Chrome can push fresher Grok `QuotaState` over `ws://127.0.0.1:54321` with freshest-wins merge.

**Never invent remaining %** (especially never invent `100` when usage is unknown).

---

## 2. Requirements and acceptance

### 2.1 Auth and dual-mode

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-A1 | Chrome live session | Host permission + `credentials: 'include'` for **grok.com** only; no Grok keys in `chrome.storage` as auth secrets |
| G-A2 | Host scope | **grok.com** only for V1; **x.com** Grok deferred |
| G-A3 | No VS Code Grok secret | Set Up Accounts has no Grok paste field; SecretStorage has no Grok key |
| G-A4 | VS Code presence | Dashboard always includes a Grok row (Chrome merge or `browser_session_required` honesty) |
| G-A5 | Deep-link | Honesty UI offers open **https://grok.com** |
| G-A6 | Auth failure | Chrome: drop stale remaining on not-connected; no “keep secret + re-auth paste”. VS Code: no Grok re-auth secret flow. Grok is **not** an `isSessionCookieService` |
| G-A7 | Disclosure | Chrome Settings + VS Code README: live grok.com session; VS Code does not store Grok secrets |

### 2.2 Usage honesty and remaining %

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-U1 | No public consumer remaining API | Do not claim a documented third-party remaining-% REST API exists |
| G-U2 | Conditional weekly % | Map SuperGrok weekly **used % → remaining %** only from first-party used% in **0–100** via pure `mapGrokWeeklyUsage` |
| G-U3 | Fail closed | Missing/invalid payload → honesty (`usage_unknown` / `not_connected` / `browser_session_required`); never invent rings |
| G-U4 | Free / Premium short windows | No hardcoded “N messages / 2h” or blog caps as remaining math |
| G-U5 | Mode / effort buckets | No product commitment to DEFAULT/REASONING/DEEPSEARCH absolute caps (third-party only). No subcategory effort breakdown required for this bar |
| G-U6 | Weekly empty ≠ total lockout | Do not treat weekly 0% as “cannot use Grok at all” without distinguishing free-tier fallback (copy/honesty when detectable later) |
| G-U7 | Developer API | Out of scope for the consumer Grok card |

### 2.3 Domain model

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-D1 | ServiceId | `ServiceId` includes `'grok'` |
| G-D2 | Labels / URL | `SERVICE_LABELS.grok`, `SERVICE_URLS.grok` = `grok.com`, distinct `SERVICE_COLORS` |
| G-D3 | Honesty values | Reuse family pattern; Grok uses `usage_unknown`, `not_connected`, `browser_session_required` (plus existing Copilot values unchanged) |
| G-D4 | Merge / pressure | Existing `mergeQuotaStates` / `pressureRemaining` apply; honesty never counts as 100% pressure |
| G-D5 | Subcategories | Not required for Grok bar (Claude-only sub-buckets stay Claude) |

### 2.4 UI

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-I1 | Dashboard card | Shared UI lists Grok with other services |
| G-I2 | Known weekly | When `weeklyPct` present, show weekly ring + optional reset (same card pattern as other services) |
| G-I3 | Unknown | Honesty label + deep-link; no fake rings |
| G-I4 | Pending | Pending hint: Chrome on grok.com; VS Code does not store Grok secrets |

### 2.5 Quality

| ID | Requirement | Acceptance |
| --- | --- | --- |
| G-T1 | Pure seam tests | Vitest on Grok builders, `mapGrokWeeklyUsage`, `extractGrokWeeklyUsage`, session-auth exclusion |
| G-T2 | Hosts thin | Chrome/VS Code call pure core functions; do not re-implement remaining math |

---

## 3. Core pure seams

| Seam | Role |
| --- | --- |
| `grokUsageUnknown` / `grokNotConnected` / `grokBrowserSessionRequired` | Honest non-percentage states |
| `mapGrokWeeklyUsage` | First-party used% → `weeklyPct` remaining |
| `extractGrokWeeklyUsage` | Best-effort parse of usage-shaped JSON (only 0–100 used% fields) |
| `isSessionCookieService` | Remains Claude/Codex only (Grok false) |
| Merge / pressure | Unchanged; service-agnostic |

---

## 4. Ordered implement backlog

### Done (this bar’s initial wiring)

1. Add `grok` to domain types, labels, colors, URLs  
2. Pure Grok honesty + weekly mapper + tests  
3. Chrome `GrokFetcher` (honesty-first live session) + host permission + Settings disclosure  
4. VS Code always-on Grok slot (WS merge or `browser_session_required`) + README  
5. Shared UI card / logo / deep-link  
6. This product bar document  

### Next (after live validation)

1. Capture first-party Settings → Usage JSON schema from a SuperGrok session  
2. Map proven payload through `mapGrokWeeklyUsage` (Chrome fetcher or content bridge)  
3. Optional product breakdown copy (Chat / Imagine / Voice / …) if fields are stable  
4. Tier language in UI (SuperGrok / free) only from first-party signals  
5. Logo/branding polish if needed  
6. Package version bump + store listing copy when shipping a Grok-enabled release  

### Explicitly deferred

- x.com as auth host  
- VS Code paste of grok.com cookies into SecretStorage  
- Developer API key monitoring as consumer Grok  
- Invented free-tier or Premium absolute message caps  

---

## 5. Out of scope

- Chrome Web Store / Marketplace **publish** for Grok-enabled build  
- Effect-TS migration  
- Other new services beyond Grok  
- Automating login, bypassing rate limits, or scraping behind CAPTCHA  

---

## 6. Done when

This bar is met when:

- Dual-mode auth story for Grok is truthful (Chrome live session; no VS Code Grok secret)  
- Grok never shows invented remaining %  
- Domain model includes `grok` with honesty states tested in CI  
- Chrome and VS Code both surface Grok honestly (slot always present in VS Code)  
- Weekly remaining % is only shown from validated first-party used% (or not shown)  
- This file documents requirements, seams, backlog, and out of scope  

Live SuperGrok weekly % is a **conditional** enhancement after payload validation - honesty-only is an acceptable ship state for this bar.
