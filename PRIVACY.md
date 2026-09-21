# Privacy Policy

AI Quota Tool is a Chrome extension. It shows your remaining AI quota for Claude, Codex, Copilot, and Grok, and your DeepSeek API balance, in one side panel.

## What the extension reads

- It reads your own quota from claude.ai, chatgpt.com, and grok.com. It uses your own logged-in browser session.
- It reads your GitHub Copilot seat status from api.github.com. It uses an OAuth token that you approve.
- It reads your DeepSeek API balance from api.deepseek.com. It uses an API key that you paste.

## What the extension stores

- Quota readings, stored on your device in local extension storage.
- The GitHub OAuth token, stored on your device in local extension storage. The extension removes this token when you disconnect.
- The DeepSeek API key, stored on your device in local extension storage. The extension removes this key when you disconnect. It is not synced.

## What the extension never does

- It does not send your data to a server of ours. Requests go only to the services you connect.
- It does not store session cookies or session keys.
- It does not use analytics, tracking, or remote code.

## How to revoke access

- Claude, Codex, and Grok: sign out on the service website.
- Copilot: disconnect in the extension. To revoke the GitHub grant fully, visit https://github.com/settings/applications.
- DeepSeek: disconnect in the extension. To revoke the key everywhere, delete it at https://platform.deepseek.com.

## Contact

Open an issue at https://github.com/BasantPandey/AIQuotaTool/issues.
