import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, data: any) => {
      // Whitelist channels
      const validChannels = [
        'window-control',
        'navigate',
        'get-version',
        'get-store-value',
        'set-store-value',
        'get-store-all',
        'clear-store',
        'open-external',
        'show-save-dialog',
        'show-open-dialog',
        'read-file',
        'write-file',
        'print',
        'print-pdf',
        'reload-app',
        'toggle-dev-tools',
        'get-env',
        'get-system-info',
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    on: (channel: string, func: (...args: any[]) => void) => {
      const validChannels = [
        'navigate',
        'get-version',
        'get-store-value',
        'set-store-value',
        'get-store-all',
        'clear-store',
        'open-external',
        'show-save-dialog',
        'show-open-dialog',
        'read-file',
        'write-file',
        'print',
        'print-pdf',
        'reload-app',
        'toggle-dev-tools',
        'get-env',
        'get-system-info',
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    invoke: (channel: string, ...args: any[]) => {
      const validChannels = [
        'get-version',
        'get-store-value',
        'set-store-value',
        'get-store-all',
        'clear-store',
        'open-external',
        'show-save-dialog',
        'show-open-dialog',
        'read-file',
        'write-file',
        'print',
        'print-pdf',
        'reload-app',
        'toggle-dev-tools',
        'get-env',
        'get-system-info',
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },
  },
  process: {
    platform: process.platform,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      API_URL: process.env.API_URL,
      WS_URL: process.env.WS_URL,
    },
  },
  getVersion: () => ipcRenderer.invoke('get-version'),
  getEnv: () => ipcRenderer.invoke('get-env'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
});
