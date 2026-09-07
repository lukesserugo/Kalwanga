import { getDatabase } from './database.js';
import { logger } from './logger.js';
import axios from 'axios';
import { app } from 'electron';

interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}

class SyncService {
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startAutoSync();
  }

  async syncData(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;
    const results: string[] = [];

    try {
      logger.info('Starting data sync...');

      // Check if online
      const isOnline = await this.checkOnline();
      if (!isOnline) {
        return { success: false, message: 'No internet connection' };
      }

      const db = getDatabase();

      // 1. Sync pending operations (offline queue)
      await this.syncOfflineQueue(db);

      // 2. Sync products
      await this.syncProducts(db);

      // 3. Sync sales
      await this.syncSales(db);

      // 4. Sync customers
      await this.syncCustomers(db);

      // Update last sync timestamp
      const now = new Date().toISOString();
      db.prepare('UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = "last_sync"').run(now);

      // Log sync
      this.logSync('full_sync', 'success', 'Full sync completed successfully');

      logger.info('Data sync completed successfully');
      return { success: true, message: 'Sync completed successfully' };
    } catch (error) {
      logger.error('Sync failed:', error);
      this.logSync('full_sync', 'error', error instanceof Error ? error.message : 'Unknown error');
      return { success: false, message: 'Sync failed', errors: [error instanceof Error ? error.message : 'Unknown error'] };
    } finally {
      this.isSyncing = false;
    }
  }

  private async checkOnline(): Promise<boolean> {
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:3001';
      await axios.get(`${apiUrl}/health`, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async syncOfflineQueue(db: any): Promise<void> {
    const pendingOperations = db.prepare(`
      SELECT * FROM offline_queue 
      WHERE status = 'pending' 
      ORDER BY created_at ASC
    `).all() as any[];

    if (pendingOperations.length === 0) return;

    logger.info(`Syncing ${pendingOperations.length} pending operations`);

    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const token = await this.getAuthToken();

    for (const op of pendingOperations) {
      try {
        const response = await axios({
          method: op.operation,
          url: `${apiUrl}/api/${op.entity_type}/${op.entity_id}`,
          data: JSON.parse(op.data),
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 200 || response.status === 201) {
          // Mark as completed
          db.prepare('UPDATE offline_queue SET status = "completed", updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(op.id);
          logger.info(`Operation ${op.id} synced successfully`);
        }
      } catch (error) {
        // Increment retry count
        const newRetryCount = (op.retry_count || 0) + 1;
        if (newRetryCount >= op.max_retries) {
          db.prepare('UPDATE offline_queue SET status = "failed", retry_count = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newRetryCount, error instanceof Error ? error.message : 'Unknown error', op.id);
          logger.error(`Operation ${op.id} failed after ${newRetryCount} retries`);
        } else {
          db.prepare('UPDATE offline_queue SET retry_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newRetryCount, op.id);
        }
      }
    }
  }

  private async syncProducts(db: any): Promise<void> {
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:3001';
      const token = await this.getAuthToken();
      const lastSync = this.getLastSync('products');

      const response = await axios.get(`${apiUrl}/api/products`, {
        params: { updatedAfter: lastSync, limit: 1000 },
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.data && response.data.data) {
        const products = response.data.data;
        let syncedCount = 0;

        for (const product of products) {
          const existing = db.prepare('SELECT id FROM local_products WHERE id = ?').get(product.id);
          
          if (existing) {
            // Update existing
            db.prepare(`
              UPDATE local_products SET
                name = ?, description = ?, sku = ?, barcode = ?,
                unit_price = ?, cost_price = ?, tax_rate = ?,
                stock = ?, min_stock = ?, is_active = ?,
                category_id = ?, business_unit_id = ?,
                images = ?, attributes = ?,
                sync_status = 'synced', updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(
              product.name, product.description, product.sku, product.barcode,
              product.unitPrice, product.costPrice, product.taxRate,
              product.stock || 0, product.minStock || 5, product.isActive ? 1 : 0,
              product.categoryId, product.businessUnitId,
              product.images ? JSON.stringify(product.images) : null,
              product.attributes ? JSON.stringify(product.attributes) : null,
              product.id
            );
          } else {
            // Insert new
            db.prepare(`
              INSERT INTO local_products (
                id, name, description, sku, barcode,
                unit_price, cost_price, tax_rate,
                stock, min_stock, is_active,
                category_id, business_unit_id,
                images, attributes, sync_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
            `).run(
              product.id, product.name, product.description, product.sku, product.barcode,
              product.unitPrice, product.costPrice, product.taxRate,
              product.stock || 0, product.minStock || 5, product.isActive ? 1 : 0,
              product.categoryId, product.businessUnitId,
              product.images ? JSON.stringify(product.images) : null,
              product.attributes ? JSON.stringify(product.attributes) : null
            );
          }
          syncedCount++;
        }

        // Update sync metadata
        this.updateSyncMetadata('products', new Date().toISOString());
        logger.info(`Synced ${syncedCount} products`);
      }
    } catch (error) {
      logger.error('Failed to sync products:', error);
      throw error;
    }
  }

  private async syncSales(db: any): Promise<void> {
    try {
      // Sync pending sales to backend
      const pendingSales = db.prepare(`
        SELECT * FROM local_sales 
        WHERE sync_status = 'pending' OR sync_status = 'failed'
        ORDER BY created_at ASC
      `).all() as any[];

      if (pendingSales.length === 0) return;

      const apiUrl = process.env.API_URL || 'http://localhost:3001';
      const token = await this.getAuthToken();

      for (const sale of pendingSales) {
        try {
          // Get sale items
          const items = db.prepare('SELECT * FROM local_sale_items WHERE sale_id = ?').all(sale.id);

          const saleData = {
            id: sale.id,
            receiptNumber: sale.receipt_number,
            subtotal: sale.subtotal,
            tax: sale.tax,
            discount: sale.discount,
            total: sale.total,
            paidAmount: sale.paid_amount,
            changeAmount: sale.change_amount,
            notes: sale.notes,
            status: sale.status,
            customerId: sale.customer_id,
            businessUnitId: sale.business_unit_id,
            userId: sale.user_id,
            items: items.map((item: any) => ({
              productId: item.product_id,
              variantId: item.variant_id,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              total: item.total,
              notes: item.notes,
            })),
            createdAt: sale.created_at,
          };

          const response = await axios.post(`${apiUrl}/api/sales`, saleData, {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.status === 200 || response.status === 201) {
            db.prepare('UPDATE local_sales SET sync_status = "synced", updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(sale.id);
            logger.info(`Sale ${sale.receipt_number} synced successfully`);
          }
        } catch (error) {
          const newAttempts = (sale.sync_attempts || 0) + 1;
          db.prepare('UPDATE local_sales SET sync_status = "failed", sync_attempts = ?, sync_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newAttempts, error instanceof Error ? error.message : 'Unknown error', sale.id);
          logger.error(`Failed to sync sale ${sale.receipt_number}:`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to sync sales:', error);
      throw error;
    }
  }

  private async syncCustomers(db: any): Promise<void> {
    try {
      const apiUrl = process.env.API_URL || 'http://localhost:3001';
      const token = await this.getAuthToken();
      const lastSync = this.getLastSync('customers');

      const response = await axios.get(`${apiUrl}/api/customers`, {
        params: { updatedAfter: lastSync, limit: 1000 },
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.data && response.data.data) {
        const customers = response.data.data;
        let syncedCount = 0;

        for (const customer of customers) {
          const existing = db.prepare('SELECT id FROM local_customers WHERE id = ?').get(customer.id);
          
          if (existing) {
            db.prepare(`
              UPDATE local_customers SET
                email = ?, phone_number = ?, first_name = ?, last_name = ?,
                address = ?, city = ?, state = ?, zip_code = ?, country = ?,
                notes = ?, is_active = ?, loyalty_points = ?,
                total_spent = ?, last_purchase_at = ?, company_id = ?,
                sync_status = 'synced', updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `).run(
              customer.email, customer.phoneNumber, customer.firstName, customer.lastName,
              customer.address, customer.city, customer.state, customer.zipCode, customer.country,
              customer.notes, customer.isActive ? 1 : 0, customer.loyaltyPoints || 0,
              customer.totalSpent || 0, customer.lastPurchaseAt, customer.companyId,
              customer.id
            );
          } else {
            db.prepare(`
              INSERT INTO local_customers (
                id, email, phone_number, first_name, last_name,
                address, city, state, zip_code, country,
                notes, is_active, loyalty_points, total_spent,
                last_purchase_at, company_id, sync_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
            `).run(
              customer.id, customer.email, customer.phoneNumber, customer.firstName, customer.lastName,
              customer.address, customer.city, customer.state, customer.zipCode, customer.country,
              customer.notes, customer.isActive ? 1 : 0, customer.loyaltyPoints || 0,
              customer.totalSpent || 0, customer.lastPurchaseAt, customer.companyId
            );
          }
          syncedCount++;
        }

        this.updateSyncMetadata('customers', new Date().toISOString());
        logger.info(`Synced ${syncedCount} customers`);
      }
    } catch (error) {
      logger.error('Failed to sync customers:', error);
      throw error;
    }
  }

  private getLastSync(entityType: string): string {
    const db = getDatabase();
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(`last_sync_${entityType}`);
    return result ? result.value : '1970-01-01T00:00:00.000Z';
  }

  private updateSyncMetadata(entityType: string, lastSync: string): void {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO sync_metadata (entity_type, last_sync_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `).run(entityType, lastSync);
  }

  private async getAuthToken(): Promise<string> {
    // Get token from secure storage
    // This should be stored by the main process
    const db = getDatabase();
    const result = db.prepare('SELECT value FROM settings WHERE key = "auth_token"').get();
    return result ? result.value : '';
  }

  private logSync(type: string, status: string, message: string, details?: string): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO sync_logs (type, status, message, details)
      VALUES (?, ?, ?, ?)
    `).run(type, status, message, details);
  }

  private startAutoSync(): void {
    const interval = parseInt(process.env.SYNC_INTERVAL || '300'); // 5 minutes default
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      const db = getDatabase();
      const result = db.prepare('SELECT value FROM settings WHERE key = "auto_sync"').get();
      
      if (result && result.value === 'true') {
        await this.syncData();
      }
    }, interval * 1000);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async setAuthToken(token: string): Promise<void> {
    const db = getDatabase();
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ("auth_token", ?, CURRENT_TIMESTAMP)')
      .run(token);
  }

  async clearAuthToken(): Promise<void> {
    const db = getDatabase();
    db.prepare('DELETE FROM settings WHERE key = "auth_token"').run();
  }
}

// Singleton instance
let syncService: SyncService | null = null;

export function getSyncService(): SyncService {
  if (!syncService) {
    syncService = new SyncService();
  }
  return syncService;
}

export function closeSyncService(): void {
  if (syncService) {
    syncService.stopAutoSync();
    syncService = null;
  }
}
