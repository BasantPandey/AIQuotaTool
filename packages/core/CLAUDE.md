# packages/core

Shared TypeScript library. No runtime dependencies — pure types and utilities only. Host of the **V1 pure seams** (vitest).

## Exports
- `QuotaState`, `QuotaHonesty`, `QUOTA_HONESTY_LABELS`, `WsMessage`, `ServiceId`, `ClaudeSubcategory`
- `SERVICE_LABELS`, `SERVICE_COLORS`, `SERVICE_URLS`
- **Merge:** `preferQuotaState`, `upsertQuotaState`, `mergeQuotaStates` (freshest-wins by `lastUpdated`)
- **Mappers:** `mapClaudeUsage`, `mapCodexUsage` (+ response types)
- **Copilot honesty:** `copilotSeatActiveUsageUnknown`, `copilotNoPlan`, `copilotAuthUnavailable`
- `formatTimeRemaining(ms)`, `calcPct(used, limit)`, `pctToColor(pct)`

## Rules
- No DOM, no React, no Node builtins — importable in browser, service worker, and Node
- `calcPct` returns **REMAINING** (not used)
- Never invent Copilot remaining % in builders
- Build: `tsc` → `dist/`; tests: `vitest run` (`*.test.ts` excluded from emit)
