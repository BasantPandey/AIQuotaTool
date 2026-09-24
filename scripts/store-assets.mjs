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

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extDir = join(root, 'packages/chrome-ext');
const distDir = join(extDir, 'dist');
const storeDir = join(extDir, 'store');
const chromePath =
  process.env.CHROME_PATH ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : 'google-chrome');

const MARK_SVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6d7dff"/><stop offset="1" stop-color="#22d3ee"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="#12152a"/>
  <rect x="13" y="17" width="38" height="7" rx="3.5" fill="url(#g)"/>
  <rect x="13" y="29" width="27" height="7" rx="3.5" fill="url(#g)"/>
  <rect x="13" y="41" width="14" height="7" rx="3.5" fill="#f2b33d"/>
</svg>`;

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Headless Chrome with the unpacked extension, driven over the DevTools protocol. */
async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'aq-store-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--headless=new',
      '--enable-unsafe-extension-debugging',
      '--remote-debugging-pipe',
      '--allow-file-access-from-files',
      '--hide-scrollbars',
      '--no-first-run',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  );

  // Extensions.loadUnpacked is only on the pipe transport. Messages end with NUL.
  const loaded = new Promise((resolveLoad, reject) => {
    let buf = '';
    chrome.stdio[4].on('data', (chunk) => {
      buf += chunk.toString();
      for (let i = buf.indexOf('\0'); i >= 0; i = buf.indexOf('\0')) {
        const msg = JSON.parse(buf.slice(0, i));
        buf = buf.slice(i + 1);
        if (msg.id === 1) (msg.error ? reject(new Error(msg.error.message)) : resolveLoad(msg.result.id));
      }
    });
  });
  chrome.stdio[3].write(`${JSON.stringify({ id: 1, method: 'Extensions.loadUnpacked', params: { path: distDir } })}\0`);
  const extId = await loaded;

  let page;
  for (let i = 0; i < 40 && !page; i++) {
    try {
      page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
    } catch {
      await sleep(250);
    }
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  });
  const send = (method, params = {}) =>
    new Promise((r) => {
      const id = ++nextId;
      pending.set(id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description);
    return res.result?.result?.value;
  };

  return {
    extId,
    evaluate,
    async view(width, height, scale, dark) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
      await send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }],
      });
    },
    async open(url) {
      await send('Page.enable');
      await send('Page.navigate', { url });
      await sleep(1200);
    },
    async shot(path) {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(res.result.data, 'base64'));
      console.log('wrote', path.replace(root, '.'));
    },
    async close() {
      ws.close();
      const exited = new Promise((r) => chrome.once('exit', r));
      chrome.kill();
      await exited;
      rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    },
  };
}

const SAMPLE = `(() => {
  const now = Date.now(), H = 3600e3, F = now + 10 * H;
  return chrome.storage.local.set({
    privacyConsent: true,
    enabledServices: ['claude', 'copilot', 'codex', 'grok', 'cursor'],
    quotaStates: [
      { service: 'claude', sessionPct: 42, weeklyPct: 9, sessionResetsAt: now + 3*H - 60e3, weeklyResetsAt: now + 4*24*H - 60e3,
        subcategories: [{ name: 'Sonnet', usedPct: 71, label: '29% left' }, { name: 'Designs', usedPct: 20, label: '80% left' }], lastUpdated: F },
      { service: 'codex', sessionPct: 76, weeklyPct: 58, sessionResetsAt: now + 1*H + 44*60e3, weeklyResetsAt: now + 5*24*H - 60e3, lastUpdated: F },
      { service: 'copilot', honesty: 'seat_active_usage_unknown', lastUpdated: F },
      { service: 'grok', sessionPct: 88, weeklyPct: 64, sessionResetsAt: now + 48*60e3, weeklyResetsAt: now + 2*24*H + 4*H, lastUpdated: F },
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
const chrome = await launchChrome();
try {
  await capturePanels(chrome);
  await renderArt(chrome);
} finally {
  await chrome.close();
}
