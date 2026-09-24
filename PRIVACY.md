# Privacy Policy

Last updated: 24 September 2026

AI Quota Tool is a Chrome extension. It shows your remaining AI quota for Claude, Codex, Copilot, Grok, Gemini, and Cursor, and your DeepSeek and Kimi API balance, in one side panel.

## What the extension reads

The extension reads data only for the providers that you turn on.

- It reads your own quota from claude.ai, chatgpt.com, grok.com, gemini.google.com, and cursor.com. It uses your own logged-in browser session.
- It reads your GitHub Copilot seat status from api.github.com. It uses an OAuth token that you approve.
- It reads your DeepSeek API balance from api.deepseek.com. It uses an API key that you paste.
- It reads your Kimi API balance from api.moonshot.ai. It uses an API key that you paste.

## What the extension stores

All data stays on your device in local extension storage. Nothing is synced.

- Quota readings for the providers that you turn on.
- The list of providers that you turn on.
- The GitHub OAuth token. The extension removes this token when you disconnect.
- The DeepSeek and Kimi API keys. The extension removes a key when you remove it.

## What the extension never does

- It does not send your data to a server of ours. There is no server. Requests go only to the services you connect.
- It does not store session cookies or session keys.
- It does not read your chats, your prompts, or your browsing history.
- It does not use analytics, tracking, ads, or remote code.
- It does not sell or share your data.

## How to revoke access

- Any provider: turn it off in the Providers screen. The extension stops all requests to that provider.
- Claude, Codex, Grok, Gemini, and Cursor: sign out on the service website.
- Copilot: disconnect in the extension. To revoke the GitHub grant fully, visit https://github.com/settings/applications.
- DeepSeek: remove the key in the extension. To revoke the key everywhere, delete it at https://platform.deepseek.com.
- Kimi: remove the key in the extension. To revoke the key everywhere, delete it at https://platform.kimi.ai.
- To delete everything, remove the extension from Chrome.

## Contact

Open an issue at https://github.com/BasantPandey/AIQuotaTool/issues.
