// packages/desktop/src/bridges/serialPortProxy.ts

import type { BleBridge } from '@pos/scanner/ble-spp';

interface IpcRendererLike {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
  removeListener: (
    channel: string,
    listener: (event: any, ...args: any[]) => void,
  ) => void;
}

/**
 * Channel names. Must stay in lockstep with the handlers registered in
 * `packages/desktop/main/ipc.ts`.
 */
const CHANNELS = {
  list: 'scanner:list-devices',
  request: 'scanner:request-device',
  connect: 'scanner:connect',
  disconnect: 'scanner:disconnect',
  data: 'scanner:data',
  disconnectEvent: 'scanner:disconnect-event',
} as const;

export class ElectronSerialBridgeProxy implements BleBridge {
  /** One listener per connected device id. */
  private listeners = new Map<
    string,
    {
      data: (event: any, payload: { deviceId: string; chunk: string }) => void;
      drop: (event: any, payload: { deviceId: string }) => void;
    }
  >();

  constructor(private ipc: IpcRendererLike) {}

  async requestDevice(): Promise<string> {
    return this.ipc.invoke(CHANNELS.request);
  }

  /**
   * Enumerate serial devices. Not part of the `BleBridge` contract but
   * useful to a device-picker UI. Renders an identical shape to the
   * main-process `listDevices`.
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
    return this.ipc.invoke(CHANNELS.list);
  }

  async connect(
    deviceId: string,
    onData: (chunk: string) => void,
    onDisconnect: () => void,
  ): Promise<void> {
    // Register listeners BEFORE awaiting the connect call. The main
    // process may emit the first scan immediately after the port opens,
    // and we must not miss it.
    const dataListener = (
      _event: any,
      payload: { deviceId: string; chunk: string },
    ) => {
      if (payload?.deviceId !== deviceId) return;
      try {
        onData(payload.chunk);
      } catch {
        /* swallow — the adapter's own try/catch is upstream */
      }
    };

    const dropListener = (
      _event: any,
      payload: { deviceId: string },
    ) => {
      if (payload?.deviceId !== deviceId) return;
      this.teardown(deviceId);
      try {
        onDisconnect();
      } catch {
        /* swallow */
      }
    };

    this.ipc.on(CHANNELS.data, dataListener);
    this.ipc.on(CHANNELS.disconnectEvent, dropListener);
    this.listeners.set(deviceId, { data: dataListener, drop: dropListener });

    try {
      await this.ipc.invoke(CHANNELS.connect, deviceId);
    } catch (err) {
      this.teardown(deviceId);
      throw err;
    }
  }

  async disconnect(deviceId: string): Promise<void> {
    this.teardown(deviceId);
    await this.ipc.invoke(CHANNELS.disconnect, deviceId);
  }

  private teardown(deviceId: string): void {
    const entry = this.listeners.get(deviceId);
    if (!entry) return;
    this.ipc.removeListener(CHANNELS.data, entry.data);
    this.ipc.removeListener(CHANNELS.disconnectEvent, entry.drop);
    this.listeners.delete(deviceId);
  }
}
