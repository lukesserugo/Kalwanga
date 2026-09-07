// D:\Projects\Kalwanga\packages\backend\src\services\userInvitationService.ts

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { UserRole } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ============================================
// AUDIT CONSTANTS (Matching Prisma Schema Enums)
// ============================================

// These match the enum values in your Prisma schema exactly
const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  EXPORT: 'EXPORT',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  IMPORT: 'IMPORT',
  DOWNLOAD: 'DOWNLOAD',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  INVITE: 'INVITE',
} as const;

const AuditSeverity = {
  INFO: 'INFO',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;

// ============================================
// TYPES
// ============================================

interface InviteUserData {
  email: string;
  role: UserRole;
  businessUnitId?: string;
  message?: string;
  expiresIn?: number;
  sendEmail?: boolean;
  templateId?: string;
  metadata?: Record<string, any>;
}

interface InvitationFilter {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  invitedBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function handleError(error: any, context: string): never {
  logger.error(`[${context}] Error:`, error);
  if (error instanceof AppError) {
    throw error;
  }
  if (error instanceof Error) {
    throw new AppError(error.message, 500);
  }
  throw new AppError('An unexpected error occurred', 500);
}

// ============================================
// USER INVITATION SERVICE
// ============================================

export class UserInvitationService {
  /**
   * Invite a single user
   */
  async inviteUser(data: InviteUserData, currentUserId?: string, currentUserEmail?: string) {
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      // Use (prisma as any) for invitation model access
      const existingInvitation = await (prisma as any).invitation.findFirst({
        where: {
          email: data.email,
          status: { in: ['pending', 'sent'] },
        },
      });

      if (existingInvitation) {
        return {
          id: existingInvitation.id,
          email: existingInvitation.email,
          status: 'duplicate',
          message: 'Invitation already exists for this email',
          invitation: existingInvitation,
        };
      }

      const token = generateInvitationToken();
      const expiresAt = data.expiresIn && data.expiresIn > 0
        ? new Date(Date.now() + data.expiresIn * 24 * 60 * 60 * 1000)
        : null;

      const invitation = await (prisma as any).invitation.create({
        data: {
          email: data.email.toLowerCase(),
          role: data.role,
          businessUnitId: data.businessUnitId,
          message: data.message,
          expiresIn: data.expiresIn || 7,
          status: 'sent',
          sentAt: new Date(),
          expiresAt,
          invitationToken: token,
          invitedBy: currentUserEmail || 'Unknown',
          invitedById: currentUserId,
          metadata: data.metadata,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: currentUserId || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, role: invitation.role, invitedBy: invitation.invitedBy },
          severity: AuditSeverity.INFO,
        },
      });

      return {
        id: invitation.id,
        email: invitation.email,
        status: 'sent',
        invitation,
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.inviteUser');
    }
  }

  /**
   * Invite multiple users
   */
  async inviteUsers(invitations: Array<{ email: string; role: UserRole; businessUnitId?: string; message?: string }>, options: { expiresIn?: number; sendEmail?: boolean; templateId?: string } = {}, currentUserId?: string, currentUserEmail?: string) {
    try {
      if (!invitations || invitations.length === 0) {
        throw new AppError('At least one invitation is required', 400);
      }

      const results: any[] = [];
      let successCount = 0;
      let failedCount = 0;
      let duplicateCount = 0;

      for (const invitationData of invitations) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: invitationData.email },
          });

          if (existingUser) {
            duplicateCount++;
            results.push({ email: invitationData.email, status: 'duplicate', message: 'User already exists' });
            continue;
          }

          const existingInvitation = await (prisma as any).invitation.findFirst({
            where: {
              email: invitationData.email,
              status: { in: ['pending', 'sent'] },
            },
          });

          if (existingInvitation) {
            duplicateCount++;
            results.push({ email: invitationData.email, status: 'duplicate', message: 'Invitation already exists' });
            continue;
          }

          const token = generateInvitationToken();
          const expiresAt = options.expiresIn && options.expiresIn > 0
            ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
            : null;

          const invitation = await (prisma as any).invitation.create({
            data: {
              email: invitationData.email.toLowerCase(),
              role: invitationData.role,
              businessUnitId: invitationData.businessUnitId,
              message: invitationData.message,
              expiresIn: options.expiresIn || 7,
              status: 'sent',
              sentAt: new Date(),
              expiresAt,
              invitationToken: token,
              invitedBy: currentUserEmail || 'Unknown',
              invitedById: currentUserId,
            },
          });

          successCount++;
          results.push({ id: invitation.id, email: invitationData.email, status: 'sent', invitation });
        } catch (error: any) {
          failedCount++;
          results.push({ email: invitationData.email, status: 'failed', error: error?.message || 'Failed to create invitation' });
        }
      }

      return {
        total: invitations.length,
        successCount,
        failedCount,
        duplicateCount,
        invalidCount: 0,
        results,
        duration: 0,
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.inviteUsers');
    }
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: string, currentUserId?: string) {
    try {
      const invitation = await (prisma as any).invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }

      if (invitation.status === 'accepted') {
        throw new AppError('Invitation has already been accepted', 400);
      }

      if (invitation.status === 'cancelled') {
        throw new AppError('Invitation has been cancelled', 400);
      }

      const updatedInvitation = await (prisma as any).invitation.update({
        where: { id: invitationId },
        data: {
          status: 'sent',
          sentAt: new Date(),
          reminderCount: { increment: 1 },
          reminderSent: true,
          reminderSentAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: currentUserId || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, reminderCount: updatedInvitation.reminderCount },
          severity: AuditSeverity.INFO,
        },
      });

      return updatedInvitation;
    } catch (error) {
      return handleError(error, 'UserInvitationService.resendInvitation');
    }
  }

  /**
   * Resend multiple invitations
   */
  async resendInvitations(invitationIds: string[], currentUserId?: string) {
    try {
      if (!invitationIds || invitationIds.length === 0) {
        throw new AppError('At least one invitation ID is required', 400);
      }

      const results: any[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (const id of invitationIds) {
        try {
          const invitation = await (prisma as any).invitation.findUnique({ where: { id } });

          if (!invitation) {
            failedCount++;
            results.push({ id, status: 'failed', error: 'Invitation not found' });
            continue;
          }

          if (invitation.status === 'accepted') {
            failedCount++;
            results.push({ id, status: 'failed', error: 'Invitation has already been accepted' });
            continue;
          }

          if (invitation.status === 'cancelled') {
            failedCount++;
            results.push({ id, status: 'failed', error: 'Invitation has been cancelled' });
            continue;
          }

          const updatedInvitation = await (prisma as any).invitation.update({
            where: { id },
            data: {
              status: 'sent',
              sentAt: new Date(),
              reminderCount: { increment: 1 },
              reminderSent: true,
              reminderSentAt: new Date(),
            },
          });

          successCount++;
          results.push({ id, status: 'success', invitation: updatedInvitation });
        } catch (error: any) {
          failedCount++;
          results.push({ id, status: 'failed', error: error?.message || 'Failed to resend invitation' });
        }
      }

      return {
        successCount,
        failedCount,
        results,
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.resendInvitations');
    }
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string, currentUserId?: string) {
    try {
      const invitation = await (prisma as any).invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }

      if (invitation.status === 'accepted') {
        throw new AppError('Invitation has already been accepted', 400);
      }

      const updatedInvitation = await (prisma as any).invitation.update({
        where: { id: invitationId },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: currentUserId || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, status: 'cancelled' },
          severity: AuditSeverity.INFO,
        },
      });

      return updatedInvitation;
    } catch (error) {
      return handleError(error, 'UserInvitationService.cancelInvitation');
    }
  }

  /**
   * Cancel multiple invitations
   */
  async cancelInvitations(invitationIds: string[], currentUserId?: string) {
    try {
      if (!invitationIds || invitationIds.length === 0) {
        throw new AppError('At least one invitation ID is required', 400);
      }

      const results: any[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (const id of invitationIds) {
        try {
          const invitation = await (prisma as any).invitation.findUnique({ where: { id } });

          if (!invitation) {
            failedCount++;
            results.push({ id, status: 'failed', error: 'Invitation not found' });
            continue;
          }

          if (invitation.status === 'accepted') {
            failedCount++;
            results.push({ id, status: 'failed', error: 'Invitation has already been accepted' });
            continue;
          }

          const updatedInvitation = await (prisma as any).invitation.update({
            where: { id },
            data: { status: 'cancelled', cancelledAt: new Date() },
          });

          successCount++;
          results.push({ id, status: 'success', invitation: updatedInvitation });
        } catch (error: any) {
          failedCount++;
          results.push({ id, status: 'failed', error: error?.message || 'Failed to cancel invitation' });
        }
      }

      return {
        successCount,
        failedCount,
        results,
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.cancelInvitations');
    }
  }

  /**
   * Delete invitation
   */
  async deleteInvitation(invitationId: string) {
    try {
      const invitation = await (prisma as any).invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }

      await (prisma as any).invitation.delete({ where: { id: invitationId } });

      return { message: 'Invitation deleted successfully' };
    } catch (error) {
      return handleError(error, 'UserInvitationService.deleteInvitation');
    }
  }

  /**
   * Delete multiple invitations
   */
  async deleteInvitations(invitationIds: string[]) {
    try {
      if (!invitationIds || invitationIds.length === 0) {
        throw new AppError('At least one invitation ID is required', 400);
      }

      const result = await (prisma as any).invitation.deleteMany({
        where: { id: { in: invitationIds } },
      });

      return {
        count: result.count,
        message: `${result.count} invitations deleted successfully`,
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.deleteInvitations');
    }
  }

  /**
   * Get invitations
   */
  async getInvitations(filters: InvitationFilter = {}) {
    try {
      const page = filters.page || 1;
      const limit = Math.min(200, Math.max(1, filters.limit || 20));
      const skip = (page - 1) * limit;

      const where: any = {};

      if (filters.search) {
        where.OR = [
          { email: { contains: filters.search, mode: 'insensitive' } },
          { invitedBy: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.role) where.role = filters.role;
      if (filters.status) where.status = filters.status;
      if (filters.invitedBy) where.invitedBy = filters.invitedBy;

      if (filters.dateFrom || filters.dateTo) {
        where.sentAt = {};
        if (filters.dateFrom) where.sentAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.sentAt.lte = new Date(filters.dateTo);
      }

      const validSortFields = ['sentAt', 'expiresAt', 'email', 'status'];
      const orderBy: any = validSortFields.includes(filters.sortBy || '')
        ? { [filters.sortBy!]: filters.sortOrder || 'desc' }
        : { sentAt: 'desc' };

      const [invitations, total] = await Promise.all([
        (prisma as any).invitation.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            invitedByUser: {
              select: { id: true, email: true, firstName: true, lastName: true },
            },
          },
        }),
        (prisma as any).invitation.count({ where }),
      ]);

      return {
        data: invitations,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.getInvitations');
    }
  }

  /**
   * Get invitation by ID
   */
  async getInvitationById(invitationId: string) {
    try {
      const invitation = await (prisma as any).invitation.findUnique({
        where: { id: invitationId },
        include: {
          invitedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }

      return invitation;
    } catch (error) {
      return handleError(error, 'UserInvitationService.getInvitationById');
    }
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string) {
    try {
      const invitation = await (prisma as any).invitation.findUnique({
        where: { invitationToken: token },
      });

      if (!invitation) {
        throw new AppError('Invalid invitation token', 404);
      }

      if (invitation.status === 'cancelled') {
        throw new AppError('Invitation has been cancelled', 400);
      }

      if (invitation.status === 'accepted') {
        throw new AppError('Invitation has already been accepted', 400);
      }

      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        throw new AppError('Invitation has expired', 400);
      }

      return invitation;
    } catch (error) {
      return handleError(error, 'UserInvitationService.getInvitationByToken');
    }
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userData: { firstName: string; lastName: string; password: string; phoneNumber?: string }) {
    try {
      const invitation = await (prisma as any).invitation.findUnique({
        where: { invitationToken: token },
      });

      if (!invitation) {
        throw new AppError('Invalid invitation token', 404);
      }

      if (invitation.status === 'cancelled') {
        throw new AppError('Invitation has been cancelled', 400);
      }

      if (invitation.status === 'accepted') {
        throw new AppError('Invitation has already been accepted', 400);
      }

      if (invitation.expiresAt && new Date() > invitation.expiresAt) {
        throw new AppError('Invitation has expired', 400);
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const user = await prisma.user.create({
        data: {
          email: invitation.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber,
          role: invitation.role,
          password: hashedPassword,
          isActive: true,
          clerkId: `invited_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        },
      });

      await (prisma as any).invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });

      if (invitation.businessUnitId) {
        await prisma.businessUnitUser.create({
          data: {
            userId: user.id,
            businessUnitId: invitation.businessUnitId,
            role: invitation.role,
            isActive: true,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: user.id,
          entityName: user.email,
          changes: { email: user.email, role: user.role },
          severity: AuditSeverity.INFO,
        },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.acceptInvitation');
    }
  }

  /**
   * Decline invitation
   */
  async declineInvitation(token: string) {
    try {
      const invitation = await (prisma as any).invitation.findUnique({
        where: { invitationToken: token },
      });

      if (!invitation) {
        throw new AppError('Invalid invitation token', 404);
      }

      await (prisma as any).invitation.update({
        where: { id: invitation.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });

      return { message: 'Invitation declined successfully' };
    } catch (error) {
      return handleError(error, 'UserInvitationService.declineInvitation');
    }
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats() {
    try {
      const [total, pending, sent, accepted, expired, cancelled, byRole] = await Promise.all([
        (prisma as any).invitation.count(),
        (prisma as any).invitation.count({ where: { status: 'pending' } }),
        (prisma as any).invitation.count({ where: { status: 'sent' } }),
        (prisma as any).invitation.count({ where: { status: 'accepted' } }),
        (prisma as any).invitation.count({ where: { status: 'expired' } }),
        (prisma as any).invitation.count({ where: { status: 'cancelled' } }),
        (prisma as any).invitation.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
      ]);

      return {
        total,
        pending,
        sent,
        accepted,
        expired,
        cancelled,
        acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
        averageResponseTime: 0,
        byRole: byRole.reduce((acc: Record<string, number>, item: any) => {
          acc[item.role] = item._count._all;
          return acc;
        }, {}),
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.getInvitationStats');
    }
  }

  /**
   * Get invitation templates
   */
  async getInvitationTemplates() {
    try {
      const templates = await (prisma as any).invitationTemplate.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return templates;
    } catch (error) {
      return handleError(error, 'UserInvitationService.getInvitationTemplates');
    }
  }

  /**
   * Create invitation template
   */
  async createInvitationTemplate(data: { name: string; subject: string; body: string; role?: UserRole; variables?: string[]; isDefault?: boolean }) {
    try {
      const template = await (prisma as any).invitationTemplate.create({
        data: {
          name: data.name,
          subject: data.subject,
          body: data.body,
          role: data.role,
          variables: data.variables || [],
          isDefault: data.isDefault || false,
        },
      });

      return template;
    } catch (error) {
      return handleError(error, 'UserInvitationService.createInvitationTemplate');
    }
  }

  /**
   * Update invitation template
   */
  async updateInvitationTemplate(templateId: string, data: { name?: string; subject?: string; body?: string; role?: UserRole; variables?: string[]; isDefault?: boolean }) {
    try {
      const template = await (prisma as any).invitationTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      const updatedTemplate = await (prisma as any).invitationTemplate.update({
        where: { id: templateId },
        data,
      });

      return updatedTemplate;
    } catch (error) {
      return handleError(error, 'UserInvitationService.updateInvitationTemplate');
    }
  }

  /**
   * Delete invitation template
   */
  async deleteInvitationTemplate(templateId: string) {
    try {
      const template = await (prisma as any).invitationTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      await (prisma as any).invitationTemplate.delete({ where: { id: templateId } });

      return { message: 'Template deleted successfully' };
    } catch (error) {
      return handleError(error, 'UserInvitationService.deleteInvitationTemplate');
    }
  }

  /**
   * Clear expired invitations
   */
  async clearExpiredInvitations() {
    try {
      const result = await (prisma as any).invitation.deleteMany({
        where: {
          status: 'expired',
          expiresAt: { lt: new Date() },
        },
      });

      return {
        cleared: result.count,
        message: `Cleared ${result.count} expired invitations`,
      };
    } catch (error) {
      return handleError(error, 'UserInvitationService.clearExpiredInvitations');
    }
  }

  /**
   * Export invitations
   */
  async exportInvitations(format: string = 'json') {
    try {
      const invitations = await (prisma as any).invitation.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          invitedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      if (format === 'json') {
        return {
          data: invitations,
          total: invitations.length,
          format: 'json',
        };
      }

      if (format === 'csv') {
        const headers = ['ID', 'Email', 'Role', 'Status', 'Sent At', 'Expires At', 'Invited By'];
        const rows = invitations.map((inv: any) => [
          inv.id,
          inv.email,
          inv.role,
          inv.status,
          inv.sentAt ? inv.sentAt.toISOString() : '',
          inv.expiresAt ? inv.expiresAt.toISOString() : '',
          inv.invitedBy || '',
        ]);

        return {
          data: [headers, ...rows],
          format: 'csv',
          total: invitations.length,
        };
      }

      throw new AppError('Invalid export format', 400);
    } catch (error) {
      return handleError(error, 'UserInvitationService.exportInvitations');
    }
  }

  /**
   * Get pending invitations count
   */
  async getPendingInvitationsCount() {
    try {
      const count = await (prisma as any).invitation.count({
        where: {
          status: 'pending',
        },
      });

      return { count };
    } catch (error) {
      return handleError(error, 'UserInvitationService.getPendingInvitationsCount');
    }
  }

  /**
   * Send invitation reminder
   */
  async sendInvitationReminder(invitationId: string, currentUserId?: string) {
    try {
      const invitation = await (prisma as any).invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }

      if (invitation.status === 'accepted') {
        throw new AppError('Invitation has already been accepted', 400);
      }

      if (invitation.status === 'cancelled') {
        throw new AppError('Invitation has been cancelled', 400);
      }

      const updatedInvitation = await (prisma as any).invitation.update({
        where: { id: invitationId },
        data: {
          reminderSent: true,
          reminderSentAt: new Date(),
          reminderCount: { increment: 1 },
        },
      });

      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: currentUserId || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, reminderSent: true, reminderCount: updatedInvitation.reminderCount },
          severity: AuditSeverity.INFO,
        },
      });

      return updatedInvitation;
    } catch (error) {
      return handleError(error, 'UserInvitationService.sendInvitationReminder');
    }
  }
}

// Export a singleton instance
export const userInvitationService = new UserInvitationService();
