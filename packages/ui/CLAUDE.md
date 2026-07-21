# packages/ui

Shared React 19 component library. Used by both `chrome-ext` (popup) and `vscode-ext` (webview panel).

## Components
- `QuotaDashboard` — root component; receives `QuotaState[]` and renders one `QuotaCard` per service. Also exports `QuotaLoadingFallback` and `QuotaErrorFallback` for use in `<Suspense>` and `<ErrorBoundary>`.
- `QuotaCard` — single service card with two `ProgressRing`s (session + weekly) and optional `SubcategoryRow`s
- `ProgressRing` — SVG circular arc showing % remaining; color auto-derived via `pctToColor`
- `ServiceHeader` — service name + icon + "updated X ago" freshness label
- `SubcategoryRow` — thin bar for Claude sub-buckets (Sonnet / Designs / Daily Routines)

## Rules
- **No data fetching** — pure display only. All async logic lives in the consuming package.
- **No router** — no routing needed; both Chrome popup and VS Code webview are single-view
- **No state management** — components are props-driven; TanStack Query lives in the consumer
- React Compiler is enabled — do not add `useMemo` or `useCallback`
- Wrap consumers in `<Suspense fallback={<QuotaLoadingFallback />}>` and `<ErrorBoundary FallbackComponent={QuotaErrorFallback}>`

## Dev preview
```bash
pnpm --filter @ai-quota-tool/ui dev
```
Opens a Vite dev server with mock data at `localhost:5173`.
