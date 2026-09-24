// packages/desktop/bridges/serialPort.ts

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import type { BleBridge } from '@pos/scanner/ble-spp';
import { logger } from '../main/logger.js';

interface ConnectedPort {
  port: SerialPort;
  parser: ReadlineParser;
  deviceId: string;
  path: string;
  baudRate: number;
  onData: (chunk: string) => void;
  onDisconnect: () => void;
  /** Detaches the `close`/`error` listeners when we intentionally close. */
  detach: () => void;
}

export class ElectronSerialBridge implements BleBridge {
  private connections = new Map<string, ConnectedPort>();

  /**
   * Ask the caller to pick a device.
   *
   * `SerialPort.list()` returns every serial interface on the machine
   * — including COM1 and Bluetooth virtual ports that aren't scanners.
   * We can't distinguish a scanner from a modem without probing, so we
   * return the first port that isn't obviously a system device.
   *
   * In a real deployment the renderer would show a picker built from
   * `listDevices()`. The current `BleBridge` interface has no hook for
   * that, so the renderer uses `scanner:list-devices` (see ipc.ts) and
   * passes the chosen path into `scanner:connect`. This method exists
   * only to satisfy the interface for direct callers.
   */
  async requestDevice(): Promise<string> {
    const devices = await this.listDevices();
    if (devices.length === 0) {
      throw new Error(
        'No serial ports found. Connect a Bluetooth SPP scanner and pair it in your OS first.',
      );
    }
    return devices[0].path;
  }

  /**
   * Enumerate available serial devices. Exposed on the bridge so the
   * main-process IPC layer can forward it to the renderer for a
   * device-picker UI without duplicating the `serialport` import.
   */
  async listDevices(): Promise<
    Array<{
      path: string;
      manufacturer?: string;
      serialNumber?: string;
      vendorId?: string;
      productId?: string;
      friendlyName?: string;
    }>
  > {
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer ?? undefined,
      serialNumber: p.serialNumber ?? undefined,
      vendorId: p.vendorId ?? undefined,
      productId: p.productId ?? undefined,
      friendlyName: (p as any).friendlyName ?? undefined,
    }));
  }

  /**
   * Connect to a device and stream every line into `onData`.
   *
   * The scanner emits one code per line, terminated by `\r\n` (or just
   * `\r` on some models). We use `ReadlineParser` to split on either.
   *
   * `onDisconnect` fires when the OS yanks the device — unplugging a
   * USB-to-serial adapter, walking out of Bluetooth range, etc. The
   * renderer's `BleSppAdapter` treats that as "transport stopped" and
   * surfaces it via `onError`.
   */
  async connect(
    deviceId: string,
    onData: (chunk: string) => void,
    onDisconnect: () => void,
  ): Promise<void> {
    if (this.connections.has(deviceId)) {
      logger.warn(
        `[serial] device ${deviceId} is already connected — ignoring duplicate connect`,
      );
      return;
    }

    const baudRate = this.pickBaudRate(deviceId);

    return new Promise<void>((resolve, reject) => {
      const port = new SerialPort(
        {
          path: deviceId,
          baudRate,
          autoOpen: false,
        },
        (err) => {
          if (err) reject(err);
        },
      );

      // Some SPP scanners terminate on \r, some on \r\n, some on \n.
      // ReadlineParser accepts an array of delimiters.
      const parser = port.pipe(
        new ReadlineParser({ delimiter: ['\r\n', '\r', '\n'] }),
      );

      const dataHandler = (chunk: string) => {
        try {
          onData(chunk);
        } catch (err) {
          logger.error('[serial] onData handler threw:', err);
        }
      };

      const errorHandler = (err: Error) => {
        logger.error(`[serial] port ${deviceId} error:`, err);
      };

      const closeHandler = () => {
        // Fired on both intentional and unintentional closes. If we're
        // still in the connections map, this was not our `disconnect`
        // call, so treat it as an unexpected drop.
        if (this.connections.has(deviceId)) {
          logger.warn(
            `[serial] device ${deviceId} closed unexpectedly — notifying renderer`,
          );
          this.connections.delete(deviceId);
          try {
            onDisconnect();
          } catch (err) {
            logger.error('[serial] onDisconnect handler threw:', err);
          }
        }
      };

      const detach = () => {
        parser.off('data', dataHandler);
        port.off('error', errorHandler);
        port.off('close', closeHandler);
      };

      parser.on('data', dataHandler);
      port.on('error', errorHandler);
      port.on('close', closeHandler);

      port.open((openErr) => {
        if (openErr) {
          detach();
          reject(openErr);
          return;
        }

        this.connections.set(deviceId, {
          port,
          parser,
          deviceId,
          path: deviceId,
          baudRate,
          onData,
          onDisconnect,
          detach,
        });

        logger.info(
          `[serial] connected to ${deviceId} at ${baudRate} baud`,
        );
        resolve();
      });
    });
  }

  /**
   * Close a connection. Detaches listeners first so the `close`
   * handler doesn't fire the "unexpected drop" branch.
   */
  async disconnect(deviceId: string): Promise<void> {
    const conn = this.connections.get(deviceId);
    if (!conn) return;

    this.connections.delete(deviceId);

    try {
      conn.detach();
    } catch (err) {
      logger.warn('[serial] detach threw during disconnect:', err);
    }

    if (!conn.port.isOpen) return;

    await new Promise<void>((resolve) => {
      conn.port.close(() => resolve());
    });

    logger.info(`[serial] disconnected from ${deviceId}`);
  }

  /** Disconnect every open port. Called on app quit. */
  async disconnectAll(): Promise<void> {
    const ids = Array.from(this.connections.keys());
    await Promise.allSettled(ids.map((id) => this.disconnect(id)));
  }

  /** Snapshot of what's currently connected. */
  status(): Array<{
    deviceId: string;
    path: string;
    baudRate: number;
    isOpen: boolean;
  }> {
    return Array.from(this.connections.values()).map((c) => ({
      deviceId: c.deviceId,
      path: c.path,
      baudRate: c.baudRate,
      isOpen: c.port.isOpen,
    }));
  }

  /**
   * Pick a baud rate for the given port. Most SPP scanners ship with
   * 9600; some industrial ones use 115200. If you ever add a per-device
   * settings table, read it from there. For now: 9600.
   */
  private pickBaudRate(_deviceId: string): number {
    return 9600;
  }
}

/** Module-scoped singleton so IPC handlers all share one connection pool. */
let bridge: ElectronSerialBridge | null = null;

export function getSerialBridge(): ElectronSerialBridge {
  if (!bridge) bridge = new ElectronSerialBridge();
  return bridge;
}

export async function closeSerialBridge(): Promise<void> {
  if (!bridge) return;
  await bridge.disconnectAll();
  bridge = null;
}
