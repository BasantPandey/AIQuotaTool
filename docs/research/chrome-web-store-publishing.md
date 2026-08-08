# Research: Chrome Web Store publishing requirements for V2

Resolves: GitHub issue #30 (part of #27)
Date: 2026-08-08
Method: primary sources only (developer.chrome.com). Anecdotal or unverifiable points are explicitly flagged.

## Summary verdict

Publishing the V2 Chrome extension on the Chrome Web Store is feasible and requires no special program enrollment, but it is a high-scrutiny submission profile: a new developer account plus host permissions on consumer sites will get a closer, slower review. The hard prerequisites are: a registered developer account (one-time fee), a hosted privacy policy URL, per-permission justifications and data-handling disclosures in the developer dashboard (required even though all data stays local), a single-purpose statement, listing assets (128x128 icon, at least one 1280x800 or 640x400 screenshot, 440x280 small promo tile), and a privacy practices certification. GitHub OAuth via `chrome.identity.launchWebAuthFlow` triggers no Google OAuth verification. The main policy risks are (a) the User Data policy explicitly classifies scraping page content and reading cookies as handling user data, so disclosure obligations fully apply, and (b) the Developer Agreement prohibits knowingly violating third-party terms of service, which puts Anthropic/OpenAI/xAI ToS questions in scope for a reviewer who looks closely.

## 1. Developer account prerequisites

- You must register as a Chrome Web Store developer and pay a one-time registration fee before publishing anything. The Developer Agreement states the fee amount is "in an amount determined in Google's sole discretion".
  Sources: https://developer.chrome.com/docs/webstore/register , https://developer.chrome.com/docs/webstore/terms (section 2.1)
- The widely reported amount is US$5. This is NOT stated in the current doc text (it appears in the registration flow/screenshot), so treat the exact amount as unverified and confirm in the dashboard at registration time. (Flagged: not in primary doc text.)
- You must provide a developer email at account creation; it cannot be changed later (a new account plus item transfer is required to change it). Use a dedicated, frequently checked mailbox - all review and enforcement notices go there.
  Source: https://developer.chrome.com/docs/webstore/register
- Verifying your contact email address is required when setting up a new developer account (verification link by email).
  Source: https://developer.chrome.com/docs/webstore/set-up-account
- A physical address is required only for items that offer functionality to purchase items, additional features, or subscriptions. A free extension does not need one.
  Source: https://developer.chrome.com/docs/webstore/set-up-account
- One developer account can publish at most 20 extensions (limit increases can be requested).
  Source: https://developer.chrome.com/docs/webstore/publish

## 2. Publishing flow and dashboard tabs

- Upload a ZIP (max 2 GB) in the developer dashboard, then fill four tabs before submitting: Store Listing, Privacy, Distribution, and Test instructions (test instructions only if reviewers need credentials/steps to exercise the item).
  Sources: https://developer.chrome.com/docs/webstore/publish , https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions
- Submit for Review starts the review. A deferred-publishing option lets you publish manually after approval; once review completes you have up to 30 days to publish before the staged submission reverts to draft.
  Source: https://developer.chrome.com/docs/webstore/publish

## 3. Per-permission justification requirements (Privacy tab)

The Privacy practices tab is mandatory and has four parts:

1. Single purpose description - a free-text field stating the extension's single, narrow purpose for reviewers.
2. Permissions justification - the dashboard lists every permission declared in the manifest, with a free-text justification field per permission. The docs warn: "Requesting broader permissions than necessary may cause your extension to be rejected."
3. Remote code declaration - you must state whether the extension executes remote code and why. Extensions that execute remote code without declaring and justifying it "will be rejected". (MV3 already forbids loading and executing remotely hosted files.)
4. Data usage disclosure and certification - checkboxes disclosing which types of data the extension collects, plus checkboxes certifying compliance with each limited-use statement. These disclosures are displayed to Chrome users and must be consistent with the privacy policy URL.
   Source for all four: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

A privacy policy link is also set on this tab.
Source: https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

## 4. Privacy policy and data-handling disclosure obligations

The User Data FAQ makes clear this extension "handles user data" even though nothing leaves the device:

- "Handle" includes: having login functionality (even with a third-party system), clipping or scraping content from a website the user visits, collecting data from web requests, and collecting data in a website's browser storage (like cookies). Reading claude.ai/chatgpt.com/grok.com pages and their session cookies is squarely covered.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q2)
- Authentication information, explicitly including "authentication cookies", is user data.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q4)
- Disclosure is required even when data is only processed or stored locally and never transmitted: "Extensions are required to disclose how they handle user data, even when data is processed or stored locally on a user's device and is not transmitted to external servers or third parties."
  Source: https://developer.chrome.com/docs/webstore/user_data (Q3)
- A privacy policy is required for any product that handles user data, including local-only handling: "This policy requires all Products that handle user information to post a privacy policy." It can be short; it must describe how the product collects, uses, and shares user data.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q6, Q14)
- Prominent disclosure and consent: the types of user data collected and their use must be described prominently, and the user must take a specific action agreeing to it, within the product's UI. A disclosure that lives only in the privacy policy, terms of service, or the Chrome Web Store description does not satisfy this requirement.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q10)
- Limited use requirements (four elements): (a) allowed use - data may only be used to provide or improve the single purpose / user-facing features; (b) allowed transfer - only to provide the single purpose, comply with law, security purposes, or merger/acquisition; all other transfers of personal or sensitive user data are prohibited; (c) prohibited advertising - never use or transfer user data for personalized, re-targeted, or interest-based ads; (d) prohibited human interaction - no humans reading user data, with narrow exceptions.
  Source: https://developer.chrome.com/docs/webstore/user_data (Limited uses of user data, Q2-Q6)
- Web browsing activity may only be collected/transmitted to the extent required for a user-facing feature prominently described in the Chrome Web Store page and the extension's UI.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q12, Q13)
- Minimum Permission policy: extensions must request "only the narrowest set of permissions necessary" for existing functionality; if two permissions can implement a feature, you must choose the one that accesses less data; future-proofing with unneeded permissions is explicitly not allowed; the policy also applies to optional permissions.
  Source: https://developer.chrome.com/docs/webstore/user_data (Minimum Permission Q1-Q5)
- Every item must complete the dashboard data-collection disclosures and limited-use certification to be published or updated.
  Source: https://developer.chrome.com/docs/webstore/user_data (Simplifying privacy practices, Q1)
- All extensions that request user data must show a Limited Use disclosure on the project homepage or one click away (e.g. in the privacy policy).
  Source: https://developer.chrome.com/docs/webstore/user_data (Limited uses of user data, Q1)
- Inconsistency between dashboard disclosures, the privacy policy, and actual behavior is itself a policy violation and can result in suspension of all the publisher's items, deactivation of the existing user base, and a ban of the publisher entity.
  Source: https://developer.chrome.com/docs/webstore/user_data (Simplifying privacy practices, Q3)
- Publicly disclosing authentication information (e.g. session cookie values) is prohibited outright.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q11)

## 5. Listing assets required

From the Store Listing tab docs and the Supplying Images guidelines:

- Detailed description - free text; must comply with the Keyword Spam policy. Primary category and item language are also selected here.
  Source: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- Store icon: 128x128 px (PNG required for the in-ZIP extension icon; actual artwork should be 96x96 with 16 px transparent padding per side).
  Sources: https://developer.chrome.com/docs/webstore/cws-dashboard-listing , https://developer.chrome.com/docs/webstore/images
- Screenshots: at least 1, up to 5; 1280x800 px preferred or 640x400 px; JPEG or 24-bit PNG. Note all screenshots are currently downscaled to 640x400 for display.
  Sources: https://developer.chrome.com/docs/webstore/cws-dashboard-listing , https://developer.chrome.com/docs/webstore/images
- Small promo tile: 440x280 px PNG or JPEG - required.
  Sources: https://developer.chrome.com/docs/webstore/cws-dashboard-listing , https://developer.chrome.com/docs/webstore/images
- Marquee promo tile: 1400x560 px PNG or JPEG - optional, but required if the extension is ever to be featured in marquee placement.
  Sources: https://developer.chrome.com/docs/webstore/cws-dashboard-listing , https://developer.chrome.com/docs/webstore/images
- Optional: a YouTube video link, homepage URL, support URL, and a verified publisher official URL (verified through Google Search Console).
  Source: https://developer.chrome.com/docs/webstore/cws-dashboard-listing
- The images guide notes that only the extension icon, one small promotional image, and one screenshot are strictly mandatory.
  Source: https://developer.chrome.com/docs/webstore/images

## 6. Does the GitHub OAuth usage trigger verification needs?

- The `identity` permission itself displays no install-time warning and grants access to the chrome.identity API.
  Source: https://developer.chrome.com/docs/extensions/reference/permissions-list ("identity")
- `chrome.identity.launchWebAuthFlow` is the documented path "with non-Google identity providers"; it launches a web view and completes when the provider redirects to `https://<app-id>.chromiumapp.org/*`. GitHub OAuth for Copilot quota uses this path.
  Source: https://developer.chrome.com/docs/extensions/reference/api/identity (launchWebAuthFlow)
- Google OAuth app verification (the sensitive/restricted scope verification program) applies to apps requesting Google user data via Google OAuth scopes. V2 requests no Google scopes, so no Google OAuth verification is needed. The CWS docs describe no separate OAuth verification requirement for extensions using third-party OAuth providers; the obligations that do apply are the privacy disclosures and justifications in sections 3-4.
  Sources: https://developer.chrome.com/docs/extensions/reference/api/identity , https://developer.chrome.com/docs/webstore/cws-dashboard-privacy

## 7. Review timeline and rejection causes

- Official timeline: "For most extensions, review is completed within a few days, but it can take up to a few weeks." If pending more than three weeks, contact developer support via One Stop Support.
  Source: https://developer.chrome.com/docs/webstore/review-process
- As of April 2026, Google posted a warning that a surge in submissions is causing extended review times; this banner is still present (checked 2026-08-08).
  Source: https://developer.chrome.com/docs/webstore/review-process
- Signals that trigger closer (slower) review: new developers, new extensions, dangerous permission requests, significant code changes. Review times may also be longer after a rejection or warning.
  Source: https://developer.chrome.com/docs/webstore/review-process
- Factors that specifically increase review time: broad host permissions (`*://*/*`, `https://*/*`, `<all_urls>`), sensitive execution permissions, and large or hard-to-review code. Obfuscation is disallowed; minification is allowed but makes review harder - "consider submitting your code as authored".
  Source: https://developer.chrome.com/docs/webstore/review-process
- Outcomes: submission is approved or rejected (rejection email states the policy violated and how to appeal). Published items found in minor violation get a warning with typically 7-30 days to fix; moderate or greater violations cause immediate takedown; malware or extreme violations cause takedown without notice and possible permanent account suspension.
  Source: https://developer.chrome.com/docs/webstore/review-process
- Specific documented rejection causes relevant here: requesting broader permissions than necessary (cws-dashboard-privacy), undeclared/unjustified remote code (cws-dashboard-privacy), missing or inconsistent data disclosures (user_data), keyword spam in the description (cws-dashboard-listing).
- Anecdotal (flagged, not from primary sources): developer forum and mailing-list reports commonly describe multi-week first reviews for new extensions with host permissions on well-known consumer sites, and rejections that cite the User Data policy without pinpointing the offending code. Treat these as expectation-setting, not fact.

## 8. Policy risk specific to reading claude.ai / chatgpt.com / grok.com session data

- The User Data policy explicitly names "clipping or scraping content from a website that the user visits" and cookie access as handling user data, so this extension is fully in scope of the privacy policy, disclosure, prominent-consent, and limited-use requirements - there is no "we transmit nothing" exemption.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q2, Q3)
- Session cookies are authentication information; the policy prohibits publicly disclosing authentication information, and limited-use rules mean the cookies may only be used for the disclosed single purpose (reading the user's own quota) and never transferred except under the narrow allowed-transfer clauses.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q4, Q11, Limited use Q3-Q4)
- The collection of web browsing activity must be required for a user-facing feature that is prominently described both on the Chrome Web Store page and in the extension UI. The quota dashboard satisfies this if the listing and UI describe exactly what is read.
  Source: https://developer.chrome.com/docs/webstore/user_data (Q12, Q13)
- Minimum Permission policy pressure point: a reviewer can reject on the basis that a narrower permission set would do. Named host permissions for exactly the four required origins (not `<all_urls>`) is the defensible posture.
  Sources: https://developer.chrome.com/docs/webstore/user_data (Minimum Permission), https://developer.chrome.com/docs/webstore/review-process (broad host permissions)
- Developer Agreement section 4.4.1 prohibits activity that "knowingly violates a third party's terms of service". Automated reading of claude.ai/chatgpt.com/grok.com may conflict with those services' ToS; that is a legal risk independent of Chrome policy, but the Agreement imports it into the CWS relationship. This is the largest residual risk for V2 and is a business decision, not a documentation fix.
  Source: https://developer.chrome.com/docs/webstore/terms (4.4.1)
- Permission warnings at install time (relevant to user trust and conversion): `identity`, `storage`, `alarms`, and `cookies` show no warning; `notifications` shows "Display notifications"; host permissions show "Read and change..." style warnings scoped to the declared sites, and adding warning-triggering permissions in an update disables the extension until the user re-accepts.
  Sources: https://developer.chrome.com/docs/extensions/reference/permissions-list , https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions , https://developer.chrome.com/docs/extensions/mv3/permission_warnings
- Documented mitigations to consider: request permissions at runtime via optional permissions, and prefer `activeTab` (no warning, temporary host access via user gesture) where it can replace a standing host permission.
  Source: https://developer.chrome.com/docs/extensions/mv3/permission_warnings (Best practices)

## 9. Implications for V2

What a publishing decision waits on, condensed:

1. Recommended minimal-permission posture:
   - `host_permissions`: exactly `https://claude.ai/*`, `https://chatgpt.com/*`, `https://grok.com/*`, `https://api.github.com/*` - never `<all_urls>` or `*://*/*`.
   - `permissions`: `identity`, `storage`, `alarms`, `notifications`. Do not request `cookies`, `webRequest`, `tabs`, or `debugger` unless a feature genuinely needs them; each added sensitive permission adds justification burden and review time.
   - Keep content-script `matches` scoped to the same four origins.
   - Declare "No remote code" and keep the bundle unobfuscated; submit code as authored where practical.
2. Dashboard deliverables to prepare before submission: single-purpose sentence; one-paragraph justification per permission and per host permission; data-usage checkboxes reflecting local-only handling of authentication info and website content; limited-use certification; hosted privacy policy URL; a Limited Use disclosure on the project homepage (or one click away).
3. In-product requirement that is easy to miss: a prominent first-run disclosure describing what data is read (session cookies, page content, GitHub token) and an explicit consent action inside the extension UI. The store description alone does not count.
4. Listing assets to produce: 128x128 PNG icon, 1-5 screenshots at 1280x800, 440x280 small promo tile; skip marquee unless pursuing featuring; optional homepage/support URLs and Search Console verified-publisher badge.
5. Reviewer access: reviewers cannot exercise the extension without accounts on claude.ai/chatgpt.com/grok.com. Use the Test instructions tab to explain setup; decide whether to provide test credentials (a real practical risk of rejection for unverifiable functionality - flagged as judgment call, the docs only say test instructions are provided "only if needed").
   Source: https://developer.chrome.com/docs/webstore/publish
6. Timeline expectation: plan for days-to-weeks; the new-developer + host-permission profile plus the current (April 2026) submission surge argue for padding the V2 schedule. Anything specific beyond the official "few days to a few weeks" is anecdotal.
7. Biggest residual risk: third-party ToS exposure via Developer Agreement 4.4.1 (knowingly violating Anthropic/OpenAI/xAI terms), not Chrome policy mechanics. Everything else is checklist-work.
