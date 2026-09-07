// src/controllers/dashboardController.ts
import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboardService.js';
import { AppError } from '../middleware/errorHandler.js';

export const dashboardController = {
  /**
   * Get comprehensive dashboard stats
   * GET /dashboard/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      if (!businessUnitId) throw new AppError('Business unit required', 400);

      const stats = await dashboardService.getStats(businessUnitId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get real-time data for WebSocket clients
   * GET /dashboard/realtime
   */
  async getRealtimeData(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      if (!businessUnitId) throw new AppError('Business unit required', 400);

      const realtimeData = await dashboardService.getRealtimeData(businessUnitId);

      res.json({
        success: true,
        data: realtimeData,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get live dashboard
   * GET /dashboard/live
   */
  async getLiveDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      if (!businessUnitId) throw new AppError('Business unit required', 400);

      const liveData = await dashboardService.getLiveDashboard(businessUnitId);

      res.json({
        success: true,
        data: liveData,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get top products
   * GET /dashboard/top-products
   */
  async getTopProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { limit = 10, days = 30 } = req.query;
      
      if (!businessUnitId) throw new AppError('Business unit required', 400);

      const topProducts = await dashboardService.getTopProducts(
        businessUnitId,
        Number(limit),
        Number(days)
      );

      res.json({
        success: true,
        data: topProducts,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get low stock alerts
   * GET /dashboard/low-stock
   */
  async getLowStockAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      if (!businessUnitId) throw new AppError('Business unit required', 400);

      const alerts = await dashboardService.getLowStockAlerts(businessUnitId);

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales summary
   * GET /dashboard/sales-summary
   */
  async getSalesSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { startDate, endDate } = req.query;
      
      if (!businessUnitId) throw new AppError('Business unit required', 400);

      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate as string) : new Date();

      const summary = await dashboardService.getSalesSummary(businessUnitId, start, end);

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  },
};
