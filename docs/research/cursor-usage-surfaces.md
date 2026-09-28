# Cursor usage surfaces (issue #61)

Question: How can a Chrome MV3 extension read Cursor usage and limits from the user's own browser session, with no server?

Date: 2026-09-24.

## Summary

- Use `GET https://cursor.com/api/usage-summary` with `credentials: 'include'`.
- The browser sends the `WorkosCursorSessionToken` cookie. No token handling is necessary in the extension.
- The response gives percent used, dollar amounts in cents, and the billing cycle end.
- Cursor has no official public API for personal usage. The endpoint is the one the cursor.com dashboard uses. It can change without notice.
- Verdict: ship it, with a defensive mapper and the same honesty rules as Grok. Never invent 100% remaining.

## Endpoint

| Item | Value | Source |
|---|---|---|
| URL | `GET https://cursor.com/api/usage-summary` | [CodexBar docs/cursor.md][codexbar], [codeburn cursor.ts][codeburn] |
| Auth | Cookie `WorkosCursorSessionToken=<userId>%3A%3A<jwt>` (httpOnly, on `cursor.com`) | [codeburn cursor.ts][codeburn], [CodexBar][codexbar] |
| Other session cookies | `__Secure-next-auth.session-token`, `next-auth.session-token` (older) | [CodexBar][codexbar] |
| User identity | `GET https://cursor.com/api/auth/me` (id, email, name) | [CodexBar][codexbar] |
| Legacy request-based plans | `GET https://cursor.com/api/usage?user=<id>` (request counts and limits) | [CodexBar][codexbar] |

The `POST /api/dashboard/*` endpoints need `Origin: https://cursor.com` ([CodexBar][codexbar]). We do not need them for quota.

## Response shape

From the Raycast `cursor-costs` extension types ([raycast types.ts][raycast]) and [ClaudeBar #303][claudebar]:

```ts
interface UsageSummary {
  billingCycleStart: string;   // ISO date
  billingCycleEnd: string;     // ISO date
  membershipType: string;      // e.g. "pro", "ultra", "free"
  limitType: string;
  isUnlimited: boolean;
  individualUsage: {
    plan: {
      enabled: boolean;
      used: number;            // cents
      limit: number;           // cents
      remaining: number;       // cents
      breakdown: { included: number; bonus: number; total: number }; // cents
      autoPercentUsed?: number;   // Cursor Models pool
      apiPercentUsed?: number;    // Other (third-party) Models pool
      totalPercentUsed?: number;  // combined
    };
    onDemand: { enabled: boolean; used: number; limit: number | null; remaining: number | null };
  };
  teamUsage: Record<string, unknown>;
}
```

Notes:
- The two pools can differ a lot. ClaudeBar reports auto 39.9%, API 97.2%, total 44.7% on one account ([ClaudeBar #303][claudebar]). Show the lowest remaining pool as pressure, not only the total.
- The percent fields are optional. If they are absent, compute from `used` / `limit`. If `limit` is 0 or absent, report usage unknown.

## Plan limits per tier

From [Cursor pricing][pricing] and [Pricing and plans][help-pricing] (check again before ship, Cursor changes pricing often):

| Plan | Price / month | Included API usage |
|---|---|---|
| Pro | $20 | $20 |
| Pro+ | $60 | $70 |
| Ultra | $200 | $400 |

- Pro, Pro+ and Ultra have two pools: Cursor Models and Other Models ([Usage and limits][help-limits]).
- The Start plan has the Cursor Models pool only ([Usage and limits][help-limits]).
- Allowances reset each billing cycle. Unused usage does not roll over ([Usage and limits][help-limits]).
- Do not hard-code tier limits. The response already contains `limit` in cents.

## Chrome MV3 fit

- Add `https://cursor.com/*` to `host_permissions`. Then a service worker `fetch(..., { credentials: 'include' })` sends the cookie. This is the same pattern as `ClaudeFetcher` in `packages/chrome-ext/src/background/fetchers/claude.ts`.
- 401 means session expired. Return `sessionExpired('cursor')`.
- 403 can be a bot check. Throw, so the freshest-wins merge keeps the last good reading. CodexBar backs off for 6 hours on 403 ([CodexBar][codexbar]).
- Put the pure mapper `mapCursorUsageSummary` in `@ai-quota-tool/core` with tests.

## Other paths (not for Chrome)

- The Cursor desktop app keeps a JWT in `state.vscdb` (`cursorAuth/accessToken`). CodeBurn reads it and calls the same `usage-summary` endpoint ([codeburn][codeburn]). This fits the VS Code extension later, not Chrome.
- `POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage` with a Bearer JWT returns similar fields ([PokeTokenBar #272][poke]). It needs the desktop token.

## Reliability

- Unofficial endpoint. Many open-source tools use it (CodexBar, Raycast, CodeBurn, ClaudeBar). This makes breakage visible fast.
- Risk: field names or units can change. Validate each field. On a bad shape, return usage unknown, not 100%.
- Poll at the normal 60 s alarm or slower. Cursor rate limits are not documented.

## Sources

[codexbar]: https://github.com/steipete/CodexBar/blob/main/docs/cursor.md
[codeburn]: https://github.com/getagentseal/codeburn/blob/main/src/quota/cursor.ts
[raycast]: https://github.com/raycast/extensions/blob/main/extensions/cursor-costs/src/types.ts
[claudebar]: https://github.com/tddworks/ClaudeBar/issues/303
[poke]: https://github.com/chattymin/PokeTokenBar/issues/272
[pricing]: https://cursor.com/pricing
[help-pricing]: https://cursor.com/help/account-and-billing/pricing
[help-limits]: https://cursor.com/help/models-and-usage/usage-limits

- CodexBar Cursor docs: https://github.com/steipete/CodexBar/blob/main/docs/cursor.md
- CodeBurn Cursor provider: https://github.com/getagentseal/codeburn/blob/main/src/quota/cursor.ts
- Raycast cursor-costs types: https://github.com/raycast/extensions/blob/main/extensions/cursor-costs/src/types.ts
- ClaudeBar issue #303: https://github.com/tddworks/ClaudeBar/issues/303
- PokeTokenBar issue #272: https://github.com/chattymin/PokeTokenBar/issues/272
- Cursor pricing: https://cursor.com/pricing
- Cursor help, pricing: https://cursor.com/help/account-and-billing/pricing
- Cursor help, usage and limits: https://cursor.com/help/models-and-usage/usage-limits
