// packages/scanner/src/transports/bleSpp.ts

import type { TransportAdapter } from '../types';

/**
 * Minimal contract a platform-specific BLE bridge must satisfy.
 * Web uses WebBluetoothBridge; Electron uses SerialPortBridge;
 * React Native uses RNBleBridge. All three implement this.
 */
export interface BleBridge {
  /** Ask the user to pick a device, return an opaque device id. */
  requestDevice(): Promise<string>;
  /** Subscribe to notifications; call `onData` for every packet. */
  connect(
    deviceId: string,
    onData: (chunk: string) => void,
    onDisconnect: () => void,
  ): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  /** Optional: read a "battery" characteristic if the device has one. */
  readBattery?(deviceId: string): Promise<number | null>;
}

interface Options {
  bridge: BleBridge;
  onCode: (code: string, format?: string) => void;
  /**
   * Some SPP scanners stream raw bytes without a terminator and
   * rely on inter-packet timing. This is the idle gap after which
   * we flush the accumulated buffer as a full code.
   */
  idleFlushMs?: number;
  minLength?: number;
}

export class BleSppAdapter implements TransportAdapter {
  readonly transport = 'ble-spp' as const;

  private running = false;
  private deviceId: string | null = null;
  private buffer = '';
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private battery: number | null = null;
  private opts: Required<Omit<Options, 'bridge' | 'onCode'>> & {
    bridge: BleBridge;
    onCode: (code: string, format?: string) => void;
  };

  constructor(options: Options) {
    this.opts = {
      bridge: options.bridge,
      onCode: options.onCode,
      idleFlushMs: options.idleFlushMs ?? 120,
      minLength: options.minLength ?? 3,
    };
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.deviceId = await this.opts.bridge.requestDevice();
    await this.opts.bridge.connect(
      this.deviceId,
      this.handleChunk,
      this.handleDisconnect,
    );

    if (this.opts.bridge.readBattery) {
      try {
        this.battery = await this.opts.bridge.readBattery(this.deviceId);
      } catch {
        this.battery = null;
      }
    }
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.deviceId) {
      try {
        await this.opts.bridge.disconnect(this.deviceId);
      } catch {
        /* ignore */
      }
    }
    this.deviceId = null;
    this.buffer = '';
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus(): Record<string, unknown> {
    return {
      deviceId: this.deviceId,
      battery: this.battery,
      buffered: this.buffer.length,
    };
  }

  private handleChunk = (chunk: string): void => {
    // Some scanners terminate with \r or \n; if we see one, flush
    // immediately and reset.
    const hasTerminator = /[\r\n]/.test(chunk);
    this.buffer += chunk.replace(/[\r\n]/g, '');

    if (this.idleTimer) clearTimeout(this.idleTimer);

    if (hasTerminator) {
      this.flush();
      return;
    }

    this.idleTimer = setTimeout(
      () => this.flush(),
      this.opts.idleFlushMs,
    );
  };

  private handleDisconnect = (): void => {
    this.running = false;
    this.deviceId = null;
    this.buffer = '';
  };

  private flush(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    const code = this.buffer;
    this.buffer = '';
    if (code.length >= this.opts.minLength) {
      this.opts.onCode(code, 'BLE');
    }
  }
}
