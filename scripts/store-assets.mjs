/**
 * Builds the Chrome extension icons and all Chrome Web Store art.
 * 1. Renders the brand mark to icons/icon{16,48,128}.png (128 has 16 px padding).
 * 2. Loads packages/chrome-ext/dist in headless Chrome, seeds sample data, and
 *    captures the real side panel to store/panels/.
 * 3. Renders store/art.html for the tile, the marquee and 5 screenshots.
 *
 * Run: pnpm --filter @ai-quota-tool/chrome-ext build && node scripts/store-assets.mjs
 * Needs Google Chrome. Set CHROME_PATH if it is not in the default place.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { launchChrome, MARK_SVG, root, sleep } from './asset-kit.mjs';

const extDir = join(root, 'packages/chrome-ext');
const distDir = join(extDir, 'dist');
const storeDir = join(extDir, 'store');

async function renderIcons() {
  for (const size of [16, 48]) {
    await sharp(Buffer.from(MARK_SVG(size))).png().toFile(join(extDir, `icons/icon${size}.png`));
  }
  // Store rule: 96x96 artwork inside a 128x128 canvas.
  await sharp(Buffer.from(MARK_SVG(96)))
    .extend({ top: 16, bottom: 16, left: 16, right: 16, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(extDir, 'icons/icon128.png'));
}

const SAMPLE = `(() => {
  const now = Date.now(), H = 3600e3, F = now + 10 * H;
  return chrome.storage.local.set({
    privacyConsent: true,
    enabledServices: ['claude', 'copilot', 'codex', 'grok', 'gemini', 'cursor'],
    quotaStates: [
      { service: 'claude', sessionPct: 42, weeklyPct: 9, sessionResetsAt: now + 3*H - 60e3, weeklyResetsAt: now + 4*24*H - 60e3,
        subcategories: [{ name: 'Sonnet', usedPct: 71, label: '29% left' }, { name: 'Designs', usedPct: 20, label: '80% left' }], lastUpdated: F },
      { service: 'codex', sessionPct: 76, weeklyPct: 58, sessionResetsAt: now + 1*H + 44*60e3, weeklyResetsAt: now + 5*24*H - 60e3, lastUpdated: F },
      { service: 'copilot', honesty: 'seat_active_usage_unknown', lastUpdated: F },
      { service: 'grok', sessionPct: 88, weeklyPct: 64, sessionResetsAt: now + 48*60e3, weeklyResetsAt: now + 2*24*H + 4*H, lastUpdated: F },
      { service: 'gemini', sessionPct: 81, weeklyPct: 67, sessionResetsAt: now + 3*H + 12*60e3, weeklyResetsAt: now + 6*24*H + 7*H, lastUpdated: F },
      { service: 'cursor', monthlyPct: 4, monthlyResetsAt: now + 12*24*H, lastUpdated: F },
    ],
  });
})()`;

async function capturePanels(chrome) {
  const panelUrl = `chrome-extension://${chrome.extId}/src/sidepanel/index.html`;
  const out = join(storeDir, 'panels');
  mkdirSync(out, { recursive: true });

  await chrome.view(360, 720, 2, true);
  await chrome.open(panelUrl);
  await chrome.shot(join(out, 'welcome-dark.png'));

  await chrome.evaluate(SAMPLE);
  await sleep(1000);
  await chrome.shot(join(out, 'dashboard-dark.png'));
  await chrome.view(360, 720, 2, false);
  await sleep(300);
  await chrome.shot(join(out, 'dashboard-light.png'));

  await chrome.view(360, 720, 2, true);
  await chrome.evaluate(
    "[...document.querySelectorAll('button')].find((b) => b.textContent === 'Providers').click()",
  );
  await chrome.evaluate("document.querySelector(\"[aria-label='Show Grok']\").click()");
  await sleep(800);
  await chrome.shot(join(out, 'providers-dark.png'));
}

async function renderArt(chrome) {
  const artUrl = pathToFileURL(join(storeDir, 'art.html')).href;
  const sizes = {
    tile: [440, 280],
    marquee: [1400, 560],
    shot1: [1280, 800],
    shot2: [1280, 800],
    shot3: [1280, 800],
    shot4: [1280, 800],
    shot5: [1280, 800],
  };
  for (const [asset, [width, height]] of Object.entries(sizes)) {
    await chrome.view(width, height, 1, true);
    await chrome.open(`${artUrl}?asset=${asset}`);
    await chrome.evaluate(
      'new Promise((r) => { const t = setInterval(() => document.body.dataset.ready && (clearInterval(t), r()), 50); })',
    );
    await chrome.shot(join(storeDir, `${asset}.png`));
  }
}

await renderIcons();
const chrome = await launchChrome({ extensionDir: distDir });
try {
  await capturePanels(chrome);
  await renderArt(chrome);
} finally {
  await chrome.close();
}
