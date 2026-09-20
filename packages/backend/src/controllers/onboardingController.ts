// src/controllers/onboardingController.ts

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { onboardingService } from '../services/onboardingService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

type AuthedRequest = Request;

interface OnboardingContext {
  userId: string;
  businessUnitId: string;
  companyId: string | null;
}

interface AuthedUserInfo {
  userId: string;
  role?: string;
  hintedBuId?: string;
  hintedCompanyId?: string;
}

const stepIdSchema = z.coerce.number().int().min(1).max(12);

const markCompleteSchema = z.object({
  stepId: stepIdSchema,
  notes: z.string().max(500).optional(),
});

const skipSchema = z.object({
  stepId: stepIdSchema,
  notes: z.string().max(500).optional(),
});

const paginateSchema = z.object({
  stepId: stepIdSchema,
});

const resetSchema = z.object({
  userId: z.string().min(1).optional(),
});

function formatZodErrors(error: z.ZodError): {
  field: string;
  message: string;
}[] {
  return error.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

function requireUser(req: AuthedRequest): AuthedUserInfo {
  const u = req.user;
  if (!u) {
    throw new AppError('User ID is required', 401);
  }

  const userId = u.id ?? u.userId;
  if (!userId) {
    throw new AppError('User ID is required', 401);
  }

  return {
    userId,
    role: u.role,
    hintedBuId: u.businessUnitId,
    hintedCompanyId: u.companyId,
  };
}

/**
 * Resolve the user's companyId and businessUnitId.
 *
 * ⚠️ The `User` model has NO `businessUnitId` column. The user's
 *    BU is expressed only through the `businessUnits` relation
 *    (`BusinessUnitUser`). Do NOT add `businessUnitId: true` to
 *    the `select` below — Prisma will reject the query with a
 *    500 (`Invalid prisma.user.findUnique() invocation`).
 *
 * ✅ The membership lookup uses `orderBy: { createdAt: 'asc' }`
 *    to match the inventory controller and inventory service.
 */
async function resolveContext(req: AuthedRequest): Promise<OnboardingContext> {
  const { userId, hintedBuId, hintedCompanyId } = requireUser(req);

  const explicitBu =
    (req.headers['x-business-unit-id'] as string | undefined) ||
    (typeof req.query?.businessUnitId === 'string'
      ? req.query.businessUnitId
      : undefined);

  const userRow = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      companyId: true,
      businessUnits: {
        where: { isActive: true },
        select: { businessUnitId: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  if (!userRow) {
    throw new AppError('User not found', 404);
  }

  let companyId: string | null =
    userRow.companyId ?? hintedCompanyId ?? null;

  let businessUnitId: string | undefined =
    explicitBu ??
    hintedBuId ??
    userRow.businessUnits?.[0]?.businessUnitId;

  if (!businessUnitId && companyId) {
    const fallback = await prisma.businessUnit.findFirst({
      where: { isActive: true, deletedAt: null, companyId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, companyId: true },
    });

    if (fallback) {
      businessUnitId = fallback.id;
      companyId = companyId ?? fallback.companyId;
    }
  }

  if (!companyId && businessUnitId) {
    const bu = await prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { companyId: true },
    });
    companyId = bu?.companyId ?? null;
  }

  return {
    userId,
    businessUnitId: businessUnitId ?? '',
    companyId,
  };
}

async function resolveTargetUser(
  _req: AuthedRequest,
  targetUserId: string
): Promise<OnboardingContext> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      companyId: true,
      businessUnits: {
        where: { isActive: true },
        select: { businessUnitId: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  });

  if (!target) {
    throw new AppError(`Target user not found: ${targetUserId}`, 404);
  }

  const businessUnitId =
    target.businessUnits?.[0]?.businessUnitId ?? '';

  return {
    userId: targetUserId,
    businessUnitId,
    companyId: target.companyId ?? null,
  };
}

export const onboardingController = {
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const ctx = await resolveContext(req);
      const status = await onboardingService.getStatus(
        ctx.userId,
        ctx.businessUnitId,
        ctx.companyId
      );
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  },

  async getNext(req: Request, res: Response, next: NextFunction) {
    try {
      const ctx = await resolveContext(req);
      const status = await onboardingService.getStatus(
        ctx.userId,
        ctx.businessUnitId,
        ctx.companyId
      );

      if (!status.nextStep) {
        return res.json({
          success: true,
          data: {
            route: '/dashboard',
            done: true,
            currentIndex: -1,
            totalActive: 0,
            prevStep: null,
          },
        });
      }

      res.json({
        success: true,
        data: {
          route: status.nextStep.route,
          done: false,
          step: status.nextStep,
          currentIndex: status.currentIndex,
          totalActive: status.totalActive,
          prevStep: status.prevStep,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async checkRoute(req: Request, res: Response, next: NextFunction) {
    try {
      const route = String(req.query.route || '').trim();
      if (!route) {
        throw new AppError('route query parameter is required', 400);
      }
      const ctx = await resolveContext(req);
      const result = await onboardingService.isRouteBlocked(
        route,
        ctx.userId,
        ctx.businessUnitId,
        ctx.companyId
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async paginate(req: Request, res: Response, next: NextFunction) {
    try {
      const ctx = await resolveContext(req);
      const parsed = paginateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request body',
          errors: formatZodErrors(parsed.error),
        });
      }
      const { stepId } = parsed.data;
      logger.info(
        `[onboarding] paginate user=${ctx.userId} step=${stepId}`
      );
      const status = await onboardingService.paginate(ctx.userId, stepId);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  },

  async markStepComplete(req: Request, res: Response, next: NextFunction) {
    try {
      const ctx = await resolveContext(req);
      const parsed = markCompleteSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request body',
          errors: formatZodErrors(parsed.error),
        });
      }
      const { stepId, notes } = parsed.data;
      logger.info(
        `[onboarding] mark-complete user=${ctx.userId} step=${stepId}`
      );
      const result = await onboardingService.markStepCompleted(
        ctx.userId,
        stepId,
        'manual',
        notes
      );
      res.json({
        success: true,
        data: { step: result.step, status: result.status },
        message: `Step ${stepId} marked as completed`,
      });
    } catch (error) {
      next(error);
    }
  },

  async skipStep(req: Request, res: Response, next: NextFunction) {
    try {
      const ctx = await resolveContext(req);
      const parsed = skipSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request body',
          errors: formatZodErrors(parsed.error),
        });
      }
      const { stepId, notes } = parsed.data;
      logger.info(`[onboarding] skip user=${ctx.userId} step=${stepId}`);
      const result = await onboardingService.skipStep(
        ctx.userId,
        stepId,
        'manual',
        notes
      );
      res.json({
        success: true,
        data: { step: result.step, status: result.status },
        message: `Step ${stepId} skipped`,
      });
    } catch (error) {
      next(error);
    }
  },

  async resetProgress(req: Request, res: Response, next: NextFunction) {
    try {
      const callerCtx = await resolveContext(req);
      const parsed = resetSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request body',
          errors: formatZodErrors(parsed.error),
        });
      }
      const targetUserId = parsed.data.userId ?? callerCtx.userId;
      await resolveTargetUser(req, targetUserId);
      logger.info(
        `[onboarding] reset target=${targetUserId} by=${callerCtx.userId}`
      );
      const result = await onboardingService.reset(
        targetUserId,
        callerCtx.userId
      );
      res.json({
        success: true,
        data: result.status,
        message:
          targetUserId === callerCtx.userId
            ? 'Your onboarding progress has been reset'
            : `Onboarding progress reset for user ${targetUserId}`,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default onboardingController;
