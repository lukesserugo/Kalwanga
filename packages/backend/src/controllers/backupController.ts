// src/controllers/backupController.ts
import { Request, Response, NextFunction } from 'express';
import { backupService } from '../services/backupService.js';
import { AppError } from '../middleware/errorHandler.js';
import * as fs from 'fs';
import * as path from 'path';

export const backupController = {
  /**
   * Create a new backup
   * POST /backups
   */
  async createBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const { type = 'full' } = req.body;
      const userId = (req as any).user?.id;
      
      // Validate backup type
      if (!['full', 'incremental'].includes(type)) {
        throw new AppError('Invalid backup type. Must be "full" or "incremental"', 400);
      }
      
      const filePath = await backupService.createBackup(type, userId);
      
      res.status(201).json({
        success: true,
        data: { 
          filePath,
          fileName: path.basename(filePath),
          type,
          createdAt: new Date(),
        },
        message: 'Backup created successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export all data
   * POST /backups/export
   */
  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const userId = (req as any).user?.id;
      
      const filePath = await backupService.exportAllData(businessUnitId, userId);
      
      res.status(201).json({
        success: true,
        data: { 
          filePath,
          fileName: path.basename(filePath),
          createdAt: new Date(),
        },
        message: 'Data exported successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List all backups
   * GET /backups
   */
  async listBackups(req: Request, res: Response, next: NextFunction) {
    try {
      const backups = await backupService.listBackups();
      
      res.json({ 
        success: true, 
        data: backups,
        count: backups.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Download a backup file
   * GET /backups/:fileName/download
   */
  async downloadBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileName } = req.params;
      
      if (!fileName) {
        throw new AppError('File name is required', 400);
      }
      
      // Prevent path traversal
      const sanitizedFileName = path.basename(fileName);
      const filePath = path.join(process.cwd(), 'backups', sanitizedFileName);
      
      if (!fs.existsSync(filePath)) {
        throw new AppError('Backup file not found', 404);
      }
      
      res.download(filePath, sanitizedFileName, (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to download backup', 500));
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Restore from backup
   * POST /backups/:fileName/restore
   */
  async restoreBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileName } = req.params;
      
      if (!fileName) {
        throw new AppError('File name is required', 400);
      }
      
      await backupService.restoreBackup(fileName);
      
      res.json({
        success: true,
        message: 'Backup restored successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete a backup
   * DELETE /backups/:fileName
   */
  async deleteBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileName } = req.params;
      
      if (!fileName) {
        throw new AppError('File name is required', 400);
      }
      
      await backupService.deleteBackup(fileName);
      
      res.json({
        success: true,
        message: 'Backup deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get backup status
   * GET /backups/status
   */
  async getBackupStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const backups = await backupService.listBackups();
      
      const status = {
        totalBackups: backups.length,
        lastBackup: backups[0] || null,
        oldestBackup: backups[backups.length - 1] || null,
        totalSize: backups.reduce((sum, backup) => sum + (backup.size || 0), 0),
        backupDirectory: path.join(process.cwd(), 'backups'),
      };
      
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Trigger automatic backup scheduling
   * POST /backups/schedule
   */
  async scheduleBackups(req: Request, res: Response, next: NextFunction) {
    try {
      backupService.scheduleAutomaticBackups();
      
      res.json({
        success: true,
        message: 'Automatic backup scheduling started',
      });
    } catch (error) {
      next(error);
    }
  },
};
