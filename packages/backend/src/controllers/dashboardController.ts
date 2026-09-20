// src/controllers/dashboardController.ts
import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboardService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Resolve the business unit for the current request.
 * Priority: query param → JWT user context.
 */
function resolveBusinessUnitId(req: Request): string {
  const fromQuery = req.query.businessUnitId as string | undefined;
  const fromUser = (req as any).user?.businessUnitId as string | undefined;
  const businessUnitId = fromQuery || fromUser;
  if (!businessUnitId) throw new AppError('Business unit required', 400);
  return businessUnitId;
}

/**
 * Normalise `range` query param → number of days.
 */
function rangeToDays(range?: string): number {
  switch ((range || 'week').toLowerCase()) {
    case 'today':   return 1;
    case 'week':    return 7;
    case 'month':   return 30;
    case 'quarter': return 90;
    case 'year':    return 365;
    default:        return 7;
  }
}

export const dashboardController = {
  /**
   * GET /dashboard/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const stats = await dashboardService.getStats(businessUnitId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /dashboard/realtime
   */
  async getRealtimeData(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const realtimeData = await dashboardService.getRealtimeData(businessUnitId);
      res.json({ success: true, data: realtimeData });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /dashboard/live
   */
  async getLiveDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const liveData = await dashboardService.getLiveDashboard(businessUnitId);
      res.json({ success: true, data: liveData });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /dashboard/top-products?limit=10&range=week&businessUnit=all
   */
  async getTopProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const limit = Number(req.query.limit ?? 10);
      const days = rangeToDays(req.query.range as string | undefined);

      const topProducts = await dashboardService.getTopProducts(
        businessUnitId,
        Number.isFinite(limit) ? limit : 10,
        days,
      );

      res.json({ success: true, data: topProducts });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /dashboard/low-stock
   */
  async getLowStockAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const alerts = await dashboardService.getLowStockAlerts(businessUnitId);
      res.json({ success: true, data: alerts });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /dashboard/activity?limit=10&range=week&businessUnit=all
   */
  async getActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const limit = Number(req.query.limit ?? 10);
      const days = rangeToDays(req.query.range as string | undefined);

      const activity = await dashboardService.getActivity(
        businessUnitId,
        Number.isFinite(limit) ? limit : 10,
        days,
      );

      res.json({ success: true, data: activity });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /dashboard/trends?range=week&businessUnit=all
   */
  async getTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const days = rangeToDays(req.query.range as string | undefined);

      const trends = await dashboardService.getTrends(businessUnitId, days);

      res.json({ success: true, data: trends });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /dashboard/sales-summary
   */
  async getSalesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const businessUnitId = resolveBusinessUnitId(req);
      const { startDate, endDate } = req.query;

      const start = startDate
        ? new Date(startDate as string)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate as string) : new Date();

      const summary = await dashboardService.getSalesSummary(
        businessUnitId,
        start,
        end,
      );

      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },
};
