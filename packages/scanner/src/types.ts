// packages/scanner/src/types.ts

export type ScanTransport = 'usb-hid' | 'ble-spp' | 'camera';

export interface ScanEvent {
  /** The decoded code, already normalized. */
  code: string;
  /** Which physical transport produced this scan. */
  transport: ScanTransport;
  /** Milliseconds since epoch when the dispatcher emitted this. */
  timestamp: number;
  /** Optional symbology hint (EAN-13, QR, CODE128…). */
  format?: string;
  /** Raw payload from the transport, pre-normalization. Useful for debugging. */
  raw?: string;
}

export interface TransportAdapter {
  readonly transport: ScanTransport;
  /** Begin listening. Resolves once the transport is ready. */
  start(): Promise<void>;
  /** Stop listening and release resources. */
  stop(): Promise<void>;
  /** Whether the transport is currently active. */
  isRunning(): boolean;
  /** Optional: emit stats for UI (device count, battery, etc.) */
  getStatus?(): Record<string, unknown>;
}

export type ScanListener = (event: ScanEvent) => void;
