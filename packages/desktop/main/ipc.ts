import { ipcMain, BrowserWindow, dialog, shell, app } from 'electron';
import Store from 'electron-store';
import { logger } from './logger.js';
import fs from 'fs';
import path from 'path';
import { getSyncService } from './sync.js';
import { getDatabase } from './database.js';

export function setupIPC(mainWindow: BrowserWindow | null, store: Store): void {
  // ============================================
  // WINDOW CONTROLS
  // ============================================
  
  ipcMain.on('window-control', (event, action: string) => {
    if (!mainWindow) return;
    
    switch (action) {
      case 'minimize':
        mainWindow.minimize();
        break;
      case 'maximize':
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        break;
      case 'close':
        mainWindow.close();
        break;
      default:
        logger.warn(`Unknown window action: ${action}`);
    }
  });

  // ============================================
  // APP INFO
  // ============================================
  
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  // ============================================
  // STORE OPERATIONS
  // ============================================
  
  ipcMain.handle('get-store-value', (event, key: string) => {
    return store.get(key);
  });

  ipcMain.handle('set-store-value', (event, key: string, value: any) => {
    store.set(key, value);
    return true;
  });

  ipcMain.handle('get-store-all', () => {
    return store.store;
  });

  ipcMain.handle('clear-store', () => {
    store.clear();
    return true;
  });

  // ============================================
  // FILE & DIALOG OPERATIONS
  // ============================================
  
  ipcMain.handle('open-external', (event, url: string) => {
    shell.openExternal(url);
    return true;
  });

  ipcMain.handle('show-save-dialog', async (event, options: any) => {
    const result = await dialog.showSaveDialog({
      title: 'Save File',
      defaultPath: options.defaultPath || '~/Downloads',
      filters: options.filters || [],
    });
    return result;
  });

  ipcMain.handle('show-open-dialog', async (event, options: any) => {
    const result = await dialog.showOpenDialog({
      title: 'Open File',
      defaultPath: options.defaultPath || '~/Downloads',
      filters: options.filters || [],
      properties: options.properties || ['openFile'],
    });
    return result;
  });

  ipcMain.handle('read-file', async (event, filePath: string) => {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      logger.error('Failed to read file:', error);
      throw error;
    }
  });

  ipcMain.handle('write-file', async (event, filePath: string, content: string) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8');
      return true;
    } catch (error) {
      logger.error('Failed to write file:', error);
      throw error;
    }
  });

  // ============================================
  // PRINT OPERATIONS
  // ============================================
  
  ipcMain.handle('print', async (event, options: any) => {
    if (mainWindow) {
      mainWindow.webContents.print({
        silent: options.silent || false,
        printBackground: options.printBackground || true,
        deviceName: options.deviceName || '',
      });
      return true;
    }
    return false;
  });

  ipcMain.handle('print-pdf', async (event, options: any) => {
    if (mainWindow) {
      const result = await mainWindow.webContents.printToPDF({
        landscape: options.landscape || false,
        displayHeaderFooter: options.displayHeaderFooter || false,
        printBackground: options.printBackground || true,
        scale: options.scale || 1,
      });
      return result;
    }
    return null;
  });

  // ============================================
  // APP CONTROL
  // ============================================
  
  ipcMain.handle('reload-app', () => {
    if (mainWindow) {
      mainWindow.reload();
      return true;
    }
    return false;
  });

  ipcMain.handle('toggle-dev-tools', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
      return true;
    }
    return false;
  });

  ipcMain.on('navigate', (event, route: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('navigate', route);
    }
  });

  // ============================================
  // ENVIRONMENT & SYSTEM INFO
  // ============================================
  
  ipcMain.handle('get-env', () => {
    return {
      NODE_ENV: process.env.NODE_ENV,
      API_URL: process.env.API_URL,
      WS_URL: process.env.WS_URL,
      platform: process.platform,
      arch: process.arch,
      isDev: process.env.NODE_ENV === 'development' || !app.isPackaged,
    };
  });

  ipcMain.handle('get-system-info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
    };
  });

  // ============================================
  // SYNC OPERATIONS
  // ============================================
  
  // Start a full sync
  ipcMain.handle('sync:start', async () => {
    try {
      const syncService = getSyncService();
      const result = await syncService.syncData();
      return result;
    } catch (error) {
      logger.error('Sync error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  });

  // Get sync status
  ipcMain.handle('sync:status', () => {
    try {
      const db = getDatabase();
      const syncService = getSyncService();
      
      const pendingCount = db.prepare('SELECT COUNT(*) as count FROM offline_queue WHERE status = "pending"').get() as { count: number };
      const failedCount = db.prepare('SELECT COUNT(*) as count FROM offline_queue WHERE status = "failed"').get() as { count: number };
      const lastSync = db.prepare('SELECT value FROM settings WHERE key = "last_sync"').get() as { value: string } | undefined;
      
      return {
        pending: pendingCount?.count || 0,
        failed: failedCount?.count || 0,
        lastSync: lastSync?.value || null,
        isSyncing: syncService.isSyncing || false,
        autoSync: store.get('autoSync') || true,
        syncInterval: store.get('syncInterval') || 300,
      };
    } catch (error) {
      logger.error('Failed to get sync status:', error);
      return {
        pending: 0,
        failed: 0,
        lastSync: null,
        isSyncing: false,
        autoSync: true,
        syncInterval: 300,
      };
    }
  });

  // Set auth token for sync
  ipcMain.handle('sync:set-token', async (event, token: string) => {
    try {
      const syncService = getSyncService();
      await syncService.setAuthToken(token);
      return { success: true };
    } catch (error) {
      logger.error('Failed to set auth token:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Clear auth token
  ipcMain.handle('sync:clear-token', async () => {
    try {
      const syncService = getSyncService();
      await syncService.clearAuthToken();
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear auth token:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Toggle auto sync
  ipcMain.handle('sync:toggle-auto', (event, enabled: boolean) => {
    store.set('autoSync', enabled);
    return { success: true };
  });

  // Set sync interval
  ipcMain.handle('sync:set-interval', (event, interval: number) => {
    if (interval >= 60) { // Minimum 1 minute
      store.set('syncInterval', interval);
      return { success: true };
    }
    return { success: false, error: 'Interval must be at least 60 seconds' };
  });

  // Get sync logs
  ipcMain.handle('sync:get-logs', (event, limit: number = 50) => {
    try {
      const db = getDatabase();
      const logs = db.prepare(`
        SELECT * FROM sync_logs 
        ORDER BY created_at DESC 
        LIMIT ?
      `).all(limit);
      return logs;
    } catch (error) {
      logger.error('Failed to get sync logs:', error);
      return [];
    }
  });

  // Clear sync logs
  ipcMain.handle('sync:clear-logs', () => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM sync_logs').run();
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear sync logs:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ============================================
  // OFFLINE QUEUE OPERATIONS
  // ============================================
  
  // Get pending operations
  ipcMain.handle('queue:get-pending', () => {
    try {
      const db = getDatabase();
      const operations = db.prepare(`
        SELECT * FROM offline_queue 
        WHERE status = 'pending' 
        ORDER BY created_at ASC
      `).all();
      return operations;
    } catch (error) {
      logger.error('Failed to get pending operations:', error);
      return [];
    }
  });

  // Get failed operations
  ipcMain.handle('queue:get-failed', () => {
    try {
      const db = getDatabase();
      const operations = db.prepare(`
        SELECT * FROM offline_queue 
        WHERE status = 'failed' 
        ORDER BY created_at DESC
      `).all();
      return operations;
    } catch (error) {
      logger.error('Failed to get failed operations:', error);
      return [];
    }
  });

  // Retry a failed operation
  ipcMain.handle('queue:retry', (event, id: number) => {
    try {
      const db = getDatabase();
      db.prepare('UPDATE offline_queue SET status = "pending", retry_count = 0, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(id);
      return { success: true };
    } catch (error) {
      logger.error('Failed to retry operation:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Retry all failed operations
  ipcMain.handle('queue:retry-all', () => {
    try {
      const db = getDatabase();
      db.prepare('UPDATE offline_queue SET status = "pending", retry_count = 0, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE status = "failed"')
        .run();
      return { success: true };
    } catch (error) {
      logger.error('Failed to retry all operations:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Clear completed operations
  ipcMain.handle('queue:clear-completed', () => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM offline_queue WHERE status = "completed"').run();
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear completed operations:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Clear all operations
  ipcMain.handle('queue:clear-all', () => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM offline_queue').run();
      return { success: true };
    } catch (error) {
      logger.error('Failed to clear all operations:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // ============================================
  // LOCAL DATABASE OPERATIONS
  // ============================================
  
  // Get local products
  ipcMain.handle('db:get-products', (event, filters?: any) => {
    try {
      const db = getDatabase();
      let query = 'SELECT * FROM local_products';
      const params: any[] = [];
      
      if (filters) {
        const conditions: string[] = [];
        if (filters.search) {
          conditions.push('(name LIKE ? OR sku LIKE ?)');
          params.push(`%${filters.search}%`, `%${filters.search}%`);
        }
        if (filters.syncStatus) {
          conditions.push('sync_status = ?');
          params.push(filters.syncStatus);
        }
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
      }
      
      query += ' ORDER BY created_at DESC';
      
      const products = db.prepare(query).all(...params);
      return products;
    } catch (error) {
      logger.error('Failed to get local products:', error);
      return [];
    }
  });

  // Get local sales
  ipcMain.handle('db:get-sales', (event, filters?: any) => {
    try {
      const db = getDatabase();
      let query = 'SELECT * FROM local_sales';
      const params: any[] = [];
      
      if (filters) {
        const conditions: string[] = [];
        if (filters.receiptNumber) {
          conditions.push('receipt_number LIKE ?');
          params.push(`%${filters.receiptNumber}%`);
        }
        if (filters.syncStatus) {
          conditions.push('sync_status = ?');
          params.push(filters.syncStatus);
        }
        if (filters.status) {
          conditions.push('status = ?');
          params.push(filters.status);
        }
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
      }
      
      query += ' ORDER BY created_at DESC';
      
      const sales = db.prepare(query).all(...params);
      return sales;
    } catch (error) {
      logger.error('Failed to get local sales:', error);
      return [];
    }
  });

  // Get local customers
  ipcMain.handle('db:get-customers', (event, filters?: any) => {
    try {
      const db = getDatabase();
      let query = 'SELECT * FROM local_customers';
      const params: any[] = [];
      
      if (filters) {
        const conditions: string[] = [];
        if (filters.search) {
          conditions.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)');
          params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }
        if (filters.syncStatus) {
          conditions.push('sync_status = ?');
          params.push(filters.syncStatus);
        }
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
      }
      
      query += ' ORDER BY created_at DESC';
      
      const customers = db.prepare(query).all(...params);
      return customers;
    } catch (error) {
      logger.error('Failed to get local customers:', error);
      return [];
    }
  });

  // ============================================
  // NETWORK STATUS
  // ============================================
  
  ipcMain.handle('network:status', async () => {
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return { online: response.ok };
    } catch (error) {
      return { online: false };
    }
  });

  logger.info('IPC handlers setup complete');
}
