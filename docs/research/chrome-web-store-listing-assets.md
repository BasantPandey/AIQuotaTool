# Chrome Web Store listing assets and rules

Issue: #62. Date: 2026-09-24.
Question: What assets and rules does the Chrome Web Store need for a strong listing?
Related note: `chrome-web-store-publishing.md`.

## 1. Image assets

Source: [Supplying images](https://developer.chrome.com/docs/webstore/images), [Best listing](https://developer.chrome.com/docs/webstore/best-listing).

| Asset | Size (px) | Format | Required | Rules |
|---|---|---|---|---|
| Store icon | 128x128 | PNG | Yes | Artwork is 96x96. Add 16 px transparent padding on each side. Make it work on light and dark backgrounds. Do not add an edge. No large drop shadow. No screenshots or UI in the icon. |
| Small promo tile | 440x280 | PNG or JPEG | Yes | Use graphics, not much text. Use saturated colors. Do not use much white. Fill the full area with clear edges. Make it readable at half size. Assume a light gray page background. |
| Marquee promo tile | 1400x560 | PNG or JPEG | No | Same rules as the small tile. The store uses it only if Google features the item. |
| Screenshots | 1280x800 (preferred) or 640x400 | PNG or JPEG | At least 1, up to 5 | Square corners. No padding (full bleed). Show the real product and core features. Use short captions, not walls of text. |

Our problem: the current small tile shows a small icon on white. This breaks the "no excess white" and "fill the region" rules. It also looks weak at half size.

## 2. Text fields

Source: [Best listing](https://developer.chrome.com/docs/webstore/best-listing), [Listing requirements](https://developer.chrome.com/docs/webstore/program-policies/listing-requirements).

- Title: brief, memorable, and says the main function. Do not stuff keywords.
- Summary: 132 characters maximum. State the main use case. Do not use superlatives or name competitors.
- Description: start with one overview paragraph. Then list the key features.
- The store rejects an item with a blank description, no icon, or no screenshots.
- Do not use misleading, out-of-date, or non-descriptive metadata.
- Keyword spam: do not list sites or brands without added value. Do not repeat one keyword more than 5 times.
- Do not use anonymous or unattributed testimonials.
- Do not claim a false status, such as "Editor's Choice".

Note for us: naming Claude, ChatGPT, Copilot, and Grok is fine when each name describes a real feature. Do not add a bare list of brands.

## 3. Privacy tab

Source: [Privacy tab](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [Privacy policies](https://developer.chrome.com/docs/webstore/program-policies/privacy).

You must fill five fields:

1. Single purpose description. State one narrow purpose.
2. Permission justification. Write one reason for each permission and host permission in the manifest. Request the minimum permissions for the purpose.
3. Remote code. Declare "no". Manifest V3 does not allow remotely hosted code.
4. Data usage. Tick each data type the extension handles. Certify the limited-use rules.
5. Privacy policy URL. This is mandatory if the extension handles any user data.

The privacy policy must say how the product collects, uses, and shares user data. It must name all parties that get the data. The store rejects the item if the privacy fields contradict the policy or the real behavior.

Note for us: we read session cookies and a GitHub token. So we handle "authentication information". DevQuota declares "authentication information" and "website content". Expect the same for us.

## 4. Single-purpose policy

Source: [Quality guidelines](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines).

- An extension must have one narrow purpose that is easy to understand.
- Put unrelated features in separate extensions.
- A side panel must help the current task. It must not take over browsing.

Proposed purpose text: "Show the remaining usage quota of your AI subscriptions (Claude, ChatGPT/Codex, GitHub Copilot, Grok) in one side panel, with a badge and low-quota alerts."

## 5. What top listings do

Sources: [DevQuota listing](https://chromewebstore.google.com/detail/devquota-ai-usage-quota-m/plcgnabeaofkhicpnmjopoogbmiejenf), MyQuota listing (found by store search "ai quota"; details from store search snippet), [Best listing](https://developer.chrome.com/docs/webstore/best-listing).

DevQuota (44 users, 2.3/5 from 3 ratings, Developer Tools):
- Uses 5 screenshots, the maximum.
- Title pattern: "Brand - what it does" ("DevQuota - AI Usage & Quota Monitor").
- Description stresses "local-first" and "no data upload to our servers".
- Privacy section declares authentication information and website content.

MyQuota (5.0 stars):
- Title pattern: "Brand - AI Usage Tracker & Cost Monitor for ChatGPT, Claude & Gemini".
- Summary gives the user benefit first: "See AI limits before they stop work".
- Lists each supported service with the exact limit it tracks (for example, Claude weekly and 5-hour limits with reset timer).
- Says "free", "private", and "no account required" early.
- States that data stays local and that there is no analytics.

Google says these signals raise store prominence: ratings, the install to uninstall ratio, design quality, a clear purpose, and easy onboarding.

## 6. Action list for our listing

1. Make a new 440x280 small tile. Use a full-bleed saturated background, the icon large, and a short tagline or one quota ring. Test it at 220x140.
2. Make a 1400x560 marquee in the same style.
3. Check the 128x128 icon has 96x96 artwork and 16 px padding.
4. Make 5 screenshots at 1280x800: side panel with all services, badge and alert, Copilot connect flow, onboarding, privacy statement.
5. Write a title "AI Quota Tool - <function>" and a benefit-first summary of 132 characters or less.
6. Write one justification per manifest permission.
7. Publish a privacy policy page that matches the data usage ticks.
