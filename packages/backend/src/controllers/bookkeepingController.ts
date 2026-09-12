// src/controllers/bookkeepingController.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { bookkeepingService } from '../services/bookkeepingService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createJournalEntrySchema = z.object({
  description: z.string().min(1, 'Description is required'),
  reference: z.string().optional(),
  date: z.string().or(z.date()).optional(),
  lines: z.array(z.object({
    accountId: z.string().min(1, 'Account ID is required'),
    debit: z.number().min(0, 'Debit must be positive'),
    credit: z.number().min(0, 'Credit must be positive'),
    description: z.string().optional(),
  })).min(1, 'At least one line is required'),
});

const calculateTaxSchema = z.object({
  subtotal: z.number().min(0, 'Subtotal must be positive'),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

const handleValidationError = (error: z.ZodError, res: Response) => {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map((e: z.ZodIssue) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  });
};

const getBusinessUnitId = (req: Request): string => {
  const businessUnitId = req.user?.businessUnitId;
  if (!businessUnitId) {
    throw new AppError('Business unit required', 400);
  }
  return businessUnitId;
};

const getUserId = (req: Request): string => {
  const userId = req.user?.id || req.user?.userId;
  if (!userId) {
    throw new AppError('User ID required', 400);
  }
  return userId;
};

// ============================================
// CONTROLLER
// ============================================

export const bookkeepingController = {
  /**
   * Get journal entries
   * GET /bookkeeping/journal-entries
   */
  async getJournalEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = getBusinessUnitId(req);
      const { page = 1, limit = 50, startDate, endDate } = req.query;
      
      const where: any = { businessUnitId };
      
      if (startDate || endDate) {
        where.date = {};
        if (startDate) where.date.gte = new Date(startDate as string);
        if (endDate) where.date.lte = new Date(endDate as string);
      }

      const [entries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          include: { 
            lines: { 
              include: { account: true },
            },
          },
          orderBy: { date: 'desc' },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
        }),
        prisma.journalEntry.count({ where }),
      ]);

      res.json({ 
        success: true, 
        data: entries,
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
   * Create journal entry
   * POST /bookkeeping/journal-entries
   */
  async createJournalEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = getUserId(req);
      const businessUnitId = getBusinessUnitId(req);
      
      const validatedData = createJournalEntrySchema.parse(req.body);
      const { description, reference, lines, date } = validatedData;
      
      const entry = await bookkeepingService.createJournalEntry({
        businessUnitId,
        createdBy: userId,
        description,
        reference,
        date: date ? new Date(date) : new Date(),
        lines,
      });

      res.status(201).json({ 
        success: true, 
        data: entry,
        message: 'Journal entry created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      next(error);
    }
  },

  /**
   * Get accounts
   * GET /bookkeeping/accounts
   */
  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = getBusinessUnitId(req);

      const accounts = await prisma.account.findMany({
        where: { businessUnitId, isActive: true },
        include: { 
          lines: {
            take: 10,
          },
        },
        orderBy: { code: 'asc' },
      });

      res.json({ 
        success: true, 
        data: accounts,
        count: accounts.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get account by ID
   * GET /bookkeeping/accounts/:id
   */
  async getAccountById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = getBusinessUnitId(req);
      
      if (!id) {
        throw new AppError('Account ID is required', 400);
      }

      const account = await prisma.account.findFirst({
        where: { 
          id,
          businessUnitId, // Ensure account belongs to the business unit
        },
        include: { 
          lines: {
            include: { journalEntry: true },
          },
        },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      res.json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate balance sheet
   * GET /bookkeeping/reports/balance-sheet
   */
  async generateBalanceSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = getBusinessUnitId(req);

      const balanceSheet = await bookkeepingService.generateBalanceSheet(businessUnitId);
      
      res.json({ 
        success: true, 
        data: balanceSheet,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate income statement
   * GET /bookkeeping/reports/income-statement
   */
  async generateIncomeStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const report = await bookkeepingService.generateFinancialReport(
        businessUnitId,
        startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        endDate ? new Date(endDate as string) : new Date()
      );

      res.json({ 
        success: true, 
        data: report,
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate trial balance
   * GET /bookkeeping/reports/trial-balance
   */
  async generateTrialBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = getBusinessUnitId(req);

      const trialBalance = await bookkeepingService.generateTrialBalance(businessUnitId);
      
      // Calculate totals
      const totalDebits = trialBalance.reduce((sum: number, account: any) => sum + (account.debit || 0), 0);
      const totalCredits = trialBalance.reduce((sum: number, account: any) => sum + (account.credit || 0), 0);
      
      res.json({ 
        success: true, 
        data: trialBalance,
        summary: {
          totalDebits,
          totalCredits,
          isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
          difference: totalDebits - totalCredits,
        },
        generatedAt: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Record sale in journal
   * POST /bookkeeping/record-sale/:saleId
   */
  async recordSale(req: Request, res: Response, next: NextFunction) {
    try {
      const { saleId } = req.params;
      const businessUnitId = getBusinessUnitId(req);
      
      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }

      const entries = await bookkeepingService.recordSale(saleId, businessUnitId);
      
      res.status(201).json({ 
        success: true, 
        data: entries,
        message: 'Sale recorded in journal successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Calculate tax
   * POST /bookkeeping/calculate-tax
   */
  async calculateTax(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = getBusinessUnitId(req);
      
      const validatedData = calculateTaxSchema.parse(req.body);
      const { subtotal } = validatedData;

      const taxCalculation = await bookkeepingService.calculateTax(
        subtotal,
        businessUnitId
      );
      
      res.json({ 
        success: true, 
        data: taxCalculation,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      next(error);
    }
  },

  /**
   * Get account balance
   * GET /bookkeeping/accounts/:id/balance
   */
  async getAccountBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = getBusinessUnitId(req);
      
      if (!id) {
        throw new AppError('Account ID is required', 400);
      }

      const balance = await bookkeepingService.getAccountBalance(id, businessUnitId);
      
      res.json({ 
        success: true, 
        data: balance,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get journal entry by ID
   * GET /bookkeeping/journal-entries/:id
   */
  async getJournalEntryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = getBusinessUnitId(req);
      
      if (!id) {
        throw new AppError('Journal entry ID is required', 400);
      }

      const entry = await prisma.journalEntry.findFirst({
        where: { 
          id,
          businessUnitId,
        },
        include: { 
          lines: { 
            include: { account: true },
          },
        },
      });

      if (!entry) {
        throw new AppError('Journal entry not found', 404);
      }

      res.json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Void journal entry
   * POST /bookkeeping/journal-entries/:id/void
   */
  async voidJournalEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const businessUnitId = getBusinessUnitId(req);
      
      if (!id) {
        throw new AppError('Journal entry ID is required', 400);
      }

      const entry = await bookkeepingService.voidJournalEntry(id, businessUnitId, userId);
      
      res.json({ 
        success: true, 
        data: entry,
        message: 'Journal entry voided successfully',
      });
    } catch (error) {
      next(error);
    }
  },
};

export default bookkeepingController;