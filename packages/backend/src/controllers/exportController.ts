// src/controllers/exportController.ts
import { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/exportService.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { realtimeService } from '../services/realtimeService.js';
import { logger } from '../lib/logger.js';

// Validation schemas
const exportSalesSchema = z.object({
  businessUnitId: z.string().min(1, 'Business unit ID is required'),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

const exportInventorySchema = z.object({
  businessUnitId: z.string().min(1, 'Business unit ID is required'),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

const exportCustomersSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

const exportProductsSchema = z.object({
  businessUnitId: z.string().min(1, 'Business unit ID is required'),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

const exportSuppliersSchema = z.object({
  companyId: z.string().min(1, 'Company ID is required'),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

const exportPaymentsSchema = z.object({
  businessUnitId: z.string().optional(),
  startDate: z.string().datetime('Invalid start date'),
  endDate: z.string().datetime('Invalid end date'),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

const exportPurchaseOrdersSchema = z.object({
  businessUnitId: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.string().optional(),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

// Helper function to send file for download
function sendFileForDownload(res: Response, filePath: string, fileName: string, next: NextFunction) {
  res.download(filePath, fileName, (err) => {
    if (err) {
      logger.error('Download error:', err);
      if (!res.headersSent) {
        next(new AppError('Failed to download file', 500));
      }
    }
    
    // Clean up file after download
    setTimeout(() => {
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        logger.warn('Failed to cleanup export file:', error);
      }
    }, 5000);
  });
}

export const exportController = {
  /**
   * Export sales data
   * POST /export/sales
   */
  async exportSales(req: Request, res: Response, next: NextFunction) {
    try {
      const data = exportSalesSchema.parse(req.body);
      
      const result = await exportService.exportSales(
        data.businessUnitId,
        new Date(data.startDate),
        new Date(data.endDate),
        data.format
      );

      logger.info(`Sales export completed: ${result.totalRecords} records`);
      
      sendFileForDownload(res, result.filePath, result.fileName, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      next(error);
    }
  },

  /**
   * Export sales data (GET variant)
   * GET /export/sales
   */
  async exportSalesGet(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, startDate, endDate, format = 'csv' } = req.query;
      
      if (!businessUnitId || !startDate || !endDate) {
        throw new AppError('Business unit ID, start date, and end date are required', 400);
      }

      const result = await exportService.exportSales(
        businessUnitId as string,
        new Date(startDate as string),
        new Date(endDate as string),
        format as string
      );

      sendFileForDownload(res, result.filePath, result.fileName, next);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export inventory data
   * POST /export/inventory
   */
  async exportInventory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = exportInventorySchema.parse(req.body);
      
      const result = await exportService.exportInventory(
        data.businessUnitId,
        data.format
      );

      logger.info(`Inventory export completed: ${result.totalRecords} records`);
      
      sendFileForDownload(res, result.filePath, result.fileName, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      next(error);
    }
  },

  /**
   * Export customers data
   * POST /export/customers
   */
  async exportCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = exportCustomersSchema.parse(req.body);
      
      const result = await exportService.exportCustomers(
        data.companyId,
        data.format
      );

      logger.info(`Customers export completed: ${result.totalRecords} records`);
      
      sendFileForDownload(res, result.filePath, result.fileName, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      next(error);
    }
  },

  /**
   * Export products data
   * POST /export/products
   */
  async exportProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const data = exportProductsSchema.parse(req.body);
      
      const result = await exportService.exportProducts(
        data.businessUnitId,
        data.format
      );

      logger.info(`Products export completed: ${result.totalRecords} records`);
      
      sendFileForDownload(res, result.filePath, result.fileName, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      next(error);
    }
  },

  /**
   * Export suppliers data
   * POST /export/suppliers
   */
  async exportSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = exportSuppliersSchema.parse(req.body);
      
      const result = await exportService.exportSuppliers(
        data.companyId,
        data.format
      );

      logger.info(`Suppliers export completed: ${result.totalRecords} records`);
      
      sendFileForDownload(res, result.filePath, result.fileName, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      next(error);
    }
  },

  /**
   * Export payments data
   * POST /export/payments
   */
  async exportPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const data = exportPaymentsSchema.parse(req.body);
      
      const result = await exportService.exportPayments(
        data.businessUnitId,
        new Date(data.startDate),
        new Date(data.endDate),
        data.format
      );

      logger.info(`Payments export completed: ${result.totalRecords} records`);
      
      sendFileForDownload(res, result.filePath, result.fileName, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      next(error);
    }
  },

  /**
   * Export purchase orders
   * POST /export/purchase-orders
   */
  async exportPurchaseOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const data = exportPurchaseOrdersSchema.parse(req.body);
      
      const result = await exportService.exportPurchaseOrders(
        data.businessUnitId,
        data.startDate ? new Date(data.startDate) : undefined,
        data.endDate ? new Date(data.endDate) : undefined,
        data.status,
        data.format
      );

      logger.info(`Purchase orders export completed: ${result.totalRecords} records`);
      
      sendFileForDownload(res, result.filePath, result.fileName, next);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
        });
      }
      next(error);
    }
  },

  /**
   * Get export history
   * GET /export/history
   */
  async getExportHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const history = await exportService.getExportHistory();

      res.json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Download exported file
   * GET /export/download/:fileName
   */
  async downloadExport(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        throw new AppError('File name is required', 400);
      }

      const safeFileName = path.basename(fileName);
      const filePath = path.join(process.cwd(), 'exports', safeFileName);

      if (!fs.existsSync(filePath)) {
        throw new AppError('Export file not found', 404);
      }

      res.download(filePath, safeFileName, (err) => {
        if (err) {
          logger.error('Download error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to download file', 500));
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete exported file
   * DELETE /export/:fileName
   */
  async deleteExport(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileName } = req.params;

      if (!fileName) {
        throw new AppError('File name is required', 400);
      }

      await exportService.deleteExportFile(fileName);

      res.json({
        success: true,
        message: 'Export file deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};
