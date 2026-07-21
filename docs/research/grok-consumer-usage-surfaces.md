# Research: Grok consumer usage surfaces and honest limits

**Ticket:** [#20](https://github.com/BasantPandey/AIQuotaTool/issues/20)  
**Branch:** `research/grok-consumer-usage-surfaces`  
**Date:** 2026-07-21  
**Scope:** Consumer Grok (grok.com, Grok iOS/Android apps, Grok on X) plus comparison notes for the developer API. Prefer primary sources (docs.x.ai, help.x.com, x.ai legal, first-party product pages). Secondary community observations are labeled as **judgment / reverse-engineering** only.  
**Product context:** Dual-mode tool (Chrome session cookies + VS Code secrets) that already does Claude/Codex session usage and **honest** Copilot seat states. **Never invent remaining %** (especially never invent `100` when unknown).

---

## Executive summary

| Question | Answer (as of 2026-07) |
| --- | --- |
| Official **consumer remaining %** API (documented public REST like Claude usage)? | **No.** No public, documented consumer “remaining messages / remaining weekly %” HTTP API is published for third parties. |
| Official **first-party Usage UI** with % and reset (SuperGrok / paid Grok plans)? | **Yes (documented).** Settings → Usage shows a progress bar of **percentage used**, product breakdown, weekly reset date/time, and Extra Usage Credits. Source: [docs.x.ai Grok FAQ](https://docs.x.ai/grok/faq). |
| Honest remaining % possible for SuperGrok weekly pool? | **Conditionally yes** - only if the same first-party usage payload that powers Settings → Usage can be read with the user’s own session (Chrome cookie / app session). That backend path is **not** documented as a public API. Until validated with a first-party response shape, product must treat % as **unknown** (honesty-only), not invent numbers. |
| Free tier / X Premium short-window message quotas published with fixed numbers? | **No fixed official numbers.** X Help states “increased” / “higher” Grok limits by Premium tier without numeric caps. Free-tier counts in blogs/Grokipedia are **unofficial**. |
| Short-window rate buckets (DEFAULT / REASONING / DEEPSEARCH) on grok.com? | **Observed by third parties** (Chrome Web Store extensions claim remaining queries + wait times on an active grok.com session). **Not documented** by xAI. Treat as reverse-engineering observation only - fragile, ToS-sensitive if abused, not a product commitment. |
| Effort / reasoning / multi-agent as separate quotas? | **Partially.** Official SuperGrok weekly pool is **compute-weighted across products** (Chat vs Imagine vs Voice vs Build vs API). Separate short-window mode quotas are community-observed, not officially specified with public numbers. |
| Developer API remaining % for consumers? | **Different product.** API is team-tier **RPS + TPM**, console rate-limits page, per-request `cost_in_usd_ticks`. Not a substitute for consumer chat remaining %. |
| Invent `weeklyPct: 100` when usage is unknown? | **No.** Same honesty rule as Copilot: unknown is unknown. Prefer connected / plan-known / rate-limited / usage-unknown states. |

### Go / no-go for remaining % (product lock-in)

| Surface | Remaining % | Product stance |
| --- | --- | --- |
| SuperGrok **weekly usage pool** (Settings → Usage) | **GO if session read of first-party usage data is proven** | Map used% → remaining% only from real fields; show reset time if present |
| Free-tier / X Premium rolling windows | **NO-GO for invented %** | Honesty states: rate-limited / wait-window / unknown remaining |
| Mode buckets (Think / DeepSearch / Imagine) | **NO-GO for invented absolute caps** | Optional: show remaining only if a live session response supplies remaining+limit |
| Developer API RPS/TPM | **Out of scope for consumer cards** | Separate integration if ever needed (API key + console) |
| Any path with no data | **Honesty-only** | Never invent 100% remaining |

---

## Legend: fact classes

Throughout this note:

1. **Primary fact** - stated on docs.x.ai, help.x.com, x.ai legal, or first-party product marketing.
2. **Judgment / reverse-engineering** - community reports, third-party extensions, secondary blogs. Useful for *where to look*, not for hardcoding quotas.

---

## 1. Product surfaces (where consumer Grok lives)

### 1.1 Primary: standalone Grok (xAI consumer)

| Surface | Notes (primary) |
| --- | --- |
| **[grok.com](https://grok.com)** | Official web app. docs.x.ai FAQ says use **grok.com** (not grok.x.ai) for full features. |
| **Grok iOS / Android apps** | Same consumer product family; usage Settings available on mobile per FAQ. |
| **accounts.x.ai** | Account, sign-in methods, account deletion. |
| **SuperGrok / SuperGrok Heavy** | Paid consumer plans for higher limits and advanced features (marketing on [x.ai/grok](https://x.ai/grok)). |

Sources:

- [xAI Consumer FAQs](https://x.ai/legal/faq) - mobile apps + grok.com for individual users; X platform is separate.
- [FAQ - Grok Website / Apps](https://docs.x.ai/grok/faq) - billing, **weekly usage**, Usage tab, login linking.
- [Grok product page](https://x.ai/grok) - free to try; SuperGrok for higher limits and multi-agent.

### 1.2 Primary: Grok on X

| Surface | Notes (primary) |
| --- | --- |
| **x.com / X apps → Grok** | Grok available to X users; powered by xAI models. Help article covers data/training/personalization, not numeric quotas. |
| **X Premium tiers** | Basic / Premium / Premium+; Premium includes “increased usage limits on Grok”; Premium+ includes “higher limits on Grok”. **No numeric quotas published.** |
| **Premium Business / Organizations** | Affiliates receive Premium+ including **access to SuperGrok** (stated on X Premium help). |

Sources:

- [About Grok on X](https://help.x.com/en/using-x/about-grok)
- [About X Premium](https://help.x.com/en/using-x/x-premium)

### 1.3 Host naming (primary)

From [docs.x.ai Grok FAQ](https://docs.x.ai/grok/faq):

- Correct web address: **grok.com**.
- Some users on grok.x.ai or other hosts hit missing features (e.g. Projects).

**Judgment:** Historical names `grok.x.com` / `grok.x.ai` may still redirect or host partial UIs; product integration should target **grok.com** first, and treat x.com Grok as a second host with separate cookie jar.

---

## 2. Official consumer usage model (SuperGrok / paid plans)

### 2.1 Weekly shared usage pool (primary - June 2026 rollout)

Documented in [FAQ - Grok Website / Apps → Usage & Limits](https://docs.x.ai/grok/faq):

| Topic | Official description |
| --- | --- |
| **What changed** | Rolling out **June 2026**: paid users move from **separate daily limits per product** (Chat, Imagine, Voice, Build, …) to **one shared weekly usage pool**. |
| **Flexibility** | Entire weekly pool can be spent on one product or split across products. |
| **Measurement** | Usage shown as **percentage used**, broken down by product. Products cost different amounts of the pool based on compute (chat is cheap; high-quality video / long coding is expensive). |
| **Where to check** | **Settings → Usage** (web and mobile). |
| **What the UI shows** | Progress bar (current usage %), breakdown by product (**API, Build, Chat, Imagine, Voice**), **weekly reset date and time**, Extra Usage Credits balance. |
| **When weekly limit is met** | Paid features pause until weekly reset. User still has **free-tier limits on Chat and Voice** (separate from weekly pool; free tier resets on **its own schedule**). |
| **Mitigations** | Buy Extra Usage Credits (web only at time of FAQ), upgrade plan, or enable Auto Top Up. |
| **Credits** | Extra Usage Credits apply after included weekly usage; expire one year after purchase unless otherwise stated; min purchase $5 from Usage tab on web. |

**Implication for AIQuotaTool:**

- The **canonical honest remaining metric for paid SuperGrok** is:  
  `remainingWeeklyPct ≈ 100 - usagePercentageUsed`  
  **only when** the percentage is taken from first-party usage data (UI or same backend the UI calls).
- Product breakdown (Chat / Imagine / Voice / Build / API) is a richer honesty surface than a single ring if multi-product users matter.
- Reset timestamp is first-class (weekly schedule shown in Usage tab).

### 2.2 What is *not* officially quantified

The same official FAQ does **not** publish:

- Exact weekly allowance units per SuperGrok vs SuperGrok Heavy.
- Exact free-tier message counts or free-tier window length.
- Exact cost-in-pool units per chat message vs video second.
- Public JSON schema for Settings → Usage.

**Judgment:** Marketing and secondary sites quote SuperGrok ≈ $30/mo and SuperGrok Heavy much higher with “highest rate limits”; those price points are useful context but **must not** be hardcoded as remaining-quota math.

### 2.3 Free tier after paid weekly exhaustion (primary)

When weekly paid usage is exhausted:

- Free-tier Chat and Voice remain available.
- Free-tier limits reset on a **separate schedule** from the weekly pool.

Source: [docs.x.ai/grok/faq](https://docs.x.ai/grok/faq) (“What happens when I reach my weekly limit?”).

**Product honesty:** A user can show **0% weekly paid remaining** while still being able to chat on free tier - do not collapse “weekly pool empty” into “cannot use Grok at all” without distinguishing free fallback.

---

## 3. Official X-side Grok limits (primary)

From [About X Premium](https://help.x.com/en/using-x/x-premium):

| Tier | Grok-related language |
| --- | --- |
| Basic | Essential Premium features; **no** “increased Grok limits” language in the summary used here |
| Premium | **“increased usage limits on Grok”** |
| Premium+ | **“higher limits on Grok”** (+ other X features) |
| Premium Business / Organizations + affiliates | Premium+ **including access to SuperGrok** |

From [About Grok on X](https://help.x.com/en/using-x/about-grok):

- Explains what Grok is, training/personalization controls, conversation deletion, availability.
- **Does not** document message/hour caps, remaining counters, or APIs.

**Conclusion (primary):** X documents **relative** limit tiers only. A dual-mode tool **cannot** honestly derive remaining % from published Premium docs alone.

---

## 4. Developer API limits (comparison only - not consumer)

Documented for **API teams**, not consumer chat rings:

| Topic | Detail | Source |
| --- | --- | --- |
| Dimensions | **RPS** and **TPM** per model; tier by cumulative API spend | [Rate Limits](https://docs.x.ai/developers/rate-limits) |
| Tiers | Tier 0 ($0) … Tier 4 ($5,000 spend); Enterprise on request | same |
| Errors | HTTP **429** when exceeded | same |
| Console | Personalized limits: [console.x.ai rate-limits](https://console.x.ai/team/default/rate-limits) | same |
| Cost | Per-request `cost_in_usd_ticks` in usage object | [Cost Tracking](https://docs.x.ai/developers/cost-tracking) |
| Usage Explorer | Team admin consumption dashboards | docs / console |

**Note:** SuperGrok weekly FAQ product breakdown includes **API** as a product line item. That means consumer SuperGrok pool and API spend can interact in the **billing/usage UI**, but the **developer rate-limit system** (RPS/TPM + API key) remains a different control plane from grok.com chat cookies.

**Product recommendation:** Do **not** use developer RPS/TPM as a proxy for consumer chat remaining % in the same card as Claude/Codex session %.

---

## 5. Auth materials (what dual-mode would need)

### 5.1 grok.com / Grok apps (primary + operational judgment)

| Material | Role | Classification |
| --- | --- | --- |
| **xAI account session** after login (X / Google / email / Apple) | Required for Settings → Usage and personalized limits | Primary: login flows described in [docs.x.ai/grok/faq](https://docs.x.ai/grok/faq) and [accounts.x.ai](https://accounts.x.ai) |
| **Link X account** (Settings → Account → Connect X) | Lets xAI read X subscription status and grant relevant benefits | Primary: FAQ “How can I link my X account…” |
| **Subscription channel** (web Stripe-like portal vs Apple/Google IAP) | Determines where billing is managed; app vs web feature parity for Extra Credits | Primary: FAQ billing sections |
| **Cookie / token names** for grok.com | Not published as a stable public API contract | **Judgment:** expect first-party session cookies + authorization headers on same-origin XHR, similar to other consumer AI sites; must be confirmed by passive observation of the user’s own browser, not guessed into product code without validation |

### 5.2 Grok on x.com (judgment grounded in X platform patterns)

| Material | Role | Classification |
| --- | --- | --- |
| X web session cookies | Authenticate X + Grok-on-X requests | **Judgment:** typical X web auth involves long-lived session cookies (historically names like `auth_token`) plus CSRF (`ct0`) and bearer-like request headers. Exact current set changes; treat as platform-private. |
| `x.com/i/grok` (or in-app Grok entry) | UI entry for Grok on X | Primary: help.x.com “Where can I find Grok?” |

### 5.3 VS Code dual-mode practicality

| Approach | Feasibility |
| --- | --- |
| Chrome extension: read cookies for `grok.com` (and optionally `x.com`) while user is logged in | Same pattern as Claude/Codex browser session - **if** a stable same-origin usage endpoint exists |
| VS Code: store session secret manually | Possible but worse UX; xAI does not document a consumer “sessionKey” export for third-party apps the way some products do |
| VS Code: use **developer API key** | Only measures API RPS/TPM/cost - **not** SuperGrok chat weekly pool |

**Honesty note:** No official OAuth “quota.read” scope for consumer Grok was found in primary docs for this research.

---

## 6. Observable network / UI surfaces (mixed fact classes)

### 6.1 Documented UI (primary)

| Surface | Exposes | Remaining %? |
| --- | --- | --- |
| **Settings → Usage** (grok.com + mobile) | Used %, product breakdown, weekly reset, Extra Credits | **Yes (used %)** - first-party UI contract |
| **In-product limit / upgrade prompts** | User hits limit; free fallback / buy credits / upgrade | Binary or qualitative, not a full meter |
| **X Premium upsell / Grok limit messaging** | Qualitative | No |

### 6.2 Third-party tools claiming rate-limit reads (reverse-engineering observation)

Chrome Web Store listings (not xAI official):

| Extension (examples) | Claimed behavior | Status for this repo |
| --- | --- | --- |
| “Grok Rate Limit Checker” | On **grok.com** session: remaining queries for **DEFAULT, REASONING, DEEPSEARCH**; progress bars; wait time when limited | Observation that a session-backed rate-limit payload **likely exists or existed** (listing dated March 2025). **Not** an official API. Do not depend on extension internals. |
| “Grok Rate Limits” (similar) | Claims Think / DeepSearch counters and account id helpers | Same caveats |

**Judgment / method note (not implementation advice):** Community writeups describe checking DevTools Network after a message for requests related to rate limits. Exact path names, fields, and auth headers are **undocumented** and may break without notice. Product work must:

1. Only read data already available to the logged-in user in their browser (no credential theft, no automation that violates ToS).
2. Validate response schemas against live first-party traffic before shipping mappers.
3. Fail closed to honesty-only states when the payload is missing.

### 6.3 No public consumer remaining-% REST catalog

Unlike Claude’s session usage endpoints (already used by this monorepo) or GitHub’s billing **consumption** APIs (still not remaining % for Copilot - see sibling research), xAI’s **public** docs catalog for consumer Grok does **not** list a third-party-consumable “GET remaining quota” endpoint.

---

## 7. Effort / reasoning / multi-product quotas

### 7.1 Official (primary)

- **Weekly pool is compute-weighted across products** (Chat, Imagine, Voice, Build, API). This is the official “effort” analogue at plan level: heavier modes burn more of the same pool.
- **Multi-agent** and higher limits are marketed for SuperGrok / SuperGrok Heavy ([x.ai/grok](https://x.ai/grok)).
- **720p video fallback to 480p** after tier 720p cap is documented in FAQ (feature-specific soft cap, not a chat remaining %).

### 7.2 Community-observed short windows (judgment)

Secondary sources (Grokipedia “Free AI rate limits”, blogs, YouTube, Reddit) commonly claim:

- Free-tier text: order of **~10 messages / ~2 hours** (dynamic; previously higher in some reports).
- Separate tighter limits for image / video / advanced modes.
- Paid short windows larger and still dynamic under load.
- Mode labels such as DEFAULT / REASONING (Think) / DEEPSEARCH with separate remaining counters on grok.com session.

**These numbers must not be hardcoded as product truth.** They change with demand and policy; official free-tier numeric tables were **not** found on help.x.com or docs.x.ai for this research.

### 7.3 Mapping to AIQuotaTool honesty model

Align with existing Copilot honesty patterns in `@ai-quota-tool/core`:

| State | When |
| --- | --- |
| `connected` + plan label only | Session works; no usage payload |
| `usage_unknown` | Authenticated but Settings → Usage / rate payload unavailable |
| `weekly remaining %` | Valid used% + optional reset from first-party usage payload |
| `rate_limited` + optional `resetAt` | Explicit limit error / wait window from product or payload |
| `free_tier_fallback` | Paid weekly exhausted but free Chat/Voice still allowed (if detectable) |
| **Never** | Invented `100` remaining, invented free-tier counts, invented Premium+ absolute caps |

---

## 8. Dual-mode realism (Chrome vs VS Code)

| Mode | Realistic 2026 path | Remaining %? |
| --- | --- | --- |
| **Chrome standalone** | User logged into grok.com; content script / SW uses browser cookies to fetch **same-origin usage** endpoints the app already calls for Settings → Usage (if discovered and stable) | **Possible** for weekly pool after validation |
| **Chrome + X host** | Separate cookie jar for x.com Grok; may not share SuperGrok Usage UI | Likely weaker; may only detect rate-limit UI/errors |
| **VS Code standalone** | No official consumer quota OAuth; manual session export undocumented; API key tracks wrong product | Prefer honesty-only or deep-link “open Settings → Usage” unless a safe secret flow is designed later |
| **Chrome → VS Code WS push** | Same as other services: Chrome can push freshest Grok state if Chrome can read it | Depends on Chrome surface success |

**Do not recommend** automating logins, scraping behind CAPTCHAs, or bypassing rate limits. Report only what is observable under the user’s own authenticated session.

---

## 9. Comparison to Claude / Codex / Copilot (for acceptance)

| Service | Official remaining-style surface | AIQuotaTool pattern (repo) |
| --- | --- | --- |
| Claude | Session usage APIs + UI (implemented) | Map remaining % honestly from usage |
| Codex / ChatGPT | Session usage (implemented) | Same |
| Copilot | Seat + consumption; **no** honest remaining % API | Honesty-only / seat status (see `docs/research/copilot-usage-surfaces.md`) |
| **Grok consumer** | Settings → Usage **UI** documents used % + weekly reset for paid pool; **no public third-party API** | **Closest to Claude only after session usage payload is validated**; until then Copilot-like honesty states |

---

## 10. Recommended product acceptance (for follow-on tickets)

Without implementing product code in this research ticket:

1. **V1 Grok card (safe):** Connected / not connected / plan tier if known / rate-limited if detected / deep-link to `https://grok.com` Settings → Usage. **No invented %.**
2. **V1.x if Usage payload proven:** Map SuperGrok weekly **used % → remaining %**, product breakdown optional, weekly `resetAt`. Keep free-tier short windows as secondary honesty, not fake gauges.
3. **Never:** Hardcode free “10/2h”, Premium “100/2h”, SuperGrok “300/2h” from blogs into remaining math.
4. **Separate** developer API monitoring from consumer SuperGrok cards if both are ever built.
5. **Auth:** Prefer Chrome cookie session on grok.com; document that VS Code may remain honesty-only for Grok until a first-party-supported credential path exists.

---

## 11. Citations (URLs)

### Primary

| URL | Why |
| --- | --- |
| https://docs.x.ai/grok/faq | SuperGrok weekly pool, Settings → Usage fields, free-tier fallback, billing, host name |
| https://docs.x.ai/developers/rate-limits | Developer RPS/TPM (comparison) |
| https://docs.x.ai/developers/cost-tracking | Per-request API cost (comparison) |
| https://x.ai/legal/faq | Consumer product scope (apps + grok.com vs X) |
| https://x.ai/grok | Marketing: free try, SuperGrok higher limits / multi-agent |
| https://help.x.com/en/using-x/about-grok | Grok on X: behavior, data, availability - no numeric quotas |
| https://help.x.com/en/using-x/x-premium | Premium / Premium+ relative Grok limits; SuperGrok for Business/Orgs |
| https://accounts.x.ai | Account / sign-in management |
| https://grok.com | Consumer web app host |
| https://grok.com/?_s=billing | Billing management entry (FAQ) |

### Secondary / reverse-engineering observations (not product truth)

| URL | Why |
| --- | --- |
| https://chromewebstore.google.com/detail/grok-rate-limit-checker/mekalmllkbdknpdohnnhdlnginclokgk | Third-party claim of DEFAULT/REASONING/DEEPSEARCH remaining on grok.com |
| https://grokipedia.com/page/Free_AI_rate_limits | Aggregated unofficial free-tier numeric estimates |
| Various blogs / Reddit / YouTube on free “messages per 2 hours” | Dynamic community reports; contradict each other over time |

---

## 12. Open questions for implementation research (out of scope here)

1. Exact same-origin URL(s) and JSON schema for Settings → Usage on grok.com (must be captured from a real SuperGrok session).
2. Whether free-tier short-window remaining is exposed in the same payload or only via chat errors.
3. Whether x.com Grok exposes any analogous usage JSON or only qualitative limit UX.
4. Cookie names, domains, and lifetimes for grok.com vs accounts.x.ai SSO.
5. Whether Extra Usage Credits balance is useful as a secondary meter after weekly exhaustion.
6. ToS / store-policy review for reading first-party usage with the user’s session (parallel to existing session-cookie policy research).

---

## 13. One-page decision for #20

**Facts:** Paid consumer Grok has an official **weekly usage pool** with **percentage used**, product breakdown, and **weekly reset** in Settings → Usage ([docs.x.ai/grok/faq](https://docs.x.ai/grok/faq)). Free tier and X Premium limits exist but lack published fixed remaining counts. Developer API limits are a different product surface.

**Judgment:** Session-backed rate-limit payloads for short windows / modes are plausible (third-party extensions) but undocumented.

**Product:** Remaining % is a **conditional go** only for SuperGrok weekly used% from first-party data. Otherwise honesty-only states - **never invent remaining percentages.**
