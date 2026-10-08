# packages/ui

Shared React 19 components and one shared look. Used by `chrome-ext` (side panel) and `vscode-ext` (webview panels).

## Components
- `LowestLimit` - hero card. Shows the one quota window with the least left, across all providers.
- `ProviderCard` - one provider: logo, status pill, quota windows, sub-buckets, balance, or a connect hint and a host action.
- `KeyGroupCard` - one card for each API key provider: logo, caption, key count, status pill, and one `KeyRow` for each key. Hosts pass header and row controls.
- `KeyRow` - one named key: name, last 4 characters, and its number (`describeKey`). A unit such as "requests" shows small, like the "%" of the plan cards.
- `UsageBar` - one quota window: label, reset time, mono percent, segmented gauge.
- `Meter` - segmented gauge (20 cells). Any quota left lights at least one cell.
- `ProviderLogo` - brand mark on a brand-color tile.
- `QuotaLoadingFallback` / `QuotaErrorFallback` - for `<Suspense>` and `<ErrorBoundary>`.
- `level(pct)` - `ok` / `low` (< 10%) / `critical` (< 5%). Same thresholds as the badge.

## Styles
- `@ai-quota-tool/ui/styles.css` - tokens (`--aq-*`), cards, gauge, hero, buttons. Light and dark follow the OS.
- `@ai-quota-tool/ui/vscode.css` - maps `--aq-*` to the active VS Code theme (`--vscode-*`), fonts included. Import it after `styles.css`.
- Components use class names from `styles.css`. A host restyles by setting `--aq-*` variables.

## Rules
- **No data fetching** - pure display only. All async logic lives in the consuming package.
- **No router** and **no state management** - components are props-driven.
- React Compiler is enabled - do not add `useMemo` or `useCallback`.

## Dev preview
```bash
pnpm --filter @ai-quota-tool/ui dev
```
Opens a Vite dev server with mock data at `localhost:5173`.
Query options: `?host=chrome|vscode&theme=dark|light&width=380`.
