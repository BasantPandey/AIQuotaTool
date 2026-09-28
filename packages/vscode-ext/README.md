# AI Quota Tool

Monitor your remaining AI quota for **Claude**, **GitHub Copilot**, **OpenAI Codex**, and **Grok**, plus your **DeepSeek** and **Kimi** API balance - live in VS Code.

![AI Quota dashboard beside the code editor. The status bar shows Claude 9% in amber.](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/dashboard-dark.png)

---

## Features

- **Status bar item** - remaining quota at a glance for each service (the lower of session and weekly %). The item turns amber when any service drops below 10%.
- **Lowest remaining** - the dashboard opens with the one limit that has the least left, and when it resets.
- **Dashboard panel** - one card per service with segmented session, weekly and monthly gauges. Copilot and Grok show an honest status when a percent is not available.
- **Fits your theme** - the dashboard uses the colors and fonts of your VS Code theme: dark, light and high contrast. In a wide tab the cards show as a grid.
- **Grok** - paste a grok.com `sso` cookie in Set Up Accounts. You see short-window rate limits, plus the SuperGrok weekly pool when available.
- **DeepSeek and Kimi** - paste an API key in Set Up Accounts to see the account balance (money left, not a percent).
- **Standalone** - fetches quota directly from VS Code with your session credentials. **No Chrome extension required.**
- **Optional Chrome push** - if you also run the Chrome package, it can merge readings over a local WebSocket (freshest wins). Not required.
- **Automatic refresh** - polls every 60 seconds in the background.

![Dashboard in a wide editor tab, with cards for six services]({RAW}/dashboard-wide.png)

![Dashboard in the Light Modern theme]({RAW}/dashboard-light.png)

---

## Setup (one time)

1. Install the extension
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **"AI Quota Tool: Set Up Accounts"**
4. Paste session credentials for the services you use (each is optional)

![Set Up Accounts, with a tab for each service](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/setup-accounts.png)

### How to get each credential

**Claude session key** (claude.ai usage bars - **not** an Anthropic Console API key)
1. Open [claude.ai](https://claude.ai) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://claude.ai`
3. Copy the value of `sessionKey` (starts with `sk-ant-sid`)

**GitHub Copilot** - click **Sign in with GitHub** in the setup panel. VS Code handles the OAuth flow. You do not copy a token. Remaining usage % is often unavailable from GitHub; the dashboard shows an honest seat status instead of inventing 100%.

**ChatGPT session token** (for Codex)
1. Open [chatgpt.com](https://chatgpt.com) in Chrome and sign in
2. **Preferred:** DevTools → **Network** → any `chatgpt.com` request → Request Headers → copy the full **Cookie** value and paste it into Set Up Accounts
3. **Or:** Application → Cookies → if you see `__Secure-next-auth.session-token.0` and `.1`, that is **one** session split for size. **Double-click** each Value (full text, not `…`), paste `.0` on line 1 and `.1` on line 2
4. Save & Test exchanges cookies for a short-lived access token, then reads usage

**Important:** Do not glue `.0`+`.1` into a single un-named string. The browser sends them as two cookie names; the extension does the same.

**Grok sso cookie** (grok.com short-window remaining)
1. Open [grok.com](https://grok.com) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://grok.com`
3. Copy the value of `sso` (JWT, often starts with `eyJ`)

**DeepSeek API key** (platform.deepseek.com account balance)
1. Open [platform.deepseek.com](https://platform.deepseek.com) and sign in
2. Go to **API keys** and create or copy a key
3. Paste it into Set Up Accounts

**Kimi API key** (platform.kimi.ai account balance)
1. Open [platform.kimi.ai](https://platform.kimi.ai) and sign in
2. Go to **API keys** and create or copy a key
3. Paste it into Set Up Accounts

Use **Save & Test** to validate before the secret is kept. Use **Clear saved key / token / cookie** to remove a secret. Paste a new value and Save & Test to replace.

---

## Usage

| Command | Description |
|---|---|
| `AI Quota Tool: Open Dashboard` | Opens the quota dashboard panel |
| `AI Quota Tool: Set Up Accounts` | Set, replace, or clear session credentials |

Click the status bar item (`$(pulse) AI Quota`) to open the dashboard directly.

---

## Optional: Chrome package (legacy)

A Chrome extension package may exist in this monorepo for optional browser-session push. It is **not** part of the VS Code V1 product bar. This extension works fully standalone.

---

## Privacy and security

**This extension stores** Claude `sessionKey`, ChatGPT session tokens, and Grok `sso` cookies, plus DeepSeek and
Kimi API keys, in SecretStorage for standalone mode. Do not claim “no credentials stored.” See
[`docs/GROK-SPEC.md`](../../docs/GROK-SPEC.md).

- Session cookies and API keys are account-level secrets. Treat them like passwords.
- Stored only in VS Code **SecretStorage** on this machine (encrypted at rest by the host OS / VS Code), not in plain-text settings or our servers.
- Secrets are sent only to the owning service (claude.ai, chatgpt.com, grok.com, api.deepseek.com, api.moonshot.ai, or GitHub APIs) for quota reads - no telemetry backend.
- Lifecycle: **Save & Test** validates before persist; replace by saving again; **Clear saved key** removes the secret.
- Invalid or expired sessions remove the old reading and show **Session expired** on the card and in the status bar. The secret is **not** auto-deleted. Open **Set Up Accounts** to replace or clear. Stale “full quota” is never invented.
- Optional local WebSocket (`127.0.0.1`) may receive quota updates from the Chrome extension; any process on your machine could spoof that channel.

---

## Requirements

- VS Code 1.95 or later
- Active accounts on the services you want to monitor (Claude Pro/Free, GitHub Copilot, ChatGPT, Grok, DeepSeek, Kimi)

---

## Publishing (maintainers)

Releases go to the Visual Studio Marketplace under publisher **BasantPandey** via a **manual** GitHub Actions workflow. Every live publish **increments** the extension version and pushes a git tag.

### One-time setup

1. Create an [Azure DevOps personal access token](https://dev.azure.com/) with **Marketplace** access that can publish for the **BasantPandey** publisher.
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `VSCE_PAT`
   - Value: the PAT (never commit it)
3. Keep **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** turned on. The workflow opens a release PR, because `main` is protected.

### Run a release

1. Open **Actions → Publish VS Code extension → Run workflow**
2. Inputs:
   - **ref** - branch to ship (default `main`; use a branch name, not a raw SHA, for live runs)
   - **bump** - `patch` (default), `minor`, `major`, or `none`. Use `none` when a merged PR already set the version in `package.json`. Then the run tags and publishes that version, with no release PR.
   - **dry_run** - leave **checked** to package only (no bump, no Marketplace). Uncheck for a live release.
3. Prefer a **dry run** first; download the `.vsix` artifact and confirm it installs.
4. Live run: uncheck dry_run → workflow bumps `package.json`, commits to `release/vscode-vX.Y.Z`, tags `vscode-vX.Y.Z`, opens a release PR, packages, then runs `vsce publish`.
5. Merge the release PR after CI passes. This puts the new version on `main`.
6. Verify the listing: [Marketplace manage (BasantPandey)](https://marketplace.visualstudio.com/manage/publishers/basantpandey)

### Local package (no publish)

```bash
pnpm install
pnpm turbo build
pnpm --filter ai-quota-tool-vscode run package
```

### Spec

Pipeline product requirements: [Spec: VS Code Marketplace publish pipeline](https://github.com/BasantPandey/AIQuotaTool/issues/18)

### Screenshots

The images in `docs/` come from the real dashboard build. Make them again after a design change:

```bash
pnpm turbo build
node scripts/vscode-assets.mjs
```

The script also makes the extension icon (`icons/icon128.png`) from the brand mark.
