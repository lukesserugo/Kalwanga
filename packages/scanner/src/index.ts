export { ScanDispatcher } from './dispatcher';
export { UsbHidAdapter } from './transports/usbHid';
export { BleSppAdapter, type BleBridge } from './transports/bleSpp';
export { CameraAdapter } from './transports/camera';
export { WebBluetoothBridge } from './bridges/webBluetooth';
export { useBarcodeScanner } from './useBarcodeScanner';
export type {
  ScanEvent,
  ScanTransport,
  TransportAdapter,
  ScanListener,
} from './types';
