import { Tray, Menu, BrowserWindow, nativeImage, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createTray(mainWindow: BrowserWindow | null): Tray | null {
  try {
    // Create tray icon
    const iconPath = path.join(__dirname, '../assets/tray-icon.png');
    let icon = nativeImage.createFromPath(iconPath);
    
    // If icon doesn't exist, create a fallback icon
    if (icon.isEmpty()) {
      // Create a simple icon using nativeImage
      icon = nativeImage.createFromPath(path.join(__dirname, '../assets/icon.png'));
    }
    
    // Resize icon if needed
    const trayIcon = icon.resize({ width: 16, height: 16 });
    const tray = new Tray(trayIcon);

    // Create context menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show POS System',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Dashboard',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', '/dashboard');
          }
        },
      },
      {
        label: 'POS',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate', '/pos');
          }
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Reload App',
        click: () => {
          if (mainWindow) {
            mainWindow.reload();
          }
        },
      },
      {
        label: 'Toggle Dev Tools',
        click: () => {
          if (mainWindow) {
            mainWindow.webContents.toggleDevTools();
          }
        },
      },
      {
        type: 'separator',
      },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setToolTip('POS System');
    tray.setContextMenu(contextMenu);

    // Handle tray click (show/hide window)
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // Handle tray double click
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    logger.info('Tray created successfully');
    return tray;
  } catch (error) {
    logger.error('Failed to create tray:', error);
    return null;
  }
}
