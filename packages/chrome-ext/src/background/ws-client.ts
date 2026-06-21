import type { QuotaState, WsMessage } from '@ai-quota-tool/core';

const WS_URL = 'ws://localhost:54321';

let socket: WebSocket | null = null;

function connect(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(WS_URL);

  socket.addEventListener('close', () => {
    socket = null;
    // No setTimeout — MV3 service workers lose heap on suspension, killing any timer.
    // Reconnect is driven by chrome.alarms in worker.ts (WS_KEEPALIVE_ALARM).
  });

  socket.addEventListener('error', () => {
    // close event will follow; suppress unhandled error
  });
}

export function initWsClient(): void {
  connect();
}

export function pushQuotaUpdate(states: QuotaState[]): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const msg: WsMessage = { type: 'quota_update', payload: states };
  socket.send(JSON.stringify(msg));
}

export function sendPing(): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  const msg: WsMessage = { type: 'ping' };
  socket.send(JSON.stringify(msg));
}
