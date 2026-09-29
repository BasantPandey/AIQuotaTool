# AI Quota Tool

Monitor your remaining AI quota for **Claude**, **GitHub Copilot**, **OpenAI Codex**, and **Grok**, plus the balance or spend of your **DeepSeek**, **Kimi**, and **OpenRouter** API keys - live in VS Code.

**Privacy:** the extension stores the session cookies and API keys that you paste in VS Code SecretStorage on this machine. It sends each one only to its own service. Read the [privacy policy](https://basantpandey.github.io/AIQuotaTool/privacy.html).

![AI Quota dashboard beside the code editor. The status bar shows Claude 9% in amber.](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/dashboard-dark.png)

---

## Features

- **Status bar item** - remaining quota at a glance for each service (the lower of session and weekly %). The item turns amber when any service drops below 10%.
- **One panel, three tabs** - **Usage** shows your Accounts and Keys. **Accounts** lets you sign in to each plan. **Keys** lets you add API keys.
- **Lowest remaining** - the Usage tab starts with the one limit that has the least left, and when it resets.
- **Account cards** - one card for each signed-in Account, with segmented session, weekly and monthly gauges. Copilot and Grok show an honest status when a percent is not available.
- **Fits your theme** - the panel uses the colors and fonts of your VS Code theme: dark, light and high contrast. In a wide tab the cards show as a grid.
- **Grok** - paste a grok.com `sso` cookie on the Accounts tab. You see short-window rate limits, plus the SuperGrok weekly pool when available.
- **Named Keys** - add many API keys on the Keys tab, each with its own name. After you save a Key, the panel shows only its last 4 characters.
  - **DeepSeek and Kimi** show the account balance (money left, not a percent).
  - **OpenRouter** shows the spend of that one key. If the key has a limit, it shows the spend against the limit and the real percent left. If not, it shows the spend this month.
- **Standalone** - fetches quota directly from VS Code with your session credentials. **No Chrome extension required.**
- **Optional Chrome push** - if you also run the Chrome package, it can merge readings over a local WebSocket (freshest wins). Not required.
- **Automatic refresh** - polls every 60 seconds in the background.

![The Usage tab in a wide editor tab, with Account cards and Key chips](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/dashboard-wide.png)

![Dashboard in the Light Modern theme](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/dashboard-light.png)

---

## Setup (one time)

1. Install the extension
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **"AI Quota Tool: Set Up Accounts"**. The panel opens on the Accounts tab.
4. Click **Sign in** for each service that you use, and paste its session credential. Each service is optional.
5. To add a DeepSeek or Kimi API key, open the **Keys** tab and click **Add key**.

![The Accounts tab, with one row for each Account and a Sign in or Sign out button](https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/packages/vscode-ext/docs/setup-accounts.png)

### How to get each credential

**Claude session key** (claude.ai usage bars - **not** an Anthropic Console API key)
1. Open [claude.ai](https://claude.ai) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://claude.ai`
3. Copy the value of `sessionKey` (starts with `sk-ant-sid`)

**GitHub Copilot** - click **Sign in with GitHub** on the Accounts tab. The panel shows a short code. Click **Copy code and open GitHub**, paste the code, and approve. You do not copy a token. Remaining usage % is often unavailable from GitHub; the dashboard shows an honest seat status instead of inventing 100%.

**ChatGPT session token** (for Codex)
1. Open [chatgpt.com](https://chatgpt.com) in Chrome and sign in
2. **Preferred:** DevTools → **Network** → any `chatgpt.com` request → Request Headers → copy the full **Cookie** value and paste it in line 1 on the Accounts tab
3. **Or:** Application → Cookies → if you see `__Secure-next-auth.session-token.0` and `.1`, that is **one** session split for size. **Double-click** each Value (full text, not `…`), paste `.0` on line 1 and `.1` on line 2
4. **Test and save** exchanges cookies for a short-lived access token, then reads usage

**Important:** Do not glue `.0`+`.1` into a single un-named string. The browser sends them as two cookie names; the extension does the same.

**Grok sso cookie** (grok.com short-window remaining)
1. Open [grok.com](https://grok.com) in Chrome and sign in
2. Open DevTools (`F12`) → **Application** tab → **Cookies** → `https://grok.com`
3. Copy the value of `sso` (JWT, often starts with `eyJ`)

**DeepSeek API key** (platform.deepseek.com account balance)
1. Open [platform.deepseek.com](https://platform.deepseek.com) and sign in
2. Go to **API keys** and create or copy a key
3. On the Keys tab, click **Add key**, choose the provider, and paste the key

**Kimi API key** (platform.kimi.ai account balance)
1. Open [platform.kimi.ai](https://platform.kimi.ai) and sign in
2. Go to **API keys** and create or copy a key
3. On the Keys tab, click **Add key**, choose the provider, and paste the key

Use **Test and save** to test a secret before the extension keeps it. Use **Sign out** on the Accounts tab, or **Remove** on the Keys tab, to delete a secret. Use **Edit** on the Keys tab to change the name of a Key. To change the value of a Key, remove it and add it again.

If you saved a DeepSeek or Kimi key in version 0.9, it becomes the Key "DeepSeek key 1" or "Kimi key 1". You do not need to add it again.

---

## Usage

| Command | Description |
|---|---|
| `AI Quota Tool: Open Dashboard` | Opens the panel on the Usage tab |
| `AI Quota Tool: Set Up Accounts` | Opens the panel on the Accounts tab |

Click the status bar item (`$(pulse) AI Quota`) to open the Usage tab.

---

## Optional: Chrome package (legacy)

A Chrome extension package may exist in this monorepo for optional browser-session push. It is **not** part of the VS Code V1 product bar. This extension works fully standalone.

---

## Privacy and security

**This extension stores** the Claude `sessionKey`, the ChatGPT session token, the Grok `sso` cookie, each API key that you add, and the GitHub sign-in token. It keeps them in VS Code SecretStorage. Read the [privacy policy](https://basantpandey.github.io/AIQuotaTool/privacy.html).

- Session cookies and API keys are account-level secrets. Treat them like passwords.
- Stored only in VS Code **SecretStorage** on this machine (encrypted at rest by the host OS / VS Code), not in plain-text settings or our servers.
- Secrets are sent only to the owning service (claude.ai, chatgpt.com, grok.com, api.deepseek.com, api.moonshot.ai, openrouter.ai, or GitHub APIs) for quota reads - no telemetry backend.
- Lifecycle: **Test and save** tests the secret before the extension keeps it. **Sign out** or **Remove** deletes the secret.
- Invalid or expired sessions remove the old reading and show **Session ended** on the card and in the status bar. The secret is **not** auto-deleted. Open the Accounts tab to sign in again or sign out. Stale “full quota” is never invented.
- Optional local WebSocket (`127.0.0.1`) may receive quota updates from the Chrome extension; any process on your machine could spoof that channel.

---

## Requirements

- VS Code 1.95 or later
- Active accounts on the services you want to monitor (Claude Pro/Free, GitHub Copilot, ChatGPT, Grok, DeepSeek, Kimi, OpenRouter)

---

## Publishing (maintainers)

Releases go to the Visual Studio Marketplace under publisher **BasantPandey** via a **manual** GitHub Actions workflow. Every live publish **increments** the extension version and pushes a git tag.

### One-time setup

The workflow signs in with Microsoft Entra ID through GitHub OIDC. There is no PAT and no stored secret. (Azure DevOps stops accepting global PATs on 2026-12-01.)

1. **Create a managed identity.** In the Azure portal, open **Managed Identities → Create**. Use any resource group and region. Use a user-assigned managed identity, not an app registration: an app registration signs in but the publish fails with `InvalidAccessException`.
2. **Trust this repo.** Open the identity → **Settings → Federated credentials → Add credential**:
   - Scenario: **GitHub Actions deploying Azure resources**
   - Organization: `BasantPandey`, Repository: `AIQuotaTool`
   - Entity type: **Environment**, name: `marketplace-publish`
3. **Add two repository secrets** (**Settings → Secrets and variables → Actions**): `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`, from the identity's **Properties** page. They are ids, not passwords.
4. **Create the environment** `marketplace-publish` (**Settings → Environments**). Optional: add yourself as a required reviewer, so each live publish waits for your approval.
5. **Add the identity to the publisher.** Run **Actions → Show Marketplace identity id → Run workflow** one time. Copy the id from the run summary. Then open [the publisher page](https://marketplace.visualstudio.com/manage/publishers/basantpandey) → **Members → Add**, paste that `id`, and choose **Contributor**.
6. Keep **Settings → Actions → General → Allow GitHub Actions to create and approve pull requests** turned on. The workflow opens a release PR, because `main` is protected.

### Run a release

1. Open **Actions → Publish VS Code extension**. Click the gray **Run workflow** button on the right. A form opens.
2. Fields in the form:
   - **Branch** (`ref`) - branch to ship (default `main`; use a branch name, not a raw SHA, for live runs)
   - **Version bump** (`bump`) - `patch` (default), `minor`, `major`, or `none`. Use `none` when a merged PR already set the version in `package.json`. Then the run tags and publishes that version, with no release PR.
   - **Dry run** (`dry_run`) - leave **checked** to package only (no bump, no Marketplace). Uncheck for a live release.
   - A dry run needs no Azure setup. A live run needs steps 1 to 5 above. If the environment has required reviewers, every run waits for your approval.
3. Prefer a **dry run** first; download the `.vsix` artifact and confirm it installs.
4. Live run: uncheck dry_run → workflow bumps `package.json`, commits to `release/vscode-vX.Y.Z`, tags `vscode-vX.Y.Z`, opens a release PR, packages, then runs `vsce publish --azure-credential`.
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
