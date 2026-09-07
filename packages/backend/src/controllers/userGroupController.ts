// D:\Projects\Kalwanga\packages\backend\src\controllers\userGroupController.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { UserRole } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentGroupId: z.string().optional().nullable(),
  permissions: z.array(z.string()).optional(),
  members: z.array(z.object({
    userId: z.string(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
    isLead: z.boolean().optional(),
  })).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  parentGroupId: z.string().optional().nullable(),
  permissions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const getGroupsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  isActive: z.string().optional(),
  role: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const assignUsersToGroupSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user ID is required'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional().default('USER'),
  isLead: z.boolean().optional().default(false),
  sendNotification: z.boolean().optional().default(false),
});

const removeUsersFromGroupSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user ID is required'),
});

const updateGroupPermissionsSchema = z.object({
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function handleValidationError(error: z.ZodError, res: Response) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map((err: z.ZodIssue) => ({
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
    logger.error('UserGroupController error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
  
  next(error);
}

function sanitizeUser(user: any) {
  if (!user) return null;
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function sanitizeUsers(users: any[]) {
  return users.map((user: any) => sanitizeUser(user));
}

// ============================================
// USER GROUP CONTROLLER
// ============================================

export const userGroupController = {
  /**
   * GET /user-groups
   * Get all groups (users with @group.local email)
   */
  async getGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const params = getGroupsSchema.parse(req.query);
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);
      const skip = (page - 1) * limit;
      
      const where: any = {
        email: { endsWith: '@group.local' },
      };
      
      if (params.search) {
        where.OR = [
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { email: { contains: params.search, mode: 'insensitive' } },
        ];
      }
      
      if (params.isActive !== undefined) where.isActive = params.isActive === 'true';
      if (params.role) where.role = params.role;
      
      const validSortFields = ['createdAt', 'updatedAt', 'firstName', 'email', 'role'];
      const orderBy: any = validSortFields.includes(params.sortBy)
        ? { [params.sortBy]: params.sortOrder }
        : { createdAt: 'desc' };
      
      const [groups, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            businessUnits: {
              include: {
                businessUnit: true,
              },
            },
            company: true,
          },
        }),
        prisma.user.count({ where }),
      ]);
      
      return res.json({
        success: true,
        data: sanitizeUsers(groups),
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
   * GET /user-groups/:id
   * Get group by ID
   */
  async getGroupById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const group = await prisma.user.findUnique({
        where: { id },
        include: {
          businessUnits: {
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });
      
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }
      
      return res.json({
        success: true,
        data: sanitizeUser(group),
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /user-groups/by-name/:name
   * Get group by name
   */
  async getGroupByName(req: Request, res: Response, next: NextFunction) {
    try {
      const { name } = req.params;
      
      const group = await prisma.user.findFirst({
        where: {
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@group.local`,
        },
        include: {
          businessUnits: {
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });
      
      if (!group) {
        throw new AppError('Group not found', 404);
      }
      
      return res.json({
        success: true,
        data: sanitizeUser(group),
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /user-groups
   * Create a new group (user with @group.local email)
   */
  async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createGroupSchema.parse(req.body);
      
      const groupEmail = `${data.name.toLowerCase().replace(/\s+/g, '.')}@group.local`;
      
      const existingGroup = await prisma.user.findFirst({
        where: { email: groupEmail },
      });
      
      if (existingGroup) {
        throw new AppError('Group with this name already exists', 409);
      }
      
      const group = await prisma.user.create({
        data: {
          email: groupEmail,
          firstName: data.name,
          lastName: '(Group)',
          role: UserRole.USER,
          password: 'GroupPlaceholder123!',
          isActive: true,
          permissions: data.permissions || [],
          clerkId: `group_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        },
      });
      
      await prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'USER_GROUP',
          entityId: group.id,
          userId: (req as any).user?.id || group.id,
          entityName: group.firstName,
          changes: { name: group.firstName, description: data.description },
          severity: 'INFO',
        },
      });
      
      return res.status(201).json({
        success: true,
        data: sanitizeUser(group),
        message: 'Group created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * PUT /user-groups/:id
   * Update group
   */
  async updateGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateGroupSchema.parse(req.body);
      
      const group = await prisma.user.findUnique({ where: { id } });
      
      if (!group) {
        throw new AppError('Group not found', 404);
      }
      
      const updateData: any = {};
      if (data.name) {
        updateData.firstName = data.name;
        updateData.email = `${data.name.toLowerCase().replace(/\s+/g, '.')}@group.local`;
      }
      if (data.permissions) updateData.permissions = data.permissions;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      
      const updatedGroup = await prisma.user.update({
        where: { id },
        data: updateData,
      });
      
      return res.json({
        success: true,
        data: sanitizeUser(updatedGroup),
        message: 'Group updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * DELETE /user-groups/:id
   * Delete group
   */
  async deleteGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const group = await prisma.user.findUnique({ where: { id } });
      
      if (!group) {
        throw new AppError('Group not found', 404);
      }
      
      await prisma.user.delete({ where: { id } });
      
      return res.json({
        success: true,
        message: 'Group deleted successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /user-groups/:id/users
   * Assign users to group (merge permissions)
   */
  async assignUsersToGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = assignUsersToGroupSchema.parse(req.body);
      
      const group = await prisma.user.findUnique({ where: { id } });
      
      if (!group) {
        throw new AppError('Group not found', 404);
      }
      
      const assignedUsers: string[] = [];
      const skippedUsers: string[] = [];
      const groupPermissions = group.permissions || [];
      
      for (const userId of data.userIds) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        if (!user) {
          skippedUsers.push(userId);
          continue;
        }
        
        const mergedPermissions = [...new Set([...(user.permissions || []), ...groupPermissions])];
        
        await prisma.user.update({
          where: { id: userId },
          data: { permissions: mergedPermissions },
        });
        
        assignedUsers.push(userId);
      }
      
      return res.json({
        success: true,
        data: {
          groupId: id,
          assignedCount: assignedUsers.length,
          skippedCount: skippedUsers.length,
          assignedUsers,
          skippedUsers,
        },
        message: `Assigned ${assignedUsers.length} users successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /user-groups/:id/remove-users
   * Remove users from group (remove group permissions)
   */
  async removeUsersFromGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = removeUsersFromGroupSchema.parse(req.body);
      
      const group = await prisma.user.findUnique({ where: { id } });
      
      if (!group) {
        throw new AppError('Group not found', 404);
      }
      
      const removedUsers: string[] = [];
      const skippedUsers: string[] = [];
      const groupPermissions = group.permissions || [];
      
      for (const userId of data.userIds) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        if (!user) {
          skippedUsers.push(userId);
          continue;
        }
        
        const filteredPermissions = (user.permissions || []).filter((p: string) => !groupPermissions.includes(p));
        
        await prisma.user.update({
          where: { id: userId },
          data: { permissions: filteredPermissions },
        });
        
        removedUsers.push(userId);
      }
      
      return res.json({
        success: true,
        data: {
          groupId: id,
          removedCount: removedUsers.length,
          skippedCount: skippedUsers.length,
          removedUsers,
          skippedUsers,
        },
        message: `Removed ${removedUsers.length} users successfully`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * GET /user-groups/:id/members
   * Get group members (users with group permissions)
   */
  async getGroupMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page = '1', limit = '20', search, role } = req.query;
      
      const group = await prisma.user.findUnique({ where: { id } });
      
      if (!group) {
        throw new AppError('Group not found', 404);
      }
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;
      
      const groupPermissions = group.permissions || [];
      
      const where: any = {
        permissions: { hasSome: groupPermissions },
      };
      
      if (role) {
        where.role = role as UserRole;
      }
      
      if (search) {
        where.OR = [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }
      
      const [members, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limitNum,
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            permissions: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);
      
      return res.json({
        success: true,
        data: members,
        pagination: {
          total,
          page: pageNum,
          totalPages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * PUT /user-groups/:id/permissions
   * Update group permissions
   */
  async updateGroupPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateGroupPermissionsSchema.parse(req.body);
      
      const group = await prisma.user.findUnique({ where: { id } });
      
      if (!group) {
        throw new AppError('Group not found', 404);
      }
      
      const updatedGroup = await prisma.user.update({
        where: { id },
        data: { permissions: data.permissions },
      });
      
      return res.json({
        success: true,
        data: {
          groupId: id,
          permissions: updatedGroup.permissions,
          updatedAt: updatedGroup.updatedAt,
        },
        message: 'Group permissions updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * GET /user-groups/stats
   * Get group statistics
   */
  async getGroupStats(req: Request, res: Response, next: NextFunction) {
    try {
      const [totalGroups, totalMembers, activeGroups, inactiveGroups, byRole] = await Promise.all([
        prisma.user.count({ where: { email: { endsWith: '@group.local' } } }),
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true, email: { endsWith: '@group.local' } } }),
        prisma.user.count({ where: { isActive: false, email: { endsWith: '@group.local' } } }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
      ]);
      
      return res.json({
        success: true,
        data: {
          totalGroups,
          totalMembers,
          activeGroups,
          inactiveGroups,
          averageMembersPerGroup: totalGroups > 0 ? totalMembers / totalGroups : 0,
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
};

export default userGroupController;
