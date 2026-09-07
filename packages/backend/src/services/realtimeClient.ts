// src/services/realtimeClient.ts
class RealtimeClient {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;

  connect(businessUnitId: string, token: string) {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'}/ws?businessUnitId=${businessUnitId}&token=${token}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.notifySubscribers(data.type, data.payload);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect(businessUnitId, token);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  subscribe(eventType: string, callback: Function, businessUnitId?: string) {
    const key = `${eventType}:${businessUnitId || 'all'}`;
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
  }

  unsubscribe(eventType: string, callback: Function, businessUnitId?: string) {
    const key = `${eventType}:${businessUnitId || 'all'}`;
    this.subscribers.get(key)?.delete(callback);
  }

  disconnect() {
    this.ws?.close();
  }

  private notifySubscribers(eventType: string, payload: any) {
    // Notify specific subscribers
    this.subscribers.forEach((callbacks, key) => {
      if (key.startsWith(eventType)) {
        callbacks.forEach(callback => callback(payload));
      }
    });
  }

  private reconnect(businessUnitId: string, token: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
        this.connect(businessUnitId, token);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }
}

export const realtimeClient = new RealtimeClient();
