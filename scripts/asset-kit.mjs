/** Shared pieces for the store and Marketplace art scripts. */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const chromePath =
  process.env.CHROME_PATH ??
  (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : 'google-chrome');

/** The brand mark: three bars, like quota left. */
export const MARK_SVG = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6d7dff"/><stop offset="1" stop-color="#22d3ee"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="#12152a"/>
  <rect x="13" y="17" width="38" height="7" rx="3.5" fill="url(#g)"/>
  <rect x="13" y="29" width="27" height="7" rx="3.5" fill="url(#g)"/>
  <rect x="13" y="41" width="14" height="7" rx="3.5" fill="#f2b33d"/>
</svg>`;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

/** Module scripts do not load from file:// URLs, so serve the repo over http. */
export function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(root)) return res.writeHead(403).end();
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Headless Chrome driven over the DevTools protocol. Loads an unpacked extension when you give one. */
export async function launchChrome({ extensionDir } = {}) {
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
  const loaded = extensionDir == null ? Promise.resolve(undefined) : new Promise((resolveLoad, reject) => {
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
  if (extensionDir != null) {
    chrome.stdio[3].write(`${JSON.stringify({ id: 1, method: 'Extensions.loadUnpacked', params: { path: extensionDir } })}\0`);
  }
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
    async frame() {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      return Buffer.from(res.result.data, 'base64');
    },
    async shot(path) {
      writeFileSync(path, await this.frame());
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
