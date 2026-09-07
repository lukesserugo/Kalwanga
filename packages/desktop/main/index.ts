import { app, BrowserWindow, ipcMain, Menu, Tray, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import Store from 'electron-store';
import dotenv from 'dotenv';
import { initializeDatabase, closeDatabase } from './database.js';
import { createTray } from './tray.js';
import { setupIPC } from './ipc.js';
import { logger } from './logger.js';
import { getSyncService, closeSyncService } from './sync.js';

// Load environment variables from .env file
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Also load from process.env for production
if (!process.env.API_URL) {
  process.env.API_URL = 'http://localhost:3001';
}
if (!process.env.WS_URL) {
  process.env.WS_URL = 'ws://localhost:3001';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// PLACE 1: Store Configuration with defaults
// ============================================
const store = new Store({
  defaults: {
    windowBounds: { width: 1200, height: 800 },
    rememberLastSession: true,
    autoUpdate: true,
    autoSync: true,        // Auto sync enabled by default
    syncInterval: 300,     // 5 minutes
  },
});

// Check if running in development
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Create the main window
function createWindow() {
  const { width, height } = store.get('windowBounds') as { width: number; height: number };

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
    show: false,
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL(process.env.WEB_URL || 'http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    
    // Check for updates
    if (!isDev && store.get('autoUpdate') as boolean) {
      autoUpdater.checkForUpdatesAndNotify();
    }

    // ============================================
    // PLACE 2: Initial sync after app is ready
    // ============================================
    setTimeout(() => {
      const syncService = getSyncService();
      syncService.syncData().then((result) => {
        if (result.success) {
          logger.info('Initial sync completed successfully');
        } else {
          logger.warn('Initial sync failed:', result.message);
        }
      }).catch((error) => {
        logger.error('Initial sync error:', error);
      });
    }, 5000);
  });

  // Save window bounds on resize
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', { width: bounds.width, height: bounds.height });
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
    dialog.showMessageBox({
      type: 'info',
      title: 'Update Ready',
      message: 'The update has been downloaded. Restart the application to install it.',
      buttons: ['Restart', 'Later'],
    }).then((result) => {
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
  try {
    // Initialize database
    await initializeDatabase();

    // Create main window
    createWindow();

    // Create system tray
    tray = createTray(mainWindow);

    // Setup IPC handlers
    setupIPC(mainWindow, store);

    // Setup auto updater
    setupAutoUpdater();

    // Set app user model id for Windows
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
    logger.error('App initialization error:', error);
    dialog.showErrorBox('Initialization Error', 'Failed to start the application. Please check the logs.');
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
  
  // Close sync service
  try {
    closeSyncService();
    logger.info('Sync service closed');
  } catch (error) {
    logger.error('Error closing sync service:', error);
  }
  
  // Close database
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
// Handle SIGTERM (for graceful shutdown)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  app.quit();
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  app.quit();
});

// Handle app window-all-closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  dialog.showErrorBox('Unexpected Error', error.message || 'An unexpected error occurred.');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

export { mainWindow, store };
