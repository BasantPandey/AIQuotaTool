# Research: MV3 Side Panel, Badge, and Notifications Capabilities

Issue: #29. Sources are developer.chrome.com primary docs, fetched 2026-08-08. Anything version-dependent is flagged inline.

## Verdict (summary)

All three capabilities are real, stable MV3 APIs and sufficient for a quota-dashboard extension. A React app can live in the side panel exactly like it lives in the popup (the panel is an extension page with full Chrome API access), and it stays fresh via `chrome.storage.onChanged` push rather than panel-side polling. The action badge is a trivial service-worker call away (`setBadgeText` / `setBadgeBackgroundColor`, ~4 characters fit). `chrome.notifications` needs the `"notifications"` manifest permission and is granted by default at install. The one hard constraint that shapes design is the service worker lifecycle: workers suspend after ~30 s of inactivity, and `chrome.alarms` has a floor of 30 seconds per period only since Chrome 120 (1 minute before that), so a 60-second polling cadence is safe everywhere but sub-minute cadence is version-dependent.

## 1. Side panel: open/trigger model

Source: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

- Requires the `"sidePanel"` manifest permission; available Chrome 114+, MV3 only.
- Global panel: declare `"side_panel": { "default_path": "sidepanel.html" }` in the manifest to show the same panel on every site.
- Per-site / per-tab panel: `chrome.sidePanel.setOptions({ tabId, path, enabled })` enables or disables the panel per tab. If the user switches to a tab where the panel is disabled, the panel hides and re-appears when switching back; the extension also drops out of the side-panel drop-down menu on sites where it is disabled. Note: if the same `path` is set for a `tabId` and the default, the tab-specific panel is a *different instance* than the default panel.
- Action-click open: `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` makes clicking the toolbar icon toggle the panel. Defaults to `false`.
- Programmatic open: `chrome.sidePanel.open({ windowId })` (global) or `chrome.sidePanel.open({ tabId })` (tab-specific), Chrome 116+, and it "may only be called in response to a user action" - action click, keyboard shortcut, context menu, or a user gesture on an extension page or content script. It cannot be fired from an alarm or a poll callback.
- Interaction with popup: `chrome.action.onClicked` does not fire if the action has a popup (https://developer.chrome.com/docs/extensions/reference/api/action). So "action click opens panel" and "action click opens popup" are mutually exclusive unless you open the popup programmatically (`chrome.action.openPopup()`, Chrome 127+ for non-policy installs).
- Users choose which side (left/right) the panel renders on in Chrome settings; `getLayout()` (Chrome 140+) reports it.
- Newer lifecycle events: `sidePanel.onOpened` (Chrome 141+), `sidePanel.onClosed` (Chrome 142+), `sidePanel.close()` (Chrome 141+). Version-dependent; not needed for a baseline build.

## 2. Can a React app live there, and how does it stay fresh?

Sources: https://developer.chrome.com/docs/extensions/reference/api/sidePanel ,
https://developer.chrome.com/docs/extensions/reference/api/storage

- A side panel is a plain HTML file inside the extension package ("The path to the side panel HTML file... must be a local resource within the extension package"). As an extension page, "side panels have access to all Chrome APIs." So a bundled React app works there exactly as it does in the popup - the Vite-built React bundle from `@ai-quota-tool/ui` can be mounted in `sidepanel.html` with no special constraints.
- Freshness, push not poll: `chrome.storage.onChanged` fires in every extension context when anything changes in storage ("The onChanged event lets you monitor changes to a StorageArea... When anything changes in storage, that event fires"). The docs' own example has the service worker apply a setting via `storage.onChanged` immediately after an options page writes it.
- Recommended pattern (matches the existing popup flow in CLAUDE.md): service worker poll writes merged `quotaStates` to `chrome.storage.local`; the side panel (and popup) subscribe to `chrome.storage.onChanged` and re-render. No panel-side polling loop is needed, which also avoids each open panel running its own fetch cadence.
- Caveat: `storage.session` is in-memory and not persisted to disk; `storage.local` is the right area for quota state (per the storage area descriptions on the same page).

## 3. Action badge mechanics from a service worker

Source: https://developer.chrome.com/docs/extensions/reference/api/action

- `chrome.action.setBadgeText({ text })` and `chrome.action.setBadgeBackgroundColor({ color })` are callable from the service worker (all `chrome.action` APIs are). Color accepts a CSS color string or an RGBA array of four integers 0-255.
- Space is limited: "Any number of characters can be passed, but only about four can fit in the space." Passing `''` clears the badge.
- Per-tab vs global: every setter takes an optional `tabId`; tab-specific values take priority over global and reset when the tab closes. For a quota gauge, a global badge (e.g. lowest remaining % across services) is the natural fit.
- Badge text color: `setBadgeTextColor()` exists (Chrome 110+); if unset, Chrome auto-picks a contrasting color. Version-dependent if targeting older Chrome.
- Dynamic icons from the SW are possible via `OffscreenCanvas` + `setIcon({ imageData })`, but `setIcon` is intended for static images, not animation.

## 4. chrome.notifications permission and behavior

Source: https://developer.chrome.com/docs/extensions/reference/api/notifications

- Requires the `"notifications"` manifest permission. `PermissionLevel` is `"granted"` by default at install time; the user can later deny it, and `getPermissionLevel()` / `onPermissionLevelChanged` expose that (note: `onPermissionLevelChanged` UI only exists on ChromeOS, so do not rely on the event on desktop).
- `notifications.create(id?, options)` requires `type`, `title`, `message`, and `iconUrl`. Templates: `basic`, `image`, `list`, `progress`. Up to two action buttons; `onClicked` and `onButtonClicked` events.
- Platform honesty caveats, straight from the docs: on macOS, button icons, the image thumbnail, and `appIconMaskUrl` are not visible (deprecated since Chrome 59), and `list` notifications show only the first item on macOS. `priority` -2/-1 errors on platforms without a notification center (Windows, Linux, Mac). `requireInteraction` (Chrome 50+) keeps a notification up until the user acts on it; `silent` (Chrome 70+) suppresses sound/vibration.
- Reusing the same `notificationId` in `create()` clears the old notification first - useful for "one notification per service reset" semantics instead of stacking.
- `update()` / `clear()` / `getAll()` return Promises only on Chrome 116+ (older versions use callbacks). Version-dependent.

## 5. Service worker lifecycle and alarms: what shapes a 60-second cadence

Sources: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle ,
https://developer.chrome.com/docs/extensions/reference/api/alarms

- Termination conditions: Chrome terminates an extension service worker after 30 seconds of inactivity (any received event or extension API call resets the timer), when a single event/API call runs longer than 5 minutes, or when a `fetch()` response takes more than 30 seconds to arrive. An incoming event revives a dormant worker. Design must be resilient to unexpected termination - global variables are lost, so state lives in `chrome.storage` (Web Storage API is not available in extension service workers).
- Keep-alive changes are version-dependent: Chrome 110+ - extension API calls reset the idle timer; Chrome 114+ - sending a message over a long-lived port keeps the worker alive (opening a port alone no longer does); Chrome 116+ - active WebSocket traffic resets the idle timer (relevant to the optional Chrome→VS Code WS push: it incidentally keeps the worker alive while connected).
- Alarms floor: `chrome.alarms` limits alarms to at most once every 30 seconds; setting `delayInMinutes` or `periodInMinutes` below 0.5 is not honored and logs a warning. `when` can be set less than 30 s out but the alarm will not fire for at least 30 seconds. Chrome may also delay alarms arbitrarily beyond the requested time.
- Version note (Chrome 120): the 30-second minimum period was introduced in Chrome 120 "to match the service worker lifecycle" - before that, the documented minimum period was 1 minute. Consequence: a 60-second poll (`periodInMinutes: 1`) is valid on every MV3 Chrome; anything faster than 60 s requires Chrome 120+ and should not be assumed.
- Sleep behavior: alarms keep running while the device sleeps but do not wake it; missed alarms fire on wake, and a repeating alarm fires at most once on wake, then reschedules from that point. So after a laptop nap, quota state can be stale until the wake-up tick - the UI should tolerate and display last-updated time.
- Persistence: the `persistAcrossSessions` flag is Chrome 150+ and "behavior can be unpredictable" before it; the docs' own guidance is to re-check and re-create important alarms on every service worker startup. This matches the repo's existing pattern (alarms recreated on install/startup/SW wake).

## Implications for V2

- Side panel is the right V2 surface for an always-visible quota dashboard: global `default_path` panel plus `openPanelOnActionClick: true`; add `chrome.sidePanel.open()` shortcuts (context menu / command) as progressive enhancement for Chrome 116+.
- Build the panel as the same React app as the popup, fed by `chrome.storage.onChanged` over `chrome.storage.local` - one writer (service worker poller), many live readers, zero panel-side polling. This extends, rather than replaces, the existing merge-in-storage data flow.
- Badge: one global badge showing the most-pressured service's remaining % (max ~4 chars, e.g. "7%"), updated from the SW after each poll merge; leave text color to Chrome's auto-contrast unless 110+ is guaranteed. Do not invent values for unknown states (repo honesty rule) - clear the badge when nothing is known.
- Notifications: declare `"notifications"`; use one stable `notificationId` per service so reset alerts replace rather than stack; keep to the `basic` template for cross-platform consistency (macOS hides list items/images); honor `getPermissionLevel()` before promising alerts.
- Polling cadence: keep 60 s via `chrome.alarms` (`periodInMinutes: 1`) - valid on all MV3 Chrome. Do not market sub-minute refresh unless gating on Chrome 120+. Recreate alarms on every SW startup (pre-Chrome-150 persistence is unreliable), and display last-updated timestamps because device sleep can silently delay ticks.
- `sidePanel.open()` requires a user gesture - the extension cannot self-open the panel on a quota threshold crossing; use a notification with a button as the interrupt channel instead.
