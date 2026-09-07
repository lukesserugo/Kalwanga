// src/controllers/importController.ts
import { Request, Response, NextFunction } from 'express';
import { importService } from '../services/importService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';
import { realtimeService } from '../services/realtimeService.js';
import { logger } from '../lib/logger.js';

// Define file interface
interface ImportFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Type for multer file filter callback
type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

// Type for multer file filter function
type FileFilterFunction = (
  req: Request,
  file: ImportFile,
  callback: FileFilterCallback
) => void;

// Configure multer for memory storage
const fileFilter: FileFilterFunction = (
  req: Request,
  file: ImportFile,
  cb: FileFilterCallback
): void => {
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json',
  ];
  
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.csv', '.xlsx', '.xls', '.json'];
  
  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: fileFilter as any,
});

// Validation schemas
const importOptionsSchema = z.object({
  businessUnitId: z.string().optional(),
  companyId: z.string().optional(),
  skipDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
});

// Helper function to get uploaded file
function getUploadedFile(req: Request): ImportFile | undefined {
  return (req as any).file as ImportFile | undefined;
}

// Helper function to get user ID
function getUserId(req: Request): string {
  const userId = (req as any).user?.id || (req as any).user?.userId;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }
  return userId;
}

// Helper function to handle validation errors
function handleValidationError(error: z.ZodError, res: Response) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  });
}

// Helper function to build success response
function buildImportResponse(result: any) {
  return {
    success: result.failed === 0,
    data: result,
    message: `Import completed: ${result.succeeded} succeeded, ${result.failed} failed out of ${result.total} records`,
  };
}

export const importController = {
  /**
   * Import products
   * POST /import/products
   */
  async importProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = getUploadedFile(req);
      const userId = getUserId(req);
      const options = importOptionsSchema.parse(req.body);

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const result = await importService.importProducts(file, {
        ...options,
        userId,
      });

      // Emit realtime event
      try {
        realtimeService.emitExportCompleted(
          { type: 'import_products', ...result },
          options.businessUnitId || ''
        );
      } catch (wsError) {
        logger.warn('Failed to emit import event:', wsError);
      }

      res.status(200).json(buildImportResponse(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error, res);
        return;
      }
      next(error);
    }
  },

  /**
   * Import customers
   * POST /import/customers
   */
  async importCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = getUploadedFile(req);
      const userId = getUserId(req);
      const options = importOptionsSchema.parse(req.body);

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const result = await importService.importCustomers(file, {
        ...options,
        userId,
      });

      res.status(200).json(buildImportResponse(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error, res);
        return;
      }
      next(error);
    }
  },

  /**
   * Import suppliers
   * POST /import/suppliers
   */
  async importSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = getUploadedFile(req);
      const userId = getUserId(req);
      const options = importOptionsSchema.parse(req.body);

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const result = await importService.importSuppliers(file, {
        ...options,
        userId,
      });

      res.status(200).json(buildImportResponse(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error, res);
        return;
      }
      next(error);
    }
  },

  /**
   * Import inventory updates
   * POST /import/inventory
   */
  async importInventory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = getUploadedFile(req);
      const userId = getUserId(req);
      const options = importOptionsSchema.parse(req.body);

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const result = await importService.importInventory(file, {
        ...options,
        userId,
      });

      res.status(200).json(buildImportResponse(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error, res);
        return;
      }
      next(error);
    }
  },

  /**
   * Import users
   * POST /import/users
   */
  async importUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = getUploadedFile(req);
      const userId = getUserId(req);
      const options = importOptionsSchema.parse(req.body);

      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const result = await importService.importUsers(file, {
        ...options,
        userId,
      });

      res.status(200).json(buildImportResponse(result));
    } catch (error) {
      if (error instanceof z.ZodError) {
        handleValidationError(error, res);
        return;
      }
      next(error);
    }
  },

  /**
   * Download import template
   * GET /import/template/:type
   */
  async downloadTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { type } = req.params;

      if (!type) {
        throw new AppError('Template type is required', 400);
      }

      const filePath = await importService.downloadTemplate(type);

      res.download(filePath, path.basename(filePath), (err: Error | null) => {
        if (err) {
          logger.error('Template download error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to download template', 500));
          }
        }
        
        setTimeout(() => {
          try {
            fs.unlinkSync(filePath);
          } catch (error) {
            logger.warn('Failed to cleanup template file:', error);
          }
        }, 5000);
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get import history
   * GET /import/history
   */
  async getImportHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const importDir = path.join(process.cwd(), 'uploads', 'imports');

      if (!fs.existsSync(importDir)) {
        res.json({ success: true, data: [] });
        return;
      }

      const files = fs.readdirSync(importDir)
        .filter((file: string) => {
          const ext = path.extname(file).toLowerCase();
          return ['.csv', '.xlsx', '.xls', '.json'].includes(ext);
        })
        .map((file: string) => {
          const stats = fs.statSync(path.join(importDir, file));
          return {
            fileName: file,
            size: stats.size,
            sizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
            createdAt: stats.mtime,
            format: path.extname(file).toLowerCase().replace('.', ''),
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      res.json({
        success: true,
        data: files,
        count: files.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get import status
   * GET /import/status
   */
  async getImportStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json({
        success: true,
        data: {
          supportedFormats: ['CSV', 'Excel (XLSX, XLS)', 'JSON'],
          maxFileSize: '50MB',
          supportedEntities: ['Products', 'Customers', 'Suppliers', 'Inventory', 'Users'],
          duplicateHandling: ['Skip duplicates', 'Update existing'],
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
