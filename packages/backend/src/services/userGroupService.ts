// D:\Projects\Kalwanga\packages\backend\src\services\userGroupService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { UserRole, Prisma } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';

// ============================================
// TYPES
// ============================================

interface CreateGroupData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentGroupId?: string | null;
  permissions?: string[];
  members?: Array<{
    userId: string;
    role?: UserRole;
    isLead?: boolean;
  }>;
  metadata?: Record<string, any>;
  createdBy: string;
  createdById?: string;
}

interface UpdateGroupData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentGroupId?: string | null;
  permissions?: string[];
  isActive?: boolean;
  metadata?: Record<string, any>;
}

interface GroupFilter {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  parentGroupId?: string;
  createdBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// USER GROUP SERVICE
// ============================================

export class UserGroupService extends BaseService {
  /**
   * Get all groups with filtering
   */
  async getGroups(filters: GroupFilter = {}) {
    try {
      const page = filters.page || 1;
      const limit = Math.min(200, Math.max(1, filters.limit || 20));
      const skip = (page - 1) * limit;

      const where = this.buildWhereClause(filters);

      const validSortFields = ['createdAt', 'updatedAt', 'name'];
      const orderBy: any = validSortFields.includes(filters.sortBy || '')
        ? { [filters.sortBy!]: filters.sortOrder || 'desc' }
        : { createdAt: 'desc' };

      const [groups, total] = await Promise.all([
        this.prisma.userGroup.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isActive: true,
                  },
                },
              },
            },
            parentGroup: { select: { id: true, name: true } },
            childGroups: { select: { id: true, name: true } },
            _count: { select: { members: true, childGroups: true } },
          },
        }),
        this.prisma.userGroup.count({ where }),
      ]);

      return {
        data: groups,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserGroupService.getGroups');
    }
  }

  /**
   * Get group by ID
   */
  async getGroupById(id: string) {
    try {
      if (!id) {
        throw new AppError('Group ID is required', 400);
      }

      const group = await this.prisma.userGroup.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                  isActive: true,
                  permissions: true,
                },
              },
            },
          },
          parentGroup: { select: { id: true, name: true } },
          childGroups: {
            include: { _count: { select: { members: true } } },
          },
          _count: { select: { members: true, childGroups: true } },
        },
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      return group;
    } catch (error) {
      this.handleError(error, 'UserGroupService.getGroupById');
    }
  }

  /**
   * Create a new group
   */
  async createGroup(data: CreateGroupData) {
    try {
      if (!data.name) {
        throw new AppError('Group name is required', 400);
      }

      const existingGroup = await this.prisma.userGroup.findFirst({
        where: { name: data.name },
      });

      if (existingGroup) {
        throw new AppError('Group with this name already exists', 409);
      }

      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const newGroup = await tx.userGroup.create({
          data: {
            name: data.name,
            description: data.description,
            icon: data.icon,
            color: data.color,
            parentGroupId: data.parentGroupId,
            permissions: data.permissions || [],
            createdBy: data.createdBy,
            createdByUserId: data.createdById,
            metadata: data.metadata,
          },
        });

        if (data.members && data.members.length > 0) {
          // ✅ FIXED: Use userGroupMember (not groupMember)
          await tx.userGroupMember.createMany({
            data: data.members.map(member => ({
              groupId: newGroup.id,
              userId: member.userId,
              role: member.role || UserRole.USER,
              isLead: member.isLead || false,
            })),
          });
        }

        return newGroup;
      });
    } catch (error) {
      this.handleError(error, 'UserGroupService.createGroup');
    }
  }

  /**
   * Update group
   */
  async updateGroup(id: string, data: UpdateGroupData) {
    try {
      if (!id) {
        throw new AppError('Group ID is required', 400);
      }

      const group = await this.prisma.userGroup.findUnique({ where: { id } });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      if (data.name && data.name !== group.name) {
        const existingGroup = await this.prisma.userGroup.findFirst({
          where: { name: data.name },
        });

        if (existingGroup) {
          throw new AppError('Group with this name already exists', 409);
        }
      }

      return await this.prisma.userGroup.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.handleError(error, 'UserGroupService.updateGroup');
    }
  }

  /**
   * Delete group
   */
  async deleteGroup(id: string) {
    try {
      if (!id) {
        throw new AppError('Group ID is required', 400);
      }

      const group = await this.prisma.userGroup.findUnique({ 
        where: { id },
        include: { childGroups: true },
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      // Check if group has child groups
      if (group.childGroups && group.childGroups.length > 0) {
        throw new AppError('Cannot delete group with child groups. Delete child groups first.', 400);
      }

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // ✅ FIXED: Use userGroupMember (not groupMember)
        await tx.userGroupMember.deleteMany({ where: { groupId: id } });
        // Delete the group
        await tx.userGroup.delete({ where: { id } });
      });

      return { message: 'Group deleted successfully' };
    } catch (error) {
      this.handleError(error, 'UserGroupService.deleteGroup');
    }
  }

  /**
   * Assign users to group
   */
  async assignUsersToGroup(groupId: string, userIds: string[], role: UserRole = UserRole.USER, isLead: boolean = false) {
    try {
      if (!groupId) {
        throw new AppError('Group ID is required', 400);
      }
      if (!userIds || userIds.length === 0) {
        throw new AppError('At least one user ID is required', 400);
      }

      const group = await this.prisma.userGroup.findUnique({ where: { id: groupId } });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      const assignedUsers: string[] = [];
      const skippedUsers: string[] = [];

      for (const userId of userIds) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
          skippedUsers.push(userId);
          continue;
        }

        // ✅ FIXED: Use userGroupMember (not groupMember)
        const existingMember = await this.prisma.userGroupMember.findFirst({
          where: { groupId, userId },
        });

        if (existingMember) {
          skippedUsers.push(userId);
          continue;
        }

        // ✅ FIXED: Use userGroupMember (not groupMember)
        await this.prisma.userGroupMember.create({
          data: { groupId, userId, role, isLead },
        });

        assignedUsers.push(userId);
      }

      return {
        groupId,
        assignedCount: assignedUsers.length,
        skippedCount: skippedUsers.length,
        assignedUsers,
        skippedUsers,
      };
    } catch (error) {
      this.handleError(error, 'UserGroupService.assignUsersToGroup');
    }
  }

  /**
   * Remove users from group
   */
  async removeUsersFromGroup(groupId: string, userIds: string[]) {
    try {
      if (!groupId) {
        throw new AppError('Group ID is required', 400);
      }
      if (!userIds || userIds.length === 0) {
        throw new AppError('At least one user ID is required', 400);
      }

      const removedUsers: string[] = [];
      const skippedUsers: string[] = [];

      for (const userId of userIds) {
        // ✅ FIXED: Use userGroupMember (not groupMember)
        const existingMember = await this.prisma.userGroupMember.findFirst({
          where: { groupId, userId },
        });

        if (!existingMember) {
          skippedUsers.push(userId);
          continue;
        }

        // ✅ FIXED: Use userGroupMember (not groupMember)
        await this.prisma.userGroupMember.delete({ where: { id: existingMember.id } });
        removedUsers.push(userId);
      }

      return {
        groupId,
        removedCount: removedUsers.length,
        skippedCount: skippedUsers.length,
        removedUsers,
        skippedUsers,
      };
    } catch (error) {
      this.handleError(error, 'UserGroupService.removeUsersFromGroup');
    }
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string, filters: { page?: number; limit?: number; role?: string; search?: string } = {}) {
    try {
      if (!groupId) {
        throw new AppError('Group ID is required', 400);
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      // ✅ FIXED: Use UserGroupMemberWhereInput (not GroupMemberWhereInput)
      const where: Prisma.UserGroupMemberWhereInput = { groupId };

      if (filters.role) {
        where.role = filters.role as UserRole;
      }

      if (filters.search) {
        where.user = {
          OR: [
            { firstName: { contains: filters.search, mode: 'insensitive' } },
            { lastName: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
          ],
        };
      }

      const [members, total] = await Promise.all([
        // ✅ FIXED: Use userGroupMember (not groupMember)
        this.prisma.userGroupMember.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                permissions: true,
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
        }),
        // ✅ FIXED: Use userGroupMember (not groupMember)
        this.prisma.userGroupMember.count({ where }),
      ]);

      return {
        data: members,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserGroupService.getGroupMembers');
    }
  }

  /**
   * Update group permissions
   */
  async updateGroupPermissions(groupId: string, permissions: string[]) {
    try {
      if (!groupId) {
        throw new AppError('Group ID is required', 400);
      }
      if (!permissions || permissions.length === 0) {
        throw new AppError('At least one permission is required', 400);
      }

      return await this.prisma.userGroup.update({
        where: { id: groupId },
        data: { 
          permissions, 
          updatedAt: new Date() 
        },
      });
    } catch (error) {
      this.handleError(error, 'UserGroupService.updateGroupPermissions');
    }
  }

  /**
   * Get group statistics
   */
  async getGroupStats() {
    try {
      const [totalGroups, totalMembers, activeGroups, inactiveGroups, byRole] = await Promise.all([
        this.prisma.userGroup.count(),
        // ✅ FIXED: Use userGroupMember (not groupMember)
        this.prisma.userGroupMember.count(),
        this.prisma.userGroup.count({ where: { isActive: true } }),
        this.prisma.userGroup.count({ where: { isActive: false } }),
        // ✅ FIXED: Use userGroupMember (not groupMember)
        this.prisma.userGroupMember.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
      ]);

      const byRoleMap: Record<string, number> = {};
      byRole.forEach((item: { role: UserRole; _count: { _all: number } }) => {
        byRoleMap[item.role] = item._count._all;
      });

      return {
        totalGroups,
        totalMembers,
        activeGroups,
        inactiveGroups,
        averageMembersPerGroup: totalGroups > 0 ? Math.round(totalMembers / totalGroups) : 0,
        byRole: byRoleMap,
      };
    } catch (error) {
      this.handleError(error, 'UserGroupService.getGroupStats');
    }
  }

  /**
   * Build where clause for filtering
   */
  private buildWhereClause(filters: GroupFilter): Prisma.UserGroupWhereInput {
    const where: Prisma.UserGroupWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.parentGroupId) {
      where.parentGroupId = filters.parentGroupId;
    }

    if (filters.createdBy) {
      where.createdBy = filters.createdBy;
    }

    return where;
  }
}

export const userGroupService = new UserGroupService();
