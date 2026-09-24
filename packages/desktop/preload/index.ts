// packages/desktop/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron';

// ============================================
// CHANNEL WHITELISTS
// ============================================
//
// Three separate lists because each IPC style has a different shape
// of consumer. Mixing them causes preload leaks where a listener
// channel is also reachable via `invoke`, which encourages code
// that doesn't match the main-process handler.

/** Request/response channels reachable via `invoke`. */
const INVOKE_CHANNELS = [
  // App info
  'get-version',
  'get-env',
  'get-system-info',

  // Store
  'get-store-value',
  'set-store-value',
  'get-store-all',
  'clear-store',

  // Files
  'open-external',
  'show-save-dialog',
  'show-open-dialog',
  'read-file',
  'write-file',

  // Print
  'print',
  'print-pdf',

  // App control
  'reload-app',
  'toggle-dev-tools',

  // Sync
  'sync:start',
  'sync:status',
  'sync:set-token',
  'sync:clear-token',
  'sync:toggle-auto',
  'sync:set-interval',
  'sync:get-logs',
  'sync:clear-logs',

  // Offline queue
  'queue:get-pending',
  'queue:get-failed',
  'queue:retry',
  'queue:retry-all',
  'queue:clear-completed',
  'queue:clear-all',

  // Local DB
  'db:get-products',
  'db:get-sales',
  'db:get-customers',

  // Network
  'network:status',

  // Scanner
  'scanner:list-devices',
  'scanner:request-device',
  'scanner:connect',
  'scanner:disconnect',
  'scanner:status',
] as const;

/** Fire-and-forget channels reachable via `send`. */
const SEND_CHANNELS = [
  'window-control',
  'navigate',
] as const;

/** Push channels the renderer may subscribe to via `on`. */
const ON_CHANNELS = [
  'navigate',
  // Scanner events from the main process:
  //   scanner:data             → { deviceId, chunk }
  //   scanner:disconnect-event → { deviceId }
  'scanner:data',
  'scanner:disconnect-event',
] as const;

function isInvokeChannel(channel: string): boolean {
  return (INVOKE_CHANNELS as readonly string[]).includes(channel);
}
function isSendChannel(channel: string): boolean {
  return (SEND_CHANNELS as readonly string[]).includes(channel);
}
function isOnChannel(channel: string): boolean {
  return (ON_CHANNELS as readonly string[]).includes(channel);
}

// ============================================
// CONTEXT BRIDGE
// ============================================

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    /**
     * Fire-and-forget. Main-process handlers registered with
     * `ipcMain.on(...)` receive this.
     */
    send: (channel: string, data: any) => {
      if (!isSendChannel(channel)) {
        console.warn(`[preload] send blocked on channel: ${channel}`);
        return;
      }
      ipcRenderer.send(channel, data);
    },

    /**
     * Subscribe to a push channel. Returns an unsubscribe function so
     * callers don't have to keep the listener reference around.
     *
     * The current `@pos/scanner` proxy expects `on` to return nothing
     * and calls `removeListener` separately. Both shapes work: this
     * function returns the unsubscribe AND stores the wrapped listener
     * under it so `removeListener` can find it.
     */
    on: (
      channel: string,
      listener: (...args: any[]) => void,
    ): (() => void) => {
      if (!isOnChannel(channel)) {
        console.warn(`[preload] on blocked on channel: ${channel}`);
        return () => {};
      }

      // Strip the IPC event object; deliver only the payload.
      const wrapped = (_event: unknown, ...args: any[]) => {
        try {
          listener(...args);
        } catch (err) {
          console.error(
            `[preload] listener on ${channel} threw:`,
            err,
          );
        }
      };

      ipcRenderer.on(channel, wrapped);

      // Stash the wrapper on the listener so `removeListener` can find
      // it. WeakMap would be cleaner but the listener identity must be
      // stable across the pair, and a Symbol property is enough.
      try {
        (listener as any).__wrapped = wrapped;
      } catch {
        /* frozen listener — fall back to the returned unsubscribe */
      }

      return () => {
        ipcRenderer.removeListener(channel, wrapped);
        try {
          delete (listener as any).__wrapped;
        } catch {
          /* ignore */
        }
      };
    },

    /**
     * Unsubscribe from a push channel. Pair this with `on`.
     *
     * If the listener was passed to `on`, we look up the wrapper we
     * stored there and remove that. If the caller passes a bare
     * function that was never wrapped, we do nothing rather than throw,
     * so a race in teardown doesn't crash the renderer.
     */
    removeListener: (
      channel: string,
      listener: (...args: any[]) => void,
    ) => {
      if (!isOnChannel(channel)) return;
      const wrapped = (listener as any)?.__wrapped;
      if (typeof wrapped === 'function') {
        ipcRenderer.removeListener(channel, wrapped);
        try {
          delete (listener as any).__wrapped;
        } catch {
          /* ignore */
        }
      }
    },

    /** Subscribe and auto-unsubscribe after the first event. */
    once: (
      channel: string,
      listener: (...args: any[]) => void,
    ): (() => void) => {
      if (!isOnChannel(channel)) {
        console.warn(`[preload] once blocked on channel: ${channel}`);
        return () => {};
      }
      const wrapped = (_event: unknown, ...args: any[]) => {
        try {
          listener(...args);
        } catch (err) {
          console.error(
            `[preload] once listener on ${channel} threw:`,
            err,
          );
        }
      };
      ipcRenderer.once(channel, wrapped);
      return () => ipcRenderer.removeListener(channel, wrapped);
    },

    /**
     * Request/response. Main-process handlers registered with
     * `ipcMain.handle(...)` service these.
     */
    invoke: (channel: string, ...args: any[]) => {
      if (!isInvokeChannel(channel)) {
        return Promise.reject(
          new Error(`Invalid channel: ${channel}`),
        );
      }
      return ipcRenderer.invoke(channel, ...args);
    },
  },

  process: {
    platform: process.platform,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      API_URL: process.env.API_URL,
      WS_URL: process.env.WS_URL,
    },
  },

  // Convenience wrappers kept for backwards compatibility.
  getVersion: () => ipcRenderer.invoke('get-version'),
  getEnv: () => ipcRenderer.invoke('get-env'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
});
