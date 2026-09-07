// src/controllers/taxController.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { taxService } from '../services/taxService.js';
import { z } from 'zod';

// Validation schemas
const fileTaxReturnSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
});

const updateTaxSettingsSchema = z.object({
  taxRate: z.number().min(0).max(100).optional(),
  taxId: z.string().optional(),
  taxExempt: z.boolean().optional(),
  filingFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  autoCalculate: z.boolean().optional(),
  taxCategories: z.array(z.string()).optional(),
});

export const taxController = {
  /**
   * Get tax summary
   * GET /tax/summary
   */
  async getTaxSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { period } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      if (!period) {
        throw new AppError('Period required', 400);
      }

      const summary = await taxService.generateTaxSummary(businessUnitId, period as string);

      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get tax records with filtering
   * GET /tax/records
   */
  async getTaxRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { period, taxType, filingStatus, page, limit, startDate, endDate } = req.query;

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const result = await taxService.getTaxRecords({
        businessUnitId,
        period: period as string,
        taxType: taxType as string,
        filingStatus: filingStatus as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: result.records,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get filing status
   * GET /tax/filing-status
   */
  async getFilingStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const status = await taxService.getFilingStatus(businessUnitId);

      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  },

  /**
   * File tax return
   * POST /tax/file
   */
  async fileTaxReturn(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { period } = fileTaxReturnSchema.parse(req.body);

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const result = await taxService.fileTaxReturn(businessUnitId, period);

      res.json({
        success: true,
        data: result,
        message: 'Tax return filed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get tax settings
   * GET /tax/settings
   */
  async getTaxSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const settings = await taxService.getTaxSettings(businessUnitId);

      res.json({ success: true, data: settings });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update tax settings
   * PUT /tax/settings
   */
  async updateTaxSettings(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const data = updateTaxSettingsSchema.parse(req.body);

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const settings = await taxService.updateTaxSettings(businessUnitId, data);

      res.json({
        success: true,
        data: settings,
        message: 'Tax settings updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Generate tax report
   * GET /tax/report
   */
  async generateTaxReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { period } = req.query;

      if (!businessUnitId || !period) {
        throw new AppError('Business unit and period required', 400);
      }

      const report = await taxService.generateTaxReport(businessUnitId, period as string);

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Export tax records
   * GET /tax/export
   */
  async exportTaxRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { period, format = 'csv' } = req.query;

      if (!businessUnitId || !period) {
        throw new AppError('Business unit and period required', 400);
      }

      const result = await taxService.exportTaxRecords(
        businessUnitId,
        period as string,
        format as 'csv' | 'excel' | 'json'
      );

      res.download(result.filePath, result.fileName, (err) => {
        if (err) {
          console.error('Download error:', err);
          if (!res.headersSent) {
            next(new AppError('Failed to download file', 500));
          }
        }
        
        setTimeout(() => {
          try {
            const fs = require('fs');
            fs.unlinkSync(result.filePath);
          } catch (error) {
            console.warn('Failed to cleanup export file:', error);
          }
        }, 5000);
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Calculate tax for a transaction
   * POST /tax/calculate
   */
  async calculateTax(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { subtotal } = req.body;

      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      if (subtotal === undefined || subtotal < 0) {
        throw new AppError('Valid subtotal is required', 400);
      }

      const calculation = await taxService.calculateTax(subtotal, businessUnitId);

      res.json({ success: true, data: calculation });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Record sale tax
   * POST /tax/record/:saleId
   */
  async recordSaleTax(req: Request, res: Response, next: NextFunction) {
    try {
      const { saleId } = req.params;

      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      const taxRecord = await taxService.recordSaleTax(saleId);

      res.status(201).json({
        success: true,
        data: taxRecord,
        message: 'Tax recorded successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};
