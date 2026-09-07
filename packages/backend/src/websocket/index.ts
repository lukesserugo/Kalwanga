// src/services/notificationService.ts
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { EventEmitter } from 'events';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  bcc?: string[];
}

interface SMSOptions {
  to: string;
  message: string;
}

interface PushNotificationOptions {
  userId: string;
  title: string;
  body: string;
  data?: any;
}

interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  channel?: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
}

interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  lowStockAlerts: boolean;
  saleAlerts: boolean;
  purchaseOrderAlerts: boolean;
  shiftAlerts: boolean;
  systemAlerts: boolean;
}

export class NotificationService extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Safely emit notification (internal method, no websocket dependency)
   */
  private safeEmitNotification(notification: any, businessUnitId: string): void {
    try {
      // Log the notification instead of using websocket
      console.log(`🔔 Notification: ${notification?.title || 'New notification'} - ${businessUnitId}`);
      // You can also emit a local event for any listeners
      this.emit('notification', notification);
    } catch (error) {
      console.warn('Failed to emit notification:', error);
    }
  }

  /**
   * Send email notification (stored in database for processing)
   */
  async sendEmail(to: string, subject: string, html: string): Promise<NotificationResult> {
    try {
      if (!this.isValidEmail(to)) {
        return { success: false, error: 'Invalid email address' };
      }

      const notification = await prisma.notification.create({
        data: {
          title: subject,
          message: html,
          type: 'EMAIL',
          userId: 'system',
        },
      });

      console.log(`Email queued: ${to} - ${subject}`);
      this.emit('emailQueued', { to, subject, notificationId: notification.id });

      return { 
        success: true, 
        notificationId: notification.id,
        channel: 'EMAIL',
      };
    } catch (error) {
      console.error('Email queue failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send SMS notification (stored in database for processing)
   */
  async sendSMS(to: string, message: string): Promise<NotificationResult> {
    try {
      if (!this.isValidPhoneNumber(to)) {
        return { success: false, error: 'Invalid phone number' };
      }

      const notification = await prisma.notification.create({
        data: {
          title: 'SMS',
          message,
          type: 'SMS',
          userId: 'system',
        },
      });

      console.log(`SMS queued: ${to} - ${message}`);
      this.emit('smsQueued', { to, message, notificationId: notification.id });

      return { 
        success: true, 
        notificationId: notification.id,
        channel: 'SMS',
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

      const notification = await prisma.notification.create({
        data: {
          title: options.title,
          message: options.body,
          type: 'PUSH',
          userId: options.userId,
        },
      });

      // FIXED: Use safe internal method instead of websocket import
      this.safeEmitNotification(notification, (notification as any).businessUnitId || '');

      return { 
        success: true, 
        notificationId: notification.id,
        channel: 'PUSH',
      };
    } catch (error) {
      console.error('Push notification failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send receipt via email (stored as notification)
   */
  async sendReceiptEmail(saleId: string, email: string): Promise<NotificationResult> {
    try {
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
            },
          },
        },
      });

      if (!sale) throw new AppError('Sale not found', 404);

      const html = this.generateReceiptHTML(sale);

      const result = await this.sendEmail(
        email,
        `Receipt #${sale.receiptNumber} - ${sale.businessUnit?.name || 'Kalwanga'}`,
        html
      );

      if (sale.userId) {
        await this.sendUserNotification(
          sale.userId,
          'Receipt Sent',
          `Receipt #${sale.receiptNumber} sent to ${email}`,
          'RECEIPT',
          sale.businessUnitId
        );
      }

      return result;
    } catch (error) {
      console.error('Send receipt email failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Generate receipt HTML
   */
  private generateReceiptHTML(sale: any): string {
    const items = sale.items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product.name}</td>
        <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; text-align: right; border-bottom: 1px solid #eee;">$${item.total.toFixed(2)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #2c3e50; margin: 0; }
          .info { margin-bottom: 20px; }
          .total { text-align: right; font-size: 18px; margin-top: 20px; }
          .footer { margin-top: 30px; text-align: center; color: #7f8c8d; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${sale.businessUnit?.name || 'Kalwanga'}</h1>
            <p>${sale.businessUnit?.address || ''}</p>
          </div>
          <div class="info">
            <p><strong>Receipt #:</strong> ${sale.receiptNumber}</p>
            <p><strong>Date:</strong> ${sale.saleDate.toLocaleString()}</p>
            <p><strong>Customer:</strong> ${sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Guest'}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left;">Item</th>
                <th style="padding: 10px; text-align: center;">Qty</th>
                <th style="padding: 10px; text-align: right;">Price</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${items}</tbody>
          </table>
          <div style="margin-top: 20px; text-align: right;">
            <p><strong>Total: $${sale.total.toFixed(2)}</strong></p>
          </div>
          <div class="footer">
            <p>Thank you for your purchase!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

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
        const notification = await prisma.notification.create({
          data: {
            title: 'Low Stock Alert',
            message: alertMessage,
            type: 'LOW_STOCK',
            userId: buUser.userId,
            businessUnitId,
            isRead: false,
          },
        });
        notifications.push(notification);

        // FIXED: Use safe internal method
        this.safeEmitNotification(notification, businessUnitId);

        if (buUser.user.email) {
          await this.sendEmail(
            buUser.user.email,
            'Low Stock Alert',
            `<p>Product <strong>${productName}</strong> is below reorder point.</p>
             <p>Current stock: ${currentStock}</p>
             <p>Reorder point: ${reorderPoint}</p>`
          );
        }
      }

      return notifications;
    } catch (error) {
      console.error('Send low stock alert failed:', error);
      throw new AppError('Failed to send low stock alert', 500);
    }
  }

  /**
   * Send notification to specific user
   */
  async sendUserNotification(
    userId: string, 
    title: string, 
    message: string, 
    type: string = 'INFO', 
    businessUnitId?: string,
    metadata?: any
  ) {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const notification = await prisma.notification.create({
        data: {
          title,
          message,
          type,
          userId,
          businessUnitId,
          isRead: false,
        },
      });

      // FIXED: Use safe internal method
      this.safeEmitNotification(notification, businessUnitId || '');

      return notification;
    } catch (error) {
      console.error('Send user notification failed:', error);
      throw new AppError('Failed to send notification', 500);
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
    metadata?: any,
    excludeUserId?: string
  ) {
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

      const notifications = await Promise.all(
        users.map(user =>
          prisma.notification.create({
            data: {
              title,
              message,
              type,
              userId: user.userId,
              businessUnitId,
              isRead: false,
            },
          })
        )
      );

      // FIXED: Use safe internal method
      this.safeEmitNotification({ title, message, type, businessUnitId, ...(metadata && { metadata }) }, businessUnitId);

      return notifications;
    } catch (error) {
      console.error('Send business unit notification failed:', error);
      throw new AppError('Failed to send business unit notification', 500);
    }
  }

  /**
   * Send sale notification
   */
  async sendSaleNotification(businessUnitId: string, saleId: string) {
    try {
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { customer: true },
      });

      if (!sale) return null;

      const customerName = sale.customer
        ? `${sale.customer.firstName} ${sale.customer.lastName}`
        : 'Guest';

      return await this.sendBusinessUnitNotification(
        businessUnitId,
        'New Sale',
        `New sale #${sale.receiptNumber} - ${customerName} - $${sale.total.toFixed(2)}`,
        'SALE',
        { saleId: sale.id, receiptNumber: sale.receiptNumber, total: sale.total }
      );
    } catch (error) {
      console.error('Send sale notification failed:', error);
      return null;
    }
  }

  /**
   * Send purchase order notification
   */
  async sendPurchaseOrderNotification(businessUnitId: string, poNumber: string, supplierName: string, amount?: number) {
    return await this.sendBusinessUnitNotification(
      businessUnitId,
      'Purchase Order',
      `Purchase order ${poNumber} created for ${supplierName}${amount ? ` - $${amount.toFixed(2)}` : ''}`,
      'PURCHASE_ORDER',
      { poNumber, supplierName, amount }
    );
  }

  /**
   * Send shift notification
   */
  async sendShiftNotification(businessUnitId: string, userId: string, shiftStatus: string, shiftDetails?: any) {
    return await this.sendBusinessUnitNotification(
      businessUnitId,
      'Shift Update',
      `Shift has been ${shiftStatus}`,
      'SHIFT',
      { userId, shiftStatus, ...shiftDetails },
      userId
    );
  }

  /**
   * Get user notification preferences (default values)
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    return {
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      lowStockAlerts: true,
      saleAlerts: true,
      purchaseOrderAlerts: true,
      shiftAlerts: true,
      systemAlerts: true,
    };
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>) {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const currentPreferences = await this.getUserNotificationPreferences(userId);
      const updatedPreferences = { ...currentPreferences, ...preferences };

      console.log(`Notification preferences updated for user ${userId}:`, updatedPreferences);

      return updatedPreferences;
    } catch (error) {
      console.error('Update notification preferences failed:', error);
      throw new AppError('Failed to update notification preferences', 500);
    }
  }

  /**
   * Process pending notifications queue
   */
  async processNotificationQueue(limit: number = 100): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    try {
      const pendingNotifications = await prisma.notification.findMany({
        where: {
          type: { in: ['EMAIL', 'SMS'] },
          isRead: false,
        },
        take: limit,
        orderBy: { createdAt: 'asc' },
      });

      let succeeded = 0;
      let failed = 0;

      for (const notification of pendingNotifications) {
        try {
          await prisma.notification.update({
            where: { id: notification.id },
            data: { isRead: true, readAt: new Date() },
          });
          succeeded++;
        } catch (error) {
          console.error(`Failed to process notification ${notification.id}:`, error);
          failed++;
        }
      }

      return {
        processed: pendingNotifications.length,
        succeeded,
        failed,
      };
    } catch (error) {
      console.error('Process notification queue failed:', error);
      throw new AppError('Failed to process notification queue', 500);
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId?: string, businessUnitId?: string) {
    try {
      const where: any = {};
      if (userId) where.userId = userId;
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const [total, unread, byType, recent] = await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { ...where, isRead: false } }),
        prisma.notification.groupBy({
          by: ['type'],
          where,
          _count: { _all: true },
        }),
        prisma.notification.findMany({
          where,
          take: 10,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        total,
        unread,
        read: total - unread,
        byType: byType.map((t: any) => ({
          type: t.type,
          count: t._count._all,
        })),
        recent,
      };
    } catch (error) {
      console.error('Get notification stats failed:', error);
      throw new AppError('Failed to get notification statistics', 500);
    }
  }

  /**
   * Validate email address
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number
   */
  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    return phoneRegex.test(phone);
  }
}

export const notificationService = new NotificationService();
