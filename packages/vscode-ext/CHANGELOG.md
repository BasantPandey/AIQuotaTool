# Changelog

## [0.7.1] - 2026-07-21

### Honest Copilot + pressure
- Shared pure `mapCopilotSeatStatus` for seat HTTP to honesty states (Chrome and VS Code)
- Chrome no longer calls undocumented `/user/copilot/usage`
- `pressureRemaining` / `lowestPressureAmong` for badge and status bar (never invent 100% for honesty-only)
- Session auth failure: keep secret, drop ring, status bar + dashboard re-auth cue
- Chrome Settings privacy disclosure; drop unused `api.openai.com` host permission

## [0.7.0] - 2026-07-21

### V1 product bar
- **Dual-mode equal:** standalone poller and optional Chrome push both first-class; freshest-wins merge by `lastUpdated`
- **Honest Copilot:** no fabricated 100% remaining; seat / no-plan / auth-unavailable labels
- **Shared pure mappers** for Claude and Codex in `@ai-quota-tool/core` (used by VS Code and Chrome)
- **Credential lifecycle:** clear Claude/Codex secrets; privacy disclosure for session cookies in SecretStorage; 401/403 drops stale rings
- **Status bar:** uses min(session, weekly) remaining for display and low-quota warning
- **Empty state:** points to Set Up Accounts (and optional Chrome), not Chrome-only "not connected"
- Docs and agent notes aligned with dual-mode architecture

## [0.6.x] — 2026-06 / 2026-07

### Notes
- Session-key Claude auth, poll-after-save, storage merge hardening, and packaging bumps through 0.6.3 (see git history for incremental commits)

## [0.3.1] — 2026-06-23

### Fixed
- Claude and Codex API calls now include browser-like headers (`User-Agent`, `Referer`, `Origin`) to avoid HTTP 403 rejections from their servers

## [0.3.0] — 2026-06-23

### Fixed
- Each service account is now explicitly optional — set up only the services you use
- Setup panel tabs show ✓/○/✗ status at a glance without clicking each tab
- "Done — open dashboard" button closes setup and immediately shows quota for connected accounts
- Removed misleading "Install the Chrome extension" message — VS Code extension is fully standalone

## [0.2.0] — 2026-06-23

### Added
- **Account Setup panel** — dedicated webview with one tab per service replacing the old blind input boxes
- **Claude tab**: step-by-step guide to retrieve the `sessionKey` cookie; "Save & Test" validates the key and shows the org name before saving
- **Codex tab**: same guided flow for the ChatGPT `__Secure-next-auth.session-token` cookie
- **GitHub Copilot tab**: VS Code built-in OAuth (`vscode.authentication`) — one click, no token copying
- Status bar now shows `$(key) AI Quota: Set up accounts` on first launch when no credentials are configured
- Command renamed from "Configure Credentials" to **"Set Up Accounts"**

## [0.1.0] — 2026-06-23

### Added
- Live quota dashboard for Claude, GitHub Copilot, and Codex with session and weekly progress rings
- Status bar item showing remaining quota per service; turns amber when any service drops below 10%
- Standalone mode: fetches quota directly from VS Code using credentials stored in SecretStorage — no Chrome extension required
- **"AI Quota Tool: Set Up Accounts"** command for one-time credential setup
- **"AI Quota Tool: Open Dashboard"** command
- Optional Chrome extension integration: receives live quota pushes over a local WebSocket on port 54321
