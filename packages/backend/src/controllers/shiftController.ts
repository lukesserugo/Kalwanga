// D:\Projects\Kalwanga\packages\backend\src\controllers\shiftController.ts
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

const createRegisterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  businessUnitId: z.string().min(1, 'Business unit ID is required'),
});

const updateRegisterSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// ============================================
// RESOLVE BUSINESS UNIT ID
// ============================================
async function getBusinessUnitId(req: Request): Promise<string> {
  const user = (req as any).user;

  // 1. Explicit override (body / query) — most specific wins
  const explicit =
    (req.body?.businessUnitId as string | undefined) ||
    (req.query?.businessUnitId as string | undefined);

  if (explicit && explicit !== 'default' && explicit !== 'default-business-unit') {
    return explicit;
  }

  // 2. User's primary business unit
  const userBu =
    (user?.businessUnitId as string | undefined) ||
    (user?.businessUnits?.[0]?.businessUnitId as string | undefined);

  if (userBu && userBu !== 'default') {
    return userBu;
  }

  // 3. Fallback: most recent active business unit
  const businessUnit = await prisma.businessUnit.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },   // ⬅️ changed from 'asc'
  });

  if (businessUnit) {
    console.warn(
      `⚠️ getBusinessUnitId: user has no business unit, falling back to "${businessUnit.name}" (${businessUnit.id})`
    );
    return businessUnit.id;
  }

  // 4. Last resort: bootstrap a default company + unit
  let company = await prisma.company.findFirst();
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Default Company',
        email: 'default@company.com',
        phone: '+0000000000',
        isActive: true,
      },
    });
  }

  const newBusinessUnit = await prisma.businessUnit.create({
    data: {
      name: 'Default Business Unit',
      code: 'DEFAULT',
      isActive: true,
      companyId: company.id,
    },
  });

  return newBusinessUnit.id;
}

// ============================================
// CONTROLLER
// ============================================
export const shiftController = {
  /**
   * GET /shifts/register/current
   */
  async getCurrentShiftForUser(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) throw new AppError('User ID is required', 400);

      const businessUnitId = await getBusinessUnitId(req);

      const shift = await shiftService.getCurrentShiftForUser(userId, businessUnitId);

      res.status(200).json({ success: true, data: shift });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /shifts/registers
   */
  async getRegisters(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);
      const { isActive } = req.query;

      const registers = await shiftService.getRegisters(
        businessUnitId,
        isActive === 'true' ? true : isActive === 'false' ? false : undefined
      );

      console.log(
        `📋 getRegisters: businessUnitId="${businessUnitId}", count=${registers?.length ?? 0}`
      );

      res.status(200).json({
        success: true,
        data: registers,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /shifts/registers/codes
   */
  async getRegisterCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = await getBusinessUnitId(req);

      const codes = await prisma.cashRegister.findMany({
        where: { businessUnitId },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      });

      res.status(200).json({ success: true, data: codes });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /shifts/registers/:id
   */
  async getRegisterById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Register ID is required', 400);

      const register = await shiftService.getRegisterById(id);
      if (!register) throw new AppError('Register not found', 404);

      res.status(200).json({ success: true, data: register });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /shifts/registers/:id/status
   */
  async getRegisterStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Register ID is required', 400);

      const status = await shiftService.getRegisterStatus(id);

      res.status(200).json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /shifts/registers
   */
  async createRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = createRegisterSchema.parse(req.body);
      const user = (req as any).user;
      const userId = user?.id || user?.userId;

      if (!userId) throw new AppError('User ID is required', 400);

      const register = await shiftService.createRegister({
        ...validatedData,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: register,
        message: 'Register created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * PUT /shifts/registers/:id
   */
  async updateRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const validatedData = updateRegisterSchema.parse(req.body);
      if (!id) throw new AppError('Register ID is required', 400);

      const register = await shiftService.updateRegister(id, validatedData);

      res.status(200).json({
        success: true,
        data: register,
        message: 'Register updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * DELETE /shifts/registers/:id
   */
  async deleteRegister(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Register ID is required', 400);

      await shiftService.deleteRegister(id);

      res.status(200).json({
        success: true,
        message: 'Register deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /shifts/start
   */
  async startShift(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};
      const data = startShiftSchema.parse(req.body);
      if (!userId) throw new AppError('User ID is required', 400);

      const businessUnitId = await getBusinessUnitId(req);

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
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /shifts/:id/end
   */
  async endShift(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: sessionId } = req.params;
      const { id: userId } = (req as any).user || {};
      const data = endShiftSchema.parse(req.body);
      if (!userId) throw new AppError('User ID is required', 400);

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
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
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
   * GET /shifts
   */
  async getAllShifts(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const currentUserId = user?.id || user?.userId;
      const userRole = user?.role;

      if (!currentUserId) throw new AppError('User ID is required', 400);

      const {
        page,
        limit,
        status,
        userId,
        cashRegisterId,
        startDate,
        endDate,
        scope,
      } = req.query;

      const requestedScope = (scope as string) || 'businessUnit';

      if (!['mine', 'businessUnit', 'all'].includes(requestedScope)) {
        throw new AppError(
          `Invalid scope "${requestedScope}". Allowed: mine, businessUnit, all`,
          400
        );
      }

      if (
        requestedScope === 'all' &&
        !['SUPER_ADMIN', 'ADMIN'].includes(userRole)
      ) {
        throw new AppError(
          'You do not have permission to view shifts across all business units',
          403
        );
      }

      let effectiveBusinessUnitId: string | undefined;
      let effectiveUserId: string | undefined;

      if (requestedScope === 'mine') {
        effectiveUserId = currentUserId;
        effectiveBusinessUnitId = undefined;
      } else if (requestedScope === 'all') {
        effectiveBusinessUnitId = undefined;
        effectiveUserId = (userId as string) || undefined;
      } else {
        effectiveBusinessUnitId = await getBusinessUnitId(req);
        effectiveUserId = (userId as string) || undefined;
      }

      const result = await shiftService.getAllShifts({
        businessUnitId: effectiveBusinessUnitId,
        userId: effectiveUserId,
        cashRegisterId: cashRegisterId as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50,
      });

      res.json({
        success: true,
        data: result.shifts,
        stats: result.stats,
        scope: requestedScope,
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
   * GET /shifts/:id
   */
  async getShiftById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const shift = await shiftService.getShiftById(id);

      res.json({ success: true, data: shift });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /shifts/:id/summary
   */
  async getShiftSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const summary = await shiftService.getShiftSummary(id);

      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /shifts/:id/add-cash
   */
  async addCash(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { id: userId } = (req as any).user || {};
      const { amount, description } = cashTransactionSchema.parse(req.body);
      if (!userId) throw new AppError('User ID is required', 400);

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
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /shifts/:id/remove-cash
   */
  async removeCash(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { id: userId } = (req as any).user || {};
      const { amount, description } = cashTransactionSchema.parse(req.body);
      if (!userId) throw new AppError('User ID is required', 400);

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
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * GET /shifts/stats
   */
  async getShiftStats(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const currentUserId = user?.id || user?.userId;
      const userRole = user?.role;
      if (!currentUserId) throw new AppError('User ID is required', 400);

      const { startDate, endDate, scope } = req.query;
      const requestedScope = (scope as string) || 'businessUnit';

      if (!['mine', 'businessUnit', 'all'].includes(requestedScope)) {
        throw new AppError(
          `Invalid scope "${requestedScope}". Allowed: mine, businessUnit, all`,
          400
        );
      }

      if (
        requestedScope === 'all' &&
        !['SUPER_ADMIN', 'ADMIN'].includes(userRole)
      ) {
        throw new AppError(
          'You do not have permission to view statistics across all business units',
          403
        );
      }

      let effectiveBusinessUnitId: string | undefined;
      let effectiveUserId: string | undefined;

      if (requestedScope === 'mine') {
        effectiveUserId = currentUserId;
        effectiveBusinessUnitId = undefined;
      } else if (requestedScope === 'all') {
        effectiveBusinessUnitId = undefined;
        effectiveUserId = undefined;
      } else {
        effectiveBusinessUnitId = await getBusinessUnitId(req);
        effectiveUserId = undefined;
      }

      const stats = await shiftService.getShiftStats({
        businessUnitId: effectiveBusinessUnitId,
        userId: effectiveUserId,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      res.json({ success: true, data: stats, scope: requestedScope });
    } catch (error) {
      next(error);
    }
  },
};

export default shiftController;
