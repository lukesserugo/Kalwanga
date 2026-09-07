// D:\Projects\Kalwanga\packages\web\services\realtimeService.ts
import { io, Socket } from 'socket.io-client';

class RealtimeService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Initialize WebSocket connection
   */
  initialize(token?: string): void {
    const socketUrl = process.env.REACT_APP_WS_URL || window.location.origin;

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    // Listen for all events
    this.socket.onAny((event, data) => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(callback => callback(data));
      }
    });
  }

  /**
   * Join a business unit room
   */
  joinBusiness(businessUnitId: string): void {
    if (this.socket) {
      this.socket.emit('join-business', businessUnitId);
    }
  }

  /**
   * Leave a business unit room
   */
  leaveBusiness(businessUnitId: string): void {
    if (this.socket) {
      this.socket.emit('leave-business', businessUnitId);
    }
  }

  /**
   * Join a user room
   */
  joinUser(userId: string): void {
    if (this.socket) {
      this.socket.emit('join-user', userId);
    }
  }

  /**
   * Leave a user room
   */
  leaveUser(userId: string): void {
    if (this.socket) {
      this.socket.emit('leave-user', userId);
    }
  }

  /**
   * Listen for an event
   */
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Emit an event
   */
  emit(event: string, data: any): void {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Ping check
   */
  ping(): Promise<{ timestamp: Date }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('WebSocket not initialized'));
        return;
      }
      this.socket.emit('ping-check', () => {
        resolve({ timestamp: new Date() });
      });
      setTimeout(() => reject(new Error('Ping timeout')), 5000);
    });
  }
}

export const realtimeService = new RealtimeService();
