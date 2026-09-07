// D:\Projects\Kalwanga\packages\backend\src\controllers\userActivityController.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { UserRole } from '../generated/prisma/index.js';
import { z } from 'zod';
import { logger } from '../lib/logger.js';
// Import Prisma types for type safety
import { Prisma } from '../generated/prisma/index.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createActivitySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  action: z.string().min(1, 'Action is required'),
  description: z.string().min(1, 'Description is required'),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  device: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['success', 'failed', 'pending']).optional().default('success'),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional().default('info'),
  resource: z.string().optional(),
  resourceId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const updateActivitySchema = z.object({
  description: z.string().min(1).optional(),
  status: z.enum(['success', 'failed', 'pending']).optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const getActivitiesSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  ipAddress: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const getActivityStatsSchema = z.object({
  dateRange: z.enum(['today', 'week', 'month', 'year', 'all']).optional().default('month'),
  groupBy: z.enum(['action', 'entityType', 'severity']).optional(),
});

const clearActivitiesSchema = z.object({
  beforeDate: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function sanitizeActivity(activity: any) {
  if (!activity) return null;
  const sanitized = { ...activity };
  delete sanitized.internalNotes;
  delete sanitized.adminNotes;
  return sanitized;
}

function sanitizeActivities(activities: any[]) {
  return activities.map(activity => sanitizeActivity(activity));
}

// ✅ FIXED: Properly typed Prisma where clause
function buildActivityWhereClause(params: any, userId?: string): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  
  if (userId) where.userId = userId;
  
  if (params.action && params.action !== 'all') where.action = params.action as any;
  if (params.entityType) where.entityType = params.entityType;
  if (params.entityId) where.entityId = params.entityId;
  if (params.ipAddress) where.ipAddress = params.ipAddress;
  
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
    if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
  }
  
  if (params.search) {
    where.OR = [
      { entityName: { contains: params.search, mode: 'insensitive' } },
      { entityType: { contains: params.search, mode: 'insensitive' } },
      { entityId: { contains: params.search, mode: 'insensitive' } },
      { ipAddress: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  
  return where;
}

// Helper to map severity
function mapSeverity(severity: string): any {
  const severityMap: Record<string, any> = {
    'info': 'INFO',
    'warning': 'LOW',
    'error': 'MEDIUM',
    'critical': 'CRITICAL',
  };
  return severityMap[severity] || 'INFO';
}

// ============================================
// USER ACTIVITY CONTROLLER
// ============================================

export const userActivityController = {
  /**
   * POST /activities
   * Create a new activity log entry
   */
  async createActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createActivitySchema.parse(req.body);
      
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
      });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      const activity = await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action as any,
          entityType: data.resource || 'USER_ACTIVITY',
          entityId: data.resourceId || data.userId,
          entityName: data.description,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          severity: mapSeverity(data.severity || 'info'),
          changes: {
            ...(data.metadata || {}),
            device: data.device,
            location: data.location,
            status: data.status,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
      
      logger.info(`Activity created: ${activity.id} for user ${data.userId}`);
      
      return res.status(201).json({
        success: true,
        data: sanitizeActivity(activity),
        message: 'Activity created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * POST /activities/batch
   * Create multiple activity log entries
   */
  async createActivitiesBatch(req: Request, res: Response, next: NextFunction) {
    try {
      const { activities } = z.object({
        activities: z.array(createActivitySchema).min(1).max(100),
      }).parse(req.body);
      
      const createdActivities = await prisma.$transaction(
        activities.map(activity => 
          prisma.auditLog.create({
            data: {
              userId: activity.userId,
              action: activity.action as any,
              entityType: activity.resource || 'USER_ACTIVITY',
              entityId: activity.resourceId || activity.userId,
              entityName: activity.description,
              ipAddress: activity.ipAddress,
              userAgent: activity.userAgent,
              severity: mapSeverity(activity.severity || 'info'),
              changes: {
                ...(activity.metadata || {}),
                device: activity.device,
                location: activity.location,
                status: activity.status,
              },
            },
          })
        )
      );
      
      logger.info(`Created ${createdActivities.length} activities in batch`);
      
      return res.status(201).json({
        success: true,
        data: sanitizeActivities(createdActivities),
        message: `${createdActivities.length} activities created successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * GET /activities
   * Get all activities with comprehensive filtering
   */
  async getActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const params = getActivitiesSchema.parse(req.query);
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);
      const skip = (page - 1) * limit;
      
      const where = buildActivityWhereClause(params);
      
      const validSortFields = ['createdAt', 'action', 'entityType', 'severity', 'ipAddress'];
      const orderBy: any = validSortFields.includes(params.sortBy)
        ? { [params.sortBy]: params.sortOrder }
        : { createdAt: 'desc' };
      
      const [activities, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);
      
      logger.info(`Retrieved ${activities.length} activities`);
      
      return res.json({
        success: true,
        data: sanitizeActivities(activities),
        pagination: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          limit,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * GET /activities/:id
   * Get activity by ID
   */
  async getActivityById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const activity = await prisma.auditLog.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
      
      if (!activity) {
        throw new AppError('Activity not found', 404);
      }
      
      return res.json({
        success: true,
        data: sanitizeActivity(activity),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /activities/:id
   * Update activity
   */
  async updateActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateActivitySchema.parse(req.body);
      
      const existingActivity = await prisma.auditLog.findUnique({
        where: { id },
      });
      
      if (!existingActivity) {
        throw new AppError('Activity not found', 404);
      }
      
      const updatedActivity = await prisma.auditLog.update({
        where: { id },
        data: {
          entityName: data.description,
          severity: data.severity ? mapSeverity(data.severity) : undefined,
          changes: data.metadata,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });
      
      logger.info(`Activity updated: ${id}`);
      
      return res.json({
        success: true,
        data: sanitizeActivity(updatedActivity),
        message: 'Activity updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * DELETE /activities/:id
   * Delete activity
   */
  async deleteActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const activity = await prisma.auditLog.findUnique({
        where: { id },
      });
      
      if (!activity) {
        throw new AppError('Activity not found', 404);
      }
      
      await prisma.auditLog.delete({
        where: { id },
      });
      
      logger.info(`Activity deleted: ${id}`);
      
      return res.json({
        success: true,
        message: 'Activity deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /activities/stats
   * Get activity statistics
   */
  async getActivityStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { dateRange, groupBy } = getActivityStatsSchema.parse(req.query);
      
      const now = new Date();
      let dateFrom: Date;
      
      switch (dateRange) {
        case 'today':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateFrom = new Date(0);
      }
      
      const where = { createdAt: { gte: dateFrom } };
      
      const [total, groupedData] = await Promise.all([
        prisma.auditLog.count({ where }),
        groupBy ? prisma.auditLog.groupBy({
          by: [groupBy as any],
          where,
          _count: { _all: true },
        }) : Promise.resolve([]),
      ]);
      
      const groupedStats: Record<string, number> = {};
      groupedData.forEach((item: any) => {
        groupedStats[item[groupBy as string] || 'unknown'] = item._count._all;
      });
      
      return res.json({
        success: true,
        data: {
          total,
          groupedBy: groupBy,
          groupedStats,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * DELETE /activities
   * Clear activities
   */
  async clearActivities(req: Request, res: Response, next: NextFunction) {
    try {
      const params = clearActivitiesSchema.parse(req.query);
      
      // ✅ FIXED: Properly typed Prisma where clause
      const where: Prisma.AuditLogWhereInput = {};
      
      if (params.beforeDate) {
        where.createdAt = { lt: new Date(params.beforeDate) };
      }
      if (params.action) where.action = params.action as any;
      if (params.entityType) where.entityType = params.entityType;
      
      const result = await prisma.auditLog.deleteMany({ where });
      
      logger.info(`Cleared ${result.count} activities`);
      
      return res.json({
        success: true,
        message: `Cleared ${result.count} activities`,
        cleared: result.count,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Helper method to log an activity internally
   */
  async logActivity(userId: string, action: string, description: string, metadata?: Record<string, any>) {
    try {
      const activity = await prisma.auditLog.create({
        data: {
          userId,
          action: action as any,
          entityType: 'USER_ACTIVITY',
          entityId: userId,
          entityName: description,
          severity: 'INFO',
          changes: metadata,
        },
      });
      return activity;
    } catch (error) {
      logger.error('Failed to log activity:', error);
      return null;
    }
  },
};

export default userActivityController;
