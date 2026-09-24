// packages/scanner/src/bridges/webBluetooth.ts

import type { BleBridge } from '../transports/bleSpp';

// Common GATT services used by ring scanners / SPP-BLE bridges.
const KNOWN_SERVICES = [
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / generic
  '000018f0-0000-1000-8000-00805f9b34fb', // barcode scanner service
  '0000fff0-0000-1000-8000-00805f9b34fb', // BLE UART
];

const NOTIFY_CHARACTERISTIC = '0000ffe1-0000-1000-8000-00805f9b34fb';

export class WebBluetoothBridge implements BleBridge {
  private devices = new Map<
    string,
    { device: BluetoothDevice; server: BluetoothRemoteGATTServer | null }
  >();
  private decoders = new Map<string, TextDecoder>();

  async requestDevice(): Promise<string> {
    if (!('bluetooth' in navigator)) {
      throw new Error('Web Bluetooth is not supported in this browser');
    }

    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICES,
    });

    const id = device.id ?? `ble-${Date.now()}`;
    this.devices.set(id, { device, server: null });
    return id;
  }

  async connect(
    deviceId: string,
    onData: (chunk: string) => void,
    onDisconnect: () => void,
  ): Promise<void> {
    const entry = this.devices.get(deviceId);
    if (!entry) throw new Error(`Unknown device: ${deviceId}`);

    entry.device.addEventListener('gattserverdisconnected', onDisconnect);

    const server = await entry.device.gatt!.connect();
    entry.server = server;

    // Try each known service until one yields a notify characteristic.
    let notifyChar: BluetoothRemoteGATTCharacteristic | null = null;
    for (const svcUuid of KNOWN_SERVICES) {
      try {
        const svc = await server.getPrimaryService(svcUuid);
        try {
          notifyChar = await svc.getCharacteristic(NOTIFY_CHARACTERISTIC);
          break;
        } catch {
          const chars = await svc.getCharacteristics();
          notifyChar = chars.find((c) => c.properties.notify) ?? null;
          if (notifyChar) break;
        }
      } catch {
        continue;
      }
    }

    if (!notifyChar) {
      throw new Error(
        'No notify characteristic found — device may not be SPP-compatible',
      );
    }

    const decoder = new TextDecoder('utf-8');
    this.decoders.set(deviceId, decoder);

    await notifyChar.startNotifications();
    notifyChar.addEventListener('characteristicvaluechanged', (ev) => {
      const target = ev.target as BluetoothRemoteGATTCharacteristic;
      const value = target.value;
      if (!value) return;
      const text = decoder.decode(value);
      onData(text);
    });
  }

  async disconnect(deviceId: string): Promise<void> {
    const entry = this.devices.get(deviceId);
    if (!entry) return;
    try {
      entry.server?.disconnect();
    } catch {
      /* ignore */
    }
    this.devices.delete(deviceId);
    this.decoders.delete(deviceId);
  }
}
