// D:\Projects\Kalwanga\packages\web\services\userInvitationService.ts

import { api } from './api';
import { UserRole } from '../types/enums';
import { User } from '../types/user';

// Invitation-related type definitions
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
  invitedById?: string;
  reminderSent?: boolean;
  reminderSentAt?: string;
  reminderCount?: number;
  metadata?: Record<string, any>;
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
  role: UserRole;
  variables: string[];
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvitationStats {
  total: number;
  pending: number;
  sent: number;
  accepted: number;
  expired: number;
  cancelled: number;
  revoked: number;
  acceptanceRate: number;
  averageResponseTime: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  byMonth: Array<{ month: string; count: number }>;
}

export interface InvitationFilter {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  invitedBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InvitationResponse {
  data: UserInvitation[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface InvitationOptions {
  businessUnitId?: string;
  message?: string;
  expiresIn?: number;
  sendEmail?: boolean;
  templateId?: string;
  metadata?: Record<string, any>;
}

// Response types for API calls
export interface InvitationStatusResponse {
  status: string;
  valid: boolean;
  expiresAt?: string;
}

export interface ValidateTokenResponse {
  valid: boolean;
  message?: string;
  invitation?: UserInvitation;
}

export const userInvitationService = {
  /**
   * Invite a single user
   * @param email - Email address
   * @param role - User role
   * @param options - Invitation options
   * @returns Invitation result
   */
  async inviteUser(
    email: string,
    role: UserRole,
    options: InvitationOptions = {}
  ): Promise<InvitationResult> {
    try {
      const response = await api.post<InvitationResult>('/users/invite', {
        email,
        role,
        ...options,
      });
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to invite user ${email}:`, error);
      throw error;
    }
  },

  /**
   * Invite multiple users
   * @param invitations - Array of invitation data
   * @param options - Global invitation options
   * @returns Batch invitation result
   */
  async inviteUsers(
    invitations: Array<{
      email: string;
      role: UserRole;
      businessUnitId?: string;
      message?: string;
    }>,
    options: InvitationOptions = {}
  ): Promise<BatchInvitationResult> {
    try {
      const response = await api.post<BatchInvitationResult>('/users/invite/batch', {
        invitations,
        ...options,
      });
      return response;
    } catch (error: any) {
      console.error('❌ Failed to invite multiple users:', error);
      throw error;
    }
  },

  /**
   * Resend invitation
   * @param invitationId - Invitation ID
   * @returns Updated invitation
   */
  async resendInvitation(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.post<UserInvitation>(
        `/users/invite/${invitationId}/resend`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to resend invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Resend multiple invitations
   * @param invitationIds - Array of invitation IDs
   * @returns Batch result
   */
  async resendInvitations(invitationIds: string[]): Promise<BatchInvitationResult> {
    try {
      const response = await api.post<BatchInvitationResult>(
        '/users/invite/batch/resend',
        { invitationIds }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to resend invitations:', error);
      throw error;
    }
  },

  /**
   * Cancel invitation
   * @param invitationId - Invitation ID
   * @returns Updated invitation
   */
  async cancelInvitation(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.post<UserInvitation>(
        `/users/invite/${invitationId}/cancel`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to cancel invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Cancel multiple invitations
   * @param invitationIds - Array of invitation IDs
   * @returns Batch result
   */
  async cancelInvitations(invitationIds: string[]): Promise<BatchInvitationResult> {
    try {
      const response = await api.post<BatchInvitationResult>(
        '/users/invite/batch/cancel',
        { invitationIds }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to cancel invitations:', error);
      throw error;
    }
  },

  /**
   * Revoke invitation
   * @param invitationId - Invitation ID
   * @returns Updated invitation
   */
  async revokeInvitation(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.post<UserInvitation>(
        `/users/invite/${invitationId}/revoke`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to revoke invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Get all invitations
   * @param filters - Invitation filters
   * @returns Paginated invitations
   */
  async getInvitations(
    filters: InvitationFilter = {}
  ): Promise<InvitationResponse> {
    try {
      const params: Record<string, any> = {
        page: filters.page || 1,
        limit: filters.limit || 20,
      };

      if (filters.search) params.search = filters.search;
      if (filters.role) params.role = filters.role;
      if (filters.status) params.status = filters.status;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.invitedBy) params.invitedBy = filters.invitedBy;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.sortOrder) params.sortOrder = filters.sortOrder;

      const response = await api.get<InvitationResponse>(
        '/users/invitations',
        { params }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get invitations:', error);
      throw error;
    }
  },

  /**
   * Get invitation by ID
   * @param invitationId - Invitation ID
   * @returns Invitation details
   */
  async getInvitationById(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.get<UserInvitation>(
        `/users/invite/${invitationId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Get invitation by token
   * @param token - Invitation token
   * @returns Invitation details
   */
  async getInvitationByToken(token: string): Promise<UserInvitation> {
    try {
      const response = await api.get<UserInvitation>(
        `/users/invite/token/${token}`
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get invitation by token:', error);
      throw error;
    }
  },

  /**
   * Accept invitation
   * @param token - Invitation token
   * @param userData - User registration data
   * @returns Accepted user
   */
  async acceptInvitation(
    token: string,
    userData: {
      firstName: string;
      lastName: string;
      password: string;
      phoneNumber?: string;
    }
  ): Promise<User> {
    try {
      const response = await api.post<User>(
        `/users/invite/accept/${token}`,
        userData
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to accept invitation:', error);
      throw error;
    }
  },

  /**
   * Decline invitation
   * @param token - Invitation token
   * @returns Decline result
   */
  async declineInvitation(token: string): Promise<{ message: string }> {
    try {
      const response = await api.post<{ message: string }>(
        `/users/invite/decline/${token}`
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to decline invitation:', error);
      throw error;
    }
  },

  /**
   * Get invitation statistics
   * @returns Invitation statistics
   */
  async getInvitationStats(): Promise<InvitationStats> {
    try {
      const response = await api.get<InvitationStats>(
        '/users/invitations/stats'
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get invitation stats:', error);
      throw error;
    }
  },

  /**
   * Get invitation templates
   * @returns Array of templates
   */
  async getInvitationTemplates(): Promise<InvitationTemplate[]> {
    try {
      const response = await api.get<InvitationTemplate[]>(
        '/users/invite/templates'
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get invitation templates:', error);
      throw error;
    }
  },

  /**
   * Get invitation template by ID
   * @param templateId - Template ID
   * @returns Template details
   */
  async getInvitationTemplate(templateId: string): Promise<InvitationTemplate> {
    try {
      const response = await api.get<InvitationTemplate>(
        `/users/invite/templates/${templateId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to get template ${templateId}:`, error);
      throw error;
    }
  },

  /**
   * Create invitation template
   * @param template - Template data
   * @returns Created template
   */
  async createInvitationTemplate(
    template: Partial<InvitationTemplate>
  ): Promise<InvitationTemplate> {
    try {
      const response = await api.post<InvitationTemplate>(
        '/users/invite/templates',
        template
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to create template:', error);
      throw error;
    }
  },

  /**
   * Update invitation template
   * @param templateId - Template ID
   * @param updates - Template updates
   * @returns Updated template
   */
  async updateInvitationTemplate(
    templateId: string,
    updates: Partial<InvitationTemplate>
  ): Promise<InvitationTemplate> {
    try {
      const response = await api.put<InvitationTemplate>(
        `/users/invite/templates/${templateId}`,
        updates
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to update template ${templateId}:`, error);
      throw error;
    }
  },

  /**
   * Delete invitation template
   * @param templateId - Template ID
   * @returns Delete result
   */
  async deleteInvitationTemplate(
    templateId: string
  ): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(
        `/users/invite/templates/${templateId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete template ${templateId}:`, error);
      throw error;
    }
  },

  /**
   * Search invitations
   * @param query - Search query
   * @param filters - Additional filters
   * @returns Search results
   */
  async searchInvitations(
    query: string,
    filters: InvitationFilter = {}
  ): Promise<InvitationResponse> {
    try {
      return await this.getInvitations({
        ...filters,
        search: query,
      });
    } catch (error: any) {
      console.error('❌ Failed to search invitations:', error);
      throw error;
    }
  },

  /**
   * Get invitations by status
   * @param status - Invitation status
   * @param filters - Additional filters
   * @returns Filtered invitations
   */
  async getInvitationsByStatus(
    status: string,
    filters: InvitationFilter = {}
  ): Promise<InvitationResponse> {
    try {
      return await this.getInvitations({
        ...filters,
        status,
      });
    } catch (error: any) {
      console.error(`❌ Failed to get invitations by status ${status}:`, error);
      throw error;
    }
  },

  /**
   * Get invitations by role
   * @param role - User role
   * @param filters - Additional filters
   * @returns Filtered invitations
   */
  async getInvitationsByRole(
    role: UserRole,
    filters: InvitationFilter = {}
  ): Promise<InvitationResponse> {
    try {
      return await this.getInvitations({
        ...filters,
        role,
      });
    } catch (error: any) {
      console.error(`❌ Failed to get invitations by role ${role}:`, error);
      throw error;
    }
  },

  /**
   * Export invitations
   * @param format - Export format
   * @param filters - Export filters
   * @returns Export response
   */
  async exportInvitations(
    format: 'csv' | 'json' = 'json',
    filters: InvitationFilter = {}
  ): Promise<any> {
    try {
      const params: Record<string, any> = { format };
      if (filters.status) params.status = filters.status;
      if (filters.role) params.role = filters.role;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;

      if (format === 'json') {
        return await api.get('/users/invitations/export', { params });
      } else {
        return await api.download('/users/invitations/export', { params });
      }
    } catch (error: any) {
      console.error('❌ Failed to export invitations:', error);
      throw error;
    }
  },

  /**
   * Send invitation reminder
   * @param invitationId - Invitation ID
   * @returns Updated invitation
   */
  async sendReminder(invitationId: string): Promise<UserInvitation> {
    try {
      const response = await api.post<UserInvitation>(
        `/users/invite/${invitationId}/remind`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to send reminder for ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Check invitation status
   * @param token - Invitation token
   * @returns Invitation status
   */
  async checkInvitationStatus(
    token: string
  ): Promise<InvitationStatusResponse> {
    try {
      // ✅ FIXED: Added generic type to api.get
      const response = await api.get<InvitationStatusResponse>(
        `/users/invite/status/${token}`
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to check invitation status:', error);
      throw error;
    }
  },

  /**
   * Validate invitation token
   * @param token - Invitation token
   * @returns Validation result
   */
  async validateInvitationToken(
    token: string
  ): Promise<ValidateTokenResponse> {
    try {
      // ✅ FIXED: Added generic type to api.post
      const response = await api.post<ValidateTokenResponse>(
        `/users/invite/validate-token`,
        { token }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to validate invitation token:', error);
      throw error;
    }
  },

  /**
   * Get pending invitations count
   * @returns Pending count
   */
  async getPendingInvitationsCount(): Promise<{ count: number }> {
    try {
      const response = await api.get<{ count: number }>(
        '/users/invitations/pending/count'
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to get pending count:', error);
      throw error;
    }
  },

  /**
   * Generate invitation link
   * @param token - Invitation token
   * @param baseUrl - Base URL
   * @returns Invitation link
   */
  generateInvitationLink(token: string, baseUrl?: string): string {
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return `${base}/invite/${token}`;
  },

  /**
   * Copy invitation link to clipboard
   * @param token - Invitation token
   * @returns Copy result
   */
  async copyInvitationLink(token: string): Promise<boolean> {
    try {
      const link = this.generateInvitationLink(token);
      await navigator.clipboard.writeText(link);
      return true;
    } catch (error) {
      console.error('❌ Failed to copy invitation link:', error);
      return false;
    }
  },

  /**
   * Delete invitation
   * @param invitationId - Invitation ID
   * @returns Delete result
   */
  async deleteInvitation(invitationId: string): Promise<{ message: string }> {
    try {
      const response = await api.delete<{ message: string }>(
        `/users/invite/${invitationId}`
      );
      return response;
    } catch (error: any) {
      console.error(`❌ Failed to delete invitation ${invitationId}:`, error);
      throw error;
    }
  },

  /**
   * Delete multiple invitations
   * @param invitationIds - Array of invitation IDs
   * @returns Batch result
   */
  async deleteInvitations(invitationIds: string[]): Promise<BatchInvitationResult> {
    try {
      const response = await api.post<BatchInvitationResult>(
        '/users/invite/batch/delete',
        { invitationIds }
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to delete invitations:', error);
      throw error;
    }
  },

  /**
   * Clear expired invitations
   * @returns Clear result
   */
  async clearExpiredInvitations(): Promise<{ cleared: number; message: string }> {
    try {
      const response = await api.delete<{ cleared: number; message: string }>(
        '/users/invitations/expired'
      );
      return response;
    } catch (error: any) {
      console.error('❌ Failed to clear expired invitations:', error);
      throw error;
    }
  },
};

export default userInvitationService;
