// D:\Projects\Kalwanga\packages\web\services\userGroupService.ts

import { api } from './api';
import { UserRole } from '../types/enums';
import { User } from '../types/user';

export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  members: GroupMember[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isActive: boolean;
  businessUnitId?: string;
  businessUnit?: {
    id: string;
    name: string;
    code: string;
  };
  memberCount?: number;
  parentGroupId?: string;
  parentGroup?: UserGroup;
  childGroups?: UserGroup[];
}

export interface GroupMember {
  userId: string;
  role: UserRole;
  joinedAt: string;
  isLead: boolean;
  user?: User;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  permissions?: string[];
  members?: Array<{
    userId: string;
    role?: UserRole;
    isLead?: boolean;
  }>;
  businessUnitId?: string;
  parentGroupId?: string;
}

export interface UpdateGroupData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  permissions?: string[];
  isActive?: boolean;
  businessUnitId?: string;
  parentGroupId?: string | null;
}

export interface GroupFilter {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  parentGroupId?: string;
  createdBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GroupResponse {
  data: UserGroup[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface AssignUsersResult {
  groupId: string;
  assignedCount: number;
  skippedCount: number;
  assignedUsers: string[];
  skippedUsers: string[];
}

export interface RemoveUsersResult {
  groupId: string;
  removedCount: number;
  skippedCount: number;
  removedUsers: string[];
  skippedUsers: string[];
}

export interface GroupStats {
  totalGroups: number;
  totalMembers: number;
  activeGroups: number;
  inactiveGroups: number;
  totalPermissions: number;
  averageMembersPerGroup: number;
  byRole: Record<string, number>;
  byPermission: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
}

export const userGroupService = {
  // ============================================
  // CORE GROUP OPERATIONS
  // ============================================

  /**
   * Create a new user group
   * POST /user-groups
   */
  async createGroup(data: CreateGroupData): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>('/user-groups', data);
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create group:', error);
      throw error;
    }
  },

  /**
   * Create multiple groups
   * POST /user-groups/batch
   */
  async createGroups(groups: CreateGroupData[]): Promise<UserGroup[]> {
    try {
      const response = await api.post<UserGroup[]>('/user-groups/batch', { groups });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create multiple groups:', error);
      throw error;
    }
  },

  /**
   * Update an existing group
   * PUT /user-groups/:id
   */
  async updateGroup(id: string, data: UpdateGroupData): Promise<UserGroup> {
    try {
      const response = await api.put<UserGroup>(`/user-groups/${id}`, data);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update group ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a group
   * DELETE /user-groups/:id
   */
  async deleteGroup(id: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(`/user-groups/${id}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete group ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete multiple groups
   * POST /user-groups/batch/delete
   */
  async deleteGroups(ids: string[]): Promise<{ deletedCount: number; message: string }> {
    try {
      const response = await api.post<{ deletedCount: number; message: string }>(
        '/user-groups/batch/delete',
        { ids }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to delete multiple groups:', error);
      throw error;
    }
  },

  // ============================================
  // GET GROUP OPERATIONS
  // ============================================

  /**
   * Get all groups with filtering
   * GET /user-groups
   */
  async getGroups(filters: GroupFilter = {}): Promise<GroupResponse> {
    try {
      const params: Record<string, any> = {
        page: filters.page || 1,
        limit: filters.limit || 20,
      };

      if (filters.search) params.search = filters.search;
      if (filters.isActive !== undefined) params.isActive = filters.isActive;
      if (filters.parentGroupId) params.parentGroupId = filters.parentGroupId;
      if (filters.createdBy) params.createdBy = filters.createdBy;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;

      const response = await api.get<GroupResponse>('/user-groups', { params });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get groups:', error);
      throw error;
    }
  },

  /**
   * Get group by ID
   * GET /user-groups/:id
   */
  async getGroupById(id: string): Promise<UserGroup> {
    try {
      const response = await api.get<UserGroup>(`/user-groups/${id}`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get group ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get group by name
   * GET /user-groups/by-name/:name
   */
  async getGroupByName(name: string): Promise<UserGroup> {
    try {
      const response = await api.get<UserGroup>(
        `/user-groups/by-name/${encodeURIComponent(name)}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get group by name ${name}:`, error);
      throw error;
    }
  },

  // ============================================
  // GROUP MEMBER OPERATIONS
  // ============================================

  /**
   * Assign users to a group
   * POST /user-groups/:id/users
   */
  async assignUsersToGroup(
    groupId: string,
    userIds: string[],
    options: {
      role?: UserRole;
      isLead?: boolean;
      sendNotification?: boolean;
    } = {}
  ): Promise<AssignUsersResult> {
    try {
      const response = await api.post<AssignUsersResult>(
        `/user-groups/${groupId}/users`,
        { userIds, ...options }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to assign users to group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Remove users from a group
   * DELETE /user-groups/:id/users
   */
  async removeUsersFromGroup(
    groupId: string,
    userIds: string[]
  ): Promise<RemoveUsersResult> {
    try {
      const response = await api.delete<RemoveUsersResult>(
        `/user-groups/${groupId}/users`,
        { data: { userIds } }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to remove users from group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Get group members
   * GET /user-groups/:id/members
   */
  async getGroupMembers(
    groupId: string,
    filters: {
      page?: number;
      limit?: number;
      role?: UserRole;
      search?: string;
    } = {}
  ): Promise<GroupResponse> {
    try {
      const params: Record<string, any> = {
        page: filters.page || 1,
        limit: filters.limit || 20,
      };

      if (filters.role) params.role = filters.role;
      if (filters.search) params.search = filters.search;

      const response = await api.get<GroupResponse>(
        `/user-groups/${groupId}/members`,
        { params }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get members of group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Get group members count
   * GET /user-groups/:id/members/count
   */
  async getGroupMembersCount(groupId: string): Promise<{ count: number }> {
    try {
      const response = await api.get<{ count: number }>(
        `/user-groups/${groupId}/members/count`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get members count for group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Update group member role
   * PUT /user-groups/:groupId/members/:userId/role
   */
  async updateMemberRole(
    groupId: string,
    userId: string,
    role: UserRole
  ): Promise<GroupMember> {
    try {
      const response = await api.put<GroupMember>(
        `/user-groups/${groupId}/members/${userId}/role`,
        { role }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update member role in group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Set group lead
   * PUT /user-groups/:groupId/members/:userId/lead
   */
  async setGroupLead(
    groupId: string,
    userId: string,
    isLead: boolean = true
  ): Promise<GroupMember> {
    try {
      const response = await api.put<GroupMember>(
        `/user-groups/${groupId}/members/${userId}/lead`,
        { isLead }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to set group lead in group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Check if user is in group
   * GET /user-groups/:groupId/members/:userId
   */
  async isUserInGroup(groupId: string, userId: string): Promise<{ inGroup: boolean }> {
    try {
      const response = await api.get<{ inGroup: boolean }>(
        `/user-groups/${groupId}/members/${userId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to check if user ${userId} is in group ${groupId}:`, error);
      throw error;
    }
  },

  // ============================================
  // GROUP PERMISSION OPERATIONS
  // ============================================

  /**
   * Update group permissions
   * PUT /user-groups/:id/permissions
   */
  async updateGroupPermissions(
    groupId: string,
    permissions: string[]
  ): Promise<UserGroup> {
    try {
      const response = await api.put<UserGroup>(
        `/user-groups/${groupId}/permissions`,
        { permissions }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update permissions for group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Add permissions to group
   * POST /user-groups/:id/permissions/add
   */
  async addGroupPermissions(
    groupId: string,
    permissions: string[]
  ): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(
        `/user-groups/${groupId}/permissions/add`,
        { permissions }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to add permissions to group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Remove permissions from group
   * POST /user-groups/:id/permissions/remove
   */
  async removeGroupPermissions(
    groupId: string,
    permissions: string[]
  ): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(
        `/user-groups/${groupId}/permissions/remove`,
        { permissions }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to remove permissions from group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Get group permissions
   * GET /user-groups/:id/permissions
   */
  async getGroupPermissions(groupId: string): Promise<string[]> {
    try {
      const response = await api.get<string[]>(`/user-groups/${groupId}/permissions`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get permissions for group ${groupId}:`, error);
      throw error;
    }
  },

  // ============================================
  // GROUP HIERARCHY OPERATIONS
  // ============================================

  /**
   * Get group hierarchy
   * GET /user-groups/hierarchy
   */
  async getGroupHierarchy(groupId?: string): Promise<any[]> {
    try {
      const params = groupId ? { rootId: groupId } : undefined;
      const response = await api.get<any[]>('/user-groups/hierarchy', { params });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get group hierarchy:', error);
      throw error;
    }
  },

  /**
   * Get child groups
   * GET /user-groups/:id/children
   */
  async getChildGroups(groupId: string): Promise<UserGroup[]> {
    try {
      const response = await api.get<UserGroup[]>(`/user-groups/${groupId}/children`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get child groups of ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Get parent group
   * GET /user-groups/:id/parent
   */
  async getParentGroup(groupId: string): Promise<UserGroup | null> {
    try {
      const response = await api.get<UserGroup | null>(`/user-groups/${groupId}/parent`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get parent group of ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Move group to new parent
   * PUT /user-groups/:id/move
   */
  async moveGroup(groupId: string, parentGroupId: string | null): Promise<UserGroup> {
    try {
      const response = await api.put<UserGroup>(
        `/user-groups/${groupId}/move`,
        { parentGroupId }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to move group ${groupId}:`, error);
      throw error;
    }
  },

  // ============================================
  // GROUP UTILITY OPERATIONS
  // ============================================

  /**
   * Merge groups
   * POST /user-groups/merge
   */
  async mergeGroups(
    sourceGroupId: string,
    targetGroupId: string
  ): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(
        '/user-groups/merge',
        { sourceGroupId, targetGroupId }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to merge groups:', error);
      throw error;
    }
  },

  /**
   * Duplicate group
   * POST /user-groups/:id/duplicate
   */
  async duplicateGroup(
    groupId: string,
    newName?: string
  ): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(
        `/user-groups/${groupId}/duplicate`,
        { name: newName }
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to duplicate group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Activate group
   * POST /user-groups/:id/activate
   */
  async activateGroup(groupId: string): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(
        `/user-groups/${groupId}/activate`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to activate group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Deactivate group
   * POST /user-groups/:id/deactivate
   */
  async deactivateGroup(groupId: string): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(
        `/user-groups/${groupId}/deactivate`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to deactivate group ${groupId}:`, error);
      throw error;
    }
  },

  /**
   * Archive group
   * POST /user-groups/:id/archive
   */
  async archiveGroup(groupId: string): Promise<UserGroup> {
    try {
      const response = await api.post<UserGroup>(
        `/user-groups/${groupId}/archive`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to archive group ${groupId}:`, error);
      throw error;
    }
  },

  // ============================================
  // SEARCH & EXPORT OPERATIONS
  // ============================================

  /**
   * Search groups
   * GET /user-groups/search
   */
  async searchGroups(
    query: string,
    filters: GroupFilter = {}
  ): Promise<GroupResponse> {
    try {
      return await this.getGroups({
        ...filters,
        search: query,
      });
    } catch (error: any) {
      console.error('❌ Failed to search groups:', error);
      throw error;
    }
  },

  /**
   * Export groups
   * GET /user-groups/export
   */
  async exportGroups(
    format: 'csv' | 'json' = 'json',
    filters: GroupFilter = {}
  ): Promise<any> {
    try {
      const params: Record<string, any> = { format };
      if (filters.search) params.search = filters.search;
      if (filters.isActive !== undefined) params.isActive = filters.isActive;

      if (format === 'json') {
        return await api.get('/user-groups/export', { params });
      } else {
        return await api.download('/user-groups/export', { params });
      }
    } catch (error: any) {
      console.error('❌ Failed to export groups:', error);
      throw error;
    }
  },

  // ============================================
  // STATISTICS OPERATIONS
  // ============================================

  /**
   * Get group statistics
   * GET /user-groups/stats
   */
  async getGroupStats(): Promise<GroupStats> {
    try {
      const response = await api.get<GroupStats>('/user-groups/stats');
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get group stats:', error);
      throw error;
    }
  },

  /**
   * Get user's groups
   * GET /users/:userId/groups
   */
  async getUserGroups(userId: string): Promise<UserGroup[]> {
    try {
      const response = await api.get<UserGroup[]>(`/users/${userId}/groups`);
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get groups for user ${userId}:`, error);
      throw error;
    }
  },

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Get available group icons
   */
  getAvailableIcons(): string[] {
    return [
      'Users', 'UserCog', 'UserCircle', 'UserSquare', 'UserRound',
      'UserRoundCheck', 'UserRoundCog', 'UserRoundPlus', 'UsersRound',
      'Network', 'GitBranch', 'GitMerge', 'FolderOpen', 'FolderClosed',
      'FolderPlus', 'Star', 'Heart', 'Briefcase', 'Shield', 'Settings',
      'Globe', 'Bookmark', 'Tag', 'Building', 'Store', 'Truck',
      'Database', 'Server', 'Cloud', 'Wifi', 'Bluetooth', 'Battery',
      'Sun', 'Moon', 'Wind', 'Droplet', 'Flame', 'Leaf', 'TreePine',
      'Mountain', 'Waves', 'Compass', 'Map', 'Navigation', 'Route',
      'Target', 'Crosshair', 'Gauge', 'CreditCard', 'DollarSign',
      'Percent', 'Tag', 'Store', 'ClipboardList', 'Truck', 'Boxes',
      'Layers', 'FolderTree', 'Database', 'Server', 'Cloud',
    ];
  },

  /**
   * Get available group colors
   */
  getAvailableColors(): string[] {
    return [
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
      'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
    ];
  },

  /**
   * Get permission categories
   */
  getPermissionCategories(): Array<{
    id: string;
    label: string;
    permissions: Array<{
      id: string;
      label: string;
      description: string;
      resource: string;
      action: string;
      category: string;
    }>;
  }> {
    return [
      {
        id: 'user',
        label: 'User Management',
        permissions: [
          { id: 'user:view', label: 'View Users', description: 'View user list and details', resource: 'user', action: 'view', category: 'user' },
          { id: 'user:create', label: 'Create Users', description: 'Create new users', resource: 'user', action: 'create', category: 'user' },
          { id: 'user:edit', label: 'Edit Users', description: 'Edit user details', resource: 'user', action: 'edit', category: 'user' },
          { id: 'user:delete', label: 'Delete Users', description: 'Delete users', resource: 'user', action: 'delete', category: 'user' },
          { id: 'user:manage', label: 'Manage Users', description: 'Full user management', resource: 'user', action: 'manage', category: 'user' },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory Management',
        permissions: [
          { id: 'inventory:view', label: 'View Inventory', description: 'View inventory items', resource: 'inventory', action: 'view', category: 'inventory' },
          { id: 'inventory:create', label: 'Create Items', description: 'Add inventory items', resource: 'inventory', action: 'create', category: 'inventory' },
          { id: 'inventory:edit', label: 'Edit Items', description: 'Edit inventory items', resource: 'inventory', action: 'edit', category: 'inventory' },
          { id: 'inventory:delete', label: 'Delete Items', description: 'Delete inventory items', resource: 'inventory', action: 'delete', category: 'inventory' },
          { id: 'inventory:manage', label: 'Manage Inventory', description: 'Full inventory management', resource: 'inventory', action: 'manage', category: 'inventory' },
        ],
      },
      {
        id: 'product',
        label: 'Product Management',
        permissions: [
          { id: 'product:view', label: 'View Products', description: 'View products', resource: 'product', action: 'view', category: 'product' },
          { id: 'product:create', label: 'Create Products', description: 'Add products', resource: 'product', action: 'create', category: 'product' },
          { id: 'product:edit', label: 'Edit Products', description: 'Edit products', resource: 'product', action: 'edit', category: 'product' },
          { id: 'product:delete', label: 'Delete Products', description: 'Delete products', resource: 'product', action: 'delete', category: 'product' },
        ],
      },
      {
        id: 'report',
        label: 'Reports',
        permissions: [
          { id: 'report:view', label: 'View Reports', description: 'View reports', resource: 'report', action: 'view', category: 'report' },
          { id: 'report:create', label: 'Create Reports', description: 'Generate reports', resource: 'report', action: 'create', category: 'report' },
          { id: 'report:export', label: 'Export Reports', description: 'Export reports', resource: 'report', action: 'export', category: 'report' },
        ],
      },
      {
        id: 'business_unit',
        label: 'Business Unit',
        permissions: [
          { id: 'business_unit:view', label: 'View Business Units', description: 'View business units', resource: 'business_unit', action: 'view', category: 'business_unit' },
          { id: 'business_unit:create', label: 'Create Business Units', description: 'Create new business units', resource: 'business_unit', action: 'create', category: 'business_unit' },
          { id: 'business_unit:edit', label: 'Edit Business Units', description: 'Edit business units', resource: 'business_unit', action: 'edit', category: 'business_unit' },
          { id: 'business_unit:delete', label: 'Delete Business Units', description: 'Delete business units', resource: 'business_unit', action: 'delete', category: 'business_unit' },
          { id: 'business_unit:manage', label: 'Manage Business Units', description: 'Full business unit management', resource: 'business_unit', action: 'manage', category: 'business_unit' },
        ],
      },
      {
        id: 'integration',
        label: 'Integrations',
        permissions: [
          { id: 'integration:view', label: 'View Integrations', description: 'View integrations', resource: 'integration', action: 'view', category: 'integration' },
          { id: 'integration:manage', label: 'Manage Integrations', description: 'Manage integrations', resource: 'integration', action: 'manage', category: 'integration' },
          { id: 'api:view', label: 'View API Keys', description: 'View API keys', resource: 'api', action: 'view', category: 'integration' },
          { id: 'api:manage', label: 'Manage API Keys', description: 'Manage API keys', resource: 'api', action: 'manage', category: 'integration' },
          { id: 'webhook:view', label: 'View Webhooks', description: 'View webhooks', resource: 'webhook', action: 'view', category: 'integration' },
          { id: 'webhook:manage', label: 'Manage Webhooks', description: 'Manage webhooks', resource: 'webhook', action: 'manage', category: 'integration' },
        ],
      },
    ];
  },

  /**
   * Get group color by name
   */
  getGroupColor(name: string): string {
    const colors = this.getAvailableColors();
    const index = name.length % colors.length;
    return colors[index];
  },

  /**
   * Get default group permissions
   */
  getDefaultPermissions(): string[] {
    return [
      'user:view',
      'product:view',
      'inventory:view',
      'report:view',
      'business_unit:view',
    ];
  },

  /**
   * Get admin group permissions
   */
  getAdminPermissions(): string[] {
    return [
      'user:view', 'user:create', 'user:edit', 'user:delete', 'user:manage',
      'product:view', 'product:create', 'product:edit', 'product:delete',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:manage',
      'report:view', 'report:create', 'report:export',
      'business_unit:view', 'business_unit:create', 'business_unit:edit', 'business_unit:delete', 'business_unit:manage',
      'integration:view', 'integration:manage', 'api:view', 'api:manage', 'webhook:view', 'webhook:manage',
    ];
  },
};

export default userGroupService;
