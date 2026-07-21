# AI Quota Tool

Monitor your remaining AI quota for **Claude**, **GitHub Copilot**, and **OpenAI Codex** — live in VS Code (v0.7.0 V1 bar).

![Status bar showing Claude 72% | Copilot 91% | Codex 8%](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/statusbar.png)

---

## Features

- **Status bar item** — remaining quota at a glance using the lower of session/weekly %; amber when any service drops below 10%
- **Dashboard panel** — full quota breakdown with session and weekly progress rings (or honest Copilot status without fake %)
- **Standalone** — fetches quota directly from VS Code using your session credentials; no Chrome extension required
- **Optional Chrome push** — merges fresher browser readings over local WebSocket (freshest-wins)
- **Automatic refresh** — polls every 60 seconds in the background

---

## Setup (one time)

1. Install the extension
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **"AI Quota Tool: Set Up Accounts"**
4. Paste session credentials for the services you use (each is optional)

### How to get each credential

**Claude session key** (claude.ai usage bars — **not** an Anthropic Console API key)
1. Open [claude.ai](https://claude.ai) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://claude.ai`
3. Copy the value of `sessionKey` (starts with `sk-ant-sid`)

**GitHub Copilot** — click **Sign in with GitHub** in the setup panel. VS Code handles the OAuth flow — no token copying required. Remaining usage % is often unavailable from GitHub; the dashboard shows an honest seat status instead of inventing 100%.

**ChatGPT session token** (for Codex)
1. Open [chatgpt.com](https://chatgpt.com) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://chatgpt.com`
3. Copy the value of `__Secure-next-auth.session-token`

Use **Save & Test** to validate before the secret is kept. Use **Clear saved key / token** to remove a secret. Paste a new value and Save & Test to replace.

---

## Usage

| Command | Description |
|---|---|
| `AI Quota Tool: Open Dashboard` | Opens the quota dashboard panel |
| `AI Quota Tool: Set Up Accounts` | Set, replace, or clear session credentials |

Click the status bar item (`$(pulse) AI Quota`) to open the dashboard directly.

---

## Optional: Chrome Extension

For automatic real-time updates without pasting session cookies into VS Code, install the companion [Chrome extension](https://github.com/BasantPandey/AIQuotaTool). It uses your browser login and can push quota data to VS Code over a local WebSocket.

Both modes work simultaneously: the Chrome extension supplements the direct polling.

---

## Privacy and security

Two honest paths: **Chrome** uses live browser cookies and does not store session keys; **this extension stores** Claude `sessionKey` and ChatGPT session tokens for standalone mode.

- Session cookies are full browser credentials. Treat them like passwords.
- Stored only in VS Code **SecretStorage** on this machine (encrypted at rest by the host OS / VS Code), not in plain-text settings or our servers.
- Secrets are sent only to the owning service (claude.ai, chatgpt.com, or GitHub APIs) for quota reads — no telemetry backend.
- Lifecycle: **Save & Test** validates before persist; replace by saving again; **Clear saved key** removes the secret.
- Invalid or expired sessions drop the quota ring and show a **session expired** status-bar cue; the secret is **not** auto-deleted. Open **Set Up Accounts** to replace or clear. Stale “full quota” is never invented.
- Optional local WebSocket (`127.0.0.1`) may receive quota updates from the Chrome extension; any process on your machine could spoof that channel.

---

## Requirements

- VS Code 1.95 or later
- Active accounts on the services you want to monitor (Claude Pro/Free, GitHub Copilot, ChatGPT)
