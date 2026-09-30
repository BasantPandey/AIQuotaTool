# Privacy Policy

Last updated: 30 September 2026

AI Quota Tool is a Chrome extension and a VS Code extension. The Chrome extension shows your remaining AI quota for Claude, Codex, Copilot, Grok, Gemini, and Cursor, and your DeepSeek and Kimi API balance, in one side panel.

## Chrome extension: what it reads

The extension reads data only for the providers that you turn on.

- It reads your own quota from claude.ai, chatgpt.com, grok.com, gemini.google.com, and cursor.com. It uses your own logged-in browser session.
- It reads your GitHub Copilot seat status from api.github.com. It uses an OAuth token that you approve.
- It reads your DeepSeek API balance from api.deepseek.com. It uses an API key that you paste.
- It reads your Kimi API balance from api.moonshot.ai. It uses an API key that you paste.

## Chrome extension: what it stores

All data stays on your device in local extension storage. Nothing is synced.

- Quota readings for the providers that you turn on.
- The list of providers that you turn on.
- The GitHub OAuth token. The extension removes this token when you disconnect.
- The DeepSeek and Kimi API keys. The extension removes a key when you remove it.

## Chrome extension: what it never does

- It does not send your data to a server of ours. There is no server. Requests go only to the services you connect.
- It does not store session cookies or session keys.
- It does not read your chats, your prompts, or your browsing history.
- It does not use analytics, tracking, ads, or remote code.
- It does not sell or share your data.

## Chrome extension: how to revoke access

- Any provider: turn it off in the Providers screen. The extension stops all requests to that provider.
- Claude, Codex, Grok, Gemini, and Cursor: sign out on the service website.
- Copilot: disconnect in the extension. To revoke the GitHub grant fully, visit https://github.com/settings/applications.
- DeepSeek: remove the key in the extension. To revoke the key everywhere, delete it at https://platform.deepseek.com.
- Kimi: remove the key in the extension. To revoke the key everywhere, delete it at https://platform.kimi.ai.
- To delete everything, remove the extension from Chrome.

## VS Code extension

The VS Code extension shows your remaining quota for Claude, Codex, Copilot, and Grok. It also shows the balance or the spend of API keys that you add (Keys).

- It reads your own quota from claude.ai, chatgpt.com, grok.com, cursor.com, www.perplexity.ai, and windsurf.com. It uses a session cookie, or for Windsurf four session values.
- Sign-in: the extension opens Chrome or Edge with a new, temporary profile in the VS Code extension storage folder. You sign in on the provider site. Then the extension reads only these cookies from that profile: `sessionKey` for claude.ai; `__Secure-next-auth.session-token` (and its parts `.0` and `.1`) for chatgpt.com; `sso` and `sso-rw` for grok.com; `WorkosCursorSessionToken` for cursor.com; the Auth.js or NextAuth session token for perplexity.ai. For Windsurf it reads four localStorage values on windsurf.com, not cookies: `devin_session_token`, `devin_auth1_token`, `devin_account_id`, and `devin_primary_org_id`. It sends them only to windsurf.com. Each cookie goes only to its own host. It does not read other cookies, your browsing history, your chats, your prompts, your passwords, or your own browser profile. It deletes the temporary profile after the read, and also on an error or a cancel.
- You can also paste a session cookie yourself.
- It reads your GitHub Copilot quota from api.github.com (`copilot_internal/user`, the same source that VS Code uses). If that fails, it reads your Copilot seat status. It uses the VS Code built-in GitHub sign-in. VS Code keeps that token. The extension keeps only a flag that says you connected Copilot.
- It reads the balance or the spend of each Key from its own provider: api.deepseek.com (DeepSeek), api.moonshot.ai (Kimi), openrouter.ai (OpenRouter), api.anthropic.com (Anthropic Admin key), and api.openai.com (OpenAI Admin key). It uses the API key that you add.
- An Admin key can manage your whole org. The extension uses it only to read the cost report of the current month. You confirm that it is an Admin key before the extension saves it.
- It stores these secrets in VS Code SecretStorage on your device: the Claude session key, the ChatGPT session token, the Grok sso cookie, and each API key.
- It stores the list of Keys (name, provider, and the last 4 characters) in VS Code extension storage. This list holds no secret.
- It sends each secret only to its own service. There is no server of ours.
- It does not read your chats, your prompts, or your files.
- It does not use analytics, tracking, ads, or remote code.
- It does not sell or share your data.
- The extension keeps each secret until you remove it, sign in again, or uninstall the extension.
- To remove an Account secret, click Sign out on the Accounts tab. To remove a Key, click Remove on the Keys tab. To delete everything, uninstall the extension.
- An optional local connection on 127.0.0.1 can receive quota readings. Any program on your device can send to it.

## Contact

Open an issue at https://github.com/BasantPandey/AIQuotaTool/issues.
