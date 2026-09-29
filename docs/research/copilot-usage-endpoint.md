# Copilot usage endpoint (issue #96)

Question: Is `GET https://api.github.com/copilot_internal/user` a better Copilot Account source than the seat check?

Date: 2026-09-29. Map: [#84](https://github.com/BasantPandey/AIQuotaTool/issues/84). Blocks: [#91](https://github.com/BasantPandey/AIQuotaTool/issues/91).

No real token was sent to the endpoint for this research. All facts come from source code, docs, and reports by other tools.

## Summary

- The endpoint gives real numbers: percent remaining, entitlement, credits used, reset time, and plan name. It is much better than the seat check.
- VS Code itself calls it. The URL is `entitlementUrl` in the VS Code `product.json`. The official Copilot extension reads the same `quota_snapshots` shape.
- GitHub does not document it. The shape changed 7 times in 2026. All changes were additive, but one field changed its type.
- **Our device-flow token does not work.** GitHub answers only for tokens from its own OAuth apps. Our app id `Ov23liNRlhzedfjImsrQ` is a third-party app. Another tool with an `Ov23li...` id reports a rejection.
- The token of the VS Code built-in `github` sign-in is the same token that VS Code sends to this endpoint. An extension gets it with `vscode.authentication.getSession('github', ['read:user'])`.
- No documented alternative gives percent remaining for a user. The billing REST API gives credits used only.

**Verdict: ship, with a token change.** Use the endpoint as the Copilot Account source only with the VS Code built-in GitHub session. Do not ship it with our own device-flow token. Keep the seat check as the fallback. Do one manual test with a real account before the build (see [Next steps](#next-steps)).

## Token and scopes

| Token | Result | Source |
|---|---|---|
| VS Code built-in GitHub session (OAuth app `01ab8ac9400c4e429b23`), scope `read:user` or more | Works. VS Code sends it as `Authorization: Bearer <token>` and no other header. | [VS Code defaultAccount.ts][vsc-da-wb], [VS Code github-authentication config.ts][vsc-gh-config], [VS Code product.json][vsc-product] |
| Legacy Copilot OAuth app `Iv1.b507a08c87ecfe98`, scope `read:user` | Works. CodexBar uses it. | [CodexBar CopilotDeviceFlow.swift][cb-flow], [CodexBar copilot.md][cb-copilot] |
| GitHub CLI token (`gh auth token`) | Works, "with no extra scope and any user agent". | [Jarvis PR #347][jarvis] |
| Classic PAT with scope `copilot` | Works. | [onWatch COPILOT_SETUP.md][onwatch] |
| Third-party OAuth app (`Ov23li...` id) | **Rejected.** "GitHub only answers it for tokens minted by its own OAuth apps; the Jarvis OAuth app (`Ov23li…` client id) is not accepted, consistent with reports from other tools." | [Jarvis PR #347][jarvis] |
| Third-party OAuth app on `copilot_internal/v2/token` | HTTP 404 for all plans. Same cause. | [hermes-agent #16551][hermes-16551] |

Notes:

- Our device flow uses client id `Ov23liNRlhzedfjImsrQ` and scope `read:user` (`packages/core/src/github-oauth.ts`). This is the rejected class. Scope is not the problem, so a new scope does not fix it.
- VS Code treats 404 as "missing scopes/permissions, service pretends the endpoint doesn't exist". It treats 401 as an expired or revoked token ([VS Code defaultAccount.ts][vsc-da-wb]). Expect 404 for a token that GitHub does not accept.
- VS Code accepts any GitHub session that has one of these scope sets: `read:user, user:email, repo, workflow`, or `user:email`, or `read:user` ([VS Code product.json][vsc-product]). So `read:user` alone is enough.
- `vscode.authentication.getSession` is a documented API. It "Rejects ... if the user does not consent to sharing authentication information with the extension" ([VS Code API][vsc-api]). The user sees one consent dialog. No device code is necessary.
- Do not copy the Copilot client id `Iv1.b507a08c87ecfe98` into our device flow, as CodexBar does. That makes our extension act as a GitHub app that is not ours.
- GitHub Enterprise (GHE.com): VS Code uses `api.<host>` for the same path ([VS Code defaultAccount.ts][vsc-da-wb], [CodexBar copilot.md][cb-copilot]). Out of scope for V1.

## Response shape

From the VS Code type `IEntitlementsData` ([VS Code base defaultAccount.ts][vsc-da-base]) and the parser `parseQuotas` ([VS Code chatEntitlementService.ts][vsc-ces]):

```ts
interface CopilotUser {
  access_type_sku: string;          // "free_limited_copilot", "free_educational_quota", ...
  copilot_plan: string;             // "individual", "individual_pro", "individual_max",
                                    // "individual_edu", "business", "enterprise"
  chat_enabled: boolean;
  assigned_date: string;
  can_signup_for_limited: boolean;  // true: no plan yet, Copilot Free is available
  organization_login_list: string[];
  limited_user_reset_date?: string; // Copilot Free
  quota_reset_date?: string;        // other plans, date only
  quota_reset_date_utc?: string;    // other plans, with time
  token_based_billing?: boolean;    // usage-based billing (AI credits)
  can_upgrade_plan?: boolean;
  // Legacy Free plan counts
  limited_user_quotas?: { chat: number; completions: number };  // remaining
  monthly_quotas?: { chat: number; completions: number };       // total
  quota_snapshots?: {
    chat?: QuotaSnapshot;
    completions?: QuotaSnapshot;
    premium_interactions?: QuotaSnapshot;
  };
}

interface QuotaSnapshot {
  percent_remaining: number;   // 0..100, REMAINING
  unlimited: boolean;
  entitlement?: string;        // a number in a string; "0" = no allowance
  quota_remaining?: number;    // same unit as entitlement
  credits_used?: number;       // AI credits used, no denominator
  quota_reset_at?: number;     // Unix SECONDS, for this snapshot
  has_quota?: boolean;         // always false under token-based billing
  overage_permitted: boolean;  // additional usage is on
  overage_count: number;
  overage_entitlement: number;
}
```

How VS Code reads it ([VS Code chatEntitlementService.ts][vsc-ces]):

- It clamps `percent_remaining` to 0..100.
- It skips a snapshot when `unlimited` is false and `entitlement` is 0. Example: Free plan `premium_interactions` with 0 credits.
- It does not use `has_quota`. The comment says: "Under TBB, has_quota is always false at the per-snapshot level so we cannot rely on it".
- `unlimited: true` with `credits_used`: it shows credits used, not a percent. The comment says `credits_used` is "Drawn from an unmeterable pool, so it has no denominator" (org seats with no user budget).
- `unlimited: true` with no `credits_used`: it shows nothing.
- Reset: `quota_reset_at` of the snapshot first. Else `quota_reset_date_utc`, then `quota_reset_date`, then `limited_user_reset_date`.
- Legacy Free: percent = `limited_user_quotas.x / monthly_quotas.x * 100`.
- Plan: it maps `access_type_sku` first (Free, EDU), then `copilot_plan`.

Other facts:

- CodexBar says "Reset dates are not provided by the API" ([CodexBar copilot.md][cb-copilot]). The VS Code source reads three reset fields, so this claim is old or wrong. Jarvis also lists a reset date ([Jarvis PR #347][jarvis]).
- Session and weekly rate limits (`x-usage-ratelimit-session`, `x-usage-ratelimit-weekly`) come from chat response headers, not from this endpoint ([Copilot chatQuotaServiceImpl.ts][vsc-quota-impl]). We cannot read them.
- Real payloads are not in this research. The first real capture must confirm the field names.

## Official use and documented alternatives

| Surface | Uses `copilot_internal/user`? | Source |
|---|---|---|
| VS Code core (Copilot status, usage hover, entitlement) | Yes. `"entitlementUrl": "https://api.github.com/copilot_internal/user"`. | [VS Code product.json][vsc-product], [VS Code defaultAccount.ts][vsc-da-wb] |
| Copilot extension (now `extensions/copilot` in `microsoft/vscode`) | Yes. `refreshQuota()` calls `CopilotUserInfo` and reads `quota_snapshots` and `quota_reset_date`. | [Copilot chatQuotaServiceImpl.ts][vsc-quota-impl] |
| Copilot for Xcode (GitHub) | Same shape through the language server: `chat`, `completions`, `premium_interactions`, `percentRemaining`, `resetDate`, `copilotPlan`. | [CopilotForXcode QuotaNotifier.swift][xcode] |
| GitHub REST docs | No. Not in [REST API endpoints for Copilot][rest-copilot]. | [REST API endpoints for Copilot][rest-copilot] |

Documented alternatives (details in `docs/research/copilot-usage-surfaces.md`):

- `GET /users/{username}/settings/billing/ai_credit/usage` gives credits **used** only. It has no entitlement, no remaining, no reset ([Billing usage REST API][rest-billing]). It excludes seats that an org pays for. GitHub's tutorial says it needs a classic PAT ([Automate usage reporting][billing-tutorial]).
- Copilot usage metrics give `ai_credits_used` per user, for org and enterprise admins only, in daily reports ([Copilot usage metrics API][rest-metrics], [changelog 2026-06-19][cl-metrics]).
- Seat APIs (`/orgs/{org}/copilot/billing/seats`) are for org owners and give no usage ([Copilot user management][rest-seats]).
- No documented API gives percent remaining for the signed-in user. The GitHub changelog up to 2026-09 announces none.

## Risk

Terms:

- GitHub can "modify or discontinue, temporarily or permanently, the Website (or any part of it) with or without notice" ([GitHub Terms of Service][tos]).
- "Abuse or excessively frequent requests to GitHub via the API may result in the temporary or permanent suspension of your Account's access to the API" ([GitHub Terms of Service, section H][tos]).
- The Acceptable Use Policies forbid "excessive automated bulk activity" and "undue burden on our servers" ([GitHub Acceptable Use Policies][aup]).
- The REST versioning promise (24 months for an old version) covers documented endpoints ([API versions][api-versions]). This endpoint has no version and no promise.
- The terms do not forbid a read of the user's own data with the user's own token. The risk is breakage and rate limits, not a clear terms breach. Poll slowly.

Shape changes in 2026, from the history of `src/vs/base/common/defaultAccount.ts` ([commit list][vsc-history]):

| Date | Change | Commit |
|---|---|---|
| 2025-12-03 | Add `copilot_plan` | [a85002b59][c-a850] |
| 2026-04-28 | Remove `entitlement: number` and `remaining`. Add `quota_reset_at`, `token_based_billing` (usage-based billing). | [b71276585][c-b712] |
| 2026-05-06 | Add top-level `token_based_billing`. Add `entitlement?: string` (was a number). | [c7bc16d42][c-c7bc] |
| 2026-05-06 | Add `has_quota` | [1ed89f177][c-1ed8] |
| 2026-05-13 | Add `can_upgrade_plan` | [6af53b9bf][c-6af5] |
| 2026-05-19 | Add `quota_remaining` | [f5af6b8a1][c-f5af] |
| 2026-06-11 | Add `overage_entitlement` | [9fc5f412c][c-9fc5] |
| 2026-07-08 | Add `credits_used` | [234229df2][c-2342] |

Result: the shape moves with each billing change. The core fields `percent_remaining`, `unlimited`, and `quota_snapshots` stayed. A defensive mapper survives additive changes. It must refuse a field of the wrong type, not guess.

## What the card shows

A pure mapper `mapCopilotUser` in `packages/core` feeds the card. Rules:

| Input | Card | Status bar |
|---|---|---|
| `premium_interactions` with `unlimited: false` and `entitlement` > 0 | Ring: `percent_remaining` as monthly remaining. Text: `used / entitlement` when both exist. Reset from the reset rules above. | Uses the percent. Amber and red rules apply. |
| Free plan: `chat` or `completions` limited | One ring for each limited snapshot. Legacy Free uses `limited_user_quotas / monthly_quotas`. | Lowest of the rings. |
| `unlimited: true` with `credits_used` | Text only: "N AI credits used". No ring. | No percent. No color change. |
| `unlimited: true` with no `credits_used` | "Unlimited" label. No ring. | No percent. |
| `overage_permitted: true` and percent 0 | Ring at 0 plus "Additional usage on". | Red rule applies. |
| `can_signup_for_limited: true` | `no_plan` state. | Nothing. |
| 401 | Session expired. Ask the user to sign in again. | Nothing. |
| 404, or fields missing or of the wrong type | Fall back to the seat check (`mapCopilotSeatStatus`). | No percent. |

- Plan label: map `access_type_sku`, then `copilot_plan`, the same way VS Code does.
- Never invent 100% remaining. A missing or bad `percent_remaining` gives no ring.
- Poll no more often than every 5 minutes. On 429 or `retry-after`, wait for the time GitHub gives, as VS Code does ([VS Code defaultAccount.ts][vsc-da-wb]).

## Next steps

1. Manual test by the user, not by an agent: in VS Code, get a session with `vscode.authentication.getSession('github', ['read:user'], { createIfNone: true })`. Call the endpoint once. Save the JSON with the token removed. Test one Free or Pro account and, if possible, one org seat.
2. Also call it once with our device-flow token. Expect 404. This proves the rejection for our app id.
3. Decide in #84 or #91: Copilot sign-in moves from our device flow to the VS Code built-in GitHub session. The map says "Copilot keeps GitHub OAuth (device flow)", so this is a change to the map.
4. Add `mapCopilotUser` to `packages/core` with tests from the saved JSON.
5. The Chrome extension cannot use the VS Code session. It keeps the seat check.

## Sources

[vsc-product]: https://github.com/microsoft/vscode/blob/main/product.json
[vsc-da-base]: https://github.com/microsoft/vscode/blob/main/src/vs/base/common/defaultAccount.ts
[vsc-da-wb]: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/accounts/browser/defaultAccount.ts
[vsc-ces]: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/chat/common/chatEntitlementService.ts
[vsc-quota-impl]: https://github.com/microsoft/vscode/blob/main/extensions/copilot/src/platform/chat/common/chatQuotaServiceImpl.ts
[vsc-gh-config]: https://github.com/microsoft/vscode/blob/main/extensions/github-authentication/src/config.ts
[vsc-api]: https://code.visualstudio.com/api/references/vscode-api#authentication
[vsc-history]: https://github.com/microsoft/vscode/commits/main/src/vs/base/common/defaultAccount.ts
[c-a850]: https://github.com/microsoft/vscode/commit/a85002b59
[c-b712]: https://github.com/microsoft/vscode/commit/b71276585
[c-c7bc]: https://github.com/microsoft/vscode/commit/c7bc16d42
[c-1ed8]: https://github.com/microsoft/vscode/commit/1ed89f177
[c-6af5]: https://github.com/microsoft/vscode/commit/6af53b9bf
[c-f5af]: https://github.com/microsoft/vscode/commit/f5af6b8a1
[c-9fc5]: https://github.com/microsoft/vscode/commit/9fc5f412c
[c-2342]: https://github.com/microsoft/vscode/commit/234229df2
[xcode]: https://github.com/github/CopilotForXcode/blob/main/Tool/Sources/GitHubCopilotService/Services/QuotaNotifier.swift
[cb-copilot]: https://github.com/steipete/CodexBar/blob/main/docs/copilot.md
[cb-flow]: https://github.com/steipete/CodexBar/blob/main/Sources/CodexBarCore/Providers/Copilot/CopilotDeviceFlow.swift
[jarvis]: https://github.com/rajbos/Jarvis/pull/347
[onwatch]: https://github.com/onllm-dev/onWatch/blob/main/docs/COPILOT_SETUP.md
[hermes-16551]: https://github.com/NousResearch/hermes-agent/issues/16551
[rest-copilot]: https://docs.github.com/en/rest/copilot
[rest-billing]: https://docs.github.com/en/rest/billing/usage
[billing-tutorial]: https://docs.github.com/en/billing/tutorials/automate-usage-reporting
[rest-metrics]: https://docs.github.com/en/rest/copilot/copilot-usage-metrics
[rest-seats]: https://docs.github.com/en/rest/copilot/copilot-user-management
[cl-metrics]: https://github.blog/changelog/2026-06-19-ai-credits-consumed-per-user-now-in-the-copilot-usage-metrics-api/
[tos]: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
[aup]: https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies
[api-versions]: https://docs.github.com/en/rest/about-the-rest-api/api-versions
