# Chrome Web Store listing

Paste each block into its matching field in the developer dashboard.

## Package to upload

```bash
pnpm turbo build
pnpm --filter @ai-quota-tool/chrome-ext zip
```

Upload `packages/chrome-ext/ai-quota-tool-chrome-<version>.zip` on the **Package** tab. The version in `manifest.json` must be higher than the live version.
Store item: https://chromewebstore.google.com/detail/dkohaadncknbgmeefnlfffdjnnlmlglh

Store review reads a run of brand names as keyword stuffing. Keep brand names out of the title, the summary and the promo art. Name each service once, in the SUPPORTED SERVICES line of the description.

## Store listing tab

### Title (from manifest `name`)

```
AI Quota Tool - Track your AI usage limits
```

### Summary (manifest `description`, 132 characters max)

```
Track your AI assistant usage limits and API credit balances in one side panel. Free, private, no account.
```

### Description

```
AI Quota Tool shows how much of your AI usage allowance you have left, so you do not hit a limit in the middle of your work.

It shows your session, weekly and monthly limits in the Chrome side panel, with the time until each one resets.

FEATURES
• See what is left of your AI assistant plans at a glance
• Check prepaid API credit balances
• See your lowest limit on top, with the time it resets
• Get a toolbar badge with your lowest limit
• Get one alert when a limit runs low, and one when it resets
• Turn each service on or off, and see only the tools you use
• Use a light or dark theme that follows your system

PRIVATE BY DESIGN
• No server, no account, no sign-up
• Uses the sessions you already have in this browser
• Your data stays on your device
• No tracking, no ads, no analytics
• Open source: https://github.com/BasantPandey/AIQuotaTool

HONEST NUMBERS
If a service does not share a number, the panel says so. It never shows a fake 100%.

HOW TO START
1. Click the toolbar icon to open the side panel.
2. Pick your tools.
3. Sign in to each tool in this browser, as usual. Your limits show within a minute.
4. For an API balance, paste your API key on the Providers screen. The key stays on your device.

SUPPORTED SERVICES
Usage limits for Claude, OpenAI Codex, Gemini, Cursor and Grok. Plan status for GitHub Copilot. API balances for DeepSeek and Kimi.

AI Quota Tool is not affiliated with or endorsed by any of the services listed.

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
This item shows the user how much of their AI usage limits and API credit balances is left, in one side panel. It does not do any other task.
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

Check **Authentication information** and **Website content**. Leave every other category unchecked.

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
| Website content | **Yes** | The Gemini check reads two sign-in tokens from the gemini.google.com page. Nothing leaves the device. |

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
- GitHub OAuth App: done. Client id `Ov23liNRlhzedfjImsrQ` is in `src/background/github-auth.ts`. Keep **Enable Device Flow** turned on in the app settings. The extension never uses the client secret.
