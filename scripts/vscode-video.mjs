/**
 * Records the VS Code promo video: install, sign in, see the quota.
 * Opens packages/vscode-ext/docs/shots/promo.html in headless Chrome, renders each frame, and pipes it to ffmpeg.
 * Writes packages/vscode-ext/docs/promo.mp4 (1920x1080, 30 fps).
 *
 * Run: pnpm --filter ai-quota-tool-vscode build && node scripts/vscode-video.mjs
 * Check single frames first: node scripts/vscode-video.mjs --stills 2,9.5,20 (writes promo-<t>.png to the OS temp folder).
 * Needs Google Chrome and ffmpeg on the PATH.
 */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChrome, MARK_SVG, root, serve } from './asset-kit.mjs';

const FPS = 30;
const out = join(root, 'packages/vscode-ext/docs/promo.mp4');
const stillsArg = process.argv.indexOf('--stills');
const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(',').map(Number) : null;

const server = await serve();
const chrome = await launchChrome();
try {
  await chrome.view(1920, 1080, 1, true);
  await chrome.open(`http://127.0.0.1:${server.address().port}/packages/vscode-ext/docs/shots/promo.html`);
  const duration = await chrome.evaluate(`(async () => {
    setMark(${JSON.stringify(MARK_SVG(128))});
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode()));
    while (!document.getElementById('panel').contentDocument?.querySelector('.tabs')) await new Promise((r) => setTimeout(r, 50));
    return DURATION;
  })()`);

  if (stills) {
    // Frames depend on earlier frames (the panel state), so render up to each still in order.
    let f = 0;
    for (const t of stills.sort((a, b) => a - b)) {
      for (; f / FPS < t; f++) await chrome.evaluate(`render(${f / FPS})`);
      await chrome.evaluate(`render(${t})`);
      const path = join(tmpdir(), `promo-${t}.png`);
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
