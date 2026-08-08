# Chrome V2 product bar - AI Quota Tool (standalone Chrome extension)

**Status:** Locked product bar for the **Chrome extension V2**.  
**Source:** wayfinder map [Map: Standalone Chrome extension V2 spec](https://github.com/BasantPandey/AIQuotaTool/issues/27) (tickets #28-#35) and interim spec issue [#38](https://github.com/BasantPandey/AIQuotaTool/issues/38).  
**Package:** `@ai-quota-tool/chrome-ext` version `2.0.0`.  
**Not this document:** VS Code extension changes (V1 bar: [`docs/V1-SPEC.md`](./V1-SPEC.md)), new services, a CI release pipeline.  
**Grok rules:** [`docs/GROK-SPEC.md`](./GROK-SPEC.md) applies. Never store Grok session keys.

---

## 1. Product story

AI Quota Tool V2 is a **fully standalone Chrome extension**. No VS Code install is required.

| Component | Role |
| --- | --- |
| **Side panel dashboard** | One card per service. Shows remaining quota or an honest non-percentage state. |
| **Toolbar badge** | Lowest remaining percentage across services. Amber below 10%, red below 5%. |
| **Notifications** | Quota reset alerts and low-quota alerts. |
| **Accounts section** | Connect and disconnect per service. Privacy disclosure and consent gate. |
| **Service worker engine** | Polls every 60 seconds. Merges readings. Drives badge and notifications. |

Services in this bar: **Claude**, **OpenAI Codex**, **GitHub Copilot**, **Grok**.

The V1 WebSocket push to VS Code is removed. The VS Code WS server stays but is dormant.

---

## 2. Requirements and acceptance

### 2.1 Standalone Chrome

| ID | Requirement | Acceptance |
| --- | --- | --- |
| P1 | Standalone first-class | Every feature works with no VS Code installed |
| P2 | Side panel surface | Toolbar action click opens the side panel (Chrome 114+) |
| P3 | Push freshness | The panel never polls. It re-renders on `chrome.storage.onChanged` |
| P4 | No WS push | No WebSocket client and no localhost host permission ship in V2 |

### 2.2 Services and honesty

| ID | Requirement | Acceptance |
| --- | --- | --- |
| H1 | No fake full remaining | Never invent `sessionPct`/`weeklyPct` of 100 when usage is unknown |
| H2 | Copilot seat only | `GET /user/copilot` status mapped by pure `mapCopilotSeatStatus`. No documented endpoint exists for an individual's own Copilot quota. Do not depend on undocumented endpoints for remaining % |
| H3 | Grok live session | Live grok.com session only. Weekly % only via pure `mapGrokWeeklyUsage` from first-party used %. Never store Grok session keys |
| H4 | Partial failure | One failing service keeps the other services' last good readings (freshest-wins merge) |
| H5 | Session expiry | Claude/Codex 401/403 return a `session_expired` honesty state. The stale ring is dropped. The panel signals re-auth |

### 2.3 Credentials and security

| ID | Requirement | Acceptance |
| --- | --- | --- |
| K1 | Browser sessions | Claude, Codex, and Grok connect when the user signs in on the service website. No session secrets are stored anywhere |
| K2 | GitHub OAuth | Copilot connects via `chrome.identity.launchWebAuthFlow` with a self-registered GitHub OAuth App and PKCE. No client secret ships |
| K3 | Token storage | The `gho_` token lives in `chrome.storage.local` only. Never synced. Disconnect deletes it |
| K4 | Revocation | Disconnect copy points to github.com/settings/applications for full grant revocation |
| K5 | Silent re-auth | A dead token triggers one silent re-auth per service worker activation. Never loop (GitHub allows 10 tokens per hour) |
| K6 | Stable identity | The manifest `key` is pinned so the `https://<extension-id>.chromiumapp.org/` OAuth callback is stable |

### 2.4 Badge and notifications

| ID | Requirement | Acceptance |
| --- | --- | --- |
| B1 | Badge pressure | Badge shows the lowest remaining % via pure `deriveBadge`. Amber below 10%, red below 5%. Empty when no real percentage exists |
| B2 | Low-quota alerts | `decideLowQuotaAlerts` fires once per drop below 10%. Re-arms when the service recovers. Stable per-service notification IDs |
| B3 | Reset alerts | Reset timestamps schedule per-service alarms. Alarms fire `basic` template notifications |

### 2.5 Onboarding and disclosure

| ID | Requirement | Acceptance |
| --- | --- | --- |
| O1 | Consent gate | First run shows the privacy disclosure. The user accepts before the dashboard shows |
| O2 | Empty state | No readings → guidance to connect accounts |
| O3 | Accounts section | Per-service connection state. Copilot has Connect/Disconnect. Session services link to their sites |

Approved disclosure copy lives in [PRIVACY.md](../PRIVACY.md) and in issue [#34](https://github.com/BasantPandey/AIQuotaTool/issues/34).

### 2.6 Engine salvage boundary

| ID | Requirement | Acceptance |
| --- | --- | --- |
| E1 | Salvaged engine | Polling loop, four fetchers, content bridge, storage schema, and reset notifications carry over from V1 |
| E2 | Deleted surface | WS client, popup, and SettingsTab are removed. The `ws-keepalive` alarm is cleared on install |
| E3 | Storage compatibility | `quotaStates` and `lastPollAt` carry over. No version marker. No migration code |

### 2.7 Manifest and permissions

| ID | Requirement | Acceptance |
| --- | --- | --- |
| M1 | Minimal permissions | `storage`, `alarms`, `notifications`, `identity`, `sidePanel`. No `cookies` API |
| M2 | Named hosts only | `claude.ai`, `chatgpt.com`, `grok.com`, `api.github.com`, `github.com` (token exchange only). Never `<all_urls>` |
| M3 | Clean build | No remote code. Unobfuscated output |

### 2.8 Publishing

| ID | Requirement | Acceptance |
| --- | --- | --- |
| W1 | Privacy policy | [PRIVACY.md](../PRIVACY.md) in the repo root. The listing links its GitHub URL |
| W2 | Submission texts | Approved single-purpose statement, per-permission justifications, and listing description in issue [#35](https://github.com/BasantPandey/AIQuotaTool/issues/35) |
| W3 | Assets | 128x128 icon (exists). 1-5 screenshots at 1280x800 or 640x400. 440x280 small promo tile |
| W4 | Release pipeline | Manual zip upload cut from a git tag. No CI pipeline. Release-when-ready cadence |
| W5 | Published | The extension passes Chrome Web Store review and installs from its public store URL |

Research: [docs/research/chrome-web-store-publishing.md](./research/chrome-web-store-publishing.md), [docs/research/chrome-identity-github-oauth.md](./research/chrome-identity-github-oauth.md), [docs/research/mv3-side-panel-badge-notifications.md](./research/mv3-side-panel-badge-notifications.md).

**Known residual risk:** Chrome Web Store Developer Agreement 4.4.1 (third-party terms of service for reading claude.ai / chatgpt.com / grok.com). This is a business decision, not a technical fix.

---

## 3. Out of scope (this bar)

- VS Code extension changes of any kind
- New services beyond Claude, Codex, Copilot, Grok
- A CI or automated store release pipeline
- History, trends, or charts. The panel shows current state only
- Firefox, Edge, or Safari ports
- Any backend service, account system, or telemetry
- Notification quiet hours and per-service toggles (possible future work, not in this bar)

---

## 4. Ordered implementation backlog

### Done on main

| # | Work | Commit |
| --- | --- | --- |
| 1 | Core pure seams: `deriveBadge`, `decideLowQuotaAlerts`, `buildGitHubAuthorizeUrl` / `extractAuthorizationCode`, `deriveConnections` (TDD, 24 tests) | `5d17ebf` |
| 2 | Manifest 2.0.0: `identity` + `sidePanel`, pinned `key`, named hosts, WS and popup removed | `5d17ebf` |
| 3 | Worker rewrite: badge, low-quota latch, reset alarms, panel messages, legacy alarm cleanup | `5d17ebf` |
| 4 | GitHub OAuth (PKCE) flow + token storage + silent re-auth | `5d17ebf` |
| 5 | Side panel app: consent gate, empty state, dashboard, accounts section | `5d17ebf` |
| 6 | Session expiry drops the ring (`session_expired` honesty + `sessionExpired` builder); revoke pointer copy | `befb0a3` |
| 7 | Look and feel locked: card grid (prototype branch `prototype/side-panel-look`) | issue #33 |
| 8 | PRIVACY.md for the store listing | `6250dcf` |

### Remaining, in order

| # | Work | Type |
| --- | --- | --- |
| 1 | Register the GitHub OAuth App (callback `https://<extension-id>.chromiumapp.org/`) and set `GITHUB_OAUTH_CLIENT_ID` in `github-auth.ts` | Manual task (repo owner) |
| 2 | Manual E2E in Chrome: load `dist/` unpacked, connect each service, verify panel, badge, notifications, disconnect, session expiry | Manual task |
| 3 | Produce screenshots (1-5 at 1280x800 or 640x400) and the 440x280 promo tile | Manual task |
| 4 | Register the Chrome Web Store developer account and complete the Privacy practices tab with the approved texts | Manual task |
| 5 | Tag `chrome-v2.0.0`, build the zip, submit for review | Manual task |

---

## 5. Core pure seams (tested)

- `preferQuotaState` / `upsertQuotaState` / `mergeQuotaStates` (freshest-wins)
- `mapClaudeUsage` / `mapCodexUsage` / `mapGrokWeeklyUsage`
- Copilot honesty builders + `mapCopilotSeatStatus`
- Grok honesty builders + `extractGrokWeeklyUsage`
- `sessionAuthFailureAction` + `sessionExpired` (drop ring, keep secret, re-auth signal)
- `pressureRemaining` / `lowestPressureAmong` (never invent 100%)
- `deriveBadge` + `BADGE_COLORS`
- `decideLowQuotaAlerts` + `initialLowQuotaArmed`
- `buildGitHubAuthorizeUrl` / `extractAuthorizationCode`
- `isConnectedReading` / `deriveConnections`

All decision logic lives in `@ai-quota-tool/core` and is tested there. Chrome-facing code is thin glue. It is verified by manual E2E in Chrome.

---

## 6. Done when

1. The extension passes Chrome Web Store review and installs from its public store URL.
2. On a fresh Chrome profile, the consent gate shows, all four services connect, and the panel, badge, and notifications behave per section 2.
3. `pnpm turbo build`, `pnpm turbo type-check`, and `pnpm turbo test` pass on the release tag.
