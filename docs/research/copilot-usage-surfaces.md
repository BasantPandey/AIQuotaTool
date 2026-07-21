# Research: Copilot usage surfaces and honest-UX constraints

> **Note (main / 0.7.1+):** Historical research snapshot. Product code may have advanced (e.g. Chrome Copilot is seat-only via mapCopilotSeatStatus; no undocumented usage endpoint). See docs/V1-SPEC.md for the locked product bar.


**Ticket:** [#2](https://github.com/BasantPandey/AIQuotaTool/issues/2)  
**Date:** 2026-07-21  
**Scope:** Official / documented GitHub surfaces only (docs.github.com, GitHub REST/GraphQL docs, github.blog). No secondary blog roundups.  
**Product context:** Dual-mode tool (Chrome session cookies + VS Code token) that wants a remaining-quota % comparable to Claude / Codex cards.

---

## Executive summary

| Question | Answer (as of 2026-07) |
| --- | --- |
| Public remaining-quota **%** API for an individual end user? | **No.** Neither REST nor GraphQL documents an endpoint that returns “AI credits remaining %” or “completions remaining %” for the authenticated personal user in real time. |
| Can a dual-mode tool still show *something* honest? | **Yes.** Seat / plan presence, historical **consumed** AI credits (billing usage APIs), org admin metrics (not end-user remaining %), and deep-links to GitHub/IDE usage UIs. |
| Is `GET /user/copilot/usage` (current chrome-ext placeholder) documented? | **No.** It does not appear in the official REST Copilot or Billing usage catalogs. |
| Is inventing `weeklyPct: 100` when usage is unknown honest? | **No.** That presents unknown quota as “full remaining.” Prefer an explicit unknown / connected-only state. |

---

## 1. Billing model (2026) - what “quota” means now

As of **1 June 2026**, all Copilot plans use **usage-based billing** with **GitHub AI Credits** (1 AI credit = $0.01 USD). Premium request units (PRUs) are legacy.

Sources:

- [GitHub Copilot is moving to usage-based billing](https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/) (2026-04-27)
- [Updates to GitHub Copilot billing and plans](https://github.blog/changelog/2026-06-01-updates-to-github-copilot-billing-and-plans/) (2026-06-01)
- [Usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals)
- [Usage-based billing for organizations and enterprises](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-organizations-and-enterprises)

### Individual plans (documented allowances)

From [About individual GitHub Copilot plans](https://docs.github.com/en/copilot/concepts/billing/individual-plans) and [usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals):

| Plan | Completions | Chat / agent / premium models |
| --- | --- | --- |
| **Copilot Free** | Up to **2,000** code completions / month | Limited chat and agent; models via auto selection only; **allowance of AI credits** (numeric Free/Student AI-credit totals are *not* tabulated the same way as paid plans in the allowance table) |
| **Copilot Student** | Unlimited completions | Limited chat/agent + AI credit allowance |
| **Copilot Pro** | Unlimited (included models) | **1,500** total monthly AI credits (1,000 base + 500 flex) |
| **Copilot Pro+** | Unlimited | **7,000** total monthly AI credits |
| **Copilot Max** | Unlimited | **20,000** total monthly AI credits |

Important nuances from the same docs:

- **Code completions and next edit suggestions are not billed in AI credits** on paid plans (unlimited).
- Included AI credits **do not carry over**. Reset is **00:00:00 UTC on the first day of each calendar month** (fixed; independent of subscription billing date).
- Users may set an **additional usage budget** in USD after included credits are exhausted - so “remaining” is not a single hard cap for paid users who opt into overage.
- Flex allotment is **variable** (“designed to adapt as the economics of AI evolve”) - hard-coding plan totals as eternal truth is fragile.

### Org / enterprise plans

From [usage-based billing for organizations and enterprises](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-organizations-and-enterprises):

| Plan | Included AI credits per user / month |
| --- | --- |
| Copilot Business | 1,900 |
| Copilot Enterprise | 3,900 |

Seat assignment and pooled enterprise usage / budgets are separate concepts from a personal remaining-% meter.

### Legacy premium requests

[Monitoring your GitHub Copilot usage and entitlements (legacy)](https://docs.github.com/en/copilot/how-tos/monitoring-your-copilot-usage-and-entitlements) applies only to **Copilot Pro / Pro+ annual subscribers who remained on legacy premium-request billing after 1 June 2026**. New dual-mode design should treat PRU UI language as legacy, not the default model.

---

## 2. Does a public remaining-quota % API exist for individual users?

### REST

**No documented personal remaining-% endpoint.**

The official REST index for Copilot lists management and **admin metrics**, not a personal “quota left” resource:

- [REST API endpoints for Copilot](https://docs.github.com/en/rest/copilot) - cloud agent, content exclusion, custom agents, **usage metrics**, **user management** (org seats). No “authenticated user remaining quota” section.

What *is* documented for **user-level** consumption is under **Billing usage**, not under “remaining quota”:

| Endpoint | What it returns | Remaining %? |
| --- | --- | --- |
| `GET /users/{username}/settings/billing/ai_credit/usage` | Time-bounded report of AI credit **consumption** (`usageItems` with quantities and amounts) | **No** - used only |
| `GET /users/{username}/settings/billing/premium_request/usage` | Legacy-style premium request **consumption** report | **No** |
| `GET /users/{username}/settings/billing/usage` | Total usage report (enhanced billing platform) | **No** |
| `GET /users/{username}/settings/billing/usage/summary` | Aggregated usage summary (public preview) | **No** |

Source: [Billing usage REST API](https://docs.github.com/en/rest/billing/usage).

Critical scoping note from that page:

- User endpoints return Copilot usage **billed directly to the individual’s personal account**.
- If the user’s license is **managed and billed through an organization or enterprise**, that usage is **not** included in user-level endpoints - use org/enterprise endpoints instead.

Tutorial confirmation that these are **historical usage / cost** APIs (not live remaining meters): [Automating usage reporting with the REST API](https://docs.github.com/en/billing/tutorials/automate-usage-reporting).

Auth constraint from the same tutorial:

- Billing usage endpoints require a **personal access token (classic)**; they **do not support fine-grained PATs**.

### GraphQL

Public GraphQL schema (FPT) includes Copilot-related types such as:

- `CopilotEndpoints` (API / proxy / telemetry URLs)
- Agentic channel fields
- `CopilotCodeReviewParameters` (auto-review policy; mentions premium-request quota only as product policy language)

There is **no** GraphQL field for personal remaining AI credits, completion quota remaining, or remaining percentage in the public schema introspection used for this research.

Source: [Public GraphQL schema](https://docs.github.com/en/graphql/overview/public-schema) (`schema.docs.graphql`).

### Undocumented / placeholder paths used by this repo

| Path | Status in official docs | Repo usage |
| --- | --- | --- |
| `GET https://api.github.com/user/copilot` | **Not listed** under [REST API endpoints for Copilot](https://docs.github.com/en/rest/copilot) or billing usage. Org seat APIs use `/orgs/{org}/...` paths. | chrome-ext + vscode-ext treat as seat probe |
| `GET https://api.github.com/user/copilot/usage` | **Not documented** anywhere in official REST catalogs reviewed for this ticket | chrome-ext **PLACEHOLDER** only |

**Conclusion:** A dual-mode tool cannot honestly claim a public remaining-quota % API for individuals in 2026. Any private github.com XHR used by the billing UI would be **undocumented**, cookie-session-dependent, subject to breakage, and out of scope for “official or documented” surfaces.

---

## 3. Copilot Business / Enterprise usage APIs vs individual

### 3.1 Seat management (org owners) - not remaining %

[REST API endpoints for Copilot user management](https://docs.github.com/en/rest/copilot/copilot-user-management) (public preview):

| Endpoint | Purpose | Useful fields for end-user remaining %? |
| --- | --- | --- |
| `GET /orgs/{org}/copilot/billing` | Org subscription, seat breakdown, plan type | Seat counts / policies only |
| `GET /orgs/{org}/copilot/billing/seats` | Assigned seats | `last_activity_at`, `plan_type`, assignee - **not** credits remaining |
| `GET /orgs/{org}/members/{username}/copilot` | One member’s seat | Same seat detail shape; status 200 description says “including usage” but documented schema is **activity / assignment**, not AI-credit remaining |
| POST/DELETE selected users/teams | Assign / cancel seats | N/A |

Requires org owner (or scopes such as `manage_billing:copilot` / `read:org`). **Not usable as a personal Chrome/VS Code remaining-% feed** for typical individual accounts.

### 3.2 Copilot usage metrics (admin analytics)

[REST API endpoints for Copilot usage metrics](https://docs.github.com/en/rest/copilot/copilot-usage-metrics):

- Enterprise and organization **report download** endpoints (1-day and 28-day, users / repos / user-teams).
- Policy prerequisite: enterprise “Copilot usage metrics” policy **Enabled everywhere**.
- Audience: enterprise owners, billing managers, org owners, custom roles with metrics permissions.
- Scopes: e.g. `manage_billing:copilot`, `read:enterprise`, `read:org`.

Field reference: [Data available in Copilot usage metrics](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics).

Per-user reports include **`ai_credits_used`** (total AI credits consumed in the reporting period). Explicit docs note:

> This metric is for **consumption analysis, not invoicing totals**.

Changelog: [AI credits consumed per user now in the Copilot usage metrics API](https://github.blog/changelog/2026-06-19-ai-credits-consumed-per-user-now-in-the-copilot-usage-metrics-api/) (2026-06-19).

**Still not remaining %.** These are delayed daily reports for admins, not a live personal meter for the dual-mode tool’s primary persona.

### 3.3 Org / enterprise billing usage

Same [Billing usage](https://docs.github.com/en/rest/billing/usage) family at org/enterprise paths:

- `GET /organizations/{org}/settings/billing/ai_credit/usage`
- `GET /organizations/{org}/settings/billing/premium_request/usage`
- `GET /organizations/{org}/settings/billing/usage`
- `GET /organizations/{org}/settings/billing/usage/summary`

Admin-only consumption/cost reports. Align with [Automating usage reporting](https://docs.github.com/en/billing/tutorials/automate-usage-reporting).

### 3.4 Side-by-side: individual vs Business/Enterprise

| Capability | Individual (personal plan) | Business / Enterprise seat |
| --- | --- | --- |
| Live remaining AI-credit % public API | **No** | **No** (for end user) |
| Historical AI credit **used** via REST billing | **Yes** (user billing endpoints, personal-billed only) | Via **org/enterprise** billing endpoints for admins |
| Seat assignment APIs | N/A | **Yes** (org owners) |
| Adoption / DAU / `ai_credits_used` metrics reports | N/A | **Yes** (policy + admin permissions) |
| Human UI for own cycle usage | Billing **AI usage** + Copilot settings | Copilot settings “Usage this cycle” (credits used; % of budget if budget set) |

Sources for Business/Enterprise end-user UI: [Monitoring your GitHub AI Credits usage](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/manage-and-track-spending/monitor-ai-usage); changelog [Copilot users can now see AI credits used per billing cycle](https://github.blog/changelog/2026-07-20-copilot-users-can-now-see-ai-credits-used-per-billing-cycle/) (2026-07-20).

---

## 4. Documented human / IDE surfaces (not first-class tool APIs)

These are official ways users **see** usage; they are **not** documented as stable machine APIs for third-party extensions.

### GitHub.com

| Surface | Who | What it shows |
| --- | --- | --- |
| [https://github.com/settings/billing](https://github.com/settings/billing) - Metered usage / Copilot filter | Account holder | Overview of metered Copilot use |
| Billing sidebar **AI usage** (individual plans) | Individual plan users | Included credits used, additional usage, model breakdown |
| Profile → **Copilot settings** → Usage | Individual + Business/Enterprise users | Usage this cycle (e.g. “100 AI credits used” or “450 / 1,000” when a user-level budget exists) |

Sources:

- [Monitoring your GitHub AI Credits usage](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/manage-and-track-spending/monitor-ai-usage)
- [Monitoring usage and entitlements (legacy)](https://docs.github.com/en/copilot/how-tos/monitoring-your-copilot-usage-and-entitlements)

### IDE (first-party clients)

Documented “view usage in your IDE” entry points (progress toward limits + reset date):

| IDE | Documented affordance |
| --- | --- |
| Visual Studio Code | Copilot icon in status bar |
| Visual Studio | Copilot icon → **Copilot Consumptions** |
| JetBrains | Copilot icon → **View quota usage** |
| Xcode | Copilot icon in menu bar |
| Eclipse | Copilot icon in status bar |

Source: [Monitoring your GitHub AI Credits usage](https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/manage-and-track-spending/monitor-ai-usage).

Minimum client versions for correct usage-based billing display are listed under [usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals) (e.g. VS Code ≥ 1.120). Older clients may show incorrect pricing/usage terminology.

**Implication for AIQuotaTool:** IDE surfaces prove GitHub *has* internal quota data for first-party clients, but that data path is **not** published as a stable public REST/GraphQL remaining-% API for third parties.

---

## 5. What this repo currently does

### Chrome extension - `packages/chrome-ext/src/background/fetchers/copilot.ts`

Observed behavior:

1. Comments state correctly that GitHub has **no public per-user quota API**, and mark usage endpoint discovery as TODO against billing UI XHRs.
2. Calls **`https://api.github.com/user/copilot`** with `credentials: 'include'` and GitHub API version headers; treats **404** as no subscription.
3. On other non-OK seat responses, returns **`weeklyPct: 100`** (card still shown).
4. Calls **`https://api.github.com/user/copilot/usage`** - explicitly **PLACEHOLDER** - and on success would parse invented fields (`completions_used`, `chat_used`, limits, `billing_cycle_resets_at`).
5. Defaults Free limits to **2000 completions** and **50 chat** - completions Free cap matches current docs; **“50 chat” does not match** the 2026 AI-credits model (docs describe limited chat via AI credit allowance / auto models, not a fixed 50-message public API field).
6. Paid plans comment in code (“moved to usage-based token billing in June 2026”) aligns with official announcement.

### VS Code extension - `packages/vscode-ext/src/quota-poller.ts`

`fetchCopilot(token)`:

1. Uses `Authorization: Bearer` + same **`/user/copilot`** probe.
2. **404** → throw (no subscription).
3. Any other outcome (including successful seat response) currently returns **`weeklyPct: 100`** and a calendar month-start reset - **no usage fetch at all**.
4. Comment acknowledges “show connected state even when quota API is unreachable” but still encodes that state as **100% remaining**.

### Shared model - `packages/core` `QuotaState`

`sessionPct` / `weeklyPct` are defined as **percentage REMAINING**. Mapping unknown Copilot data onto `weeklyPct: 100` therefore **overloads “full remaining” with “unknown / connected.”** That is the core honest-UX bug relative to Claude (real utilization APIs) and Codex (real rate-limit windows).

---

## 6. Realistic read paths for a dual-mode tool in 2026

Ranked by honesty + official support:

### A. Official, realistic for VS Code (token path)

| Data | How | Caveats |
| --- | --- | --- |
| Auth present | GitHub auth session / PAT | Fine-grained vs classic scope differences |
| Personal-billed AI credit **usage** (historical) | `GET /users/{username}/settings/billing/ai_credit/usage` (+ summary endpoints) | Classic PAT; not fine-grained; past 24 months; **used** not remaining; org-billed seats excluded |
| Optional **estimated** remaining for known paid individual plans | Compute `max(0, plan_total - sum(netQuantity))` using [published plan tables](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals) | Flex allotment can change; Free AI-credit totals not cleanly tabulated; additional budget / overage breaks “hard remaining”; never present as live official remaining % without label |
| Org admin only: `ai_credits_used` | Usage metrics reports | Wrong persona for personal dual-mode card; admin scopes; daily lag |

### B. Chrome session path

| Data | How | Caveats |
| --- | --- | --- |
| Same billing REST if session cookies satisfy API auth | Unclear / often fails CORS or lacks classic PAT scopes | Browser extensions typically **cannot** use classic PAT the way VS Code can; cookie session ≠ billing API auth |
| Undocumented github.com billing XHRs | DevTools discovery | **Out of scope** for “official or documented”; brittle; ToS/risk |

### C. Surfaces that should stay links, not fake meters

- Deep-link to [settings/billing](https://github.com/settings/billing) / AI usage / Copilot settings.
- Tell users first-party IDEs expose live quota UI (VS Code status bar, etc.).

---

## 7. Honest UI state recommendations

Ground rules:

1. **Never map “unknown” → 100% remaining.** That competes with real Claude/Codex percentages and trains users to ignore the card.
2. Prefer **explicit state machines** over inventing `QuotaState` percentages when the API does not return remaining.
3. Label any computed remaining as **estimate** when derived from (published allowance − billed usage).

### Recommended Copilot card states

| State ID | When | UI copy (example) | `QuotaState` guidance |
| --- | --- | --- | --- |
| `no_subscription` | Documented 404-style “no Copilot” / user never enabled Free | “No Copilot plan on this account” | Omit or error; do not show green full bar |
| `auth_required` | No cookies / no token / 401 | “Sign in to GitHub” / “Connect GitHub token” | No pct |
| `scope_insufficient` | 403 on billing endpoints (classic PAT missing, fine-grained only, etc.) | “Token cannot read billing usage” + link to docs on classic PAT / billing | Connected without pct |
| `connected_quota_unavailable` | Seat/plan exists or auth OK, but no remaining-% API (default 2026 case) | “Connected · remaining quota not available via public API” + link to github.com AI usage | **Omit** `sessionPct` / `weeklyPct` rather than 100; keep `lastUpdated` |
| `usage_consumed_only` | Billing AI credit report succeeds | “~N AI credits used this period” (and reset date if known: 1st of month UTC) | Prefer non-percentage display, or optional estimated remaining with **estimate** badge |
| `org_managed_seat` | User-level billing empty / 404 while user has org Copilot | “Org-managed seat · personal billing endpoints exclude this usage” | Link to org admin surfaces; no personal remaining % |
| `free_completions_cap` (optional future) | Only if a **documented** completions remaining signal appears | “Free: N / 2000 completions” | Separate from AI-credit chat meter; do not invent chat=50 |
| `legacy_pru` | Rare annual legacy premium-request cohort | Follow legacy docs language | Do not mix with AI credits without labeling |

### Status bar (VS Code)

- Do **not** show `Copilot 100%` when data is unavailable.
- Prefer `Copilot · —` or `Copilot · connected` or `Copilot · N cr used` over a fake percentage.
- Amber threshold “below 10% remaining” should **not** fire when remaining is unknown.

### Chrome popup

- Same rules as VS Code card.
- Suppress connection errors for WS still OK; **do not** use that pattern for quota honesty.

### What not to ship as “done”

- Keeping PLACEHOLDER `/user/copilot/usage` and treating 404 as “100% remaining.”
- Hard-coding Free chat = 50 as if it were a public API contract in 2026 AI-credits world.
- Using org usage metrics as if they were the signed-in user’s live remaining meter without admin context.

---

## 8. Answers to the ticket questions (checklist)

1. **Public remaining-quota % API for individual users?**  
   **No** (REST + GraphQL + billing docs as of research date).

2. **Business/Enterprise usage APIs vs individual?**  
   - Business/Enterprise: rich **admin** seat + metrics + org billing APIs; per-user **`ai_credits_used`** in metrics reports; end-user UI shows cycle usage / budget share.  
   - Individual: personal **billing consumption** reports if self-billed; human AI usage dashboard; **no** remaining-% API.

3. **What chrome-ext / vscode-ext currently do?**  
   - Both probe `/user/copilot`; both present **100% remaining** when usage is missing.  
   - chrome-ext additionally hits undocumented placeholder `/user/copilot/usage` and outdated Free chat=50 assumption.

4. **Honest UI when no remaining-% API?**  
   Connected / unknown / consumed-only / org-managed / auth / no-plan states as in §7 - **never fake full remaining**.

---

## 9. Source index (primary only)

### REST / GraphQL / billing

- https://docs.github.com/en/rest/copilot  
- https://docs.github.com/en/rest/copilot/copilot-user-management  
- https://docs.github.com/en/rest/copilot/copilot-usage-metrics  
- https://docs.github.com/en/rest/billing/usage  
- https://docs.github.com/en/billing/tutorials/automate-usage-reporting  
- https://docs.github.com/en/graphql/overview/public-schema  

### Product / billing concepts

- https://docs.github.com/en/copilot/concepts/billing/individual-plans  
- https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals  
- https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-organizations-and-enterprises  
- https://docs.github.com/en/copilot/concepts/usage-limits  
- https://docs.github.com/en/copilot/get-started/plans  
- https://docs.github.com/en/enterprise-cloud@latest/copilot/how-tos/manage-and-track-spending/monitor-ai-usage  
- https://docs.github.com/en/copilot/how-tos/monitoring-your-copilot-usage-and-entitlements (legacy PRU)  
- https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics  

### GitHub blog / changelog (official)

- https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/  
- https://github.blog/changelog/2026-06-01-updates-to-github-copilot-billing-and-plans/  
- https://github.blog/changelog/2026-06-19-ai-credits-consumed-per-user-now-in-the-copilot-usage-metrics-api/  
- https://github.blog/changelog/2026-07-20-copilot-users-can-now-see-ai-credits-used-per-billing-cycle/  

### In-repo context (not primary product docs)

- `packages/chrome-ext/src/background/fetchers/copilot.ts`  
- `packages/vscode-ext/src/quota-poller.ts`  
- `packages/core` `QuotaState` (`sessionPct` / `weeklyPct` = remaining)

---

## 10. Suggested follow-up tickets (out of scope for this research commit)

1. Replace Copilot `weeklyPct: 100` fallback with **connected / unknown** UI states in ui + both extensions.  
2. Optionally implement VS Code path: classic PAT → billing AI credit **used** display (no fake %).  
3. Delete or quarantine PLACEHOLDER `/user/copilot/usage` until/unless GitHub documents a personal remaining endpoint.  
4. Refresh Free-plan constants/docs comments for post-2026-06 AI-credits model.
