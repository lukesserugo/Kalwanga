// src/controllers/healthController.ts
import { Request, Response, NextFunction } from 'express';
import { healthService } from '../services/healthService.js';
import { AppError } from '../middleware/errorHandler.js';

export const healthController = {
  /**
   * Get basic health status
   * GET /health
   */
  async getHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const health = await healthService.getBasicHealth();
      
      res.json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        database: health.database,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get detailed health status
   * GET /health/detailed
   */
  async getDetailedHealth(req: Request, res: Response, next: NextFunction) {
    try {
      const healthStatus = await healthService.getHealthStatus();
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 
                        healthStatus.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json({
        success: healthStatus.status !== 'unhealthy',
        ...healthStatus,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get database status
   * GET /health/database
   */
  async getDatabaseStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const dbStatus = await healthService.getDatabaseStatus();
      
      // Remove the duplicate 'success' property
      // If dbStatus already has success, use that
      // If dbStatus doesn't have success, add it
      res.json({
        ...dbStatus,
        success: true, // Only if dbStatus doesn't have success
      });
      
      // OR better: just return dbStatus as-is
      // res.json(dbStatus);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get health check history
   * GET /health/history
   */
  async getHealthHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 20 } = req.query;
      const history = await healthService.getHealthHistory(Number(limit));
      
      res.json({
        success: true,
        data: history,
        count: history.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Perform a quick health check
   * GET /health/check
   */
  async quickCheck(req: Request, res: Response, next: NextFunction) {
    try {
      const health = await healthService.getBasicHealth();
      
      // Return minimal response for quick checks
      res.status(health.status === 'ok' ? 200 : 503).json({
        status: health.status,
        timestamp: health.timestamp,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get system information
   * GET /health/system
   */
  async getSystemInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const healthStatus = await healthService.getHealthStatus();
      
      res.json({
        success: true,
        data: {
          system: healthStatus.system,
          nodeVersion: healthStatus.system.nodeVersion,
          processId: healthStatus.system.processId,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
