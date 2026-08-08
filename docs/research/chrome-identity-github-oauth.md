# Research: GitHub OAuth via chrome.identity in MV3

Resolves issue #28 (part of #27). Scope: how a standalone MV3 Chrome extension authenticates with GitHub (Copilot seat check) via `chrome.identity`.

## Summary verdict

A standalone MV3 Chrome extension CAN authenticate a user with GitHub using `chrome.identity.launchWebAuthFlow` against a self-registered GitHub OAuth App: open `https://github.com/login/oauth/authorize` (with PKCE) in the auth webview, GitHub redirects to the extension's `https://<app-id>.chromiumapp.org/*` redirect URL, and the extension exchanges the returned `code` for a `gho_` access token. The `identity` permission is required but shows no install warning. The manifest `oauth2` section is Google-only and is NOT used for GitHub. OAuth App tokens do not expire on a schedule (only revoked: user action, 1 year unused, 10-token-per-scope limit, or leak detection), and there are no refresh tokens for OAuth Apps - re-auth is a silent re-run of the flow once the user has authorized. The hard limit is not auth but the API: GitHub's OFFICIAL Copilot seat endpoints are org-owner-only (`manage_billing:copilot` or `read:org`); there is no official endpoint for an individual user to check their own Copilot seat or quota. The commonly cited `GET /copilot_internal/user` is undocumented/community-reported and must be treated as unsupported.

## 1. launchWebAuthFlow flow and redirect URL in a service worker

- `chrome.identity.launchWebAuthFlow({ url, interactive })` launches a webview at the provider's auth URL; when the provider redirects to a URL matching `https://<app-id>.chromiumapp.org/*`, the window closes and the final redirect URL is returned (Promise resolves with `string | undefined`, Chrome 106+). It is explicitly documented as the path for "auth flows with non-Google identity providers".
  Source: https://developer.chrome.com/docs/extensions/reference/api/identity#method-launchWebAuthFlow
- `chrome.identity.getRedirectURL(path?)` generates the redirect URL; all generated URLs match `https://<app-id>.chromiumapp.org/*`. This exact URL (host + path) must be registered as the GitHub OAuth App's callback URL.
  Source: https://developer.chrome.com/docs/extensions/reference/api/identity#method-getRedirectURL
- GitHub's redirect URI matching rules: the `redirect_uri` host (excluding sub-domains) and port must exactly match the registered callback URL; the path must be a subdirectory of the callback path. Sub-domains of the callback host are allowed, so `https://<app-id>.chromiumapp.org/anything` works when the callback is `https://<app-id>.chromiumapp.org/`.
  Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#redirect-urls
- `chrome.identity` is part of the MV3 extension API surface (the reference above is the MV3 reference), so it is callable from the extension service worker. Interactive flows should be triggered from UI that explains the authorization; Chrome docs warn against launching an interactive flow at startup with no context.
  Source: https://developer.chrome.com/docs/extensions/reference/api/identity
- Web application flow (GitHub side): `GET https://github.com/login/oauth/authorize` with `client_id`, `redirect_uri`, `scope`, `state`, and PKCE (`code_challenge` + `code_challenge_method=S256`, strongly recommended; `plain` not supported). On accept, GitHub redirects back with a `code` (expires after 10 minutes) and `state`; exchange via `POST https://github.com/login/oauth/access_token` (send `Accept: application/json` for a JSON response).
  Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow
- The `code` exchange per the docs lists `client_secret` as required, but GitHub supports PKCE for the web flow (`code_challenge`/`code_verifier` parameters documented above). An extension is a public client and cannot keep a `client_secret` confidential; PKCE is the mechanism intended for this. (Note: GitHub docs mark PKCE "strongly recommended", not strictly required - whether the secret can be fully omitted for OAuth Apps with PKCE is not spelled out in the docs and should be verified empirically before building.)
  Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow
- COMMUNITY-REPORTED (not official): an MV3 service worker can be terminated by Chrome while the interactive auth webview is open, which can orphan the flow. Common workarounds are keeping the worker alive during the flow or running the flow from a visible extension page/popup. This is not documented by Chrome; treat as an engineering risk to prototype, not a fact.

## 2. Required manifest keys

- `"permissions": ["identity"]` is required to use `chrome.identity` at all.
  Source: https://developer.chrome.com/docs/extensions/reference/api/identity (Permissions section)
- The manifest `"oauth2"` section (required sub-properties `client_id` and `scopes`) exists to feed `chrome.identity.getAuthToken`, and the documented client ID is a Google API console client ID (`*.apps.googleusercontent.com`). It is for Google OAuth, not for GitHub. For GitHub you register a GitHub OAuth App yourself and pass its `client_id` in the authorize URL used with `launchWebAuthFlow`.
  Sources: https://developer.chrome.com/docs/extensions/reference/manifest/oauth2 , https://developer.chrome.com/docs/extensions/how-to/integrate/oauth
- Setting the manifest `"key"` is recommended during development to keep a consistent extension ID, because the extension ID determines the `chromiumapp.org` redirect URL that must match the registered GitHub callback.
  Source: https://developer.chrome.com/docs/extensions/reference/manifest/oauth2
- No `host_permissions` are needed for the auth flow itself (the redirect URL is extension-owned), but `fetch` to `https://api.github.com/...` from the service worker needs host permissions for `api.github.com` under MV3 CORS rules. (Extension pages/service workers can only bypass CORS for origins declared in `host_permissions`.)

## 3. GitHub OAuth scopes the Copilot seat endpoints need

Official, documented endpoints (all "public preview, subject to change"):

- `GET /orgs/{org}/copilot/billing` - org Copilot subscription + seat breakdown. Org owners only. OAuth app tokens / classic PATs need `manage_billing:copilot` or `read:org`.
- `GET /orgs/{org}/copilot/billing/seats` - list seat assignments. Org owners only. Needs `manage_billing:copilot` or `read:org`.
- `GET /orgs/{org}/members/{username}/copilot` - one member's seat details (includes `pending_cancellation_date`, `last_activity_at`, `plan_type`). Org owners only. Needs `manage_billing:copilot` or `read:org`.

Source for all three: https://docs.github.com/en/rest/copilot/copilot-user-management

- There is NO documented REST endpoint for an individual user to query their own Copilot Individual/Pro seat, plan, or premium-request quota. The official Copilot REST surface covers org/enterprise management and org usage metrics only.
  Source: https://docs.github.com/en/rest/copilot
- UNDOCUMENTED / COMMUNITY-REPORTED: community tools (and Microsoft's own Copilot clients) call endpoints such as `GET https://api.github.com/copilot_internal/user` to read the signed-in user's Copilot subscription state, reportedly working with minimal scopes. This endpoint appears in no official GitHub documentation; it can change or break without notice and its required scopes are not specified anywhere authoritative. Per the repo's honesty culture, any V2 design depending on it must label the data as such and fail honestly.
- Scope hygiene fact: `(no scope)` grants read-only public info; `read:user`/`read:org` are the minimal read scopes relevant here. Granted scopes are visible in the `X-OAuth-Scopes` response header and can be compared against `X-Accepted-OAuth-Scopes`.
  Source: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps

## 4. Token storage options and lifetime/refresh behavior

Lifetime (OAuth App tokens, `gho_` prefix):

- OAuth App access tokens have no built-in expiry date. They are revoked when: the user revokes the app authorization; unused for one year (auto-revoked); more than ten tokens exist for the same user/app/scope combination (oldest revoked); the app owner revokes the token; or the token is pushed to a public repo/gist (auto-revoked on leak detection).
  Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation
- OAuth Apps (web flow) have NO refresh tokens; the token response contains `access_token`, `scope`, `token_type` only. "Refresh" means re-running the authorize flow. Once a user has authorized the app for the requested scopes, the authorize step auto-completes without showing the consent page (documented `scope` behavior), so a non-interactive `launchWebAuthFlow` re-auth is a realistic renewal path. Note the rate limit: 10 tokens per hour per user/app triggers a re-authorization prompt, so do not loop re-auth.
  Sources: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#web-application-flow , https://developer.chrome.com/docs/extensions/reference/api/identity#type-WebAuthFlowDetails
- Alternative architecture: GitHub Apps issue user access tokens that expire after 8 hours by default and are renewed with an included refresh token (`ghr_`); app owners can optionally disable expiry (not recommended by GitHub). This is the officially preferred model ("consider building a GitHub App instead of an OAuth app") but adds refresh-token custody to the extension.
  Sources: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation#user-token-expired-due-to-github-app-configuration , https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps

Storage options in the extension:

- `chrome.storage.local` - persists across restarts; the standard place extensions keep tokens. It is NOT encrypted at rest by the extension API, so the token is readable to anything with access to the profile's extension storage; do not sync it (`chrome.storage.sync` would propagate the token to the user's other devices via Chrome Sync - avoid for credentials).
- `chrome.storage.session` - in-memory-only storage area, cleared when the browser session ends; reduces on-disk exposure but forces re-auth per browser session.
- There is no OS-keychain equivalent available to Chrome extensions (no SecretStorage analog); this is a platform gap, stated plainly.
- Chrome-side caching note: `getAuthToken`'s in-memory token cache (`removeCachedAuthToken`, `clearAllCachedAuthTokens`) applies to Google tokens via the manifest `oauth2` flow, not to GitHub tokens from `launchWebAuthFlow`; the extension owns GitHub token storage itself.
  Source: https://developer.chrome.com/docs/extensions/reference/api/identity

## 5. Chrome Web Store review implications of the identity permission

- `identity` triggers NO install-time permission warning. (By contrast, `identity.email` shows "Know your email address.") Source: the official permissions list shows a "Warning displayed" line for warning-bearing permissions and none for `identity`.
  Source: https://developer.chrome.com/docs/extensions/reference/permissions-list
- CWS "Use of Permissions" policy: request the narrowest permissions necessary; if more than one permission could implement a feature, request the one with least access; do not request permissions for unimplemented features. In practice every requested permission must be justified during submission/review, and a remote OAuth sign-in flow will also touch the limited-use/privacy disclosures (privacy policy, data handling declarations in the developer dashboard).
  Source: https://developer.chrome.com/docs/webstore/program-policies/permissions
- Practical implication: `identity` is low-friction for review compared to host permissions like `cookies` or broad `*://*/*` access, but the GitHub OAuth App's consent screen (GitHub-side) is what the user actually sees for scope grants.

## Implications for V2

1. Feasible path: GitHub OAuth App + `launchWebAuthFlow` (interactive, from a visible UI surface) + PKCE + token in `chrome.storage.local`. Register `https://<app-id>.chromiumapp.org/` as the callback and pin the extension ID via manifest `"key"` during dev.
2. The seat-check value is limited by the API, not the auth: official Copilot seat endpoints answer "does ORG X have a seat for USER" for org owners only (`read:org` minimum). For an individual user's own Copilot plan/quota there is no official endpoint; only the undocumented `copilot_internal/*` family, which V2 must treat as best-effort with honest fallbacks (consistent with the existing Copilot honesty builders in `@ai-quota-tool/core`).
3. Token lifecycle is simple: no refresh tokens, no expiry clock; handle 401 by re-running the (usually silent, already-authorized) flow, but never loop it (10 tokens/hour limit; oldest-token revocation at 10 per scope combo).
4. Empirical open questions to prototype before committing: (a) whether GitHub accepts the token exchange from an OAuth App public client with PKCE alone (no `client_secret`); (b) service worker survival across a long interactive flow - if flaky, run the flow from the popup or an extension tab instead; (c) whether the GitHub device flow (no secret needed, documented) is a better UX than the web flow for a popup-driven extension.
