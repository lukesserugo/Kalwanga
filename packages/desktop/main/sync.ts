// packages/desktop/main/sync.ts
import { getDatabase } from './database.js';
import { logger } from './logger.js';
import axios from 'axios';

interface SyncResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}

function serializeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.message}${error.stack ? `\n${error.stack}` : ''}`;
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error, Object.getOwnPropertyNames(error as object), 2);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

type DB = any;

class SyncService {
  public isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Base URL of the backend. Every request goes through this so that
   * there's only one place to update if the API moves.
   */
  private get apiBase(): string {
    return process.env.API_URL || 'http://localhost:3001';
  }

  constructor() {
    this.startAutoSync();
  }

  async syncData(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      logger.info('Starting data sync...');

      const isOnline = await this.checkOnline();
      if (!isOnline) {
        logger.warn('Sync skipped: backend not reachable');
        return { success: false, message: 'No internet connection' };
      }

      const db: DB = getDatabase();

      await this.syncOfflineQueue(db);
      await this.syncProducts(db);
      await this.syncSales(db);
      await this.syncCustomers(db);

      const now = new Date().toISOString();
      db.prepare(
        "UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'last_sync'"
      ).run(now);

      this.logSync('full_sync', 'success', 'Full sync completed successfully');

      logger.info('Data sync completed successfully');
      return { success: true, message: 'Sync completed successfully' };
    } catch (error) {
      logger.error('Sync failed:', serializeError(error));
      this.logSync(
        'full_sync',
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return {
        success: false,
        message: 'Sync failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    } finally {
      this.isSyncing = false;
    }
  }

  private async checkOnline(): Promise<boolean> {
    try {
      await axios.get(`${this.apiBase}/health`, { timeout: 5000 });
      return true;
    } catch (error) {
      logger.debug('checkOnline failed:', serializeError(error));
      return false;
    }
  }

  private async syncOfflineQueue(db: DB): Promise<void> {
    const pendingOperations: any[] = db
      .prepare(
        `SELECT * FROM offline_queue 
         WHERE status = 'pending' 
         ORDER BY created_at ASC`
      )
      .all();

    if (pendingOperations.length === 0) return;

    logger.info(`Syncing ${pendingOperations.length} pending operations`);

    const token = await this.getAuthToken();

    for (const op of pendingOperations) {
      try {
        const response = await axios({
          method: op.operation,
          url: `${this.apiBase}/${op.entity_type}/${op.entity_id}`,
          data: JSON.parse(op.data),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.status === 200 || response.status === 201) {
          db.prepare(
            `UPDATE offline_queue 
             SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
          ).run(op.id);
          logger.info(`Operation ${op.id} synced successfully`);
        }
      } catch (error) {
        const newRetryCount = (op.retry_count || 0) + 1;
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        if (newRetryCount >= op.max_retries) {
          db.prepare(
            `UPDATE offline_queue 
             SET status = 'failed', retry_count = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
          ).run(newRetryCount, errorMessage, op.id);
          logger.error(
            `Operation ${op.id} failed after ${newRetryCount} retries: ${errorMessage}`
          );
        } else {
          db.prepare(
            `UPDATE offline_queue 
             SET retry_count = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
          ).run(newRetryCount, op.id);
        }
      }
    }
  }

  private async syncProducts(db: DB): Promise<void> {
    try {
      const token = await this.getAuthToken();
      const lastSync = this.getLastSync('products');

      const response = await axios.get(`${this.apiBase}/products`, {
        params: { updatedAfter: lastSync, limit: 1000 },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data && response.data.data) {
        const products: any[] = response.data.data;
        let syncedCount = 0;

        for (const product of products) {
          const existing = db
            .prepare('SELECT id FROM local_products WHERE id = ?')
            .get(product.id);

          if (existing) {
            db.prepare(
              `UPDATE local_products SET
                 name = ?, description = ?, sku = ?, barcode = ?,
                 unit_price = ?, cost_price = ?, tax_rate = ?,
                 stock = ?, min_stock = ?, is_active = ?,
                 category_id = ?, business_unit_id = ?,
                 images = ?, attributes = ?,
                 sync_status = 'synced', updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            ).run(
              product.name,
              product.description,
              product.sku,
              product.barcode,
              product.unitPrice,
              product.costPrice,
              product.taxRate,
              product.stock || 0,
              product.minStock || 5,
              product.isActive ? 1 : 0,
              product.categoryId,
              product.businessUnitId,
              product.images ? JSON.stringify(product.images) : null,
              product.attributes ? JSON.stringify(product.attributes) : null,
              product.id
            );
          } else {
            db.prepare(
              `INSERT INTO local_products (
                 id, name, description, sku, barcode,
                 unit_price, cost_price, tax_rate,
                 stock, min_stock, is_active,
                 category_id, business_unit_id,
                 images, attributes, sync_status
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`
            ).run(
              product.id,
              product.name,
              product.description,
              product.sku,
              product.barcode,
              product.unitPrice,
              product.costPrice,
              product.taxRate,
              product.stock || 0,
              product.minStock || 5,
              product.isActive ? 1 : 0,
              product.categoryId,
              product.businessUnitId,
              product.images ? JSON.stringify(product.images) : null,
              product.attributes ? JSON.stringify(product.attributes) : null
            );
          }
          syncedCount++;
        }

        this.updateSyncMetadata('products', new Date().toISOString());
        logger.info(`Synced ${syncedCount} products`);
      } else {
        logger.warn(
          'Products response did not contain a data array:',
          JSON.stringify(response.data)?.slice(0, 500)
        );
      }
    } catch (error) {
      logger.error('Failed to sync products:', serializeError(error));
      throw error;
    }
  }

  private async syncSales(db: DB): Promise<void> {
    try {
      const pendingSales: any[] = db
        .prepare(
          `SELECT * FROM local_sales 
           WHERE sync_status = 'pending' OR sync_status = 'failed'
           ORDER BY created_at ASC`
        )
        .all();

      if (pendingSales.length === 0) return;

      const token = await this.getAuthToken();

      for (const sale of pendingSales) {
        try {
          const items: any[] = db
            .prepare('SELECT * FROM local_sale_items WHERE sale_id = ?')
            .all(sale.id);

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

          const response = await axios.post(`${this.apiBase}/sales`, saleData, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (response.status === 200 || response.status === 201) {
            db.prepare(
              `UPDATE local_sales 
               SET sync_status = 'synced', updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`
            ).run(sale.id);
            logger.info(`Sale ${sale.receipt_number} synced successfully`);
          }
        } catch (error) {
          const newAttempts = (sale.sync_attempts || 0) + 1;
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          db.prepare(
            `UPDATE local_sales 
             SET sync_status = 'failed', sync_attempts = ?, sync_error = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?`
          ).run(newAttempts, errorMessage, sale.id);

          logger.error(
            `Failed to sync sale ${sale.receipt_number}: ${serializeError(error)}`
          );
        }
      }
    } catch (error) {
      logger.error('Failed to sync sales:', serializeError(error));
      throw error;
    }
  }

  private async syncCustomers(db: DB): Promise<void> {
    try {
      const token = await this.getAuthToken();
      const lastSync = this.getLastSync('customers');

      const response = await axios.get(`${this.apiBase}/customers`, {
        params: { updatedAfter: lastSync, limit: 1000 },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data && response.data.data) {
        const customers: any[] = response.data.data;
        let syncedCount = 0;

        for (const customer of customers) {
          const existing = db
            .prepare('SELECT id FROM local_customers WHERE id = ?')
            .get(customer.id);

          if (existing) {
            db.prepare(
              `UPDATE local_customers SET
                 email = ?, phone_number = ?, first_name = ?, last_name = ?,
                 address = ?, city = ?, state = ?, zip_code = ?, country = ?,
                 notes = ?, is_active = ?, loyalty_points = ?,
                 total_spent = ?, last_purchase_at = ?, company_id = ?,
                 sync_status = 'synced', updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`
            ).run(
              customer.email,
              customer.phoneNumber,
              customer.firstName,
              customer.lastName,
              customer.address,
              customer.city,
              customer.state,
              customer.zipCode,
              customer.country,
              customer.notes,
              customer.isActive ? 1 : 0,
              customer.loyaltyPoints || 0,
              customer.totalSpent || 0,
              customer.lastPurchaseAt,
              customer.companyId,
              customer.id
            );
          } else {
            db.prepare(
              `INSERT INTO local_customers (
                 id, email, phone_number, first_name, last_name,
                 address, city, state, zip_code, country,
                 notes, is_active, loyalty_points, total_spent,
                 last_purchase_at, company_id, sync_status
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`
            ).run(
              customer.id,
              customer.email,
              customer.phoneNumber,
              customer.firstName,
              customer.lastName,
              customer.address,
              customer.city,
              customer.state,
              customer.zipCode,
              customer.country,
              customer.notes,
              customer.isActive ? 1 : 0,
              customer.loyaltyPoints || 0,
              customer.totalSpent || 0,
              customer.lastPurchaseAt,
              customer.companyId
            );
          }
          syncedCount++;
        }

        this.updateSyncMetadata('customers', new Date().toISOString());
        logger.info(`Synced ${syncedCount} customers`);
      } else {
        logger.warn(
          'Customers response did not contain a data array:',
          JSON.stringify(response.data)?.slice(0, 500)
        );
      }
    } catch (error) {
      logger.error('Failed to sync customers:', serializeError(error));
      throw error;
    }
  }

  private getLastSync(entityType: string): string {
    const db: DB = getDatabase();
    const result = db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(`last_sync_${entityType}`);
    return result
      ? (result as { value: string }).value
      : '1970-01-01T00:00:00.000Z';
  }

  private updateSyncMetadata(entityType: string, lastSync: string): void {
    const db: DB = getDatabase();
    db.prepare(
      `INSERT OR REPLACE INTO sync_metadata (entity_type, last_sync_at, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`
    ).run(entityType, lastSync);
  }

  private async getAuthToken(): Promise<string> {
    const db: DB = getDatabase();
    const result = db
      .prepare("SELECT value FROM settings WHERE key = 'auth_token'")
      .get();
    return result ? (result as { value: string }).value : '';
  }

  private logSync(
    type: string,
    status: string,
    message: string,
    details?: string
  ): void {
    try {
      const db: DB = getDatabase();
      db.prepare(
        `INSERT INTO sync_logs (type, status, message, details)
         VALUES (?, ?, ?, ?)`
      ).run(type, status, message, details ?? null);
    } catch (error) {
      logger.error('Failed to write sync_log:', serializeError(error));
    }
  }

  private startAutoSync(): void {
    const interval = parseInt(process.env.SYNC_INTERVAL || '300', 10);

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        const db: DB = getDatabase();
        const result = db
          .prepare("SELECT value FROM settings WHERE key = 'auto_sync'")
          .get();

        if (result && (result as { value: string }).value === 'true') {
          await this.syncData();
        }
      } catch (error) {
        logger.error('Auto-sync tick failed:', serializeError(error));
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
    const db: DB = getDatabase();
    db.prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at)
       VALUES ('auth_token', ?, CURRENT_TIMESTAMP)`
    ).run(token);
  }

  async clearAuthToken(): Promise<void> {
    const db: DB = getDatabase();
    db.prepare("DELETE FROM settings WHERE key = 'auth_token'").run();
  }
}

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
