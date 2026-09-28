/**
 * Packs packages/chrome-ext/dist into the zip for the Chrome Web Store upload.
 * manifest.json sits at the zip root. Source maps stay out.
 *
 * Run: pnpm --filter @ai-quota-tool/chrome-ext build && node scripts/chrome-zip.mjs
 * Output: packages/chrome-ext/ai-quota-tool-chrome-<version>.zip
 */

import { createWriteStream, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import yazl from 'yazl';
import { root } from './asset-kit.mjs';

const extDir = join(root, 'packages/chrome-ext');
const distDir = join(extDir, 'dist');
const { version } = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'));
const out = join(extDir, `ai-quota-tool-chrome-${version}.zip`);

const zip = new yazl.ZipFile();
for (const name of readdirSync(distDir, { recursive: true })) {
  const path = join(distDir, name);
  if (statSync(path).isDirectory() || name.endsWith('.map')) continue;
  zip.addFile(path, relative(distDir, path).split(sep).join('/'));
}
zip.outputStream.pipe(createWriteStream(out)).on('close', () => console.log('wrote', relative(root, out)));
zip.end();
