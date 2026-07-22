# packages/core

Shared TypeScript library. No runtime dependencies — pure types and utilities only. Host of the **V1 pure seams** (vitest).

## Exports
- `QuotaState`, `QuotaHonesty`, `QUOTA_HONESTY_LABELS`, `WsMessage`, `ServiceId`, `ClaudeSubcategory`
- `SERVICE_LABELS`, `SERVICE_COLORS`, `SERVICE_URLS`
- **Merge:** `preferQuotaState`, `upsertQuotaState`, `mergeQuotaStates` (freshest-wins by `lastUpdated`)
- **Mappers:** `mapClaudeUsage`, `mapCodexUsage` (+ response types)
- **Copilot honesty:** `copilotSeatActiveUsageUnknown`, `copilotNoPlan`, `copilotAuthUnavailable`, `mapCopilotSeatStatus`
- **Grok honesty / weekly map:** `grokUsageUnknown`, `grokNotConnected`, `grokBrowserSessionRequired`, `mapGrokWeeklyUsage`, `extractGrokWeeklyUsage`
- **Session auth failure:** `sessionAuthFailureAction`, `isSessionAuthFailure`, `isSessionCookieService` (drop ring, keep secret, re-auth signal; Grok is **not** a session-cookie service)
- **Pressure:** `pressureRemaining`, `lowestPressureAmong` (never invent 100% for honesty-only states)
- `formatTimeRemaining(ms)`, `calcPct(used, limit)`, `pctToColor(pct)`

## Rules
- No DOM, no React, no Node builtins — importable in browser, service worker, and Node
- `calcPct` returns **REMAINING** (not used)
- Never invent Copilot or Grok remaining % in builders
- Grok weekly remaining only from first-party used% (0–100); invalid input → honesty
- Never invent remaining % on Claude/Codex session auth failure (hosts drop ring + re-auth cue)
- Build: `tsc` → `dist/`; tests: `vitest run` (`*.test.ts` excluded from emit)
