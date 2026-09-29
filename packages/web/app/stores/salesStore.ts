// D:\Projects\Kalwanga\packages\web\services\realtime.ts

import { io, type Socket } from 'socket.io-client';

// ============================================
// CONNECTION
// ============================================

const REALTIME_URL =
  process.env.NEXT_PUBLIC_REALTIME_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001';

type EventHandler = (payload: unknown) => void;

interface Subscription {
  event: string;
  businessUnitId: string;
  handler: EventHandler;
}

class RealtimeClient {
  private socket: Socket | null = null;
  private subscriptions = new Set<Subscription>();
  private connectPromise: Promise<Socket> | null = null;

  // ── Public API ──────────────────────────

  /**
   * Subscribe to an event for a business unit.
   *
   * Returns an unsubscribe function. Safe to call multiple times —
   * the socket is shared and torn down only when the last subscriber
   * unsubscribes.
   */
  subscribe(
    event: string,
    handler: EventHandler,
    businessUnitId: string,
  ): () => void {
    if (typeof window === 'undefined') {
      // Server-side render: there is no socket. Return a no-op so
      // callers can still run their cleanup logic unconditionally.
      return () => {};
    }

    const sub: Subscription = { event, businessUnitId, handler };
    this.subscriptions.add(sub);

    // Ensure the socket exists and is joined to the right room.
    void this.ensureConnected(businessUnitId).then((socket) => {
      // `socket.on` needs a stable reference to remove later.
      // Wrap the handler so we can remove exactly this sub.
      socket.on(event, sub.handler);

      // Join the business unit's room. If your backend uses a
      // different scoping mechanism (auth header, query param,
      // JWT claim), replace this emit with the appropriate call.
      socket.emit('join:businessUnit', businessUnitId);
    });

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;

      this.subscriptions.delete(sub);

      if (this.socket) {
        try {
          this.socket.off(event, sub.handler);
        } catch {
          /* socket already closed */
        }
      }

      // If nobody is left, close the socket to free the connection.
      if (this.subscriptions.size === 0 && this.socket) {
        try {
          this.socket.disconnect();
        } catch {
          /* ignore */
        }
        this.socket = null;
        this.connectPromise = null;
      }
    };
  }

  /**
   * Force-close the socket. Call on logout so no listener keeps
   * running against the previous tenant's room.
   */
  disconnect(): void {
    this.subscriptions.clear();
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch {
        /* ignore */
      }
      this.socket = null;
      this.connectPromise = null;
    }
  }

  // ── Internals ───────────────────────────

  private async ensureConnected(businessUnitId: string): Promise<Socket> {
    if (this.socket?.connected) return this.socket;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<Socket>((resolve, reject) => {
      try {
        // ── TRANSPORT ────────────────────────────────────────────
        // Replace this block if your backend uses a different
        // transport. The only requirement is that the resulting
        // `socket` has `.on`, `.off`, `.emit`, and `.disconnect`.
        const socket = io(REALTIME_URL, {
          transports: ['websocket'],
          withCredentials: true,
          auth: { businessUnitId },
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });
        // ── END TRANSPORT ───────────────────────────────────────

        socket.on('connect', () => {
          this.socket = socket;
          resolve(socket);
        });

        socket.on('connect_error', (err) => {
          this.connectPromise = null;
          reject(err);
        });

        // Re-join rooms on reconnect — socket.io drops rooms on
        // disconnect, so any active subscriptions need re-scoping.
        //
        // ⚠ `Array.from(new Set(...))` rather than `new Set(...)`
        //   followed by `for...of`. Iterating a `Set` directly
        //   requires `--downlevelIteration` or `target >= es2015`;
        //   this project's tsconfig does not set either. Materializing
        //   the Set to an array first keeps the dedupe while avoiding
        //   the compiler error.
        socket.on('reconnect', () => {
          const businessUnitIds = Array.from(
            new Set(
              Array.from(this.subscriptions).map(
                (s) => s.businessUnitId,
              ),
            ),
          );

          businessUnitIds.forEach((id) => {
            socket.emit('join:businessUnit', id);
          });
        });
      } catch (err) {
        this.connectPromise = null;
        reject(err);
      }
    });

    return this.connectPromise;
  }
}

export const realtimeClient = new RealtimeClient();
export default realtimeClient;
