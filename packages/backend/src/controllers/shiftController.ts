// src/controllers/shiftController.ts
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { shiftService } from '../services/shiftService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const startShiftSchema = z.object({
  cashRegisterId: z.string().min(1),
  startingBalance: z.number().min(0),
  notes: z.string().optional(),
});

const endShiftSchema = z.object({
  endingBalance: z.number().min(0),
  notes: z.string().optional(),
});

const cashTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  description: z.string().optional(),
});

export const shiftController = {
  /**
   * Start a new shift
   * POST /shifts/start
   */
  async startShift(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId, businessUnitId } = (req as any).user || {};
      const data = startShiftSchema.parse(req.body);

      if (!businessUnitId || !userId) {
        throw new AppError('User and business unit required', 400);
      }

      const shift = await shiftService.startShift({
        cashRegisterId: data.cashRegisterId,
        startingBalance: data.startingBalance,
        userId,
        businessUnitId,
        notes: data.notes,
      });

      res.status(201).json({
        success: true,
        data: shift,
        message: 'Shift started successfully',
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
   * End current shift
   * POST /shifts/:id/end
   */
  async endShift(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const { id: userId } = (req as any).user || {};
      const data = endShiftSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const closedShift = await shiftService.endShift(sessionId, {
        endingBalance: data.endingBalance,
        notes: data.notes,
        userId,
      });

      res.json({
        success: true,
        data: closedShift,
        message: 'Shift ended successfully',
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
   * Get current shift status
   * GET /shifts/current/:cashRegisterId
   */
  async getCurrentShift(req: Request, res: Response, next: NextFunction) {
    try {
      const { cashRegisterId } = req.params;

      const session = await shiftService.getCurrentShift(cashRegisterId);

      res.json({
        success: true,
        data: session,
        message: session ? 'Open shift found' : 'No open shift',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all shifts
   * GET /shifts
   */
  async getAllShifts(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { page, limit, status, userId, cashRegisterId, startDate, endDate } = req.query;

      const result = await shiftService.getAllShifts({
        businessUnitId: businessUnitId as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
        status: status as string,
        userId: userId as string,
        cashRegisterId: cashRegisterId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: result.shifts,
        stats: result.stats,
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
   * Get shift by ID
   * GET /shifts/:id
   */
  async getShiftById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const shift = await shiftService.getShiftById(id);

      res.json({
        success: true,
        data: shift,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get shift summary
   * GET /shifts/:id/summary
   */
  async getShiftSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const summary = await shiftService.getShiftSummary(id);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add cash to register
   * POST /shifts/:id/add-cash
   */
  async addCash(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { id: userId } = (req as any).user || {};
      const { amount, description } = cashTransactionSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const transaction = await shiftService.addCash(id, amount, userId, description);

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Cash added successfully',
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
   * Remove cash from register
   * POST /shifts/:id/remove-cash
   */
  async removeCash(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { id: userId } = (req as any).user || {};
      const { amount, description } = cashTransactionSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const transaction = await shiftService.removeCash(id, amount, userId, description);

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Cash removed successfully',
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
   * Get shift statistics
   * GET /shifts/stats
   */
  async getShiftStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { startDate, endDate } = req.query;

      const stats = await shiftService.getShiftStats({
        businessUnitId: businessUnitId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },
};
