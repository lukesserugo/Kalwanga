// D:\Projects\Kalwanga\packages\web\services\userService.ts

import { api } from './api';
import { User, BusinessUnitUser, UserSearchParams } from '../types';
import { UserRole, UserStatus } from '../types/enums';

// Define PaginatedResponse locally since it's not exported from types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// Activity types
export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  status: 'success' | 'failed' | 'pending';
  severity: 'info' | 'warning' | 'error' | 'critical';
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export interface ActivityFilter {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  status?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  device?: string;
  location?: string;
  ipAddress?: string;
  resource?: string;
  resourceId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuditTrailEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  changes: Record<string, any>;
  timestamp: string;
  severity: string;
}

// Import types
export interface ImportResult {
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  errors: Array<{ rowNumber: number; email: string; error: string }>;
  warnings: Array<{ rowNumber: number; email: string; warning: string }>;
  importedUsers: string[];
  failedUsers: string[];
  importDuration?: number;
}

export interface ImportHistory {
  id: string;
  fileName: string;
  fileSize: number;
  totalRows: number;
  successCount: number;
  failedCount: number;
  warningCount: number;
  skippedCount: number;
  status: 'completed' | 'partial' | 'failed' | 'pending';
  importedBy: string;
  importDuration: number;
  errorSummary?: string;
  importedAt: string;
}

export interface ImportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'excel';
  headers: string[];
  requiredHeaders: string[];
  optionalHeaders: string[];
  exampleData: Record<string, any>[];
}

export interface ImportOptions {
  skipDuplicates?: boolean;
  skipInvalid?: boolean;
  sendWelcomeEmail?: boolean;
  defaultPassword?: string;
  autoActivate?: boolean;
  batchSize?: number;
}

// Invitation types
export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  businessUnitId?: string;
  message?: string;
  expiresIn: number;
  status: 'pending' | 'sent' | 'accepted' | 'expired' | 'cancelled' | 'revoked';
  sentAt?: string;
  expiresAt?: string;
  acceptedAt?: string;
  cancelledAt?: string;
  invitationToken: string;
  invitedBy: string;
  reminderSent?: boolean;
  reminderSentAt?: string;
  reminderCount?: number;
}

export interface InvitationResult {
  id: string;
  email: string;
  status: 'sent' | 'failed' | 'duplicate' | 'invalid';
  message?: string;
  error?: string;
  invitation?: UserInvitation;
}

export interface BatchInvitationResult {
  total: number;
  successCount: number;
  failedCount: number;
  duplicateCount: number;
  invalidCount: number;
  results: InvitationResult[];
  duration: number;
}

export interface InvitationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  role?: UserRole;
  variables: string[];
  isDefault: boolean;
}

export interface InvitationStats {
  total: number;
  pending: number;
  sent: number;
  accepted: number;
  expired: number;
  cancelled: number;
  acceptanceRate: number;
  byRole: Record<string, number>;
}

// Group types
export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  permissions: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  members?: GroupMember[];
  memberCount?: number;
}

export interface GroupMember {
  userId: string;
  role: UserRole;
  joinedAt: string;
  isLead: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateGroupData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentGroupId?: string;
  permissions?: string[];
  members?: Array<{
    userId: string;
    role?: UserRole;
    isLead?: boolean;
  }>;
}

export interface UpdateGroupData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentGroupId?: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface GroupFilter {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  parentGroupId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Import stats response type
export interface ImportStats {
  totalImports: number;
  totalUsersImported: number;
  successRate: number;
  byStatus: Record<string, number>;
  lastImport?: ImportHistory;
}

// Group stats response type
export interface GroupStats {
  totalGroups: number;
  totalMembers: number;
  activeGroups: number;
  inactiveGroups: number;
  averageMembersPerGroup: number;
  byRole: Record<string, number>;
}

// Assign/Remove users response type
export interface AssignUsersResponse {
  groupId: string;
  assignedCount: number;
  skippedCount: number;
  assignedUsers: string[];
  skippedUsers: string[];
}

export interface RemoveUsersResponse {
  groupId: string;
  removedCount: number;
  skippedCount: number;
  removedUsers: string[];
  skippedUsers: string[];
}

export const userService = {
  // ============================================
  // CORE USER OPERATIONS
  // ============================================

  /**
   * Get all users - calls GET /users
   */
  async getAllUsers(params?: UserSearchParams): Promise<PaginatedResponse<User>> {
    try {
      const response = await api.get<PaginatedResponse<User>>('/users', { params });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get users:', error);
      throw error;
    }
  },

  /**
   * Get user by ID - calls GET /users/:id (database ID)
   */
  async getUserById(id: string): Promise<User> {
    try {
      const response = await api.get<User>(`/users/${id}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get user by ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get user by Clerk ID - calls GET /users/by-clerk/:clerkId
   */
  async getUserByClerkId(clerkId: string): Promise<User> {
    try {
      const response = await api.get<User>(`/users/by-clerk/${clerkId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get user by Clerk ID ${clerkId}:`, error);
      throw error;
    }
  },

  /**
   * Get user by identifier (Clerk ID or database ID) - calls GET /users/identifier/:identifier
   */
  async getUserByIdentifier(identifier: string): Promise<User> {
    try {
      const response = await api.get<User>(`/users/identifier/${identifier}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get user by identifier ${identifier}:`, error);
      throw error;
    }
  },

  /**
   * Get current user - calls GET /users/me
   */
  async getCurrentUser(): Promise<User> {
    try {
      const response = await api.get<User>('/users/me');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get current user:', error);
      throw error;
    }
  },

  /**
   * ✅ FIXED: Create user - calls POST /users
   * 
   * CRITICAL: This method now properly handles the clerkId generation
   * and ensures all required fields are sent to the backend
   */
  async createUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  password: string;
  isActive?: boolean;
  companyId?: string;
  businessUnitId?: string;
  clerkId?: string;
  permissions?: string[];
  }): Promise<User> {
    try {
      // Generate clerkId if not provided
      const generatedClerkId = data.clerkId || `admin_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Build payload with ALL required fields
      // CRITICAL: Ensure we're passing an object, not a string
      const payload = {
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        role: data.role,
        password: data.password,
        clerkId: generatedClerkId,
      };

      // Only include optional fields if they have values
      if (data.phoneNumber && data.phoneNumber.trim()) {
        (payload as any).phoneNumber = data.phoneNumber.trim();
      }
      if (data.isActive !== undefined) {
        (payload as any).isActive = data.isActive;
      }
      if (data.companyId) {
        (payload as any).companyId = data.companyId;
      }
      if (data.businessUnitId) {
        (payload as any).businessUnitId = data.businessUnitId;
      }
      if (data.permissions && data.permissions.length > 0) {
        (payload as any).permissions = data.permissions;
      }

      console.log('📤 Creating user with payload:', {
        ...payload,
        password: payload.password ? '***' : undefined,
      });
      console.log('📤 Payload type:', typeof payload);
      console.log('📤 Payload is object:', typeof payload === 'object');

      // Make the API call - pass the object directly
      const response = await api.post<User>('/users', payload);
      console.log('✅ User created successfully:', response);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create user:', error);
      
      // Enhanced error handling
      if (error?.response?.data?.errors) {
        const errorMessage = error.response.data.errors
          .map((err: any) => `${err.field || err.path || 'field'}: ${err.message}`)
          .join(', ');
        throw new Error(errorMessage);
      }
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      if (error?.message) {
        throw error;
      }
      throw new Error('Failed to create user');
    }
  },

  /**
   * ✅ FIXED: Update user - calls PUT /users/:id
   * ONLY sends fields that the backend updateUserSchema expects
   */
  async updateUser(id: string, data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    role?: UserRole;
    isActive?: boolean;
    password?: string;
    businessUnitId?: string | null;
    companyId?: string;
    permissions?: string[];
  }): Promise<User> {
    try {
      // ✅ ONLY send fields the backend expects
      const payload: any = {};

      if (data.email !== undefined) payload.email = data.email.trim().toLowerCase();
      if (data.firstName !== undefined) payload.firstName = data.firstName.trim();
      if (data.lastName !== undefined) payload.lastName = data.lastName.trim();
      if (data.phoneNumber !== undefined) payload.phoneNumber = data.phoneNumber.trim();
      if (data.role !== undefined) payload.role = data.role;
      if (data.isActive !== undefined) payload.isActive = data.isActive;
      if (data.password && data.password.trim()) payload.password = data.password;
      if (data.businessUnitId !== undefined) payload.businessUnitId = data.businessUnitId;
      if (data.companyId !== undefined) payload.companyId = data.companyId;
      if (data.permissions !== undefined) payload.permissions = data.permissions;

      console.log('📤 Updating user:', id, {
        ...payload,
        password: payload.password ? '***' : undefined,
      });
      
      const response = await api.put<User>(`/users/${id}`, payload);
      console.log('✅ User updated:', response);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update user ${id}:`, error);
      
      if (error?.response?.data?.errors) {
        const errorMessage = error.response.data.errors
          .map((err: any) => `${err.field || err.path || 'field'}: ${err.message}`)
          .join(', ');
        throw new Error(errorMessage);
      }
      if (error?.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw error;
    }
  },

  /**
   * Delete user - calls DELETE /users/:id
   */
  async deleteUser(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/users/${id}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Update user role - calls PATCH /users/:id/role
   */
  async updateUserRole(id: string, role: UserRole): Promise<User> {
    try {
      const response = await api.patch<User>(`/users/${id}/role`, { role });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update user role ${id}:`, error);
      throw error;
    }
  },

  /**
   * Update user permissions - calls PATCH /users/:id/permissions
   */
  async updateUserPermissions(id: string, permissions: string[]): Promise<User> {
    try {
      const response = await api.patch<User>(`/users/${id}/permissions`, { permissions });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update user permissions ${id}:`, error);
      throw error;
    }
  },

  /**
   * Activate user - calls POST /users/:id/activate
   */
  async activateUser(id: string): Promise<User> {
    try {
      const response = await api.post<User>(`/users/${id}/activate`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to activate user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Deactivate user - calls POST /users/:id/deactivate
   */
  async deactivateUser(id: string): Promise<User> {
    try {
      const response = await api.post<User>(`/users/${id}/deactivate`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to deactivate user ${id}:`, error);
      throw error;
    }
  },

  /**
   * Assign business unit - calls POST /users/:userId/business/:businessUnitId
   */
  async assignBusinessUnit(userId: string, businessUnitId: string, role: string): Promise<BusinessUnitUser> {
    try {
      const response = await api.post<BusinessUnitUser>(`/users/${userId}/business/${businessUnitId}`, { role });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to assign business unit to user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Remove business unit - calls DELETE /users/:userId/business/:businessUnitId
   */
  async removeBusinessUnit(userId: string, businessUnitId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/users/${userId}/business/${businessUnitId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to remove business unit from user ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get users by business unit - calls GET /users/business/:businessUnitId
   */
  async getUsersByBusinessUnit(businessUnitId: string): Promise<User[]> {
    try {
      const response = await api.get<User[]>(`/users/business/${businessUnitId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get users for business unit ${businessUnitId}:`, error);
      throw error;
    }
  },

  /**
   * Bulk activate users - calls POST /users/bulk/activate
   */
  async bulkActivateUsers(ids: string[]): Promise<{ message: string; count: number }> {
    try {
      const response = await api.post<{ message: string; count: number }>('/users/bulk/activate', { ids });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to bulk activate users:', error);
      throw error;
    }
  },

  /**
   * Bulk deactivate users - calls POST /users/bulk/deactivate
   */
  async bulkDeactivateUsers(ids: string[]): Promise<{ message: string; count: number }> {
    try {
      const response = await api.post<{ message: string; count: number }>('/users/bulk/deactivate', { ids });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to bulk deactivate users:', error);
      throw error;
    }
  },

  /**
   * Bulk delete users - calls POST /users/bulk/delete
   */
  async bulkDeleteUsers(ids: string[]): Promise<{ message: string; count: number }> {
    try {
      const response = await api.post<{ message: string; count: number }>('/users/bulk/delete', { ids });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to bulk delete users:', error);
      throw error;
    }
  },

  /**
   * Export users - calls GET /users/export
   */
  async exportUsers(format: 'csv' | 'excel' | 'json' = 'csv'): Promise<Blob | { data: User[]; total: number }> {
    try {
      if (format === 'json') {
        const response = await api.get<{ data: User[]; total: number }>('/users/export?format=json');
        return response;
      }
      const response = await api.download(`/users/export?format=${format}`);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to export users:', error);
      throw error;
    }
  },

  /**
   * Get user statistics - calls GET /users/stats
   */
  async getUserStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
    newThisMonth: number;
    growth: number;
  }> {
    try {
      const response = await api.get<{
        total: number;
        active: number;
        inactive: number;
        byRole: Record<string, number>;
        newThisMonth: number;
        growth: number;
      }>('/users/stats');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get user stats:', error);
      throw error;
    }
  },

  /**
   * Search users - calls GET /users/search
   */
  async searchUsers(query: string, params?: UserSearchParams): Promise<PaginatedResponse<User>> {
    try {
      const response = await api.get<PaginatedResponse<User>>('/users/search', { 
        params: { q: query, ...params } 
      });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to search users:', error);
      throw error;
    }
  },

  /**
   * Get users by role - calls GET /users/role/:role
   */
  async getUsersByRole(role: UserRole): Promise<User[]> {
    try {
      const response = await api.get<User[]>(`/users/role/${role}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get users by role ${role}:`, error);
      throw error;
    }
  },

  /**
   * Update user status - calls PATCH /users/:id/status
   */
  async updateUserStatus(id: string, status: UserStatus): Promise<User> {
    try {
      const response = await api.patch<User>(`/users/${id}/status`, { status });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update user status ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get user activity log - calls GET /users/:id/activity
   */
  async getUserActivity(id: string, params?: { page?: number; limit?: number }): Promise<{
    data: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const response = await api.get<{
        data: any[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/users/${id}/activity`, { params });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get user activity for ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get user permissions - calls GET /users/:id/permissions
   */
  async getUserPermissions(id: string): Promise<string[]> {
    try {
      const response = await api.get<string[]>(`/users/${id}/permissions`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get user permissions for ${id}:`, error);
      throw error;
    }
  },

  /**
   * Check if user has permission - calls GET /users/:id/permissions/:permission
   */
  async checkUserPermission(id: string, permission: string): Promise<{ hasPermission: boolean }> {
    try {
      const response = await api.get<{ hasPermission: boolean }>(`/users/${id}/permissions/${permission}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to check user permission for ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get user by Clerk ID - calls GET /users/by-clerk/:clerkId (alias for getUserByClerkId)
   */
  async getUserByClerkIdAlt(clerkId: string): Promise<User> {
    return this.getUserByClerkId(clerkId);
  },

  /**
   * Get user by identifier - calls GET /users/identifier/:identifier (alias)
   */
  async getUserByIdentifierAlt(identifier: string): Promise<User> {
    return this.getUserByIdentifier(identifier);
  },

  /**
   * Get user by email - calls GET /users/email/:email
   */
  async getUserByEmail(email: string): Promise<User> {
    try {
      const response = await api.get<User>(`/users/email/${encodeURIComponent(email)}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get user by email ${email}:`, error);
      throw error;
    }
  },

  /**
   * Get user with permissions - calls GET /users/:id/permissions
   */
  async getUserWithPermissions(id: string): Promise<{ user: User; permissions: string[] }> {
    try {
      const [user, permissions] = await Promise.all([
        this.getUserById(id),
        this.getUserPermissions(id),
      ]);
      return { user, permissions };
    } catch (error: any) {
      console.error(`❌ Failed to get user with permissions for ${id}:`, error);
      throw error;
    }
  },

  /**
   * Update user with permissions - calls PUT /users/:id with permissions
   */
  async updateUserWithPermissions(id: string, data: Partial<User> & { permissions?: string[] }): Promise<User> {
    return this.updateUser(id, data);
  },

  /**
   * Create user with permissions - calls POST /users with permissions
   */
  async createUserWithPermissions(data: Partial<User> & { password?: string; permissions?: string[] }): Promise<User> {
    return this.createUser(data as any);
  },

  /**
   * Get user activity with pagination - calls GET /users/:id/activity
   */
  async getUserActivityPaginated(id: string, page: number = 1, limit: number = 20): Promise<{
    data: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.getUserActivity(id, { page, limit });
  },

  /**
   * Get all users with permissions - calls GET /users with includePermissions
   */
  async getAllUsersWithPermissions(params?: UserSearchParams): Promise<{ data: User[]; total: number; page: number; totalPages: number; limit: number }> {
    try {
      const response = await api.get<PaginatedResponse<User>>('/users', { 
        params: { ...params, includePermissions: true } 
      });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get users with permissions:', error);
      throw error;
    }
  },

  /**
   * Get user by ID with full details including permissions - calls GET /users/:id
   */
  async getUserByIdFull(id: string): Promise<User> {
    return this.getUserById(id);
  },

  /**
   * Get current user with full details - calls GET /users/me
   */
  async getCurrentUserFull(): Promise<User> {
    return this.getCurrentUser();
  },

  // ============================================
  // USER ACTIVITY OPERATIONS
  // ============================================

  /**
   * Get user activity with comprehensive filtering - calls GET /users/:id/activity
   */
  async getUserActivityWithFilters(id: string, filters: ActivityFilter = {}): Promise<PaginatedResponse<UserActivity>> {
    try {
      const response = await api.get<PaginatedResponse<UserActivity>>(`/users/${id}/activity`, { params: filters });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get user activity with filters for ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get activity by ID - calls GET /users/:id/activity/:activityId
   */
  async getActivityById(userId: string, activityId: string): Promise<UserActivity> {
    try {
      const response = await api.get<UserActivity>(`/users/${userId}/activity/${activityId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get activity ${activityId}:`, error);
      throw error;
    }
  },

  /**
   * Get recent user activity - calls GET /users/:id/activity/recent
   */
  async getRecentUserActivity(userId: string, limit: number = 10): Promise<UserActivity[]> {
    try {
      const response = await api.get<UserActivity[]>(`/users/${userId}/activity/recent`, { params: { limit } });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get recent activity for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Get user audit trail - calls GET /users/:id/audit-trail
   */
  async getUserAuditTrail(userId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<AuditTrailEntry>> {
    try {
      const response = await api.get<PaginatedResponse<AuditTrailEntry>>(`/users/${userId}/audit-trail`, { params });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get audit trail for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Clear user activity - calls DELETE /users/:id/activity
   */
  async clearUserActivity(userId: string, beforeDate?: string): Promise<{ cleared: number; message: string }> {
    try {
      const response = await api.delete<{ cleared: number; message: string }>(`/users/${userId}/activity`, {
        params: beforeDate ? { beforeDate } : undefined,
      });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to clear activity for ${userId}:`, error);
      throw error;
    }
  },

  /**
   * Export user activity - calls GET /users/:id/activity/export
   */
  async exportUserActivity(userId: string, format: 'csv' | 'json' = 'json'): Promise<any> {
    try {
      if (format === 'json') {
        return await api.get(`/users/${userId}/activity/export?format=json`);
      }
      return await api.download(`/users/${userId}/activity/export?format=${format}`);
    } catch (error: any) {
      console.error(`❌ Failed to export activity for ${userId}:`, error);
      throw error;
    }
  },

  // ============================================
  // USER IMPORT OPERATIONS
  // ============================================

  /**
   * Import users from file - calls POST /users/import
   */
  async importUsers(file: File, options: ImportOptions = {}): Promise<ImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, String(value));
        }
      });

      const response = await api.post<ImportResult>('/users/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to import users:', error);
      throw error;
    }
  },

  /**
   * Import users from CSV content - calls POST /users/import/csv
   */
  async importUsersFromCSV(content: string, options: ImportOptions = {}): Promise<ImportResult> {
    try {
      const response = await api.post<ImportResult>('/users/import/csv', { content, ...options });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to import users from CSV:', error);
      throw error;
    }
  },

  /**
   * Import users from JSON - calls POST /users/import/json
   */
  async importUsersFromJSON(users: any[], options: ImportOptions = {}): Promise<ImportResult> {
    try {
      const response = await api.post<ImportResult>('/users/import/json', { users, ...options });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to import users from JSON:', error);
      throw error;
    }
  },

  /**
   * Validate import data - calls POST /users/import/validate
   */
  async validateImportData(data: File | string | any[]): Promise<any> {
    try {
      if (data instanceof File) {
        const formData = new FormData();
        formData.append('file', data);
        return await api.post('/users/import/validate', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      return await api.post('/users/import/validate', { 
        content: typeof data === 'string' ? data : undefined, 
        users: Array.isArray(data) ? data : undefined 
      });
    } catch (error: any) {
      console.error('❌ Failed to validate import data:', error);
      throw error;
    }
  },

  /**
   * Get import template - calls GET /users/import/template/:templateId
   */
  async getImportTemplate(templateId: string = 'standard'): Promise<ImportTemplate> {
    try {
      const response = await api.get<ImportTemplate>(`/users/import/template/${templateId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get import template ${templateId}:`, error);
      throw error;
    }
  },

  /**
   * Get all import templates - calls GET /users/import/templates
   */
  async getImportTemplates(): Promise<ImportTemplate[]> {
    try {
      const response = await api.get<ImportTemplate[]>('/users/import/templates');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get import templates:', error);
      throw error;
    }
  },

  /**
   * Download import template - calls GET /users/import/template/:templateId/download
   */
  async downloadImportTemplate(templateId: string = 'standard'): Promise<Blob> {
    try {
      return await api.download(`/users/import/template/${templateId}/download`);
    } catch (error: any) {
      console.error(`❌ Failed to download template ${templateId}:`, error);
      throw error;
    }
  },

  /**
   * Get import history - calls GET /users/import/history
   */
  async getImportHistory(params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<ImportHistory>> {
    try {
      const response = await api.get<PaginatedResponse<ImportHistory>>('/users/import/history', { params });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get import history:', error);
      throw error;
    }
  },

  /**
   * Get import history by ID - calls GET /users/import/history/:importId
   */
  async getImportHistoryById(importId: string): Promise<ImportHistory> {
    try {
      const response = await api.get<ImportHistory>(`/users/import/history/${importId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get import history ${importId}:`, error);
      throw error;
    }
  },

  /**
   * Get import statistics - calls GET /users/import/stats
   */
  async getImportStats(): Promise<ImportStats> {
    try {
      const response = await api.get<ImportStats>('/users/import/stats');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get import stats:', error);
      throw error;
    }
  },

  /**
   * Delete import history entry - calls DELETE /users/import/history/:importId
   */
  async deleteImportHistory(importId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/users/import/history/${importId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete import history ${importId}:`, error);
      throw error;
    }
  },

  /**
   * Clear all import history - calls DELETE /users/import/history
   */
  async clearImportHistory(): Promise<{ cleared: number; message: string }> {
    try {
      const response = await api.delete<{ cleared: number; message: string }>('/users/import/history');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to clear import history:', error);
      throw error;
    }
  },

  // ============================================
  // USER INVITATION OPERATIONS
  // ============================================

  /**
   * Invite a single user - calls POST /users/invite
   */
  async inviteUser(email: string, role: UserRole, options?: Partial<Omit<UserInvitation, 'id' | 'email' | 'role' | 'invitationToken' | 'invitedBy'>>): Promise<InvitationResult> {
    try {
      const response = await api.post<InvitationResult>('/users/invite', { email, role, ...options });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to invite user ${email}:`, error);
      throw error;
    }
  },

  /**
   * Invite multiple users - calls POST /users/invite/batch
   */
  async inviteUsers(invitations: Array<{ email: string; role: UserRole; businessUnitId?: string; message?: string }>, options?: { expiresIn?: number; sendEmail?: boolean }): Promise<BatchInvitationResult> {
    try {
      const response = await api.post<BatchInvitationResult>('/users/invite/batch', { invitations, ...options });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to invite multiple users:', error);
      throw error;
    }
  },

  /**
   * Resend invitation - calls POST /users/invite/:id/resend
   */
  async resendInvitation(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.post<UserInvitation>(`/users/invite/${invitationId}/resend`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to resend invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Cancel invitation - calls POST /users/invite/:id/cancel
   */
  async cancelInvitation(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.post<UserInvitation>(`/users/invite/${invitationId}/cancel`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to cancel invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Revoke invitation - calls POST /users/invite/:id/revoke
   */
  async revokeInvitation(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.post<UserInvitation>(`/users/invite/${invitationId}/revoke`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to revoke invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Delete invitation - calls DELETE /users/invite/:id
   */
  async deleteInvitation(invitationId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/users/invite/${invitationId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Get all invitations - calls GET /users/invitations
   */
  async getInvitations(params?: { page?: number; limit?: number; status?: string; search?: string; role?: string }): Promise<PaginatedResponse<UserInvitation>> {
    try {
      const response = await api.get<PaginatedResponse<UserInvitation>>('/users/invitations', { params });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get invitations:', error);
      throw error;
    }
  },

  /**
   * Get invitation by ID - calls GET /users/invite/:id
   */
  async getInvitationById(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.get<UserInvitation>(`/users/invite/${invitationId}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Get invitation by token - calls GET /users/invite/token/:token
   */
  async getInvitationByToken(token: string): Promise<UserInvitation> {
    try {
      const response = await api.get<UserInvitation>(`/users/invite/token/${token}`);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get invitation by token:', error);
      throw error;
    }
  },

  /**
   * Accept invitation - calls POST /users/invite/accept/:token
   */
  async acceptInvitation(token: string, userData: { firstName: string; lastName: string; password: string; phoneNumber?: string }): Promise<User> {
    try {
      const response = await api.post<User>(`/users/invite/accept/${token}`, userData);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to accept invitation:', error);
      throw error;
    }
  },

  /**
   * Decline invitation - calls POST /users/invite/decline/:token
   */
  async declineInvitation(token: string): Promise<{ message: string }> {
    try {
      const response = await api.post<{ message: string }>(`/users/invite/decline/${token}`);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to decline invitation:', error);
      throw error;
    }
  },

  /**
   * Get invitation statistics - calls GET /users/invitations/stats
   */
  async getInvitationStats(): Promise<InvitationStats> {
    try {
      const response = await api.get<InvitationStats>('/users/invitations/stats');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get invitation stats:', error);
      throw error;
    }
  },

  /**
   * Get invitation templates - calls GET /users/invite/templates
   */
  async getInvitationTemplates(): Promise<InvitationTemplate[]> {
    try {
      const response = await api.get<InvitationTemplate[]>('/users/invite/templates');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get invitation templates:', error);
      throw error;
    }
  },

  /**
   * Send invitation reminder - calls POST /users/invite/:id/remind
   */
  async sendInvitationReminder(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.post<UserInvitation>(`/users/invite/${invitationId}/remind`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to send reminder for ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Export invitations - calls GET /users/invitations/export
   */
  async exportInvitations(format: 'csv' | 'json' = 'json'): Promise<any> {
    try {
      if (format === 'json') {
        return await api.get('/users/invitations/export?format=json');
      }
      return await api.download(`/users/invitations/export?format=${format}`);
    } catch (error: any) {
      console.error('❌ Failed to export invitations:', error);
      throw error;
    }
  },

  // ============================================
  // USER GROUP OPERATIONS
  // ============================================

  /**
   * Get all groups - calls GET /users/groups
   */
  async getGroups(params?: GroupFilter): Promise<PaginatedResponse<UserGroup>> {
    try {
      const response = await api.get<PaginatedResponse<UserGroup>>('/users/groups', { params });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get groups:', error);
      throw error;
    }
  },

  /**
   * Get group by ID - calls GET /users/groups/:id
   */
  async getGroupById(id: string): Promise<UserGroup> {
    try {
      const response = await api.get<UserGroup>(`/users/groups/${id}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get group ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create group - calls POST /users/groups
   */
  async createGroup(data: CreateGroupData): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>('/users/groups', data);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create group:', error);
      throw error;
    }
  },

  /**
   * Update group - calls PUT /users/groups/:id
   */
  async updateGroup(id: string, data: UpdateGroupData): Promise<UserGroup> {
    try {
      const response = await api.put<UserGroup>(`/users/groups/${id}`, data);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update group ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete group - calls DELETE /users/groups/:id
   */
  async deleteGroup(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/users/groups/${id}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete group ${id}:`, error);
      throw error;
    }
  },

  /**
   * Assign users to group - calls POST /users/groups/:id/users
   */
  async assignUsersToGroup(groupId: string, userIds: string[], options?: { role?: UserRole; isLead?: boolean }): Promise<AssignUsersResponse> {
    try {
      const response = await api.post<AssignUsersResponse>(`/users/groups/${groupId}/users`, { userIds, ...options });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to assign users to group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Remove users from group - calls POST /users/groups/:id/remove-users
   */
  async removeUsersFromGroup(groupId: string, userIds: string[]): Promise<RemoveUsersResponse> {
    try {
      const response = await api.post<RemoveUsersResponse>(`/users/groups/${groupId}/remove-users`, { userIds });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to remove users from group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Get group members - calls GET /users/groups/:id/members
   */
  async getGroupMembers(groupId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<GroupMember>> {
    try {
      const response = await api.get<PaginatedResponse<GroupMember>>(`/users/groups/${groupId}/members`, { params });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get members of group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Update group permissions - calls PUT /users/groups/:id/permissions
   */
  async updateGroupPermissions(groupId: string, permissions: string[]): Promise<UserGroup> {
    try {
      const response = await api.put<UserGroup>(`/users/groups/${groupId}/permissions`, { permissions });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update permissions for group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Update member role - calls PUT /users/groups/:id/members/:userId/role
   */
  async updateMemberRole(groupId: string, userId: string, role: UserRole): Promise<GroupMember> {
    try {
      const response = await api.put<GroupMember>(`/users/groups/${groupId}/members/${userId}/role`, { role });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update member role in group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Set group lead - calls PUT /users/groups/:id/members/:userId/lead
   */
  async setGroupLead(groupId: string, userId: string, isLead: boolean): Promise<GroupMember> {
    try {
      const response = await api.put<GroupMember>(`/users/groups/${groupId}/members/${userId}/lead`, { isLead });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to set group lead in group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Get group statistics - calls GET /users/groups/stats
   */
  async getGroupStats(): Promise<GroupStats> {
    try {
      const response = await api.get<GroupStats>('/users/groups/stats');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get group stats:', error);
      throw error;
    }
  },

  /**
   * Get group hierarchy - calls GET /users/groups/hierarchy
   */
  async getGroupHierarchy(): Promise<any[]> {
    try {
      const response = await api.get<any[]>('/users/groups/hierarchy');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get group hierarchy:', error);
      throw error;
    }
  },

  /**
   * Move group - calls PUT /users/groups/:id/move
   */
  async moveGroup(groupId: string, parentGroupId: string | null): Promise<UserGroup> {
    try {
      const response = await api.put<UserGroup>(`/users/groups/${groupId}/move`, { parentGroupId });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to move group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Merge groups - calls POST /users/groups/merge
   */
  async mergeGroups(sourceGroupId: string, targetGroupId: string): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>('/users/groups/merge', { sourceGroupId, targetGroupId });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to merge groups:', error);
      throw error;
    }
  },

  /**
   * Duplicate group - calls POST /users/groups/:id/duplicate
   */
  async duplicateGroup(groupId: string, name?: string): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(`/users/groups/${groupId}/duplicate`, { name });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to duplicate group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Activate group - calls POST /users/groups/:id/activate
   */
  async activateGroup(groupId: string): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(`/users/groups/${groupId}/activate`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to activate group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Deactivate group - calls POST /users/groups/:id/deactivate
   */
  async deactivateGroup(groupId: string): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(`/users/groups/${groupId}/deactivate`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to deactivate group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Archive group - calls POST /users/groups/:id/archive
   */
  async archiveGroup(groupId: string): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(`/users/groups/${groupId}/archive`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to archive group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Export groups - calls GET /users/groups/export
   */
  async exportGroups(format: 'csv' | 'json' = 'json'): Promise<any> {
    try {
      if (format === 'json') {
        return await api.get('/users/groups/export?format=json');
      }
      return await api.download(`/users/groups/export?format=${format}`);
    } catch (error: any) {
      console.error('❌ Failed to export groups:', error);
      throw error;
    }
  },
};

export default userService;
