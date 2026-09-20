// D:\Projects\Kalwanga\packages\backend\src\controllers\notificationController.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { notificationService } from '../services/notificationService.js';
import { z } from 'zod';
import {
  createNotificationSchema,
  updateNotificationSchema,
  bulkCreateNotificationsSchema,
  markReadSchema,
  updatePreferencesSchema,
  notificationQuerySchema,
} from '../utils/validators.js';

// ============================================
// TYPE DEFINITIONS - Use Prisma enums for type safety
// ============================================

import {
  NotificationType as PrismaNotificationType,
  NotificationPriority as PrismaNotificationPriority,
} from '../generated/prisma/index.js';

// ============================================
// TYPE HELPERS
// ============================================

/**
 * Map string to Prisma NotificationType enum.
 *
 * The full enum now includes the four extended members that the
 * notification service writes from its alert paths:
 *   LOW_STOCK      — low inventory alert
 *   PURCHASE_ORDER — PO created / needs approval
 *   SHIFT          — shift started / ended / discrepancy
 *   RECEIPT        — receipt emailed
 *
 * Any string that isn't recognized falls back to INFO, which is
 * the same behavior as before the enum was extended.
 */
function mapToNotificationType(type: string): PrismaNotificationType {
  const typeMap: Record<string, PrismaNotificationType> = {
    'SALE': PrismaNotificationType.SALE,
    'INVENTORY': PrismaNotificationType.INVENTORY,
    'ORDER': PrismaNotificationType.ORDER,
    'PAYMENT': PrismaNotificationType.PAYMENT,
    'CUSTOMER': PrismaNotificationType.CUSTOMER,
    'SYSTEM': PrismaNotificationType.SYSTEM,
    'ALERT': PrismaNotificationType.ALERT,
    'SUCCESS': PrismaNotificationType.SUCCESS,
    'INFO': PrismaNotificationType.INFO,
    'WARNING': PrismaNotificationType.WARNING,
    'ERROR': PrismaNotificationType.ERROR,
    'PROMOTION': PrismaNotificationType.PROMOTION,
    'REMINDER': PrismaNotificationType.REMINDER,
    // Extended members — these are the four the service writes.
    'LOW_STOCK': PrismaNotificationType.LOW_STOCK,
    'PURCHASE_ORDER': PrismaNotificationType.PURCHASE_ORDER,
    'SHIFT': PrismaNotificationType.SHIFT,
    'RECEIPT': PrismaNotificationType.RECEIPT,
  };

  const mapped = type.toUpperCase();
  return typeMap[mapped] || PrismaNotificationType.INFO;
}

/**
 * Map string to Prisma NotificationPriority enum.
 *
 * Used wherever a request supplies `priority` so the create paths
 * don't hardcode MEDIUM. Falls back to MEDIUM for unknown values,
 * which matches the model's default.
 */
function mapToPriority(priority?: string): PrismaNotificationPriority {
  if (!priority) return PrismaNotificationPriority.MEDIUM;

  const map: Record<string, PrismaNotificationPriority> = {
    LOW: PrismaNotificationPriority.LOW,
    MEDIUM: PrismaNotificationPriority.MEDIUM,
    HIGH: PrismaNotificationPriority.HIGH,
    URGENT: PrismaNotificationPriority.URGENT,
  };

  return map[priority.toUpperCase()] || PrismaNotificationPriority.MEDIUM;
}

// ============================================
// CONTROLLER
// ============================================

export const notificationController = {
  /**
   * Get all notifications for current user with pagination and filtering
   * GET /notifications
   */
  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};
      const params = notificationQuerySchema.parse(req.query);

      if (!userId) throw new AppError('User required', 400);

      const { page = 1, limit = 20, unreadOnly, type, search } = params;

      const where: any = { userId };

      if (unreadOnly) where.isRead = false;
      if (type) where.type = mapToNotificationType(type);
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      res.json({
        success: true,
        data: notifications,
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          limit: Number(limit),
        },
        unreadCount,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid query parameters',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get notification by ID
   * GET /notifications/:id
   */
  async getNotificationById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { id: userId } = (req as any).user || {};

      if (!id) throw new AppError('Notification ID is required', 400);
      if (!userId) throw new AppError('User required', 400);

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        throw new AppError('Notification not found', 404);
      }

      res.json({ success: true, data: notification });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get notification statistics
   * GET /notifications/stats
   */
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};
      const { businessUnitId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const [total, unread, read, byType] = await Promise.all([
        prisma.notification.count({ where: { userId } }),
        prisma.notification.count({ where: { userId, isRead: false } }),
        prisma.notification.count({ where: { userId, isRead: true } }),
        prisma.notification.groupBy({
          by: ['type'],
          where: { userId },
          _count: true,
        }),
      ]);

      const typeMap: Record<string, number> = {};
      byType.forEach((item: any) => {
        typeMap[item.type] = item._count;
      });

      res.json({
        success: true,
        data: {
          total,
          unread,
          read,
          byType: typeMap,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get unread count
   * GET /notifications/unread-count
   */
  async getUnreadCount(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const count = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      res.json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mark notification as read
   * PUT /notifications/:id/read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { id: userId } = (req as any).user || {};

      if (!id) throw new AppError('Notification ID is required', 400);
      if (!userId) throw new AppError('User required', 400);

      const existing = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new AppError('Notification not found', 404);
      }

      if (existing.isRead) {
        return res.json({ success: true, data: existing });
      }

      const notification = await prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      });

      res.json({
        success: true,
        data: notification,
        message: 'Notification marked as read',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mark notification as unread
   * PUT /notifications/:id/unread
   */
  async markAsUnread(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { id: userId } = (req as any).user || {};

      if (!id) throw new AppError('Notification ID is required', 400);
      if (!userId) throw new AppError('User required', 400);

      const existing = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new AppError('Notification not found', 404);
      }

      const notification = await prisma.notification.update({
        where: { id },
        data: { isRead: false, readAt: null },
      });

      res.json({
        success: true,
        data: notification,
        message: 'Notification marked as unread',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mark multiple notifications as read
   * PUT /notifications/mark-read
   */
  async markMultipleAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = markReadSchema.parse(req.body);
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const result = await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          userId,
          isRead: false,
        },
        data: { isRead: true, readAt: new Date() },
      });

      res.json({
        success: true,
        data: { count: result.count },
        message: `${result.count} notifications marked as read`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Mark all notifications as read
   * PUT /notifications/read-all
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const result = await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });

      res.json({
        success: true,
        message: `${result.count} notifications marked as read`,
        data: { count: result.count },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete notification
   * DELETE /notifications/:id
   */
  async deleteNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { id: userId } = (req as any).user || {};

      if (!id) throw new AppError('Notification ID is required', 400);
      if (!userId) throw new AppError('User required', 400);

      const existing = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new AppError('Notification not found', 404);
      }

      await prisma.notification.delete({ where: { id } });

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete all notifications
   * DELETE /notifications
   */
  async deleteAllNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const result = await prisma.notification.deleteMany({
        where: { userId },
      });

      res.json({
        success: true,
        message: `${result.count} notifications deleted`,
        data: { count: result.count },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete all read notifications
   * DELETE /notifications/read
   */
  async deleteReadNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const result = await prisma.notification.deleteMany({
        where: { userId, isRead: true },
      });

      res.json({
        success: true,
        message: `${result.count} read notifications deleted`,
        data: { count: result.count },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new notification
   * POST /notifications
   * Access: ADMIN or SUPER_ADMIN only
   */
  async createNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createNotificationSchema.parse(req.body);
      const { id: userId } = (req as any).user || {};
      const { businessUnitId, companyId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      // Map string type and priority to Prisma enums
      const notificationType = mapToNotificationType(data.type);
      const notificationPriority = mapToPriority(data.priority);

      // If no userId in request, send to all users in business unit
      let targetUserId = data.userId;
      let targetBusinessUnitId = data.businessUnitId || businessUnitId;

      // If no specific user, send to all users in business unit
      if (!targetUserId && targetBusinessUnitId) {
        const users = await prisma.businessUnitUser.findMany({
          where: { businessUnitId: targetBusinessUnitId, isActive: true },
          select: { userId: true },
        });

        const notifications = await Promise.all(
          users.map((u: any) =>
            prisma.notification.create({
              data: {
                userId: u.userId,
                title: data.title,
                message: data.message,
                type: notificationType,
                priority: notificationPriority,
                link: data.link,
                data: data.data || null,
                businessUnitId: targetBusinessUnitId,
                companyId: data.companyId || companyId,
              },
            }),
          ),
        );

        return res.status(201).json({
          success: true,
          data: notifications,
          message: `${notifications.length} notifications created`,
        });
      }

      // Create single notification
      const notification = await prisma.notification.create({
        data: {
          userId: targetUserId || userId,
          title: data.title,
          message: data.message,
          type: notificationType,
          priority: notificationPriority,
          link: data.link,
          data: data.data || null,
          businessUnitId: targetBusinessUnitId || businessUnitId,
          companyId: data.companyId || companyId,
        },
      });

      res.status(201).json({
        success: true,
        data: notification,
        message: 'Notification created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Bulk create notifications
   * POST /notifications/bulk
   * Access: ADMIN or SUPER_ADMIN only
   */
  async bulkCreateNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { notifications } = bulkCreateNotificationsSchema.parse(req.body);
      const { id: userId } = (req as any).user || {};
      const { businessUnitId, companyId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const results: any[] = [];
      const errors: Array<{ index: number; message: string }> = [];

      for (let i = 0; i < notifications.length; i++) {
        try {
          const data = notifications[i];
          const notificationType = mapToNotificationType(data.type);
          const notificationPriority = mapToPriority(data.priority);

          const notification = await prisma.notification.create({
            data: {
              userId: data.userId || userId,
              title: data.title,
              message: data.message,
              type: notificationType,
              priority: notificationPriority,
              link: data.link,
              data: data.data || null,
              businessUnitId: data.businessUnitId || businessUnitId,
              companyId: data.companyId || companyId,
            },
          });
          results.push(notification);
        } catch (error: any) {
          errors.push({
            index: i,
            message: error.message || 'Failed to create notification',
          });
        }
      }

      res.status(201).json({
        success: true,
        data: { results, errors },
        message: `${results.length} notifications created, ${errors.length} failed`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get notification preferences
   * GET /notifications/preferences
   */
  async getPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      // Use notification service to get preferences
      const preferences = await notificationService.getPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update notification preferences
   * PUT /notifications/preferences
   */
  async updatePreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const data = updatePreferencesSchema.parse(req.body);
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      // Convert data to match NotificationPreferences type
      const preferencesData: any = {};
      if (data.email !== undefined) preferencesData.emailEnabled = data.email;
      if (data.push !== undefined) preferencesData.pushEnabled = data.push;
      if (data.inApp !== undefined) preferencesData.inAppEnabled = data.inApp;
      // Handle types if needed
      if (data.types) {
        if (data.types.lowStock !== undefined)
          preferencesData.lowStockAlerts = data.types.lowStock;
        if (data.types.sale !== undefined)
          preferencesData.saleAlerts = data.types.sale;
        if (data.types.purchaseOrder !== undefined)
          preferencesData.purchaseOrderAlerts = data.types.purchaseOrder;
        if (data.types.shift !== undefined)
          preferencesData.shiftAlerts = data.types.shift;
        if (data.types.system !== undefined)
          preferencesData.systemAlerts = data.types.system;
      }

      const preferences = await notificationService.updatePreferences(
        userId,
        preferencesData,
      );

      res.json({
        success: true,
        data: preferences,
        message: 'Notification preferences updated',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Reset notification preferences
   * POST /notifications/preferences/reset
   */
  async resetPreferences(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const preferences = await notificationService.resetPreferences(userId);

      res.json({
        success: true,
        data: preferences,
        message: 'Notification preferences reset to defaults',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send notification (legacy method)
   * POST /notifications/send
   */
  async sendNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const notificationType = mapToNotificationType(data.type);
      const notificationPriority = mapToPriority(data.priority);

      const notification = await prisma.notification.create({
        data: {
          userId: data.userId || userId,
          title: data.title,
          message: data.message,
          type: notificationType,
          priority: notificationPriority,
          link: data.link,
          data: data.data || null,
          businessUnitId: data.businessUnitId,
          companyId: data.companyId,
        },
      });

      res.status(201).json({
        success: true,
        data: notification,
        message: 'Notification sent successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send low stock alert notification
   * POST /notifications/low-stock
   */
  async sendLowStockAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        businessUnitId,
        productName,
        currentStock,
        reorderPoint,
        productId,
        inventoryId,
      } = req.body;

      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);
      if (!productName) throw new AppError('Product name is required', 400);
      if (currentStock === undefined)
        throw new AppError('Current stock is required', 400);
      if (reorderPoint === undefined)
        throw new AppError('Reorder point is required', 400);

      const notifications = await notificationService.sendLowStockAlert(
        businessUnitId,
        productName,
        currentStock,
        reorderPoint,
        productId,
        inventoryId,
      );

      res.json({
        success: true,
        data: notifications,
        message: `Low stock alerts sent to ${notifications.length} users`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Send sale notification
   * POST /notifications/sale
   */
  async sendSaleNotification(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, saleId } = req.body;

      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);
      if (!saleId) throw new AppError('Sale ID is required', 400);

      const notifications = await notificationService.sendSaleNotification(
        businessUnitId,
        saleId,
      );

      res.json({
        success: true,
        data: notifications,
        message: `Sale notifications sent to ${notifications.length} users`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Process notification queue (admin only)
   * POST /notifications/process-queue
   */
  async processQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const { limit = 100 } = req.body;

      const pending = await prisma.notification.findMany({
        where: { isRead: false },
        take: Number(limit),
        orderBy: { createdAt: 'asc' },
      });

      const processed = await prisma.notification.updateMany({
        where: {
          id: { in: pending.map((n: any) => n.id) },
        },
        data: {},
      });

      res.json({
        success: true,
        data: {
          processed: processed.count,
          total: pending.length,
        },
        message: `Processed ${processed.count} notifications`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Real-time notification stream (SSE)
   * GET /notifications/stream
   */
  async notificationStream(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      res.write(
        `data: ${JSON.stringify({ type: 'connected', userId })}\n\n`,
      );

      const pingInterval = setInterval(() => {
        res.write(`: ping\n\n`);
      }, 30000);

      const notificationHandler = (notification: any) => {
        if (notification.userId === userId) {
          res.write(
            `data: ${JSON.stringify({
              type: 'notification',
              data: notification,
            })}\n\n`,
          );
        }
      };

      notificationService.on('notification', notificationHandler);

      req.on('close', () => {
        clearInterval(pingInterval);
        notificationService.removeListener(
          'notification',
          notificationHandler,
        );
        res.end();
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get notification templates
   * GET /notifications/templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const { isActive, type } = req.query;

      const params: { isActive?: boolean; type?: string } = {};
      if (isActive !== undefined) params.isActive = isActive === 'true';
      if (type) params.type = type as string;

      const templates = await notificationService.getTemplates(params);

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get notification template by ID
   * GET /notifications/templates/:id
   */
  async getTemplateById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) throw new AppError('Template ID is required', 400);

      const template = await notificationService.getTemplateById(id);

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      res.json({
        success: true,
        data: template,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create notification template
   * POST /notifications/templates
   */
  async createTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body;

      if (!data.name) throw new AppError('Template name is required', 400);
      if (!data.subject)
        throw new AppError('Template subject is required', 400);
      if (!data.body) throw new AppError('Template body is required', 400);
      if (!data.type) throw new AppError('Template type is required', 400);

      const template = await notificationService.createTemplate(data);

      res.status(201).json({
        success: true,
        data: template,
        message: 'Template created successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update notification template
   * PUT /notifications/templates/:id
   */
  async updateTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = req.body;

      if (!id) throw new AppError('Template ID is required', 400);

      const template = await notificationService.updateTemplate(id, data);

      res.json({
        success: true,
        data: template,
        message: 'Template updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete notification template
   * DELETE /notifications/templates/:id
   */
  async deleteTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) throw new AppError('Template ID is required', 400);

      const result = await notificationService.deleteTemplate(id);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Render template with variables
   * POST /notifications/templates/render
   */
  async renderTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { templateId, variables } = req.body;

      if (!templateId) throw new AppError('Template ID is required', 400);
      if (!variables) throw new AppError('Variables are required', 400);

      const template = await notificationService.getTemplateById(templateId);

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      const rendered = notificationService.renderTemplate(
        template,
        variables,
      );

      res.json({
        success: true,
        data: rendered,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get notification statistics with trends
   * GET /notifications/stats/detailed
   */
  async getDetailedStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};
      const { businessUnitId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const stats = await notificationService.getStats(userId, businessUnitId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Clean expired notifications
   * POST /notifications/clean
   */
  async cleanExpired(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await notificationService.cleanExpiredNotifications();

      res.json({
        success: true,
        data: result,
        message: `Cleaned ${result.count} expired notifications`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Archive old notifications
   * POST /notifications/archive
   */
  async archiveOld(req: Request, res: Response, next: NextFunction) {
    try {
      const { daysOld = 90 } = req.body;
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const result =
        await notificationService.archiveOldNotifications(daysOld);

      res.json({
        success: true,
        data: result,
        message: `Archived ${result.count} notifications older than ${daysOld} days`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get notification count by type
   * GET /notifications/count-by-type
   */
  async getCountByType(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const byType = await prisma.notification.groupBy({
        by: ['type'],
        where: { userId },
        _count: true,
      });

      const result: Record<string, number> = {};
      byType.forEach((item: any) => {
        result[item.type] = item._count;
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get notification count by priority
   * GET /notifications/count-by-priority
   */
  async getCountByPriority(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: userId } = (req as any).user || {};

      if (!userId) throw new AppError('User required', 400);

      const byPriority = await prisma.notification.groupBy({
        by: ['priority'],
        where: { userId },
        _count: true,
      });

      const result: Record<string, number> = {};
      byPriority.forEach((item: any) => {
        result[item.priority] = item._count;
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Mark notification as read by notification ID (legacy support)
   * PATCH /notifications/:id/read
   */
  async markNotificationAsRead(req: Request, res: Response, next: NextFunction) {
    return notificationController.markAsRead(req, res, next);
  },

  /**
   * Mark notification as unread by notification ID (legacy support)
   * PATCH /notifications/:id/unread
   */
  async markNotificationAsUnread(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    return notificationController.markAsUnread(req, res, next);
  },
};

export default notificationController;
