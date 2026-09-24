// D:\Projects\Kalwanga\packages\web\services\notificationService.ts

import { api } from './api';

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

/**
 * Canonical notification types as a runtime list. Kept in sync with
 * the backend enum. Used by UI code that needs to iterate or filter
 * on the known types (icon maps, filter dropdowns, etc.).
 */
export const NOTIFICATION_TYPES: NotificationType[] = [
  'SALE',
  'INVENTORY',
  'ORDER',
  'PAYMENT',
  'CUSTOMER',
  'SYSTEM',
  'ALERT',
  'SUCCESS',
  'INFO',
  'WARNING',
  'ERROR',
  'PROMOTION',
  'REMINDER',
  'LOW_STOCK',
  'PURCHASE_ORDER',
  'SHIFT',
  'RECEIPT',
];

export const NOTIFICATION_PRIORITIES: NotificationPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

/**
 * The notification shape as returned by the backend. Every field the
 * controller emits is declared here so consumers can rely on it.
 */
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
  readAt?: string | null;
  link?: string | null;
  data?: Record<string, any> | null;
  userId: string;
  businessUnitId?: string | null;
  companyId?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  unreadCount?: number;
}

/**
 * Notification preferences. Mirrors the shape the backend service
 * reads in `shouldSendNotification`. Every flag is optional on
 * update; the GET always returns the full object.
 */
export interface NotificationPreferences {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  lowStockAlerts?: boolean;
  saleAlerts?: boolean;
  purchaseOrderAlerts?: boolean;
  shiftAlerts?: boolean;
  systemAlerts?: boolean;
  promotionalAlerts?: boolean;
  reminderAlerts?: boolean;
  receiptAlerts?: boolean;
  emailFrequency?: 'immediate' | 'daily' | 'weekly' | 'never';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  userId?: string;
  updatedAt?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
}

/**
 * Input shape for creating a notification. All optional fields are
 * honored by the controller: `priority`, `link`, `data`, and the
 * scoping ids.
 */
export interface CreateNotificationInput {
  title: string;
  message: string;
  type: NotificationType | string;
  priority?: NotificationPriority;
  link?: string | null;
  data?: Record<string, any> | null;
  userId?: string;
  businessUnitId?: string;
  companyId?: string;
}

// ============================================
// TYPE GUARDS & HELPERS
// ============================================

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function hasDataProperty(
  response: unknown,
): response is { data: unknown } {
  return isObject(response) && 'data' in response;
}

function hasPaginationProperty(
  response: unknown,
): response is { pagination: unknown } {
  return isObject(response) && 'pagination' in response;
}

function hasSuccessProperty(
  response: unknown,
): response is { success: unknown } {
  return isObject(response) && 'success' in response;
}

function hasIdProperty(obj: unknown): obj is { id: string } {
  return isObject(obj) && 'id' in obj && typeof obj.id === 'string';
}

function extractArray<T>(response: unknown): T[] {
  if (!isObject(response)) {
    return [];
  }

  if (hasSuccessProperty(response) && hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data as T[];
    }
    if (
      isObject(data) &&
      hasDataProperty(data) &&
      Array.isArray(data.data)
    ) {
      return data.data as T[];
    }
    return [];
  }

  if (hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data as T[];
    }
    if (
      isObject(data) &&
      hasDataProperty(data) &&
      Array.isArray(data.data)
    ) {
      return data.data as T[];
    }
    return [];
  }

  if (Array.isArray(response)) {
    return response as T[];
  }

  return [];
}

function extractData<T>(response: unknown): T | null {
  if (!isObject(response)) {
    return null;
  }

  if (hasSuccessProperty(response) && hasDataProperty(response)) {
    return response.data as T;
  }

  if (hasDataProperty(response)) {
    return response.data as T;
  }

  return response as T;
}

function extractPagination(response: unknown): {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  unreadCount?: number;
} {
  if (!isObject(response)) {
    return { total: 0, page: 1, totalPages: 0, limit: 10 };
  }

  if (hasPaginationProperty(response) && isObject(response.pagination)) {
    const pagination = response.pagination;
    const unreadCount =
      'unreadCount' in response && typeof response.unreadCount === 'number'
        ? response.unreadCount
        : undefined;

    return {
      total: ('total' in pagination ? Number(pagination.total) : 0) || 0,
      page: ('page' in pagination ? Number(pagination.page) : 1) || 1,
      totalPages:
        ('totalPages' in pagination
          ? Number(pagination.totalPages)
          : 0) || 0,
      limit: ('limit' in pagination ? Number(pagination.limit) : 10) || 10,
      unreadCount,
    };
  }

  if ('total' in response) {
    const total = Number(response.total) || 0;
    const limit =
      ('limit' in response ? Number(response.limit) : 10) || 10;
    return {
      total,
      page: ('page' in response ? Number(response.page) : 1) || 1,
      totalPages: Math.ceil(total / limit) || 1,
      limit,
    };
  }

  return { total: 0, page: 1, totalPages: 0, limit: 10 };
}

// ============================================
// NOTIFICATION SERVICE
// ============================================

export const notificationService = {
  /**
   * Get notifications — GET /notifications
   * Returns paginated response with notification data and unread count.
   */
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
    priority?: string;
    search?: string;
  }): Promise<PaginatedResponse<Notification>> {
    try {
      const response = await api.get('/notifications', { params });

      const data = extractArray<Notification>(response);
      const pagination = extractPagination(response);

      return {
        data,
        total: pagination.total,
        page: pagination.page,
        totalPages: pagination.totalPages,
        limit: pagination.limit,
        unreadCount: pagination.unreadCount,
      };
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return {
        data: [],
        total: 0,
        page: params?.page || 1,
        totalPages: 0,
        limit: params?.limit || 10,
      };
    }
  },

  /**
   * Get notification by ID — GET /notifications/:id
   */
  async getNotificationById(id: string): Promise<Notification> {
    if (!id) {
      throw new Error('Notification ID is required');
    }

    const response = await api.get(`/notifications/${id}`);
    const result = extractData<Notification>(response);

    if (!result || !hasIdProperty(result)) {
      throw new Error('Notification not found');
    }

    return result;
  },

  /**
   * Get notification statistics — GET /notifications/stats
   */
  async getStats(): Promise<NotificationStats> {
    try {
      const response = await api.get('/notifications/stats');
      const result = extractData<NotificationStats>(response);

      return (
        result || {
          total: 0,
          unread: 0,
          read: 0,
          byType: {},
        }
      );
    } catch (error) {
      console.error('Failed to fetch notification stats:', error);
      return {
        total: 0,
        unread: 0,
        read: 0,
        byType: {},
      };
    }
  },

  /**
   * Get unread count — GET /notifications/unread-count
   */
  async getUnreadCount(): Promise<{ count: number }> {
    try {
      const response = await api.get('/notifications/unread-count');
      const result = extractData<{ count: number }>(response);

      return {
        count: result?.count || 0,
      };
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return { count: 0 };
    }
  },

  /**
   * Get count grouped by type — GET /notifications/count-by-type
   */
  async getCountByType(): Promise<Record<string, number>> {
    try {
      const response = await api.get('/notifications/count-by-type');
      const result = extractData<Record<string, number>>(response);
      return result || {};
    } catch (error) {
      console.error('Failed to get count by type:', error);
      return {};
    }
  },

  /**
   * Get count grouped by priority — GET /notifications/count-by-priority
   */
  async getCountByPriority(): Promise<Record<string, number>> {
    try {
      const response = await api.get(
        '/notifications/count-by-priority',
      );
      const result = extractData<Record<string, number>>(response);
      return result || {};
    } catch (error) {
      console.error('Failed to get count by priority:', error);
      return {};
    }
  },

  /**
   * Mark notification as read — PUT /notifications/:id/read
   */
  async markAsRead(id: string): Promise<Notification> {
    if (!id) {
      throw new Error('Notification ID is required');
    }

    const response = await api.put(`/notifications/${id}/read`);
    const result = extractData<Notification>(response);

    if (!result || !hasIdProperty(result)) {
      throw new Error('Failed to mark notification as read');
    }

    return result;
  },

  /**
   * Mark notification as unread — PUT /notifications/:id/unread
   */
  async markAsUnread(id: string): Promise<Notification> {
    if (!id) {
      throw new Error('Notification ID is required');
    }

    const response = await api.put(`/notifications/${id}/unread`);
    const result = extractData<Notification>(response);

    if (!result || !hasIdProperty(result)) {
      throw new Error('Failed to mark notification as unread');
    }

    return result;
  },

  /**
   * Mark multiple notifications as read — PUT /notifications/mark-read
   */
  async markMultipleAsRead(
    ids: string[],
  ): Promise<{ message: string; count?: number }> {
    if (!ids || ids.length === 0) {
      throw new Error('At least one notification ID is required');
    }

    const response = await api.put('/notifications/mark-read', { ids });
    const result = extractData<{
      message: string;
      count?: number;
    }>(response);

    return {
      message:
        result?.message || `${ids.length} notifications marked as read`,
      count: result?.count || ids.length,
    };
  },

  /**
   * Mark all notifications as read — PUT /notifications/read-all
   */
  async markAllAsRead(): Promise<{ message: string; count?: number }> {
    const response = await api.put('/notifications/read-all');
    const result = extractData<{
      message: string;
      count?: number;
    }>(response);

    return {
      message: result?.message || 'All notifications marked as read',
      count: result?.count || 0,
    };
  },

  /**
   * Delete notification — DELETE /notifications/:id
   */
  async deleteNotification(id: string): Promise<{ message: string }> {
    if (!id) {
      throw new Error('Notification ID is required');
    }

    const response = await api.delete(`/notifications/${id}`);
    const result = extractData<{ message: string }>(response);

    return {
      message: result?.message || 'Notification deleted successfully',
    };
  },

  /**
   * Delete all notifications — DELETE /notifications
   */
  async deleteAllNotifications(): Promise<{
    message: string;
    count?: number;
  }> {
    const response = await api.delete('/notifications');
    const result = extractData<{
      message: string;
      count?: number;
    }>(response);

    return {
      message: result?.message || 'All notifications deleted',
      count: result?.count || 0,
    };
  },

  /**
   * Delete all read notifications — DELETE /notifications/read
   */
  async deleteReadNotifications(): Promise<{
    message: string;
    count?: number;
  }> {
    const response = await api.delete('/notifications/read');
    const result = extractData<{
      message: string;
      count?: number;
    }>(response);

    return {
      message: result?.message || 'Read notifications deleted',
      count: result?.count || 0,
    };
  },

  /**
   * Create a new notification — POST /notifications
   */
  async createNotification(
    data: CreateNotificationInput,
  ): Promise<Notification> {
    if (!data.title || !data.message) {
      throw new Error('Title and message are required');
    }

    if (!data.type) {
      throw new Error('Notification type is required');
    }

    const response = await api.post('/notifications', data);
    const result = extractData<Notification>(response);

    if (!result || !hasIdProperty(result)) {
      throw new Error('Failed to create notification');
    }

    return result;
  },

  /**
   * Bulk create notifications — POST /notifications/bulk
   */
  async bulkCreateNotifications(
    notifications: CreateNotificationInput[],
  ): Promise<{
    results: Notification[];
    errors: Array<{ index: number; message: string }>;
  }> {
    if (!notifications || notifications.length === 0) {
      throw new Error('At least one notification is required');
    }

    const response = await api.post('/notifications/bulk', {
      notifications,
    });
    const result = extractData<{
      results: Notification[];
      errors: Array<{ index: number; message: string }>;
    }>(response);

    return result || { results: [], errors: [] };
  },

  /**
   * Send a notification (legacy alias for createNotification)
   * POST /notifications/send
   */
  async sendNotification(
    data: CreateNotificationInput,
  ): Promise<Notification> {
    if (!data.title || !data.message || !data.type) {
      throw new Error('Title, message, and type are required');
    }

    const response = await api.post('/notifications/send', data);
    const result = extractData<Notification>(response);

    if (!result || !hasIdProperty(result)) {
      throw new Error('Failed to send notification');
    }

    return result;
  },

  /**
   * Send a low stock alert — POST /notifications/low-stock
   */
  async sendLowStockAlert(payload: {
    businessUnitId: string;
    productName: string;
    currentStock: number;
    reorderPoint: number;
    productId?: string;
    inventoryId?: string;
  }): Promise<Notification[]> {
    const response = await api.post('/notifications/low-stock', payload);
    return extractArray<Notification>(response);
  },

  /**
   * Send a sale notification — POST /notifications/sale
   */
  async sendSaleNotification(payload: {
    businessUnitId: string;
    saleId: string;
  }): Promise<Notification[]> {
    const response = await api.post('/notifications/sale', payload);
    return extractArray<Notification>(response);
  },

  /**
   * Get notification preferences — GET /notifications/preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await api.get('/notifications/preferences');
      const result = extractData<NotificationPreferences>(response);

      return result || {};
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
      return {};
    }
  },

  /**
   * Update notification preferences — PUT /notifications/preferences
   */
  async updatePreferences(
    data: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    if (!data || Object.keys(data).length === 0) {
      throw new Error('At least one preference field is required');
    }

    const response = await api.put('/notifications/preferences', data);
    const result = extractData<NotificationPreferences>(response);

    return result || {};
  },

  /**
   * Reset notification preferences — POST /notifications/preferences/reset
   */
  async resetPreferences(): Promise<NotificationPreferences> {
    const response = await api.post('/notifications/preferences/reset');
    const result = extractData<NotificationPreferences>(response);

    return result || {};
  },

  /**
   * Get real-time notification stream — GET /notifications/stream
   * Returns an EventSource for Server-Sent Events (SSE).
   */
  getNotificationStream(): EventSource | null {
    if (typeof window === 'undefined') return null;

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const eventSource = new EventSource(
        `${baseUrl}/notifications/stream`,
        {
          withCredentials: true,
        },
      );

      // Handle connection errors
      eventSource.onerror = (error) => {
        console.error('Notification stream error:', error);
        eventSource.close();
      };

      return eventSource;
    } catch (error) {
      console.error('Failed to create notification stream:', error);
      return null;
    }
  },

  /**
   * Close notification stream
   */
  closeNotificationStream(eventSource: EventSource | null): void {
    if (eventSource) {
      eventSource.close();
    }
  },

  // ============================================
  // ALIAS METHODS (Backward Compatibility)
  // ============================================

  /**
   * Alias for getNotifications
   */
  async getAll(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
    priority?: string;
  }): Promise<PaginatedResponse<Notification>> {
    return this.getNotifications(params);
  },

  /**
   * Alias for getUnreadCount returning just the number
   */
  async getUnread(): Promise<number> {
    const result = await this.getUnreadCount();
    return result.count;
  },

  /**
   * Alias for markMultipleAsRead
   */
  async markRead(
    ids: string[],
  ): Promise<{ message: string; count?: number }> {
    return this.markMultipleAsRead(ids);
  },
};

export default notificationService;
