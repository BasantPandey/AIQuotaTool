/**
 * Records a promo video. Opens a promo page in headless Chrome, renders each frame,
 * and pipes it to ffmpeg (1920x1080, 30 fps).
 *   (default)      VS Code promo.html      -> packages/vscode-ext/docs/promo.mp4: install, sign in, add a key, see the quota.
 *   --video keys   VS Code promo-keys.html -> packages/vscode-ext/docs/promo-keys.mp4: add API keys, set a budget, see the keys.
 *   --video chrome Chrome store/promo.html -> packages/chrome-ext/store/promo.mp4: search, add, pick providers, add keys, see the data.
 *
 * Run: build the extension of the video first, then node scripts/promo-video.mjs [--video keys|chrome]
 * Check single frames first: add --stills 2,9.5,20 (writes <name>-<t>.png to the OS temp folder).
 * Needs Google Chrome and ffmpeg on the PATH.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChrome, MARK_SVG, root, serve } from './asset-kit.mjs';

const FPS = 30;
// page: the promo page. ready: a selector in the panel iframe that shows the real panel is up.
const VIDEOS = {
  promo: { page: 'packages/vscode-ext/docs/shots/promo.html', out: 'packages/vscode-ext/docs/promo.mp4', ready: '.tabs' },
  keys: { page: 'packages/vscode-ext/docs/shots/promo-keys.html', out: 'packages/vscode-ext/docs/promo-keys.mp4', ready: '.tabs' },
  chrome: { page: 'packages/chrome-ext/store/promo.html', out: 'packages/chrome-ext/store/promo.mp4', ready: '.welcome' },
};
const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const name = arg('--video') ?? 'promo';
const video = VIDEOS[name];
if (!video) throw new Error(`Unknown --video ${name}. Use one of: ${Object.keys(VIDEOS).join(', ')}`);
const out = join(root, video.out);
const stills = arg('--stills')?.split(',').map(Number) ?? null;

const server = await serve();
const chrome = await launchChrome();
try {
  await chrome.view(1920, 1080, 1, true);
  await chrome.open(`http://127.0.0.1:${server.address().port}/${video.page}`);
  const duration = await chrome.evaluate(`(async () => {
    setMark(${JSON.stringify(MARK_SVG(128))});
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode()));
    while (!document.getElementById('panel').contentDocument?.querySelector(${JSON.stringify(video.ready)})) await new Promise((r) => setTimeout(r, 50));
    return DURATION;
  })()`);

  if (stills) {
    // Frames depend on earlier frames (the panel state), so render up to each still in order.
    let f = 0;
    for (const t of stills.sort((a, b) => a - b)) {
      for (; f / FPS < t; f++) await chrome.evaluate(`render(${f / FPS})`);
      await chrome.evaluate(`render(${t})`);
      const path = join(tmpdir(), `${name}-${t}.png`);
      writeFileSync(path, await chrome.frame());
      console.log('wrote', path);
    }
  } else {
    const ffmpeg = spawn(
      'ffmpeg',
      ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', `${FPS}`, '-c:v', 'png', '-i', '-',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    );
    const frames = Math.round(duration * FPS);
    for (let f = 0; f < frames; f++) {
      await chrome.evaluate(`render(${f / FPS})`);
      if (!ffmpeg.stdin.write(await chrome.frame())) await once(ffmpeg.stdin, 'drain');
      if (f % FPS === 0) process.stdout.write(`\r${f / FPS}s / ${duration}s`);
    }
    ffmpeg.stdin.end();
    const [code] = await once(ffmpeg, 'exit');
    if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
    console.log('\nwrote', out.replace(root, '.'));
  }
} finally {
  await chrome.close();
  server.close();
}
