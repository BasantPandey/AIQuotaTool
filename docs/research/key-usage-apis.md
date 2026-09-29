# Research: Key usage and balance APIs

**Ticket:** [#87](https://github.com/BasantPandey/AIQuotaTool/issues/87) (part of [#84](https://github.com/BasantPandey/AIQuotaTool/issues/84))  
**Branch:** `research/key-usage-apis`  
**Date:** 2026-09-29  
**Scope:** Official API docs of each provider. One exception: Z.ai. For Z.ai, the source is the provider's own plugin code on its official GitHub org. This doc labels that source.  
**Product context:** A **Key** is a named API key that the user adds. The Key card shows the use, spend, or balance of that key. A provider ships only if it has a data source with real numbers. **Never invent 100% remaining.**

No paid API was called for this research. No secret was used or stored.

---

## Summary

Verdict words:

- **Ship** - a normal key reads real numbers with a free call.
- **Opt-in** - real numbers exist, but only with an Admin or management key. That key has high power. Ship it only as a separate, clearly labeled option.
- **No-ship** - no API gives real numbers for a key.

| Provider | Endpoint | Key type | Numbers | Scope | Per-key breakdown | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| Anthropic | `GET /v1/organizations/usage_report/messages`, `GET /v1/organizations/cost_report` | Admin key only. Workspace keys fail. Not for individual accounts. | Token counts (history). Cost in USD cents (daily). No balance. | Org | Yes. Usage report takes `api_key_ids[]` and `group_by[]=api_key_id`. Cost report groups by workspace or description only. | Normal key: **No-ship**. Admin key: **Opt-in** |
| OpenAI | `GET /v1/organization/usage/completions`, `GET /v1/organization/costs` | Admin key only | Token and request counts. Cost in USD. No balance. | Org | Yes. Both take `api_key_ids` and `group_by=api_key_id`. | Normal key: **No-ship**. Admin key: **Opt-in** |
| DeepSeek | `GET https://api.deepseek.com/user/balance` | Normal key | Balance: total, granted, topped-up (CNY or USD). `is_available`. | Account | No | **Ship** (already built) |
| Kimi (Moonshot) | `GET https://api.moonshot.ai/v1/users/me/balance` | Normal key | Balance in USD: available, voucher, cash | Account | No | **Ship** (already built) |
| OpenRouter | `GET https://openrouter.ai/api/v1/key` | Normal key | Spend in USD: all time, day, week, month. Key limit, limit remaining, limit reset. | **Per key** | Yes, native | **Ship** |
| xAI | `GET /v1/billing/teams/{team_id}/prepaid/balance` and more on `https://management-api.x.ai` | Management key only. Normal key `GET /v1/api-key` gives status flags only. | Prepaid balance, invoice preview, spend history, spend limits | Team | Not documented | Normal key: **No-ship**. Management key: **Opt-in** |
| Mistral | `GET https://api.mistral.ai/v1/admin/usage`, `/v1/admin/spend-limit`, `/v1/admin/rate-limit` | Admin API key only | Cost and use for a month. Spend limit. Rate limits. | Org, filter by workspace | No (workspace only) | Normal key: **No-ship**. Admin key: **Opt-in** |
| Groq | No usage or balance API. Only `x-ratelimit-*` response headers. | Normal key | Requests per day and tokens per minute: limit and remaining | Org | No | **No-ship** |
| Z.ai (GLM) | `GET https://api.z.ai/api/monitor/usage/quota/limit` (not in API reference) | Normal key | Percent for a 5-hour token window and a 1-month MCP window | Account (GLM Coding Plan, Personal) | No | **Ship after spike**, Coding Plan only. Pay-as-you-go balance: **No-ship** |
| Google AI Studio (Gemini API) | None | - | Usage shows only in AI Studio and Cloud Billing | Project and billing account | No | **No-ship** |

Main findings:

1. Only **OpenRouter** gives real numbers for **one key** with a normal key.
2. **DeepSeek** and **Kimi** give the **account** balance with a normal key. The Key card must say "account balance", not "key balance".
3. **Anthropic** and **OpenAI** give a true per-key breakdown, but only with an **Admin key**. That key can manage the whole org.
4. **Rate-limit headers** come back only on model calls. A model call costs money on a paid plan. No provider documents a free call that returns them. So headers are not a usable source.

---

## 1. Anthropic

### Normal API key

- The API sends `anthropic-ratelimit-*` headers on its responses. Examples: `anthropic-ratelimit-requests-remaining`, `anthropic-ratelimit-tokens-remaining`, `anthropic-ratelimit-tokens-reset`. Source: [Rate limits - Response headers](https://platform.claude.com/docs/en/api/rate-limits#response-headers).
- These limits are per minute. The API sets them for the org. A workspace can have lower limits. The token headers show the most restrictive limit in effect. Source: [Rate limits](https://platform.claude.com/docs/en/api/rate-limits).
- To get these headers, you must call the Messages API. That call costs money.
- Token counting (`POST /v1/messages/count_tokens`) is free. But it has its own, separate rate limits. The docs do not say that it returns the Messages rate-limit headers. Source: [Token counting - Pricing and rate limits](https://platform.claude.com/docs/en/build-with-claude/token-counting#pricing-and-rate-limits).
- No endpoint gives balance, credits, or spend to a normal key.

**Verdict (normal key): No-ship.**

### Admin key

- Usage report: `GET https://api.anthropic.com/v1/organizations/usage_report/messages`. It gives token counts in time buckets (`1m`, `1h`, `1d`). It filters by `api_key_ids[]` and groups by `api_key_id`, workspace, model, and more. Source: [Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api#usage-api).
- Cost report: `GET https://api.anthropic.com/v1/organizations/cost_report`. It gives cost in USD as decimal strings in cents. Daily buckets only. It groups by `workspace_id` or `description`. It does not group by API key. Source: [Usage and Cost API - Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api#cost-api).
- Rate limits API: `GET /v1/organizations/rate_limits`. It gives the configured limits, not current use. Source: [Rate Limits API](https://platform.claude.com/docs/en/manage-claude/rate-limits-api).
- Key type: an Admin API key (`sk-ant-admin01-...`), an OAuth token with `org:admin`, or a personal or service account key with no workspace scope. Workspace keys do not work. Source: [Usage and Cost API](https://platform.claude.com/docs/en/manage-claude/usage-cost-api).
- The Admin API is **not available for individual accounts**. Source: same page.
- Data comes in about 5 minutes. The API supports one poll per minute. Source: same page, FAQ.
- The numbers are history (tokens used, cost). They are not a balance and not "remaining". The org spend cap is on the Billing page only. Source: [Rate limits - Spend limits](https://platform.claude.com/docs/en/api/rate-limits#spend-limits).

**Verdict (Admin key): Opt-in.** The card can show tokens used today for one `api_key_id`. It can show org cost. It cannot show a remaining percent.

---

## 2. OpenAI

### Normal API key

- The API sends `x-ratelimit-limit-requests`, `x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`, `x-ratelimit-reset-tokens`, and project token headers. Source: [Rate limits - Rate limits in headers](https://developers.openai.com/api/docs/guides/rate-limits).
- Limits are set for the org and the project, not the user. Source: same page.
- The docs do not say which calls return these headers. A free call is not documented as a source. A model call costs money.
- No documented endpoint gives balance or credits to a normal key.

**Verdict (normal key): No-ship.**

### Admin key

- Usage: `GET https://api.openai.com/v1/organization/usage/completions`. It gives input tokens, output tokens, cached tokens, and request counts. It groups by `project_id`, `user_id`, `api_key_id`, `model`, `batch`, `service_tier`. Source: [Usage - Completions](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions).
- Costs: `GET https://api.openai.com/v1/organization/costs`. It gives amount and currency. It groups by `project_id`, `line_item`, `api_key_id`. It filters by `api_key_ids`. Source: [Usage - Costs (Python reference)](https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/usage/methods/costs).
- Both need an Admin key from the org settings. Source: [Cookbook - How to use the Usage API and Cost API](https://developers.openai.com/cookbook/examples/completions_usage_api).
- The numbers are history. They are not a balance.

**Verdict (Admin key): Opt-in.** The card can show spend and tokens for one `api_key_id`. It cannot show a remaining percent.

---

## 3. DeepSeek

- Endpoint: `GET https://api.deepseek.com/user/balance` with the normal key as a Bearer token. Source: [Get User Balance](https://api-docs.deepseek.com/api/get-user-balance).
- Fields: `is_available` (the balance is enough for API calls), and `balance_infos[]` with `currency` (CNY or USD), `total_balance`, `granted_balance`, `topped_up_balance`. Amounts are decimal strings. Source: same page.
- The path is `/user/...`. The numbers are for the account, not for one key.
- The code already has this: `mapDeepSeekBalance` in `packages/core/src/deepseek.ts`, and `fetchDeepSeekBalance` in `packages/vscode-ext/src/quota-poller.ts`.

**Verdict: Ship** (already built). Label the number as the account balance.

---

## 4. Kimi (Moonshot)

- Endpoint: `GET https://api.moonshot.ai/v1/users/me/balance` with the normal key as a Bearer token. Source: [Check Balance](https://platform.kimi.ai/docs/api/balance).
- Fields: `available_balance` (cash plus voucher, USD), `voucher_balance` (cannot go below zero), `cash_balance` (can go below zero, that is debt). When `available_balance` is 0 or less, requests fail with `exceeded_current_quota_error`. Source: same page.
- The path is `/users/me/`. The numbers are for the account.
- The code already has this: `mapKimiBalance` in `packages/core/src/kimi.ts`.

**Verdict: Ship** (already built). Label the number as the account balance.

---

## 5. OpenRouter

- Endpoint: `GET https://openrouter.ai/api/v1/key` with the normal key as a Bearer token. Source: [Get current API key](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key).
- Fields, all for **this key**, in USD credits:
  - `usage`, `usage_daily`, `usage_weekly`, `usage_monthly` - spend (UTC day, week, month).
  - `limit` - the spend cap on the key, or `null` for no cap.
  - `limit_remaining` - the budget that is left on the key.
  - `limit_reset` - how often the key limit resets.
  - `byok_usage*` - spend on the user's own provider keys (BYOK).
  - `is_free_tier`, `free_model_daily_requests` - free-model use.
  - Source: same page and [Limits](https://openrouter.ai/docs/api/reference/limits).
- Account total: `GET https://openrouter.ai/api/v1/credits` gives `total_credits` and `total_usage`. It needs a **management key**. A normal key gets 403. Source: [Get remaining credits](https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits).
- A true remaining percent is possible only when `limit` is not `null`. Then remaining percent = `limit_remaining / limit`. When `limit` is `null`, show spend only. Do not show 100%.

**Verdict: Ship.** This is the best fit for a Key card.

---

## 6. xAI

### Normal API key

- Endpoint: `GET https://api.x.ai/v1/api-key`. It gives key facts: `name`, `api_key_id`, `team_id`, `acls`, `api_key_blocked`, `api_key_disabled`, `team_blocked`. It gives no spend or balance. Source: [Inference API - Other](https://docs.x.ai/developers/rest-api-reference/inference/other).
- Rate limits are per team and per model (requests per second, tokens per minute). The docs do not list rate-limit response headers. Source: [Rate Limits](https://docs.x.ai/developers/rate-limits).

**Verdict (normal key): No-ship.** The blocked flags can support a status such as "key disabled", but they give no numbers.

### Management key

- Base URL: `https://management-api.x.ai`. The management key is separate from the API key. Source: [Using Management API](https://docs.x.ai/developers/management-api-guide).
- `GET /v1/billing/teams/{team_id}/prepaid/balance` - prepaid credit changes and a total.
- `GET /v1/billing/teams/{team_id}/postpaid/invoice/preview` - invoice lines and the current spend limit.
- `POST /v1/billing/teams/{team_id}/usage` - spend history with `groupBy` and `filters`.
- `GET /v1/billing/teams/{team_id}/postpaid/spending-limits` - hard and soft limits.
- Source: [Billing Management](https://docs.x.ai/developers/rest-api-reference/management/billing).
- The numbers are for the team. The docs do not list the allowed `groupBy` values. A per-key breakdown is not confirmed.
- The balance example shows `{"total": {"val": "-1000"}}`. The docs do not state the unit or the sign rule. A spike must confirm them before a build.

**Verdict (management key): Opt-in**, after a spike on units.

---

## 7. Mistral

- Admin API endpoints with an Admin API key in the `x-api-key` header. Source: [Usage metrics](https://docs.mistral.ai/admin/admin-api/usage-metrics):
  - `GET https://api.mistral.ai/v1/admin/usage` - cost and use for a `month` and `year`. Optional `workspace_id`.
  - `GET https://api.mistral.ai/v1/admin/spend-limit` - the org spend cap.
  - `GET https://api.mistral.ai/v1/admin/rate-limit` - the per-model token limits.
- Rate limits apply to a workspace. All keys in the workspace share them. Limits are requests per second, tokens per minute, and tokens per month. Source: [Workspace usage and limits](https://docs.mistral.ai/admin/workspaces/usage-limits).
- The pages checked do not document rate-limit response headers or a normal-key usage endpoint.
- Billing is for the org. Source: [Billing](https://docs.mistral.ai/admin/user-management-finops/billing).

**Verdict: normal key No-ship. Admin key Opt-in.** With `spend-limit` and `usage`, spend against the cap is a real number for the org.

---

## 8. Groq

- The API sends `x-ratelimit-limit-requests` (requests per day), `x-ratelimit-limit-tokens` (tokens per minute), `x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`, and `retry-after` on 429. Source: [Rate Limits](https://console.groq.com/docs/rate-limits).
- Limits apply to the org, not to one user or key. Source: same page.
- Spend limits apply to the whole org, across all keys. Usage shows only in the console dashboard. Source: [Spend Limits](https://console.groq.com/docs/spend-limits).
- No usage, spend, or balance API is documented. Source: [API Reference](https://console.groq.com/docs/api-reference).
- To get the headers, you must call a model. On the Developer plan that call costs money. On the free plan it uses the user's quota.

**Verdict: No-ship.**

---

## 9. Z.ai (GLM)

- The API reference documents no balance, billing, or usage endpoint. Source: [API Introduction](https://docs.z.ai/api-reference/introduction).
- Z.ai documents a "Usage Query Plugin" for the GLM Coding Plan (Personal plan only). Source: [Usage Query Plugin](https://docs.z.ai/devpack/extension/usage-query-plugin).
- The plugin code is on Z.ai's official GitHub org. It calls these endpoints with the user's API key in the `Authorization` header (no `Bearer` prefix). Source: [zai-org/zai-coding-plugins - query-usage.mjs](https://github.com/zai-org/zai-coding-plugins/blob/main/plugins/glm-plan-usage/skills/usage-query-skill/scripts/query-usage.mjs).
  - `GET https://api.z.ai/api/monitor/usage/quota/limit` - `limits[]` with `type` `TOKENS_LIMIT` (5-hour token window, `percentage`) and `TIME_LIMIT` (1-month MCP window, `percentage`, `currentValue`, `usage`).
  - `GET https://api.z.ai/api/monitor/usage/model-usage` and `.../tool-usage` - use in a time range.
  - The same paths exist on `open.bigmodel.cn` for the China platform.
- This source is **provider code, not API reference**. Z.ai can change it without notice.
- The docs do not say if `percentage` is used or remaining. The plugin labels it as "usage". A spike must confirm this with a real Coding Plan key.
- The numbers are for the Coding Plan subscription, so they act like an Account plan limit. The key is only the way to read them.
- For pay-as-you-go keys, no balance endpoint is documented.

**Verdict: Ship after spike**, for GLM Coding Plan keys only. Pay-as-you-go balance: **No-ship**.

---

## 10. Google AI Studio (Gemini API)

- Rate limits apply per project, not per API key. You see them in AI Studio. The docs list no API to read them and no rate-limit headers. Source: [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).
- Usage shows in AI Studio (Dashboard > Usage). Cost shows in Cloud Billing, often a day late. All keys in a project count toward the project spend cap. Prepay balance is managed only in the AI Studio Billing tab. Source: [Billing](https://ai.google.dev/gemini-api/docs/billing).
- No API gives balance, spend, or use to an API key.

**Verdict: No-ship.**

---

## 11. Notes for the spec (#84)

1. Build the Key card on three number types: **balance** (DeepSeek, Kimi, xAI), **spend against a cap** (OpenRouter with a limit, Mistral), and **spend or tokens only** (OpenRouter with no limit, Anthropic, OpenAI). Show a remaining percent only when the API gives a real cap.
2. Label the scope on the card. DeepSeek and Kimi show the account. OpenRouter shows the key. Admin-key sources show the org, or one key when filtered by `api_key_id`.
3. Admin and management keys can manage the whole org. Keep them as a separate, opt-in key type with a clear warning. Keep them in SecretStorage. Send each key only to its own provider host.
4. Do not use rate-limit headers as a Key source. Each read needs a model call, which costs money or uses quota.
5. Before a build, run a spike for the xAI balance unit and for the Z.ai `percentage` meaning.

---

## Sources

| Source | Used for |
| --- | --- |
| https://platform.claude.com/docs/en/manage-claude/usage-cost-api | Anthropic usage and cost reports, Admin key, group by `api_key_id` |
| https://platform.claude.com/docs/en/api/rate-limits | Anthropic rate-limit headers, org scope, spend caps |
| https://platform.claude.com/docs/en/manage-claude/rate-limits-api | Anthropic configured limits (Admin key) |
| https://platform.claude.com/docs/en/build-with-claude/token-counting | Token counting is free, separate limits |
| https://developers.openai.com/api/docs/guides/rate-limits | OpenAI rate-limit headers, org and project scope |
| https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions | OpenAI usage API, `group_by` |
| https://developers.openai.com/api/reference/python/resources/admin/subresources/organization/subresources/usage/methods/costs | OpenAI costs API, `api_key_id` |
| https://developers.openai.com/cookbook/examples/completions_usage_api | OpenAI Admin key requirement |
| https://api-docs.deepseek.com/api/get-user-balance | DeepSeek balance |
| https://platform.kimi.ai/docs/api/balance | Kimi balance |
| https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key | OpenRouter per-key spend and limit |
| https://openrouter.ai/docs/api/reference/limits | OpenRouter credit limits |
| https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits | OpenRouter account credits (management key) |
| https://docs.x.ai/developers/rest-api-reference/inference/other | xAI `GET /v1/api-key` |
| https://docs.x.ai/developers/management-api-guide | xAI management key |
| https://docs.x.ai/developers/rest-api-reference/management/billing | xAI billing endpoints |
| https://docs.x.ai/developers/rate-limits | xAI team rate limits |
| https://docs.mistral.ai/admin/admin-api/usage-metrics | Mistral Admin API usage, spend limit, rate limit |
| https://docs.mistral.ai/admin/workspaces/usage-limits | Mistral workspace rate limits |
| https://docs.mistral.ai/admin/user-management-finops/billing | Mistral org billing |
| https://console.groq.com/docs/rate-limits | Groq rate-limit headers, org scope |
| https://console.groq.com/docs/spend-limits | Groq org spend limits |
| https://docs.z.ai/api-reference/introduction | Z.ai API reference (no usage endpoint) |
| https://docs.z.ai/devpack/extension/usage-query-plugin | Z.ai Coding Plan usage plugin |
| https://github.com/zai-org/zai-coding-plugins | Z.ai plugin code with the quota endpoints |
| https://ai.google.dev/gemini-api/docs/rate-limits | Gemini per-project limits |
| https://ai.google.dev/gemini-api/docs/billing | Gemini usage and billing surfaces |
