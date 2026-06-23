# Changelog

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
