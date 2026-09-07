// src/services/auditService.ts
import { prisma } from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/index.js';
import type { Request } from 'express';
import { AuditAction } from '../generated/prisma/index.js';

// Re-export the Prisma AuditAction enum for convenience
export { AuditAction } from '../generated/prisma/index.js';

// Define entity types as a constant object for consistency
export const AuditEntityType = {
  USER: 'USER',
  COMPANY: 'COMPANY',
  BUSINESS_UNIT: 'BUSINESS_UNIT',
  PRODUCT: 'PRODUCT',
  CATEGORY: 'CATEGORY',
  SUPPLIER: 'SUPPLIER',
  INVENTORY: 'INVENTORY',
  SALE: 'SALE',
  SALE_ITEM: 'SALE_ITEM',
  CUSTOMER: 'CUSTOMER',
  PAYMENT: 'PAYMENT',
  INVOICE: 'INVOICE',
  ORDER: 'ORDER',
  SHIPMENT: 'SHIPMENT',
  RETURN: 'RETURN',
  REFUND: 'REFUND',
  DISCOUNT: 'DISCOUNT',
  PROMOTION: 'PROMOTION',
  REVIEW: 'REVIEW',
  RATING: 'RATING',
  WISHLIST: 'WISHLIST',
  CART: 'CART',
  LOYALTY: 'LOYALTY',
  REWARD: 'REWARD',
  NOTIFICATION: 'NOTIFICATION',
  SETTINGS: 'SETTINGS',
  PERMISSION: 'PERMISSION',
  ROLE: 'ROLE',
  AUDIT_LOG: 'AUDIT_LOG',
  IMPORT: 'IMPORT',
  EXPORT: 'EXPORT',
  REPORT: 'REPORT',
  ANALYTICS: 'ANALYTICS',
  SYSTEM: 'SYSTEM',
} as const;

export type AuditEntityType = typeof AuditEntityType[keyof typeof AuditEntityType];

export interface AuditLogEntry {
  action: AuditAction;
  entityType: string;
  entityId: string;
  changes?: any;
  userId?: string;
  companyId?: string | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Log an audit action
   */
  async logAction(
    req: Request, 
    action: AuditAction | string, 
    entityType: string, 
    entityId: string, 
    changes?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const userId = (req as any).user?.id as string | undefined;
      const companyId = (req as any).user?.companyId as string | undefined;

      // Skip if no authenticated user (unless it's a system action)
      if (!userId) {
        console.debug('Audit log skipped: No authenticated user');
        return;
      }

      // Validate action is a valid enum value
      const validAction = this.validateAction(action);
      if (!validAction) {
        console.warn(`Invalid audit action: ${action}. Skipping audit log.`);
        return;
      }

      // Sanitize changes to avoid circular references
      let sanitizedChanges = null;
      if (changes) {
        try {
          sanitizedChanges = this.sanitizeData(changes);
        } catch (error) {
          console.warn('Failed to sanitize audit changes:', error);
          sanitizedChanges = { error: 'Failed to serialize changes' };
        }
      }

      // Prepare audit data using the correct Prisma schema
      const auditData: any = {
        action: validAction,
        entityType,
        entityId,
        changes: sanitizedChanges === null ? undefined : sanitizedChanges,
        user: {
          connect: { id: userId }
        },
        company: companyId ? {
          connect: { id: companyId }
        } : undefined,
        ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        metadata: metadata || undefined,
      };

      // Log to database
      await prisma.auditLog.create({
        data: auditData,
      });

      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUDIT] ${action} on ${entityType} ${entityId} by ${userId}`);
      }
    } catch (error) {
      console.error('Failed to log audit:', error);
      // Don't throw - audit logging should not break the application
    }
  }

  /**
   * Log action without request object (for background tasks, cron jobs, etc.)
   */
  async logSystemAction(
    action: AuditAction | string,
    entityType: string,
    entityId: string,
    userId?: string,
    companyId?: string | null,
    changes?: any,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const validAction = this.validateAction(action);
      if (!validAction) {
        console.warn(`Invalid audit action: ${action}. Skipping audit log.`);
        return;
      }

      let sanitizedChanges = null;
      if (changes) {
        try {
          sanitizedChanges = this.sanitizeData(changes);
        } catch (error) {
          console.warn('Failed to sanitize audit changes:', error);
          sanitizedChanges = { error: 'Failed to serialize changes' };
        }
      }

      const auditData: any = {
        action: validAction,
        entityType,
        entityId,
        changes: sanitizedChanges === null ? undefined : sanitizedChanges,
        user: userId ? {
          connect: { id: userId }
        } : undefined,
        company: companyId ? {
          connect: { id: companyId }
        } : undefined,
        ipAddress: 'system',
        userAgent: 'system',
        metadata: metadata || undefined,
      };

      await prisma.auditLog.create({
        data: auditData,
      });
    } catch (error) {
      console.error('Failed to log system audit:', error);
    }
  }

  /**
   * Get audit logs with filters
   */
  async getAuditLogs(
    filters: {
      userId?: string;
      companyId?: string;
      entityType?: string;
      entityId?: string;
      action?: AuditAction | string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
      search?: string;
      hasBarcode?: boolean;
      businessUnitId?: string;
      page?: number;
      severity?: string;
    } = {}
  ): Promise<{
    logs: any[];
    total: number;
  }> {
    try {
      const {
        userId,
        companyId,
        entityType,
        entityId,
        action,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
        search,
        hasBarcode,
        businessUnitId,
        severity,
      } = filters;

      const where: any = {};

      if (userId) where.userId = userId;
      if (companyId) where.companyId = companyId;
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (severity) where.severity = severity;
      if (action) {
        const validAction = this.validateAction(action);
        if (validAction) where.action = validAction;
      }
      
      // Handle date filters
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      // Handle search
      if (search) {
        where.OR = [
          { entityName: { contains: search, mode: 'insensitive' } },
          { entityId: { contains: search, mode: 'insensitive' } },
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
        ];
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            company: {
              select: {
                id: true,
                name: true,
              },
            },
            businessUnit: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      // Filter by hasBarcode in memory if needed
      let filteredLogs = logs;
      if (hasBarcode !== undefined) {
        filteredLogs = logs.filter(log => {
          const hasBarcodeInChanges = this.checkHasBarcode(log.changes);
          return hasBarcodeInChanges === hasBarcode;
        });
      }

      return { logs: filteredLogs, total: filteredLogs.length };
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      throw error;
    }
  }

  /**
   * Check if changes contain barcode
   */
  private checkHasBarcode(changes: any): boolean {
    if (!changes) return false;
    if (typeof changes !== 'object') return false;
    
    // Check if changes has barcode field
    if (changes.barcode) {
      return true;
    }
    
    // Check all fields for barcode-like values
    for (const key of Object.keys(changes)) {
      const value = changes[key];
      if (value && typeof value === 'object') {
        if (value.new && typeof value.new === 'string' && /^\d{8,13}$/.test(value.new)) {
          return true;
        }
        if (value.value && typeof value.value === 'string' && /^\d{8,13}$/.test(value.value)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get audit logs by entity
   */
  async getAuditLogsByEntity(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          entityType,
          entityId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return logs;
    } catch (error) {
      console.error('Failed to get audit logs by entity:', error);
      return [];
    }
  }

  /**
   * Get recent audit logs for dashboard
   */
  async getRecentAuditLogs(
    companyId: string,
    limit: number = 20
  ): Promise<any[]> {
    try {
      const logs = await prisma.auditLog.findMany({
        where: {
          companyId,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return logs;
    } catch (error) {
      console.error('Failed to get recent audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit log statistics
   */
  async getAuditStats(
    companyId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByUser: Array<{ userId: string; count: number }>;
    actionsByEntity: Array<{ entityType: string; count: number }>;
    recentActivity: Array<{ date: string; count: number }>;
  }> {
    try {
      const where: any = { companyId };
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const logs = await prisma.auditLog.findMany({
        where,
        select: {
          action: true,
          userId: true,
          entityType: true,
          createdAt: true,
        },
      });

      const totalActions = logs.length;

      // Actions by type
      const actionsByType: Record<string, number> = {};
      logs.forEach(log => {
        actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      });

      // Actions by user
      const userMap = new Map<string, number>();
      logs.forEach(log => {
        if (log.userId) {
          userMap.set(log.userId, (userMap.get(log.userId) || 0) + 1);
        }
      });
      const actionsByUser = Array.from(userMap.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Actions by entity
      const entityMap = new Map<string, number>();
      logs.forEach(log => {
        entityMap.set(log.entityType, (entityMap.get(log.entityType) || 0) + 1);
      });
      const actionsByEntity = Array.from(entityMap.entries())
        .map(([entityType, count]) => ({ entityType, count }))
        .sort((a, b) => b.count - a.count);

      // Recent activity (last 7 days)
      const recentActivity: Array<{ date: string; count: number }> = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        const dateStr = date.toISOString().split('T')[0];
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        
        const count = logs.filter(log => {
          const logDate = new Date(log.createdAt);
          return logDate >= date && logDate < nextDate;
        }).length;
        
        recentActivity.push({ date: dateStr, count });
      }

      return {
        totalActions,
        actionsByType,
        actionsByUser,
        actionsByEntity,
        recentActivity,
      };
    } catch (error) {
      console.error('Failed to get audit stats:', error);
      return {
        totalActions: 0,
        actionsByType: {},
        actionsByUser: [],
        actionsByEntity: [],
        recentActivity: [],
      };
    }
  }

  /**
   * Clean old audit logs (keep last N days)
   */
  async cleanOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      return result.count;
    } catch (error) {
      console.error('Failed to clean old audit logs:', error);
      return 0;
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id: string): Promise<any | null> {
    try {
      const log = await prisma.auditLog.findUnique({
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
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          businessUnit: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      return log;
    } catch (error) {
      console.error('Failed to get audit log by ID:', error);
      return null;
    }
  }

  /**
   * Validate and normalize action string to enum
   */
  private validateAction(action: string | AuditAction): AuditAction | null {
    // Check if it's already a valid AuditAction
    if (Object.values(AuditAction).includes(action as AuditAction)) {
      return action as AuditAction;
    }
    
    // Try to convert uppercase string to enum
    const upperAction = action.toUpperCase();
    if (Object.values(AuditAction).includes(upperAction as AuditAction)) {
      return upperAction as AuditAction;
    }
    
    return null;
  }

  /**
   * Sanitize data to avoid circular references and sensitive info
   */
  private sanitizeData(data: any): any {
    // Handle null/undefined
    if (data === null || data === undefined) {
      return null;
    }

    // Handle primitive types
    if (typeof data !== 'object') {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    // Handle objects
    const sanitized: any = {};
    const sensitiveKeys = [
      'password', 'passwordHash', 'token', 'secret', 'apiKey', 
      'accessToken', 'refreshToken', 'privateKey', 'creditCard',
      'cvv', 'cvc', 'pin', 'securityCode', 'authorization',
      'bearer', 'jwt', 'auth', 'credentials'
    ];

    for (const [key, value] of Object.entries(data)) {
      // Skip sensitive data
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Recursively sanitize nested objects
      if (value && typeof value === 'object') {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export const auditService = new AuditService();
