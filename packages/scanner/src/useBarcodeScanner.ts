// packages/scanner/src/useBarcodeScanner.ts

import { useEffect, useMemo, useRef, useState } from 'react';
import { ScanDispatcher } from './dispatcher';
import { UsbHidAdapter } from './transports/usbHid';
import { BleSppAdapter, type BleBridge } from './transports/bleSpp';
import { CameraAdapter } from './transports/camera';
import type { ScanEvent, ScanTransport } from './types';

interface Options {
  /** When true, the dispatcher starts all transports on mount. */
  enabled?: boolean;
  /** Attach the USB HID listener to `document` by default. */
  hidTarget?: HTMLElement | Document;
  /** Optional BLE bridge; skip BLE when absent. */
  bleBridge?: BleBridge;
  /** Optional video element; skip camera when absent. */
  cameraVideo?: HTMLVideoElement | null;
  /** Which transports to enable. Defaults to all that have prerequisites. */
  transports?: ScanTransport[];
  /** Called for every deduped scan. */
  onScan?: (event: ScanEvent) => void;
  /** Called when a transport errors. */
  onError?: (err: Error, transport: ScanTransport) => void;
}

export function useBarcodeScanner(options: Options = {}) {
  const {
    enabled = true,
    hidTarget,
    bleBridge,
    cameraVideo,
    transports,
    onScan,
    onError,
  } = options;

  const dispatcher = useMemo(() => new ScanDispatcher(), []);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<
    Array<{ transport: ScanTransport; running: boolean }>
  >([]);

  const onScanRef = useRef(onScan);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!enabled) return;

    const want = transports ?? [
      'usb-hid',
      bleBridge ? 'ble-spp' : null,
      cameraVideo ? 'camera' : null,
    ].filter((x): x is ScanTransport => x !== null);

    for (const t of want) {
      if (t === 'usb-hid') {
        dispatcher.register(
          new UsbHidAdapter({
            target: hidTarget ?? document,
            onCode: (code, fmt) => dispatcher.ingest(code, 'usb-hid', fmt),
          }),
        );
      } else if (t === 'ble-spp' && bleBridge) {
        dispatcher.register(
          new BleSppAdapter({
            bridge: bleBridge,
            onCode: (code, fmt) => dispatcher.ingest(code, 'ble-spp', fmt),
          }),
        );
      } else if (t === 'camera' && cameraVideo) {
        dispatcher.register(
          new CameraAdapter({
            video: cameraVideo,
            onCode: (code, fmt) => dispatcher.ingest(code, 'camera', fmt),
          }),
        );
      }
    }

    const offScan = dispatcher.onScan((e) => onScanRef.current?.(e));
    const offErr = dispatcher.onError((err, t) =>
      onErrorRef.current?.(err, t),
    );

    void dispatcher.startAll().finally(() => {
      setReady(true);
      setStatus(dispatcher.status());
    });

    return () => {
      offScan();
      offErr();
      void dispatcher.stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    dispatcher,
    ready,
    status,
    /** Manually push a code into the dispatcher (e.g. from a mobile native scanner). */
    ingest: (code: string, transport: ScanTransport = 'usb-hid') =>
      dispatcher.ingest(code, transport),
  };
}
