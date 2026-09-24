# Chrome Web Store listing: publish checklist

Items the Chrome Web Store flagged before this item can publish.

## 1. Contact email (Settings tab)

Enter the publisher's contact email on the Settings page, then verify it. Chrome
Web Store sends a verification link to that address. This step needs the
developer account owner - it cannot be done from this repo.

## 2. Data usage compliance certification (Privacy practices tab)

After the fields below are filled in, check the certification box on the
Privacy practices tab. This confirms the listing's data usage matches the
Developer Program Policies.

## 3. Privacy practices tab fields

Paste each block into its matching field.

### Privacy policy URL

The policy text is at `PRIVACY.md` in the repo root. Publish it at a stable
URL (for example a GitHub Pages page, or the raw GitHub URL) and paste that
URL into the field. Raw GitHub URL for this repo:

```
https://raw.githubusercontent.com/BasantPandey/AIQuotaTool/main/PRIVACY.md
```

A GitHub Pages URL reads better on the store listing, but the raw URL works
and needs no setup.

### Data usage

Check only **Authentication information**. Leave every other category
unchecked - the item does not collect any of them.

| Category | Collect? | Why |
|---|---|---|
| Personally identifiable information | No | The item never reads or stores a name, address, or email. |
| Health information | No | Not applicable. |
| Financial and payment information | No | Not applicable. |
| Authentication information | **Yes** | The GitHub OAuth access token, stored in `chrome.storage.local` on the user's device, used only to call the Copilot seat API. |
| Personal communications | No | Not applicable. |
| Location | No | Not applicable. |
| Web history | No | The item reads quota numbers from claude.ai/chatgpt.com/grok.com API responses. It does not read or store browsing history. |
| User activity | No | No clicks, keystrokes, or scroll tracking. |
| Website content | No | The item reads quota API responses, not page text, images, or DOM content. |

Certify all three disclosures - all are true for this item:
- Does not sell or transfer user data to third parties
- Does not use or transfer user data for purposes unrelated to the single purpose (quota display)
- Does not use or transfer user data to determine creditworthiness or for lending

### Single purpose description

This item shows the user their remaining AI usage quota for Claude, GitHub Copilot, Codex, and Grok in one side panel. It does not do any other task.

### Permission justifications

#### Alarms

This item uses the Alarms API to check quota data every 60 seconds. The service worker cannot use `setInterval`, because Chrome can stop it at any time. Alarms let the check continue in the background.

#### Host permission

This item reads quota data from claude.ai, chatgpt.com, and grok.com. It uses api.github.com and github.com only to complete GitHub sign-in and to check the Copilot seat status. It does not access any other site.

#### Identity

This item uses the Identity API to run GitHub sign-in (OAuth with PKCE) when the user connects their Copilot account. Sign-in is needed to check the user's Copilot seat status.

#### Notifications

This item sends a notification when a quota value drops low, or when a quota resets. This keeps the user informed without them having to open the side panel.

#### Remote code

This item does not use remote code. All code ships inside the extension package.

#### sidePanel

This item uses the Side Panel API to show the quota dashboard. The side panel is the main UI of the extension.

#### Storage

This item uses the Storage API to save quota data and the GitHub OAuth token on the user's device. This data lets the side panel show current quota values without a new fetch on every open.
