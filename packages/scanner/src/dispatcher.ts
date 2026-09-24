// packages/scanner/src/dispatcher.ts

import EventEmitter from 'eventemitter3';
import type {
  ScanEvent,
  ScanListener,
  ScanTransport,
  TransportAdapter,
} from './types';

const DEBOUNCE_MS = 250;

/**
 * ScanDispatcher
 *
 * The single funnel every transport feeds into. Responsibilities:
 *
 *   1. Register / unregister TransportAdapters
 *   2. Deduplicate identical codes that arrive within DEBOUNCE_MS
 *      (BLE ring scanners and HID wedge scanners both have a habit
 *      of emitting the same code twice — once on key-down, once on
 *      the terminator; camera detectors can fire on every frame)
 *   3. Normalize the code (strip whitespace, control characters,
 *      leading/trailing artifacts from USB HID keyboards)
 *   4. Emit a single `scan` event that consumers subscribe to
 *
 * The dispatcher does NOT call the backend. That's the consumer's
 * job, because web, desktop, and mobile all have different HTTP
 * clients.
 */
export class ScanDispatcher extends EventEmitter<{
  scan: (event: ScanEvent) => void;
  error: (err: Error, transport: ScanTransport) => void;
}> {
  private adapters = new Map<ScanTransport, TransportAdapter>();
  private lastCode: string | null = null;
  private lastAt = 0;

  /** Register a transport adapter. Idempotent per transport. */
  register(adapter: TransportAdapter): void {
    if (this.adapters.has(adapter.transport)) {
      throw new Error(
        `Transport "${adapter.transport}" is already registered`,
      );
    }
    this.adapters.set(adapter.transport, adapter);
  }

  /** Start every registered transport concurrently. */
  async startAll(): Promise<void> {
    const results = await Promise.allSettled(
      Array.from(this.adapters.values()).map(async (a) => {
        try {
          await a.start();
        } catch (err) {
          this.emit(
            'error',
            err instanceof Error ? err : new Error(String(err)),
            a.transport,
          );
          throw err;
        }
      }),
    );

    // A single transport failing must not abort the others.
    const failures = results.filter((r) => r.status === 'rejected');
    if (failures.length > 0) {
      console.warn(
        `[scanner] ${failures.length} transport(s) failed to start`,
      );
    }
  }

  async stopAll(): Promise<void> {
    await Promise.allSettled(
      Array.from(this.adapters.values()).map((a) => a.stop()),
    );
  }

  /** Called by adapters when they decode a code. */
  ingest(
    raw: string,
    transport: ScanTransport,
    format?: string,
  ): void {
    const code = normalize(raw);
    if (!code) return;

    const now = Date.now();
    if (
      code === this.lastCode &&
      now - this.lastAt < DEBOUNCE_MS
    ) {
      // Same code, same source burst — swallow it.
      return;
    }

    this.lastCode = code;
    this.lastAt = now;

    this.emit('scan', {
      code,
      transport,
      timestamp: now,
      format,
      raw,
    });
  }

  onScan(listener: ScanListener): () => void {
    this.on('scan', listener);
    return () => this.off('scan', listener);
  }

  onError(
    listener: (err: Error, transport: ScanTransport) => void,
  ): () => void {
    this.on('error', listener);
    return () => this.off('error', listener);
  }

  status(): Array<{
    transport: ScanTransport;
    running: boolean;
    extra?: Record<string, unknown>;
  }> {
    return Array.from(this.adapters.values()).map((a) => ({
      transport: a.transport,
      running: a.isRunning(),
      extra: a.getStatus?.(),
    }));
  }
}

function normalize(raw: string): string {
  return raw
    .replace(/[\r\n\t]/g, '')
    .replace(/\s+/g, '')
    .trim();
}
