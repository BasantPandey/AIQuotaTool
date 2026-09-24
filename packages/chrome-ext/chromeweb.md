# Chrome Web Store listing

Paste each block into its matching field in the developer dashboard.
Store item: https://chromewebstore.google.com/detail/dkohaadncknbgmeefnlfffdjnnlmlglh

## Store listing tab

### Title (from manifest `name`)

```
AI Quota Tool - AI usage limits for Claude, Codex, Cursor
```

### Summary (manifest `description`, 132 characters max)

```
See AI limits before they stop your work: Claude, Codex, Gemini, Cursor and Grok usage and reset times. Free, private, no account.
```

### Description

```
Every AI limit in one glance.

AI Quota Tool shows what is left of your AI plans in the Chrome side panel. See your session, weekly and monthly limits, and the time until each one resets. Know before a limit stops your work.

WORKS WITH
• Claude - session and weekly limits, plus model limits
• Codex (ChatGPT) - session and weekly limits
• Gemini - 5-hour and weekly limits
• Cursor - monthly usage
• Grok - session and weekly limits
• GitHub Copilot - plan status
• DeepSeek and Kimi - API balance

FEATURES
• One panel for all your AI tools
• Clear bars with "% left" and "resets in"
• Toolbar badge with your lowest limit
• One alert when a limit runs low, and one when it resets
• Turn each provider on or off - see only the tools you use
• Light and dark theme that follows your system

PRIVATE BY DESIGN
• No server, no account, no sign-up
• Uses the sessions you already have in this browser
• Your data stays on your device
• No tracking, no ads, no analytics
• Open source: https://github.com/BasantPandey/AIQuotaTool

HONEST NUMBERS
If a provider does not share a number, the panel says so. It never shows a fake 100%.

HOW TO START
1. Click the toolbar icon to open the side panel.
2. Pick your tools.
3. Sign in to each tool in this browser, as usual. Your limits show within a minute.

Website and help: https://basantpandey.github.io/AIQuotaTool/
```

### Category

Productivity > Developer Tools (or "Tools").

### Graphic assets

Generate with `node scripts/store-assets.mjs` after a build. Files are in `packages/chrome-ext/store/`.

| Field | File |
|---|---|
| Store icon (128x128) | `icons/icon128.png` |
| Small promo tile (440x280) | `store/tile.png` |
| Marquee promo tile (1400x560) | `store/marquee.png` |
| Screenshots (1280x800), in this order | `store/shot1.png` to `store/shot5.png` |

### Links

- Homepage URL: `https://basantpandey.github.io/AIQuotaTool/`
- Support URL: `https://github.com/BasantPandey/AIQuotaTool/issues`

## Privacy practices tab

### Single purpose description

```
This item shows the user their remaining AI usage limits (Claude, Codex, Copilot, Gemini, Cursor, Grok) and API balances (DeepSeek, Kimi) in one side panel. It does not do any other task.
```

### Permission justifications

**alarms**
```
The item checks quota every 60 seconds and shows reset notifications. The service worker cannot use timers, because Chrome can stop it at any time. Alarms keep the check running.
```

**storage**
```
The item saves quota readings, the list of providers that the user turns on, the GitHub OAuth token, and optional API keys on the user's device. Nothing is synced.
```

**notifications**
```
The item sends one notification when a quota drops low, and one when a quota resets.
```

**identity**
```
The item uses the Identity API to run GitHub sign-in (OAuth with PKCE) when the user connects Copilot. Sign-in is needed to check the Copilot plan status.
```

**sidePanel**
```
The side panel is the main user interface. It shows the quota dashboard and the provider settings.
```

**Host permissions**
```
The item reads the user's own usage from claude.ai, chatgpt.com, grok.com, gemini.google.com and cursor.com with the user's existing session. It uses api.github.com and github.com only for GitHub sign-in and the Copilot plan check. It uses api.deepseek.com and api.moonshot.ai only to read an API balance with a key that the user pastes. It reads data only for providers that the user turns on. It does not access any other site.
```

**Remote code**
```
No. All code ships inside the extension package.
```

### Data usage

Check only **Authentication information**. Leave every other category unchecked.

| Category | Collect? | Why |
|---|---|---|
| Personally identifiable information | No | The item never reads or stores a name, address, or email. |
| Health information | No | Not applicable. |
| Financial and payment information | No | Not applicable. |
| Authentication information | **Yes** | The GitHub OAuth token and optional API keys, stored on the device only. |
| Personal communications | No | The item does not read chats or prompts. |
| Location | No | Not applicable. |
| Web history | No | The item reads usage API responses only. |
| User activity | No | No click, key, or scroll tracking. |
| Website content | No | The item reads usage API responses, not page content. |

Certify all three disclosures:
- Does not sell or transfer user data to third parties
- Does not use or transfer user data for purposes unrelated to the single purpose
- Does not use or transfer user data to determine creditworthiness or for lending

### Privacy policy URL

```
https://basantpandey.github.io/AIQuotaTool/privacy.html
```

## Account tasks (owner only)

- Contact email on the Settings tab must be verified.
- GitHub OAuth App: register it at https://github.com/settings/applications/new with callback `https://dkohaadncknbgmeefnlfffdjnnlmlglh.chromiumapp.org/`. Paste the client id into `GITHUB_OAUTH_CLIENT_ID` in `src/background/github-auth.ts`. Until then, the panel shows "GitHub sign-in coming soon".
