import { WebSocketServer, WebSocket } from 'ws';
import type { QuotaState, WsMessage } from '@ai-quota-tool/core';

const PORT = 54321;

type StateChangeListener = (states: QuotaState[]) => void;
type DisconnectListener = () => void;

export class QuotaWsServer {
  private wss: WebSocketServer | null = null;
  private latestStates: QuotaState[] = [];
  private listeners: Set<StateChangeListener> = new Set();
  private disconnectListeners: Set<DisconnectListener> = new Set();
  private connectionCount = 0;

  start(): void {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port: PORT });

    this.wss.on('connection', (ws: WebSocket) => {
      this.connectionCount++;

      ws.on('close', () => {
        this.connectionCount--;
        if (this.connectionCount === 0) {
          this.disconnectListeners.forEach((fn) => fn());
        }
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString()) as WsMessage;
          this.handleMessage(ws, msg);
        } catch {
          // ignore malformed messages
        }
      });
    });

    this.wss.on('error', (err) => {
      console.error('[ai-quota-tool] WS server error:', err.message);
    });
  }

  stop(): void {
    this.wss?.close();
    this.wss = null;
  }

  onStateChange(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onDisconnect(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  getLatestStates(): QuotaState[] {
    return this.latestStates;
  }

  private handleMessage(ws: WebSocket, msg: WsMessage): void {
    switch (msg.type) {
      case 'ping': {
        const pong: WsMessage = { type: 'pong' };
        ws.send(JSON.stringify(pong));
        break;
      }
      case 'quota_update': {
        this.latestStates = msg.payload;
        this.listeners.forEach((fn) => fn(this.latestStates));
        break;
      }
      default:
        break;
    }
  }
}
