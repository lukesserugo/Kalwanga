// src/websocket/client.ts
import { realtimeService } from '../services/realtimeService.js';

export function initializeWebSocket(server: any) {
  realtimeService.initialize(server);
  console.log('WebSocket initialized');
}
