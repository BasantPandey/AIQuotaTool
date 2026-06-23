# Changelog

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
- **"AI Quota Tool: Configure Credentials"** command for one-time credential setup (Claude session key, GitHub token, Codex session token)
- **"AI Quota Tool: Open Dashboard"** command
- Optional Chrome extension integration: receives live quota pushes over a local WebSocket on port 54321
- System notifications when session or weekly quota resets
- Disconnected state detection: status bar turns red if Chrome extension was connected and then closes
