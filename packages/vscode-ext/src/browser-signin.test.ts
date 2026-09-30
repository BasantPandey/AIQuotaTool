import { describe, expect, it } from 'vitest';
import { browserCandidates, pickCookies, splitFrames } from './browser-signin.js';

describe('pickCookies', () => {
  const target = { host: 'claude.ai', names: ['sessionKey'] };

  it('reads only the named cookie on the target host', () => {
    const cookies = [
      { name: 'sessionKey', value: 'sk-ant-1', domain: '.claude.ai' },
      { name: 'cf_clearance', value: 'x', domain: '.claude.ai' },
      { name: 'sessionKey', value: 'other-site', domain: 'evil-claude.ai' },
    ];
    expect(pickCookies(cookies, target)).toEqual({ sessionKey: 'sk-ant-1' });
  });

  it('matches a subdomain and ignores an empty value', () => {
    expect(pickCookies([{ name: 'sessionKey', value: 'v', domain: 'www.claude.ai' }], target)).toEqual({ sessionKey: 'v' });
    expect(pickCookies([{ name: 'sessionKey', value: '', domain: 'claude.ai' }], target)).toEqual({});
  });
});

describe('splitFrames', () => {
  it('splits on NUL and keeps the part after the last NUL', () => {
    expect(splitFrames('{"id":1}\0{"id":2}\0{"id"')).toEqual({ frames: ['{"id":1}', '{"id":2}'], rest: '{"id"' });
    expect(splitFrames('')).toEqual({ frames: [], rest: '' });
  });
});

describe('browserCandidates', () => {
  it('Windows: Chrome paths first, then Edge', () => {
    const list = browserCandidates('win32', { LOCALAPPDATA: 'L', PROGRAMFILES: 'P' });
    expect(list[0]).toMatch(/chrome\.exe$/);
    expect(list.at(-1)).toMatch(/msedge\.exe$/);
    const firstEdge = list.findIndex((p) => p.endsWith('msedge.exe'));
    expect(list.slice(firstEdge).every((p) => p.endsWith('msedge.exe'))).toBe(true);
  });
});
