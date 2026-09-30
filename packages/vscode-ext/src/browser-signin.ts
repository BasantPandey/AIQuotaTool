// Two-phase browser sign-in (research #85, spec section 3). No new dependency.
// Phase 1: a plain Chrome or Edge window with a new profile and NO debug flag, so Google sign-in works.
// Phase 2: the same profile, headless, with --remote-debugging-pipe. It reads only the named cookies
// with Storage.getCookies from about:blank, so it makes no request to the provider.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

export interface CookieTarget {
  /** Host of the cookies, for example "claude.ai". A cookie on this host or a subdomain matches. */
  host: string;
  /** Cookie names to read. Nothing else leaves the profile. */
  names: readonly string[];
  /** localStorage keys to read instead of cookies (Windsurf). Phase 2 still makes no network request. */
  localStorage?: { origin: string; keys: readonly string[] };
}

export interface CdpCookie {
  name: string;
  value: string;
  domain: string;
}

/** Only the named cookies on the target host. */
export function pickCookies(cookies: readonly CdpCookie[], target: CookieTarget): Record<string, string> {
  const onHost = (domain: string) => {
    const d = domain.replace(/^\./, '');
    return d === target.host || d.endsWith(`.${target.host}`);
  };
  const out: Record<string, string> = {};
  for (const c of cookies) {
    if (target.names.includes(c.name) && onHost(c.domain) && c.value) out[c.name] = c.value;
  }
  return out;
}

/** Split a CDP pipe buffer into messages. Each message ends with a NUL byte. */
export function splitFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split('\0');
  return { frames: parts.slice(0, -1), rest: parts[parts.length - 1] ?? '' };
}

/** Chrome first, then Edge (spec 3.4). */
export function browserCandidates(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  if (platform === 'win32') {
    const roots = [env.LOCALAPPDATA, env.PROGRAMFILES, env['PROGRAMFILES(X86)']].filter((r): r is string => !!r);
    return [
      ...roots.map((r) => join(r, 'Google', 'Chrome', 'Application', 'chrome.exe')),
      ...roots.map((r) => join(r, 'Microsoft', 'Edge', 'Application', 'msedge.exe')),
    ];
  }
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return [
    '/opt/google/chrome/chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/microsoft/msedge/msedge',
    '/usr/bin/microsoft-edge',
  ];
}

/** The browser to start: the setting when it is a path, else the first installed candidate. */
export function findBrowser(setting: string): string | undefined {
  if (setting && setting !== 'auto') return existsSync(setting) ? setting : undefined;
  return browserCandidates(process.platform, process.env).find((p) => existsSync(p));
}

const BASE_FLAGS = ['--no-first-run', '--no-default-browser-check'];
/** Phase 2 needs nothing from the network. These flags stop background requests. */
const QUIET_FLAGS = ['--disable-background-networking', '--disable-component-update', '--disable-sync'];

function exited(child: ChildProcess, ms: number): Promise<boolean> {
  if (child.exitCode != null || child.signalCode != null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/**
 * Close gracefully, so the browser writes its cookies to disk. Windows: taskkill with no /F.
 * macOS and Linux: SIGTERM. Force it only when the browser does not close in 15 s.
 */
async function closeGracefully(child: ChildProcess): Promise<void> {
  if (child.exitCode != null || child.pid == null) return;
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid)], { stdio: 'ignore' });
  else child.kill('SIGTERM');
  if (await exited(child, 15_000)) return;
  if (process.platform === 'win32') spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGKILL');
  await exited(child, 5_000);
}

/** Phase 2: read cookies over the debug pipe. No port opens, and no page of the site loads. */
async function readCookies(browser: string, profile: string, target: CookieTarget): Promise<Record<string, string>> {
  const child = spawn(
    browser,
    [`--user-data-dir=${profile}`, ...BASE_FLAGS, ...QUIET_FLAGS, '--headless', '--remote-debugging-pipe', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
  );
  const write = child.stdio[3] as NodeJS.WritableStream;
  const read = child.stdio[4] as NodeJS.ReadableStream;
  type Message = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: unknown };
  const pending = new Map<number, (msg: Message) => void>();
  const events: ((msg: Message) => void)[] = [];
  let buffer = '';
  read.setEncoding('utf8');
  read.on('data', (chunk: string) => {
    const { frames, rest } = splitFrames(buffer + chunk);
    buffer = rest;
    for (const frame of frames) {
      const msg = JSON.parse(frame) as Message;
      if (msg.id != null) {
        pending.get(msg.id)?.(msg);
        pending.delete(msg.id);
      } else {
        for (const listener of events) listener(msg);
      }
    }
  });
  let id = 0;
  const call = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
    new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`The browser did not answer ${method}.`)), 15_000);
      pending.set(++id, (msg) => {
        clearTimeout(timer);
        if (msg.error) reject(new Error(`The browser refused ${method}.`));
        else resolve(msg.result);
      });
      write.write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    });
  try {
    if (target.localStorage) return await readLocalStorage(call, events, target.localStorage);
    const result = (await call('Storage.getCookies')) as { cookies?: CdpCookie[] };
    return pickCookies(result.cookies ?? [], target);
  } finally {
    await call('Browser.close').catch(() => undefined);
    if (!(await exited(child, 5_000))) child.kill();
  }
}

type CdpCall = (method: string, params?: Record<string, unknown>, sessionId?: string) => Promise<unknown>;
type CdpEvent = { method?: string; params?: Record<string, unknown>; sessionId?: string };

/**
 * localStorage needs a page at the origin. The browser answers the page request itself with an empty
 * page (Fetch.fulfillRequest), so the site gets no request and none of its scripts run (research #85).
 */
async function readLocalStorage(
  call: CdpCall,
  events: ((msg: CdpEvent) => void)[],
  source: { origin: string; keys: readonly string[] },
): Promise<Record<string, string>> {
  const { targetId } = (await call('Target.createTarget', { url: 'about:blank' })) as { targetId: string };
  const { sessionId } = (await call('Target.attachToTarget', { targetId, flatten: true })) as { sessionId: string };
  const loaded = new Promise<void>((resolve) => {
    events.push((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Fetch.requestPaused') {
        void call(
          'Fetch.fulfillRequest',
          { requestId: msg.params?.requestId, responseCode: 200, body: Buffer.from('<!doctype html><title></title>').toString('base64') },
          sessionId,
        ).catch(() => undefined);
      }
      if (msg.method === 'Page.loadEventFired') resolve();
    });
  });
  await call('Page.enable', {}, sessionId);
  await call('Fetch.enable', { patterns: [{ urlPattern: `${source.origin}/*` }] }, sessionId);
  await call('Page.navigate', { url: `${source.origin}/__aiq_stub` }, sessionId);
  await Promise.race([loaded, new Promise((_, reject) => setTimeout(() => reject(new Error('The stub page did not load.')), 15_000))]);
  const { entries } = (await call(
    'DOMStorage.getDOMStorageItems',
    { storageId: { storageKey: `${source.origin}/`, isLocalStorage: true } },
    sessionId,
  )) as { entries: [string, string][] };
  return Object.fromEntries(entries.filter(([key, value]) => source.keys.includes(key) && value));
}

/** Windows keeps file locks for a moment after the browser exits. Try again a few times. */
async function removeProfile(profile: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    try {
      await rm(profile, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}

export interface SignInOptions {
  browser: string;
  /** A folder that the extension owns. The profile is a new folder in it. */
  storageDir: string;
  startUrl: string;
  target: CookieTarget;
  /**
   * Resolves when the user clicks Done ('done') or Cancel ('cancel').
   * `browserClosed` resolves when the user closes the browser, which also counts as Done.
   */
  waitForUser: (browserClosed: Promise<void>) => Promise<'done' | 'cancel'>;
}

/**
 * Runs both phases. Returns the named cookies, or null on cancel. The profile folder is deleted
 * in every case: after the read, on error, and on cancel. Values never go to a log or an error.
 */
export async function browserSignIn(options: SignInOptions): Promise<Record<string, string> | null> {
  const profile = join(options.storageDir, `signin-${randomUUID()}`);
  await mkdir(profile, { recursive: true });
  let window: ChildProcess | null = null;
  try {
    window = spawn(options.browser, [`--user-data-dir=${profile}`, ...BASE_FLAGS, '--new-window', options.startUrl], {
      stdio: 'ignore',
    });
    const started = window;
    const failedToStart = new Promise<never>((_, reject) =>
      started.once('error', () => reject(new Error('The browser did not start. Check the aiQuotaTool.browserPath setting.'))),
    );
    const closed = new Promise<void>((resolve) => started.once('exit', () => resolve()));
    const answer = await Promise.race([options.waitForUser(closed), failedToStart]);
    await closeGracefully(started);
    if (answer === 'cancel') return null;
    return await readCookies(options.browser, profile, options.target);
  } finally {
    if (window) await closeGracefully(window);
    await removeProfile(profile);
  }
}
