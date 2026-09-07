// src/controllers/receiptController.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { receiptService } from '../services/receiptService.js';
import { notificationService } from '../services/notificationService.js';
import { z } from 'zod';
import * as fs from 'fs';

// Validation schemas
const sendEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const exportSchema = z.object({
  format: z.enum(['csv', 'excel', 'json']).default('csv'),
});

// Helper function to get user ID
function getUserId(req: Request): string {
  const userId = (req as any).user?.id || (req as any).user?.userId;
  if (!userId) {
    throw new AppError('User ID is required', 400);
  }
  return userId;
}

export const receiptController = {
  /**
   * Generate receipt for a sale
   * POST /receipts/generate/:saleId
   */
  async generateReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { saleId } = req.params;
      
      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      const receipt = await receiptService.generateReceipt(saleId);

      res.status(200).json({
        success: true,
        data: receipt,
        message: 'Receipt generated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get receipt by ID
   * GET /receipts/:id
   */
  async getReceiptById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new AppError('Receipt ID is required', 400);
      }

      const receipt = await receiptService.getReceiptById(id);

      res.status(200).json({
        success: true,
        data: receipt,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get receipt by receipt number
   * GET /receipts/number/:receiptNumber
   */
  async getReceiptByNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { receiptNumber } = req.params;
      
      if (!receiptNumber) {
        throw new AppError('Receipt number is required', 400);
      }

      const receipt = await receiptService.getReceiptByNumber(receiptNumber);

      res.status(200).json({
        success: true,
        data: receipt,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Record receipt print
   * POST /receipts/:id/print
   */
  async recordPrint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      if (!id) {
        throw new AppError('Receipt ID is required', 400);
      }

      const receipt = await receiptService.recordPrint(id, userId);

      res.status(200).json({
        success: true,
        data: receipt,
        message: 'Receipt print recorded',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send receipt via email
   * POST /receipts/:id/email
   */
  async sendReceiptEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { email } = sendEmailSchema.parse(req.body);
      
      if (!id) {
        throw new AppError('Receipt ID is required', 400);
      }

      const result = await receiptService.sendReceiptEmail(id, email);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Receipt sent via email',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  },

  /**
   * Get receipt statistics
   * GET /receipts/stats
   */
  async getReceiptStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = req.query;
      const stats = await receiptService.getReceiptStats(businessUnitId as string);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export receipts
   * GET /receipts/export
   */
  async exportReceipts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { format } = exportSchema.parse(req.query);

      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const result = await receiptService.exportReceipts(businessUnitId, format);

      // FIXED: Check if result exists
      if (!result || !result.filePath) {
        throw new AppError('Failed to generate export file', 500);
      }

      // Send file for download
      res.download(result.filePath, result.fileName, (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to download file', 500));
          }
        }
        
        // Clean up file after download - FIXED: Use imported fs instead of require
        setTimeout(() => {
          try {
            if (result.filePath && fs.existsSync(result.filePath)) {
              fs.unlinkSync(result.filePath);
            }
          } catch (error) {
            console.warn('Failed to cleanup export file:', error);
          }
        }, 5000);
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  },

  /**
   * Get all receipts with pagination
   * GET /receipts
   */
  async getAllReceipts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, businessUnitId, startDate, endDate } = req.query;

      const where: any = {};
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const [receipts, total] = await Promise.all([
        prisma.receipt.findMany({
          where,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          include: {
            sale: {
              select: {
                id: true,
                receiptNumber: true,
                total: true,
                saleDate: true,
                customer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            businessUnit: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.receipt.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: receipts,
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          limit: Number(limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get receipt print history
   * GET /receipts/:id/history
   */
  async getReceiptHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Receipt ID is required', 400);
      }

      // FIXED: receiptPrintHistory model doesn't exist, use audit logs instead
      const history = await prisma.auditLog.findMany({
        where: {
          entityType: 'RECEIPT',
          entityId: id,
        },
        orderBy: { createdAt: 'desc' },
      });

      res.status(200).json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      next(error);
    }
  },
};
