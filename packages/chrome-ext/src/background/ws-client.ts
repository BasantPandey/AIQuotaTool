import type { QuotaState, WsMessage } from '@ai-quota-tool/core';

const WS_URL = 'ws://localhost:54321';
const RECONNECT_DELAY_MS = 5_000;

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(WS_URL);

  socket.addEventListener('open', () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });

  socket.addEventListener('close', () => {
    socket = null;
    // Attempt reconnect — VS Code may not be open yet
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
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
