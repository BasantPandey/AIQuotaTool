# Gemini usage surfaces (issue #60)

Question: How can the Chrome MV3 extension read Gemini usage and limits from the user's browser session, with no server?

Date: 2026-09-24.

## Short answer

- Google has **no public API** for consumer Gemini Apps usage.
- gemini.google.com shows usage at **Settings > Usage limits**. The page gets its data from a private RPC.
- A live-session fetcher (like `grok.ts`) is possible. It must use the private RPC, which can change without notice.
- Recommendation: do **not** ship yet. First capture the real RPC with DevTools on a signed-in account. Then write a pure mapper in `@ai-quota-tool/core` with an honesty fallback (never invent 100%).

## 1. Consumer app: gemini.google.com

### Limit model (official)

Source: [Gemini Apps limits, Google Help](https://support.google.com/gemini/answer/16275805).

- The limit refreshes every **5 hours** until the user reaches a **weekly** limit.
- Google does not publish prompt counts. It publishes only multipliers:

| Plan | Limit |
|---|---|
| Free | Standard |
| Google AI Plus | 2x standard |
| Google AI Pro | 4x standard |
| Google AI Ultra | 5x or 20x AI Pro |

- "Limits may change without notice, including due to capacity constraints."
- The app notifies the user near the limit. The user can see remaining usage at **Settings > Usage limits**.

Result: We cannot compute remaining % from a static plan table. We must read the meter from the session.

### Endpoint and auth

- The web app uses Google `batchexecute` RPCs (`/_/BardChatUi/data/batchexecute`) with session cookies (`SID`, `__Secure-1PSID`, and others) plus a page token (`SNlM0e`/`at`) from the HTML bootstrap. This is the same pattern as other Google web apps.
- The usage page reads the 5-hour and weekly meters through a private usage RPC. [HemSoft/codexbar-ios #296](https://github.com/HemSoft/codexbar-ios/issues/296) confirms this. That issue does not publish the RPC id or the field names. It states: "Google does not publish an OAuth scope or public API for the consumer Gemini Apps usage counters."
- I did not find an open-source project that publishes the RPC id and response shape. **Open item:** capture it in DevTools (Network, filter `batchexecute`, open Settings > Usage limits).

### MV3 fit

- `host_permissions: ["https://gemini.google.com/*"]` plus `fetch(..., { credentials: 'include' })` sends the user's cookies, same as `grok.ts`.
- The fetcher must first GET `https://gemini.google.com/app` to read the `at` token, then POST the RPC. `batchexecute` returns a `)]}'` prefixed, nested-array body. The mapper must parse by position, which is fragile.
- A content script on gemini.google.com can be a second path (same as claude/chatgpt `content_quota`).

## 2. AI Studio / Gemini API

Source: [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

- Limits are per project: RPM, TPM, RPD. RPD resets at midnight Pacific.
- Google gives no API to read remaining quota. The user views limits at `aistudio.google.com/rate-limit`.
- This is API key usage, not the consumer app. It is not relevant for V2 unless users ask. Skip.

## 3. Gemini CLI / Code Assist (not consumer web)

Source: [CodexBar docs/gemini.md](https://github.com/steipete/CodexBar/blob/main/docs/gemini.md).

- `POST https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota` returns buckets with `modelId`, `remainingFraction`, `resetTime`.
- `POST .../v1internal:loadCodeAssist` returns tier (`free-tier`, `standard-tier`, ...).
- Auth is Gemini CLI OAuth (`~/.gemini/oauth_creds.json`), not browser cookies. CodexBar does **not** read gemini.google.com.
- A Chrome extension cannot read that file. This path fits the VS Code extension better, and only for CLI quota, not Gemini Apps.

## Reliability verdict

| Surface | Auth | Stable? | Ship in Chrome? |
|---|---|---|---|
| gemini.google.com usage RPC | Browser cookies | No, private, positional arrays | Only behind honesty fallback, after capture |
| AI Studio rate limits | Console page | No API | No |
| cloudcode-pa retrieveUserQuota | CLI OAuth | Private, but JSON with named fields | No (VS Code candidate) |

## Next steps

1. Capture the usage RPC id and a sanitized response on Free and Pro accounts.
2. Add `mapGeminiUsage` and `geminiNotConnected` / `geminiUsageUnknown` honesty builders in core, with tests.
3. Add `packages/chrome-ext/src/background/fetchers/gemini.ts` on the `grok.ts` pattern.
4. On parse failure, show "usage unknown", never 100%.
