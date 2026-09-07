// D:\Projects\Kalwanga\packages\web\services\userActivityService.ts

import { api } from './api';
import { UserActivity, ActivityFilter, ActivityStats } from '../types/user';

export interface ActivityExportOptions {
  format?: 'csv' | 'json' | 'excel';
  dateFrom?: string;
  dateTo?: string;
  action?: string;
  status?: string;
  severity?: string;
  includeMetadata?: boolean;
  includeUserInfo?: boolean;
  includeDeviceInfo?: boolean;
  includeLocationInfo?: boolean;
}

export interface AuditTrailEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  changes: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  status: 'success' | 'failed' | 'pending';
  severity: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

export interface AuditTrailResponse {
  data: AuditTrailEntry[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ActivitySummary {
  totalActivities: number;
  todayActivities: number;
  thisWeekActivities: number;
  thisMonthActivities: number;
  successRate: number;
  failureRate: number;
  averagePerDay: number;
  mostActiveDay: string;
  mostActiveTime: string;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  byDevice: Record<string, number>;
  byLocation: Record<string, number>;
  byHour: Record<number, number>;
  byDay: Record<string, number>;
  byMonth: Record<string, number>;
  recentActivities: UserActivity[];
  topActions: Array<{ action: string; count: number }>;
  topDevices: Array<{ device: string; count: number }>;
  topLocations: Array<{ location: string; count: number }>;
}

export interface CreateActivityData {
  userId: string;
  action: string;
  description: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  status?: 'success' | 'failed' | 'pending';
  severity?: 'info' | 'warning' | 'error' | 'critical';
  metadata?: Record<string, any>;
}

export const userActivityService = {
  // ============================================
  // CREATE ACTIVITY OPERATIONS
  // ============================================

  /**
   * ✅ Create a new activity
   * POST /activities
   */
  async createActivity(data: CreateActivityData): Promise<any> {
    try {
      const payload = {
        userId: data.userId,
        action: data.action,
        description: data.description,
        resource: data.resource || 'USER',
        resourceId: data.resourceId || data.userId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        device: data.device,
        location: data.location,
        status: data.status || 'success',
        severity: data.severity || 'info',
        metadata: data.metadata || {},
      };

      console.log('📤 Creating activity:', payload);
      const response = await api.post('/activities', payload);
      console.log('✅ Activity created:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create activity:', error);
      throw error;
    }
  },

  /**
   * ✅ Create multiple activities
   * POST /activities/batch
   */
  async createActivities(activities: CreateActivityData[]): Promise<any> {
    try {
      const payload = activities.map(activity => ({
        userId: activity.userId,
        action: activity.action,
        description: activity.description,
        resource: activity.resource || 'USER',
        resourceId: activity.resourceId || activity.userId,
        ipAddress: activity.ipAddress,
        userAgent: activity.userAgent,
        device: activity.device,
        location: activity.location,
        status: activity.status || 'success',
        severity: activity.severity || 'info',
        metadata: activity.metadata || {},
      }));

      console.log('📤 Creating batch activities:', payload.length);
      const response = await api.post('/activities/batch', { activities: payload });
      console.log('✅ Batch activities created:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create batch activities:', error);
      throw error;
    }
  },

  // ============================================
  // GET ACTIVITY OPERATIONS
  // ============================================

  /**
   * Get user activity with pagination and filters
   * GET /users/:userId/activity
   */
  async getUserActivity(
    userId: string,
    filters: ActivityFilter = {}
  ): Promise<any> {
    try {
      const params: Record<string, any> = {
        page: filters.page || 1,
        limit: filters.limit || 20,
      };

      if (filters.search) params.search = filters.search;
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.device) params.device = filters.device;
      if (filters.location) params.location = filters.location;
      if (filters.ipAddress) params.ipAddress = filters.ipAddress;
      if (filters.resource) params.resource = filters.resource;
      if (filters.resourceId) params.resourceId = filters.resourceId;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;

      const response = await api.get(`/users/${userId}/activity`, { params });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get user activity for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get all activities (admin)
   * GET /activities
   */
  async getAllActivities(filters: ActivityFilter = {}): Promise<any> {
    try {
      const params: Record<string, any> = {
        page: filters.page || 1,
        limit: filters.limit || 20,
      };

      if (filters.search) params.search = filters.search;
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.device) params.device = filters.device;
      if (filters.location) params.location = filters.location;
      if (filters.ipAddress) params.ipAddress = filters.ipAddress;
      if (filters.resource) params.resource = filters.resource;
      if (filters.resourceId) params.resourceId = filters.resourceId;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;

      const response = await api.get('/activities', { params });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get all activities:', error);
      throw error;
    }
  },

  /**
   * Get activity by ID
   * GET /activities/:id
   */
  async getActivityById(activityId: string): Promise<UserActivity> {
    try {
      const response = await api.get<UserActivity>(`/activities/${activityId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity ${activityId}:`, error);
      throw error;
    }
  },

  /**
   * Get activity by ID for a specific user
   * GET /users/:userId/activity/:activityId
   */
  async getUserActivityById(
    userId: string,
    activityId: string
  ): Promise<UserActivity> {
    try {
      const response = await api.get<UserActivity>(
        `/users/${userId}/activity/${activityId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity ${activityId}:`, error);
      throw error;
    }
  },

  /**
   * Get recent activity
   * GET /users/:userId/activity/recent
   */
  async getRecentActivity(
    userId: string,
    limit: number = 10
  ): Promise<UserActivity[]> {
    try {
      const response = await api.get<UserActivity[]>(
        `/users/${userId}/activity/recent`,
        { params: { limit } }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get recent activity for ${userId}:`, error);
      throw error;
    }
  },

  // ============================================
  // ACTIVITY SUMMARY & STATS OPERATIONS
  // ============================================

  /**
   * Get activity summary
   * GET /users/:userId/activity/summary
   */
  async getActivitySummary(
    userId: string,
    dateRange: 'today' | 'week' | 'month' | 'year' | 'all' = 'month'
  ): Promise<ActivitySummary> {
    try {
      const response = await api.get<ActivitySummary>(
        `/users/${userId}/activity/summary`,
        { params: { dateRange } }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity summary for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get activity stats
   * GET /users/:userId/activity/stats
   */
  async getActivityStats(userId: string): Promise<ActivityStats> {
    try {
      const response = await api.get<ActivityStats>(
        `/users/${userId}/activity/stats`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity stats for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get global activity stats (admin)
   * GET /activities/stats
   */
  async getGlobalActivityStats(dateRange?: 'today' | 'week' | 'month' | 'year' | 'all'): Promise<any> {
    try {
      const params = dateRange ? { dateRange } : undefined;
      const response = await api.get('/activities/stats', { params });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get global activity stats:', error);
      throw error;
    }
  },

  // ============================================
  // ACTIVITY ANALYSIS OPERATIONS
  // ============================================

  /**
   * Get activity trends
   * GET /users/:userId/activity/trends
   */
  async getActivityTrends(
    userId: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    labels: string[];
    values: number[];
    total: number;
    average: number;
  }> {
    try {
      const response = await api.get<{
        labels: string[];
        values: number[];
        total: number;
        average: number;
      }>(
        `/users/${userId}/activity/trends`,
        { params: { period } }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity trends for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get activity by device
   * GET /users/:userId/activity/by-device
   */
  async getActivityByDevice(userId: string): Promise<{
    devices: Array<{ device: string; count: number; percentage: number }>;
    total: number;
  }> {
    try {
      const response = await api.get<{
        devices: Array<{ device: string; count: number; percentage: number }>;
        total: number;
      }>(
        `/users/${userId}/activity/by-device`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity by device for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get activity by location
   * GET /users/:userId/activity/by-location
   */
  async getActivityByLocation(userId: string): Promise<{
    locations: Array<{ location: string; count: number; percentage: number }>;
    total: number;
  }> {
    try {
      const response = await api.get<{
        locations: Array<{ location: string; count: number; percentage: number }>;
        total: number;
      }>(
        `/users/${userId}/activity/by-location`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity by location for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get activity by hour
   * GET /users/:userId/activity/by-hour
   */
  async getActivityByHour(userId: string): Promise<{
    hours: Array<{ hour: number; count: number }>;
    peakHour: number;
    total: number;
  }> {
    try {
      const response = await api.get<{
        hours: Array<{ hour: number; count: number }>;
        peakHour: number;
        total: number;
      }>(
        `/users/${userId}/activity/by-hour`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity by hour for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get activity by day of week
   * GET /users/:userId/activity/by-day
   */
  async getActivityByDayOfWeek(userId: string): Promise<{
    days: Array<{ day: string; count: number }>;
    mostActiveDay: string;
    total: number;
  }> {
    try {
      const response = await api.get<{
        days: Array<{ day: string; count: number }>;
        mostActiveDay: string;
        total: number;
      }>(
        `/users/${userId}/activity/by-day`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity by day for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Compare activity periods
   * GET /users/:userId/activity/compare
   */
  async compareActivityPeriods(
    userId: string
  ): Promise<{
    currentPeriod: {
      label: string;
      total: number;
      byAction: Record<string, number>;
    };
    previousPeriod: {
      label: string;
      total: number;
      byAction: Record<string, number>;
    };
    change: {
      total: number;
      percentage: number;
      byAction: Record<string, number>;
    };
  }> {
    try {
      const response = await api.get<{
        currentPeriod: {
          label: string;
          total: number;
          byAction: Record<string, number>;
        };
        previousPeriod: {
          label: string;
          total: number;
          byAction: Record<string, number>;
        };
        change: {
          total: number;
          percentage: number;
          byAction: Record<string, number>;
        };
      }>(
        `/users/${userId}/activity/compare`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to compare activity periods for ${userId}:`, error);
      throw error;
    }
  },

  // ============================================
  // FILTERED ACTIVITY OPERATIONS
  // ============================================

  /**
   * Get activity by action
   * GET /users/:userId/activity?action=:action
   */
  async getActivityByAction(
    userId: string,
    action: string,
    filters: ActivityFilter = {}
  ): Promise<any> {
    try {
      return await this.getUserActivity(userId, {
        ...filters,
        action,
      });
    } catch (error: any) {
      console.error(`❌ Failed to get activity by action for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get login history
   * GET /users/:userId/activity/login-history
   */
  async getLoginHistory(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      status?: 'success' | 'failed';
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<any> {
    try {
      const params: Record<string, any> = {
        page: filters.page || 1,
        limit: filters.limit || 20,
        action: 'LOGIN',
      };

      if (filters.status) params.status = filters.status;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const response = await api.get(
        `/users/${userId}/activity/login-history`,
        { params }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get login history for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get activity by date range
   * GET /users/:userId/activity?dateFrom=:dateFrom&dateTo=:dateTo
   */
  async getActivityByDateRange(
    userId: string,
    dateFrom: string,
    dateTo: string,
    filters: ActivityFilter = {}
  ): Promise<any> {
    try {
      return await this.getUserActivity(userId, {
        ...filters,
        dateFrom,
        dateTo,
      });
    } catch (error: any) {
      console.error(`❌ Failed to get activity by date range for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Search activity
   * GET /users/:userId/activity?search=:query
   */
  async searchActivity(
    userId: string,
    query: string,
    filters: ActivityFilter = {}
  ): Promise<any> {
    try {
      return await this.getUserActivity(userId, {
        ...filters,
        search: query,
      });
    } catch (error: any) {
      console.error(`❌ Failed to search activity for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get activity count
   * GET /users/:userId/activity/count
   */
  async getActivityCount(
    userId: string,
    filters: {
      action?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<{ count: number }> {
    try {
      const params: Record<string, any> = {};
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const response = await api.get<{ count: number }>(
        `/users/${userId}/activity/count`,
        { params }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity count for ${userId}:`, error);
      throw error;
    }
  },

  // ============================================
  // EXPORT OPERATIONS
  // ============================================

  /**
   * Export user activity
   * GET /users/:userId/activity/export
   */
  async exportUserActivity(
    userId: string,
    format: 'csv' | 'json' | 'excel' = 'csv',
    options: ActivityExportOptions = {}
  ): Promise<any> {
    try {
      const params: Record<string, any> = { format };

      if (options.dateFrom) params.dateFrom = options.dateFrom;
      if (options.dateTo) params.dateTo = options.dateTo;
      if (options.action) params.action = options.action;
      if (options.status) params.status = options.status;
      if (options.severity) params.severity = options.severity;
      if (options.includeMetadata !== undefined) params.includeMetadata = options.includeMetadata;
      if (options.includeUserInfo !== undefined) params.includeUserInfo = options.includeUserInfo;
      if (options.includeDeviceInfo !== undefined) params.includeDeviceInfo = options.includeDeviceInfo;
      if (options.includeLocationInfo !== undefined) params.includeLocationInfo = options.includeLocationInfo;

      if (format === 'json') {
        const response = await api.get(`/users/${userId}/activity/export`, { params });
        return response;
      } else {
        const response = await api.download(`/users/${userId}/activity/export`, { params });
        return response;
      }
    } catch (error: any) {
      console.error(`❌ Failed to export user activity for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Export audit trail
   * GET /users/:userId/audit-trail/export
   */
  async exportAuditTrail(
    userId: string,
    format: 'csv' | 'json' = 'json'
  ): Promise<any> {
    try {
      if (format === 'json') {
        return await api.get(`/users/${userId}/audit-trail/export?format=json`);
      } else {
        return await api.download(`/users/${userId}/audit-trail/export?format=csv`);
      }
    } catch (error: any) {
      console.error(`❌ Failed to export audit trail for ${userId}:`, error);
      throw error;
    }
  },

  // ============================================
  // AUDIT TRAIL OPERATIONS
  // ============================================

  /**
   * Get user audit trail
   * GET /users/:userId/audit-trail
   */
  async getUserAuditTrail(
    userId: string,
    filters: {
      page?: number;
      limit?: number;
      entityType?: string;
      action?: string;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<AuditTrailResponse> {
    try {
      const params: Record<string, any> = {
        page: filters.page || 1,
        limit: filters.limit || 20,
      };

      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.action) params.action = filters.action;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      const response = await api.get<AuditTrailResponse>(
        `/users/${userId}/audit-trail`,
        { params }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get audit trail for ${userId}:`, error);
      throw error;
    }
  },

  // ============================================
  // UPDATE & DELETE OPERATIONS
  // ============================================

  /**
   * Update activity
   * PUT /activities/:id
   */
  async updateActivity(
    activityId: string,
    data: {
      description?: string;
      status?: 'success' | 'failed' | 'pending';
      severity?: 'info' | 'warning' | 'error' | 'critical';
      metadata?: Record<string, any>;
    }
  ): Promise<any> {
    try {
      const response = await api.put(`/activities/${activityId}`, data);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update activity ${activityId}:`, error);
      throw error;
    }
  },

  /**
   * Delete activity
   * DELETE /activities/:id
   */
  async deleteActivity(activityId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/activities/${activityId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete activity ${activityId}:`, error);
      throw error;
    }
  },

  /**
   * Clear activity history
   * DELETE /users/:userId/activity
   */
  async clearActivityHistory(
    userId: string,
    beforeDate?: string
  ): Promise<{ cleared: number; message: string }> {
    try {
      const response = await api.delete<{ cleared: number; message: string }>(
        `/users/${userId}/activity`,
        {
          params: beforeDate ? { beforeDate } : undefined,
        }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to clear activity history for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Clear all activities (admin)
   * DELETE /activities
   */
  async clearAllActivities(filters?: {
    beforeDate?: string;
    action?: string;
    entityType?: string;
  }): Promise<{ cleared: number; message: string }> {
    try {
      const params: Record<string, any> = {};
      if (filters?.beforeDate) params.beforeDate = filters.beforeDate;
      if (filters?.action) params.action = filters.action;
      if (filters?.entityType) params.entityType = filters.entityType;

      const response = await api.delete<{ cleared: number; message: string }>(
        '/activities',
        { params }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to clear all activities:', error);
      throw error;
    }
  },

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get activity action types
   */
  getActionTypes(): string[] {
    return [
      'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT',
      'LOGIN', 'LOGOUT', 'IMPORT', 'DOWNLOAD',
      'APPROVE', 'REJECT', 'INVITE', 'RESEND',
      'CANCEL', 'REVOKE', 'ACTIVATE', 'DEACTIVATE',
      'ASSIGN', 'REMOVE', 'MERGE', 'DUPLICATE',
      'ARCHIVE', 'MOVE', 'SET_LEAD', 'UPDATE_ROLE',
    ];
  },

  /**
   * Get severity levels
   */
  getSeverityLevels(): string[] {
    return ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  },

  /**
   * Get status types
   */
  getStatusTypes(): string[] {
    return ['success', 'failed', 'pending'];
  },

  /**
   * Get device types
   */
  getDeviceTypes(): string[] {
    return ['Desktop', 'Mobile', 'Tablet', 'Unknown'];
  },

  /**
   * Format activity for display
   */
  formatActivity(activity: UserActivity): string {
    return `${new Date(activity.timestamp).toLocaleString()} - ${activity.action}: ${activity.description}`;
  },

  /**
   * Get color for severity
   */
  getSeverityColor(severity: string): string {
    const colors: Record<string, string> = {
      info: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
      warning: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
      error: 'text-red-500 bg-red-50 dark:bg-red-900/20',
      critical: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
    };
    return colors[severity] || colors.info;
  },

  /**
   * Get icon for action
   */
  getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      CREATE: 'PlusCircle',
      UPDATE: 'Edit',
      DELETE: 'Trash',
      VIEW: 'Eye',
      EXPORT: 'Download',
      LOGIN: 'LogIn',
      LOGOUT: 'LogOut',
      IMPORT: 'Upload',
      APPROVE: 'Check',
      REJECT: 'X',
      INVITE: 'UserPlus',
      ACTIVATE: 'CheckCircle',
      DEACTIVATE: 'XCircle',
    };
    return icons[action] || 'Activity';
  },
};

export default userActivityService;
