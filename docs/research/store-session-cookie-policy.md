# Research: Store policy risk for session-cookie credentials

> **Note (main / 0.7.1+):** Historical research snapshot. Product code may have advanced (e.g. Chrome Copilot is seat-only via mapCopilotSeatStatus; no undocumented usage endpoint). See docs/V1-SPEC.md for the locked product bar.


**Ticket:** [#3](https://github.com/BasantPandey/AIQuotaTool/issues/3)  
**Scope:** Primary-source constraints for Chrome Web Store, Visual Studio Marketplace / Microsoft Publisher Agreement, and Open VSX when an extension stores or uses full browser session cookies (e.g. Claude `sessionKey`, ChatGPT `__Secure-next-auth.session-token`) to call private web APIs.  
**Out of scope:** Product narrative, architecture decisions, third-party service ToS analysis (Claude/OpenAI), legal advice.  
**Method:** Official program policies, publisher agreements, FAQs, and marketplace security guidance only. No secondary blogs except Microsoft’s own Marketplace security post where it restates official protections.  
**Research date:** 2026-07-21  

This document reports **what policies require**, **what they leave as judgment**, and **facts credentials/security review must acknowledge**. It does not decide whether the product should ship or how to market it.

---

## 1. Executive summary of hard constraints

| Theme | Chrome Web Store | VS Marketplace (Microsoft Publisher Agreement) | Open VSX |
| --- | --- | --- | --- |
| Session / auth cookies as sensitive data | **Explicit:** authentication information includes “authentication cookies” | Personal Data / Customer information protected; no cookie-specific definition | Data collection must be fully disclosed; no cookie-specific definition |
| Privacy policy | **Required** if Product handles any user data (including local-only) | **Required** if Offer accesses, collects, or transmits Personal Data to you or a third party, or if law requires | Full data description in Listing Information if you collect data |
| Secure handling of auth data | **Required:** keep authentication information secure; no public disclosure; crypto for transmit + at-rest when collecting | **Required:** reasonable security measures; Offer must not jeopardize user/security systems | Publisher responsible for technical/security features; no malware; accurate data disclosures |
| Use limited to disclosed purpose | **Required** (Limited Use + single purpose) | Limit use to disclosed practices via privacy policy / law; accurate Listing | Must not collect info not disclosed in Listing Information |
| In-product prominent disclosure + consent | **Required** before handling user data (not satisfied by store listing alone) | Not as detailed as CWS; privacy policy display + Data Protection Law compliance | Data Information disclosure in listing |
| Dashboard / listing data-use certifications | **Required** privacy practices tab + limited-use certification | Publisher privacy policy submitted for display when collecting Personal Data | Accurate Listing Information including Data Information |
| Transfer of user data | Strict allowed-transfer list under Limited Use | Governed by privacy policy + Data Protection Law | Disclose sharing and retention |
| Encryption exception for same-machine native | FAQ: CWS crypto requirement **does not** apply to extension ↔ native program on same computer | Not stated | Not stated |
| Explicit ban on “using session cookies” | **No** literal ban | **No** literal ban | **No** literal ban |
| Adjacent prohibition risk | “Do not facilitate unauthorized access… circumventing paywalls or login restrictions” | Offer must not compromise security; local law / third-party rights warranties | Consents/licenses required; no unauthorized access features for Offerings |

**Bottom line for credentials grilling:** Primary sources treat authentication cookies as **sensitive authentication information** (Chrome) or as **Personal Data / Customer information** requiring privacy policy and security (Microsoft / Open VSX). None of the three stores publish a bright-line rule that “reading the user’s own session cookies and calling private APIs is always allowed” or “always banned.” Review risk concentrates on **disclosure accuracy**, **secure handling**, **minimum permissions / single purpose**, **Limited Use transfers**, and **judgment around unauthorized access / third-party rights**.

---

## 2. Chrome Web Store (primary)

### 2.1 Source map

| Document | URL |
| --- | --- |
| Program Policies (full) | https://developer.chrome.com/docs/webstore/program-policies/policies |
| Privacy Policies section | https://developer.chrome.com/docs/webstore/program-policies/privacy |
| Limited Use | https://developer.chrome.com/docs/webstore/program-policies/limited-use |
| Handling Requirements | https://developer.chrome.com/docs/webstore/program-policies/data-handling |
| User Data FAQ (privacy policy & secure handling) | https://developer.chrome.com/docs/webstore/program-policies/user-data-faq |
| Dashboard privacy fields | https://developer.chrome.com/docs/webstore/cws-dashboard-privacy |

### 2.2 Do session cookies count as sensitive user data?

**Yes under Chrome’s definitions - required reading for review.**

Chrome’s User Data FAQ lists examples of user data, including:

> “Authentication information (such as logins, password, and **authentication cookies**)”

Source: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (Q4)

“Handle” includes collecting, transmitting, using, or sharing user data. Explicit examples include:

- Collecting data from web requests / cloud services in the background  
- Collecting web browsing activity and “data in a website’s browser storage (**like cookies**)”

Source: same FAQ (Q2)

**Implication (fact, not product decision):** Using `credentials: 'include'`, `chrome.cookies`, or otherwise reading session tokens such as Claude `sessionKey` or ChatGPT `__Secure-next-auth.session-token` is handling **authentication information** and may also be framed as handling **cookies / browsing-related storage data**.

### 2.3 Privacy policy - what is required

From Program Policies - Privacy Policy:

1. If the Product handles **any** user data, post an accurate and up-to-date privacy policy.  
2. The policy (with in-Product disclosures) must comprehensively disclose how the Product collects, uses, and shares user data, and **all parties** the data will be shared with.  
3. Link the policy in the designated Developer Dashboard field.

Sources:  
https://developer.chrome.com/docs/webstore/program-policies/privacy  
https://developer.chrome.com/docs/webstore/program-policies/policies  

FAQ clarifications that are **requirements**, not optional best practice:

| FAQ | Rule |
| --- | --- |
| Q3 | Local-only processing/storage still requires disclosure of user data handling. |
| Q6 | Minimum: privacy policy **and** secure handling (including modern cryptography for transmission). |
| Q14 | Local storage / `chrome.storage` still requires a privacy policy. |
| Q7 | Policy should cover what is collected, how used, what is shared (guidance list, not a legal form). |

Source: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq

Dashboard requirement: every item must provide data collection disclosures and limited-use certification on the Privacy practices tab to publish/update. Inconsistencies among dashboard disclosures, privacy policy, and actual behavior can lead to suspension of items, deactivation of users, and publisher ban.

Sources:  
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy  
https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (dashboard inconsistency Q)  
https://developer.chrome.com/docs/webstore/program-policies/policies (Listing Requirements § privacy fields accuracy)

### 2.4 Disclosure and consent - required vs listing text

**Required (Disclosure Requirements in Program Policies):**

- Be transparent about collection, use, and sharing.  
- If handling user data, **prior to installation** (policy text) / prior to collection:  
  - Prominently disclose what user data will be collected and how it will be used.  
  - Obtain affirmative and informed consent.  
- If data practices change after install, disclose those changes prominently.

Source: https://developer.chrome.com/docs/webstore/program-policies/policies (Disclosure Requirements)

FAQ Q10 adds precision:

- Disclosure must **not** live only in a privacy policy, ToS, or similar document.  
- Consent requires a **specific user action** clearly agreeing before collecting/handling.  
- Disclosure and consent must occur **within the Product UI**.  
- Chrome Web Store description / inline install page **do not** satisfy this requirement.

Source: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (Q10)

**What docs/disclosures typically must say (from FAQ Q7 + Limited Use + dashboard):**

- What authentication / cookie / session data is accessed or stored  
- That it is used only for the disclosed single purpose (e.g. reading the user’s own quota)  
- Whether data leaves the browser, is stored locally, is sent over WebSocket/localhost, or is sent to developer servers  
- Retention, deletion, and who (if anyone) can access it  
- Limited Use affirmative statement on a site belonging to the extension (see §2.5)

### 2.5 Limited Use - required constraints on use and transfer

Sources:  
https://developer.chrome.com/docs/webstore/program-policies/limited-use  
https://developer.chrome.com/docs/webstore/program-policies/policies  

Hard rules:

1. Minimum privacy floor; also comply with applicable law.  
2. Limit use to practices disclosed.  
3. Collect/use/transmit only data **necessary** for the extension’s disclosed **single purpose** (plus related operational needs: maintain, secure, measure performance/reliability).  
4. Web browsing activity collection/use is prohibited except as required for a **user-facing feature** described prominently on the CWS page **and** in the Product UI.  
5. After access for a single purpose:  
   - Use only to provide/improve that purpose.  
   - Transfer to third parties only if: necessary for that purpose; law; security against malware/spam/phishing/fraud/abuse; or M&A with **explicit prior user consent**.  
   - No human reading of user data except narrow exceptions (user consent for specific data, aggregate/anonymized internal ops, security investigation, law).  
   - Prohibited: ads personalization, data brokers, credit-worthiness uses, etc.  
6. Affirmative Limited Use statement on a website belonging to the extension (example wording given for Google APIs; policy text ties to Chrome Web Store User Data Policy / Limited Use).

FAQ: “Necessary for functionality” means reasonably required and **proportionate** to the stated purpose and **consistent with user expectations**. Scope and **sensitivity** of data are evaluated against disclosed functionality.

Source: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (Limited Use Qs 7–9)

**Judgment (not a bright-line store rule):** Whether calling private quota APIs with session cookies is “necessary and proportionate” to a narrow “show my AI quota” purpose is a **reviewer judgment**, not something the policies pre-approve. Policies do require that the single purpose and user-facing feature be clear and that host/cookies access be minimized.

### 2.6 Handling / security of authentication information - required

Handling Requirements:

1. Security vulnerabilities that could compromise other apps/services/browser/systems may lead to removal.  
2. If collecting user data, handle securely, including transmitting via modern cryptography.  
3. Do not publicly disclose financial or payment information.  
4. **Keep authentication information secure. Don’t publicly disclose authentication information.**

Sources:  
https://developer.chrome.com/docs/webstore/program-policies/data-handling  
https://developer.chrome.com/docs/webstore/program-policies/policies  

Encryption detail (FAQ Q8–Q9):

- Minimum: encrypt **transmissions** of user data (HTTPS, WSS).  
- Stored at rest using strong methods such as **RSA or AES**; no IETF-denylisted cipher suites.  
- Strong recommendation to encrypt all transmissions facilitated by the Product.

Source: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq

**Important FAQ exception (Q16):** The secure-handling encryption requirement **does not apply** to transmissions between a Chrome extension/app and a **native program on the same computer**.

Source: https://developer.chrome.com/docs/webstore/program-policies/user-data-faq (Q16)

**What this does and does not settle:**

| Settled by policy | Not settled by policy |
| --- | --- |
| Auth cookies are authentication information that must be kept secure and never publicly disclosed | Whether plaintext in `chrome.storage.local` is adequate “at rest” encryption for session tokens |
| Network transmit of user data needs modern crypto | Whether localhost WebSocket `ws://127.0.0.1` is treated as “same computer native” (Q16 is about extension ↔ native program) |
| Public logging/telemetry of session cookies would violate handling rules | Exact storage API (storage.local vs OS keychain) required by reviewers |

### 2.7 Permissions, single purpose, remote code

**Use of Permissions (required):** Request the narrowest permissions necessary; no future-proofing extra access. If multiple permissions can implement a feature, choose least data access.

**Single purpose (quality):** Extension must have a single purpose that is narrow and easy to understand.

**MV3 technical:** Full functionality must be discernible from submitted code; remote-hosted executable logic generally prohibited (with narrow documented API exceptions).

**Dashboard:** Justify each permission; declare remote code use; single purpose description for reviewers.

Sources:  
https://developer.chrome.com/docs/webstore/program-policies/policies  
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy  

### 2.8 Unauthorized access / malicious products - adjacent risk theme

Under Malicious and Prohibited Products:

> “Do not facilitate **unauthorized** access to content on websites, such as circumventing paywalls or **login restrictions**.”

Source: https://developer.chrome.com/docs/webstore/program-policies/policies

**Required vs judgment:**

- **Required:** Do not facilitate unauthorized access / login-restriction circumvention.  
- **Judgment:** Policies do **not** define whether a user-installed extension using **the user’s own logged-in session** to call the same origin’s private APIs is “unauthorized.” Reviewers may still scrutinize scraping of authenticated private APIs, especially if described poorly or if host permissions are broad.  
- Separate from store policy: third-party site Terms of Service may forbid automated access even when the user is logged in; that is outside CWS primary text but is a common dual risk with this clause.

### 2.9 Chrome review risk themes (session-cookie product)

Facts a credentials-security grill must acknowledge:

1. **Category of data:** Session cookies are named as authentication information.  
2. **Handling triggers full User Data stack:** privacy policy, Limited Use, secure handling, dashboard certifications, in-UI consent.  
3. **Local-only does not escape disclosure.**  
4. **Transfer of cookies or derived auth material** to another process (including VS Code) is still “handling”; Limited Use transfer rules apply if treated as transfer to another party; same-machine crypto exception may apply only in the narrow Q16 case.  
5. **No public disclosure** of auth info (logs, crash reports, support tickets, screenshots with tokens, repo secrets).  
6. **At-rest encryption language** is explicit in the FAQ for collected user data.  
7. **Permission justifications** must match actual cookie/host access.  
8. **Inconsistency** between policy, dashboard, and behavior is an enforcement trigger including publisher-level ban.  
9. **Unauthorized access** clause remains a judgment risk when private web APIs are used without an official public API.  
10. **Sensitive apps** (financial, health, personal) are called out for additional care in Best Practices; authentication data is repeatedly elevated in Handling Requirements.

---

## 3. Visual Studio Marketplace / Microsoft Publisher Agreement

### 3.1 Source map

| Document | URL |
| --- | --- |
| Microsoft Publisher Agreement 8.0 (July 2026 update) | https://learn.microsoft.com/en-us/legal/marketplace/msft-publisher-agreement |
| Visual Studio Marketplace Terms of Use (end-user facing, June 2021 PDF) | https://cdn.vsassets.io/v/M190_20210811.1/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf |
| Extension runtime security (VS Code docs) | https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security |
| Publishing extensions | https://code.visualstudio.com/api/working-with-extensions/publishing-extension |
| Extension manifest | https://code.visualstudio.com/api/references/extension-manifest |

Note: The commercial Microsoft Publisher Agreement governs Microsoft Marketplace offers broadly. VS Code extensions are published through Visual Studio Marketplace; the Agreement’s privacy/security sections are the primary contractual security/privacy obligations for publishers. There is **no** separate published “VS Code session cookie policy.”

### 3.2 Privacy policy requirements - required when

Microsoft Publisher Agreement §7(b)(ii) Privacy Policy:

You must maintain a privacy policy if:

- **(A)** your Offer **accesses, collects or transmits any Personal Data** to you or a third party; or  
- **(B)** otherwise required by law.

You are responsible for informing Customers of your privacy policy (including by submitting that policy to Microsoft for display to Customers).

Source: https://learn.microsoft.com/en-us/legal/marketplace/msft-publisher-agreement

**Personal Data** (definitions §12(q)) includes information relating to an identified or identifiable natural person and data that is personal data under Data Protection Law, including online identifiers.

**Marketplace Terms of Use §2(b)** (user-facing):

Publishers are responsible for providing privacy statements describing privacy practices for customer data collected by their Offerings or customer information received from Microsoft. Microsoft’s privacy policies do **not** cover Publisher Offerings’ data practices.

Source: https://cdn.vsassets.io/v/M190_20210811.1/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf

**Judgment:** Whether receiving quota percentages only (no raw cookies) means Personal Data is “accessed/collected/transmitted” depends on content and law. If the VS Code side ever receives, stores, or logs **session tokens**, Personal Data / Customer information obligations clearly attach. Even aggregate usage tied to an identifiable user may be Personal Data under GDPR-style definitions referenced in the Agreement.

### 3.3 Security obligations - required

Publisher Agreement §7(d) Security:

- Offers, networks, OS, servers, databases, systems must use **reasonable security measures** to protect Customer information.  
- Offer must **not jeopardize or compromise** user security, Marketplace security, related services/systems, or Customer systems.  
- Must not install or launch executable code beyond what is identified in or reasonably expected from the Listing.  
- Security vulnerabilities impacting Customers require notice to Microsoft support.

Also §7(c): Each party complies with applicable **Data Protection Law**.

Source: https://learn.microsoft.com/en-us/legal/marketplace/msft-publisher-agreement

**Local law / Offer requirements §4(b):** Offer and marketing must comply with applicable laws including Data Protection Law. Consumer disclosures required by local law must appear in the Offer description field (unless provided elsewhere in the Listing).

### 3.4 What Marketplace scanning / trust docs state (official)

VS Code “Extension runtime security” documents Marketplace protections:

- Malware scanning of each package before publish  
- Dynamic detection in a sandboxed environment  
- Secret scanning: newly published extensions scanned for secrets (API keys, credentials); **publishing blocked** if secrets detected; `vsce` scans `.env` during packaging  
- Extension signature verification  
- Block list / automatic uninstall for verified malicious extensions  
- Publisher verification (domain ownership + standing)

Also states: extension host has the **same permissions as VS Code** (filesystem, network, processes), so install trust is high.

Source: https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security

**Implication for session cookies (fact):**

- Embedding session tokens or PATs in the published VSIX / source tree will fail secret scanning.  
- Runtime storage of user-supplied or browser-pushed cookies is not the same as shipping secrets in the package, but runtime credential handling remains under “reasonable security” and “must not jeopardize user security.”  
- There is **no** CWS-equivalent public FAQ naming “authentication cookies” for VS Code extensions.

### 3.5 Manifest / listing disclosure expectations

Official publishing docs emphasize README, license, repository, accurate description, verified publisher; the `package.json` manifest has **no required `privacyPolicy` field** in the Extension Manifest reference.

Sources:  
https://code.visualstudio.com/api/working-with-extensions/publishing-extension  
https://code.visualstudio.com/api/references/extension-manifest  

Publisher Agreement still requires a privacy policy when Personal Data is accessed/collected/transmitted, and Terms of Use put privacy statement responsibility on publishers.

**Typical disclosures expected (contract + Terms, not a CWS-style checklist):**

- What Customer/Personal Data the extension processes  
- Purpose and retention  
- Network endpoints (localhost, third-party APIs)  
- That Microsoft’s privacy statement does not cover the extension’s own data practices  

### 3.6 VS Marketplace risk themes (session-cookie adjacent)

Facts for credentials grilling:

1. **No explicit “auth cookie” taxonomy** like Chrome; obligations flow through Personal Data / Customer information / Data Protection Law.  
2. **Privacy policy is mandatory** once Personal Data is accessed, collected, or transmitted to publisher or third party.  
3. **Reasonable security** is a contractual requirement, not a vague suggestion.  
4. **Jeopardizing user security** (e.g. exfiltrating session cookies to remote servers, logging tokens) is a removal/disablement risk under Agreement §2(f) and §7(d).  
5. **Secret scanning** blocks accidental publish of hardcoded credentials; does not approve runtime session reuse.  
6. **Extension host power** means users and orgs treat extensions as high-trust; Marketplace trust UX (publisher trust dialog, verified badge) is part of the security story.  
7. **Warranties** include accurate information to Microsoft and obtaining consents/licenses required to access Internet-based services the Offer enables (§6).  
8. **Judgment:** Whether a passive sink that only displays quota stats (never holding cookies) has a lighter privacy surface than a host that stores cookies is product design - policies require honesty about whichever is true.

---

## 4. Open VSX (Eclipse)

### 4.1 Source map

| Document | URL |
| --- | --- |
| Eclipse Open VSX Publisher Agreement v1.1 (Sept 2025 PDF) | https://www.eclipse.org/legal/documents/eclipse-openvsx-publisher-agreement.pdf |
| Open VSX FAQ (publisher agreement overview) | https://www.eclipse.org/legal/open-vsx-registry-faq/ |

### 4.2 Privacy and data - required

Section 6 Privacy and Data Protection:

If you collect any data regarding use of the Offering (including licensee/end-user information), you shall disclose in Listing Information a **full and complete description** of:

- What data you collect  
- Purposes of use  
- With whom shared  
- How long retained  
- Any other information required by applicable law  

(“Data Information”)

You agree to comply with all applicable data protection and privacy laws in jurisdictions where you make the Offering available.

Source: PDF above

### 4.3 Warranties relevant to credentials

Section 8 warranties include:

- Offering does **not collect any information not fully disclosed** in Listing Information and does not contain malware/malicious code or illegal material.  
- Listing Information is not misleading and is a substantially accurate and complete description of performance, **data collection functions**, and other characteristics.  
- All necessary consents, approvals, or licenses obtained to make Offerings available.

Section 4(a): Publisher is solely responsible for implementing technical or security features designed to prevent unauthorized access to or use of Offerings.

Source: same PDF

### 4.4 Open VSX risk themes

- Disclosure completeness is contractual; undisclosed session-cookie collection would breach warranty.  
- No dedicated “authentication cookies” secure-handling clause comparable to CWS Handling Requirements.  
- Applicable privacy law still applies by contract.  
- Removal can occur for breach, misleading listing, IP claims, quality/content complaints (Section 7).

---

## 5. Cross-store comparison for this product pattern

Assumed technical pattern under research (for mapping only; not a product commitment):

- Chrome extension uses browser session cookies to call private AI service APIs.  
- May store quota state locally.  
- May push data over localhost WebSocket to a VS Code extension.  
- VS Code extension may display quota; may or may not ever see raw cookies.

| Constraint | Applies if… | Primary source |
| --- | --- | --- |
| Auth cookies = sensitive user data | Chrome handles session tokens at all | CWS User Data FAQ Q4 |
| Privacy policy + dashboard certifications | Chrome handles any user data | CWS Privacy Policy + dashboard docs |
| In-UI prominent disclosure + affirmative consent | Chrome handles user data | CWS Disclosure Requirements + FAQ Q10 |
| Limited Use / single purpose / min permissions | Chrome collects cookies or browsing-related data | CWS Limited Use + Use of Permissions |
| Encrypt network transmit; AES/RSA-class at rest language | Chrome “collects” user data | CWS Handling + FAQ Q8–Q9 |
| Same-machine native crypto exception | Extension ↔ native on same PC | CWS FAQ Q16 |
| No public disclosure of auth info | Any public channel (logs, support, repo) | CWS Handling §4 |
| Unauthorized access / login restriction circumvention | Authenticated private API use | CWS Malicious Products §4 - **judgment** |
| VS privacy policy | VS Offer accesses/collects/transmits Personal Data | MPA §7(b)(ii) |
| Reasonable security; no security compromise | VS Offer handles Customer info | MPA §7(d) |
| Secret scanning | Secrets in published VSIX | VS Code runtime security docs |
| Open VSX Data Information | Any data collection | Open VSX PA §6 |
| No undisclosed collection | Open VSX | Open VSX PA §8(a) |

---

## 6. What policies require vs what is judgment

### 6.1 Required (clear primary-source obligations)

**Chrome Web Store**

1. Treat authentication cookies as user data / authentication information.  
2. Post and maintain a privacy policy that discloses collection, use, sharing, and parties.  
3. Complete Privacy practices / data usage certifications accurately.  
4. Provide prominent **in-product** disclosure and affirmative consent before handling (not only store listing or privacy policy).  
5. Limit collection/use/transfer to disclosed single purpose (Limited Use).  
6. Keep authentication information secure; never publicly disclose it.  
7. Use modern cryptography for user data in transit; FAQ requires strong at-rest methods when data is stored.  
8. Request minimum permissions; justify them; single narrow purpose.  
9. Keep dashboard, privacy policy, and runtime behavior consistent.  
10. Do not ship remote executable logic under MV3 rules.

**Visual Studio Marketplace / MPA**

1. Privacy policy if Personal Data is accessed/collected/transmitted to you or a third party (or if law requires).  
2. Reasonable security measures for Customer information.  
3. Offer must not jeopardize user or Marketplace security.  
4. Comply with Data Protection Law.  
5. Accurate Listing / warranties; notify on security vulnerabilities affecting Customers.  
6. Do not embed secrets in published packages (Marketplace secret scanning).

**Open VSX**

1. Full Data Information disclosure if collecting data.  
2. No collection beyond what Listing Information discloses.  
3. Comply with applicable privacy/data protection law.  
4. Accurate non-misleading listing of data collection functions.

### 6.2 Judgment / not pre-cleared by store text

1. **Whether using the user’s own session cookie to call private non-public APIs is “unauthorized access” or login-restriction circumvention** under CWS Malicious Products.  
2. **Whether reviewers accept “credentials: include” host fetches without `cookies` permission** as minimal vs requiring broader host access justifications.  
3. **Whether localhost WebSocket of quota state or of raw cookies** is considered a Limited Use “transfer to third parties” or same-device processing.  
4. **Whether FAQ Q16 (no crypto for extension ↔ native)** covers a VS Code Node process on `127.0.0.1` (policy text says “native program,” not “any localhost TCP service”).  
5. **Whether raw session storage is mandatory** vs ephemeral use with `credentials: 'include'` only (both still “handle” cookies under FAQ Q2 if cookies are used).  
6. **Third-party API ToS compliance** (Claude, OpenAI, etc.) - not defined by store policies; may still interact with store “unauthorized access” and MPA warranties about rights to access services.  
7. **Enterprise / Workspace Trust / org extension allowlists** - operational trust layer, not a publisher policy ban.  
8. **Open VSX and VS Marketplace acceptance risk** for credential-adjacent extensions - policies emphasize disclosure and security, not an explicit cookie ban.

---

## 7. Facts credentials-security grilling and V1 security section must acknowledge

These are **constraints and definitional facts**, not product recommendations.

1. **Chrome names authentication cookies as authentication information** in its User Data FAQ. Session keys and next-auth session tokens fall in that category by plain reading.  
2. **Handling includes local use.** Storing tokens only on device does not remove privacy policy, Limited Use, or disclosure duties under CWS.  
3. **CWS requires both a privacy policy link and dashboard data-use certifications**, plus Limited Use website language.  
4. **CWS requires in-product prominent disclosure and affirmative consent** before collection/handling; store listing text alone is insufficient.  
5. **CWS Handling Requirements mandate keeping authentication information secure and forbidding public disclosure.**  
6. **CWS FAQ requires strong cryptography for transmission and for at-rest storage** of collected user data (AES/RSA-class language), with a **narrow same-machine native exception** that may not cleanly cover all localhost designs.  
7. **Limited Use forbids broad transfer and human access** to sensitive user data outside listed exceptions.  
8. **Minimum permissions and single purpose** are enforceable policies; broad `*://*/*` host access for multi-vendor cookies will draw review attention.  
9. **“Unauthorized access / circumventing login restrictions”** is an explicit prohibition; private API session reuse is a **judgment risk**, not a documented safe harbor.  
10. **Microsoft requires a privacy policy when Personal Data is accessed/collected/transmitted**, reasonable security, and non-compromise of user security; Data Protection Law compliance is contractual.  
11. **VS Marketplace secret scanning blocks shipping credentials in packages**; runtime cookie handling remains a security design burden under “reasonable security.”  
12. **VS Code extension host is fully privileged**; marketplace trust model assumes users grant high trust - security section should not understate blast radius of a compromised extension that can hold session cookies.  
13. **Open VSX contractually forbids undisclosed collection** and requires Data Information completeness.  
14. **Inconsistency and misleading listings** are enforcement vectors on all three platforms.  
15. **None of the three primary regimes publish a free pass** for “full browser session cookie reuse against private web APIs”; none publish an absolute ban either. Compliance work is disclosure + purpose limitation + secure handling + permissions minimization + third-party rights.

---

## 8. Disclosure checklist derived from primary sources (constraints only)

Use as a **requirements checklist** for privacy docs and store forms - not as marketing copy.

### Chrome Web Store listing / dashboard

- [ ] Privacy policy URL set and accurate  
- [ ] Single purpose description matches actual cookie/API behavior  
- [ ] Each host/cookies/storage permission justified  
- [ ] Remote code declaration accurate (MV3)  
- [ ] Data usage checkboxes include authentication / personally identifiable / website content as applicable  
- [ ] Limited Use certification true  
- [ ] Listing metadata not contradictory to runtime  

### Privacy policy content themes required by CWS FAQ / policy text

- [ ] What information (auth cookies / session tokens / quota responses / identifiers)  
- [ ] How used (only disclosed purpose)  
- [ ] Shared with whom (none / localhost VS Code / developer servers / third parties)  
- [ ] Retention and deletion  
- [ ] Security practices (transit crypto; at-rest approach)  
- [ ] Limited Use affirmative statement on extension website  

### In-product (CWS)

- [ ] Prominent disclosure of session/auth data handling **before** first use  
- [ ] Affirmative consent action  
- [ ] UI description of user-facing feature that needs the data  

### VS Marketplace / Open VSX

- [ ] Privacy policy if Personal Data flows to publisher or third party (MPA)  
- [ ] Accurate README/listing of network behavior and data collection  
- [ ] No secrets in VSIX (Marketplace secret scan)  
- [ ] Open VSX Listing Data Information complete if collecting data  
- [ ] Security vulnerability reporting path if Customer impact (MPA)

---

## 9. Source index (primary)

1. Chrome Web Store Program Policies  
   https://developer.chrome.com/docs/webstore/program-policies/policies  

2. Chrome Web Store Privacy Policies section  
   https://developer.chrome.com/docs/webstore/program-policies/privacy  

3. Chrome Web Store Limited Use  
   https://developer.chrome.com/docs/webstore/program-policies/limited-use  

4. Chrome Web Store Handling Requirements  
   https://developer.chrome.com/docs/webstore/program-policies/data-handling  

5. Chrome Web Store User Data FAQ  
   https://developer.chrome.com/docs/webstore/program-policies/user-data-faq  

6. Chrome Web Store dashboard privacy fields  
   https://developer.chrome.com/docs/webstore/cws-dashboard-privacy  

7. Microsoft Publisher Agreement 8.0 (July 2026 update)  
   https://learn.microsoft.com/en-us/legal/marketplace/msft-publisher-agreement  

8. Microsoft Visual Studio Marketplace Terms of Use (June 2021)  
   https://cdn.vsassets.io/v/M190_20210811.1/_content/Microsoft-Visual-Studio-Marketplace-Terms-of-Use.pdf  

9. VS Code Extension runtime security  
   https://code.visualstudio.com/docs/configure/extensions/extension-runtime-security  

10. VS Code Publishing Extensions  
    https://code.visualstudio.com/api/working-with-extensions/publishing-extension  

11. VS Code Extension Manifest  
    https://code.visualstudio.com/api/references/extension-manifest  

12. Eclipse Open VSX Publisher Agreement v1.1  
    https://www.eclipse.org/legal/documents/eclipse-openvsx-publisher-agreement.pdf  

13. Eclipse Open VSX Registry FAQ  
    https://www.eclipse.org/legal/open-vsx-registry-faq/  

---

## 10. Document control

| Field | Value |
| --- | --- |
| Path | `docs/research/store-session-cookie-policy.md` |
| Branch intent | `research/store-session-cookie-policy` |
| Related ticket | https://github.com/BasantPandey/AIQuotaTool/issues/3 |
| Non-goals | Product go/no-go, UX copy finalization, third-party ToS legal opinion |
