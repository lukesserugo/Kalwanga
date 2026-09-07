// D:\Projects\Kalwanga\packages\backend\src\services\userService.ts

import { AppError } from '../middleware/errorHandler.js';
import { Prisma, UserRole } from '../generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import { logger } from '../lib/logger.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Import ALL_PERMISSIONS from auth
import { ALL_PERMISSIONS } from '..///middleware/auth.js';

// ============================================
// ENHANCED TYPES
// ============================================

interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  password: string;
  businessUnitId?: string | null;
  clerkId?: string;
  companyId?: string;
  avatar?: string;
  permissions?: string[];
}

interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  role?: UserRole;
  isActive?: boolean;
  password?: string;
  companyId?: string;
  avatar?: string;
  permissions?: string[];
  lastLoginAt?: Date;
  businessUnitId?: string | null;
}

interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  role: UserRole;
  isActive: boolean;
  clerkId?: string | null;
  companyId?: string | null;
  avatar?: string | null;
  permissions?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | null;
  fullName: string;
  businessUnits?: any[];
  company?: any;
  salesCount?: number;
  ordersCount?: number;
  purchaseOrderCount?: number;
}

interface ActivityFilter {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  ipAddress?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ImportOptions {
  skipDuplicates?: boolean;
  skipInvalid?: boolean;
  sendWelcomeEmail?: boolean;
  defaultPassword?: string;
  autoActivate?: boolean;
  batchSize?: number;
}

interface InvitationData {
  email: string;
  role: UserRole;
  businessUnitId?: string;
  message?: string;
  expiresIn?: number;
  sendEmail?: boolean;
  templateId?: string;
  metadata?: Record<string, any>;
}

interface CreateGroupData {
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
  metadata?: Record<string, any>;
}

interface UpdateGroupData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  permissions?: string[];
  isActive?: boolean;
  metadata?: Record<string, any>;
}

interface GroupFilter {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  role?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// CONSTANTS
// ============================================

const REQUIRED_HEADERS = ['email', 'firstName', 'lastName', 'role'];
const OPTIONAL_HEADERS = ['phoneNumber', 'businessUnitId', 'isActive', 'permissions', 'companyId', 'avatar', 'password'];

const ROLE_MAPPING: Record<string, UserRole> = {
  'SUPER_ADMIN': UserRole.SUPER_ADMIN,
  'ADMIN': UserRole.ADMIN,
  'MANAGER': UserRole.MANAGER,
  'EDITOR': UserRole.EDITOR,
  'VIEWER': UserRole.VIEWER,
  'EMPLOYEE': UserRole.EMPLOYEE,
  'CASHIER': UserRole.CASHIER,
  'USER': UserRole.USER,
  'super_admin': UserRole.SUPER_ADMIN,
  'admin': UserRole.ADMIN,
  'manager': UserRole.MANAGER,
  'editor': UserRole.EDITOR,
  'viewer': UserRole.VIEWER,
  'employee': UserRole.EMPLOYEE,
  'cashier': UserRole.CASHIER,
  'user': UserRole.USER,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDefaultPermissionsForRole(role: UserRole): string[] {
  const permissionsMap: Record<UserRole, string[]> = {
    [UserRole.SUPER_ADMIN]: ALL_PERMISSIONS || [],
    [UserRole.ADMIN]: [
      'user:view', 'user:create', 'user:edit', 'user:delete',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
      'inventory:view_low_stock', 'inventory:view_reports',
      'product:view', 'product:create', 'product:edit', 'product:delete',
      'category:view', 'category:create', 'category:edit', 'category:delete',
      'report:view', 'report:create', 'report:export',
      'settings:view', 'settings:edit',
    ],
    [UserRole.MANAGER]: [
      'user:view',
      'inventory:view', 'inventory:create', 'inventory:edit',
      'inventory:view_low_stock', 'inventory:view_reports',
      'product:view', 'product:create', 'product:edit',
      'category:view', 'category:create', 'category:edit',
      'report:view', 'report:create',
    ],
    [UserRole.EDITOR]: [
      'inventory:view', 'inventory:create', 'inventory:edit',
      'inventory:view_low_stock',
      'product:view', 'product:create', 'product:edit',
      'category:view', 'category:create', 'category:edit',
      'report:view',
    ],
    [UserRole.VIEWER]: [
      'inventory:view',
      'inventory:view_low_stock',
      'product:view',
      'category:view',
      'report:view',
    ],
    [UserRole.EMPLOYEE]: [
      'inventory:view',
      'inventory:view_low_stock',
      'product:view',
    ],
    [UserRole.CASHIER]: [
      'inventory:view',
      'product:view',
    ],
    [UserRole.USER]: [
      'inventory:view',
    ],
  };
  return permissionsMap[role] || [];
}

async function getOrCreateDefaultBusinessUnit(prisma: any, companyId?: string) {
  try {
    if (!companyId) {
      const firstCompany = await prisma.company.findFirst();
      if (!firstCompany) {
        logger.error('⚠️ No company found in database. Cannot create business unit.');
        return null;
      }
      companyId = firstCompany.id;
      logger.info('✅ Using existing company:', companyId);
    }

    let businessUnit = await prisma.businessUnit.findFirst({
      where: {
        name: 'Default Business Unit',
        companyId: companyId,
      },
    });

    if (!businessUnit) {
      businessUnit = await prisma.businessUnit.create({
        data: {
          name: 'Default Business Unit',
          code: 'DEFAULT',
          isActive: true,
          companyId: companyId,
        },
      });
      logger.info('Created default business unit:', businessUnit.id);
    }

    return businessUnit;
  } catch (error) {
    logger.error('Failed to get/create default business unit:', error);
    return null;
  }
}

function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateInvitationLink(token: string): string {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${baseUrl}/invite/${token}`;
}

function parseCSVContentSimple(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else if (char === '\r') {
      // Skip carriage return
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(field => field !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function validateImportData(rows: string[][], headers: string[]) {
  const users: any[] = [];
  const errors: any[] = [];
  const warnings: any[] = [];
  const emailSet = new Set<string>();
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const userData: Record<string, any> = {};
    const rowErrors: string[] = [];
    const rowWarnings: string[] = [];
    
    headers.forEach((header, index) => {
      if (row[index] !== undefined) {
        userData[header] = row[index];
      }
    });
    
    const email = userData.email || '';
    if (!email) {
      rowErrors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push(`Invalid email format: ${email}`);
    } else if (emailSet.has(email.toLowerCase())) {
      rowErrors.push(`Duplicate email in file: ${email}`);
    }
    
    if (email && !emailSet.has(email.toLowerCase())) {
      emailSet.add(email.toLowerCase());
    }
    
    if (!userData.firstName) rowErrors.push('First name is required');
    if (!userData.lastName) rowErrors.push('Last name is required');
    
    const role = ROLE_MAPPING[userData.role] || null;
    if (!userData.role) {
      rowErrors.push('Role is required');
    } else if (!role) {
      rowErrors.push(`Invalid role: ${userData.role}`);
      rowWarnings.push(`Role "${userData.role}" not recognized, defaulting to USER`);
    }
    
    let status = 'valid';
    if (rowErrors.length > 0) {
      status = 'invalid';
    } else if (rowWarnings.length > 0) {
      status = 'warning';
    }
    
    const user = {
      id: `import_${i}_${Date.now()}`,
      email,
      firstName: userData.firstName || '',
      lastName: userData.lastName || '',
      phoneNumber: userData.phoneNumber,
      role: role || UserRole.USER,
      businessUnitId: userData.businessUnitId,
      isActive: userData.isActive ? userData.isActive.toLowerCase() === 'true' : true,
      password: userData.password,
      permissions: userData.permissions ? userData.permissions.split(';').map((p: string) => p.trim()) : [],
      companyId: userData.companyId,
      avatar: userData.avatar,
      status,
      errors: rowErrors,
      warnings: rowWarnings,
      originalData: userData,
      rowNumber: i + 2,
    };
    
    users.push(user);
    
    if (rowErrors.length > 0) {
      errors.push({ rowNumber: i + 2, email, errors: rowErrors });
    }
    if (rowWarnings.length > 0) {
      warnings.push({ rowNumber: i + 2, email, warnings: rowWarnings });
    }
  }
  
  return { users, errors, warnings };
}

// ============================================
// USER SERVICE CLASS
// ============================================

export class UserService {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Handle errors with logging
   */
  private handleError(error: any, context: string): never {
    logger.error(`[${context}] Error:`, error);
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new AppError(error.message, 500);
    }
    throw new AppError('An unexpected error occurred', 500);
  }

  /**
   * Get all users with comprehensive filtering
   */
  async getAllUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    businessUnitId?: string;
    companyId?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    hideSuperAdmin?: boolean;
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        role,
        businessUnitId,
        companyId,
        isActive,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        hideSuperAdmin = false,
      } = params;

      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(200, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: Prisma.UserWhereInput = {
        ...(role && { role }),
        ...(companyId && { companyId }),
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { phoneNumber: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
        ...(businessUnitId && {
          businessUnits: { some: { businessUnitId } },
        }),
        ...(hideSuperAdmin && {
          role: { not: 'SUPER_ADMIN' },
        }),
      };

      const validSortFields = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'role'];
      const orderBy: any = validSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { createdAt: 'desc' };

      const [users, total, stats] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy,
          include: {
            businessUnits: {
              where: { isActive: true },
              include: {
                businessUnit: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            company: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                businessUnits: true,
                sales: true,
                orders: true,
              },
            },
          },
        }),
        this.prisma.user.count({ where }),
        this.getUserStats(where),
      ]);

      const enhancedUsers = users.map((user: any) => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        businessUnitCount: user._count?.businessUnits || 0,
        salesCount: user._count?.sales || 0,
        ordersCount: user._count?.orders || 0,
      }));

      return {
        data: enhancedUsers,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
        stats,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getAllUsers');
    }
  }

  /**
   * Get user statistics
   */
  private async getUserStats(where: Prisma.UserWhereInput) {
    try {
      const [totalActive, totalInactive, byRole] = await Promise.all([
        this.prisma.user.count({ where: { ...where, isActive: true } }),
        this.prisma.user.count({ where: { ...where, isActive: false } }),
        this.prisma.user.groupBy({
          by: ['role'],
          where,
          _count: { _all: true },
        }),
      ]);

      return {
        totalActive,
        totalInactive,
        byRole: byRole.map((r: any) => ({
          role: r.role,
          count: r._count._all,
        })),
      };
    } catch (error) {
      logger.warn('Failed to get user stats:', error);
      return {
        totalActive: 0,
        totalInactive: 0,
        byRole: [],
      };
    }
  }

  /**
   * Get user by ID with full details
   */
  async getUserById(id: string): Promise<UserResponse> {
    try {
      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          businessUnits: {
            where: { isActive: true },
            include: {
              businessUnit: {
                include: {
                  company: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          company: true,
          _count: {
            select: {
              sales: true,
              orders: true,
              purchaseOrders: true,
            },
          },
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        salesCount: user._count?.sales || 0,
        ordersCount: user._count?.orders || 0,
        purchaseOrderCount: user._count?.purchaseOrders || 0,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUserById');
    }
  }

  /**
   * Get user by Clerk ID
   */
  async getUserByClerkId(clerkId: string) {
    try {
      if (!clerkId) {
        throw new AppError('Clerk ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({
        where: { clerkId },
        include: {
          businessUnits: {
            where: { isActive: true },
            include: {
              businessUnit: true,
            },
          },
          company: true,
          _count: {
            select: {
              sales: true,
              orders: true,
              purchaseOrders: true,
            },
          },
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        salesCount: user._count?.sales || 0,
        ordersCount: user._count?.orders || 0,
        purchaseOrderCount: user._count?.purchaseOrders || 0,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUserByClerkId');
    }
  }

  /**
   * Get user by identifier (Clerk ID or database ID)
   */
  async getUserByIdentifier(identifier: string) {
    try {
      if (!identifier) {
        throw new AppError('User identifier is required', 400);
      }

      let user = null;
      
      const isClerkId = identifier.startsWith('user_') || identifier.startsWith('clerk_');
      
      if (isClerkId) {
        user = await this.prisma.user.findUnique({
          where: { clerkId: identifier },
          include: {
            businessUnits: {
              where: { isActive: true },
              include: {
                businessUnit: true,
              },
            },
            company: true,
            _count: {
              select: {
                sales: true,
                orders: true,
                purchaseOrders: true,
              },
            },
          },
        });
      } else {
        user = await this.prisma.user.findUnique({
          where: { id: identifier },
          include: {
            businessUnits: {
              where: { isActive: true },
              include: {
                businessUnit: true,
              },
            },
            company: true,
            _count: {
              select: {
                sales: true,
                orders: true,
                purchaseOrders: true,
              },
            },
          },
        });

        if (!user) {
          user = await this.prisma.user.findUnique({
            where: { clerkId: identifier },
            include: {
              businessUnits: {
                where: { isActive: true },
                include: {
                  businessUnit: true,
                },
              },
              company: true,
              _count: {
                select: {
                  sales: true,
                  orders: true,
                  purchaseOrders: true,
                },
              },
            },
          });
        }
      }

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return {
        ...user,
        fullName: `${user.firstName} ${user.lastName}`.trim(),
        salesCount: user._count?.sales || 0,
        ordersCount: user._count?.orders || 0,
        purchaseOrderCount: user._count?.purchaseOrders || 0,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUserByIdentifier');
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId: string): Promise<UserResponse> {
    try {
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      return await this.getUserById(userId);
    } catch (error) {
      this.handleError(error, 'UserService.getCurrentUser');
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    try {
      if (!email) {
        throw new AppError('Email is required', 400);
      }

      const user = await this.prisma.user.findUnique({
        where: { email },
        include: {
          businessUnits: {
            where: { isActive: true },
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });

      return user;
    } catch (error) {
      this.handleError(error, 'UserService.getUserByEmail');
    }
  }

  /**
   * Create a new user
   */
  async createUser(data: CreateUserData) {
    try {
      if (!data.email || !data.firstName || !data.lastName || !data.password) {
        throw new AppError('Email, first name, last name, and password are required', 400);
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new AppError('User with this email already exists', 400);
      }

      if (data.password.length < 8) {
        throw new AppError('Password must be at least 8 characters', 400);
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      let userPermissions: string[] = [];
      
      if (data.permissions && data.permissions.length > 0) {
        userPermissions = data.permissions;
        logger.info('Using custom permissions for user:', userPermissions.length);
      } else {
        userPermissions = getDefaultPermissionsForRole(data.role);
        logger.info('Using default permissions for role:', userPermissions.length);
      }

      let finalBusinessUnitId: string | null = null;

      if (data.businessUnitId) {
        const businessUnit = await this.prisma.businessUnit.findUnique({
          where: { id: data.businessUnitId },
        });
        
        if (businessUnit) {
          finalBusinessUnitId = data.businessUnitId;
          logger.info('Using provided business unit:', finalBusinessUnitId);
        } else {
          logger.warn('Provided business unit not found, will use default');
        }
      }

      if (!finalBusinessUnitId) {
        const existingBusinessUnit = await this.prisma.businessUnit.findFirst({
          where: data.companyId ? { companyId: data.companyId } : {},
        });
        
        if (existingBusinessUnit) {
          finalBusinessUnitId = existingBusinessUnit.id;
          logger.info('Using existing business unit:', finalBusinessUnitId);
        } else {
          const defaultBusinessUnit = await getOrCreateDefaultBusinessUnit(
            this.prisma,
            data.companyId
          );
          if (defaultBusinessUnit) {
            finalBusinessUnitId = defaultBusinessUnit.id;
            logger.info('Created and using default business unit:', finalBusinessUnitId);
          } else {
            logger.warn('Could not create default business unit, user will be created without one');
          }
        }
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({
          data: {
            clerkId: data.clerkId || `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            email: data.email.toLowerCase(),
            firstName: data.firstName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber,
            role: data.role,
            password: hashedPassword,
            companyId: data.companyId,
            avatar: data.avatar,
            permissions: userPermissions,
            isActive: true,
          },
          include: {
            businessUnits: true,
            company: true,
          },
        });
        logger.info('User created:', user.id);

        if (finalBusinessUnitId) {
          logger.info('Assigning user to business unit:', finalBusinessUnitId);
          await tx.businessUnitUser.create({
            data: {
              userId: user.id,
              businessUnitId: finalBusinessUnitId,
              role: data.role,
              isActive: true,
            },
          });
          logger.info('Business unit assigned');
        } else {
          logger.info('No business unit assigned to user');
        }

        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'USER',
            entityId: user.id,
            userId: user.id,
            entityName: `${user.firstName} ${user.lastName}`,
            changes: {
              email: user.email,
              role: user.role,
              permissions: userPermissions,
              businessUnitId: finalBusinessUnitId,
            },
            severity: 'INFO',
          },
        });

        return user;
      });
    } catch (error) {
      this.handleError(error, 'UserService.createUser');
    }
  }

  /**
   * Update user
   */
  async updateUser(id: string, data: UpdateUserData) {
    try {
      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new AppError('User not found', 404);
      }

      if (data.email && data.email !== existingUser.email) {
        const emailExists = await this.prisma.user.findUnique({
          where: { email: data.email },
        });
        if (emailExists) {
          throw new AppError('User with this email already exists', 400);
        }
      }

      const updateData: any = { ...data };
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      let finalBusinessUnitId: string | null = null;
      
      if (data.businessUnitId !== undefined) {
        if (data.businessUnitId) {
          const businessUnit = await this.prisma.businessUnit.findUnique({
            where: { id: data.businessUnitId },
          });
          if (!businessUnit) {
            throw new AppError('Business unit not found', 404);
          }
          finalBusinessUnitId = data.businessUnitId;
        }
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data: {
            ...updateData,
            email: updateData.email ? updateData.email.toLowerCase() : undefined,
          },
          include: {
            businessUnits: {
              where: { isActive: true },
              include: {
                businessUnit: true,
              },
            },
            company: true,
          },
        });

        if (data.businessUnitId !== undefined) {
          await tx.businessUnitUser.deleteMany({
            where: { userId: id },
          });

          if (finalBusinessUnitId) {
            await tx.businessUnitUser.create({
              data: {
                userId: id,
                businessUnitId: finalBusinessUnitId,
                role: data.role || existingUser.role,
                isActive: true,
              },
            });
          }
        }

        const changes: any = {
          updatedFields: Object.keys(updateData),
        };
        if (data.permissions) {
          changes.permissions = data.permissions;
        }
        if (finalBusinessUnitId !== undefined) {
          changes.businessUnitId = finalBusinessUnitId;
        }

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'USER',
            entityId: id,
            userId: id,
            entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
            changes: changes,
            severity: 'INFO',
          },
        });

        return updatedUser;
      });
    } catch (error) {
      this.handleError(error, 'UserService.updateUser');
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(id: string) {
    try {
      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          businessUnits: true,
          sales: { take: 1 },
          orders: { take: 1 },
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      if (user.sales.length > 0 || user.orders.length > 0) {
        return await this.prisma.user.update({
          where: { id },
          data: {
            isActive: false,
          },
        });
      }

      return await this.prisma.$transaction(async (tx: any) => {
        await tx.businessUnitUser.deleteMany({
          where: { userId: id },
        });

        await tx.user.delete({
          where: { id },
        });

        return { message: 'User deleted successfully' };
      });
    } catch (error) {
      this.handleError(error, 'UserService.deleteUser');
    }
  }

  /**
   * Activate user
   */
  async activateUser(id: string) {
    try {
      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return await this.prisma.user.update({
        where: { id },
        data: { isActive: true },
        include: {
          businessUnits: {
            where: { isActive: true },
            include: { businessUnit: true },
          },
          company: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'UserService.activateUser');
    }
  }

  /**
   * Deactivate user
   */
  async deactivateUser(id: string) {
    try {
      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return await this.prisma.user.update({
        where: { id },
        data: { isActive: false },
        include: {
          businessUnits: {
            where: { isActive: true },
            include: { businessUnit: true },
          },
          company: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'UserService.deactivateUser');
    }
  }

  /**
   * Assign user to business unit
   */
  async assignBusinessUnit(userId: string, businessUnitId: string, role: UserRole = UserRole.EMPLOYEE) {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError('User ID and business unit ID are required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
      });
      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      const existingAssignment = await this.prisma.businessUnitUser.findFirst({
        where: { userId, businessUnitId },
      });

      if (existingAssignment) {
        if (existingAssignment.isActive) {
          throw new AppError('User already assigned to this business unit', 400);
        }
        return await this.prisma.businessUnitUser.update({
          where: { id: existingAssignment.id },
          data: { isActive: true, role },
        });
      }

      return await this.prisma.businessUnitUser.create({
        data: {
          userId,
          businessUnitId,
          role,
          isActive: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'UserService.assignBusinessUnit');
    }
  }

  /**
   * Remove user from business unit
   */
  async removeBusinessUnit(userId: string, businessUnitId: string) {
    try {
      if (!userId || !businessUnitId) {
        throw new AppError('User ID and business unit ID are required', 400);
      }

      const assignment = await this.prisma.businessUnitUser.findFirst({
        where: { userId, businessUnitId },
      });

      if (!assignment) {
        throw new AppError('User is not assigned to this business unit', 404);
      }

      return await this.prisma.businessUnitUser.delete({
        where: { id: assignment.id },
      });
    } catch (error) {
      this.handleError(error, 'UserService.removeBusinessUnit');
    }
  }

  /**
   * Get users by business unit
   */
  async getUsersByBusinessUnit(businessUnitId: string) {
    try {
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      return await this.prisma.user.findMany({
        where: {
          businessUnits: {
            some: { businessUnitId, isActive: true },
          },
          isActive: true,
        },
        include: {
          businessUnits: {
            where: { businessUnitId, isActive: true },
            include: { businessUnit: true },
          },
          company: true,
        },
        orderBy: { firstName: 'asc' },
      });
    } catch (error) {
      this.handleError(error, 'UserService.getUsersByBusinessUnit');
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(id: string, role: UserRole) {
    try {
      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data: { role },
          include: {
            businessUnits: {
              where: { isActive: true },
              include: { businessUnit: true },
            },
            company: true,
          },
        });

        await tx.businessUnitUser.updateMany({
          where: { userId: id, isActive: true },
          data: { role },
        });

        if (!user.permissions || user.permissions.length === 0) {
          const newPermissions = getDefaultPermissionsForRole(role);
          await tx.user.update({
            where: { id },
            data: { permissions: newPermissions },
          });
          updatedUser.permissions = newPermissions;
        }

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'USER',
            entityId: id,
            userId: id,
            entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
            changes: {
              oldRole: user.role,
              newRole: role,
              permissionsUpdated: !user.permissions || user.permissions.length === 0,
            },
            severity: 'INFO',
          },
        });

        return updatedUser;
      });
    } catch (error) {
      this.handleError(error, 'UserService.updateUserRole');
    }
  }

  /**
   * Update user permissions
   */
  async updateUserPermissions(id: string, permissions: string[]) {
    try {
      if (!id) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const validPermissions = permissions.filter(p => 
        typeof p === 'string' && p.includes(':')
      );

      if (validPermissions.length !== permissions.length) {
        logger.warn('Some invalid permissions were filtered out');
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data: { permissions: validPermissions },
          include: {
            businessUnits: {
              where: { isActive: true },
              include: { businessUnit: true },
            },
            company: true,
          },
        });

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'USER',
            entityId: id,
            userId: id,
            entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
            changes: {
              oldPermissions: user.permissions || [],
              newPermissions: validPermissions,
            },
            severity: 'INFO',
          },
        });

        return updatedUser;
      });
    } catch (error) {
      this.handleError(error, 'UserService.updateUserPermissions');
    }
  }

  /**
   * Bulk activate users
   */
  async bulkActivateUsers(ids: string[]) {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('User IDs array is required', 400);
      }

      const result = await this.prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { isActive: true },
      });

      return {
        count: result.count,
        message: `${result.count} users activated successfully`,
      };
    } catch (error) {
      this.handleError(error, 'UserService.bulkActivateUsers');
    }
  }

  /**
   * Bulk deactivate users
   */
  async bulkDeactivateUsers(ids: string[]) {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('User IDs array is required', 400);
      }

      const result = await this.prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false },
      });

      return {
        count: result.count,
        message: `${result.count} users deactivated successfully`,
      };
    } catch (error) {
      this.handleError(error, 'UserService.bulkDeactivateUsers');
    }
  }

  /**
   * Bulk delete users
   */
  async bulkDeleteUsers(ids: string[]) {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('User IDs array is required', 400);
      }

      return await this.prisma.$transaction(async (tx: any) => {
        await tx.businessUnitUser.deleteMany({
          where: { userId: { in: ids } },
        });

        const result = await tx.user.deleteMany({
          where: { id: { in: ids } },
        });

        return {
          count: result.count,
          message: `${result.count} users deleted successfully`,
        };
      });
    } catch (error) {
      this.handleError(error, 'UserService.bulkDeleteUsers');
    }
  }

  /**
   * Export users
   */
  async exportUsers(format: 'csv' | 'json' = 'json') {
    try {
      const users = await this.prisma.user.findMany({
        include: {
          businessUnits: {
            where: { isActive: true },
            include: { businessUnit: true },
          },
          company: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (format === 'csv') {
        const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Role', 'Status', 'Created At', 'Last Login', 'Permissions'];
        const rows = users.map((user: any) => [
          user.id,
          user.email,
          user.firstName,
          user.lastName,
          user.role,
          user.isActive ? 'Active' : 'Inactive',
          user.createdAt.toISOString(),
          user.lastLoginAt ? user.lastLoginAt.toISOString() : '',
          (user.permissions || []).join('; '),
        ]);

        return {
          data: [headers, ...rows],
          format: 'csv',
          total: users.length,
        };
      }

      return {
        data: users,
        total: users.length,
        format: 'json',
      };
    } catch (error) {
      this.handleError(error, 'UserService.exportUsers');
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics() {
    try {
      const [total, active, inactive, byRole, recentUsers, permissionsStats] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({ where: { isActive: false } }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
        this.prisma.user.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
            permissions: true,
          },
        }),
        this.prisma.user.findMany({
          select: {
            permissions: true,
          },
        }),
      ]);

      const permissionCounts: Record<string, number> = {};
      permissionsStats.forEach((user: any) => {
        if (user.permissions) {
          user.permissions.forEach((perm: string) => {
            permissionCounts[perm] = (permissionCounts[perm] || 0) + 1;
          });
        }
      });

      return {
        total,
        active,
        inactive,
        byRole: byRole.map((r: any) => ({
          role: r.role,
          count: r._count._all,
        })),
        recentUsers,
        permissionsStats: {
          totalPermissions: Object.keys(permissionCounts).length,
          mostCommon: Object.entries(permissionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([permission, count]) => ({ permission, count })),
        },
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUserStatistics');
    }
  }

  // ============================================
  // USER ACTIVITY METHODS (Using AuditLog)
  // ============================================

  /**
   * Get user activity from AuditLog
   */
  async getUserActivity(userId: string, filters: ActivityFilter = {}) {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = { userId };

      if (filters.action) {
        where.action = filters.action;
      }
      if (filters.entityType) {
        where.entityType = filters.entityType;
      }
      if (filters.search) {
        where.OR = [
          { entityName: { contains: filters.search, mode: 'insensitive' } },
          { entityType: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
      if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
      }

      const [activities, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        data: activities,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUserActivity');
    }
  }

  /**
   * Get user audit trail
   */
  async getUserAuditTrail(userId: string, filters: { page?: number; limit?: number } = {}) {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const [auditLogs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditLog.count({ where: { userId } }),
      ]);

      return {
        data: auditLogs,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUserAuditTrail');
    }
  }

  /**
   * Clear user activity
   */
  async clearUserActivity(userId: string, beforeDate?: string) {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const where: any = { userId };
      if (beforeDate) {
        where.createdAt = { lt: new Date(beforeDate) };
      }

      const result = await this.prisma.auditLog.deleteMany({ where });

      return {
        cleared: result.count,
        message: `Cleared ${result.count} activities`,
      };
    } catch (error) {
      this.handleError(error, 'UserService.clearUserActivity');
    }
  }

  // ============================================
  // USER IMPORT METHODS (Using AuditLog for history)
  // ============================================

  /**
   * Import users from file
   */
  async importUsers(file: Express.Multer.File, options: ImportOptions = {}, currentUserId?: string, currentUserEmail?: string) {
    const startTime = Date.now();

    try {
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const fileExtension = path.extname(file.originalname).toLowerCase();

      if (fileExtension !== '.csv') {
        throw new AppError('Invalid file format. Only CSV files are supported.', 400);
      }

      const content = fs.readFileSync(file.path, 'utf-8');
      const rows = parseCSVContentSimple(content);

      fs.unlinkSync(file.path);

      if (rows.length < 2) {
        throw new AppError('File must contain at least a header row and one data row', 400);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
      }

      const { users, errors, warnings } = validateImportData(dataRows, headers);
      const validUsers = users.filter(u => u.status === 'valid' || u.status === 'warning');

      const importedUsers: string[] = [];
      const failedUsers: string[] = [];
      const importErrors: any[] = [];

      for (const user of validUsers) {
        try {
          if (options.skipDuplicates) {
            const existingUser = await this.prisma.user.findUnique({
              where: { email: user.email },
            });
            if (existingUser) {
              failedUsers.push(user.email);
              importErrors.push({ rowNumber: user.rowNumber, email: user.email, error: 'User already exists' });
              continue;
            }
          }

          const hashedPassword = await bcrypt.hash(
            user.password || options.defaultPassword || 'DefaultPass123!',
            10
          );

          const newUser = await this.prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              role: user.role,
              password: hashedPassword,
              isActive: user.isActive !== undefined ? user.isActive : options.autoActivate !== false,
              permissions: user.permissions || [],
              companyId: user.companyId,
              clerkId: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            },
          });

          importedUsers.push(user.email);

          await this.prisma.auditLog.create({
            data: {
              action: 'IMPORT',
              entityType: 'USER',
              entityId: newUser.id,
              userId: currentUserId || newUser.id,
              entityName: `${newUser.firstName} ${newUser.lastName}`,
              changes: { email: newUser.email, role: newUser.role, source: 'file_import' },
              severity: 'INFO',
            },
          });
        } catch (error: any) {
          failedUsers.push(user.email);
          importErrors.push({ rowNumber: user.rowNumber, email: user.email, error: error?.message || 'Failed to import user' });
        }
      }

      const importDuration = Date.now() - startTime;
      const status = failedUsers.length === 0 ? 'completed' : failedUsers.length < validUsers.length ? 'partial' : 'failed';

      await this.prisma.auditLog.create({
        data: {
          action: 'IMPORT',
          entityType: 'USER_IMPORT',
          entityId: `import_${startTime}`,
          userId: currentUserId || 'system',
          entityName: file.originalname,
          changes: {
            fileName: file.originalname,
            fileSize: file.size,
            totalRows: users.length,
            successCount: importedUsers.length,
            failedCount: failedUsers.length,
            warningCount: warnings.length,
            skippedCount: users.length - validUsers.length,
            status,
            importedBy: currentUserEmail || 'Unknown',
            importDuration,
            errorSummary: importErrors.length > 0 ? `${importErrors.length} errors` : undefined,
          },
          severity: status === 'completed' ? 'INFO' : status === 'partial' ? 'LOW' : 'MEDIUM',
        },
      });

      return {
        totalRows: users.length,
        successCount: importedUsers.length,
        failedCount: failedUsers.length,
        warningCount: warnings.length,
        skippedCount: users.length - validUsers.length,
        errors: importErrors,
        warnings,
        importedUsers,
        failedUsers,
        importDuration,
      };
    } catch (error) {
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      this.handleError(error, 'UserService.importUsers');
    }
  }

  /**
   * Get import history from AuditLog
   */
  async getImportHistory(filters: { page?: number; limit?: number; fileName?: string } = {}) {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {
        entityType: 'USER_IMPORT',
      };

      if (filters.fileName) {
        where.entityName = { contains: filters.fileName, mode: 'insensitive' };
      }

      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      const formattedHistory = logs.map((log: any) => ({
        id: log.id,
        fileName: log.entityName,
        fileSize: log.changes?.fileSize || 0,
        totalRows: log.changes?.totalRows || 0,
        successCount: log.changes?.successCount || 0,
        failedCount: log.changes?.failedCount || 0,
        warningCount: log.changes?.warningCount || 0,
        skippedCount: log.changes?.skippedCount || 0,
        status: log.changes?.status || 'completed',
        importedBy: log.changes?.importedBy || 'Unknown',
        importDuration: log.changes?.importDuration || 0,
        errorSummary: log.changes?.errorSummary,
        importedAt: log.createdAt.toISOString(),
      }));

      return {
        data: formattedHistory,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getImportHistory');
    }
  }

  // ============================================
  // USER INVITATION METHODS (Using AuditLog)
  // ============================================

  /**
   * Invite user
   */
  async inviteUser(data: InvitationData, currentUserId?: string, currentUserEmail?: string) {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      const existingInvitation = await this.prisma.auditLog.findFirst({
        where: {
          entityType: 'INVITATION',
          entityName: data.email.toLowerCase(),
        },
      });

      if (existingInvitation) {
        return {
          id: existingInvitation.id,
          email: data.email,
          status: 'duplicate',
          message: 'Invitation already exists for this email',
          invitation: existingInvitation,
        };
      }

      const token = generateInvitationToken();
      const expiresAt = data.expiresIn && data.expiresIn > 0 
        ? new Date(Date.now() + data.expiresIn * 24 * 60 * 60 * 1000)
        : null;

      const invitation = await this.prisma.auditLog.create({
        data: {
          action: 'INVITE',
          entityType: 'INVITATION',
          entityId: `inv_${Date.now()}`,
          userId: currentUserId || 'system',
          entityName: data.email.toLowerCase(),
          changes: {
            email: data.email.toLowerCase(),
            role: data.role,
            businessUnitId: data.businessUnitId,
            message: data.message,
            expiresIn: data.expiresIn || 7,
            status: 'sent',
            sentAt: new Date().toISOString(),
            expiresAt: expiresAt?.toISOString(),
            invitationToken: token,
            invitedBy: currentUserEmail || 'Unknown',
            metadata: data.metadata,
          },
          severity: 'INFO',
        },
      });

      return {
        id: invitation.id,
        email: data.email,
        status: 'sent',
        invitation,
      };
    } catch (error) {
      this.handleError(error, 'UserService.inviteUser');
    }
  }

  /**
   * Resend invitation
   */
  async resendInvitation(invitationId: string) {
    try {
      const invitation = await this.prisma.auditLog.findUnique({
        where: { id: invitationId },
      });

      if (!invitation || invitation.entityType !== 'INVITATION') {
        throw new AppError('Invitation not found', 404);
      }

      const updatedInvitation = await this.prisma.auditLog.update({
        where: { id: invitationId },
        data: {
          changes: {
            ...(invitation.changes || {}),
            status: 'sent',
            sentAt: new Date().toISOString(),
            reminderCount: ((invitation.changes as any)?.reminderCount || 0) + 1,
            reminderSent: true,
            reminderSentAt: new Date().toISOString(),
          },
        },
      });

      return updatedInvitation;
    } catch (error) {
      this.handleError(error, 'UserService.resendInvitation');
    }
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(invitationId: string) {
    try {
      const invitation = await this.prisma.auditLog.findUnique({
        where: { id: invitationId },
      });

      if (!invitation || invitation.entityType !== 'INVITATION') {
        throw new AppError('Invitation not found', 404);
      }

      const updatedInvitation = await this.prisma.auditLog.update({
        where: { id: invitationId },
        data: {
          changes: {
            ...(invitation.changes || {}),
            status: 'cancelled',
            cancelledAt: new Date().toISOString(),
          },
        },
      });

      return updatedInvitation;
    } catch (error) {
      this.handleError(error, 'UserService.cancelInvitation');
    }
  }

  /**
   * Delete invitation
   */
  async deleteInvitation(invitationId: string) {
    try {
      const invitation = await this.prisma.auditLog.findUnique({
        where: { id: invitationId },
      });

      if (!invitation || invitation.entityType !== 'INVITATION') {
        throw new AppError('Invitation not found', 404);
      }

      await this.prisma.auditLog.delete({ where: { id: invitationId } });

      return { message: 'Invitation deleted successfully' };
    } catch (error) {
      this.handleError(error, 'UserService.deleteInvitation');
    }
  }

  /**
   * Get invitations from AuditLog
   */
  async getInvitations(filters: { page?: number; limit?: number; search?: string } = {}) {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {
        entityType: 'INVITATION',
      };

      if (filters.search) {
        where.entityName = { contains: filters.search, mode: 'insensitive' };
      }

      const [invitations, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      return {
        data: invitations,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getInvitations');
    }
  }

  // ============================================
  // USER GROUP METHODS
  // ============================================

  /**
   * Create group
   */
  async createGroup(data: CreateGroupData) {
    try {
      const groupEmail = `${data.name.toLowerCase().replace(/\s+/g, '.')}@group.local`;

      const existingGroup = await this.prisma.user.findFirst({
        where: { email: groupEmail },
      });

      if (existingGroup) {
        throw new AppError('Group with this name already exists', 409);
      }

      const group = await this.prisma.user.create({
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

      return group;
    } catch (error) {
      this.handleError(error, 'UserService.createGroup');
    }
  }

  /**
   * Update group
   */
  async updateGroup(id: string, data: UpdateGroupData) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id } });

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

      return await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      this.handleError(error, 'UserService.updateGroup');
    }
  }

  /**
   * Delete group
   */
  async deleteGroup(id: string) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id } });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      await this.prisma.user.delete({ where: { id } });

      return { message: 'Group deleted successfully' };
    } catch (error) {
      this.handleError(error, 'UserService.deleteGroup');
    }
  }

  /**
   * Get groups
   */
  async getGroups(filters: GroupFilter = {}) {
    try {
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {
        email: { endsWith: '@group.local' },
      };

      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ];
      }
      if (filters.isActive !== undefined) where.isActive = filters.isActive;
      if (filters.role) where.role = filters.role;

      const [groups, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data: groups,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getGroups');
    }
  }

  /**
   * Assign users to group
   */
  async assignUsersToGroup(groupId: string, userIds: string[], role: UserRole = UserRole.USER, isLead: boolean = false) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      const assignedUsers: string[] = [];
      const skippedUsers: string[] = [];
      const groupPermissions = group.permissions || [];

      for (const userId of userIds) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
          skippedUsers.push(userId);
          continue;
        }

        const mergedPermissions = [...new Set([...(user.permissions || []), ...groupPermissions])];

        await this.prisma.user.update({
          where: { id: userId },
          data: { permissions: mergedPermissions },
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
      this.handleError(error, 'UserService.assignUsersToGroup');
    }
  }

  /**
   * Remove users from group
   */
  async removeUsersFromGroup(groupId: string, userIds: string[]) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      const removedUsers: string[] = [];
      const skippedUsers: string[] = [];
      const groupPermissions = group.permissions || [];

      for (const userId of userIds) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
          skippedUsers.push(userId);
          continue;
        }

        // Fixed: Added explicit type for parameter 'p'
        const filteredPermissions = (user.permissions || []).filter((p: string) => !groupPermissions.includes(p));

        await this.prisma.user.update({
          where: { id: userId },
          data: { permissions: filteredPermissions },
        });

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
      this.handleError(error, 'UserService.removeUsersFromGroup');
    }
  }

  /**
   * Update group permissions
   */
  async updateGroupPermissions(groupId: string, permissions: string[]) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      return await this.prisma.user.update({
        where: { id: groupId },
        data: { permissions },
      });
    } catch (error) {
      this.handleError(error, 'UserService.updateGroupPermissions');
    }
  }

  /**
   * Get group by ID
   */
  async getGroupById(groupId: string) {
    try {
      const group = await this.prisma.user.findUnique({
        where: { id: groupId },
        include: {
          businessUnits: true,
          company: true,
        },
      });

      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      return group;
    } catch (error) {
      this.handleError(error, 'UserService.getGroupById');
    }
  }

  /**
   * Get group by name
   */
  async getGroupByName(name: string) {
    try {
      const group = await this.prisma.user.findFirst({
        where: {
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@group.local`,
        },
      });

      if (!group) {
        throw new AppError('Group not found', 404);
      }

      return group;
    } catch (error) {
      this.handleError(error, 'UserService.getGroupByName');
    }
  }

  /**
   * Get group members
   */
  async getGroupMembers(groupId: string, filters: { page?: number; limit?: number; search?: string } = {}) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;
      const groupPermissions = group.permissions || [];

      const where: any = {
        permissions: { hasSome: groupPermissions },
      };

      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [members, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
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
        this.prisma.user.count({ where }),
      ]);

      return {
        data: members,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getGroupMembers');
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(userId: string, role: UserRole) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      return await this.prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'UserService.updateMemberRole');
    }
  }

  /**
   * Set group lead
   */
  async setGroupLead(userId: string, isLead: boolean) {
    try {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      let permissions = [...(user.permissions || [])];
      const leadPermission = 'group:lead';

      if (isLead && !permissions.includes(leadPermission)) {
        permissions.push(leadPermission);
      } else if (!isLead && permissions.includes(leadPermission)) {
        permissions = permissions.filter(p => p !== leadPermission);
      }

      return await this.prisma.user.update({
        where: { id: userId },
        data: { permissions },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          permissions: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'UserService.setGroupLead');
    }
  }

  /**
   * Get group statistics
   */
  async getGroupStatistics() {
    try {
      const [totalGroups, totalMembers, activeGroups, inactiveGroups, byRole] = await Promise.all([
        this.prisma.user.count({ where: { email: { endsWith: '@group.local' } } }),
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true, email: { endsWith: '@group.local' } } }),
        this.prisma.user.count({ where: { isActive: false, email: { endsWith: '@group.local' } } }),
        this.prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
      ]);

      return {
        totalGroups,
        totalMembers,
        activeGroups,
        inactiveGroups,
        averageMembersPerGroup: totalGroups > 0 ? totalMembers / totalGroups : 0,
        byRole: byRole.reduce((acc: Record<string, number>, item: any) => {
          acc[item.role] = item._count._all;
          return acc;
        }, {}),
      };
    } catch (error) {
      this.handleError(error, 'UserService.getGroupStatistics');
    }
  }

  /**
   * Get invitation statistics from AuditLog
   */
  async getInvitationStatistics() {
    try {
      const invitations = await this.prisma.auditLog.findMany({
        where: { entityType: 'INVITATION' },
      });

      const total = invitations.length;
      const sent = invitations.filter((inv: any) => inv.changes?.status === 'sent').length;
      const accepted = invitations.filter((inv: any) => inv.changes?.status === 'accepted').length;
      const cancelled = invitations.filter((inv: any) => inv.changes?.status === 'cancelled').length;
      const expired = invitations.filter((inv: any) => inv.changes?.status === 'expired').length;
      const pending = invitations.filter((inv: any) => inv.changes?.status === 'pending').length;

      return {
        total,
        pending,
        sent,
        accepted,
        expired,
        cancelled,
        acceptanceRate: total > 0 ? (accepted / total) * 100 : 0,
        byRole: {},
      };
    } catch (error) {
      this.handleError(error, 'UserService.getInvitationStatistics');
    }
  }

  /**
   * Get import statistics from AuditLog
   */
  async getImportStatistics() {
    try {
      const importLogs = await this.prisma.auditLog.findMany({
        where: { entityType: 'USER_IMPORT' },
      });

      const totalImports = importLogs.length;
      const totalUsersImported = importLogs.reduce(
        (sum: number, log: any) => sum + (log.changes?.successCount || 0),
        0
      );

      const byStatus: Record<string, number> = {};
      importLogs.forEach((log: any) => {
        const status = log.changes?.status || 'unknown';
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      return {
        totalImports,
        totalUsersImported,
        successRate: totalImports > 0 ? (totalUsersImported / totalImports) * 100 : 0,
        byStatus,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getImportStatistics');
    }
  }

  /**
   * Export groups
   */
  async exportGroups(format: 'csv' | 'json' = 'json') {
    try {
      const groups = await this.prisma.user.findMany({
        where: { email: { endsWith: '@group.local' } },
        select: {
          id: true,
          firstName: true,
          email: true,
          permissions: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (format === 'csv') {
        const headers = ['ID', 'Name', 'Email', 'Permissions', 'Status', 'Created At'];
        const rows = groups.map((g: any) => [
          g.id,
          g.firstName,
          g.email,
          (g.permissions || []).join('; '),
          g.isActive ? 'Active' : 'Inactive',
          g.createdAt.toISOString(),
        ]);

        return {
          data: [headers, ...rows],
          format: 'csv',
          total: groups.length,
        };
      }

      return {
        data: groups,
        total: groups.length,
        format: 'json',
      };
    } catch (error) {
      this.handleError(error, 'UserService.exportGroups');
    }
  }

  // ============================================
  // ADDITIONAL USER ACTIVITY METHODS
  // ============================================

  /**
   * Get user activity statistics
   */
  async getUserActivityStats(userId: string, dateRange: string = 'month') {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const now = new Date();
      let dateFrom: Date;

      switch (dateRange) {
        case 'today':
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          dateFrom = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          dateFrom = new Date(0);
      }

      const where = { userId, createdAt: { gte: dateFrom } };

      const [total, byAction, bySeverity] = await Promise.all([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where,
          _count: { _all: true },
        }),
        this.prisma.auditLog.groupBy({
          by: ['severity'],
          where,
          _count: { _all: true },
        }),
      ]);

      return {
        total,
        byAction: byAction.reduce((acc: Record<string, number>, item: any) => {
          acc[item.action] = item._count._all;
          return acc;
        }, {}),
        bySeverity: bySeverity.reduce((acc: Record<string, number>, item: any) => {
          acc[item.severity] = item._count._all;
          return acc;
        }, {}),
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUserActivityStats');
    }
  }

  /**
   * Get user activity summary (alias for getUserActivityStats)
   */
  async getUserActivitySummary(userId: string, dateRange: string = 'month') {
    return this.getUserActivityStats(userId, dateRange);
  }

  /**
   * Get user activity trends
   */
  async getUserActivityTrends(userId: string, period: string = 'week') {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const now = new Date();
      let dateFrom: Date;
      let labels: string[] = [];

      switch (period) {
        case 'day':
          dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          for (let i = 23; i >= 0; i--) {
            labels.push(`${i}:00`);
          }
          break;
        case 'week':
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          for (let i = 6; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            labels.push(day.toLocaleDateString('en-US', { weekday: 'short' }));
          }
          break;
        case 'month':
          dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          for (let i = 29; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            labels.push(day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
          }
          break;
        default:
          dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          for (let i = 6; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            labels.push(day.toLocaleDateString('en-US', { weekday: 'short' }));
          }
      }

      const activities = await this.prisma.auditLog.findMany({
        where: { userId, createdAt: { gte: dateFrom } },
        select: { createdAt: true },
      });

      const values = new Array(labels.length).fill(0);

      activities.forEach((activity: any) => {
        const date = activity.createdAt;
        let index = -1;

        switch (period) {
          case 'day':
            index = date.getHours();
            break;
          case 'week':
            index = 6 - Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
            break;
          case 'month':
            index = 29 - Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
            break;
        }

        if (index >= 0 && index < values.length) {
          values[index]++;
        }
      });

      return {
        labels,
        values,
        total: values.reduce((sum: number, val: number) => sum + val, 0),
        average: values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : 0,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUserActivityTrends');
    }
  }

  /**
   * Get recent user activity
   */
  async getRecentUserActivity(userId: string, limit: number = 10) {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const activities = await this.prisma.auditLog.findMany({
        where: { userId },
        take: Math.min(limit, 50),
        orderBy: { createdAt: 'desc' },
      });

      return activities;
    } catch (error) {
      this.handleError(error, 'UserService.getRecentUserActivity');
    }
  }

  /**
   * Get user activity by ID
   */
  async getUserActivityById(userId: string, activityId: string) {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const activity = await this.prisma.auditLog.findFirst({
        where: { id: activityId, userId },
      });

      if (!activity) {
        throw new AppError('Activity not found', 404);
      }

      return activity;
    } catch (error) {
      this.handleError(error, 'UserService.getUserActivityById');
    }
  }

  /**
   * Export user activity
   */
  async exportUserActivity(userId: string, format: string = 'json') {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const activities = await this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (format === 'json') {
        return {
          data: activities,
          total: activities.length,
          format: 'json',
        };
      }

      if (format === 'csv') {
        const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity Name', 'Severity', 'IP Address'];
        const rows = activities.map((a: any) => [
          a.createdAt.toISOString(),
          a.action,
          a.entityType,
          a.entityName || '',
          a.severity,
          a.ipAddress || '',
        ]);

        return {
          data: [headers, ...rows],
          format: 'csv',
          total: activities.length,
        };
      }

      throw new AppError('Invalid export format', 400);
    } catch (error) {
      this.handleError(error, 'UserService.exportUserActivity');
    }
  }

  /**
   * Export user audit trail
   */
  async exportUserAuditTrail(userId: string, format: string = 'json') {
    try {
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const auditLogs = await this.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      if (format === 'json') {
        return {
          data: auditLogs,
          total: auditLogs.length,
          format: 'json',
        };
      }

      if (format === 'csv') {
        const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Entity Name', 'Changes'];
        const rows = auditLogs.map((log: any) => [
          log.createdAt.toISOString(),
          log.action,
          log.entityType,
          log.entityId,
          log.entityName || '',
          JSON.stringify(log.changes),
        ]);

        return {
          data: [headers, ...rows],
          format: 'csv',
          total: auditLogs.length,
        };
      }

      throw new AppError('Invalid export format', 400);
    } catch (error) {
      this.handleError(error, 'UserService.exportUserAuditTrail');
    }
  }

  // ============================================
  // ADDITIONAL USER IMPORT METHODS
  // ============================================

  /**
   * Import users from CSV content
   */
  async importUsersFromCSV(content: string, options: { skipDuplicates?: boolean; autoActivate?: boolean; defaultPassword?: string } = {}) {
    try {
      if (!content) {
        throw new AppError('CSV content is required', 400);
      }

      const rows = parseCSVContentSimple(content);

      if (rows.length < 2) {
        throw new AppError('CSV must contain at least a header row and one data row', 400);
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);

      const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
      }

      const { users, errors, warnings } = validateImportData(dataRows, headers);
      const validUsers = users.filter((u: any) => u.status === 'valid' || u.status === 'warning');

      const importedUsers: string[] = [];
      const failedUsers: string[] = [];

      for (const user of validUsers) {
        try {
          if (options.skipDuplicates) {
            const existingUser = await this.prisma.user.findUnique({
              where: { email: user.email },
            });
            if (existingUser) {
              failedUsers.push(user.email);
              continue;
            }
          }

          const hashedPassword = await bcrypt.hash(
            user.password || options.defaultPassword || 'DefaultPass123!',
            10
          );

          await this.prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              role: user.role,
              password: hashedPassword,
              isActive: options.autoActivate !== false,
              permissions: user.permissions || [],
              companyId: user.companyId,
              clerkId: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            },
          });

          importedUsers.push(user.email);
        } catch (error) {
          failedUsers.push(user.email);
        }
      }

      return {
        totalRows: users.length,
        successCount: importedUsers.length,
        failedCount: failedUsers.length,
        warningCount: warnings.length,
        skippedCount: users.length - validUsers.length,
        errors,
        warnings,
        importedUsers,
        failedUsers,
        importDuration: 0,
      };
    } catch (error) {
      this.handleError(error, 'UserService.importUsersFromCSV');
    }
  }

  /**
   * Import users from JSON data
   */
  async importUsersFromJSON(usersData: any[], options: { skipDuplicates?: boolean; autoActivate?: boolean; defaultPassword?: string } = {}) {
    try {
      if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
        throw new AppError('At least one user is required', 400);
      }

      const importedUsers: string[] = [];
      const failedUsers: string[] = [];
      const errors: any[] = [];

      for (const userData of usersData) {
        try {
          if (options.skipDuplicates) {
            const existingUser = await this.prisma.user.findUnique({
              where: { email: userData.email },
            });
            if (existingUser) {
              failedUsers.push(userData.email);
              errors.push({ email: userData.email, error: 'User already exists' });
              continue;
            }
          }

          const hashedPassword = await bcrypt.hash(
            options.defaultPassword || 'DefaultPass123!',
            10
          );

          await this.prisma.user.create({
            data: {
              email: userData.email.toLowerCase(),
              firstName: userData.firstName,
              lastName: userData.lastName,
              phoneNumber: userData.phoneNumber,
              role: userData.role,
              password: hashedPassword,
              isActive: userData.isActive !== undefined ? userData.isActive : options.autoActivate !== false,
              permissions: userData.permissions || [],
              companyId: userData.companyId,
              clerkId: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            },
          });

          importedUsers.push(userData.email);
        } catch (error: any) {
          failedUsers.push(userData.email);
          errors.push({ email: userData.email, error: error?.message || 'Failed to import user' });
        }
      }

      return {
        totalRows: usersData.length,
        successCount: importedUsers.length,
        failedCount: failedUsers.length,
        warningCount: 0,
        skippedCount: 0,
        errors,
        warnings: [],
        importedUsers,
        failedUsers,
        importDuration: 0,
      };
    } catch (error) {
      this.handleError(error, 'UserService.importUsersFromJSON');
    }
  }

  /**
   * Validate import data
   */
  async validateImportData(data: any) {
    try {
      // Implementation depends on what validation is needed
      // This is a placeholder for the validation logic
      return {
        valid: true,
        errors: [],
        warnings: [],
        summary: {
          total: 0,
          valid: 0,
          invalid: 0,
          warnings: 0,
          duplicates: 0,
          readyToImport: 0,
        },
      };
    } catch (error) {
      this.handleError(error, 'UserService.validateImportData');
    }
  }

  /**
   * Get import template
   */
  async getImportTemplate(templateId: string) {
    try {
      const templates: Record<string, any> = {
        standard: {
          id: 'standard',
          name: 'Standard Template',
          description: 'Basic user import with essential fields',
          format: 'csv',
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: OPTIONAL_HEADERS,
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'EMPLOYEE', phoneNumber: '+1234567890', isActive: 'true' },
          ],
        },
        minimal: {
          id: 'minimal',
          name: 'Minimal Template',
          description: 'Only required fields',
          format: 'csv',
          headers: REQUIRED_HEADERS,
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: [],
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'USER' },
          ],
        },
        full: {
          id: 'full',
          name: 'Full Template',
          description: 'All available fields including permissions',
          format: 'csv',
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: OPTIONAL_HEADERS,
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'MANAGER', phoneNumber: '+1234567890', businessUnitId: '1', isActive: 'true', permissions: 'user:view,inventory:view,product:view', companyId: '1' },
          ],
        },
      };

      const template = templates[templateId];
      if (!template) {
        throw new AppError('Template not found', 404);
      }

      return template;
    } catch (error) {
      this.handleError(error, 'UserService.getImportTemplate');
    }
  }

  /**
   * Get all import templates
   */
  async getImportTemplates() {
    try {
      return [
        {
          id: 'standard',
          name: 'Standard Template',
          description: 'Basic user import with essential fields',
          format: 'csv',
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: OPTIONAL_HEADERS,
        },
        {
          id: 'minimal',
          name: 'Minimal Template',
          description: 'Only required fields',
          format: 'csv',
          headers: REQUIRED_HEADERS,
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: [],
        },
        {
          id: 'full',
          name: 'Full Template',
          description: 'All available fields including permissions',
          format: 'csv',
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          requiredHeaders: REQUIRED_HEADERS,
          optionalHeaders: OPTIONAL_HEADERS,
        },
      ];
    } catch (error) {
      this.handleError(error, 'UserService.getImportTemplates');
    }
  }

  /**
   * Download import template
   */
  async downloadImportTemplate(templateId: string) {
    try {
      const templates: Record<string, any> = {
        standard: {
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'EMPLOYEE', phoneNumber: '+1234567890', isActive: 'true' },
          ],
        },
        minimal: {
          headers: REQUIRED_HEADERS,
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'USER' },
          ],
        },
        full: {
          headers: [...REQUIRED_HEADERS, ...OPTIONAL_HEADERS],
          exampleData: [
            { email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe', role: 'MANAGER', phoneNumber: '+1234567890', businessUnitId: '1', isActive: 'true', permissions: 'user:view,inventory:view,product:view', companyId: '1' },
          ],
        },
      };

      const template = templates[templateId];
      if (!template) {
        throw new AppError('Template not found', 404);
      }

      let csvContent = template.headers.join(',') + '\n';
      template.exampleData.forEach((row: any) => {
        const values = template.headers.map((h: string) => row[h] || '');
        csvContent += values.join(',') + '\n';
      });

      return {
        content: csvContent,
        fileName: `user_import_${templateId}_template.csv`,
        mimeType: 'text/csv',
      };
    } catch (error) {
      this.handleError(error, 'UserService.downloadImportTemplate');
    }
  }

  /**
   * Get import statistics
   */
  async getImportStats() {
    try {
      const importLogs = await this.prisma.auditLog.findMany({
        where: { entityType: 'USER_IMPORT' },
        orderBy: { createdAt: 'desc' },
      });

      const totalImports = importLogs.length;
      const totalUsersImported = importLogs.reduce(
        (sum: number, log: any) => sum + (log.changes?.successCount || 0),
        0
      );

      const byStatus: Record<string, number> = {};
      importLogs.forEach((log: any) => {
        const status = log.changes?.status || 'unknown';
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      const lastImport = importLogs.length > 0 ? {
        id: importLogs[0].id,
        fileName: importLogs[0].entityName,
        importedAt: importLogs[0].createdAt.toISOString(),
        status: importLogs[0].changes?.status || 'completed',
        successCount: importLogs[0].changes?.successCount || 0,
        failedCount: importLogs[0].changes?.failedCount || 0,
      } : null;

      return {
        totalImports,
        totalUsersImported,
        successRate: totalImports > 0 ? (totalUsersImported / totalImports) * 100 : 0,
        averageImportTime: 0,
        lastImport,
        byStatus,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getImportStats');
    }
  }

  /**
   * Get import history by ID
   */
  async getImportHistoryById(importId: string) {
    try {
      const log = await this.prisma.auditLog.findUnique({
        where: { id: importId },
      });

      if (!log || log.entityType !== 'USER_IMPORT') {
        throw new AppError('Import history not found', 404);
      }

      return {
        id: log.id,
        fileName: log.entityName,
        fileSize: log.changes?.fileSize || 0,
        totalRows: log.changes?.totalRows || 0,
        successCount: log.changes?.successCount || 0,
        failedCount: log.changes?.failedCount || 0,
        warningCount: log.changes?.warningCount || 0,
        skippedCount: log.changes?.skippedCount || 0,
        status: log.changes?.status || 'completed',
        importedBy: log.changes?.importedBy || 'Unknown',
        importDuration: log.changes?.importDuration || 0,
        errorSummary: log.changes?.errorSummary,
        importedAt: log.createdAt.toISOString(),
      };
    } catch (error) {
      this.handleError(error, 'UserService.getImportHistoryById');
    }
  }

  /**
   * Delete import history
   */
  async deleteImportHistory(importId: string) {
    try {
      const log = await this.prisma.auditLog.findUnique({
        where: { id: importId },
      });

      if (!log || log.entityType !== 'USER_IMPORT') {
        throw new AppError('Import history not found', 404);
      }

      await this.prisma.auditLog.delete({ where: { id: importId } });

      return { message: 'Import history deleted successfully' };
    } catch (error) {
      this.handleError(error, 'UserService.deleteImportHistory');
    }
  }

  /**
   * Clear all import history
   */
  async clearImportHistory() {
    try {
      const result = await this.prisma.auditLog.deleteMany({
        where: { entityType: 'USER_IMPORT' },
      });

      return {
        cleared: result.count,
        message: `Cleared ${result.count} import history entries`,
      };
    } catch (error) {
      this.handleError(error, 'UserService.clearImportHistory');
    }
  }

  // ============================================
  // ADDITIONAL INVITATION METHODS
  // ============================================

  /**
   * Invite multiple users
   */
  async inviteUsers(invitations: Array<{ email: string; role: UserRole; businessUnitId?: string; message?: string }>, options: { expiresIn?: number; sendEmail?: boolean; templateId?: string } = {}) {
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
          const existingUser = await this.prisma.user.findUnique({
            where: { email: invitationData.email },
          });

          if (existingUser) {
            duplicateCount++;
            results.push({ email: invitationData.email, status: 'duplicate', message: 'User already exists' });
            continue;
          }

          const existingInvitation = await this.prisma.invitation.findFirst({
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

          const invitation = await this.prisma.invitation.create({
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
              invitedBy: 'System',
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
      this.handleError(error, 'UserService.inviteUsers');
    }
  }

  /**
   * Resend multiple invitations
   */
  async resendInvitations(invitationIds: string[]) {
    try {
      if (!invitationIds || invitationIds.length === 0) {
        throw new AppError('At least one invitation ID is required', 400);
      }

      const results: any[] = [];
      let successCount = 0;
      let failedCount = 0;

      for (const id of invitationIds) {
        try {
          const invitation = await this.prisma.invitation.findUnique({ where: { id } });

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

          const updatedInvitation = await this.prisma.invitation.update({
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
      this.handleError(error, 'UserService.resendInvitations');
    }
  }

  /**
   * Revoke invitation (alias for cancelInvitation)
   */
  async revokeInvitation(invitationId: string) {
    return this.cancelInvitation(invitationId);
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, userData: { firstName: string; lastName: string; password: string; phoneNumber?: string }) {
    try {
      const invitation = await this.prisma.invitation.findUnique({
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

      const existingUser = await this.prisma.user.findUnique({
        where: { email: invitation.email },
      });

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const user = await this.prisma.user.create({
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

      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'accepted', acceptedAt: new Date() },
      });

      if (invitation.businessUnitId) {
        await this.prisma.businessUnitUser.create({
          data: {
            userId: user.id,
            businessUnitId: invitation.businessUnitId,
            role: invitation.role,
            isActive: true,
          },
        });
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
    } catch (error) {
      this.handleError(error, 'UserService.acceptInvitation');
    }
  }

  /**
   * Decline invitation
   */
  async declineInvitation(token: string) {
    try {
      const invitation = await this.prisma.invitation.findUnique({
        where: { invitationToken: token },
      });

      if (!invitation) {
        throw new AppError('Invalid invitation token', 404);
      }

      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });

      return { message: 'Invitation declined successfully' };
    } catch (error) {
      this.handleError(error, 'UserService.declineInvitation');
    }
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats() {
    try {
      const [total, pending, sent, accepted, expired, cancelled] = await Promise.all([
        this.prisma.invitation.count(),
        this.prisma.invitation.count({ where: { status: 'pending' } }),
        this.prisma.invitation.count({ where: { status: 'sent' } }),
        this.prisma.invitation.count({ where: { status: 'accepted' } }),
        this.prisma.invitation.count({ where: { status: 'expired' } }),
        this.prisma.invitation.count({ where: { status: 'cancelled' } }),
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
        byRole: {},
      };
    } catch (error) {
      this.handleError(error, 'UserService.getInvitationStats');
    }
  }

  /**
   * Export invitations
   */
  async exportInvitations(format: string = 'json') {
    try {
      const invitations = await this.prisma.invitation.findMany({
        orderBy: { createdAt: 'desc' },
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
      this.handleError(error, 'UserService.exportInvitations');
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

      const result = await this.prisma.invitation.deleteMany({
        where: { id: { in: invitationIds } },
      });

      return {
        count: result.count,
        message: `${result.count} invitations deleted successfully`,
      };
    } catch (error) {
      this.handleError(error, 'UserService.deleteInvitations');
    }
  }

  // ============================================
  // ADDITIONAL GROUP METHODS
  // ============================================

  /**
   * Create multiple groups
   */
  async createGroups(groups: Array<{ name: string; description?: string; permissions?: string[] }>) {
    try {
      if (!groups || groups.length === 0) {
        throw new AppError('At least one group is required', 400);
      }

      const createdGroups: any[] = [];

      for (const groupData of groups) {
        const groupEmail = `${groupData.name.toLowerCase().replace(/\s+/g, '.')}@group.local`;

        const existingGroup = await this.prisma.user.findFirst({ where: { email: groupEmail } });
        if (existingGroup) continue;

        const group = await this.prisma.user.create({
          data: {
            email: groupEmail,
            firstName: groupData.name,
            lastName: '(Group)',
            role: UserRole.USER,
            password: 'GroupPlaceholder123!',
            isActive: true,
            permissions: groupData.permissions || [],
            clerkId: `group_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          },
        });

        createdGroups.push(group);
      }

      return {
        data: createdGroups,
        count: createdGroups.length,
        message: `${createdGroups.length} groups created successfully`,
      };
    } catch (error) {
      this.handleError(error, 'UserService.createGroups');
    }
  }

  /**
   * Delete multiple groups
   */
  async deleteGroups(ids: string[]) {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('At least one group ID is required', 400);
      }

      const result = await this.prisma.user.deleteMany({
        where: {
          id: { in: ids },
          email: { endsWith: '@group.local' },
        },
      });

      return {
        count: result.count,
        message: `${result.count} groups deleted successfully`,
      };
    } catch (error) {
      this.handleError(error, 'UserService.deleteGroups');
    }
  }

  /**
   * Assign users to multiple groups
   */
  async assignUsersToMultipleGroups(assignments: Array<{ groupId: string; userIds: string[] }>) {
    try {
      if (!assignments || assignments.length === 0) {
        throw new AppError('At least one assignment is required', 400);
      }

      const results: any[] = [];

      for (const assignment of assignments) {
        const group = await this.prisma.user.findUnique({ where: { id: assignment.groupId } });
        if (!group || !group.email.endsWith('@group.local')) {
          results.push({ groupId: assignment.groupId, error: 'Group not found' });
          continue;
        }

        const groupPermissions = group.permissions || [];
        const assignedUsers: string[] = [];

        for (const userId of assignment.userIds) {
          const user = await this.prisma.user.findUnique({ where: { id: userId } });
          if (!user) continue;

          const mergedPermissions = [...new Set([...(user.permissions || []), ...groupPermissions])];
          await this.prisma.user.update({
            where: { id: userId },
            data: { permissions: mergedPermissions },
          });
          assignedUsers.push(userId);
        }

        results.push({ groupId: assignment.groupId, assignedCount: assignedUsers.length, assignedUsers });
      }

      return {
        results,
        message: 'Users assigned successfully',
      };
    } catch (error) {
      this.handleError(error, 'UserService.assignUsersToMultipleGroups');
    }
  }

  /**
   * Get group statistics
   */
  async getGroupStats() {
    try {
      const [totalGroups, totalMembers, activeGroups, inactiveGroups] = await Promise.all([
        this.prisma.user.count({ where: { email: { endsWith: '@group.local' } } }),
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isActive: true, email: { endsWith: '@group.local' } } }),
        this.prisma.user.count({ where: { isActive: false, email: { endsWith: '@group.local' } } }),
      ]);

      return {
        totalGroups,
        totalMembers,
        activeGroups,
        inactiveGroups,
        averageMembersPerGroup: totalGroups > 0 ? totalMembers / totalGroups : 0,
        byRole: {},
      };
    } catch (error) {
      this.handleError(error, 'UserService.getGroupStats');
    }
  }

  /**
   * Get group hierarchy
   */
  async getGroupHierarchy() {
    try {
      const groups = await this.prisma.user.findMany({
        where: { email: { endsWith: '@group.local' } },
        select: {
          id: true,
          firstName: true,
          email: true,
          permissions: true,
          isActive: true,
          createdAt: true,
        },
      });

      const buildHierarchy = (parentPermission: string | null, depth: number = 0): any[] => {
        return groups
          .filter((g: any) => {
            if (!parentPermission) {
              return !(g.permissions || []).some((p: string) => p.startsWith('parent:'));
            }
            return (g.permissions || []).includes(parentPermission);
          })
          .map((group: any) => ({
            group: {
              id: group.id,
              name: group.firstName,
              permissions: group.permissions,
              isActive: group.isActive,
            },
            children: buildHierarchy(`parent:${group.id}`, depth + 1),
            depth,
          }));
      };

      return buildHierarchy(null);
    } catch (error) {
      this.handleError(error, 'UserService.getGroupHierarchy');
    }
  }

  /**
   * Get child groups
   */
  async getChildGroups(groupId: string) {
    try {
      return await this.prisma.user.findMany({
        where: {
          email: { endsWith: '@group.local' },
          permissions: { has: `parent:${groupId}` },
        },
        select: {
          id: true,
          firstName: true,
          email: true,
          permissions: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'UserService.getChildGroups');
    }
  }

  /**
   * Get parent group
   */
  async getParentGroup(groupId: string) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group) {
        throw new AppError('Group not found', 404);
      }

      const parentPermission = (group.permissions || []).find((p: string) => p.startsWith('parent:'));
      if (!parentPermission) {
        return null;
      }

      const parentId = parentPermission.replace('parent:', '');
      return await this.prisma.user.findUnique({
        where: { id: parentId },
        select: {
          id: true,
          firstName: true,
          email: true,
          permissions: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.handleError(error, 'UserService.getParentGroup');
    }
  }

  /**
   * Move group
   */
  async moveGroup(groupId: string, parentGroupId?: string) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      if (parentGroupId === groupId) {
        throw new AppError('Group cannot be its own parent', 400);
      }

      let permissions = (group.permissions || []).filter((p: string) => !p.startsWith('parent:'));
      if (parentGroupId) {
        permissions.push(`parent:${parentGroupId}`);
      }

      return await this.prisma.user.update({
        where: { id: groupId },
        data: { permissions },
      });
    } catch (error) {
      this.handleError(error, 'UserService.moveGroup');
    }
  }

  /**
   * Merge groups
   */
  async mergeGroups(sourceGroupId: string, targetGroupId: string) {
    try {
      const [sourceGroup, targetGroup] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: sourceGroupId } }),
        this.prisma.user.findUnique({ where: { id: targetGroupId } }),
      ]);

      if (!sourceGroup || !targetGroup) {
        throw new AppError('Source or target group not found', 404);
      }

      const mergedPermissions = [...new Set([
        ...(targetGroup.permissions || []),
        ...(sourceGroup.permissions || []),
      ])];

      await this.prisma.user.update({
        where: { id: targetGroupId },
        data: { permissions: mergedPermissions },
      });

      await this.prisma.user.delete({ where: { id: sourceGroupId } });

      return targetGroup;
    } catch (error) {
      this.handleError(error, 'UserService.mergeGroups');
    }
  }

  /**
   * Duplicate group
   */
  async duplicateGroup(groupId: string, name?: string) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      const newGroup = await this.prisma.user.create({
        data: {
          email: `${(name || `${group.firstName}_copy`).toLowerCase().replace(/\s+/g, '.')}@group.local`,
          firstName: name || `${group.firstName} (Copy)`,
          lastName: '(Group)',
          role: UserRole.USER,
          password: 'GroupPlaceholder123!',
          isActive: true,
          permissions: group.permissions || [],
          clerkId: `group_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        },
      });

      return newGroup;
    } catch (error) {
      this.handleError(error, 'UserService.duplicateGroup');
    }
  }

  /**
   * Activate group
   */
  async activateGroup(groupId: string) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      return await this.prisma.user.update({
        where: { id: groupId },
        data: { isActive: true },
      });
    } catch (error) {
      this.handleError(error, 'UserService.activateGroup');
    }
  }

  /**
   * Deactivate group
   */
  async deactivateGroup(groupId: string) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      return await this.prisma.user.update({
        where: { id: groupId },
        data: { isActive: false },
      });
    } catch (error) {
      this.handleError(error, 'UserService.deactivateGroup');
    }
  }

  /**
   * Archive group
   */
  async archiveGroup(groupId: string) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      const permissions = [...(group.permissions || []), 'group:archived'];
      return await this.prisma.user.update({
        where: { id: groupId },
        data: { isActive: false, permissions },
      });
    } catch (error) {
      this.handleError(error, 'UserService.archiveGroup');
    }
  }

  /**
   * Add permissions to group
   */
  async addGroupPermissions(groupId: string, permissions: string[]) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      const mergedPermissions = [...new Set([...(group.permissions || []), ...permissions])];
      return await this.prisma.user.update({
        where: { id: groupId },
        data: { permissions: mergedPermissions },
      });
    } catch (error) {
      this.handleError(error, 'UserService.addGroupPermissions');
    }
  }

  /**
   * Remove permissions from group
   */
  async removeGroupPermissions(groupId: string, permissions: string[]) {
    try {
      const group = await this.prisma.user.findUnique({ where: { id: groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        throw new AppError('Group not found', 404);
      }

      const filteredPermissions = (group.permissions || []).filter((p: string) => !permissions.includes(p));
      return await this.prisma.user.update({
        where: { id: groupId },
        data: { permissions: filteredPermissions },
      });
    } catch (error) {
      this.handleError(error, 'UserService.removeGroupPermissions');
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;

      const where = { role };
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            businessUnits: {
              where: { isActive: true },
              include: { businessUnit: true },
            },
            company: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data: users,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserService.getUsersByRole');
    }
  }

  /**
   * Search users
   */
  async searchUsers(query: string, filters: { role?: UserRole; isActive?: boolean; page?: number; limit?: number } = {}) {
    try {
      if (!query) {
        throw new AppError('Search query is required', 400);
      }

      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const where: any = {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phoneNumber: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (filters.role) where.role = filters.role;
      if (filters.isActive !== undefined) where.isActive = filters.isActive;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          include: {
            businessUnits: {
              where: { isActive: true },
              include: { businessUnit: true },
            },
            company: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data: users,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit,
      };
    } catch (error) {
      this.handleError(error, 'UserService.searchUsers');
    }
  }

  /**
   * Get user permissions
   */
  async getUserPermissions(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { permissions: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return user.permissions || [];
    } catch (error) {
      this.handleError(error, 'UserService.getUserPermissions');
    }
  }

  /**
   * Check user permission
   */
  async checkUserPermission(userId: string, permission: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { permissions: true, role: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const hasPermission = user.role === UserRole.SUPER_ADMIN || 
                           (user.permissions || []).includes(permission);

      return { hasPermission };
    } catch (error) {
      this.handleError(error, 'UserService.checkUserPermission');
    }
  }

  /**
   * Bulk assign business units
   */
  async bulkAssignBusinessUnits(userIds: string[], businessUnitId: string, role: UserRole = UserRole.EMPLOYEE) {
    try {
      if (!userIds || userIds.length === 0) {
        throw new AppError('User IDs array is required', 400);
      }

      const businessUnit = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      const results: any[] = [];

      for (const userId of userIds) {
        try {
          const user = await this.prisma.user.findUnique({ where: { id: userId } });
          if (!user) {
            results.push({ userId, success: false, error: 'User not found' });
            continue;
          }

          const existingAssignment = await this.prisma.businessUnitUser.findFirst({
            where: { userId, businessUnitId },
          });

          if (existingAssignment) {
            if (existingAssignment.isActive) {
              results.push({ userId, success: false, error: 'Already assigned' });
              continue;
            }
            await this.prisma.businessUnitUser.update({
              where: { id: existingAssignment.id },
              data: { isActive: true, role },
            });
            results.push({ userId, success: true });
          } else {
            await this.prisma.businessUnitUser.create({
              data: { userId, businessUnitId, role, isActive: true },
            });
            results.push({ userId, success: true });
          }
        } catch (error: any) {
          results.push({ userId, success: false, error: error?.message || 'Failed to assign' });
        }
      }

      return {
        total: userIds.length,
        successCount: results.filter(r => r.success).length,
        failedCount: results.filter(r => !r.success).length,
        results,
      };
    } catch (error) {
      this.handleError(error, 'UserService.bulkAssignBusinessUnits');
    }
  }

  /**
   * Bulk remove business units
   */
  async bulkRemoveBusinessUnits(userIds: string[], businessUnitId: string) {
    try {
      if (!userIds || userIds.length === 0) {
        throw new AppError('User IDs array is required', 400);
      }

      const results: any[] = [];

      for (const userId of userIds) {
        try {
          const assignment = await this.prisma.businessUnitUser.findFirst({
            where: { userId, businessUnitId },
          });

          if (!assignment) {
            results.push({ userId, success: false, error: 'Not assigned' });
            continue;
          }

          await this.prisma.businessUnitUser.delete({
            where: { id: assignment.id },
          });

          results.push({ userId, success: true });
        } catch (error: any) {
          results.push({ userId, success: false, error: error?.message || 'Failed to remove' });
        }
      }

      return {
        total: userIds.length,
        successCount: results.filter(r => r.success).length,
        failedCount: results.filter(r => !r.success).length,
        results,
      };
    } catch (error) {
      this.handleError(error, 'UserService.bulkRemoveBusinessUnits');
    }
  }
}

export default UserService;
