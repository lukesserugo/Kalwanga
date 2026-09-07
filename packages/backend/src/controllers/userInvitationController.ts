// D:\Projects\Kalwanga\packages\backend\src\controllers\userInvitationController.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
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

type AuditActionType = typeof AuditAction[keyof typeof AuditAction];
type AuditSeverityType = typeof AuditSeverity[keyof typeof AuditSeverity];

// ============================================
// VALIDATION SCHEMAS
// ============================================

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']),
  businessUnitId: z.string().optional(),
  message: z.string().optional(),
  expiresIn: z.number().int().min(0).max(365).optional().default(7),
  sendEmail: z.boolean().optional().default(true),
  templateId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const inviteUsersSchema = z.object({
  invitations: z.array(z.object({
    email: z.string().email('Invalid email address'),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']),
    businessUnitId: z.string().optional(),
    message: z.string().optional(),
  })).min(1, 'At least one invitation is required'),
  expiresIn: z.number().int().min(0).max(365).optional().default(7),
  sendEmail: z.boolean().optional().default(true),
  templateId: z.string().optional(),
});

const getInvitationsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  invitedBy: z.string().optional(),
  sortBy: z.string().optional().default('sentAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const acceptInvitationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phoneNumber: z.string().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
  variables: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
  variables: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateInvitationLink(token: string): string {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/invite/${token}`;
}

function handleValidationError(error: z.ZodError, res: Response) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
    })),
  });
}

function handleError(error: any, res: Response, next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message,
    });
  }
  
  if (error instanceof Error) {
    logger.error('UserInvitationController error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
  
  next(error);
}

// ============================================
// USER INVITATION CONTROLLER
// ============================================

export const userInvitationController = {
  /**
   * POST /users/invite
   * Invite a single user
   */
  async inviteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = inviteUserSchema.parse(req.body);
      
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });
      
      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }
      
      // Use any for Prisma client access since TypeScript doesn't recognize the model
      const existingInvitation = await (prisma as any).invitation.findFirst({
        where: {
          email: data.email,
          status: { in: ['pending', 'sent'] },
        },
      });
      
      if (existingInvitation) {
        return res.status(200).json({
          success: true,
          data: {
            id: existingInvitation.id,
            email: existingInvitation.email,
            status: 'duplicate',
            message: 'Invitation already exists for this email',
            invitation: existingInvitation,
          },
        });
      }
      
      const token = generateInvitationToken();
      const expiresAt = data.expiresIn > 0 
        ? new Date(Date.now() + data.expiresIn * 24 * 60 * 60 * 1000)
        : null;
      
      const invitation = await (prisma as any).invitation.create({
        data: {
          email: data.email.toLowerCase(),
          role: data.role,
          businessUnitId: data.businessUnitId,
          message: data.message,
          expiresIn: data.expiresIn,
          status: 'sent',
          sentAt: new Date(),
          expiresAt,
          invitationToken: token,
          invitedBy: (req as any).user?.email || 'Unknown',
          invitedById: (req as any).user?.id,
          metadata: data.metadata,
        },
      });
      
      await prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: (req as any).user?.id || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, role: invitation.role, invitedBy: invitation.invitedBy },
          severity: AuditSeverity.INFO,
        },
      });
      
      logger.info(`Invitation created for ${data.email}`);
      
      return res.status(201).json({
        success: true,
        data: { id: invitation.id, email: invitation.email, status: 'sent', invitation },
        message: 'Invitation sent successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/invite/batch
   * Invite multiple users
   */
  async inviteUsers(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    try {
      const data = inviteUsersSchema.parse(req.body);
      
      const results: any[] = [];
      let successCount = 0;
      let failedCount = 0;
      let duplicateCount = 0;
      
      for (const invitationData of data.invitations) {
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
          const expiresAt = data.expiresIn > 0 
            ? new Date(Date.now() + data.expiresIn * 24 * 60 * 60 * 1000)
            : null;
          
          const invitation = await (prisma as any).invitation.create({
            data: {
              email: invitationData.email.toLowerCase(),
              role: invitationData.role,
              businessUnitId: invitationData.businessUnitId,
              message: invitationData.message,
              expiresIn: data.expiresIn,
              status: 'sent',
              sentAt: new Date(),
              expiresAt,
              invitationToken: token,
              invitedBy: (req as any).user?.email || 'Unknown',
              invitedById: (req as any).user?.id,
            },
          });
          
          successCount++;
          results.push({ id: invitation.id, email: invitationData.email, status: 'sent', invitation });
        } catch (error: any) {
          failedCount++;
          results.push({ email: invitationData.email, status: 'failed', error: error?.message || 'Failed to create invitation' });
        }
      }
      
      return res.status(201).json({
        success: true,
        data: {
          total: data.invitations.length,
          successCount,
          failedCount,
          duplicateCount,
          invalidCount: 0,
          results,
          duration: Date.now() - startTime,
        },
        message: `Sent ${successCount} invitations successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/invite/:id/resend
   * Resend invitation
   */
  async resendInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const invitation = await (prisma as any).invitation.findUnique({ where: { id } });
      
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
        where: { id },
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
          userId: (req as any).user?.id || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, reminderCount: updatedInvitation.reminderCount },
          severity: AuditSeverity.INFO,
        },
      });
      
      logger.info(`Invitation resent to ${invitation.email}`);
      
      return res.json({
        success: true,
        data: updatedInvitation,
        message: 'Invitation resent successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/invite/:id/cancel
   * Cancel invitation
   */
  async cancelInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const invitation = await (prisma as any).invitation.findUnique({ where: { id } });
      
      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }
      
      if (invitation.status === 'accepted') {
        throw new AppError('Invitation has already been accepted', 400);
      }
      
      const updatedInvitation = await (prisma as any).invitation.update({
        where: { id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
      
      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: (req as any).user?.id || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, status: 'cancelled' },
          severity: AuditSeverity.INFO,
        },
      });
      
      logger.info(`Invitation cancelled for ${invitation.email}`);
      
      return res.json({
        success: true,
        data: updatedInvitation,
        message: 'Invitation cancelled successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * DELETE /users/invite/:id
   * Delete invitation
   */
  async deleteInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const invitation = await (prisma as any).invitation.findUnique({ where: { id } });
      
      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }
      
      await (prisma as any).invitation.delete({ where: { id } });
      
      logger.info(`Invitation deleted for ${invitation.email}`);
      
      return res.json({
        success: true,
        message: 'Invitation deleted successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/invitations
   * Get all invitations
   */
  async getInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const params = getInvitationsSchema.parse(req.query);
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);
      const skip = (page - 1) * limit;
      
      const where: any = {};
      
      if (params.search) {
        where.OR = [
          { email: { contains: params.search, mode: 'insensitive' } },
          { invitedBy: { contains: params.search, mode: 'insensitive' } },
        ];
      }
      
      if (params.role) where.role = params.role;
      if (params.status) where.status = params.status;
      if (params.invitedBy) where.invitedBy = params.invitedBy;
      
      if (params.dateFrom || params.dateTo) {
        where.sentAt = {};
        if (params.dateFrom) where.sentAt.gte = new Date(params.dateFrom);
        if (params.dateTo) where.sentAt.lte = new Date(params.dateTo);
      }
      
      const validSortFields = ['sentAt', 'expiresAt', 'email', 'status'];
      const orderBy: any = validSortFields.includes(params.sortBy)
        ? { [params.sortBy]: params.sortOrder }
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
      
      return res.json({
        success: true,
        data: invitations,
        pagination: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          limit,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/invite/:id
   * Get invitation by ID
   */
  async getInvitationById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const invitation = await (prisma as any).invitation.findUnique({
        where: { id },
        include: {
          invitedByUser: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });
      
      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }
      
      return res.json({
        success: true,
        data: invitation,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/invite/token/:token
   * Get invitation by token (public endpoint)
   */
  async getInvitationByToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      
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
      
      return res.json({
        success: true,
        data: {
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          status: invitation.status,
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/invite/accept/:token
   * Accept invitation (public endpoint)
   */
  async acceptInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const data = acceptInvitationSchema.parse(req.body);
      
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
      
      const hashedPassword = await bcrypt.hash(data.password, 10);
      
      const user = await prisma.user.create({
        data: {
          email: invitation.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phoneNumber: data.phoneNumber,
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
      
      logger.info(`Invitation accepted by ${user.email}`);
      
      return res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        message: 'Invitation accepted successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/invite/decline/:token
   * Decline invitation (public endpoint)
   */
  async declineInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      
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
      
      return res.json({
        success: true,
        message: 'Invitation declined successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/invitations/stats
   * Get invitation statistics
   */
  async getInvitationStats(req: Request, res: Response, next: NextFunction) {
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
      
      return res.json({
        success: true,
        data: {
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
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /users/invite/templates
   * Get invitation templates
   */
  async getInvitationTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await (prisma as any).invitationTemplate.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      return res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /users/invite/templates
   * Create invitation template
   */
  async createInvitationTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createTemplateSchema.parse(req.body);
      
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
      
      return res.status(201).json({
        success: true,
        data: template,
        message: 'Template created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * PUT /users/invite/templates/:id
   * Update invitation template
   */
  async updateInvitationTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateTemplateSchema.parse(req.body);
      
      const template = await (prisma as any).invitationTemplate.findUnique({ where: { id } });
      
      if (!template) {
        throw new AppError('Template not found', 404);
      }
      
      const updatedTemplate = await (prisma as any).invitationTemplate.update({
        where: { id },
        data,
      });
      
      return res.json({
        success: true,
        data: updatedTemplate,
        message: 'Template updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * DELETE /users/invite/templates/:id
   * Delete invitation template
   */
  async deleteInvitationTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const template = await (prisma as any).invitationTemplate.findUnique({ where: { id } });
      
      if (!template) {
        throw new AppError('Template not found', 404);
      }
      
      await (prisma as any).invitationTemplate.delete({ where: { id } });
      
      return res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * DELETE /users/invitations/expired
   * Clear expired invitations
   */
  async clearExpiredInvitations(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await (prisma as any).invitation.deleteMany({
        where: {
          status: 'expired',
          expiresAt: { lt: new Date() },
        },
      });
      
      return res.json({
        success: true,
        message: `Cleared ${result.count} expired invitations`,
        cleared: result.count,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },
};
