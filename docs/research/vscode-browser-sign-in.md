# Browser sign-in window from VS Code (issue #85)

Question: How does the VS Code extension open a real browser window for sign-in, and read one session value after the user signs in?

Map: [#84](https://github.com/BasantPandey/AIQuotaTool/issues/84). Date: 2026-09-29.

Test machine: Windows 10, Chrome 153.0.8010.54, Edge 154.0.4258.37, Node 24.21.0. No real account was used. No secret was stored. The test printed cookie names and value lengths only.

## Summary

- Use two phases. Phase 1 opens a plain Chrome or Edge window with a new, empty profile and no debug flag. The user signs in. Phase 2 opens the same profile headless with `--remote-debugging-pipe` and reads the one cookie with `Storage.getCookies`. Then the extension deletes the profile.
- Do not sign in with a debug flag on. Every remote debugging flag sets `navigator.webdriver` to `true` (tested). Google then refuses sign-in with "This browser or app may not be secure" (tested).
- No new npm dependency. Raw CDP over the pipe is about 40 lines of Node. It needs no WebSocket, so it works on the Node 20 host of VS Code 1.95.
- Cloudflare did not block any of the five sites in the window (tested). Phase 2 makes no network request, so Cloudflare never sees the headless browser.
- localStorage (Windsurf) also works. It needs a frame at the origin. A stubbed request gives that frame with no network call (tested).
- DBSC can bind Google cookies to the device. A copied Google cookie then stops working soon outside the browser. This affects Gemini. It does not affect Claude, ChatGPT, Grok or Cursor today, as far as public sources say.
- Verdict: build the two-phase flow. Delete the profile after each sign-in. Keep cookie paste as the fallback for vscode.dev, remote hosts with no local browser, and users with no Chrome or Edge.

## 1. Find and start Chrome or Edge

### Where the browser is

Use fixed paths. Check them in order. Let the user set a path in settings if none is found.

| OS | Chrome | Edge | Source |
|---|---|---|---|
| Windows | `%LOCALAPPDATA%`, `%PROGRAMFILES%`, `%PROGRAMFILES(X86)%` + `\Google\Chrome\Application\chrome.exe` | same prefixes + `\Microsoft\Edge\Application\msedge.exe` | [Playwright registry][pw-registry], [chrome-launcher][chrome-finder] |
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | `/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge` | [Playwright registry][pw-registry] |
| Linux | `/opt/google/chrome/chrome`, or `which google-chrome-stable google-chrome chromium chromium-browser` | `/opt/microsoft/msedge/msedge` | [Playwright registry][pw-registry], [chrome-launcher][chrome-finder] |

On Windows the registry key `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe` (and `msedge.exe`) also gives the path. On the test machine both keys matched the fixed paths.

Edge ships with Windows 10 and 11. Try Chrome first, then Edge.

### Launch flags

Phase 1 (sign-in window, visible):

```
<browser> --user-data-dir=<new temp dir> --no-first-run --no-default-browser-check https://claude.ai/login
```

Phase 2 (read, headless, same profile):

```
<browser> --user-data-dir=<same dir> --no-first-run --no-default-browser-check --headless --remote-debugging-pipe about:blank
```

- `--user-data-dir` gives a separate profile. The user's own profile, cookies and extensions are not touched. Tested: the new profile had no cookies from the user's own browser.
- Chrome 136 and later ignore `--remote-debugging-port` and `--remote-debugging-pipe` on the default profile. They still work with a non-default `--user-data-dir`. Google made this change because attackers used remote debugging to steal cookies ([Chrome blog][cdp-136]). Our flow always uses its own directory, so the change does not stop us.
- `--headless` in current Chrome is the full browser with no visible window. The old headless mode moved to a separate `chrome-headless-shell` binary in Chrome 132 ([Chrome headless docs][headless]). Tested: headless Chrome 153 and Edge 154 read the cookies that phase 1 wrote.
- One profile, one browser process. If phase 1 still runs, a phase 2 launch on the same directory hands off to it and exits with code 21. CDP gives no answer (tested). So phase 2 must wait until phase 1 exits.

### Where the extension runs

- The extension host has Node `child_process`. It can start the browser on desktop VS Code.
- In a remote window (SSH, WSL, Codespaces), a workspace extension runs on the remote machine ([VS Code remote docs][vscode-remote]). A browser started there is not on the user's screen. Set `"extensionKind": ["ui", "workspace"]` in `package.json` so the extension prefers the local machine. `packages/vscode-ext/package.json` has no `extensionKind` today.
- In vscode.dev there is no process API. Keep cookie paste as the fallback there.
- `vscode.env.openExternal` opens the user's default browser ([VS Code API][vscode-api]). The extension cannot read cookies from that browser. It is not a way to capture a session. It is only useful for "open the site" links.

## 2. Read one cookie

### Options

| Option | Result | Why |
|---|---|---|
| CDP `Storage.getCookies` over `--remote-debugging-pipe` | **Use this** | Stable command. Returns all cookies of the browser context, with `name`, `value`, `domain`, `httpOnly`, `expires`, `session`. Reads httpOnly cookies. No port is open. ([protocol JSON][cdp-json]) |
| CDP over `--remote-debugging-port` | Do not use | Works (tested), but any local process can connect to the port while it is open. The Chrome 136 post names this as the cookie-theft path ([Chrome blog][cdp-136]). |
| `Network.getAllCookies` | Do not use | Deprecated. "Use Storage.getCookies instead." ([protocol JSON][cdp-json]) |
| `Network.getCookies({ urls })` | Possible | Needs a page session. `Storage.getCookies` plus a name and domain filter is simpler. |
| Decrypt the `Cookies` SQLite file | Do not use | Needs DPAPI, Keychain or libsecret code per OS. Antivirus flags this as an infostealer. CodexBar-Win pulled its builds for this reason ([CodexBar-Win][codexbar-win]). |
| Browser extension in the new profile | Do not use | Chrome 137 and later branded builds ignore `--load-extension` ([Chromium PSA][load-ext]). It also adds a second product to ship. |

### Pipe transport, no dependency

`--remote-debugging-pipe` makes the browser read CDP messages on file descriptor 3 and write on file descriptor 4. Each message is one JSON object followed by a NUL byte. Node `child_process.spawn` with `stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe']` gives both pipes. This works on Windows (tested) and is the same transport Puppeteer uses for `pipe: true` ([Puppeteer launch options][pptr-launch]).

Core of the tested client:

```js
const child = spawn(exe, args, { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let buf = '', id = 0;
const pending = new Map();
child.stdio[4].on('data', (d) => {
  buf += d;
  for (let i; (i = buf.indexOf('\0')) >= 0; buf = buf.slice(i + 1)) {
    const m = JSON.parse(buf.slice(0, i));
    pending.get(m.id)?.(m);
    pending.delete(m.id);
  }
});
const call = (method, params = {}) => new Promise((res) => {
  pending.set(++id, res);
  child.stdio[3].write(JSON.stringify({ id, method, params }) + '\0');
});
const { result } = await call('Storage.getCookies');
const cookie = result.cookies.find((c) => c.name === 'sessionKey' && c.domain.endsWith('claude.ai'));
await call('Browser.close');
```

- No WebSocket. VS Code 1.95 (the `engines` floor) runs Node 20.18 ([VS Code 1.95 notes][vscode-195]). In Node 20 the global `WebSocket` is behind `--experimental-websocket`. It is on by default from Node 22.0 and stable from 22.4 ([Node globals][node-ws]). The pipe avoids that question.
- No new dependency. `puppeteer-core` or `playwright-core` would work, but they are large and add nothing we need. `chrome-launcher` finds the browser but uses a port, not a pipe.

### Cookie names

| Provider | Value to read | Domain | Source |
|---|---|---|---|
| Claude | cookie `sessionKey` (`sk-ant-...`) | `claude.ai` | [CodexBar claude.md][codexbar-claude], `session-fetch.ts` |
| ChatGPT / Codex | cookie `__Secure-next-auth.session-token`, or chunks `.0`, `.1` | `chatgpt.com` | [CodexBar codex.md][codexbar-codex], `codexCookieHeader` in `session-fetch.ts` |
| Grok | cookie `sso` | `.grok.com` | `credentials.ts`, `docs/GROK-SPEC.md` |
| Cursor | cookie `WorkosCursorSessionToken` | `cursor.com` | [cursor-usage-surfaces.md](cursor-usage-surfaces.md) |
| Gemini | cookies `__Secure-1PSID` and others | `.google.com` | [gemini-usage-surfaces.md](gemini-usage-surfaces.md) |
| Windsurf | localStorage `devin_*` (4 values) | `https://windsurf.com` | issue #86 research |

For ChatGPT, keep every chunk. `codexCookieHeader` already joins them.

### localStorage (Windsurf)

- `DOMStorage.getDOMStorageItems({ storageId: { storageKey, isLocalStorage: true } })` reads localStorage for one origin ([protocol JSON][cdp-json]). The `DOMStorage` domain is marked experimental.
- Tested: from `about:blank` the call fails with "Frame not found for the given storage id". It needs a frame at that origin.
- Tested: `Runtime.evaluate` of `localStorage` after a load of the origin works too. But a real load runs the site's scripts and makes a network request from the headless browser.
- Tested, preferred: turn on `Fetch.enable` for `https://windsurf.com/*`. Answer the paused request with `Fetch.fulfillRequest` and an empty 200 page. Navigate to `https://windsurf.com/__aiq_stub`. The frame commits at the origin with no network call and no site script. Then `DOMStorage.getDOMStorageItems` returns the stored values. In the test the local web server was already stopped, and the read still returned the phase 1 values.
- An anonymous visit to windsurf.com stored no localStorage values. The `devin_*` values appear only after sign-in. This was not tested.

## 3. Google sign-in and Cloudflare

### Google

Google blocks sign-in from browsers that "are being controlled through software automation rather than a human" or "are embedded in a different application" ([Google Account Help][google-help]). Since 2021-01-04, "the browser must not provide automation features", and CEF and embedded webviews are blocked ([Google Developers Blog][google-dev]). Modern browsers with security updates stay supported.

Tests with a made-up email (`aiq-probe-no-such-user-83519@gmail.com`, not a real account):

| Launch | `navigator.webdriver` | Google result after "Next" |
|---|---|---|
| No debug flag | `false` | Not tested. A script cannot type here without CDP. |
| `--remote-debugging-port=0` | `true` | - |
| `--remote-debugging-pipe` | `true` | "Couldn't sign you in. This browser or app may not be secure." (Chrome and Edge) |
| `--enable-automation` | `true` | - |
| `--remote-debugging-pipe --disable-blink-features=AutomationControlled` | `false` | "Couldn't find this account" (normal answer) |

The `navigator.webdriver` column was measured with no CDP attach to the page. A local page sent the value back to a local server.

Findings:

- Any debug flag sets `navigator.webdriver`. Google reads that and refuses sign-in.
- The typing in the test came through CDP. With the automation signal off, the same CDP typing got a normal answer. So the block follows the browser signal, not the way the text came in.
- `--disable-blink-features=AutomationControlled` hides the signal. Do not use it. It hides automation from Google's security check, and Google's policy says the browser must not provide automation features. It can also stop working at any time.
- Phase 1 has no debug flag. It is a normal, unmodified browser that a human uses. This is what Google allows. CDP starts only in phase 2, after sign-in, with no page of the site open.
- Claude and ChatGPT "Continue with Google" go to `accounts.google.com`. The same rule applies there.
- Passkeys and 2FA: phase 1 is a normal browser, so the OS passkey prompt (Windows Hello, a phone by QR code) should work. The new profile has no saved passkeys or passwords from the user's own profile. Not tested with a real account.

### Cloudflare

Cloudflare uses heuristics, JavaScript detections, machine learning and anomaly detection. JavaScript detections "identify headless browsers and other malicious fingerprints" ([Cloudflare docs][cf-engines]).

Test: window with `--remote-debugging-pipe`, fresh profile, 12 s per site.

| Site | Result | Cookies set (names) |
|---|---|---|
| `https://claude.ai/login` | Sign-in page loaded. No challenge page. | `cf_clearance`, `__cf_bm`, `_cfuvid`, `anthropic-device-id` |
| `https://chatgpt.com/auth/login` | Sign-in page loaded. | `__cf_bm`, `_cfuvid`, `__cflb`, `__Host-next-auth.csrf-token` |
| `https://grok.com/` | Home page with "Sign in". | `cf_clearance`, `__cf_bm`, `grok_device_id`, `x-challenge` |
| `https://gemini.google.com/app` | Home page with "Sign in". | `COMPASS`, `NID` |
| `https://cursor.com/dashboard` | Redirect to `accounts.x.ai` "Log into your Cursor account". | `WorkosCursorAuthNonce`, `cf_clearance` on `.x.ai` |

- `cf_clearance` was set with no visible challenge. The Cloudflare check passed on its own, even with `navigator.webdriver` true.
- Phase 1 has no debug flag, so it looks like a normal browser. The risk there is lower still.
- Phase 2 reads cookies from disk. It loads no site page. Cloudflare never sees the headless browser.
- The poller later calls the APIs from Node with only the session cookie. That is how the product works today with pasted cookies. CodexBar treats a Cloudflare challenge as "a network-path restriction, not a stale-cookie signal" and keeps the cookie ([CodexBar claude.md][codexbar-claude]). Do the same.
- Cursor sign-in now goes through `accounts.x.ai`. [cursor-usage-surfaces.md](cursor-usage-surfaces.md) does not say this. Check it again in the Cursor ticket.

## 4. Know when sign-in is done, and close the window

Phase 1 has no CDP, so the extension cannot see the page. Use these signals:

1. The extension shows a VS Code notification: "Sign in to Claude in the browser window. Then click Done." with **Done** and **Cancel**.
2. **Done**: the extension closes the browser gracefully. On Windows, `taskkill /PID <pid>` with no `/F` and no `/T` sends a close message. Chrome and Edge exited in 0.4 to 0.8 s (tested). On macOS and Linux, send `SIGTERM`. Do not force-kill. A graceful exit writes the cookie store to disk.
3. The user closes the window: the process exits. Treat that as **Done**. Tested on Windows: a close message to the Edge window made all Edge processes of that profile exit. On macOS, closing the last window does not quit the app, so the **Done** button is the main signal there.
4. Phase 2 reads the value. If it is there, run the existing Save and Test call, store the value in SecretStorage, and delete the profile.
5. If the value is not there, keep the profile and offer **Open again**. The user continues where they stopped.
6. Add a time limit (for example 10 minutes). Then close the browser and delete the profile.

Rejected: poll cookies over CDP while the window is open. It gives instant detection, but it needs a debug flag in phase 1, and Google then blocks sign-in.

Session-only cookies: on a graceful exit, Chrome deleted cookies with no expiry (`_cfuvid`, `ion-vk`). Setting "Continue where you left off" in the profile did not keep them (tested). If a target cookie has no expiry, phase 2 cannot read it. `Storage.getCookies` returns `session` and `expires` for each cookie. The build must check each target cookie with a real sign-in.

## 5. Keep the profile on disk?

Recommendation: no. Delete it after each sign-in.

- The profile holds every cookie of every site the user opened in it. If the user signs in with Google, it holds a full Google account session, not only the one cookie we need.
- Any process that runs as the same user can start the browser on that directory with a debug flag and read all cookies. The Chrome 136 protection covers only the default profile ([Chrome blog][cdp-136]). A non-default directory uses a different encryption key. That protects the default profile. It does not protect our directory.
- The extension needs only the one value. It already keeps that value in SecretStorage (OS keychain). A kept profile adds risk and gives no data we do not already store.
- Cost: the user signs in again when the session ends. The build must log `expires` of each target cookie to learn how often that is.

If a later ticket keeps the profile (for example for Gemini, see DBSC below):

- Put it under `context.globalStorageUri`, not in the workspace.
- Tell the user in the consent text that a browser profile stays on disk.
- Give a **Sign out and delete browser data** command.

## 6. DBSC (Device Bound Session Credentials)

- DBSC makes a key pair for each session. The private key stays in secure hardware (TPM) and "cannot be exported from the machine". Short-lived cookies are reissued only when the browser proves it has the key ([Google blog][dbsc-blog], [Chrome docs][dbsc-docs]).
- "Any exfiltrated cookies quickly expire and become useless" ([Google blog][dbsc-blog]). When the short-lived cookie expires, the browser holds requests and refreshes it at the site's refresh endpoint ([DBSC explainer][dbsc-spec]).
- DBSC is in Chrome 145 on Windows ([Chrome blog][dbsc-win]). For Google accounts it is on by default for Workspace and personal accounts in Chrome on Windows. The rollout started 2026-05-25 and takes up to 60 days ([Workspace Updates][dbsc-ws]).
- A site must opt in. No public source says that claude.ai, chatgpt.com, grok.com or cursor.com use DBSC. Their cookies worked outside the browser when pasted, which is how the product works today.

Effect on our flow:

- Phase 1 is a normal Chrome profile. Nothing in the sources says DBSC is off for a non-default profile. So a Google sign-in in phase 1 can make a bound session. Not tested (needs a real Google sign-in).
- The extension then copies the Google cookies to Node. Node has no TPM key and cannot refresh them. So Gemini polling from Node can stop after the short-lived cookie expires. Google does not publish that lifetime.
- Claude, ChatGPT and Grok sign-in with "Continue with Google" is not affected. Google cookies stay in the profile. We read only the site's own cookie (`sessionKey`, `session-token`, `sso`), and the profile is deleted.
- For Gemini, the only lasting path is to keep the profile and let the browser make the requests (a headless run per poll, fetch in the page). That keeps a full Google session on disk and runs Chrome often. Decide this in the Gemini ticket. Do not build it in the first version.
- Edge: Microsoft has not published DBSC use by Google or other sites in Edge. A secondary report says Edge 147 has the feature ([IT trip][edge-dbsc]). Not verified from a primary source.

## 7. What similar tools do

| Tool | How it gets a web session | Source |
|---|---|---|
| CodexBar (macOS) | Reads cookies from Safari, Chrome and Firefox cookie files on disk. Uses the Keychain for Chrome decryption. Caches the cookie in the Keychain. Manual `Cookie:` header as a fallback. For ChatGPT it also uses an off-screen `WKWebView` with a data store per account. | [CodexBar README][codexbar], [claude.md][codexbar-claude], [codex.md][codexbar-codex] |
| CodexBar-Win | Shipped cookie decryption for Chrome, Edge and Brave (DPAPI + AES-GCM). Antivirus flagged the builds as a trojan. The author called it "the wrong design" and removed it. | [CodexBar-Win][codexbar-win] |
| Win-CodexBar | Opt-in cookie import from Chrome, Edge, Brave and Firefox. Stores cookies with user-scoped DPAPI. Manual cookies as a fallback. | [Win-CodexBar][win-codexbar] |

No tool that we found opens a clean browser profile for sign-in. The two-phase flow does not read the user's own browser files, so it avoids the antivirus and Keychain problems these tools hit.

## Recommendation

Build the two-phase flow in `packages/vscode-ext`:

1. Find Chrome, then Edge, from the fixed paths. Allow a path setting.
2. Make a new temp directory. Start phase 1 with no debug flag and the provider's sign-in URL.
3. Show a notification with **Done** and **Cancel**. Also treat the browser exit as **Done**.
4. Close the browser gracefully. Wait for exit.
5. Start phase 2: `--headless --remote-debugging-pipe` on the same directory. Call `Storage.getCookies`, or the stubbed `DOMStorage` read for Windsurf. Pick only the one value by name and domain. Call `Browser.close`.
6. Delete the directory. Store the value in SecretStorage. Run Save and Test.
7. Use raw CDP over the pipe. Add no npm dependency.
8. Set `"extensionKind": ["ui", "workspace"]`.
9. Keep cookie paste as the fallback.

Put the pure parts in `packages/core`: pick the target value from a cookie list, and check its `session` and `expires` fields. Keep process and file code in `packages/vscode-ext`.

## Risks

- **Google changes its checks.** Phase 1 is a plain browser, but Google can add new signals. Keep the paste fallback.
- **Session-only cookies.** A graceful exit deletes cookies with no expiry. If a target cookie is session-only, phase 2 gets nothing. Check each provider with a real sign-in during the build.
- **DBSC.** Copied Google cookies can expire soon. Gemini through this flow may not last. Other providers are not affected today, but any site can adopt DBSC later.
- **macOS app lifecycle.** Closing the window does not quit the browser. The **Done** button must do the close.
- **Linux keyrings.** Chrome on Linux encrypts cookies with the desktop keyring, or with a fixed key when none is found. Phase 1 and phase 2 must use the same store. If headless picks another store, the read can fail. Not tested. Pass the same `--password-store` value to both phases if tests show a problem.
- **Remote and web hosts.** In SSH, WSL, Codespaces or vscode.dev, a local browser may not be reachable. `extensionKind` helps for remote. The paste fallback covers the rest.
- **Profile left on disk.** A crash of VS Code during sign-in can leave the temp profile. Clean old `aiq-*` directories at start-up.
- **Private endpoints and store review.** Reading session cookies is handling "authentication cookies" ([store-session-cookie-policy.md](store-session-cookie-policy.md)). The Marketplace privacy text must say what the window reads and that nothing leaves the machine except calls to the provider.
- **Cursor sign-in moved.** Cursor sign-in now redirects to `accounts.x.ai`. Check the Cursor cookie name again after a real sign-in.
- **DOMStorage is experimental in CDP.** The Windsurf read can break in a later Chrome. `Runtime.evaluate` on the stubbed frame is the backup.

## Sources

[cdp-136]: https://developer.chrome.com/blog/remote-debugging-port
[cdp-json]: https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json
[headless]: https://developer.chrome.com/docs/chromium/headless
[pw-registry]: https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/registry/index.ts
[chrome-finder]: https://github.com/GoogleChrome/chrome-launcher/blob/main/src/chrome-finder.ts
[pptr-launch]: https://pptr.dev/api/puppeteer.launchoptions
[load-ext]: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ
[vscode-api]: https://code.visualstudio.com/api/references/vscode-api#env
[vscode-remote]: https://code.visualstudio.com/api/advanced-topics/remote-extensions
[vscode-195]: https://code.visualstudio.com/updates/v1_95
[node-ws]: https://nodejs.org/api/globals.html#class-websocket
[google-help]: https://support.google.com/accounts/answer/7675428
[google-dev]: https://developers.googleblog.com/guidance-to-developers-affected-by-our-effort-to-block-less-secure-browsers-and-applications/
[cf-engines]: https://developers.cloudflare.com/bots/concepts/bot-detection-engines/
[dbsc-docs]: https://developer.chrome.com/docs/web-platform/device-bound-session-credentials
[dbsc-blog]: https://blog.google/security/protecting-cookies-with-device-bound-session-credentials/
[dbsc-win]: https://developer.chrome.com/blog/dbsc-windows-announcement
[dbsc-ws]: https://workspaceupdates.googleblog.com/2026/05/prevent-account-takeovers-with-DBSC-now-generally-available-in-the-Chrome-browser-for-Windows.html
[dbsc-spec]: https://github.com/w3c/webappsec-dbsc
[edge-dbsc]: https://en.ittrip.xyz/windows/edge/edge-147-device-bound
[codexbar]: https://github.com/steipete/CodexBar
[codexbar-claude]: https://github.com/steipete/CodexBar/blob/main/docs/claude.md
[codexbar-codex]: https://github.com/steipete/CodexBar/blob/main/docs/codex.md
[codexbar-win]: https://github.com/babakarto/CodexBar-Win
[win-codexbar]: https://github.com/nesszer/Win-CodexBar

- Chrome 136 remote debugging change: https://developer.chrome.com/blog/remote-debugging-port
- CDP protocol definition (Storage, Network, DOMStorage, Fetch, Target): https://github.com/ChromeDevTools/devtools-protocol/blob/master/json/browser_protocol.json
- Chrome headless mode: https://developer.chrome.com/docs/chromium/headless
- Playwright browser paths: https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/registry/index.ts
- chrome-launcher browser finder: https://github.com/GoogleChrome/chrome-launcher/blob/main/src/chrome-finder.ts
- Puppeteer launch options (`pipe`): https://pptr.dev/api/puppeteer.launchoptions
- Chromium PSA, `--load-extension` removed in branded Chrome 137: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY/m/S0ET5wPjCAAJ
- VS Code API, `env`: https://code.visualstudio.com/api/references/vscode-api#env
- VS Code remote extensions and `extensionKind`: https://code.visualstudio.com/api/advanced-topics/remote-extensions
- VS Code 1.95 release notes (Electron 32, Node 20.18): https://code.visualstudio.com/updates/v1_95
- Node.js `WebSocket` global: https://nodejs.org/api/globals.html#class-websocket
- Google Account Help, supported browsers: https://support.google.com/accounts/answer/7675428
- Google Developers Blog, blocking less secure browsers: https://developers.googleblog.com/guidance-to-developers-affected-by-our-effort-to-block-less-secure-browsers-and-applications/
- Cloudflare bot detection engines: https://developers.cloudflare.com/bots/concepts/bot-detection-engines/
- Chrome DBSC docs: https://developer.chrome.com/docs/web-platform/device-bound-session-credentials
- Google blog, DBSC: https://blog.google/security/protecting-cookies-with-device-bound-session-credentials/
- Chrome blog, DBSC on Windows: https://developer.chrome.com/blog/dbsc-windows-announcement
- Google Workspace Updates, DBSC GA on Windows: https://workspaceupdates.googleblog.com/2026/05/prevent-account-takeovers-with-DBSC-now-generally-available-in-the-Chrome-browser-for-Windows.html
- W3C DBSC explainer: https://github.com/w3c/webappsec-dbsc
- Edge 147 DBSC (secondary): https://en.ittrip.xyz/windows/edge/edge-147-device-bound
- CodexBar: https://github.com/steipete/CodexBar
- CodexBar Claude docs: https://github.com/steipete/CodexBar/blob/main/docs/claude.md
- CodexBar Codex docs: https://github.com/steipete/CodexBar/blob/main/docs/codex.md
- CodexBar-Win: https://github.com/babakarto/CodexBar-Win
- Win-CodexBar: https://github.com/nesszer/Win-CodexBar
