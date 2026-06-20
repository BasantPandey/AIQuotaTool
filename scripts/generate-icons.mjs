/**
 * Generates PNG icons for the Chrome extension and VS Code extension.
 * Design: dark circle, dual-ring quota meter, lightning bolt centre.
 * Run: node scripts/generate-icons.mjs
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function buildSvg(size) {
  const cx = size / 2;
  const strokeOuter = size * 0.07;
  const strokeInner = size * 0.055;
  const rOuter = cx - strokeOuter / 2 - size * 0.04;
  const rInner = rOuter - strokeOuter / 2 - strokeInner / 2 - size * 0.03;

  // Arc helpers — draw a circular arc as an SVG path
  function arcPath(r, startDeg, endDeg) {
    const toRad = (d) => ((d - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cx + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cx + r * Math.sin(toRad(endDeg));
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  }

  // Outer ring: 75% fill (session) — blue
  const outerArc = arcPath(rOuter, 0, 270);
  // Inner ring: 30% fill (weekly) — amber/orange warning
  const innerArc = arcPath(rInner, 0, 108);

  // Lightning bolt scaled to centre
  const boltScale = size * 0.18;
  const bx = cx - boltScale * 0.5;
  const by = cx - boltScale * 0.72;
  const boltPath = `
    M ${bx + boltScale * 0.62} ${by}
    L ${bx + boltScale * 0.18} ${by + boltScale * 0.52}
    L ${bx + boltScale * 0.5}  ${by + boltScale * 0.52}
    L ${bx + boltScale * 0.38} ${by + boltScale * 1.0}
    L ${bx + boltScale * 0.82} ${by + boltScale * 0.48}
    L ${bx + boltScale * 0.5}  ${by + boltScale * 0.48}
    Z
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="gOuter" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
    <linearGradient id="gInner" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="${cx}" cy="${cx}" r="${cx - 1}" fill="#0d1117" stroke="#1f2937" stroke-width="${size * 0.02}"/>

  <!-- Outer ring track -->
  <circle cx="${cx}" cy="${cx}" r="${rOuter}" fill="none"
    stroke="#1f2937" stroke-width="${strokeOuter}" stroke-linecap="round"/>

  <!-- Outer ring fill (session: 75%) -->
  <path d="${outerArc}" fill="none"
    stroke="url(#gOuter)" stroke-width="${strokeOuter}" stroke-linecap="round"/>

  <!-- Inner ring track -->
  <circle cx="${cx}" cy="${cx}" r="${rInner}" fill="none"
    stroke="#1f2937" stroke-width="${strokeInner}" stroke-linecap="round"/>

  <!-- Inner ring fill (weekly: 30%) -->
  <path d="${innerArc}" fill="none"
    stroke="url(#gInner)" stroke-width="${strokeInner}" stroke-linecap="round"/>

  <!-- Lightning bolt -->
  <path d="${boltPath}" fill="white" opacity="0.95"/>
</svg>`;
}

const targets = [
  { size: 16,  dest: 'packages/chrome-ext/icons/icon16.png' },
  { size: 48,  dest: 'packages/chrome-ext/icons/icon48.png' },
  { size: 128, dest: 'packages/chrome-ext/icons/icon128.png' },
  { size: 128, dest: 'packages/vscode-ext/icons/icon128.png' },
];

for (const { size, dest } of targets) {
  const outPath = resolve(root, dest);
  mkdirSync(resolve(outPath, '..'), { recursive: true });

  await sharp(Buffer.from(buildSvg(size)))
    .png()
    .toFile(outPath);

  console.log(`✓ ${dest} (${size}×${size})`);
}

console.log('\nIcons generated successfully.');
