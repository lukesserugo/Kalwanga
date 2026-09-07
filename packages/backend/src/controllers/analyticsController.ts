// src/controllers/analyticsController.ts
import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analyticsService.js';
import { AppError } from '../middleware/errorHandler.js';

export const analyticsController = {
  /**
   * Get sales trends
   * GET /analytics/sales-trends?days=30
   */
  async getSalesTrends(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { days = 30 } = req.query;
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      
      const daysNum = Number(days);
      if (isNaN(daysNum) || daysNum <= 0) {
        throw new AppError('Invalid days parameter', 400);
      }
      
      const trends = await analyticsService.getSalesTrends(businessUnitId, daysNum);
      
      res.json({ 
        success: true, 
        data: trends,
        meta: {
          days: daysNum,
          dataPoints: trends.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get top products
   * GET /analytics/top-products?limit=10&days=30
   */
  async getTopProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { limit = 10, days = 30 } = req.query;
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      
      const limitNum = Number(limit);
      const daysNum = Number(days);
      
      if (isNaN(limitNum) || limitNum <= 0) {
        throw new AppError('Invalid limit parameter', 400);
      }
      if (isNaN(daysNum) || daysNum <= 0) {
        throw new AppError('Invalid days parameter', 400);
      }
      
      const products = await analyticsService.getTopProducts(businessUnitId, limitNum, daysNum);
      
      res.json({ 
        success: true, 
        data: products,
        meta: {
          limit: limitNum,
          days: daysNum,
          count: products.length,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get customer insights
   * GET /analytics/customer-insights
   */
  async getCustomerInsights(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      
      const insights = await analyticsService.getCustomerInsights(businessUnitId);
      
      res.json({ 
        success: true, 
        data: insights,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get inventory analytics
   * GET /analytics/inventory
   */
  async getInventoryAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      
      const analytics = await analyticsService.getInventoryAnalytics(businessUnitId);
      
      res.json({ 
        success: true, 
        data: analytics,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get dashboard analytics (combined)
   * GET /analytics/dashboard
   */
  async getDashboardAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      
      const [trends, topProducts, customerInsights, inventoryAnalytics] = await Promise.all([
        analyticsService.getSalesTrends(businessUnitId, 30),
        analyticsService.getTopProducts(businessUnitId, 10, 30),
        analyticsService.getCustomerInsights(businessUnitId),
        analyticsService.getInventoryAnalytics(businessUnitId),
      ]);
      
      res.json({
        success: true,
        data: { 
          trends, 
          topProducts, 
          customerInsights, 
          inventoryAnalytics,
          summary: {
            totalRevenue30Days: trends.reduce((sum, t) => sum + t.total, 0),
            totalOrders30Days: trends.reduce((sum, t) => sum + t.orderCount, 0),
            averageOrderValue30Days: trends.length > 0 
              ? trends.reduce((sum, t) => sum + t.total, 0) / trends.reduce((sum, t) => sum + t.orderCount, 0)
              : 0,
            topProduct: topProducts[0] || null,
            totalCustomers: customerInsights.totalCustomers,
            lowStockItems: inventoryAnalytics.lowStock,
            outOfStockItems: inventoryAnalytics.outOfStock,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales by category
   * GET /analytics/sales-by-category?days=30
   */
  async getSalesByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { days = 30 } = req.query;
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      
      const daysNum = Number(days);
      if (isNaN(daysNum) || daysNum <= 0) {
        throw new AppError('Invalid days parameter', 400);
      }
      
      const salesByCategory = await analyticsService.getSalesByCategory(businessUnitId, daysNum);
      
      res.json({ 
        success: true, 
        data: salesByCategory,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get sales by payment method
   * GET /analytics/sales-by-payment?days=30
   */
  async getSalesByPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = (req as any).user || {};
      const { days = 30 } = req.query;
      
      if (!businessUnitId) {
        throw new AppError('Business unit required', 400);
      }
      
      const daysNum = Number(days);
      if (isNaN(daysNum) || daysNum <= 0) {
        throw new AppError('Invalid days parameter', 400);
      }
      
      const salesByPayment = await analyticsService.getSalesByPaymentMethod(businessUnitId, daysNum);
      
      res.json({ 
        success: true, 
        data: salesByPayment,
      });
    } catch (error) {
      next(error);
    }
  },
};
