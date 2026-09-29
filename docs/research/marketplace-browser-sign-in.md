# Marketplace rules for browser sign-in (issue #97)

Question: What do the VS Code Marketplace rules require for an extension that opens a browser window and reads session cookies?

Date: 2026-09-29.

Map: [#84](https://github.com/BasantPandey/AIQuotaTool/issues/84). Design: [#85](https://github.com/BasantPandey/AIQuotaTool/issues/85) (`docs/research/vscode-browser-sign-in.md` on branch `research/vscode-browser-sign-in`).

Chrome Web Store version of this question: `docs/research/store-session-cookie-policy.md`.

## Design under review

1. The user runs a sign-in command for one provider.
2. The extension starts Chrome or Edge with a new, empty `--user-data-dir`. No debug flag is set.
3. The user signs in on the real site: claude.ai, chatgpt.com, grok.com, gemini.google.com, cursor.com, perplexity.ai, or windsurf.com.
4. The extension starts the same profile with `--headless --remote-debugging-pipe`. It reads one session cookie. For Windsurf, it reads localStorage values.
5. The extension puts the value in VS Code SecretStorage. Then it deletes the profile.
6. The extension sends the value only to the usage endpoint of the same provider. There is no server.

## Summary

- No Marketplace rule forbids this design. No rule allows it by name. The rules are about disclosure, security, and third-party consent.
- The VS Code Marketplace has its own Publisher Agreement (June 2021). The earlier research cited the Microsoft commercial marketplace agreement. The text that applies to us is almost the same, but the section numbers are different.
- A privacy policy is mandatory. The extension accesses Personal Data (session cookies) ([Publisher Agreement 8(b)(ii)][mpa]). The Terms of Use tell the publisher to put it "in a prominent location, such as a license file or an embedded readme file" ([Terms of Use][tou]).
- The Terms of Use forbid "unexpected behavior that is not clearly documented at the top of both the package description and package README" ([Terms of Use 4.v][tou]). The browser launch and the cookie read must be in the first lines of the README and in the `description` field.
- The Agreement forbids launching "executable code on the user's environment beyond what is identified in or may reasonably be expected from the Listing Information" ([8(d)][mpa]). Starting Chrome or Edge is such code. The listing must name it.
- The malware scan does not publish its rules. Microsoft's own JavaScript debugger starts Chrome with a temp profile and `--remote-debugging-pipe` ([vscode-js-debug][jsdebug]). So the flag itself is not a block signal. Known malware read the user's real Chrome cookie store and sent it to a remote host ([Hunt.io][hunt]). Our design must look nothing like that.
- The largest risk is provider terms, not Microsoft. Anthropic, OpenAI, xAI, Perplexity, and Cursor terms forbid automated or scripted access. One published extension with a browser sign-in (`gencay.vscode-chatgpt`) was withdrawn by its author for this reason ([gencay #239][gencay239]).
- Our current listing text is not ready. `PRIVACY.md` covers only Chrome and says "It does not store session cookies or session keys". That is false for VS Code.

## 1. Which documents apply

| Document | Version | URL | Applies to |
|---|---|---|---|
| Microsoft Visual Studio Marketplace Publisher Agreement | Effective June 2021 | [aka.ms/vsmarketplace-agreement][mpa] | Publisher, binding contract |
| Visual Studio Marketplace Participation Policies | June 2021 | [aka.ms/vsmarketplace-policies][policies] | Publisher, part of the Agreement |
| Visual Studio Marketplace and NuGet.org Terms of Use | September 2025 | [aka.ms/vsmarketplace-tou][tou] | Everyone who uses the site, including publishers |
| Security and Trust in Visual Studio Marketplace (blog) | 2025-06-11 | [developer.microsoft.com][trustblog] | How the scan and review work |
| Extension runtime security (VS Code docs) | current | [code.visualstudio.com][runtime] | Marketplace protections |
| Publishing extensions (VS Code docs) | current | [code.visualstudio.com][publishing] | vsce rules |
| Secret detection announcement | 2025, blocking from 2025-09-22 | [vsmarketplace #1383][secrets] | Package secret scan |

Note: `store-session-cookie-policy.md` section 3 cites the "Microsoft Publisher Agreement 8.0" at `learn.microsoft.com/legal/marketplace/msft-publisher-agreement`. That agreement is for the Microsoft commercial marketplace (Azure and AppSource). The VS Code Marketplace links its own agreement from `aka.ms/vsmarketplace-agreement`. The privacy and security text is almost the same. Use the section numbers in this file.

## 2. Credentials, cookies, and tokens in the Marketplace rules

### 2.1 Publisher Agreement

| Section | Text (quote) | What it means for us |
|---|---|---|
| 1(r) Personal Data | "any information relating to an identified or identifiable natural person ... an online identifier" | A session cookie identifies one account. Treat it as Personal Data. |
| 8(b)(ii) Privacy Policy | "You must maintain a privacy policy if (i) your Offering accesses, collects or transmits any Personal Data to you or a third party; or (ii) otherwise required by law." | We access Personal Data. We send it to the provider, a third party. A privacy policy is mandatory. |
| 8(c) Data Protection | "Each party will comply with the obligations imposed on it under all applicable Data Protection Law." | GDPR and CCPA apply to the cookie. |
| 8(d) Security | "must use reasonable security measures to protect Customer information. Your Offering must not jeopardize or compromise user security ... and must not install or launch executable code on the user's environment beyond what is identified in or may reasonably be expected from the Listing Information." | SecretStorage, profile delete, no logs. The listing must say that the extension starts Chrome or Edge. |
| 6(b) Local Law | "If you are required to make any disclosures to consumers prior to sale or download of the Offering, you must provide those in the Offering description field" | Put the short disclosure in the `description` field too. |
| 10(d) Warranties | "You have obtained any and all consents, approvals, or licenses (including written consents of third parties where applicable) required ... for your Offering to access any Internet-based ... services, if any, to which the Offering enables access" | We warrant that we may access claude.ai and the other sites. Provider terms (section 5) make this the weakest point. |
| 3(g) Removal | "Microsoft may remove or suspend the availability of any Offering ... for any reason or no reason and at any time. Reasons may include ... (iii) inconsistency between your Offering and its Listing Information" | A listing that does not match the code is a removal reason. |
| 3(g) Disable | "Microsoft also may disable your Offering ... if: (a) Microsoft determines that the Offering causes harm to Customers or their devices, third parties ..." | A provider complaint can lead to a disable. |

Source: [Publisher Agreement, June 2021][mpa].

### 2.2 Participation Policies

- Section 3(a) lists what the listing "may include, as applicable". Item (7) is "Privacy Policy" ([Policies][policies]).
- Section 5(a) lets Microsoft remove an Offering "for any reason". One listed reason is failure "to comply with terms and conditions" of the Agreement or the Policies ([Policies][policies]).
- Section 6: "Publishers must report suspected security events, including security incidents and vulnerabilities of their Marketplace Offerings, at the earliest opportunity" ([Policies][policies]).

### 2.3 Terms of Use (September 2025)

- Section 1: "When publishing an offering to the Sites, include the terms (including a privacy policy, if applicable) in a prominent location, such as a license file or an embedded readme file" ([Terms of Use][tou]).
- Section 4.v forbids "causing unexpected behavior that is not clearly documented at the top of both the package description and package README" ([Terms of Use][tou]).
- Section 4.xx(d): "Do not post or promote materials that could harm or disrupt another user's computer or would allow others to inappropriately access software or web sites" ([Terms of Use][tou]).
- Section 7.a: the Microsoft Privacy Statement "is not applicable to the collection and use of your information through Offerings" ([Terms of Use][tou]). Our own policy must cover everything.

### 2.4 What the rules do not say

- No rule names cookies, session tokens, or browser automation.
- No rule forbids a headless browser or the Chrome DevTools Protocol.
- The `package.json` manifest has no privacy policy field ([manifest reference][manifest]). The README is the place for it.

## 3. Malware scan and review

### 3.1 What Microsoft says it checks

| Check | Quote | Source |
|---|---|---|
| Static malware scan | "we scan all incoming packages for malware using the same advanced tech found in Microsoft Defender and other top antivirus engines. If this static scan finds any malware, the package gets blocked right away" | [Trust blog][trustblog] |
| Rescan | "We rescan every newly published package shortly after it's published." | [Trust blog][trustblog] |
| Dynamic check | "Each incoming VS Code package gets checked for malicious run-time behavior in a sandbox environment." | [Trust blog][trustblog] |
| Human review | "Packages flagged by rescan or dynamic detection are manually reviewed by security engineers to avoid false positives before removing them." | [Trust blog][trustblog] |
| Community reports | Users report "invasive data collection or sending data to suspicious endpoints" | [Trust blog][trustblog] |
| Obfuscation | "Clean, and non-obfuscated code in extensions is significantly less likely to trigger a false-positive for malware." | [Trust blog][trustblog] |
| Secret scan | "The Marketplace automatically scans every newly published extension for secrets such as API keys or credentials." | [Runtime security][runtime] |
| Block list | A verified malicious extension "is removed from the Marketplace and added to a block list." | [Runtime security][runtime] |

The secret scan blocks a publish from 2025-09-22. The rules are internal: "VS Marketplace will be using an internal secret detection mechanism, so unfortunately, that can't be shared" ([vsmarketplace #1383][secrets]).

### 3.2 Can `--remote-debugging-pipe` or a cookie read cause a block?

Microsoft does not publish the dynamic-check rules. So no source can say "this is safe". The evidence is:

- **Microsoft ships the same pattern.** The built-in JavaScript debugger (`ms-vscode.js-debug`) starts Chrome and Edge with `--remote-debugging-pipe` ([browserArgs.ts][jsdebug]). Its docs say: "By default, the browser is launched with a separate user profile in a temp folder" and pipe debugging "is generally more secure" ([package.nls.json][jsdebugnls]). The Playwright extension (`ms-playwright.playwright`) also starts browsers ([Marketplace][playwright]). So "starts a browser with a debug pipe" is normal extension behavior.
- **Browser sign-in has passed review before.** `gencay.vscode-chatgpt` opened Chrome with Puppeteer for a chat.openai.com sign-in and used that session. It was on the Marketplace until the author withdrew it (section 4).
- **What malware does.** A fake "Zoom" extension (uploaded 2024-11-30) read "Chrome's cookie storage" on the user's machine and called `https://api.storagehb.cn` ([Hunt.io][hunt]). The trust blog names "sending data to suspicious endpoints" as a report reason ([Trust blog][trustblog]).

How to stay far from the malware pattern:

| Malware pattern | Our design |
|---|---|
| Reads the default Chrome profile `Cookies` file | Never touches the default profile. Uses only a new profile that the extension made. |
| Decrypts cookies with DPAPI or Keychain | Uses CDP `Storage.getCookies` on its own profile. No decrypt code. |
| Runs on `onStartupFinished` with no user action | Starts a browser only after the user clicks a sign-in command. The sandbox run sees no browser start. |
| Sends data to an unknown host | Sends the cookie only to the same provider domain. |
| Obfuscated or minified with no source | Public source on GitHub. Keep the bundle unminified, or ship a source map link in the README. |
| Reads all cookies | Filters to one named cookie for one domain. |

### 3.3 Secret scan and our package

- The VSIX must not contain a real token. Test fixtures in `packages/core` are not in the bundle, because `.vscodeignore` drops `src/` and `**/*.test.ts`.
- Mock values that look like real tokens (for example `sk-ant-sid01-...` or a long `eyJ...` JWT) must never be in `dist/`. Use short fake values such as `sk-ant-sid01-TEST`.
- The runtime value in SecretStorage is not in the package. The scan does not see it.

## 4. Published extensions that do the same kind of thing

| Extension | What it does | How it discloses it |
|---|---|---|
| `gencay.vscode-chatgpt` (withdrawn 2023) | Opened Chrome or any Chromium browser with Puppeteer. The user signed in on chat.openai.com. The extension kept the session. | README: "Zero-Config Autologin lets the extension grab the required tokens automatically using `puppeteer`." and "A new browser window (Default is `Chrome` but you may override it with any Chromium-based browser) will open up redirected to https://chat.openai.com/." Also: "Your use of OpenAI services is subject to OpenAI's Privacy Policy and Terms of Use." ([fork README][gencayreadme]) |
| same, withdrawal note | The author removed the whole extension. | "We unfortunately lost the fun part ... due to potential Terms of Use violations of OpenAI service via one of the features we have built ... in vs-code it's not possible to remove old versions of the app without removing the whole extension." The open-source copy strips "Browser autologin". ([gencay #239][gencay239]) |
| `ms-vscode.js-debug` (Microsoft) | Starts Chrome or Edge with `--remote-debugging-pipe` and a temp profile. | Setting text: "By default, the browser is launched with a separate user profile in a temp folder." ([package.nls.json][jsdebugnls]) |
| `ArikAizikovich.claude-usage` | Claude usage from a pasted `sessionKey` or Cookie header. | "Session keys are stored securely using VS Code's secret storage." "The extension only communicates with Claude.ai's API." "No data is sent to third-party servers." ([Marketplace][claudeusage]) |
| `akitogo.cursor-token-usage` (Open VSX) | Reads the Cursor token from the local `state.vscdb`, builds the `WorkosCursorSessionToken` cookie. | Says it sends the cookie "to cursor.com only". ([Open VSX][cursortoken]) |
| `aoao-tech.token-aware` | Reads the Cursor session token from `state.vscdb`. | "read-only, via the system sqlite3 binary. Nothing is written to that DB." ([Marketplace][tokenaware]) |

Lessons:

- Each one names the exact secret, where it lives, and the only host that gets it.
- The one real browser sign-in example lost its listing because of provider terms, not a Marketplace block.
- We found no current Marketplace extension that opens a browser, reads a cookie by CDP, and deletes the profile. Our design is new in its details, so clear text matters more.

## 5. Provider terms on automated access

These terms are the risk behind Publisher Agreement 10(d) (third-party consent) and Terms of Use 4.xx(d) ("inappropriately access ... web sites").

| Provider | Clause (quote) | Source |
|---|---|---|
| Anthropic (claude.ai) | "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise." Also: "You may not share your Account login information ... or Account credentials with anyone else." (Effective 2025-10-08) | [Anthropic consumer terms][anthropic] |
| OpenAI (chatgpt.com) | Users may not "automatically or programmatically extract data or Output". | [OpenAI terms][openai] (page blocks fetch; text from search index) |
| xAI (grok.com) | No "robot, spider, scraper ... or any other automated means to access the Service in a manner that sends more request messages ... than a human can reasonably produce ... by using a conventional on-line web browser". | [xAI terms][xai] (text from search index) |
| Perplexity | No "robot, spider, crawlers, scraper, or other automatic device, process, software or queries that ... accesses the Services to monitor, extract, copy or collect information or data". | [Perplexity terms][perplexity] (text from search index) |
| Cursor | You may not "harvest, scrape, or extract data from the Service". (Last updated 2026-09-03) | [Cursor terms][cursor] |
| Google (Gemini) | Google may act on conduct such as "scraping content that doesn't belong to you". (Effective 2026-07-30) | [Google terms][google] |
| Windsurf | No automated-access clause found in the individual terms. Reverse engineering is forbidden. (Last updated 2026-06-30) | [Windsurf terms][windsurf] |

Facts:

- The sign-in step (phase 1) is a human in a normal browser. It is not automated.
- The cookie read (phase 2) makes no network request. It is local.
- The 60 s usage poll is automated access with the user's session. Anthropic's clause covers it by plain reading. The OpenAI, xAI, Perplexity, and Cursor clauses can also cover it. xAI limits its clause to a rate above human speed, so a slow poll is safer there.
- Paste has the same terms risk as browser sign-in. The browser only removes the manual copy step. The existing Claude, Codex, and Grok paste flows already carry this risk.
- This is not legal advice. The spec must name the risk and let the user decide.

## 6. Our current listing text

| File | Problem | Rule |
|---|---|---|
| `PRIVACY.md` | Says "AI Quota Tool is a Chrome extension." It does not cover VS Code at all. | Agreement 8(b)(ii) |
| `PRIVACY.md` | Says "It does not store session cookies or session keys." VS Code stores them in SecretStorage. | Agreement 3(g)(iii), inconsistency |
| `packages/vscode-ext/README.md` | No link to a privacy policy. | Terms of Use section 1 |
| `packages/vscode-ext/README.md` | Nothing says that the extension starts Chrome or Edge. The privacy section is near the end, not at the top. | Terms of Use 4.v, Agreement 8(d) |
| `packages/vscode-ext/README.md` | Lists only claude.ai, chatgpt.com, grok.com, DeepSeek, Kimi, GitHub. The plan adds gemini.google.com, cursor.com, perplexity.ai, windsurf.com. | Agreement 3(g)(iii) |
| `packages/vscode-ext/README.md` | Line "Do not claim 'no credentials stored.' See docs/GROK-SPEC.md" is a note for developers. Users see it on the listing. | Listing quality |
| `packages/vscode-ext/README.md` | Two images use `{RAW}/dashboard-wide.png` and `{RAW}/dashboard-light.png`. Nothing replaces `{RAW}`, so the images are broken on the listing. vsce needs https image URLs ([publishing][publishing]). | Listing quality |
| `packages/vscode-ext/package.json` | `description` does not say "browser sign-in" or "session cookie". | Terms of Use 4.v, Agreement 6(b) |
| `packages/vscode-ext/package.json` | No `extensionKind`. Issue #85 found that remote hosts need `["ui", "workspace"]` so that the browser starts on the user's computer. | Function, not a rule |
| Setup panel (`credential-setup/index.tsx`) | Has a good privacy note. It does not mention the browser window or the temporary profile. | Agreement 8(d) |

## 7. Checklist for the spec

### 7.1 Text at the top of the README (first screen)

- [ ] One sentence: "To sign in, this extension opens Chrome or Edge in a new, separate profile."
- [ ] One sentence: "After you sign in, it reads one session cookie from that profile, stores it in VS Code SecretStorage, and deletes the profile."
- [ ] One sentence: "It sends the cookie only to the same provider, to read your usage. There is no server of ours."
- [ ] A list of each provider, the exact cookie or localStorage key, and the only host that receives it.
- [ ] A link to the privacy policy.
- [ ] A link to the source on GitHub.
- [ ] A sentence that the user's own browser profile is never read.
- [ ] A sentence that the user's use of each service is subject to that service's terms, with links.

### 7.2 `package.json`

- [ ] `description` names the browser sign-in and the session cookie in plain words. Keep it short.
- [ ] `extensionKind: ["ui", "workspace"]`.
- [ ] `keywords` and `displayName` do not suggest an official product of any provider.
- [ ] No new activation event. Browser start happens only in a command.
- [ ] A setting to choose the browser path (Chrome, Edge, or a custom path). Default: find Chrome, then Edge.
- [ ] A setting to turn off browser sign-in and use paste only.

### 7.3 Privacy policy (VS Code section in `PRIVACY.md`, linked from the README)

- [ ] Say that the policy covers the VS Code extension and the Chrome extension, with separate sections.
- [ ] What is read: one named cookie per provider, or named localStorage keys for Windsurf.
- [ ] What is not read: other cookies, browsing history, chats, prompts, passwords, the default browser profile.
- [ ] Where it is stored: VS Code SecretStorage on this computer.
- [ ] Where it is sent: only the usage endpoint of the same provider, over HTTPS. List each host.
- [ ] How long it is kept: until the user clears it, signs in again, or uninstalls.
- [ ] The temporary browser profile: where it is made, and that it is deleted after the read, also on error or cancel.
- [ ] How to revoke: clear in Set Up Accounts, and sign out on the provider site.
- [ ] No telemetry, no analytics, no server, no sale of data.
- [ ] Remove "It does not store session cookies or session keys" from the VS Code scope.
- [ ] A security contact (GitHub issues or a security advisory link).
- [ ] "Last updated" date.

### 7.4 In-product text

- [ ] Before the first browser start: a modal that says what happens and names the provider. Buttons: "Open browser" and "Cancel".
- [ ] The modal says the user signs in on the real site, and the extension never sees the password.
- [ ] After the read: a message that says which value was stored and that the profile was deleted.
- [ ] Keep the paste path as a fallback, with the same disclosure.
- [ ] Update the setup panel privacy note with the browser window and the new hosts.

### 7.5 Code rules that keep the listing true

- [ ] Start a browser only from an explicit user command.
- [ ] Use only a profile directory that the extension made. Never pass the default profile.
- [ ] Read only the named cookie for the named domain. Do not keep other cookies in memory longer than the read.
- [ ] Delete the profile in a `finally` path.
- [ ] Never log a cookie or token value, also not in error messages.
- [ ] Send the value only to a fixed list of hosts. No host from settings or from the network.
- [ ] No obfuscation. Keep the bundle readable, or publish source maps.
- [ ] No realistic token strings in `dist/`.
- [ ] Poll no faster than the current 60 s. Back off on 429.

### 7.6 Listing fixes found on the way

- [ ] Fix the two `{RAW}` image links in `packages/vscode-ext/README.md`.
- [ ] Remove the developer note "Do not claim 'no credentials stored.'" from the user README.
- [ ] Keep README, `description`, privacy policy, and setup panel text the same. Check them in the release checklist.

### 7.7 Risk statement for the spec

- [ ] State that provider terms (Anthropic, OpenAI, xAI, Perplexity, Cursor) forbid automated or scripted access, and that the usage poll can fall under these terms.
- [ ] State that the user decides to connect each provider, and can turn each one off.
- [ ] State that a provider complaint can lead Microsoft to remove or disable the extension (Agreement 3(g)).

## Sources

[mpa]: https://aka.ms/vsmarketplace-agreement
[policies]: https://aka.ms/vsmarketplace-policies
[tou]: https://aka.ms/vsmarketplace-tou
[trustblog]: https://developer.microsoft.com/blog/security-and-trust-in-visual-studio-marketplace/
[runtime]: https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security
[publishing]: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
[manifest]: https://code.visualstudio.com/api/references/extension-manifest
[secrets]: https://github.com/microsoft/vsmarketplace/discussions/1383
[jsdebug]: https://github.com/microsoft/vscode-js-debug/blob/main/src/targets/browser/browserArgs.ts
[jsdebugnls]: https://github.com/microsoft/vscode-js-debug/blob/main/package.nls.json
[playwright]: https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright
[hunt]: https://hunt.io/blog/malicious-vs-code-extension-impersonating-zoom-steals-chrome-cookies
[gencay239]: https://github.com/gencay/vscode-chatgpt/issues/239
[gencayreadme]: https://github.com/JustinOhms/vscode-chatgpt-a/blob/main/README.md
[claudeusage]: https://marketplace.visualstudio.com/items?itemName=ArikAizikovich.claude-usage
[cursortoken]: https://open-vsx.org/extension/akitogo/cursor-token-usage
[tokenaware]: https://marketplace.visualstudio.com/items?itemName=aoao-tech.token-aware
[anthropic]: https://www.anthropic.com/legal/consumer-terms
[openai]: https://openai.com/policies/row-terms-of-use/
[xai]: https://x.ai/legal/terms-of-service
[perplexity]: https://www.perplexity.ai/hub/legal/terms-of-service
[cursor]: https://cursor.com/terms-of-service
[google]: https://policies.google.com/terms
[windsurf]: https://windsurf.com/terms-of-service-individual

- Visual Studio Marketplace Publisher Agreement (June 2021): https://aka.ms/vsmarketplace-agreement
- Visual Studio Marketplace Participation Policies (June 2021): https://aka.ms/vsmarketplace-policies
- Visual Studio Marketplace and NuGet.org Terms of Use (September 2025): https://aka.ms/vsmarketplace-tou
- Security and Trust in Visual Studio Marketplace (2025-06-11): https://developer.microsoft.com/blog/security-and-trust-in-visual-studio-marketplace/
- VS Code extension runtime security: https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security
- VS Code publishing extensions: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- VS Code extension manifest: https://code.visualstudio.com/api/references/extension-manifest
- Marketplace secret detection: https://github.com/microsoft/vsmarketplace/discussions/1383
- vscode-js-debug browser args: https://github.com/microsoft/vscode-js-debug/blob/main/src/targets/browser/browserArgs.ts
- vscode-js-debug setting text: https://github.com/microsoft/vscode-js-debug/blob/main/package.nls.json
- Playwright Test for VS Code: https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright
- Hunt.io, fake Zoom extension: https://hunt.io/blog/malicious-vs-code-extension-impersonating-zoom-steals-chrome-cookies
- gencay/vscode-chatgpt withdrawal: https://github.com/gencay/vscode-chatgpt/issues/239
- gencay README (fork copy): https://github.com/JustinOhms/vscode-chatgpt-a/blob/main/README.md
- Claude Usage extension: https://marketplace.visualstudio.com/items?itemName=ArikAizikovich.claude-usage
- Cursor Token Usage extension: https://open-vsx.org/extension/akitogo/cursor-token-usage
- Token Aware extension: https://marketplace.visualstudio.com/items?itemName=aoao-tech.token-aware
- Anthropic consumer terms: https://www.anthropic.com/legal/consumer-terms
- OpenAI terms of use: https://openai.com/policies/row-terms-of-use/
- xAI consumer terms: https://x.ai/legal/terms-of-service
- Perplexity terms: https://www.perplexity.ai/hub/legal/terms-of-service
- Cursor terms: https://cursor.com/terms-of-service
- Google terms: https://policies.google.com/terms
- Windsurf individual terms: https://windsurf.com/terms-of-service-individual
