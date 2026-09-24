// packages/mobile/src/bridges/rnBle.ts
import { BleManager, Device } from 'react-native-ble-plx';
import type { BleBridge } from '@pos/scanner';

export class RNBleBridge implements BleBridge {
  private manager = new BleManager();
  private devices = new Map<string, Device>();

  async requestDevice(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.manager.startDeviceScan(null, null, (err, device) => {
        if (err) return reject(err);
        if (device?.name?.toLowerCase().includes('scan')) {
          this.manager.stopDeviceScan();
          this.devices.set(device.id, device);
          resolve(device.id);
        }
      });
    });
  }

  async connect(deviceId: string, onData: (c: string) => void): Promise<void> {
    const base = this.devices.get(deviceId);
    if (!base) throw new Error('Unknown device');
    const connected = await base.connect();
    await connected.discoverAllServicesAndCharacteristics();

    connected.monitorCharacteristicForService(
      '0000ffe0-0000-1000-8000-00805f9b34fb',
      '0000ffe1-0000-1000-8000-00805f9b34fb',
      (err, ch) => {
        if (err || !ch?.value) return;
        const text = Buffer.from(ch.value, 'base64').toString('utf-8');
        onData(text);
      },
    );
  }

  async disconnect(deviceId: string): Promise<void> {
    const d = this.devices.get(deviceId);
    if (d) {
      await d.cancelConnection().catch(() => undefined);
      this.devices.delete(deviceId);
    }
  }
}
