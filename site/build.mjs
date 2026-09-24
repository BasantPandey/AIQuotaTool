/**
 * Builds the GitHub Pages site into site/_out.
 * - Copies index.html and the store art (single source: packages/chrome-ext/store).
 * - Renders PRIVACY.md to privacy.html, so the policy has one source.
 * Run: node site/build.mjs
 */

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(siteDir, '..');
const out = join(siteDir, '_out');
const store = join(root, 'packages/chrome-ext/store');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'img'), { recursive: true });

copyFileSync(join(siteDir, 'index.html'), join(out, 'index.html'));
const images = {
  'icon128.png': join(root, 'packages/chrome-ext/icons/icon128.png'),
  'marquee.png': join(store, 'marquee.png'),
  'panel-dark.png': join(store, 'panels/dashboard-dark.png'),
};
for (const n of [2, 3, 4, 5]) images[`shot${n}.png`] = join(store, `shot${n}.png`);
for (const [name, from] of Object.entries(images)) copyFileSync(from, join(out, 'img', name));

const escapeHtml = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const inline = (text) =>
  escapeHtml(text).replace(/https:\/\/[^\s)]+[^\s).,]/g, (url) => `<a href="${url}">${url}</a>`);

// ponytail: tiny Markdown subset (headings, bullets, paragraphs). PRIVACY.md uses nothing else.
function renderMarkdown(markdown) {
  const html = [];
  let list = false;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = /^(#{1,3}) (.*)$/.exec(line);
    const bullet = /^- (.*)$/.exec(line);
    if (!bullet && list) {
      html.push('</ul>');
      list = false;
    }
    if (heading) html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    else if (bullet) {
      if (!list) html.push('<ul>');
      list = true;
      html.push(`<li>${inline(bullet[1])}</li>`);
    } else if (line.trim() !== '') html.push(`<p>${inline(line)}</p>`);
  }
  if (list) html.push('</ul>');
  return html.join('\n');
}

const policy = renderMarkdown(readFileSync(join(root, 'PRIVACY.md'), 'utf8'));
writeFileSync(
  join(out, 'privacy.html'),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Privacy Policy - AI Quota Tool</title>
<link rel="icon" href="img/icon128.png" />
<style>
  body { margin: 0; background: #0b1026; color: #f3f5fb; font: 17px/1.65 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 24px 80px; }
  nav a { color: rgba(243, 245, 251, 0.72); text-decoration: none; }
  h1 { font-size: 40px; letter-spacing: -0.03em; margin: 32px 0 8px; }
  h2 { font-size: 22px; margin: 36px 0 8px; }
  p, li { color: rgba(243, 245, 251, 0.8); }
  a { color: #9fb3ff; }
</style>
</head>
<body>
<main>
<nav><a href="./">&larr; AI Quota Tool</a></nav>
${policy}
</main>
</body>
</html>
`,
);
console.log('site built in', out.replace(root, '.'));
