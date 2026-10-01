/**
 * Builds the VS Code extension icon and the Marketplace screenshots.
 * 1. Renders the brand mark to packages/vscode-ext/icons/icon128.png.
 * 2. Serves the repo on localhost and opens docs/shots/frame.html in headless Chrome.
 *    The frame hosts the real built webviews (dist/webview) with sample data.
 * 3. Writes packages/vscode-ext/docs/*.png at 2x.
 *
 * Run: pnpm --filter ai-quota-tool-vscode build && node scripts/vscode-assets.mjs
 * Needs Google Chrome. Set CHROME_PATH if it is not in the default place.
 */

import { join } from 'node:path';
import sharp from 'sharp';
import { launchChrome, MARK_SVG, root, serve } from './asset-kit.mjs';

const extDir = join(root, 'packages/vscode-ext');
const docsDir = join(extDir, 'docs');

const SHOTS = [
  { name: 'dashboard-dark', shot: 'split', theme: 'dark' },
  { name: 'dashboard-light', shot: 'split', theme: 'light' },
  { name: 'dashboard-wide', shot: 'full', theme: 'dark' },
  { name: 'setup-accounts', shot: 'setup', theme: 'dark' },
];

await sharp(Buffer.from(MARK_SVG(128))).png().toFile(join(extDir, 'icons/icon128.png'));
console.log('wrote ./packages/vscode-ext/icons/icon128.png');

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/packages/vscode-ext/docs/shots/frame.html`;
const chrome = await launchChrome();
try {
  for (const { name, shot, theme } of SHOTS) {
    await chrome.view(1280, 800, 2, theme === 'dark');
    await chrome.open(`${base}?shot=${shot}&theme=${theme}`);
    await chrome.evaluate(
      'new Promise((r) => { const t = setInterval(() => document.body.dataset.ready && (clearInterval(t), r()), 50); })',
    );
    await chrome.shot(join(docsDir, `${name}.png`));
  }
} finally {
  await chrome.close();
  server.close();
}
