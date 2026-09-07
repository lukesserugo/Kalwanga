// D:\Projects\Kalwanga\packages\web\services\auditService.ts

import { api } from './api';

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  changes: Record<string, { old: any; new: any }>;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  } | null;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  severity?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  barcode?: string;
  metadata?: Record<string, any>;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
  company?: {
    id: string;
    name: string;
  };
}

export interface AuditFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  businessUnitId?: string;
  companyId?: string;
  startDate?: string;
  endDate?: string;
  severity?: string;
  search?: string;
  hasBarcode?: string | boolean; // Allow both string and boolean
}

export interface AuditPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface AuditStats {
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByUser: Array<{ userId: string; count: number }>;
  actionsByEntity: Array<{ entityType: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
}

export const auditService = {
  /**
   * Get audit logs with pagination and filters
   */
  async getAuditLogs(params?: AuditFilters & { page?: number; limit?: number }): Promise<AuditResponse> {
    try {
      // Convert hasBarcode to string if it's a boolean
      const processedParams = { ...params };
      if (processedParams.hasBarcode !== undefined && processedParams.hasBarcode !== null) {
        processedParams.hasBarcode = String(processedParams.hasBarcode);
      }
      const response = await api.get<AuditResponse>('/audit', { params: processedParams });
      return response;
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
      throw error;
    }
  },

  /**
   * Get a single audit log entry
   */
  async getAuditLogById(id: string): Promise<AuditEntry> {
    try {
      const response = await api.get<{ data: AuditEntry }>(`/audit/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch audit log ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get audit statistics
   */
  async getAuditStats(params?: { companyId?: string; startDate?: string; endDate?: string }): Promise<AuditStats> {
    try {
      const response = await api.get<{ data: AuditStats }>('/audit/stats', { params });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch audit stats:', error);
      throw error;
    }
  },

  /**
   * Get recent audit logs for dashboard
   */
  async getRecentAuditLogs(limit: number = 20): Promise<AuditEntry[]> {
    try {
      const response = await api.get<{ data: AuditEntry[] }>('/audit/recent', { params: { limit } });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch recent audit logs:', error);
      return [];
    }
  },

  /**
   * Get audit logs for a specific entity
   */
  async getAuditLogsByEntity(entityType: string, entityId: string, limit: number = 50): Promise<AuditEntry[]> {
    try {
      const response = await api.get<{ data: AuditEntry[] }>(`/audit/entity/${entityType}/${entityId}`, { params: { limit } });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch audit logs for entity ${entityType}/${entityId}:`, error);
      return [];
    }
  },

  /**
   * Export audit logs
   */
  async exportAuditLogs(params?: AuditFilters & { format?: 'csv' | 'json' }): Promise<Blob> {
    try {
      // Convert hasBarcode to string if it's a boolean
      const processedParams = { ...params };
      if (processedParams.hasBarcode !== undefined && processedParams.hasBarcode !== null) {
        processedParams.hasBarcode = String(processedParams.hasBarcode);
      }
      const response = await api.download('/audit/export', { params: processedParams });
      return response;
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  },

  /**
   * Create an audit log entry (for internal use)
   */
  async createAuditLog(data: {
    action: string;
    entityType: string;
    entityId: string;
    entityName?: string;
    changes?: Record<string, { old: any; new: any }>;
    severity?: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await api.post('/audit', data);
    } catch (error) {
      console.error('Failed to create audit log:', error);
      throw error;
    }
  },
};

export default auditService;
