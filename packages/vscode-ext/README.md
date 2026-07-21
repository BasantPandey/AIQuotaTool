# AI Quota Tool

Monitor your remaining AI quota for **Claude**, **GitHub Copilot**, and **OpenAI Codex** — live in VS Code.

![Status bar showing Claude 72% | Copilot 91% | Codex 8%](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/statusbar.png)

---

## Features

- **Status bar item** — shows remaining quota at a glance (`Claude 72% | Copilot 91% | Codex 8%`); turns amber when any service drops below 10%
- **Dashboard panel** — full quota breakdown with session and weekly progress rings per service
- **Standalone** — fetches quota directly from VS Code using your session credentials; no Chrome extension required
- **Automatic refresh** — polls every 60 seconds in the background

---

## Setup (one time)

1. Install the extension
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **"AI Quota Tool: Configure Credentials"**
4. Paste credentials for each service (press Enter to skip any)

### How to get each credential

**Claude session key** (claude.ai usage bars)
1. Open [claude.ai](https://claude.ai) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://claude.ai`
3. Copy the value of `sessionKey` (starts with `sk-ant-sid`)

**GitHub Copilot** — click **Sign in with GitHub** in the setup panel. VS Code handles the OAuth flow — no token copying required.

**ChatGPT session token** (for Codex)
1. Open [chatgpt.com](https://chatgpt.com) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://chatgpt.com`
3. Copy the value of `__Secure-next-auth.session-token`

---

## Usage

| Command | Description |
|---|---|
| `AI Quota Tool: Open Dashboard` | Opens the quota dashboard panel |
| `AI Quota Tool: Configure Credentials` | Set or update your session credentials |

Click the status bar item (`$(pulse) AI Quota`) to open the dashboard directly.

---

## Optional: Chrome Extension

For automatic real-time updates without managing session cookies, install the companion [Chrome extension](https://github.com/BasantPandey/AIQuotaTool). It pushes quota data to VS Code over a local WebSocket whenever it polls — no credential setup required in VS Code.

Both modes work simultaneously: the Chrome extension supplements the direct polling.

---

## Privacy

- All credentials are stored in VS Code's encrypted `SecretStorage` — never written to disk in plain text
- Quota data is fetched directly from each service and stays on your machine
- No telemetry, no external servers

---

## Requirements

- VS Code 1.95 or later
- Active accounts on the services you want to monitor (Claude Pro/Free, GitHub Copilot, ChatGPT)
