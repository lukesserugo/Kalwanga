// src/controllers/bookkeepingController.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { bookkeepingService } from '../services/bookkeepingService.js';
import { AppError } from '../middleware/errorHandler.js';

export const bookkeepingController = {
  /**
   * Get journal entries
   * GET /bookkeeping/journal-entries
   */
  async getJournalEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { page = 1, limit = 50, startDate, endDate } = req.query;
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

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
      const { id: userId, businessUnitId } = (req as any).user || {};
      const { description, reference, lines, date = new Date() } = req.body;
      
      if (!userId || !businessUnitId) {
        throw new AppError('User and business unit required', 400);
      }
      
      if (!description || !lines || !Array.isArray(lines)) {
        throw new AppError('Description and lines are required', 400);
      }

      const entry = await bookkeepingService.createJournalEntry({
        businessUnitId,
        createdBy: userId,
        description,
        reference,
        date: new Date(date),
        lines,
      });

      res.status(201).json({ 
        success: true, 
        data: entry,
        message: 'Journal entry created successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get accounts
   * GET /bookkeeping/accounts
   */
  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const accounts = await prisma.account.findMany({
        where: { businessUnitId, isActive: true },
        include: { 
          lines: {
            // FIXED: Removed orderBy with createdAt since JournalLine model may not have createdAt field
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
      
      if (!id) {
        throw new AppError('Account ID is required', 400);
      }

      const account = await prisma.account.findUnique({
        where: { id },
        include: { 
          lines: {
            include: { journalEntry: true },
            // FIXED: Removed orderBy with createdAt since JournalLine model may not have createdAt field
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
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

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
      const { businessUnitId } = (req as any).user || {};
      const { startDate, endDate } = req.query;
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

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
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }

      const trialBalance = await bookkeepingService.generateTrialBalance(businessUnitId);
      
      // Calculate totals
      const totalDebits = trialBalance.reduce((sum: number, account: any) => sum + account.debit, 0);
      const totalCredits = trialBalance.reduce((sum: number, account: any) => sum + account.credit, 0);
      
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
      const { businessUnitId } = (req as any).user || {};
      
      if (!saleId) {
        throw new AppError('Sale ID is required', 400);
      }
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
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
      const { businessUnitId } = (req as any).user || {};
      const { subtotal } = req.body;
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      if (subtotal === undefined || subtotal === null || isNaN(subtotal)) {
        throw new AppError('Valid subtotal is required', 400);
      }

      const taxCalculation = await bookkeepingService.calculateTax(
        Number(subtotal),
        businessUnitId
      );
      
      res.json({ 
        success: true, 
        data: taxCalculation,
      });
    } catch (error) {
      next(error);
    }
  },
};
