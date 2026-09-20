// D:\Projects\Kalwanga\packages\desktop\main\index.ts

import { app, BrowserWindow, ipcMain, Menu, Tray, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { createServer } from 'http';
import Store from 'electron-store';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './database.js';
import { createTray } from './tray.js';
import { setupIPC } from './ipc.js';
import { logger } from './logger.js';
import { getSyncService, closeSyncService } from './sync.js';

// Load environment variables from .env file
const envPath = path.join(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Also load from process.env for production
if (!process.env.API_URL) {
  process.env.API_URL = 'http://localhost:3001';
}
if (!process.env.WS_URL) {
  process.env.WS_URL = 'ws://localhost:3001';
}

// ============================================
// Electron command-line switches
// ============================================
//
// These two switches work around a Chromium/Electron initialization
// failure on some Windows configurations. The crashpad_handler
// subprocess fails to spawn, which aborts the main process before it
// can even print anything useful. Once that's disabled, the Chromium
// sandbox fails to initialize on the same machines, so we disable that
// too.
//
// For an internal POS desktop app running on a trusted Windows
// installation, running without the sandbox is acceptable.

app.commandLine.appendSwitch('disable-crash-reporter');
app.commandLine.appendSwitch('no-sandbox');

// ============================================
// PLACE 1: Store Configuration with defaults
// ============================================
const store = new Store({
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    rememberLastSession: true,
    autoUpdate: true,
    autoSync: true,
    syncInterval: 300,
  },
});

// Check if running in development
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Create the main window
function createWindow() {
  const { width, height } = store.get('windowBounds') as {
    width: number;
    height: number;
  };

  console.log('[debug] createWindow: creating BrowserWindow');

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/index.js'),
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: true,
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
  });

  // Log load failures so we can see WHY the renderer didn't render
  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[Electron] did-fail-load: ${errorCode} ${errorDescription} (${validatedURL})`,
      );
    },
  );

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[debug] renderer did-finish-load');
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[debug] render-process-gone:', details);
  });

  // Load the app
  if (isDev) {
    const url = process.env.WEB_URL || 'http://localhost:3000';
    console.log(`[Electron] Loading dev URL: ${url}`);
    mainWindow.loadURL(url).catch((err) => {
      console.error('[debug] loadURL rejected:', err);
    });
    mainWindow.webContents.openDevTools();
  } else {
    const file = path.join(__dirname, '../renderer/index.html');
    console.log(`[Electron] Loading production file: ${file}`);
    mainWindow.loadFile(file).catch((err) => {
      console.error('[debug] loadFile rejected:', err);
    });
  }

  // Window is already shown via `show: true`, but keep the hook
  // in case someone flips `show` back to false.
  mainWindow.once('ready-to-show', () => {
    console.log('[debug] window ready-to-show');
    if (!mainWindow?.isVisible()) {
      mainWindow?.show();
    }

    // Check for updates
    if (!isDev && store.get('autoUpdate') as boolean) {
      autoUpdater.checkForUpdatesAndNotify();
    }

    // ============================================
    // PLACE 2: Initial sync after app is ready
    // ============================================
    setTimeout(() => {
      const syncService = getSyncService();
      syncService
        .syncData()
        .then((result) => {
          if (result.success) {
            logger.info('Initial sync completed successfully');
          } else {
            logger.warn('Initial sync failed:', result.message);
          }
        })
        .catch((error) => {
          logger.error('Initial sync error:', error);
        });
    }, 5000);
  });

  // Save window bounds on resize
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', {
        width: bounds.width,
        height: bounds.height,
      });
    }
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (store.get('rememberLastSession') as boolean) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Cleanup
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

// Setup auto updater
function setupAutoUpdater() {
  if (isDev) return;

  const repo = process.env.GITHUB_REPO || 'pos-system';
  const owner = process.env.GITHUB_OWNER || 'your-organization';

  autoUpdater.setFeedURL({
    provider: 'github',
    repo,
    owner,
  });

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: 'A new version is available. Downloading now...',
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message:
          'The update has been downloaded. Restart the application to install it.',
        buttons: ['Restart', 'Later'],
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on('error', (err) => {
    logger.error('Auto updater error:', err);
  });
}

// App lifecycle events
app.whenReady().then(async () => {
  console.log('[debug] app.whenReady fired');

  try {
    console.log('[debug] before initializeDatabase');
    await initializeDatabase();
    console.log('[debug] after initializeDatabase');

    console.log('[debug] before createWindow');
    createWindow();
    console.log('[debug] after createWindow');

    console.log('[debug] before createTray');
    tray = createTray(mainWindow);
    console.log('[debug] after createTray');

    console.log('[debug] before setupIPC');
    setupIPC(mainWindow, store);
    console.log('[debug] after setupIPC');

    console.log('[debug] before setupAutoUpdater');
    setupAutoUpdater();
    console.log('[debug] after setupAutoUpdater');

    if (process.platform === 'win32') {
      app.setAppUserModelId('com.pos-system.desktop');
    }

    logger.info('Desktop application started successfully');
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`API URL: ${process.env.API_URL}`);
    logger.info(`WS URL: ${process.env.WS_URL}`);
    logger.info(`Auto Sync: ${store.get('autoSync')}`);
    logger.info(`Sync Interval: ${store.get('syncInterval')}s`);
  } catch (error) {
    console.error('[debug] CAUGHT ERROR in app.whenReady:', error);
    if (error instanceof Error) {
      console.error('[debug] error message:', error.message);
      console.error('[debug] error stack:', error.stack);
    }
    logger.error('App initialization error:', error);
    dialog.showErrorBox(
      'Initialization Error',
      error instanceof Error ? error.message : 'Failed to start the application. Please check the logs.',
    );
    app.quit();
  }
});

// Handle app activation (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

// ============================================
// PLACE 3: Clean up resources on app quit
// ============================================
app.on('before-quit', () => {
  logger.info('Application quitting...');

  try {
    closeSyncService();
    logger.info('Sync service closed');
  } catch (error) {
    logger.error('Error closing sync service:', error);
  }

  try {
    closeDatabase();
    logger.info('Database closed');
  } catch (error) {
    logger.error('Error closing database:', error);
  }
});

// ============================================
// PLACE 4: Graceful shutdown handlers
// ============================================
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  app.quit();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  dialog.showErrorBox(
    'Unexpected Error',
    error.message || 'An unexpected error occurred.',
  );
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

export { mainWindow, store };
