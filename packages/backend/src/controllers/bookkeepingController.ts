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

const createAccountSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  category: z.enum([
    'CASH',
    'ACCOUNTS_RECEIVABLE',
    'INVENTORY',
    'SALES_REVENUE',
    'SALES_TAX_PAYABLE',
    'COST_OF_GOODS_SOLD',
    'OPERATING_EXPENSE',
    'OWNER_EQUITY',
    'RETAINED_EARNINGS',
    'ACCOUNTS_PAYABLE',
    'FIXED_ASSETS',
    'DEPRECIATION',
    'PAYROLL',
    'INSURANCE',
    'UTILITIES',
    'RENT',
  ]),
  isActive: z.boolean().optional(),
});

const updateAccountSchema = createAccountSchema.partial();

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

/**
 * Resolve the business unit ID from the request.
 *
 * Priority (same as the onboarding controller's resolver):
 *   1. `x-business-unit-id` header (sent by api.ts interceptor
 *      from localStorage)
 *   2. `businessUnitId` query param
 *   3. `req.user.businessUnitId` (set by auth middleware from
 *      the user's active BU membership)
 *
 * The header fallback is what makes this resilient during
 * onboarding, when the user's session may not yet carry a
 * BU hint but localStorage already has one.
 */
const getBusinessUnitId = (req: Request): string => {
  const fromHeader = req.headers['x-business-unit-id'] as string | undefined;
  const fromQuery =
    typeof req.query?.businessUnitId === 'string'
      ? req.query.businessUnitId
      : undefined;
  const fromUser = req.user?.businessUnitId;

  const businessUnitId = fromHeader || fromQuery || fromUser;
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
   *
   * Seeds the default chart of accounts on first view so the
   * user isn't greeted with an empty table. The seeding is
   * idempotent (uses findFirst before create, scoped by
   * [businessUnitId, code]).
   */
  async getAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = getBusinessUnitId(req);

      let accounts = await prisma.account.findMany({
        where: { businessUnitId, isActive: true },
        include: {
          lines: {
            take: 10,
          },
        },
        orderBy: { code: 'asc' },
      });

      // Seed on empty. ensureDefaultAccounts is idempotent —
      // it uses findFirst + create per account, so calling it
      // here on every empty result is safe.
      if (accounts.length === 0) {
        try {
          await bookkeepingService.ensureDefaultAccounts(businessUnitId);

          accounts = await prisma.account.findMany({
            where: { businessUnitId, isActive: true },
            include: {
              lines: {
                take: 10,
              },
            },
            orderBy: { code: 'asc' },
          });
        } catch (seedErr) {
          // Log but don't fail the request — return the empty
          // list so the page renders and the user can see the
          // state. The next visit will retry the seed.
          console.error(
            '[bookkeepingController] seed of default accounts failed:',
            seedErr
          );
        }
      }

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
   * Create a new account
   * POST /bookkeeping/accounts
   */
  async createAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = getBusinessUnitId(req);
      const data = createAccountSchema.parse(req.body);

      // Compound-unique: an account code is unique within a BU.
      const existing = await prisma.account.findFirst({
        where: { businessUnitId, code: data.code },
      });
      if (existing) {
        throw new AppError(
          `Account with code ${data.code} already exists in this business unit`,
          409
        );
      }

      const account = await prisma.account.create({
        data: {
          code: data.code,
          name: data.name,
          type: data.type as any,
          category: data.category as any,
          businessUnitId,
          isActive: data.isActive ?? true,
        },
      });

      res.status(201).json({
        success: true,
        data: account,
        message: 'Account created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      next(error);
    }
  },

  /**
   * Update an account
   * PUT /bookkeeping/accounts/:id
   */
  async updateAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const businessUnitId = getBusinessUnitId(req);
      const data = updateAccountSchema.parse(req.body);

      if (!id) {
        throw new AppError('Account ID is required', 400);
      }

      const existing = await prisma.account.findFirst({
        where: { id, businessUnitId },
      });
      if (!existing) {
        throw new AppError('Account not found', 404);
      }

      // If code is being changed, check compound uniqueness.
      if (data.code && data.code !== existing.code) {
        const conflict = await prisma.account.findFirst({
          where: {
            businessUnitId,
            code: data.code,
            id: { not: id },
          },
        });
        if (conflict) {
          throw new AppError(
            `Account with code ${data.code} already exists in this business unit`,
            409
          );
        }
      }

      const updated = await prisma.account.update({
        where: { id },
        data: {
          ...(data.code !== undefined && { code: data.code }),
          ...(data.name !== undefined && { name: data.name }),
          ...(data.type !== undefined && { type: data.type as any }),
          ...(data.category !== undefined && {
            category: data.category as any,
          }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      res.json({
        success: true,
        data: updated,
        message: 'Account updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
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
          businessUnitId,
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

      const balanceSheet = await bookkeepingService.generateBalanceSheet(
        businessUnitId
      );

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
  async generateIncomeStatement(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessUnitId = getBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const report = await bookkeepingService.generateFinancialReport(
        businessUnitId,
        startDate
          ? new Date(startDate as string)
          : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
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

      const trialBalance = await bookkeepingService.generateTrialBalance(
        businessUnitId
      );

      const totalDebits = trialBalance.reduce(
        (sum: number, account: any) => sum + (account.debit || 0),
        0
      );
      const totalCredits = trialBalance.reduce(
        (sum: number, account: any) => sum + (account.credit || 0),
        0
      );

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

      const balance = await bookkeepingService.getAccountBalance(
        id,
        businessUnitId
      );

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

      const entry = await bookkeepingService.voidJournalEntry(
        id,
        businessUnitId,
        userId
      );

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