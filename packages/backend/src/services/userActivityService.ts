// D:\Projects\Kalwanga\packages\backend\src\services\userActivityService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';

// ============================================
// TYPES
// ============================================

interface CreateActivityData {
  userId: string;
  action: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  status?: 'success' | 'failed' | 'pending';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

interface UpdateActivityData {
  description?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

interface ActivityFilter {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  ipAddress?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// SEVERITY MAPPING
// ============================================

const SEVERITY_MAP: Record<string, string> = {
  'info': 'INFO',
  'warning': 'LOW',
  'error': 'MEDIUM',
  'critical': 'CRITICAL',
};

const REVERSE_SEVERITY_MAP: Record<string, string> = {
  'INFO': 'info',
  'LOW': 'warning',
  'MEDIUM': 'error',
  'CRITICAL': 'critical',
  'HIGH': 'critical',
};

// ============================================
// USER ACTIVITY SERVICE
// ============================================

export class UserActivityService extends BaseService {
  /**
   * Create a new activity log entry
   */
  async createActivity(data: CreateActivityData) {
    try {
      if (!data.userId || !data.action || !data.description) {
        throw new AppError('User ID, action, and description are required', 400);
      }

      // Verify user exists
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action as any,
          entityType: data.resource || 'USER_ACTIVITY',
          entityId: data.resourceId || data.userId,
          entityName: data.description,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          severity: SEVERITY_MAP[data.severity || 'info'] as any || 'INFO',
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
    } catch (error) {
      this.handleError(error, 'UserActivityService.createActivity');
    }
  }

  /**
   * Create multiple activities in batch
   */
  async createActivitiesBatch(activities: CreateActivityData[]) {
    try {
      if (!activities || activities.length === 0) {
        throw new AppError('At least one activity is required', 400);
      }

      return await this.prisma.$transaction(
        activities.map(activity =>
          this.prisma.auditLog.create({
            data: {
              userId: activity.userId,
              action: activity.action as any,
              entityType: activity.resource || 'USER_ACTIVITY',
              entityId: activity.resourceId || activity.userId,
              entityName: activity.description,
              ipAddress: activity.ipAddress,
              userAgent: activity.userAgent,
              severity: SEVERITY_MAP[activity.severity || 'info'] as any || 'INFO',
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
    } catch (error) {
      this.handleError(error, 'UserActivityService.createActivitiesBatch');
    }
  }

  /**
   * Get all activities with filtering
   */
  async getActivities(filters: ActivityFilter = {}) {
    try {
      const page = filters.page || 1;
      const limit = Math.min(200, Math.max(1, filters.limit || 20));
      const skip = (page - 1) * limit;

      const where = this.buildWhereClause(filters);

      const validSortFields = ['createdAt', 'action', 'entityType', 'severity', 'ipAddress'];
      const orderBy: any = validSortFields.includes(filters.sortBy || '')
        ? { [filters.sortBy!]: filters.sortOrder || 'desc' }
        : { createdAt: 'desc' };

      const [activities, total] = await Promise.all([
        this.prisma.auditLog.findMany({
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
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        data: activities,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserActivityService.getActivities');
    }
  }

  /**
   * Get activity by ID
   */
  async getActivityById(id: string) {
    try {
      if (!id) {
        throw new AppError('Activity ID is required', 400);
      }

      const activity = await this.prisma.auditLog.findUnique({
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

      return activity;
    } catch (error) {
      this.handleError(error, 'UserActivityService.getActivityById');
    }
  }

  /**
   * Update activity
   */
  async updateActivity(id: string, data: UpdateActivityData) {
    try {
      if (!id) {
        throw new AppError('Activity ID is required', 400);
      }

      const existingActivity = await this.prisma.auditLog.findUnique({
        where: { id },
      });

      if (!existingActivity) {
        throw new AppError('Activity not found', 404);
      }

      const updateData: any = {};

      if (data.description) {
        updateData.entityName = data.description;
      }

      if (data.severity) {
        updateData.severity = SEVERITY_MAP[data.severity] as any;
      }

      if (data.metadata) {
        updateData.changes = data.metadata;
      }

      return await this.prisma.auditLog.update({
        where: { id },
        data: updateData,
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
    } catch (error) {
      this.handleError(error, 'UserActivityService.updateActivity');
    }
  }

  /**
   * Delete activity
   */
  async deleteActivity(id: string) {
    try {
      if (!id) {
        throw new AppError('Activity ID is required', 400);
      }

      const activity = await this.prisma.auditLog.findUnique({
        where: { id },
      });

      if (!activity) {
        throw new AppError('Activity not found', 404);
      }

      await this.prisma.auditLog.delete({
        where: { id },
      });

      return { message: 'Activity deleted successfully' };
    } catch (error) {
      this.handleError(error, 'UserActivityService.deleteActivity');
    }
  }

  /**
   * Clear activities with filters
   */
  async clearActivities(filters: {
    beforeDate?: string;
    action?: string;
    entityType?: string;
  }) {
    try {
      const where: Prisma.AuditLogWhereInput = {};

      if (filters.beforeDate) {
        where.createdAt = { lt: new Date(filters.beforeDate) };
      }
      if (filters.action) where.action = filters.action as any;
      if (filters.entityType) where.entityType = filters.entityType;

      const result = await this.prisma.auditLog.deleteMany({ where });

      return {
        cleared: result.count,
        message: `Cleared ${result.count} activities`,
      };
    } catch (error) {
      this.handleError(error, 'UserActivityService.clearActivities');
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(dateRange: string = 'month', groupBy?: string) {
    try {
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
        this.prisma.auditLog.count({ where }),
        groupBy ? this.prisma.auditLog.groupBy({
          by: [groupBy as any],
          where,
          _count: { _all: true },
        }) : Promise.resolve([]),
      ]);

      const groupedStats: Record<string, number> = {};
      groupedData.forEach((item: any) => {
        groupedStats[item[groupBy as string] || 'unknown'] = item._count._all;
      });

      return {
        total,
        groupedBy: groupBy,
        groupedStats,
      };
    } catch (error) {
      this.handleError(error, 'UserActivityService.getActivityStats');
    }
  }

  /**
   * Helper method to log an activity internally
   */
  async logActivity(userId: string, action: string, description: string, metadata?: Record<string, any>) {
    try {
      return await this.prisma.auditLog.create({
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
    } catch (error) {
      logger.error('Failed to log activity:', error);
      return null;
    }
  }

  /**
   * Build where clause for filtering
   */
  private buildWhereClause(filters: ActivityFilter): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.action && filters.action !== 'all') {
      where.action = filters.action as any;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters.entityId) {
      where.entityId = filters.entityId;
    }

    if (filters.ipAddress) {
      where.ipAddress = filters.ipAddress;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    if (filters.search) {
      where.OR = [
        { entityName: { contains: filters.search, mode: 'insensitive' } },
        { entityType: { contains: filters.search, mode: 'insensitive' } },
        { entityId: { contains: filters.search, mode: 'insensitive' } },
        { ipAddress: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }
}

export const userActivityService = new UserActivityService();
