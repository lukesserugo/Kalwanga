// D:\Projects\Kalwanga\packages\web\services\notificationService.ts

import { api } from './api';
import type { NotificationType } from '../types/enums';

// ============================================
// TYPES
// ============================================

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType | string;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
  readAt?: string | null;
  link?: string;
  data?: Record<string, any>;
  userId?: string;
  businessUnitId?: string;
  companyId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  types: {
    [key: string]: boolean;
  };
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: {
    [key: string]: number;
  };
}

// ============================================
// TYPE GUARDS & HELPERS
// ============================================

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function hasDataProperty(response: unknown): response is { data: unknown } {
  return isObject(response) && 'data' in response;
}

function hasPaginationProperty(response: unknown): response is { pagination: unknown } {
  return isObject(response) && 'pagination' in response;
}

function hasSuccessProperty(response: unknown): response is { success: unknown } {
  return isObject(response) && 'success' in response;
}

function hasMessageProperty(response: unknown): response is { message: unknown } {
  return isObject(response) && 'message' in response;
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
    if (isObject(data) && hasDataProperty(data) && Array.isArray(data.data)) {
      return data.data as T[];
    }
    return [];
  }
  
  if (hasDataProperty(response)) {
    const data = response.data;
    if (Array.isArray(data)) {
      return data as T[];
    }
    if (isObject(data) && hasDataProperty(data) && Array.isArray(data.data)) {
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

function extractPagination(response: unknown): { total: number; page: number; totalPages: number; limit: number } {
  if (!isObject(response)) {
    return { total: 0, page: 1, totalPages: 0, limit: 10 };
  }
  
  if (hasPaginationProperty(response) && isObject(response.pagination)) {
    const pagination = response.pagination;
    return {
      total: ('total' in pagination ? Number(pagination.total) : 0) || 0,
      page: ('page' in pagination ? Number(pagination.page) : 1) || 1,
      totalPages: ('totalPages' in pagination ? Number(pagination.totalPages) : 0) || 0,
      limit: ('limit' in pagination ? Number(pagination.limit) : 10) || 10,
    };
  }
  
  if ('total' in response) {
    const total = Number(response.total) || 0;
    const limit = ('limit' in response ? Number(response.limit) : 10) || 10;
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
   * Get notifications - GET /notifications
   * Returns paginated response with notification data
   */
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
    type?: string;
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
   * Get notification by ID - GET /notifications/:id
   */
  async getNotificationById(id: string): Promise<Notification> {
    try {
      if (!id) {
        throw new Error('Notification ID is required');
      }
      
      const response = await api.get(`/notifications/${id}`);
      const result = extractData<Notification>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Notification not found');
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to fetch notification ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get notification statistics - GET /notifications/stats
   */
  async getStats(): Promise<NotificationStats> {
    try {
      const response = await api.get('/notifications/stats');
      const result = extractData<NotificationStats>(response);
      
      return result || {
        total: 0,
        unread: 0,
        read: 0,
        byType: {},
      };
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
   * Get unread count - GET /notifications/unread-count
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
   * Mark notification as read - PUT /notifications/:id/read
   */
  async markAsRead(id: string): Promise<Notification> {
    try {
      if (!id) {
        throw new Error('Notification ID is required');
      }
      
      const response = await api.put(`/notifications/${id}/read`);
      const result = extractData<Notification>(response);
      
      if (!result || !hasIdProperty(result)) {
        throw new Error('Failed to mark notification as read');
      }
      
      return result;
    } catch (error) {
      console.error(`Failed to mark notification ${id} as read:`, error);
      throw error;
    }
  },

  /**
   * Mark multiple notifications as read - PUT /notifications/mark-read
   */
  async markMultipleAsRead(ids: string[]): Promise<{ message: string; count?: number }> {
    try {
      if (!ids || ids.length === 0) {
        throw new Error('At least one notification ID is required');
      }
      
      const response = await api.put('/notifications/mark-read', { ids });
      const result = extractData<{ message: string; count?: number }>(response);
      
      return {
        message: result?.message || `${ids.length} notifications marked as read`,
        count: result?.count || ids.length,
      };
    } catch (error) {
      console.error('Failed to mark multiple as read:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read - PUT /notifications/read-all
   */
  async markAllAsRead(): Promise<{ message: string; count?: number }> {
    try {
      const response = await api.put('/notifications/read-all');
      const result = extractData<{ message: string; count?: number }>(response);
      
      return {
        message: result?.message || 'All notifications marked as read',
        count: result?.count || 0,
      };
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      throw error;
    }
  },

  /**
   * Delete notification - DELETE /notifications/:id
   */
  async deleteNotification(id: string): Promise<{ message: string }> {
    try {
      if (!id) {
        throw new Error('Notification ID is required');
      }
      
      const response = await api.delete(`/notifications/${id}`);
      const result = extractData<{ message: string }>(response);
      
      return {
        message: result?.message || 'Notification deleted successfully',
      };
    } catch (error) {
      console.error(`Failed to delete notification ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete all notifications - DELETE /notifications
   */
  async deleteAllNotifications(): Promise<{ message: string; count?: number }> {
    try {
      const response = await api.delete('/notifications');
      const result = extractData<{ message: string; count?: number }>(response);
      
      return {
        message: result?.message || 'All notifications deleted',
        count: result?.count || 0,
      };
    } catch (error) {
      console.error('Failed to delete all notifications:', error);
      throw error;
    }
  },

  /**
   * Create a new notification - POST /notifications
   */
  async createNotification(data: Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'updatedAt'>): Promise<Notification> {
    try {
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
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  },

  /**
   * Bulk create notifications - POST /notifications/bulk
   */
  async bulkCreateNotifications(
    notifications: Array<Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'updatedAt'>>
  ): Promise<{ results: Notification[]; errors: Array<{ index: number; message: string }> }> {
    try {
      if (!notifications || notifications.length === 0) {
        throw new Error('At least one notification is required');
      }
      
      const response = await api.post('/notifications/bulk', { notifications });
      const result = extractData<{ results: Notification[]; errors: Array<{ index: number; message: string }> }>(response);
      
      return result || { results: [], errors: [] };
    } catch (error) {
      console.error('Failed to bulk create notifications:', error);
      throw error;
    }
  },

  /**
   * Get notification preferences - GET /notifications/preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await api.get('/notifications/preferences');
      const result = extractData<NotificationPreferences>(response);
      
      return result || {
        email: true,
        push: true,
        inApp: true,
        types: {},
      };
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
      return {
        email: true,
        push: true,
        inApp: true,
        types: {},
      };
    }
  },

  /**
   * Update notification preferences - PUT /notifications/preferences
   */
  async updatePreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      if (!data || Object.keys(data).length === 0) {
        throw new Error('At least one preference field is required');
      }
      
      const response = await api.put('/notifications/preferences', data);
      const result = extractData<NotificationPreferences>(response);
      
      return result || {
        email: true,
        push: true,
        inApp: true,
        types: {},
      };
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      throw error;
    }
  },

  /**
   * Get real-time notification stream - GET /notifications/stream
   * Returns an EventSource for Server-Sent Events (SSE)
   */
  getNotificationStream(): EventSource | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const eventSource = new EventSource(`${baseUrl}/notifications/stream`, {
        withCredentials: true,
      });
      
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
  }): Promise<PaginatedResponse<Notification>> {
    return this.getNotifications(params);
  },

  /**
   * Alias for getUnreadCount
   */
  async getUnread(): Promise<number> {
    const result = await this.getUnreadCount();
    return result.count;
  },

  /**
   * Alias for markMultipleAsRead
   */
  async markRead(ids: string[]): Promise<{ message: string; count?: number }> {
    return this.markMultipleAsRead(ids);
  },
};

export default notificationService;
