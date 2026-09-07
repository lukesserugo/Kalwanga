// src/services/backupService.ts
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream } from 'fs';

const execAsync = promisify(exec);

interface BackupRecord {
  id: string;
  fileName: string;
  filePath: string;
  type: 'full' | 'incremental' | 'export';
  size: number;
  createdAt: Date;
  createdBy?: string;
  status: 'completed' | 'failed' | 'in_progress';
  metadata?: any;
}

export class BackupService {
  private backupDir = path.join(process.cwd(), 'backups');
  private maxBackupAge = 30; // days
  private maxBackupCount = 50; // maximum number of backups to keep

  constructor() {
    this.ensureBackupDirectory();
    this.initializeBackupTracking();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log('Backup directory created:', this.backupDir);
    }
  }

  /**
   * Initialize backup tracking in database
   */
  private async initializeBackupTracking(): Promise<void> {
    try {
      // Create a simple table for backup tracking
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "backup_records" (
          "id" TEXT PRIMARY KEY,
          "fileName" TEXT NOT NULL,
          "filePath" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "size" BIGINT NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdBy" TEXT,
          "status" TEXT NOT NULL DEFAULT 'completed',
          "metadata" JSONB,
          "checksum" TEXT
        );
      `);
    } catch (error) {
      console.warn('Failed to initialize backup tracking table:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Create full database backup
   */
  async createBackup(type: 'full' | 'incremental' = 'full', userId?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${type}_${timestamp}.sql`;
    const filePath = path.join(this.backupDir, fileName);
    const backupId = this.generateId();

    try {
      // Record backup start
      await this.recordBackupStart(backupId, fileName, filePath, type, userId);

      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new AppError('Database URL not configured', 500);
      }

      // Create backup with compression
      const compressedFilePath = `${filePath}.gz`;
      const command = `pg_dump "${databaseUrl}" | gzip > "${compressedFilePath}"`;
      
      console.log(`Starting ${type} backup to ${compressedFilePath}`);
      await execAsync(command, { 
        timeout: 300000, // 5 minutes timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
      });

      // Check if backup file was created
      if (!fs.existsSync(compressedFilePath)) {
        throw new Error('Backup file was not created');
      }

      // Get file stats
      const stats = fs.statSync(compressedFilePath);
      
      // Calculate checksum for integrity verification
      const checksum = await this.calculateChecksum(compressedFilePath);

      // Record backup completion
      await this.recordBackupCompletion(backupId, compressedFilePath, stats.size, checksum);

      console.log(`Backup completed successfully: ${compressedFilePath} (${stats.size} bytes)`);
      
      // Cleanup old backups
      await this.cleanupOldBackups();

      return compressedFilePath;
    } catch (error) {
      console.error('Backup creation failed:', error);
      
      // Record backup failure
      await this.recordBackupFailure(backupId, error instanceof Error ? error : new Error(String(error)));
      
      // Cleanup partial files
      this.cleanupPartialFiles(filePath);
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Export all data as JSON
   */
  async exportAllData(businessUnitId?: string, userId?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `export_${businessUnitId ? 'bu_' + businessUnitId + '_' : ''}${timestamp}.json`;
    const filePath = path.join(this.backupDir, fileName);
    const exportId = this.generateId();

    try {
      // Record export start
      await this.recordBackupStart(exportId, fileName, filePath, 'export', userId);

      console.log('Starting data export...');
      const data: any = {
        metadata: {
          exportedAt: new Date().toISOString(),
          businessUnitId: businessUnitId || 'all',
          version: '1.0',
        },
      };

      // Export all models with proper error handling for each
      const exportOperations = [
        { key: 'users', query: prisma.user.findMany() },
        { key: 'companies', query: prisma.company.findMany() },
        { key: 'businessUnits', query: prisma.businessUnit.findMany({ 
          where: businessUnitId ? { id: businessUnitId } : {} 
        })},
        { key: 'products', query: prisma.product.findMany({ 
          where: businessUnitId ? { businessUnitId } : {},
          include: { category: true },
        })},
        { key: 'categories', query: prisma.category.findMany({ 
          where: businessUnitId ? { businessUnitId } : {} 
        })},
        { key: 'inventory', query: prisma.inventory.findMany({ 
          where: businessUnitId ? { businessUnitId } : {} 
        })},
        { key: 'sales', query: prisma.sale.findMany({ 
          where: businessUnitId ? { businessUnitId } : {},
          include: { items: true }, // Changed from saleItems to items
        })},
        { key: 'customers', query: prisma.customer.findMany() },
        { key: 'suppliers', query: prisma.supplier.findMany() },
        { key: 'purchaseOrders', query: prisma.purchaseOrder.findMany({ 
          where: businessUnitId ? { businessUnitId } : {},
          include: { items: true }, // Changed from purchaseOrderItems to items
        })},
        { key: 'inventoryTransactions', query: prisma.inventoryTransaction.findMany({ 
          where: businessUnitId ? { businessUnitId } : {} 
        }).catch(() => []) },
        { key: 'businessUnitUsers', query: prisma.businessUnitUser.findMany({ 
          where: businessUnitId ? { businessUnitId } : {} 
        }).catch(() => []) },
        { key: 'auditLogs', query: prisma.auditLog.findMany().catch(() => []) },
        { key: 'notifications', query: prisma.notification.findMany().catch(() => []) },
      ];

      // Execute all exports in parallel with error handling
      const results = await Promise.allSettled(
        exportOperations.map(async ({ key, query }) => {
          try {
            const result = await query;
            console.log(`Exported ${key}: ${result.length} records`);
            return { key, data: result, count: result.length };
          } catch (error) {
            console.warn(`Failed to export ${key}:`, error);
            return { key, data: [], count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
          }
        })
      );

      // Build export data
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          data[result.value.key] = result.value.data;
          data.metadata[`${result.value.key}Count`] = result.value.count;
        } else {
          const key = exportOperations[index].key;
          data[key] = [];
          data.metadata[`${key}Count`] = 0;
          data.metadata[`${key}Error`] = result.reason instanceof Error ? result.reason.message : 'Export failed';
        }
      });

      // Write to file with pretty formatting
      const jsonString = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonString, 'utf8');

      // Get file stats
      const stats = fs.statSync(filePath);
      
      // Calculate checksum
      const checksum = await this.calculateChecksum(filePath);

      // Record export completion
      await this.recordBackupCompletion(exportId, filePath, stats.size, checksum, {
        recordCounts: data.metadata,
      });

      console.log(`Data export completed: ${filePath} (${stats.size} bytes)`);
      
      return filePath;
    } catch (error) {
      console.error('Data export failed:', error);
      
      // Record export failure
      await this.recordBackupFailure(exportId, error instanceof Error ? error : new Error(String(error)));
      
      // Cleanup partial files
      this.cleanupPartialFiles(filePath);
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutomaticBackups(): void {
    console.log('Scheduling automatic backups...');
    
    // Daily backup at 2 AM
    const scheduleNextBackup = () => {
      const now = new Date();
      const next2AM = new Date(now);
      next2AM.setHours(2, 0, 0, 0);
      if (next2AM < now) {
        next2AM.setDate(next2AM.getDate() + 1);
      }

      const timeUntilBackup = next2AM.getTime() - now.getTime();
      console.log(`Next backup scheduled in ${Math.round(timeUntilBackup / 1000 / 60)} minutes`);

      setTimeout(() => {
        this.createBackup('full')
          .then(() => {
            console.log('Automatic backup completed successfully');
          })
          .catch((error) => {
            console.error('Automatic backup failed:', error);
          })
          .finally(() => {
            // Schedule next backup
            scheduleNextBackup();
          });
      }, timeUntilBackup);
    };

    // Start the scheduling
    scheduleNextBackup();
  }

  /**
   * List all backups with metadata
   */
  async listBackups(): Promise<BackupRecord[]> {
    try {
      const backupDir = this.backupDir;
      if (!fs.existsSync(backupDir)) {
        return [];
      }

      const files = fs.readdirSync(backupDir)
        .filter(file => file.endsWith('.json') || file.endsWith('.sql') || file.endsWith('.gz'))
        .map(file => {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          
          // Determine backup type from filename
          let type: 'full' | 'incremental' | 'export' = 'export';
          if (file.includes('backup_full')) type = 'full';
          else if (file.includes('backup_incremental')) type = 'incremental';
          else if (file.includes('export')) type = 'export';

          return {
            id: this.generateId(),
            fileName: file,
            filePath,
            type,
            size: stats.size,
            createdAt: stats.mtime,
            status: 'completed' as const,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Try to get additional metadata from database
      try {
        const dbRecords = await prisma.$queryRawUnsafe<any[]>(
          `SELECT * FROM "backup_records" ORDER BY "createdAt" DESC LIMIT 100`
        );

        // Merge file system info with database records
        const dbMap = new Map(dbRecords.map(record => [record.fileName, record]));
        
        return files.map(file => {
          const dbRecord = dbMap.get(file.fileName);
          if (dbRecord) {
            return {
              ...file,
              id: dbRecord.id,
              status: dbRecord.status as 'completed' | 'failed' | 'in_progress',
              metadata: dbRecord.metadata,
            };
          }
          return file;
        });
      } catch (error) {
        console.warn('Failed to fetch backup records from database:', error instanceof Error ? error.message : error);
        return files;
      }
    } catch (error) {
      console.error('List backups error:', error);
      throw new AppError('Failed to list backups', 500);
    }
  }

  /**
   * Restore from backup file
   */
  async restoreBackup(fileName: string): Promise<void> {
    const filePath = path.join(this.backupDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new AppError('Backup file not found', 404);
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new AppError('Database URL not configured', 500);
    }

    try {
      console.log(`Starting restore from ${fileName}...`);
      
      if (fileName.endsWith('.gz')) {
        // Decompress and restore
        const command = `gunzip -c "${filePath}" | psql "${databaseUrl}"`;
        await execAsync(command, { 
          timeout: 600000, // 10 minutes timeout
          maxBuffer: 1024 * 1024 * 50, // 50MB buffer
        });
      } else {
        // Direct restore
        const command = `psql "${databaseUrl}" < "${filePath}"`;
        await execAsync(command, { 
          timeout: 600000,
          maxBuffer: 1024 * 1024 * 50,
        });
      }
      
      console.log(`Restore completed successfully from ${fileName}`);
    } catch (error) {
      console.error('Restore failed:', error);
      throw new AppError(`Failed to restore backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Delete a backup file
   */
  async deleteBackup(fileName: string): Promise<void> {
    const filePath = path.join(this.backupDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      throw new AppError('Backup file not found', 404);
    }

    try {
      fs.unlinkSync(filePath);
      console.log(`Backup deleted: ${fileName}`);
      
      // Update database record
      try {
        await prisma.$executeRawUnsafe(
          `DELETE FROM "backup_records" WHERE "fileName" = $1`,
          fileName
        );
      } catch (error) {
        console.warn('Failed to delete backup record from database:', error instanceof Error ? error.message : error);
      }
    } catch (error) {
      console.error('Delete backup failed:', error);
      throw new AppError(`Failed to delete backup: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  /**
   * Calculate file checksum for integrity verification
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    try {
      const hash = createHash('sha256');
      const fileBuffer = fs.readFileSync(filePath);
      hash.update(fileBuffer);
      return hash.digest('hex');
    } catch (error) {
      console.warn('Failed to calculate checksum:', error instanceof Error ? error.message : error);
      return '';
    }
  }

  /**
   * Record backup start in database
   */
  private async recordBackupStart(
    id: string, 
    fileName: string, 
    filePath: string, 
    type: string, 
    userId?: string
  ): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "backup_records" ("id", "fileName", "filePath", "type", "status", "createdBy", "createdAt", "size") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        id, fileName, filePath, type, 'in_progress', userId || null, new Date(), 0
      );
    } catch (error) {
      console.warn('Failed to record backup start:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Record backup completion in database
   */
  private async recordBackupCompletion(
    id: string, 
    filePath: string, 
    size: number, 
    checksum: string,
    metadata?: any
  ): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "backup_records" 
         SET "status" = $1, "size" = $2, "checksum" = $3, "metadata" = $4
         WHERE "id" = $5`,
        'completed', BigInt(size), checksum, metadata ? JSON.stringify(metadata) : null, id
      );
    } catch (error) {
      console.warn('Failed to record backup completion:', error instanceof Error ? error.message : error);
      // Try to create if update fails
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "backup_records" ("id", "fileName", "filePath", "type", "status", "size", "checksum", "metadata", "createdAt") 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          id, path.basename(filePath), filePath, 'full', 'completed', BigInt(size), checksum, 
          metadata ? JSON.stringify(metadata) : null, new Date()
        );
      } catch (createError) {
        console.warn('Failed to create backup record:', createError instanceof Error ? createError.message : createError);
      }
    }
  }

  /**
   * Record backup failure in database
   */
  private async recordBackupFailure(id: string, error: Error): Promise<void> {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "backup_records" 
         SET "status" = $1, "metadata" = $2
         WHERE "id" = $3`,
        'failed', JSON.stringify({ error: error.message }), id
      );
    } catch (updateError) {
      console.warn('Failed to record backup failure:', updateError instanceof Error ? updateError.message : updateError);
    }
  }

  /**
   * Cleanup partial files after failed operations
   */
  private cleanupPartialFiles(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(`${filePath}.gz`)) {
        fs.unlinkSync(`${filePath}.gz`);
      }
    } catch (error) {
      console.warn('Failed to cleanup partial files:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Cleanup old backups based on age and count
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.json') || file.endsWith('.sql') || file.endsWith('.gz'))
        .map(file => ({
          fileName: file,
          filePath: path.join(this.backupDir, file),
          createdAt: fs.statSync(path.join(this.backupDir, file)).mtime,
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      // Remove files older than maxBackupAge days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.maxBackupAge);

      const oldFiles = files.filter(file => file.createdAt < cutoffDate);
      
      // If too many files, remove oldest ones
      const excessFiles = files.slice(this.maxBackupCount);

      const filesToDelete = [...oldFiles, ...excessFiles];
      
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.filePath);
          console.log(`Cleaned up old backup: ${file.fileName}`);
          
          // Update database
          await prisma.$executeRawUnsafe(
            `DELETE FROM "backup_records" WHERE "fileName" = $1`,
            file.fileName
          );
        } catch (error) {
          console.warn(`Failed to cleanup backup ${file.fileName}:`, error instanceof Error ? error.message : error);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

export const backupService = new BackupService();
