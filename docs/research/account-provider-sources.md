# Account provider data sources (issue #86)

Question: Which Account providers have a data source that gives real plan-limit numbers?

Map: [#84](https://github.com/BasantPandey/AIQuotaTool/issues/84). Date: 2026-09-29.

Context: The VS Code extension opens a real browser window. The user signs in on the real site. The extension reads the session data it needs, then calls the usage endpoint. The rule: ship only if the source gives real numbers. Never invent 100% remaining.

## Summary

| Provider | Endpoint | Auth | Numbers and windows | Verdict |
|---|---|---|---|---|
| Claude | `GET claude.ai/api/organizations` then `GET claude.ai/api/organizations/{orgId}/usage` | Cookie `sessionKey` (`sk-ant-...`) | `utilization` (percent used) and `resets_at` for `five_hour` (session), `seven_day` (weekly), per-model weekly. `extra_usage` (monthly spend) is optional. | **Ship.** Fix: `five_hour` can be absent. |
| ChatGPT / Codex | `GET chatgpt.com/api/auth/session` (gets `accessToken`), then `GET chatgpt.com/backend-api/wham/usage` | Cookie `__Secure-next-auth.session-token` (often split in `.0` and `.1`), then Bearer | `used_percent`, `limit_window_seconds`, `reset_at` (Unix seconds) for `primary_window` (5-hour) and `secondary_window` (weekly) | **Ship.** Fix two mapper bugs (see below). |
| Grok | `POST grok.com/rest/rate-limits` | Cookies `sso` and `sso-rw` (sometimes `cf_clearance`) | `remainingQueries` / `totalQueries` and `windowSizeSeconds` (short rolling window, about 2 hours) | **Ship session window.** **No-ship weekly pool** on cookie only (see below). |
| Gemini | `POST gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=jSf9Qc` | Google cookies (`__Secure-1PSID`, `__Secure-1PSIDTS` and others) plus page tokens `SNlM0e` and `cfb2h` | `[limit, used, type, reset]` for type 1 (5-hour) and type 2 (weekly) | **Ship, high risk.** Google cookie binding (DBSC) can make a copied cookie expire in hours. |
| Cursor | `GET cursor.com/api/usage-summary` | Cookie `WorkosCursorSessionToken` | Percent used per pool (`autoPercentUsed`, `apiPercentUsed`), cents `used` / `limit`, `billingCycleEnd` (monthly) | **Ship.** |
| Windsurf | `POST windsurf.com/_backend/exa.seat_management_pb.SeatManagementService/GetPlanStatus` (Connect RPC, protobuf) | Not a cookie. Four `localStorage` values: `devin_session_token`, `devin_auth1_token`, `devin_account_id`, `devin_primary_org_id` | `daily_quota_remaining_percent`, `weekly_quota_remaining_percent`, and reset times (Unix seconds) | **Ship, with a spec change.** The sign-in window must read `localStorage`, not only a cookie. |
| Perplexity | `GET www.perplexity.ai/rest/billing/credits?version=2.18&source=default` | Cookie `__Secure-next-auth.session-token` (or `__Secure-authjs.session-token`) | Credit grants in cents (recurring, promotional, purchased), `total_usage_cents`, `renewal_date_ts` (monthly) | **Ship monthly credits.** **No-ship query counts** as percent (no total in the response). |
| Kiro | `POST codewhisperer.us-east-1.amazonaws.com/` with `X-Amz-Target: AmazonCodeWhispererService.GetUsageLimits` | Bearer token from the Kiro CLI or IDE local store. No known cookie path. | `currentUsage` / `usageLimit` (monthly credits), `nextDateReset` | **No-ship.** The only known auth reads CLI credential files. #84 rules this out. |
| Copilot (note) | `GET api.github.com/copilot_internal/user` (not documented) | The same GitHub OAuth device-flow token | `quota_snapshots.premium_interactions` and `chat` percent remaining. No reset time. | **Keep the seat check.** This source is a candidate for a later issue. |

## Changed or fragile items in the current code

1. **Codex `reset_at` is a number, not a string.** OpenAI's generated model gives `reset_at: i32` (Unix seconds) ([openai/codex model][codex-window]). `mapCodexUsage` calls `Date.parse(value)`. `Date.parse(1760000000)` returns `NaN`. The mapper then uses "now + 5 hours" for both the session and the weekly reset. The weekly reset time is wrong.
2. **Codex missing window gives 100%.** `remainingFromUsedPct(undefined)` returns 100. If `primary_window` or `secondary_window` is absent, the ring shows 100% remaining. This breaks the honesty rule. OpenAI says some plans do not have both limits: "If your plan has both five-hour and weekly limits..." ([OpenAI Help][openai-codex-plan]). Label each window by `limit_window_seconds`, not by its position.
3. **Claude `five_hour` can be absent.** CodexBar uses `seven_day` "when `five_hour` is absent or has no utilization" ([CodexBar claude.md][cb-claude]). `mapClaudeUsage` reads `data.five_hour.utilization` with no check. It throws on a null value.
4. **Grok weekly pool is likely broken on cookie only.** CodexBar (checked 2026-09-28) says `GetGrokCreditsConfig` "now requires the browser-held Web Key Exchange (WKE) keypair. Cookie-only authentication can fail with gRPC status 16" ([CodexBar grok.md][cb-grok]). CodexBar also sends a gRPC-web frame with `exclude_legacy_monthly_usage: false`, because the server can reject an empty message. Our code sends Connect JSON `{}`. The fallback is safe: no weekly value, no invented number.
5. **Grok `modelName` values changed.** Our body is `{ requestKind: 'DEFAULT', modelName: 'grok-3' }`. A July 2026 client sends `modelName` `fast`, `thinking`, or `heavy` ([ExtremeRouter grok-web.js][er-grok]). Older clients still use `DEFAULT` and a model name ([grok2api-rs][grok2api-rs]). Test both before the build.
6. **Gemini cookies can be device-bound.** Chrome binds Google session cookies to the device with DBSC. "Sessions rely on short-lived cookies that expire quickly. When these cookies expire, Chrome proves possession of the private key before refreshing them" ([Chrome DBSC][dbsc]). DBSC is on by default in Chrome on Windows for Google Workspace users ([Workspace Updates][dbsc-ws]). The Gemini-API library warns that Chromium cookies "remain valid for only a few hours" ([Gemini-API README][gemini-api]). A cookie that the extension copies out of the sign-in window cannot refresh. Test the cookie lifetime on Windows before the build.
7. **Gemini field order is not proven at non-zero use.** The capture in [#66](https://github.com/BasantPandey/AIQuotaTool/issues/66) had `used = 0`. The mapper refuses `used > limit`. Capture again after some use.
8. **Cloudflare on Claude and ChatGPT.** A Node request from VS Code can get a Cloudflare challenge. CodexBar treats a challenge as a network problem, not an expired session ([CodexBar claude.md][cb-claude]). Keep the session and the last reading when this occurs.

## Current five

### Claude

- Endpoints: `GET https://claude.ai/api/organizations` gives the org UUID. `GET https://claude.ai/api/organizations/{orgId}/usage` gives the windows. Our code and CodexBar agree ([CodexBar claude.md][cb-claude], `packages/vscode-ext/src/session-fetch.ts`).
- Cookie: `sessionKey`, value prefix `sk-ant-` ([CodexBar claude.md][cb-claude]).
- Windows:
  - `five_hour`: session. `utilization` is percent used. `resets_at` is ISO time.
  - `seven_day`: weekly, all models.
  - `seven_day_sonnet`, `seven_day_opus`: weekly, per model.
  - `seven_day_cowork` or `seven_day_routines`: Daily Routines.
  - `extra_usage`: monthly spend and limit, when the user turns on extra usage.
- Official: Claude has "a five-hour session limit and a weekly usage limit". The user sees them at Settings > Usage ([Claude Help, usage limits][claude-limits], [Claude Help, Max plan][claude-max]).
- New: CodexBar adds `?cedar_ember=1` to read limit-reset grants. It retries without the query on a 403 ([CodexBar claude.md][cb-claude]). We do not need this.
- Verdict: **Ship.**

### ChatGPT / Codex

- Endpoints: `GET https://chatgpt.com/api/auth/session` gives `accessToken`. `GET https://chatgpt.com/backend-api/wham/usage` with `Authorization: Bearer` gives the windows (`session-fetch.ts`, [CodexBar codex.md][cb-codex]).
- Cookie: `__Secure-next-auth.session-token`. NextAuth splits it into `.0` and `.1`. Send each part under its own name. CodexBar imports all `chatgpt.com` cookies with no name filter ([CodexBar codex.md][cb-codex]). The sign-in window can do the same. This is more robust than a name list.
- Response ([openai/codex payload][codex-payload], [openai/codex window][codex-window]):
  - `plan_type`: `free`, `go`, `plus`, `pro`, and others.
  - `rate_limit.primary_window` and `rate_limit.secondary_window`: each has `used_percent`, `limit_window_seconds`, `reset_after_seconds`, `reset_at` (Unix seconds).
  - `credits`, `spend_control`, `additional_rate_limits`: optional.
- Official: Codex has a five-hour window, and "additional weekly limits may apply" ([OpenAI Help][openai-codex-plan]).
- Verdict: **Ship.** Fix bugs 1 and 2 above first.

### Grok

- Session endpoint: `POST https://grok.com/rest/rate-limits`. Body: `{ requestKind, modelName }`. Response: `remainingQueries`, `totalQueries`, `windowSizeSeconds`, plus `lowEffortRateLimits` and `highEffortRateLimits` ([ExtremeRouter grok-web.js][er-grok], [grok2api-rs][grok2api-rs], `packages/core/src/grok.ts`).
- Cookies: `sso` and `sso-rw` (same JWT). Some clients add `cf_clearance` ([grok2api-rs][grok2api-rs]).
- Weekly pool: `GetGrokCreditsConfig` gives `creditUsagePercent` and the period. It now needs a WKE keypair from the browser (bug 4). CodexBar prefers the Grok CLI token. #84 rules out CLI credential files.
- Official: SuperGrok moved to one shared weekly pool in June 2026. Settings > Usage shows percent used and the weekly reset ([xAI Grok FAQ][xai-faq]). Earlier notes: `docs/research/grok-consumer-usage-surfaces.md`.
- Verdict: **Ship the session window.** Show the weekly pool only when a real `creditUsagePercent` arrives. Do not invent it.

### Gemini

- Endpoint: `POST https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=jSf9Qc&source-path=%2Fusage&bl=<cfb2h>&rt=c`. Body: `f.req=[[["jSf9Qc","[]",null,"generic"]]]&at=<SNlM0e>` ([#66](https://github.com/BasantPandey/AIQuotaTool/issues/66), `packages/core/src/gemini.ts`).
- Auth: Google session cookies. The minimum set in open-source clients is `__Secure-1PSID` and `__Secure-1PSIDTS` ([Gemini-API README][gemini-api]). Read all `google.com` cookies from the sign-in window. Then GET `/app` to read `SNlM0e` and `cfb2h`.
- Numbers: each window is `[limit, used, type, [[resetSeconds, nanos]]]`. Type 1 is the 5-hour window. Type 2 is weekly.
- Official: the limit "refreshes every 5 hours" until the user reaches a weekly limit ([Gemini Apps limits][gemini-limits]). Earlier notes: `docs/research/gemini-usage-surfaces.md`.
- Verdict: **Ship, high risk.** Private positional RPC and device-bound cookies (bugs 6 and 7).

### Cursor

- Endpoint: `GET https://cursor.com/api/usage-summary`. CodexBar still lists it on 2026-09-26 ([CodexBar cursor.md][cb-cursor]).
- Cookie: `WorkosCursorSessionToken` ([CodexBar cursor.md][cb-cursor]).
- Numbers: `individualUsage.plan` has `autoPercentUsed`, `apiPercentUsed`, `totalPercentUsed`, and cents `used` / `limit`. `billingCycleEnd` gives the monthly reset. Earlier notes: `docs/research/cursor-usage-surfaces.md`.
- New: `POST https://cursor.com/api/dashboard/get-sand-usage-status` gives a weekly "Grok Bot" usage percent ([CodexBar cursor.md][cb-cursor]). We do not need it.
- New: CodexBar now opens a browser for interactive login and reads the cookie from that browser ([CodexBar cursor.md][cb-cursor]). This is the same pattern as the #84 sign-in window.
- Verdict: **Ship.**

## New candidates

### Windsurf

- Product: Cognition now calls the editor "Devin Desktop". The docs use both names ([Devin docs, quota][windsurf-quota]).
- Official limit model: since March 2026, plans have "a daily and weekly budget". Quotas "reset on a daily and weekly basis, based on the calendar date". The user sees remaining quota in the editor or on the plan page ([Devin docs, quota][windsurf-quota]).
- Endpoint: `POST https://windsurf.com/_backend/exa.seat_management_pb.SeatManagementService/GetPlanStatus` ([CodexBar windsurf.md][cb-windsurf], [CodexBar WindsurfWebFetcher.swift][cb-windsurf-src]).
  - Headers: `Content-Type: application/proto`, `Connect-Protocol-Version: 1`, `Origin: https://windsurf.com`, `x-auth-token`, `x-devin-session-token`, `x-devin-auth1-token`, `x-devin-account-id`, `x-devin-primary-org-id`.
  - Protobuf request: field 1 `auth_token` (string), field 2 `include_top_up_status` (bool).
- Auth: four values in `localStorage` on `app.devin.ai` or `windsurf.com`: `devin_session_token`, `devin_auth1_token`, `devin_account_id`, `devin_primary_org_id` ([CodexBar windsurf.md][cb-windsurf]). They are not cookies.
- Numbers: `plan_status.daily_quota_remaining_percent`, `plan_status.weekly_quota_remaining_percent` (integers), `daily_quota_reset_at_unix`, `weekly_quota_reset_at_unix`, `plan_info.plan_name`.
- Risks: unofficial protobuf field numbers. The auth moved from Windsurf to Devin keys in 2026. It can move again.
- Verdict: **Ship, with a spec change.** The numbers are real remaining percents with reset times. The sign-in window must read `localStorage`. The spec must allow this.

### Perplexity

- Credits endpoint: `GET https://www.perplexity.ai/rest/billing/credits?version=2.18&source=default`. Headers: `Origin: https://www.perplexity.ai`, `Referer: https://www.perplexity.ai/account/usage` ([CodexBar perplexity.md][cb-pplx], [CodexBar perplexity.js][cb-pplx-src]).
- Cookie: one of `__Secure-authjs.session-token`, `authjs.session-token`, `__Secure-next-auth.session-token`, `next-auth.session-token`. The value can be split into numbered chunks ([CodexBar perplexity.js][cb-pplx-src]).
- Numbers: `balance_cents`, `total_usage_cents`, `renewal_date_ts`, `current_period_purchased_cents`, and `credit_grants[]` with `type` (`recurring`, `promotional`, `purchased`), `amount_cents`, `expires_at_ts`. Monthly percent = recurring used / recurring grant. CodexBar uses recurring first, then purchased, then promotional.
- Official: 100 credits equal $1. Max plans start with 10,000 credits a month. The user sees the balance at `perplexity.ai/account/usage` ([Perplexity Help, credits][pplx-credits]). The help page blocks automated fetch. This fact comes from the search index of that page.
- Query limits: `GET https://www.perplexity.ai/rest/rate-limit/all` gives `remaining_pro`, `remaining_research`, `remaining_labs`, `remaining_agentic_research` ([usagepal plugin.js][usagepal-pplx], [perplexity-limits][pplx-limits]). It gives remaining counts only. One tool finds the total by a guess after a reset ([perplexity-usage README][pplx-usage]). A guess breaks our rule.
- Honesty: CodexBar shows 100% used when all grants are zero. We must show "no credits" or usage unknown, not a percent.
- Verdict: **Ship the monthly credits pool.** **No-ship** a percent for query limits. We can show the remaining count as text.

### Kiro

- Official limit model: credits per month. "Usage limits reset at the start of each billing month." Free has 50 credits. Sign-in is GitHub, Google, AWS Builder ID, or IAM Identity Center ([Kiro FAQ][kiro-faq]). The user sees credits in the Kiro subscription dashboard. "Manage Plan" opens the web browser ([Kiro FAQ][kiro-faq], [Kiro billing][kiro-billing]). CodexBar links to `https://app.kiro.dev/account/usage` ([CodexBar KiroProviderDescriptor.swift][cb-kiro-src]).
- Known sources ([CodexBar kiro.md][cb-kiro], [pi-provider-kiro usage.ts][pi-kiro]):
  - `kiro-cli chat --no-interactive "/usage"`: text output from the CLI.
  - `GetUsageLimits` on `codewhisperer.us-east-1.amazonaws.com` (or `q.eu-central-1.amazonaws.com`). It gives `currentUsage`, `usageLimit`, `nextDateReset`, overage fields.
- Auth: a Bearer token from the CLI store (`kirocli:odic:token` in `data.sqlite3`) or from the IDE. CodexBar says "No browser cookies" ([CodexBar kiro.md][cb-kiro]).
- Gap: no open-source tool reads `app.kiro.dev/account/usage` with a cookie. The calls that page makes are not known.
- Verdict: **No-ship.** Real numbers exist, but the only known auth reads CLI credential files. #84 rules this out. Open item: capture the network calls of `app.kiro.dev/account/usage` on a signed-in account. If a cookie call gives `currentUsage` and `usageLimit`, check again.

## Copilot note

- The current path is the seat check `GET https://api.github.com/user/copilot` with the device-flow token. It does not give remaining percent (`docs/research/copilot-usage-surfaces.md`).
- A better source exists, but it is not documented: `GET https://api.github.com/copilot_internal/user` with `Authorization: token <github_oauth_token>` and editor headers. It gives `quota_snapshots.premium_interactions` and `quota_snapshots.chat` percent remaining, plus `credits_used`. It gives no reset time. CodexBar uses it with a device-flow token of scope `read:user` ([CodexBar copilot.md][cb-copilot]).
- The monthly reset is known from docs: 00:00 UTC on the first day of each month (`docs/research/copilot-usage-surfaces.md`).
- Risk: CodexBar found no documented endpoint that gives the included AI-credit total for a seat ([CodexBar copilot.md][cb-copilot]). For token-billed seats, show credits used as text only.
- Verdict: **Keep the seat check for now.** Open a separate issue to test `copilot_internal/user`.

## Next steps

1. Fix bugs 1, 2, and 3 in `packages/core/src/mappers.ts`, with tests.
2. In the sign-in window, read all cookies for the site, not a fixed name list. Add `localStorage` reads for Windsurf.
3. Test Google cookie lifetime (DBSC) on Windows before the Gemini build.
4. Test Grok `modelName` values and the weekly pool with a real session.
5. Capture the network calls of `app.kiro.dev/account/usage`.
6. Open an issue for Copilot `copilot_internal/user`.

## Sources

[cb-claude]: https://github.com/steipete/CodexBar/blob/main/docs/claude.md
[cb-codex]: https://github.com/steipete/CodexBar/blob/main/docs/codex.md
[cb-grok]: https://github.com/steipete/CodexBar/blob/main/docs/grok.md
[cb-cursor]: https://github.com/steipete/CodexBar/blob/main/docs/cursor.md
[cb-windsurf]: https://github.com/steipete/CodexBar/blob/main/docs/windsurf.md
[cb-windsurf-src]: https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Windsurf/WindsurfWebFetcher.swift
[cb-pplx]: https://github.com/steipete/CodexBar/blob/main/docs/perplexity.md
[cb-pplx-src]: https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Resources/Plugins/perplexity.js
[cb-kiro]: https://github.com/steipete/CodexBar/blob/main/docs/kiro.md
[cb-kiro-src]: https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Kiro/KiroProviderDescriptor.swift
[cb-copilot]: https://github.com/steipete/CodexBar/blob/main/docs/copilot.md
[codex-window]: https://github.com/openai/codex/blob/main/codex-rs/codex-backend-openapi-models/src/models/rate_limit_window_snapshot.rs
[codex-payload]: https://github.com/openai/codex/blob/main/codex-rs/codex-backend-openapi-models/src/models/rate_limit_status_payload.rs
[openai-codex-plan]: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
[claude-limits]: https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work
[claude-max]: https://support.claude.com/en/articles/11049741-what-is-the-max-plan
[xai-faq]: https://docs.x.ai/grok/faq
[er-grok]: https://github.com/rsalmn/ExtremeRouter/blob/main/open-sse/services/usage/grok-web.js
[grok2api-rs]: https://github.com/XeanYu/grok2api-rs/blob/main/src/services/grok/usage.rs
[gemini-api]: https://github.com/HanaokaYuzu/Gemini-API
[gemini-limits]: https://support.google.com/gemini/answer/16275805
[dbsc]: https://developer.chrome.com/docs/web-platform/device-bound-session-credentials
[dbsc-ws]: https://workspaceupdates.googleblog.com/2026/05/prevent-account-takeovers-with-DBSC-now-generally-available-in-the-Chrome-browser-for-Windows.html
[windsurf-quota]: https://docs.devin.ai/desktop/accounts/quota
[pplx-credits]: https://www.perplexity.ai/help-center/en/articles/13838041-how-credits-work-on-perplexity
[usagepal-pplx]: https://github.com/Halloweedev/usagepal/blob/main/plugins/perplexity/plugin.js
[pplx-limits]: https://github.com/titanlyy/perplexity-limits/blob/main/background.js
[pplx-usage]: https://github.com/fuegocoding/perplexity-usage
[kiro-faq]: https://kiro.dev/faq/
[kiro-billing]: https://kiro.dev/docs/billing/managing/
[pi-kiro]: https://github.com/mikeyobrien/pi-provider-kiro/blob/main/src/usage.ts

- CodexBar provider docs (Claude, Codex, Grok, Cursor, Windsurf, Perplexity, Kiro, Copilot): https://github.com/steipete/CodexBar/tree/main/docs
- OpenAI Codex backend models: https://github.com/openai/codex/tree/main/codex-rs/codex-backend-openapi-models/src/models
- OpenAI Help, Codex with your ChatGPT plan: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
- Claude Help, usage limits: https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work
- Claude Help, Max plan: https://support.claude.com/en/articles/11049741-what-is-the-max-plan
- xAI Grok FAQ: https://docs.x.ai/grok/faq
- ExtremeRouter Grok web usage: https://github.com/rsalmn/ExtremeRouter/blob/main/open-sse/services/usage/grok-web.js
- grok2api-rs usage: https://github.com/XeanYu/grok2api-rs/blob/main/src/services/grok/usage.rs
- Gemini-API (cookie names, DBSC warning): https://github.com/HanaokaYuzu/Gemini-API
- Gemini Apps limits: https://support.google.com/gemini/answer/16275805
- Chrome DBSC: https://developer.chrome.com/docs/web-platform/device-bound-session-credentials
- Workspace Updates, DBSC on Windows: https://workspaceupdates.googleblog.com/2026/05/prevent-account-takeovers-with-DBSC-now-generally-available-in-the-Chrome-browser-for-Windows.html
- Devin docs, quota-based usage (Windsurf): https://docs.devin.ai/desktop/accounts/quota
- Perplexity Help, how credits work: https://www.perplexity.ai/help-center/en/articles/13838041-how-credits-work-on-perplexity
- usagepal Perplexity plugin: https://github.com/Halloweedev/usagepal/blob/main/plugins/perplexity/plugin.js
- perplexity-limits: https://github.com/titanlyy/perplexity-limits
- perplexity-usage: https://github.com/fuegocoding/perplexity-usage
- Kiro FAQ: https://kiro.dev/faq/
- Kiro billing: https://kiro.dev/docs/billing/managing/
- pi-provider-kiro usage: https://github.com/mikeyobrien/pi-provider-kiro/blob/main/src/usage.ts
