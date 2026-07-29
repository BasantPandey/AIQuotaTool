# AI Quota Tool

Monitor your remaining AI quota for **Claude**, **GitHub Copilot**, **OpenAI Codex**, and **Grok** - live in VS Code (v0.7.3).

![Status bar showing Claude 72% | Copilot 91% | Codex 8%](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/statusbar.png)

---

## Features

- **Status bar item** — remaining quota at a glance using the lower of session/weekly %; amber when any service drops below 10%
- **Dashboard panel** — full quota breakdown with session and weekly progress rings (or honest Copilot status without fake %)
- **Standalone (V1 product)** — fetches quota directly from VS Code using your session credentials; **no Chrome extension required**
- **Optional Chrome push** — if you also run the legacy Chrome package, it may merge readings over local WebSocket (freshest-wins); not required
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
3. Copy `__Secure-next-auth.session-token`
   - If you see **two** rows (`.0` and `.1`), that is **one** session split for size — not two accounts.
   - **Double-click** each Value so you copy the full string (the table truncates with `…`).
   - Paste `.0` on line 1 and `.1` on line 2 in Set Up Accounts (order matters).
   - Save & Test exchanges the cookie for a short-lived access token, then reads usage.

**Grok sso cookie** (grok.com short-window remaining)
1. Open [grok.com](https://grok.com) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://grok.com`
3. Copy the value of `sso` (JWT, often starts with `eyJ`)

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

**This extension stores** Claude `sessionKey`, ChatGPT session tokens, and Grok `sso` cookies in SecretStorage for standalone mode. Do not claim “no credentials stored.” See [`docs/GROK-SPEC.md`](../../docs/GROK-SPEC.md).

- Session cookies are full browser credentials. Treat them like passwords.
- Stored only in VS Code **SecretStorage** on this machine (encrypted at rest by the host OS / VS Code), not in plain-text settings or our servers.
- Secrets are sent only to the owning service (claude.ai, chatgpt.com, grok.com, or GitHub APIs) for quota reads — no telemetry backend.
- Lifecycle: **Save & Test** validates before persist; replace by saving again; **Clear saved key** removes the secret.
- Invalid or expired sessions drop the quota ring and show a **session expired** status-bar cue; the secret is **not** auto-deleted. Open **Set Up Accounts** to replace or clear. Stale “full quota” is never invented.
- Optional local WebSocket (`127.0.0.1`) may receive quota updates from the Chrome extension; any process on your machine could spoof that channel.

---

## Requirements

- VS Code 1.95 or later
- Active accounts on the services you want to monitor (Claude Pro/Free, GitHub Copilot, ChatGPT)

---

## Publishing (maintainers)

Releases go to the Visual Studio Marketplace under publisher **BasantPandey** via a **manual** GitHub Actions workflow. Every live publish **increments** the extension version and pushes a git tag.

### One-time setup

1. Create an [Azure DevOps personal access token](https://dev.azure.com/) with **Marketplace** access that can publish for the **BasantPandey** publisher.
2. In the GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `VSCE_PAT`
   - Value: the PAT (never commit it)
3. Confirm branch protection allows `github-actions[bot]` to push version commits/tags to `main`, or use a token with contents write if protection blocks `GITHUB_TOKEN`.

### Run a release

1. Open **Actions → Publish VS Code extension → Run workflow**
2. Inputs:
   - **ref** - branch to ship (default `main`; use a branch name, not a raw SHA, for live runs)
   - **bump** - `patch` (default), `minor`, or `major`
   - **dry_run** - leave **checked** to package only (no bump, no Marketplace). Uncheck for a live release.
3. Prefer a **dry run** first; download the `.vsix` artifact and confirm it installs.
4. Live run: uncheck dry_run → workflow bumps `package.json`, commits, tags `vscode-vX.Y.Z`, packages, then `vsce publish`.
5. Verify the listing: [Marketplace manage (BasantPandey)](https://marketplace.visualstudio.com/manage/publishers/basantpandey)

### Local package (no publish)

```bash
pnpm install
pnpm turbo build
pnpm --filter ai-quota-tool-vscode run package
```

### Spec

Pipeline product requirements: [Spec: VS Code Marketplace publish pipeline](https://github.com/BasantPandey/AIQuotaTool/issues/18)
