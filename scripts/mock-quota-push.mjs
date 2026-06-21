/**
 * Connects to the VS Code extension's WebSocket server on :54321 and pushes
 * realistic mock quota data — simulating what the Chrome extension would send.
 *
 * Usage:
 *   node scripts/mock-quota-push.mjs           # push once then keep pinging
 *   node scripts/mock-quota-push.mjs --loop    # push updated values every 10s
 *   node scripts/mock-quota-push.mjs --drain   # simulate quota draining in real time
 */

import { WebSocket } from 'ws';

const WS_URL = 'ws://127.0.0.1:54321';
const LOOP = process.argv.includes('--loop');
const DRAIN = process.argv.includes('--drain');

const now = Date.now();
const fiveHoursMs = 5 * 60 * 60 * 1000;
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

/** Build a fresh mock payload. Pass a tick (0–100) to simulate quota draining. */
function buildPayload(tick = 0) {
  return [
    {
      service: 'claude',
      sessionPct: Math.max(0, 72 - tick),
      weeklyPct: Math.max(0, 45 - Math.floor(tick / 3)),
      sessionResetsAt: now + fiveHoursMs - tick * 60_000,
      weeklyResetsAt: now + sevenDaysMs,
      subcategories: [
        {
          name: 'Sonnet',
          usedPct: Math.min(100, 28 + tick),
          label: `${Math.max(0, 72 - tick)}% left`,
        },
        {
          name: 'Designs',
          usedPct: Math.min(100, 55 + Math.floor(tick / 2)),
          label: `${Math.max(0, 45 - Math.floor(tick / 2))}% left`,
        },
        {
          name: 'Daily Routines',
          usedPct: Math.min(100, 10 + tick),
          label: `${Math.max(0, 90 - tick)}% left`,
        },
      ],
      lastUpdated: Date.now(),
    },
    {
      service: 'copilot',
      sessionPct: Math.max(0, 91 - tick),
      weeklyPct: Math.max(0, 88 - Math.floor(tick / 2)),
      sessionResetsAt: now + fiveHoursMs,
      weeklyResetsAt: now + sevenDaysMs,
      lastUpdated: Date.now(),
    },
    {
      service: 'codex',
      sessionPct: Math.max(0, 8 - Math.floor(tick / 5)),  // intentionally low to test amber warning
      weeklyPct: Math.max(0, 34 - tick),
      sessionResetsAt: now + 2 * 60 * 60 * 1000,
      weeklyResetsAt: now + sevenDaysMs,
      lastUpdated: Date.now(),
    },
  ];
}

function connect() {
  console.log(`Connecting to ${WS_URL} …`);

  const ws = new WebSocket(WS_URL);
  let tick = 0;
  let pingInterval;
  let loopInterval;

  ws.on('open', () => {
    console.log('Connected to VS Code extension WS server.\n');

    const push = () => {
      const payload = buildPayload(DRAIN ? tick : 0);
      const msg = JSON.stringify({ type: 'quota_update', payload });
      ws.send(msg);
      console.log(`[tick=${tick}] Pushed quota_update:`);
      payload.forEach((s) => {
        console.log(`  ${s.service.padEnd(8)} session=${s.sessionPct}%  weekly=${s.weeklyPct}%`);
      });
      console.log('');
      tick++;
    };

    // Always push immediately on connect
    push();

    // Keep-alive ping every 30s
    pingInterval = setInterval(() => {
      ws.send(JSON.stringify({ type: 'ping' }));
    }, 30_000);

    if (LOOP || DRAIN) {
      loopInterval = setInterval(push, DRAIN ? 3_000 : 10_000);
      console.log(DRAIN ? 'Drain mode: pushing every 3s.' : 'Loop mode: pushing every 10s.');
      console.log('Press Ctrl+C to stop.\n');
    } else {
      console.log('One-shot mode. Extension will keep showing the pushed data.');
      console.log('Run with --loop to push updates every 10s, or --drain to simulate quota draining.\n');
    }
  });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'pong') {
      process.stdout.write('.');
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    clearInterval(loopInterval);
    console.log('\nDisconnected. Retrying in 3s …');
    setTimeout(connect, 3_000);
  });

  ws.on('error', (err) => {
    // VS Code extension might not be running yet — suppress and retry
    if (err.code !== 'ECONNREFUSED') {
      console.error('WS error:', err.message);
    }
  });
}

connect();
