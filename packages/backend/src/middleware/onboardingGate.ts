// src/middleware/onboardingGate.ts
import { Request, Response, NextFunction } from 'express';
import { onboardingService } from '../services/onboardingService.js';

export function onboardingGate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.userId;
      if (!userId) return next();

      // Only gate admin routes
      if (!req.path.startsWith('/admin') && !req.baseUrl.startsWith('/admin')) {
        return next();
      }

      // Allow onboarding endpoints themselves
      if (req.path.startsWith('/onboarding')) return next();

      const buId = (req.headers['x-business-unit-id'] as string) || user?.businessUnitId;
      if (!buId) return next();

      const status = await onboardingService.isRouteBlocked(
        req.originalUrl.split('?')[0],
        userId,
        buId,
        user?.companyId
      );

      if (status.blocked && status.step) {
        return res.status(412).json({
          success: false,
          message: `Onboarding step required: ${status.step.name}`,
          nextStep: status.step,
        });
      }

      next();
    } catch (err) {
      next();
    }
  };
}
