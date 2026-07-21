# packages/core

Shared TypeScript library. No runtime dependencies — pure types and utilities only. Host of the **V1 pure seams** (vitest).

## Exports
- `QuotaState`, `QuotaHonesty`, `QUOTA_HONESTY_LABELS`, `WsMessage`, `ServiceId`, `ClaudeSubcategory`
- `SERVICE_LABELS`, `SERVICE_COLORS`, `SERVICE_URLS`
- **Merge:** `preferQuotaState`, `upsertQuotaState`, `mergeQuotaStates` (freshest-wins by `lastUpdated`)
- **Mappers:** `mapClaudeUsage`, `mapCodexUsage` (+ response types)
- **Copilot honesty:** `copilotSeatActiveUsageUnknown`, `copilotNoPlan`, `copilotAuthUnavailable`
- **Session auth failure:** `sessionAuthFailureAction`, `isSessionAuthFailure`, `isSessionCookieService` (drop ring, keep secret, re-auth signal)
- **Pressure:** `pressureRemaining`, `lowestPressureAmong` (never invent 100% for honesty-only states)
- `formatTimeRemaining(ms)`, `calcPct(used, limit)`, `pctToColor(pct)`

## Rules
- No DOM, no React, no Node builtins — importable in browser, service worker, and Node
- `calcPct` returns **REMAINING** (not used)
- Never invent Copilot remaining % in builders
- Never invent remaining % on Claude/Codex session auth failure (hosts drop ring + re-auth cue)
- Build: `tsc` → `dist/`; tests: `vitest run` (`*.test.ts` excluded from emit)
