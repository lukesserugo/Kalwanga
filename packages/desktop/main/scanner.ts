// packages/desktop/main/scanner.ts

import { BrowserWindow } from 'electron';
import { getSerialBridge, closeSerialBridge } from '../bridges/serialPort.js';
import { logger } from './logger.js';

/**
 * Attach a BrowserWindow so scan events from the serial bridge are
 * forwarded to the renderer. Called once from `setupIPC`.
 */
let targetWindow: BrowserWindow | null = null;

export function attachScannerWindow(win: BrowserWindow | null): void {
  targetWindow = win;
}

function sendToRenderer(channel: string, payload: any): void {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  try {
    targetWindow.webContents.send(channel, payload);
  } catch (err) {
    logger.error(`[scanner] failed to send ${channel}:`, err);
  }
}

export async function listSerialDevices() {
  const bridge = getSerialBridge();
  return bridge.listDevices();
}

export async function requestSerialDevice(): Promise<string> {
  const bridge = getSerialBridge();
  return bridge.requestDevice();
}

export async function connectSerialDevice(deviceId: string): Promise<void> {
  const bridge = getSerialBridge();

  await bridge.connect(
    deviceId,
    // Every decoded line → forward to the renderer's BleSppAdapter.
    // The adapter will feed the dispatcher, which is where dedupe and
    // normalization happen.
    (chunk) => {
      sendToRenderer('scanner:data', { deviceId, chunk });
    },
    // Unexpected drop → tell the renderer so its BleSppAdapter can
    // surface the error and stop.
    () => {
      sendToRenderer('scanner:disconnect-event', { deviceId });
    },
  );

  logger.info(`[scanner] serial device connected: ${deviceId}`);
}

export async function disconnectSerialDevice(
  deviceId: string,
): Promise<void> {
  const bridge = getSerialBridge();
  await bridge.disconnect(deviceId);
  logger.info(`[scanner] serial device disconnected: ${deviceId}`);
}

export function getSerialStatus() {
  const bridge = getSerialBridge();
  return bridge.status();
}

export async function shutdownScanner(): Promise<void> {
  await closeSerialBridge();
}
