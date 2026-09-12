// D:\Projects\Kalwanga\packages\backend\src\services\notificationService.ts

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { EventEmitter } from 'events';

// ============================================
// TYPES - Define enums as string literals
// ============================================

export type NotificationType = 
  | 'SALE'
  | 'INVENTORY'
  | 'ORDER'
  | 'PAYMENT'
  | 'CUSTOMER'
  | 'SYSTEM'
  | 'ALERT'
  | 'SUCCESS'
  | 'INFO'
  | 'WARNING'
  | 'ERROR'
  | 'PROMOTION'
  | 'REMINDER'
  | 'LOW_STOCK'
  | 'PURCHASE_ORDER'
  | 'SHIFT'
  | 'RECEIPT';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';

// ============================================
// INTERFACES
// ============================================

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content?: string;
    path?: string;
    contentType?: string;
  }>;
}

interface SMSOptions {
  to: string;
  message: string;
  from?: string;
}

interface PushNotificationOptions {
  userId: string;
  title: string;
  body: string;
  data?: any;
  icon?: string;
  badge?: number;
  sound?: string;
}

interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  channel?: NotificationChannel;
  messageId?: string;
}

interface NotificationPreferences {
  id?: string;
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  lowStockAlerts: boolean;
  saleAlerts: boolean;
  purchaseOrderAlerts: boolean;
  shiftAlerts: boolean;
  systemAlerts: boolean;
  promotionalAlerts: boolean;
  reminderAlerts: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly' | 'never';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Array<{ type: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byChannel: Array<{ channel: string; count: number }>;
  recent: any[];
  trend: {
    daily: Array<{ date: string; count: number }>;
    weekly: Array<{ week: string; count: number }>;
    monthly: Array<{ month: string; count: number }>;
  };
}

interface GetNotificationsParams {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: string;
  priority?: string;
  search?: string;
  userId?: string;
  businessUnitId?: string;
  companyId?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'createdAt' | 'priority' | 'type';
  sortOrder?: 'asc' | 'desc';
}

interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: NotificationType;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateNotificationData {
  userId: string;
  title: string;
  message: string;
  type: string;
  priority?: string;
  link?: string;
  data?: any;
  businessUnitId?: string;
  companyId?: string;
  createdBy?: string;
  scheduledFor?: Date;
  expiresAt?: Date;
  channel?: NotificationChannel;
}

interface BulkNotificationResult {
  results: any[];
  errors: Array<{ index: number; message: string; data?: any }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    successRate: string;
  };
}

// ============================================
// CONSTANTS
// ============================================

const VALID_NOTIFICATION_TYPES: NotificationType[] = [
  'SALE', 'INVENTORY', 'ORDER', 'PAYMENT', 'CUSTOMER',
  'SYSTEM', 'ALERT', 'SUCCESS', 'INFO', 'WARNING',
  'ERROR', 'PROMOTION', 'REMINDER', 'LOW_STOCK',
  'PURCHASE_ORDER', 'SHIFT', 'RECEIPT'
];

const VALID_PRIORITIES: NotificationPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const VALID_CHANNELS: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'];

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId'> = {
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  inAppEnabled: true,
  lowStockAlerts: true,
  saleAlerts: true,
  purchaseOrderAlerts: true,
  shiftAlerts: true,
  systemAlerts: true,
  promotionalAlerts: false,
  reminderAlerts: true,
  emailFrequency: 'immediate',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

// ============================================
// TYPE HELPERS
// ============================================

function mapToNotificationType(type: string): string {
  const mapped = type.toUpperCase();
  if (VALID_NOTIFICATION_TYPES.includes(mapped as NotificationType)) {
    return mapped;
  }
  return 'INFO';
}

function mapToPriority(priority: string): string {
  const mapped = priority.toUpperCase();
  if (VALID_PRIORITIES.includes(mapped as NotificationPriority)) {
    return mapped;
  }
  return 'MEDIUM';
}

function isValidNotificationType(type: string): boolean {
  return VALID_NOTIFICATION_TYPES.includes(type as NotificationType);
}

function isValidPriority(priority: string): boolean {
  return VALID_PRIORITIES.includes(priority as NotificationPriority);
}

function isValidChannel(channel: string): boolean {
  return VALID_CHANNELS.includes(channel as NotificationChannel);
}

function sanitizeNotificationData(data: any): any {
  if (!data) return null;
  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ============================================
// SERVICE CLASS
// ============================================

export class NotificationService extends EventEmitter {
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000;
  private readonly batchSize: number = 100;
  private preferencesCache: Map<string, NotificationPreferences> = new Map();
  private readonly cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('notificationCreated', this.handleNotificationCreated.bind(this));
    this.on('notificationRead', this.handleNotificationRead.bind(this));
    this.on('notificationDeleted', this.handleNotificationDeleted.bind(this));
    this.on('error', this.handleError.bind(this));
  }

  private handleNotificationCreated(notification: any): void {
    console.log(`📨 Notification created: ${notification.id} - ${notification.title}`);
  }

  private handleNotificationRead(data: { notificationId: string; userId: string }): void {
    console.log(`📖 Notification read: ${data.notificationId} by ${data.userId}`);
  }

  private handleNotificationDeleted(data: { notificationId: string; userId: string }): void {
    console.log(`🗑️ Notification deleted: ${data.notificationId} by ${data.userId}`);
  }

  private handleError(error: Error): void {
    console.error('❌ Notification service error:', error);
  }

  /**
   * Safely emit notification
   */
  private safeEmitNotification(notification: any, businessUnitId: string): void {
    try {
      console.log(`🔔 Notification: ${notification?.title || 'New notification'} - ${businessUnitId}`);
      this.emit('notification', notification);
    } catch (error) {
      console.warn('Failed to emit notification:', error);
    }
  }

  /**
   * Check if quiet hours are active
   */
  private isQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    
    const start = preferences.quietHoursStart;
    const end = preferences.quietHoursEnd;

    if (start < end) {
      return currentTime >= start && currentTime < end;
    } else {
      return currentTime >= start || currentTime < end;
    }
  }

  /**
   * Should send notification based on preferences
   */
  private shouldSendNotification(
    preferences: NotificationPreferences,
    type: string,
    channel: NotificationChannel
  ): boolean {
    // Check channel enabled
    if (channel === 'EMAIL' && !preferences.emailEnabled) return false;
    if (channel === 'SMS' && !preferences.smsEnabled) return false;
    if (channel === 'PUSH' && !preferences.pushEnabled) return false;
    if (channel === 'IN_APP' && !preferences.inAppEnabled) return false;

    // Check quiet hours
    if (this.isQuietHours(preferences)) {
      return false;
    }

    // Check type-specific preferences
    const typeMap: Record<string, keyof NotificationPreferences> = {
      'LOW_STOCK': 'lowStockAlerts',
      'SALE': 'saleAlerts',
      'PURCHASE_ORDER': 'purchaseOrderAlerts',
      'SHIFT': 'shiftAlerts',
      'SYSTEM': 'systemAlerts',
      'PROMOTION': 'promotionalAlerts',
      'REMINDER': 'reminderAlerts',
    };

    const preferenceKey = typeMap[type];
    if (preferenceKey && preferences[preferenceKey] === false) {
      return false;
    }

    return true;
  }

  // ============================================
  // CORE NOTIFICATION METHODS
  // ============================================

  /**
   * Get notifications with pagination and filtering
   */
  async getNotifications(params: GetNotificationsParams): Promise<{
    notifications: any[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    unreadCount: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        unreadOnly,
        type,
        priority,
        search,
        userId,
        businessUnitId,
        companyId,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = params;

      const where: any = {};

      if (userId) where.userId = userId;
      if (businessUnitId) where.businessUnitId = businessUnitId;
      if (companyId) where.companyId = companyId;
      if (unreadOnly) where.isRead = false;
      if (type) where.type = mapToNotificationType(type);
      if (priority) where.priority = mapToPriority(priority);
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const take = Math.min(Number(limit), 1000);

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take,
          orderBy: { [sortBy]: sortOrder },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true,
                avatar: true,
              },
            },
          },
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: {
            ...where,
            isRead: false,
          },
        }),
      ]);

      return {
        notifications,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / take),
        limit: take,
        unreadCount,
      };
    } catch (error) {
      console.error('Get notifications failed:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get notifications', 500);
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id: string, userId: string): Promise<any> {
    try {
      if (!id) throw new AppError('Notification ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              avatar: true,
            },
          },
        },
      });

      if (!notification) {
        throw new AppError('Notification not found', 404);
      }

      return notification;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Get notification by ID failed:', error);
      throw new AppError('Failed to get notification', 500);
    }
  }

  /**
   * Create a notification
   */
  async createNotification(data: CreateNotificationData): Promise<any> {
    try {
      if (!data.userId) throw new AppError('User ID is required', 400);
      if (!data.title) throw new AppError('Title is required', 400);
      if (!data.message) throw new AppError('Message is required', 400);
      if (!data.type) throw new AppError('Type is required', 400);

      const notificationType = mapToNotificationType(data.type);
      const priority = data.priority ? mapToPriority(data.priority) : 'MEDIUM';
      const channel = data.channel || 'IN_APP';

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true, email: true, phoneNumber: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Get user preferences
      const preferences = await this.getPreferences(data.userId);

      // Check if should send based on preferences
      if (!this.shouldSendNotification(preferences, notificationType, channel)) {
        return null;
      }

      const notificationData: any = {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: notificationType,
        priority: priority,
        link: data.link || null,
        businessUnitId: data.businessUnitId || null,
        companyId: data.companyId || null,
        isRead: false,
        data: data.data || null,
      };

      const notification = await prisma.notification.create({
        data: notificationData,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              avatar: true,
            },
          },
        },
      });

      // Send via selected channel
      if (channel !== 'IN_APP') {
        await this.sendViaChannel(notification, channel, user);
      }

      this.safeEmitNotification(notification, data.businessUnitId || '');
      this.emit('notificationCreated', notification);

      return notification;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Create notification failed:', error);
      throw new AppError('Failed to create notification', 500);
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendViaChannel(notification: any, channel: NotificationChannel, user: any): Promise<NotificationResult> {
    try {
      switch (channel) {
        case 'EMAIL':
          if (user.email) {
            return await this.sendEmail({
              to: user.email,
              subject: notification.title,
              html: this.generateNotificationHTML(notification),
            });
          }
          return { success: false, error: 'No email address available' };

        case 'SMS':
          if (user.phoneNumber) {
            return await this.sendSMS({
              to: user.phoneNumber,
              message: `${notification.title}: ${notification.message}`,
            });
          }
          return { success: false, error: 'No phone number available' };

        case 'PUSH':
          return await this.sendPushNotification({
            userId: notification.userId,
            title: notification.title,
            body: notification.message,
            data: notification.data || {},
          });

        default:
          return { success: false, error: 'Unsupported channel' };
      }
    } catch (error) {
      console.error(`Send via ${channel} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Generate notification HTML for email
   */
  private generateNotificationHTML(notification: any): string {
    const priorityColors: Record<string, string> = {
      LOW: '#28a745',
      MEDIUM: '#ffc107',
      HIGH: '#fd7e14',
      URGENT: '#dc3545',
    };

    const color = priorityColors[notification.priority] || '#6c757d';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { border-bottom: 2px solid ${color}; padding-bottom: 10px; margin-bottom: 20px; }
          .title { color: ${color}; margin: 0; }
          .priority { display: inline-block; padding: 2px 10px; border-radius: 4px; background: ${color}; color: white; font-size: 12px; }
          .message { margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="title">${notification.title}</h1>
            <span class="priority">${notification.priority}</span>
          </div>
          <div class="message">
            <p>${notification.message}</p>
            ${notification.link ? `<p><a href="${notification.link}">View Details</a></p>` : ''}
          </div>
          <div class="footer">
            <p>Sent: ${new Date(notification.createdAt).toLocaleString()}</p>
            <p>Type: ${notification.type}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Bulk create notifications
   */
  async bulkCreateNotifications(params: {
    notifications: CreateNotificationData[];
    businessUnitId?: string;
    companyId?: string;
    createdBy?: string;
  }): Promise<BulkNotificationResult> {
    try {
      const { notifications, businessUnitId, companyId } = params;
      const results: any[] = [];
      const errors: Array<{ index: number; message: string; data?: any }> = [];

      // Process in batches
      for (let i = 0; i < notifications.length; i += this.batchSize) {
        const batch = notifications.slice(i, i + this.batchSize);
        
        for (let j = 0; j < batch.length; j++) {
          const index = i + j;
          try {
            const data = batch[j];
            const notification = await this.createNotification({
              ...data,
              businessUnitId: data.businessUnitId || businessUnitId,
              companyId: data.companyId || companyId,
            });
            if (notification) {
              results.push(notification);
            }
          } catch (error: any) {
            errors.push({
              index,
              message: error.message || 'Failed to create notification',
              data: batch[j],
            });
          }
        }
      }

      return {
        results,
        errors,
        summary: {
          total: notifications.length,
          succeeded: results.length,
          failed: errors.length,
          successRate: notifications.length > 0 
            ? ((results.length / notifications.length) * 100).toFixed(2) + '%'
            : '0%',
        },
      };
    } catch (error) {
      console.error('Bulk create notifications failed:', error);
      throw new AppError('Failed to bulk create notifications', 500);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string): Promise<any> {
    try {
      if (!id) throw new AppError('Notification ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const existing = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new AppError('Notification not found', 404);
      }

      if (existing.isRead) {
        return existing;
      }

      const notification = await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              avatar: true,
            },
          },
        },
      });

      this.emit('notificationRead', { notificationId: id, userId });
      return notification;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Mark as read failed:', error);
      throw new AppError('Failed to mark notification as read', 500);
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(ids: string[], userId: string): Promise<{ count: number }> {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('At least one notification ID is required', 400);
      }
      if (!userId) throw new AppError('User ID is required', 400);

      const result = await prisma.notification.updateMany({
        where: {
          id: { in: ids },
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      this.emit('notificationsRead', { count: result.count, userId });
      return { count: result.count };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Mark multiple as read failed:', error);
      throw new AppError('Failed to mark notifications as read', 500);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(params: { userId: string; businessUnitId?: string }): Promise<{ count: number }> {
    try {
      const { userId, businessUnitId } = params;
      if (!userId) throw new AppError('User ID is required', 400);

      const where: any = { userId, isRead: false };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const result = await prisma.notification.updateMany({
        where,
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      this.emit('allNotificationsRead', { count: result.count, userId });
      return { count: result.count };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Mark all as read failed:', error);
      throw new AppError('Failed to mark all notifications as read', 500);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: string, userId: string): Promise<{ message: string }> {
    try {
      if (!id) throw new AppError('Notification ID is required', 400);
      if (!userId) throw new AppError('User ID is required', 400);

      const existing = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!existing) {
        throw new AppError('Notification not found', 404);
      }

      await prisma.notification.delete({
        where: { id },
      });

      this.emit('notificationDeleted', { notificationId: id, userId });
      return { message: 'Notification deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Delete notification failed:', error);
      throw new AppError('Failed to delete notification', 500);
    }
  }

  /**
   * Delete all notifications
   */
  async deleteAllNotifications(params: { userId: string; businessUnitId?: string }): Promise<{ count: number }> {
    try {
      const { userId, businessUnitId } = params;
      if (!userId) throw new AppError('User ID is required', 400);

      const where: any = { userId };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const result = await prisma.notification.deleteMany({
        where,
      });

      this.emit('allNotificationsDeleted', { count: result.count, userId });
      return { count: result.count };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Delete all notifications failed:', error);
      throw new AppError('Failed to delete all notifications', 500);
    }
  }

  /**
   * Delete all read notifications
   */
  async deleteReadNotifications(params: { userId: string; businessUnitId?: string }): Promise<{ count: number }> {
    try {
      const { userId, businessUnitId } = params;
      if (!userId) throw new AppError('User ID is required', 400);

      const where: any = { userId, isRead: true };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const result = await prisma.notification.deleteMany({
        where,
      });

      this.emit('readNotificationsDeleted', { count: result.count, userId });
      return { count: result.count };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Delete read notifications failed:', error);
      throw new AppError('Failed to delete read notifications', 500);
    }
  }

  /**
   * Get unread count
   */
  async getUnreadCount(params: { userId: string; businessUnitId?: string }): Promise<number> {
    try {
      const { userId, businessUnitId } = params;
      if (!userId) throw new AppError('User ID is required', 400);

      const where: any = { userId, isRead: false };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      return await prisma.notification.count({ where });
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Get unread count failed:', error);
      throw new AppError('Failed to get unread count', 500);
    }
  }

  // ============================================
  // NOTIFICATION PREFERENCES - FIXED: No Prisma model
  // ============================================

  /**
   * Get user notification preferences - returns defaults
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      if (!userId) throw new AppError('User ID is required', 400);

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Check cache first
      const cached = this.preferencesCache.get(userId);
      if (cached) {
        return cached;
      }

      // Return default preferences
      const preferences = {
        userId,
        ...DEFAULT_PREFERENCES,
      };

      // Cache for 5 minutes
      this.preferencesCache.set(userId, preferences);
      setTimeout(() => this.preferencesCache.delete(userId), this.cacheTTL);

      return preferences;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Get preferences failed:', error);
      throw new AppError('Failed to get notification preferences', 500);
    }
  }

  /**
   * Update user notification preferences - in-memory only
   */
  async updatePreferences(userId: string, data: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      if (!userId) throw new AppError('User ID is required', 400);

      const current = await this.getPreferences(userId);
      const updated = { 
        ...current, 
        ...data, 
        updatedAt: new Date() 
      };

      // Update cache
      this.preferencesCache.set(userId, updated);

      console.log(`Notification preferences updated for user ${userId}:`, updated);
      this.emit('preferencesUpdated', { userId, preferences: updated });

      return updated;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Update preferences failed:', error);
      throw new AppError('Failed to update notification preferences', 500);
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      if (!userId) throw new AppError('User ID is required', 400);

      const defaultPrefs = {
        userId,
        ...DEFAULT_PREFERENCES,
        updatedAt: new Date(),
      };

      this.preferencesCache.set(userId, defaultPrefs);
      this.emit('preferencesReset', { userId, preferences: defaultPrefs });
      return defaultPrefs;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Reset preferences failed:', error);
      throw new AppError('Failed to reset notification preferences', 500);
    }
  }

  // ============================================
  // EMAIL NOTIFICATIONS
  // ============================================

  /**
   * Send email notification
   */
  async sendEmail(options: EmailOptions): Promise<NotificationResult> {
    try {
      if (!this.isValidEmail(options.to)) {
        return { success: false, error: 'Invalid email address' };
      }

      if (!options.subject) {
        return { success: false, error: 'Email subject is required' };
      }

      if (!options.html) {
        return { success: false, error: 'Email content is required' };
      }

      // Create in-app notification for email
      const notification = await prisma.notification.create({
        data: {
          title: options.subject,
          message: options.html.substring(0, 500),
          type: 'SYSTEM',
          priority: 'MEDIUM',
          userId: 'system',
        },
      });

      console.log(`📧 Email queued: ${options.to} - ${options.subject}`);
      this.emit('emailQueued', { 
        to: options.to, 
        subject: options.subject, 
        notificationId: notification.id 
      });

      return {
        success: true,
        notificationId: notification.id,
        channel: 'EMAIL',
        messageId: `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    } catch (error) {
      console.error('Email queue failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(options: SMSOptions): Promise<NotificationResult> {
    try {
      if (!this.isValidPhoneNumber(options.to)) {
        return { success: false, error: 'Invalid phone number' };
      }

      if (!options.message) {
        return { success: false, error: 'SMS message is required' };
      }

      // Truncate message if too long
      const maxLength = 160;
      const message = options.message.length > maxLength 
        ? options.message.substring(0, maxLength - 3) + '...' 
        : options.message;

      const notification = await prisma.notification.create({
        data: {
          title: 'SMS',
          message: message,
          type: 'SYSTEM',
          priority: 'MEDIUM',
          userId: 'system',
        },
      });

      console.log(`📱 SMS queued: ${options.to} - ${message}`);
      this.emit('smsQueued', { 
        to: options.to, 
        message: message, 
        notificationId: notification.id 
      });

      return {
        success: true,
        notificationId: notification.id,
        channel: 'SMS',
        messageId: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    } catch (error) {
      console.error('SMS queue failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send push notification
   */
  async sendPushNotification(options: PushNotificationOptions): Promise<NotificationResult> {
    try {
      if (!options.userId) {
        return { success: false, error: 'User ID is required' };
      }

      if (!options.title) {
        return { success: false, error: 'Push notification title is required' };
      }

      if (!options.body) {
        return { success: false, error: 'Push notification body is required' };
      }

      const notification = await prisma.notification.create({
        data: {
          title: options.title,
          message: options.body,
          type: 'SYSTEM',
          priority: 'MEDIUM',
          userId: options.userId,
          data: options.data || null,
        },
      });

      this.safeEmitNotification(notification, (notification as any).businessUnitId || '');

      return {
        success: true,
        notificationId: notification.id,
        channel: 'PUSH',
        messageId: `push_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      };
    } catch (error) {
      console.error('Push notification failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send receipt via email
   */
  async sendReceiptEmail(saleId: string, email: string): Promise<NotificationResult> {
    try {
      if (!saleId) throw new AppError('Sale ID is required', 400);
      if (!this.isValidEmail(email)) {
        return { success: false, error: 'Invalid email address' };
      }

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  images: true,
                },
              },
            },
          },
          customer: true,
          payments: true,
          businessUnit: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              email: true,
              logo: true,
            },
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!sale) throw new AppError('Sale not found', 404);

      const html = this.generateReceiptHTML(sale);
      const subject = `Receipt #${sale.receiptNumber} - ${sale.businessUnit?.name || 'Kalwanga'}`;

      const result = await this.sendEmail({
        to: email,
        subject,
        html,
      });

      // Also create in-app notification for the sale
      if (sale.userId) {
        await this.createNotification({
          userId: sale.userId,
          title: 'Receipt Sent',
          message: `Receipt #${sale.receiptNumber} sent to ${email}`,
          type: 'RECEIPT',
          businessUnitId: sale.businessUnitId,
        });
      }

      return result;
    } catch (error) {
      console.error('Send receipt email failed:', error);
      if (error instanceof AppError) throw error;
      return { success: false, error: String(error) };
    }
  }

  /**
   * Generate receipt HTML
   */
  private generateReceiptHTML(sale: any): string {
    const items = sale.items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">
          ${item.product.name}
          ${item.product.sku ? `<br><small style="color: #999;">SKU: ${item.product.sku}</small>` : ''}
        </td>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

    const totalPaid = sale.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || sale.total;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 700px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 30px; }
          .header { text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 20px; margin-bottom: 25px; }
          .header h1 { color: #2c3e50; margin: 0; font-size: 24px; }
          .header .subtitle { color: #7f8c8d; margin: 5px 0; }
          .info { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .total-section { margin-top: 20px; text-align: right; padding-top: 20px; border-top: 2px solid #eee; }
          .total-section .total-amount { font-size: 24px; font-weight: bold; color: #2c3e50; }
          .payment-info { margin-top: 15px; padding: 15px; background: #e8f5e9; border-radius: 4px; }
          .footer { margin-top: 30px; text-align: center; color: #95a5a6; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${sale.businessUnit?.logo ? `<img src="${sale.businessUnit.logo}" alt="Logo" style="max-height: 60px; margin-bottom: 10px;" />` : ''}
            <h1>${sale.businessUnit?.name || 'Kalwanga'}</h1>
            <div class="subtitle">${sale.businessUnit?.address || ''}</div>
            <div class="subtitle">${sale.businessUnit?.phone || ''}</div>
          </div>

          <div class="info">
            <div class="info-grid">
              <div><div class="label">Receipt #</div><div class="value">${sale.receiptNumber}</div></div>
              <div><div class="label">Date</div><div class="value">${new Date(sale.saleDate).toLocaleString()}</div></div>
              <div><div class="label">Customer</div><div class="value">${sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Guest'}</div></div>
              <div><div class="label">Cashier</div><div class="value">${sale.user ? `${sale.user.firstName} ${sale.user.lastName}` : 'System'}</div></div>
            </div>
          </div>

          <table style="width:100%; border-collapse:collapse; margin:20px 0;">
            <thead><tr style="background:#f8f9fa;">
              <th style="padding:10px; text-align:left;">Item</th>
              <th style="padding:10px; text-align:center;">Qty</th>
              <th style="padding:10px; text-align:right;">Price</th>
              <th style="padding:10px; text-align:right;">Total</th>
            </tr></thead>
            <tbody>${items}</tbody>
          </table>

          <div class="total-section">
            <div class="subtotal">Subtotal: $${sale.subtotal.toFixed(2)}</div>
            ${sale.discount > 0 ? `<div class="subtotal">Discount: -$${sale.discount.toFixed(2)}</div>` : ''}
            ${sale.tax > 0 ? `<div class="subtotal">Tax: $${sale.tax.toFixed(2)}</div>` : ''}
            <div><span class="total-amount">$${sale.total.toFixed(2)}</span></div>
          </div>

          <div class="payment-info">
            <p><strong>Payment Details</strong></p>
            ${sale.payments?.map((p: any) => `
              <p>${p.paymentMethod}: $${p.amount.toFixed(2)}</p>
            `).join('') || '<p>Cash: $' + totalPaid.toFixed(2) + '</p>'}
          </div>

          <div class="footer">
            <p>Thank you for your purchase!</p>
            <p>Generated: ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ============================================
  // ALERT NOTIFICATIONS
  // ============================================

  /**
   * Send low stock alert
   */
  async sendLowStockAlert(
    businessUnitId: string,
    productName: string,
    currentStock: number,
    reorderPoint: number,
    productId?: string,
    inventoryId?: string
  ): Promise<any[]> {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const users = await prisma.businessUnitUser.findMany({
        where: { businessUnitId, isActive: true },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              phoneNumber: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const notifications = [];
      const alertMessage = `Product ${productName} is below reorder point. Current stock: ${currentStock}, Reorder point: ${reorderPoint}`;

      for (const buUser of users) {
        const notification = await this.createNotification({
          userId: buUser.userId,
          title: 'Low Stock Alert',
          message: alertMessage,
          type: 'LOW_STOCK',
          businessUnitId,
          data: {
            productName,
            currentStock,
            reorderPoint,
            productId,
            inventoryId,
            severity: currentStock === 0 ? 'URGENT' : 'HIGH',
          },
          priority: currentStock === 0 ? 'URGENT' : 'HIGH',
        });

        if (notification) {
          notifications.push(notification);
        }

        // Queue email if enabled
        const preferences = await this.getPreferences(buUser.userId);
        if (preferences.emailEnabled && buUser.user.email) {
          await this.sendEmail({
            to: buUser.user.email,
            subject: `⚠️ Low Stock Alert: ${productName}`,
            html: `
              <h2>Low Stock Alert</h2>
              <p>Product <strong>${productName}</strong> is below reorder point.</p>
              <ul>
                <li>Current stock: <strong>${currentStock}</strong></li>
                <li>Reorder point: <strong>${reorderPoint}</strong></li>
                ${productId ? `<li>Product ID: ${productId}</li>` : ''}
              </ul>
              <p><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/inventory">View Inventory</a></p>
            `,
          });
        }
      }

      return notifications;
    } catch (error) {
      console.error('Send low stock alert failed:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to send low stock alert', 500);
    }
  }

  /**
   * Send sale notification
   */
  async sendSaleNotification(businessUnitId: string, saleId: string): Promise<any[]> {
    try {
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: {
          customer: true,
          user: { select: { firstName: true, lastName: true } },
          businessUnit: { select: { name: true } },
        },
      });

      if (!sale) return [];

      const customerName = sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName}`
        : 'Guest';

      const cashierName = sale.user
        ? `${sale.user.firstName} ${sale.user.lastName}`
        : 'Unknown';

      const users = await prisma.businessUnitUser.findMany({
        where: { businessUnitId, isActive: true },
        select: { userId: true },
      });

      const notifications = [];

      for (const user of users) {
        const notification = await this.createNotification({
          userId: user.userId,
          title: 'New Sale',
          message: `New sale #${sale.receiptNumber} - ${customerName} - $${sale.total.toFixed(2)} (Cashier: ${cashierName})`,
          type: 'SALE',
          businessUnitId,
          data: {
            saleId: sale.id,
            receiptNumber: sale.receiptNumber,
            total: sale.total,
            customerName,
            cashierName,
          },
        });

        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      console.error('Send sale notification failed:', error);
      if (error instanceof AppError) throw error;
      return [];
    }
  }

  /**
   * Send purchase order notification
   */
  async sendPurchaseOrderNotification(
    businessUnitId: string, 
    poNumber: string, 
    supplierName: string, 
    amount?: number,
    poId?: string
  ): Promise<any[]> {
    try {
      const title = `Purchase Order ${poNumber}`;
      const message = `Purchase order ${poNumber} created for ${supplierName}${amount ? ` - $${amount.toFixed(2)}` : ''}`;

      const result = await this.sendBusinessUnitNotification(
        businessUnitId,
        title,
        message,
        'PURCHASE_ORDER',
        undefined,
        {
          poNumber,
          supplierName,
          amount,
          poId,
          timestamp: new Date().toISOString(),
        }
      );

      // Send to specific users who need to approve
      const approvalUsers = await prisma.businessUnitUser.findMany({
        where: { 
          businessUnitId, 
          isActive: true,
          role: { in: ['ADMIN', 'MANAGER'] },
        },
        select: { userId: true },
      });

      for (const user of approvalUsers) {
        await this.createNotification({
          userId: user.userId,
          title: `Purchase Order ${poNumber} - Needs Approval`,
          message: `Purchase order ${poNumber} for ${supplierName} needs your approval.`,
          type: 'PURCHASE_ORDER',
          businessUnitId,
          priority: 'HIGH',
          data: {
            poNumber,
            supplierName,
            amount,
            poId,
            action: 'approve',
          },
        });
      }

      return result;
    } catch (error) {
      console.error('Send purchase order notification failed:', error);
      if (error instanceof AppError) throw error;
      return [];
    }
  }

  /**
   * Send shift notification
   */
  async sendShiftNotification(
    businessUnitId: string,
    userId: string,
    action: 'started' | 'ended' | 'discrepancy',
    shiftId?: string,
    sessionId?: string
  ) {
    try {
      const titles: Record<string, string> = {
        started: 'Shift Started',
        ended: 'Shift Ended',
        discrepancy: 'Cash Discrepancy Detected',
      };

      const messages: Record<string, string> = {
        started: 'You have successfully started a new shift.',
        ended: 'Your shift has been closed successfully.',
        discrepancy: 'A discrepancy was detected when closing the shift. Please review.',
      };

      await prisma.notification.create({
        data: {
          title: titles[action],
          message: messages[action],
          type: action === 'discrepancy' ? 'ALERT' : 'INFO',
          priority: action === 'discrepancy' ? 'HIGH' : 'MEDIUM',
          userId,
          businessUnitId,
          link: shiftId ? `/admin/shifts/${shiftId}` : undefined,   // ✅ clickable
          data: {                                                    // ✅ metadata
            action,
            shiftId,
            sessionId,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to send shift notification:', error);
    }
  }

  /**
   * Send notification to all users in business unit
   */
  async sendBusinessUnitNotification(
    businessUnitId: string,
    title: string,
    message: string,
    type: string = 'INFO',
    excludeUserId?: string,
    data?: any
  ): Promise<any[]> {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const users = await prisma.businessUnitUser.findMany({
        where: {
          businessUnitId,
          isActive: true,
          ...(excludeUserId && { userId: { not: excludeUserId } }),
        },
        select: { userId: true },
      });

      const notifications = [];
      const notificationType = mapToNotificationType(type);

      for (const user of users) {
        const notification = await this.createNotification({
          userId: user.userId,
          title,
          message,
          type: notificationType,
          businessUnitId,
          data,
        });

        if (notification) {
          notifications.push(notification);
        }
      }

      this.safeEmitNotification({ title, message, type, businessUnitId, data }, businessUnitId);

      return notifications;
    } catch (error) {
      console.error('Send business unit notification failed:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to send business unit notification', 500);
    }
  }

  /**
   * Send notification to specific role
   */
  async sendRoleNotification(
    businessUnitId: string,
    role: string,
    title: string,
    message: string,
    type: string = 'INFO',
    data?: any
  ): Promise<any[]> {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);
      if (!role) throw new AppError('Role is required', 400);

      const users = await prisma.businessUnitUser.findMany({
        where: {
          businessUnitId,
          isActive: true,
          role: role as any,
        },
        select: { userId: true },
      });

      const notifications = [];

      for (const user of users) {
        const notification = await this.createNotification({
          userId: user.userId,
          title,
          message,
          type: mapToNotificationType(type),
          businessUnitId,
          data,
        });

        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;
    } catch (error) {
      console.error('Send role notification failed:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to send role notification', 500);
    }
  }

  // ============================================
  // NOTIFICATION TEMPLATES - FIXED: No Prisma model
  // ============================================

  private templatesCache: NotificationTemplate[] = [];
  private templatesCacheTime: number = 0;
  private readonly templatesCacheTTL: number = 60 * 60 * 1000; // 1 hour

  /**
   * Get notification templates - returns default templates
   */
  async getTemplates(params?: { isActive?: boolean; type?: string }): Promise<NotificationTemplate[]> {
    try {
      // Check cache
      const now = Date.now();
      if (now - this.templatesCacheTime < this.templatesCacheTTL && this.templatesCache.length > 0) {
        let result = this.templatesCache;
        if (params?.isActive !== undefined) {
          result = result.filter(t => t.isActive === params.isActive);
        }
        if (params?.type) {
          result = result.filter(t => t.type === params.type);
        }
        return result;
      }

      // Return default templates
      const defaultTemplates: NotificationTemplate[] = [
        {
          id: 'template_low_stock',
          name: 'Low Stock Alert',
          subject: '⚠️ Low Stock Alert: {{productName}}',
          body: 'Product {{productName}} is running low. Current stock: {{currentStock}}, Reorder point: {{reorderPoint}}.',
          type: 'LOW_STOCK',
          variables: ['productName', 'currentStock', 'reorderPoint', 'productId'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template_sale',
          name: 'New Sale Notification',
          subject: 'New Sale #{{receiptNumber}}',
          body: 'A new sale has been completed. Customer: {{customerName}}, Total: ${{total}}.',
          type: 'SALE',
          variables: ['receiptNumber', 'customerName', 'total', 'cashierName'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template_purchase_order',
          name: 'Purchase Order Created',
          subject: 'Purchase Order {{poNumber}} Created',
          body: 'Purchase order {{poNumber}} has been created for {{supplierName}}.${{amount}}',
          type: 'PURCHASE_ORDER',
          variables: ['poNumber', 'supplierName', 'amount', 'poId'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template_shift',
          name: 'Shift Update',
          subject: 'Shift {{shiftStatus}}',
          body: 'Your shift has been {{shiftStatus}}.',
          type: 'SHIFT',
          variables: ['shiftStatus', 'cashierName', 'shiftId'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'template_receipt',
          name: 'Receipt Sent',
          subject: 'Receipt #{{receiptNumber}}',
          body: 'Receipt #{{receiptNumber}} has been sent to {{email}}.',
          type: 'RECEIPT',
          variables: ['receiptNumber', 'email', 'total'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      this.templatesCache = defaultTemplates;
      this.templatesCacheTime = now;

      return defaultTemplates;
    } catch (error) {
      console.error('Get templates failed:', error);
      return [];
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<NotificationTemplate | null> {
    try {
      if (!id) throw new AppError('Template ID is required', 400);
      const templates = await this.getTemplates();
      return templates.find(t => t.id === id) || null;
    } catch (error) {
      console.error('Get template by ID failed:', error);
      return null;
    }
  }

  /**
   * Create notification template
   */
  async createTemplate(data: Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate> {
    try {
      if (!data.name) throw new AppError('Template name is required', 400);
      if (!data.subject) throw new AppError('Template subject is required', 400);
      if (!data.body) throw new AppError('Template body is required', 400);
      if (!data.type) throw new AppError('Template type is required', 400);

      const newTemplate: NotificationTemplate = {
        id: `template_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: data.name,
        subject: data.subject,
        body: data.body,
        type: mapToNotificationType(data.type) as NotificationType,
        variables: data.variables || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add to cache
      const templates = await this.getTemplates();
      templates.push(newTemplate);
      this.templatesCache = templates;
      this.templatesCacheTime = Date.now();

      return newTemplate;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Create template failed:', error);
      throw new AppError('Failed to create notification template', 500);
    }
  }

  /**
   * Update notification template
   */
  async updateTemplate(id: string, data: Partial<Omit<NotificationTemplate, 'id' | 'createdAt' | 'updatedAt'>>): Promise<NotificationTemplate> {
    try {
      if (!id) throw new AppError('Template ID is required', 400);

      const templates = await this.getTemplates();
      const index = templates.findIndex(t => t.id === id);
      if (index === -1) {
        throw new AppError('Template not found', 404);
      }

      const updated = { ...templates[index] };
      if (data.name !== undefined) updated.name = data.name;
      if (data.subject !== undefined) updated.subject = data.subject;
      if (data.body !== undefined) updated.body = data.body;
      if (data.type !== undefined) updated.type = mapToNotificationType(data.type) as NotificationType;
      if (data.variables !== undefined) updated.variables = data.variables;
      if (data.isActive !== undefined) updated.isActive = data.isActive;
      updated.updatedAt = new Date();

      templates[index] = updated;
      this.templatesCache = templates;
      this.templatesCacheTime = Date.now();

      return updated;
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Update template failed:', error);
      throw new AppError('Failed to update notification template', 500);
    }
  }

  /**
   * Delete notification template
   */
  async deleteTemplate(id: string): Promise<{ message: string }> {
    try {
      if (!id) throw new AppError('Template ID is required', 400);

      const templates = await this.getTemplates();
      const filtered = templates.filter(t => t.id !== id);
      if (filtered.length === templates.length) {
        throw new AppError('Template not found', 404);
      }

      this.templatesCache = filtered;
      this.templatesCacheTime = Date.now();

      return { message: 'Template deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('Delete template failed:', error);
      throw new AppError('Failed to delete notification template', 500);
    }
  }

  /**
   * Render template with variables
   */
  renderTemplate(template: NotificationTemplate, variables: Record<string, string>): { subject: string; body: string } {
    let subject = template.subject;
    let body = template.body;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      body = body.replace(new RegExp(placeholder, 'g'), value);
    }

    return { subject, body };
  }

  // ============================================
  // STATISTICS
  // ============================================

  /**
   * Get notification statistics
   */
  async getStats(userId?: string, businessUnitId?: string): Promise<NotificationStats> {
    try {
      const where: any = {};
      if (userId) where.userId = userId;
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const [total, unread, byType, byPriority, recent] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { ...where, isRead: false } }),
        prisma.notification.groupBy({
          by: ['type'],
          where,
          _count: { _all: true },
        }),
        prisma.notification.groupBy({
          by: ['priority'],
          where,
          _count: { _all: true },
        }),
        prisma.notification.findMany({
          where,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Get trend data
      const now = new Date();
      const dailyTrend = await this.getDailyTrend(where, now);
      const weeklyTrend = await this.getWeeklyTrend(where, now);
      const monthlyTrend = await this.getMonthlyTrend(where, now);

      return {
        total,
        unread,
        read: total - unread,
        byType: byType.map((t: any) => ({
          type: t.type,
          count: t._count._all,
        })),
        byPriority: byPriority.map((p: any) => ({
          priority: p.priority,
          count: p._count._all,
        })),
        byChannel: [
          { channel: 'IN_APP', count: total },
        ],
        recent,
        trend: {
          daily: dailyTrend,
          weekly: weeklyTrend,
          monthly: monthlyTrend,
        },
      };
    } catch (error) {
      console.error('Get notification stats failed:', error);
      throw new AppError('Failed to get notification statistics', 500);
    }
  }

  /**
   * Get daily trend
   */
  private async getDailyTrend(where: any, now: Date): Promise<Array<{ date: string; count: number }>> {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);

    try {
      const results = await prisma.$queryRaw`
        SELECT DATE(createdAt) as date, COUNT(*) as count
        FROM Notification
        WHERE createdAt >= ${startDate}
        ${where.userId ? `AND userId = '${where.userId}'` : ''}
        ${where.businessUnitId ? `AND businessUnitId = '${where.businessUnitId}'` : ''}
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
      `;

      if (Array.isArray(results)) {
        return results.map((r: any) => ({
          date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : r.date,
          count: Number(r.count),
        }));
      }
    } catch (error) {
      console.log('Daily trend query failed:', error);
    }

    return [];
  }

  /**
   * Get weekly trend
   */
  private async getWeeklyTrend(where: any, now: Date): Promise<Array<{ week: string; count: number }>> {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 90);

    try {
      const results = await prisma.$queryRaw`
        SELECT YEARWEEK(createdAt) as week, COUNT(*) as count
        FROM Notification
        WHERE createdAt >= ${startDate}
        ${where.userId ? `AND userId = '${where.userId}'` : ''}
        ${where.businessUnitId ? `AND businessUnitId = '${where.businessUnitId}'` : ''}
        GROUP BY YEARWEEK(createdAt)
        ORDER BY week DESC
      `;

      if (Array.isArray(results)) {
        return results.map((r: any) => ({
          week: String(r.week),
          count: Number(r.count),
        }));
      }
    } catch (error) {
      console.log('Weekly trend query failed:', error);
    }

    return [];
  }

  /**
   * Get monthly trend
   */
  private async getMonthlyTrend(where: any, now: Date): Promise<Array<{ month: string; count: number }>> {
    const startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 1);

    try {
      const results = await prisma.$queryRaw`
        SELECT DATE_FORMAT(createdAt, '%Y-%m') as month, COUNT(*) as count
        FROM Notification
        WHERE createdAt >= ${startDate}
        ${where.userId ? `AND userId = '${where.userId}'` : ''}
        ${where.businessUnitId ? `AND businessUnitId = '${where.businessUnitId}'` : ''}
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY month DESC
      `;

      if (Array.isArray(results)) {
        return results.map((r: any) => ({
          month: r.month,
          count: Number(r.count),
        }));
      }
    } catch (error) {
      console.log('Monthly trend query failed:', error);
    }

    return [];
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number
   */
  private isValidPhoneNumber(phone: string): boolean {
    if (!phone) return false;
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Clean expired notifications - FIXED: expiresAt doesn't exist on Notification model
   */
  async cleanExpiredNotifications(): Promise<{ count: number }> {
    try {
      // Notification model doesn't have expiresAt, so just return 0
      console.log('🧹 No expired notifications to clean (expiresAt field not available)');
      return { count: 0 };
    } catch (error) {
      console.error('Clean expired notifications failed:', error);
      return { count: 0 };
    }
  }

  /**
   * Archive old notifications
   */
  async archiveOldNotifications(daysOld: number = 90): Promise<{ count: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          isRead: true,
        },
      });

      console.log(`📦 Archived ${result.count} notifications older than ${daysOld} days`);
      return { count: result.count };
    } catch (error) {
      console.error('Archive old notifications failed:', error);
      return { count: 0 };
    }
  }
}

// ============================================
// EXPORT SINGLETON INSTANCE
// ============================================

export const notificationService = new NotificationService();
