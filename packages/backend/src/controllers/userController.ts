// D:\Projects\Kalwanga\packages\backend\src\controllers\userController.ts

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// Import ALL_PERMISSIONS from auth
import { ALL_PERMISSIONS } from '../middleware/auth.js';

// Import UserRole from prisma client directly
import { UserRole } from '../generated/prisma/index.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessUnitId: z.string().optional().nullable(),
  clerkId: z.string().optional(),
  companyId: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phoneNumber: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  businessUnitId: z.string().optional().nullable(),
  permissions: z.array(z.string()).optional(),
});

const updateUserRoleSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']),
});

const assignBusinessUnitSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
});

const bulkActionSchema = z.object({
  ids: z.array(z.string()).min(1, 'At least one ID is required'),
});

const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

const getActivitySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  ipAddress: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const clearActivitySchema = z.object({
  beforeDate: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
});

const importUsersSchema = z.object({
  skipDuplicates: z.string().optional().default('true'),
  skipInvalid: z.string().optional().default('true'),
  sendWelcomeEmail: z.string().optional().default('false'),
  defaultPassword: z.string().optional(),
  autoActivate: z.string().optional().default('true'),
  batchSize: z.string().optional().default('100'),
});

const getImportHistorySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  fileName: z.string().optional(),
});

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']),
  businessUnitId: z.string().optional(),
  message: z.string().optional(),
  expiresIn: z.number().int().min(0).max(365).optional().default(7),
  sendEmail: z.boolean().optional().default(true),
  metadata: z.record(z.string(), z.any()).optional(),
});

const getInvitationsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.string().optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(100),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
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
// CONSTANTS
// ============================================

const REQUIRED_HEADERS = ['email', 'firstName', 'lastName', 'role'];
const OPTIONAL_HEADERS = ['phoneNumber', 'businessUnitId', 'isActive', 'permissions', 'companyId', 'avatar', 'password'];

const IMPORT_TEMPLATES: Record<string, any> = {
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

const INVITATION_TEMPLATES: Record<string, any> = {
  standard: {
    id: 'standard',
    name: 'Standard Invitation',
    subject: "You've been invited to join our platform",
    body: 'Hello,\n\nYou have been invited to join our platform. Click the link below to get started:\n\n[Invitation Link]\n\nBest regards,\nThe Team',
    role: 'USER',
    variables: ['[Invitation Link]', '[Role]', '[Email]'],
    isDefault: true,
  },
  welcome: {
    id: 'welcome',
    name: 'Welcome Message',
    subject: 'Welcome to our team!',
    body: "Welcome aboard!\n\nWe're excited to have you join our team. Click here to complete your registration:\n[Invitation Link]",
    role: 'EMPLOYEE',
    variables: ['[Invitation Link]', '[Role]', '[Email]'],
    isDefault: false,
  },
  admin: {
    id: 'admin',
    name: 'Admin Invitation',
    subject: "You've been granted administrative access",
    body: 'Hello,\n\nYou have been granted administrative access to our platform. Please use the link below to set up your account:\n\n[Invitation Link]\n\nThis invitation will expire in [Expiry Time].\n\nRegards,\nThe Team',
    role: 'ADMIN',
    variables: ['[Invitation Link]', '[Role]', '[Email]', '[Expiry Time]'],
    isDefault: false,
  },
};

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
    console.error('UserController error:', error);
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

async function getOrCreateDefaultBusinessUnit(companyId?: string) {
  try {
    if (!companyId) {
      const firstCompany = await prisma.company.findFirst();
      if (!firstCompany) {
        console.error('⚠️ No company found in database. Cannot create business unit.');
        return null;
      }
      companyId = firstCompany.id;
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
    }

    return businessUnit;
  } catch (error) {
    console.error('Failed to get/create default business unit:', error);
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
      if (currentRow.some((field: string) => field !== '')) {
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
    if (currentRow.some((field: string) => field !== '')) {
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

// Helper to safely access audit log changes
function getAuditLogChanges(log: any): any {
  return log.changes || {};
}

function getAuditLogStatus(log: any): string {
  const changes = getAuditLogChanges(log);
  return changes.status || 'completed';
}

function getAuditLogSuccessCount(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.successCount || 0;
}

function getAuditLogFailedCount(log: any): number {
  const changes = getAuditLogChanges(log);
  return changes.failedCount || 0;
}

// ============================================
// USER CONTROLLER
// ============================================

export const userController = {
  // ============================================
  // CORE USER CRUD OPERATIONS
  // ============================================

  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        page = '1',
        limit = '10',
        search,
        role,
        businessUnitId,
        companyId,
        isActive,
      } = req.query;

      const where: any = {};

      if (search) {
        where.OR = [
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      if (role) where.role = role as UserRole;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      if (companyId) where.companyId = companyId as string;

      if (businessUnitId) {
        where.businessUnits = {
          some: {
            businessUnitId: businessUnitId as string,
          },
        };
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: {
            businessUnits: {
              include: {
                businessUnit: true,
              },
            },
            company: true,
          },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      return res.json({
        success: true,
        data: sanitizeUsers(users),
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          limit: Number(limit),
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
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

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return res.json({
        success: true,
        data: sanitizeUser(user),
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  // ============================================
  // NEW METHOD: Get user by email
  // ============================================
  async getUserByEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;

      if (!email) {
        throw new AppError('Email is required', 400);
      }

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        include: {
          businessUnits: {
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return res.json({
        success: true,
        data: sanitizeUser(user),
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  // ============================================
  // NEW METHOD: Get user statistics
  // ============================================
  async getUserStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const [total, active, inactive, byRole] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { isActive: false } }),
        prisma.user.groupBy({
          by: ['role'],
          _count: { _all: true },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          total,
          active,
          inactive,
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

  // ============================================
  // NEW METHOD: Get users by role
  // ============================================
  async getUsersByRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { role } = req.params;
      const { page = '1', limit = '10' } = req.query;

      if (!role) {
        throw new AppError('Role is required', 400);
      }

      const where: any = { role: role as UserRole };

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: {
            businessUnits: {
              include: {
                businessUnit: true,
              },
            },
            company: true,
          },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      return res.json({
        success: true,
        data: sanitizeUsers(users),
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          limit: Number(limit),
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  // ============================================
  // NEW METHOD: Search users
  // ============================================
  async searchUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, page = '1', limit = '10', role, isActive } = req.query;

      if (!q || typeof q !== 'string') {
        throw new AppError('Search query is required', 400);
      }

      const where: any = {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phoneNumber: { contains: q, mode: 'insensitive' } },
        ],
      };

      if (role) where.role = role as UserRole;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          include: {
            businessUnits: {
              include: {
                businessUnit: true,
              },
            },
            company: true,
          },
          skip: (Number(page) - 1) * Number(limit),
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
        }),
        prisma.user.count({ where }),
      ]);

      return res.json({
        success: true,
        data: sanitizeUsers(users),
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          limit: Number(limit),
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  // ============================================
  // NEW METHOD: Get user permissions
  // ============================================
  async getUserPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: { permissions: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return res.json({
        success: true,
        data: user.permissions || [],
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  // ============================================
  // NEW METHOD: Check user permission
  // ============================================
  async checkUserPermission(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, permission } = req.params;

      const user = await prisma.user.findUnique({
        where: { id },
        select: { permissions: true, role: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const hasPermission = user.role === UserRole.SUPER_ADMIN || 
                           (user.permissions || []).includes(permission);

      return res.json({
        success: true,
        data: { hasPermission },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getUserByIdentifier(req: Request, res: Response, next: NextFunction) {
    try {
      const { identifier } = req.params;

      if (!identifier) {
        throw new AppError('User identifier is required', 400);
      }

      let user = null;
      const isClerkId = identifier.startsWith('user_') || identifier.startsWith('clerk_');
      
      if (isClerkId) {
        user = await prisma.user.findUnique({
          where: { clerkId: identifier },
          include: {
            businessUnits: {
              include: {
                businessUnit: true,
              },
            },
            company: true,
          },
        });
      } else {
        user = await prisma.user.findUnique({
          where: { id: identifier },
          include: {
            businessUnits: {
              include: {
                businessUnit: true,
              },
            },
            company: true,
          },
        });

        if (!user) {
          user = await prisma.user.findUnique({
            where: { clerkId: identifier },
            include: {
              businessUnits: {
                include: {
                  businessUnit: true,
                },
              },
              company: true,
            },
          });
        }
      }

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return res.json({
        success: true,
        data: sanitizeUser(user),
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getUserByClerkId(req: Request, res: Response, next: NextFunction) {
    try {
      const { clerkId } = req.params;

      if (!clerkId) {
        throw new AppError('Clerk ID is required', 400);
      }

      const user = await prisma.user.findUnique({
        where: { clerkId },
        include: {
          businessUnits: {
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return res.json({
        success: true,
        data: sanitizeUser(user),
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).userId;

      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          businessUnits: {
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return res.json({
        success: true,
        data: sanitizeUser(user),
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📥 Received body in createUser:', req.body);
      console.log('📥 Body type:', typeof req.body);
      console.log('📥 Body keys:', Object.keys(req.body || {}));
      
      // Parse and validate the body
      const data = createUserSchema.parse(req.body);
      console.log('✅ Validation passed. Data:', {
        ...data,
        password: data.password ? '***' : undefined,
      });

      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      const currentUserId = (req as any).user?.id || (req as any).userId;
      let currentUserRole = (req as any).user?.role || 'USER';
      
      if (!currentUserId) {
        currentUserRole = 'SUPER_ADMIN';
      }

      const isSuperAdmin = currentUserRole === 'SUPER_ADMIN';
      const isAdmin = currentUserRole === 'ADMIN';
      
      if (data.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can create SUPER_ADMIN users', 403);
      }
      
      if (data.role === 'ADMIN' && !isSuperAdmin && !isAdmin) {
        throw new AppError('Only SUPER_ADMIN or ADMIN can create ADMIN users', 403);
      }
      
      if (data.role === 'MANAGER' && !isSuperAdmin && !isAdmin) {
        const isManager = currentUserRole === 'MANAGER';
        if (!isManager) {
          throw new AppError('Only SUPER_ADMIN, ADMIN, or MANAGER can create MANAGER users', 403);
        }
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);

      let userPermissions: string[] = [];
      
      if (data.permissions && data.permissions.length > 0) {
        userPermissions = data.permissions;
      } else {
        userPermissions = getDefaultPermissionsForRole(data.role as UserRole);
      }

      let finalBusinessUnitId: string | null = null;
      
      if (data.businessUnitId) {
        const businessUnit = await prisma.businessUnit.findUnique({
          where: { id: data.businessUnitId },
        });
        
        if (businessUnit) {
          finalBusinessUnitId = data.businessUnitId;
        }
      }

      if (!finalBusinessUnitId) {
        const existingBusinessUnit = await prisma.businessUnit.findFirst({
          where: data.companyId ? { companyId: data.companyId } : {},
        });
        
        if (existingBusinessUnit) {
          finalBusinessUnitId = existingBusinessUnit.id;
        } else {
          const defaultBusinessUnit = await getOrCreateDefaultBusinessUnit(data.companyId);
          if (defaultBusinessUnit) {
            finalBusinessUnitId = defaultBusinessUnit.id;
          }
        }
      }

      const result = await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({
          data: {
            clerkId: data.clerkId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber || null,
            role: data.role as UserRole,
            password: hashedPassword,
            isActive: true,
            companyId: data.companyId || null,
            permissions: userPermissions,
          },
        });

        if (finalBusinessUnitId) {
          await tx.businessUnitUser.create({
            data: {
              userId: user.id,
              businessUnitId: finalBusinessUnitId,
              role: data.role as UserRole,
              isActive: true,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            action: 'CREATE',
            entityType: 'USER',
            entityId: user.id,
            userId: currentUserId || user.id,
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

      const userWithRelations = await prisma.user.findUnique({
        where: { id: result.id },
        include: {
          businessUnits: {
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });

      return res.status(201).json({
        success: true,
        data: sanitizeUser(userWithRelations || result),
        message: 'User created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateUserSchema.parse(req.body);

      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new AppError('User not found', 404);
      }

      const currentUserId = (req as any).user?.id || (req as any).userId;
      let isSuperAdmin = false;
      
      if (currentUserId) {
        try {
          const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
          });
          if (currentUser) {
            isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
          }
        } catch (e) {}
      }

      if (existingUser.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can modify SUPER_ADMIN users', 403);
      }
      
      if (data.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can assign SUPER_ADMIN role', 403);
      }

      const updateData: any = { ...data };

      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }

      if (updateData.role) {
        updateData.role = updateData.role as UserRole;
      }

      let finalBusinessUnitId: string | null = null;
      
      if (data.businessUnitId !== undefined) {
        if (data.businessUnitId) {
          const businessUnit = await prisma.businessUnit.findUnique({
            where: { id: data.businessUnitId },
          });
          if (!businessUnit) {
            throw new AppError('Business unit not found', 404);
          }
          finalBusinessUnitId = data.businessUnitId;
        }
      }

      if (data.permissions) {
        if ((existingUser.role === 'ADMIN' || existingUser.role === 'SUPER_ADMIN') && !isSuperAdmin) {
          throw new AppError('Only SUPER_ADMIN can modify permissions for ADMIN or SUPER_ADMIN users', 403);
        }
        updateData.permissions = data.permissions;
      }

      const user = await prisma.$transaction(async (tx: any) => {
        const updatedUser = await tx.user.update({
          where: { id },
          data: updateData,
          include: {
            businessUnits: {
              include: {
                businessUnit: true,
              },
            },
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

        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entityType: 'USER',
            entityId: id,
            userId: currentUserId || id,
            entityName: `${updatedUser.firstName} ${updatedUser.lastName}`,
            changes: {
              updatedFields: Object.keys(updateData),
              businessUnitId: finalBusinessUnitId,
            },
            severity: 'INFO',
          },
        });

        return updatedUser;
      });

      return res.json({
        success: true,
        data: sanitizeUser(user),
        message: 'User updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await prisma.user.update({
        where: { id },
        data: {
          isActive: false,
        },
      });

      return res.json({
        success: true,
        data: sanitizeUser(user),
        message: 'User deactivated successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async activateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await prisma.user.update({
        where: { id },
        data: { isActive: true },
        include: {
          businessUnits: {
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });

      return res.json({
        success: true,
        data: sanitizeUser(user),
        message: 'User activated successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async deactivateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        include: {
          businessUnits: {
            include: {
              businessUnit: true,
            },
          },
          company: true,
        },
      });

      return res.json({
        success: true,
        data: sanitizeUser(user),
        message: 'User deactivated successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async assignBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, businessUnitId } = req.params;
      const { role } = assignBusinessUnitSchema.parse(req.body);

      const businessUnit = await prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      const existingAssignment = await prisma.businessUnitUser.findFirst({
        where: {
          userId,
          businessUnitId,
        },
      });

      if (existingAssignment) {
        throw new AppError('User is already assigned to this business unit', 400);
      }

      const assignment = await prisma.businessUnitUser.create({
        data: {
          userId,
          businessUnitId,
          role: (role || 'EMPLOYEE') as UserRole,
          isActive: true,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          businessUnit: true,
        },
      });

      return res.status(201).json({
        success: true,
        data: assignment,
        message: 'User assigned to business unit successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  async removeBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, businessUnitId } = req.params;

      const assignment = await prisma.businessUnitUser.findFirst({
        where: { userId, businessUnitId },
      });

      if (!assignment) {
        throw new AppError('User is not assigned to this business unit', 404);
      }

      await prisma.businessUnitUser.delete({
        where: { id: assignment.id },
      });

      return res.json({
        success: true,
        message: 'User removed from business unit successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async getUsersByBusinessUnit(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.params;

      const users = await prisma.user.findMany({
        where: {
          businessUnits: {
            some: {
              businessUnitId,
            },
          },
        },
        include: {
          businessUnits: {
            where: {
              businessUnitId,
            },
            include: {
              businessUnit: true,
            },
          },
        },
      });

      return res.json({
        success: true,
        data: sanitizeUsers(users),
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { role } = updateUserRoleSchema.parse(req.body);

      const currentUserId = (req as any).user?.id || (req as any).userId;
      let isSuperAdmin = false;
      
      if (currentUserId) {
        try {
          const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
          });
          if (currentUser) {
            isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
          }
        } catch (e) {}
      }

      const targetUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!targetUser) {
        throw new AppError('User not found', 404);
      }

      if (targetUser.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can modify SUPER_ADMIN users', 403);
      }
      
      if (role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can assign SUPER_ADMIN role', 403);
      }

      if (role === 'ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can create ADMIN users', 403);
      }

      const user = await prisma.user.update({
        where: { id },
        data: { role: role as UserRole },
        include: {
          businessUnits: {
            include: { businessUnit: true },
          },
          company: true,
        },
      });

      return res.json({
        success: true,
        data: sanitizeUser(user),
        message: `User role updated to ${role}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  async updateUserPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { permissions } = updatePermissionsSchema.parse(req.body);

      const currentUserId = (req as any).user?.id || (req as any).userId;
      let isSuperAdmin = false;
      
      if (currentUserId) {
        try {
          const currentUser = await prisma.user.findUnique({
            where: { id: currentUserId },
          });
          if (currentUser) {
            isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
          }
        } catch (e) {}
      }

      const targetUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!targetUser) {
        throw new AppError('User not found', 404);
      }

      if ((targetUser.role === 'ADMIN' || targetUser.role === 'SUPER_ADMIN') && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can modify permissions for ADMIN or SUPER_ADMIN users', 403);
      }

      const user = await prisma.user.update({
        where: { id },
        data: { permissions: permissions as any },
        include: {
          businessUnits: {
            include: { businessUnit: true },
          },
          company: true,
        },
      });

      return res.json({
        success: true,
        data: sanitizeUser(user),
        message: 'User permissions updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  async exportUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { format = 'csv' } = req.query;

      const users = await prisma.user.findMany({
        include: {
          businessUnits: {
            include: { businessUnit: true },
          },
          company: true,
        },
      });

      if (format === 'csv') {
        const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Role', 'Status', 'Created At'];
        const rows = users.map((user: any) => [
          user.id,
          user.email,
          user.firstName,
          user.lastName,
          user.role,
          user.isActive ? 'Active' : 'Inactive',
          user.createdAt.toISOString(),
        ]);

        const csvContent = [headers, ...rows].map((row: any[]) => row.join(',')).join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=users_${Date.now()}.csv`);
        return res.send(csvContent);
      }

      return res.json({
        success: true,
        data: sanitizeUsers(users),
        total: users.length,
        format: 'json',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async bulkActivateUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = bulkActionSchema.parse(req.body);

      const result = await prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { isActive: true },
      });

      return res.json({
        success: true,
        message: `${result.count} users activated successfully`,
        count: result.count,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  async bulkDeactivateUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = bulkActionSchema.parse(req.body);

      const result = await prisma.user.updateMany({
        where: { id: { in: ids } },
        data: { isActive: false },
      });

      return res.json({
        success: true,
        message: `${result.count} users deactivated successfully`,
        count: result.count,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  async bulkDeleteUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = bulkActionSchema.parse(req.body);

      const result = await prisma.user.deleteMany({
        where: { id: { in: ids } },
      });

      return res.json({
        success: true,
        message: `${result.count} users deleted successfully`,
        count: result.count,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  // ============================================
  // USER ACTIVITY OPERATIONS (Using AuditLog)
  // ============================================

  async getUserActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const params = getActivitySchema.parse(req.query);
      
      const user = await prisma.user.findUnique({ where: { id } });
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);
      const skip = (page - 1) * limit;
      
      const where: any = { userId: id };
      
      if (params.action) {
        where.action = params.action;
      }
      
      if (params.entityType) {
        where.entityType = params.entityType;
      }
      
      if (params.search) {
        where.OR = [
          { entityName: { contains: params.search, mode: 'insensitive' } },
          { entityType: { contains: params.search, mode: 'insensitive' } },
        ];
      }
      
      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
        if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
      }
      
      const [activities, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);
      
      return res.json({
        success: true,
        data: activities,
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

  async getUserAuditTrail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page = '1', limit = '20' } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;
      
      const [auditLogs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: { userId: id },
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where: { userId: id } }),
      ]);
      
      return res.json({
        success: true,
        data: auditLogs,
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

  async clearUserActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { beforeDate, action, entityType } = clearActivitySchema.parse(req.query);
      
      const where: any = { userId: id };
      if (beforeDate) {
        where.createdAt = { lt: new Date(beforeDate) };
      }
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      
      const result = await prisma.auditLog.deleteMany({ where });
      
      return res.json({
        success: true,
        message: `Cleared ${result.count} activities`,
        cleared: result.count,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  // ============================================
  // USER IMPORT OPERATIONS
  // ============================================

  async importUsers(req: Request & { file?: Express.Multer.File }, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }
      
      const params = importUsersSchema.parse(req.body);
      const file = req.file;
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      let rows: string[][] = [];
      if (fileExtension === '.csv') {
        const content = fs.readFileSync(file.path, 'utf-8');
        rows = parseCSVContentSimple(content);
      } else {
        fs.unlinkSync(file.path);
        throw new AppError('Invalid file format. Only CSV files are supported.', 400);
      }
      
      fs.unlinkSync(file.path);
      
      if (rows.length < 2) {
        throw new AppError('File must contain at least a header row and one data row', 400);
      }
      
      const headers = rows[0];
      const dataRows = rows.slice(1);
      
      const missingHeaders = REQUIRED_HEADERS.filter((h: string) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
      }
      
      const { users, errors, warnings } = validateImportData(dataRows, headers);
      const validUsers = users.filter((u: any) => u.status === 'valid' || u.status === 'warning');
      
      const importedUsers: string[] = [];
      const failedUsers: string[] = [];
      const importErrors: any[] = [];
      
      for (const user of validUsers) {
        try {
          if (params.skipDuplicates === 'true') {
            const existingUser = await prisma.user.findUnique({
              where: { email: user.email },
            });
            
            if (existingUser) {
              failedUsers.push(user.email);
              importErrors.push({ rowNumber: user.rowNumber, email: user.email, error: 'User already exists' });
              continue;
            }
          }
          
          const hashedPassword = await bcrypt.hash(
            user.password || params.defaultPassword || 'DefaultPass123!',
            10
          );
          
          const newUser = await prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              firstName: user.firstName,
              lastName: user.lastName,
              phoneNumber: user.phoneNumber,
              role: user.role,
              password: hashedPassword,
              isActive: user.isActive !== undefined ? user.isActive : params.autoActivate === 'true',
              permissions: user.permissions || [],
              companyId: user.companyId,
              clerkId: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            },
          });
          
          importedUsers.push(user.email);
          
          await prisma.auditLog.create({
            data: {
              action: 'IMPORT',
              entityType: 'USER',
              entityId: newUser.id,
              userId: (req as any).user?.id || newUser.id,
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
      
      await prisma.auditLog.create({
        data: {
          action: 'IMPORT',
          entityType: 'USER_IMPORT',
          entityId: `import_${startTime}`,
          userId: (req as any).user?.id || 'system',
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
            importedBy: (req as any).user?.email || 'Unknown',
            importDuration,
            errorSummary: importErrors.length > 0 ? `${importErrors.length} errors` : undefined,
          },
          severity: status === 'completed' ? 'INFO' : status === 'partial' ? 'LOW' : 'MEDIUM',
        },
      });
      
      return res.json({
        success: true,
        data: {
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
        },
        message: `Imported ${importedUsers.length} users successfully`,
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  async getImportHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const params = getImportHistorySchema.parse(req.query);
      const page = parseInt(params.page);
      const limit = parseInt(params.limit);
      const skip = (page - 1) * limit;
      
      const where: any = {
        entityType: 'USER_IMPORT',
      };
      
      if (params.fileName) {
        where.entityName = { contains: params.fileName, mode: 'insensitive' };
      }
      
      if (params.dateFrom || params.dateTo) {
        where.createdAt = {};
        if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom);
        if (params.dateTo) where.createdAt.lte = new Date(params.dateTo);
      }
      
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.auditLog.count({ where }),
      ]);
      
      const formattedHistory = logs.map((log: any) => ({
        id: log.id,
        fileName: log.entityName,
        fileSize: getAuditLogChanges(log).fileSize || 0,
        totalRows: getAuditLogChanges(log).totalRows || 0,
        successCount: getAuditLogSuccessCount(log),
        failedCount: getAuditLogFailedCount(log),
        warningCount: getAuditLogChanges(log).warningCount || 0,
        skippedCount: getAuditLogChanges(log).skippedCount || 0,
        status: getAuditLogStatus(log),
        importedBy: getAuditLogChanges(log).importedBy || 'Unknown',
        importDuration: getAuditLogChanges(log).importDuration || 0,
        errorSummary: getAuditLogChanges(log).errorSummary,
        importedAt: log.createdAt.toISOString(),
      }));
      
      return res.json({
        success: true,
        data: formattedHistory,
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

  // ============================================
  // USER INVITATION OPERATIONS
  // ============================================

  async inviteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const data = inviteUserSchema.parse(req.body);
      
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });
      
      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }
      
      const existingInvitation = await (prisma as any).invitation.findFirst({
        where: {
          email: data.email.toLowerCase(),
          status: { in: ['pending', 'sent'] },
        },
      });
      
      if (existingInvitation) {
        return res.status(200).json({
          success: true,
          data: {
            id: existingInvitation.id,
            email: data.email,
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
          action: 'CREATE',
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: (req as any).user?.id || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, role: invitation.role, invitedBy: invitation.invitedBy },
          severity: 'INFO',
        },
      });
      
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
          action: 'UPDATE',
          entityType: 'INVITATION',
          entityId: invitation.id,
          userId: (req as any).user?.id || invitation.id,
          entityName: invitation.email,
          changes: { email: invitation.email, reminderCount: updatedInvitation.reminderCount },
          severity: 'INFO',
        },
      });
      
      return res.json({
        success: true,
        data: updatedInvitation,
        message: 'Invitation resent successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  async deleteInvitation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      const invitation = await (prisma as any).invitation.findUnique({ where: { id } });
      
      if (!invitation) {
        throw new AppError('Invitation not found', 404);
      }
      
      await (prisma as any).invitation.delete({ where: { id } });
      
      return res.json({
        success: true,
        message: 'Invitation deleted successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

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

  // ============================================
  // USER GROUP OPERATIONS
  // ============================================

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
      
      const [groups, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            businessUnits: true,
            company: true,
          },
        }),
        prisma.user.count({ where }),
      ]);
      
      // Transform groups to match frontend expectations
      const transformedGroups = groups.map((group: any) => ({
        id: group.id,
        name: group.firstName,
        description: group.description || '',
        icon: group.icon || 'Users',
        color: group.color || 'bg-blue-500',
        permissions: group.permissions || [],
        isActive: group.isActive,
        createdBy: group.createdBy || 'System',
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: 0,
        members: [],
        businessUnitId: group.businessUnits?.[0]?.businessUnitId || undefined,
      }));
      
      return res.json({
        success: true,
        data: transformedGroups,
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
};

// ============================================
// ADDITIONAL USER ACTIVITY METHODS (Exported)
// ============================================

export const getUserActivityStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { dateRange = 'month' } = req.query as { dateRange?: string };
    
    const user = await prisma.user.findUnique({ where: { id } });
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

    const where: any = { userId: id, createdAt: { gte: dateFrom } };

    const [total, byAction, bySeverity] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { _all: true },
      }),
      prisma.auditLog.groupBy({
        by: ['severity'],
        where,
        _count: { _all: true },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        total,
        byAction: byAction.reduce((acc: Record<string, number>, item: any) => {
          acc[item.action] = item._count._all;
          return acc;
        }, {}),
        bySeverity: bySeverity.reduce((acc: Record<string, number>, item: any) => {
          acc[item.severity] = item._count._all;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getUserActivityTrends = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { period = 'week' } = req.query as { period?: string };
    
    const user = await prisma.user.findUnique({ where: { id } });
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

    const activities = await prisma.auditLog.findMany({
      where: { userId: id, createdAt: { gte: dateFrom } },
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

    return res.json({
      success: true,
      data: {
        labels,
        values,
        total: values.reduce((sum: number, val: number) => sum + val, 0),
        average: values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : 0,
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getRecentUserActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const activities = await prisma.auditLog.findMany({
      where: { userId: id },
      take: Math.min(limit, 50),
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getUserActivityById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, activityId } = req.params;
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const activity = await prisma.auditLog.findFirst({
      where: { id: activityId, userId: id },
    });

    if (!activity) {
      throw new AppError('Activity not found', 404);
    }

    return res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const exportUserActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const format = (req.query.format as string) || 'json';
    
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const activities = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      return res.json({
        success: true,
        data: activities,
        total: activities.length,
        format: 'json',
      });
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
      const csvContent = [headers, ...rows].map((row: any[]) => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=user_activity_${id}_${Date.now()}.csv`);
      return res.send(csvContent);
    }

    throw new AppError('Invalid export format', 400);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const exportUserAuditTrail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const format = (req.query.format as string) || 'json';
    
    const auditLogs = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
      return res.json({
        success: true,
        data: auditLogs,
        total: auditLogs.length,
        format: 'json',
      });
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
      const csvContent = [headers, ...rows].map((row: any[]) => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=user_audit_trail_${id}_${Date.now()}.csv`);
      return res.send(csvContent);
    }

    throw new AppError('Invalid export format', 400);
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ============================================
// ADDITIONAL USER IMPORT METHODS
// ============================================

export const importUsersFromCSV = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  try {
    const { content, skipDuplicates = true, autoActivate = true, defaultPassword } = req.body;
    
    if (!content) {
      throw new AppError('CSV content is required', 400);
    }

    const rows = parseCSVContentSimple(content);
    
    if (rows.length < 2) {
      throw new AppError('CSV must contain at least a header row and one data row', 400);
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    const missingHeaders = REQUIRED_HEADERS.filter((h: string) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new AppError(`Missing required headers: ${missingHeaders.join(', ')}`, 400);
    }

    const { users, errors, warnings } = validateImportData(dataRows, headers);
    const validUsers = users.filter((u: any) => u.status === 'valid' || u.status === 'warning');
    
    const importedUsers: string[] = [];
    const failedUsers: string[] = [];

    for (const user of validUsers) {
      try {
        if (skipDuplicates) {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (existingUser) {
            failedUsers.push(user.email);
            continue;
          }
        }

        const hashedPassword = await bcrypt.hash(
          user.password || defaultPassword || 'DefaultPass123!',
          10
        );

        await prisma.user.create({
          data: {
            email: user.email.toLowerCase(),
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            password: hashedPassword,
            isActive: autoActivate,
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

    return res.json({
      success: true,
      data: {
        totalRows: users.length,
        successCount: importedUsers.length,
        failedCount: failedUsers.length,
        warningCount: warnings.length,
        skippedCount: users.length - validUsers.length,
        errors,
        warnings,
        importedUsers,
        failedUsers,
        importDuration: Date.now() - startTime,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(error, res);
    }
    return handleError(error, res, next);
  }
};

export const importUsersFromJSON = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  try {
    const { users, skipDuplicates = true, autoActivate = true, defaultPassword } = req.body;
    
    if (!users || !Array.isArray(users) || users.length === 0) {
      throw new AppError('At least one user is required', 400);
    }

    const importedUsers: string[] = [];
    const failedUsers: string[] = [];
    const errors: any[] = [];

    for (const userData of users) {
      try {
        if (skipDuplicates) {
          const existingUser = await prisma.user.findUnique({
            where: { email: userData.email },
          });
          if (existingUser) {
            failedUsers.push(userData.email);
            errors.push({ email: userData.email, error: 'User already exists' });
            continue;
          }
        }

        const hashedPassword = await bcrypt.hash(
          defaultPassword || 'DefaultPass123!',
          10
        );

        await prisma.user.create({
          data: {
            email: userData.email.toLowerCase(),
            firstName: userData.firstName,
            lastName: userData.lastName,
            phoneNumber: userData.phoneNumber,
            role: userData.role,
            password: hashedPassword,
            isActive: userData.isActive !== undefined ? userData.isActive : autoActivate,
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

    return res.json({
      success: true,
      data: {
        totalRows: users.length,
        successCount: importedUsers.length,
        failedCount: failedUsers.length,
        warningCount: 0,
        skippedCount: 0,
        errors,
        warnings: [],
        importedUsers,
        failedUsers,
        importDuration: Date.now() - startTime,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(error, res);
    }
    return handleError(error, res, next);
  }
};

export const validateImportDataHandler = async (req: Request & { file?: Express.Multer.File }, res: Response, next: NextFunction) => {
  try {
    let rows: string[][] = [];

    if (req.file) {
      const content = fs.readFileSync(req.file.path, 'utf-8');
      rows = parseCSVContentSimple(content);
      fs.unlinkSync(req.file.path);
    } else if (req.body.content) {
      rows = parseCSVContentSimple(req.body.content);
    } else if (req.body.users) {
      const users = req.body.users;
      const validationErrors: any[] = [];
      const validationWarnings: any[] = [];

      users.forEach((user: any, index: number) => {
        const rowErrors: string[] = [];
        const rowWarnings: string[] = [];

        if (!user.email) rowErrors.push('Email is required');
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) rowErrors.push(`Invalid email format: ${user.email}`);
        if (!user.firstName) rowErrors.push('First name is required');
        if (!user.lastName) rowErrors.push('Last name is required');
        if (!user.role) rowErrors.push('Role is required');
        else if (!ROLE_MAPPING[user.role]) rowErrors.push(`Invalid role: ${user.role}`);

        if (rowErrors.length > 0) {
          validationErrors.push({ rowNumber: index + 1, email: user.email || '', errors: rowErrors });
        }
        if (rowWarnings.length > 0) {
          validationWarnings.push({ rowNumber: index + 1, email: user.email || '', warnings: rowWarnings });
        }
      });

      return res.json({
        success: true,
        data: {
          valid: validationErrors.length === 0,
          errors: validationErrors,
          warnings: validationWarnings,
          summary: {
            total: users.length,
            valid: users.length - validationErrors.length,
            invalid: validationErrors.length,
            warnings: validationWarnings.length,
            duplicates: 0,
            readyToImport: users.length - validationErrors.length,
          },
        },
      });
    } else {
      throw new AppError('No data to validate', 400);
    }

    if (rows.length < 2) {
      throw new AppError('File must contain at least a header row and one data row', 400);
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    const missingHeaders = REQUIRED_HEADERS.filter((h: string) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.json({
        success: true,
        data: {
          valid: false,
          errors: [{ rowNumber: 0, email: '', errors: [`Missing required headers: ${missingHeaders.join(', ')}`] }],
          warnings: [],
          summary: { total: 0, valid: 0, invalid: 0, warnings: 0, duplicates: 0, readyToImport: 0 },
        },
      });
    }

    const { users, errors, warnings } = validateImportData(dataRows, headers);
    const validUsers = users.filter((u: any) => u.status === 'valid' || u.status === 'warning');
    const invalidUsers = users.filter((u: any) => u.status === 'invalid');

    return res.json({
      success: true,
      data: {
        valid: invalidUsers.length === 0,
        errors,
        warnings,
        validUsers,
        invalidUsers,
        duplicateEmails: [],
        summary: {
          total: users.length,
          valid: users.filter((u: any) => u.status === 'valid').length,
          invalid: invalidUsers.length,
          warnings: users.filter((u: any) => u.status === 'warning').length,
          duplicates: 0,
          readyToImport: validUsers.length,
        },
      },
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return handleError(error, res, next);
  }
};

export const getImportTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params;
    
    const template = IMPORT_TEMPLATES[templateId];
    if (!template) {
      throw new AppError('Template not found', 404);
    }

    return res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getImportTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({
      success: true,
      data: Object.values(IMPORT_TEMPLATES),
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const downloadImportTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params;
    
    const template = IMPORT_TEMPLATES[templateId];
    if (!template) {
      throw new AppError('Template not found', 404);
    }

    let csvContent = template.headers.join(',') + '\n';
    template.exampleData.forEach((row: any) => {
      const values = template.headers.map((h: string) => row[h] || '');
      csvContent += values.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=user_import_${templateId}_template.csv`);
    return res.send(csvContent);
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getImportStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const importLogs = await prisma.auditLog.findMany({
      where: { entityType: 'USER_IMPORT' },
      orderBy: { createdAt: 'desc' },
    });

    const totalImports = importLogs.length;
    const totalUsersImported = importLogs.reduce(
      (sum: number, log: any) => sum + getAuditLogSuccessCount(log),
      0
    );

    const byStatus: Record<string, number> = {};
    importLogs.forEach((log: any) => {
      const status = getAuditLogStatus(log);
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

    const lastImport = importLogs.length > 0 ? {
      id: importLogs[0].id,
      fileName: importLogs[0].entityName,
      importedAt: importLogs[0].createdAt.toISOString(),
      status: getAuditLogStatus(importLogs[0]),
      successCount: getAuditLogSuccessCount(importLogs[0]),
      failedCount: getAuditLogFailedCount(importLogs[0]),
    } : null;

    return res.json({
      success: true,
      data: {
        totalImports,
        totalUsersImported,
        successRate: totalImports > 0 ? (totalUsersImported / totalImports) * 100 : 0,
        averageImportTime: 0,
        lastImport,
        byStatus,
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ============================================
// ADDITIONAL USER INVITATION METHODS
// ============================================

export const cancelInvitation = async (req: Request, res: Response, next: NextFunction) => {
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

    return res.json({
      success: true,
      data: updatedInvitation,
      message: 'Invitation cancelled successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const cancelInvitations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invitationIds } = req.body;
    
    if (!invitationIds || !Array.isArray(invitationIds) || invitationIds.length === 0) {
      throw new AppError('At least one invitation ID is required', 400);
    }

    const result = await (prisma as any).invitation.updateMany({
      where: { id: { in: invitationIds } },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    return res.json({
      success: true,
      message: `${result.count} invitations cancelled successfully`,
      count: result.count,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const checkInvitationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    
    const invitation = await (prisma as any).invitation.findUnique({
      where: { invitationToken: token },
    });

    if (!invitation) {
      return res.json({
        success: true,
        data: { status: 'invalid', valid: false },
      });
    }

    const status = invitation.status;
    const expiresAt = invitation.expiresAt;

    return res.json({
      success: true,
      data: {
        status,
        valid: status === 'sent' || status === 'pending',
        expiresAt,
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const validateInvitationToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      throw new AppError('Token is required', 400);
    }

    const invitation = await (prisma as any).invitation.findUnique({
      where: { invitationToken: token },
    });

    if (!invitation) {
      return res.json({
        success: true,
        data: { valid: false, message: 'Invalid token' },
      });
    }

    return res.json({
      success: true,
      data: {
        valid: true,
        invitation,
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getPendingInvitationsCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await (prisma as any).invitation.count({
      where: { status: 'pending' },
    });

    return res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const sendInvitationReminder = async (req: Request, res: Response, next: NextFunction) => {
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
        reminderSent: true,
        reminderSentAt: new Date(),
        reminderCount: { increment: 1 },
      },
    });

    return res.json({
      success: true,
      data: updatedInvitation,
      message: 'Reminder sent successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const clearExpiredInvitations = async (req: Request, res: Response, next: NextFunction) => {
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
};

export const getInvitationTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({
      success: true,
      data: Object.values(INVITATION_TEMPLATES),
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getInvitationTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId } = req.params;
    
    const template = INVITATION_TEMPLATES[templateId];
    if (!template) {
      throw new AppError('Template not found', 404);
    }

    return res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const createInvitationTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, subject, body, role, variables, isDefault } = req.body;
    
    if (!name || !subject || !body) {
      throw new AppError('Name, subject, and body are required', 400);
    }

    const template = await (prisma as any).invitationTemplate.create({
      data: {
        name,
        subject,
        body,
        role: role || null,
        variables: variables || ['[Invitation Link]', '[Role]', '[Email]'],
        isDefault: isDefault || false,
      },
    });

    return res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const updateInvitationTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const template = await (prisma as any).invitationTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new AppError('Template not found', 404);
    }

    const updatedTemplate = await (prisma as any).invitationTemplate.update({
      where: { id },
      data: updates,
    });

    return res.json({
      success: true,
      data: updatedTemplate,
      message: 'Template updated successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const deleteInvitationTemplate = async (req: Request, res: Response, next: NextFunction) => {
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
};

// ============================================
// ADDITIONAL USER GROUP METHODS
// ============================================

export const getGroupById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const group = await prisma.user.findUnique({
      where: { id },
      include: {
        businessUnits: true,
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
};

export const getGroupByName = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.params;
    
    const group = await prisma.user.findFirst({
      where: {
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@group.local`,
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
};

export const removeUsersFromGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userIds } = req.body;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const removedUsers: string[] = [];
    const skippedUsers: string[] = [];
    const groupPermissions = group.permissions || [];

    for (const userId of userIds) {
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
    return handleError(error, res, next);
  }
};

export const getGroupMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { page = '1', limit = '20', search } = req.query;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const groupPermissions = group.permissions || [];
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      permissions: { hasSome: groupPermissions },
    };

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
};

export const updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Member not found', 404);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    return res.json({
      success: true,
      data: updatedUser,
      message: 'Member role updated successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const setGroupLead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, userId } = req.params;
    const { isLead } = req.body;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Member not found', 404);
    }

    let permissions = [...(user.permissions || [])];
    const leadPermission = 'group:lead';

    if (isLead && !permissions.includes(leadPermission)) {
      permissions.push(leadPermission);
    } else if (!isLead && permissions.includes(leadPermission)) {
      permissions = permissions.filter((p: string) => p !== leadPermission);
    }

    const updatedUser = await prisma.user.update({
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

    return res.json({
      success: true,
      data: updatedUser,
      message: `Member ${isLead ? 'set as lead' : 'removed as lead'} successfully`,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const updateGroupPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const updatedGroup = await prisma.user.update({
      where: { id },
      data: { permissions },
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
    return handleError(error, res, next);
  }
};

export const addGroupPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const mergedPermissions = [...new Set([...(group.permissions || []), ...permissions])];
    const updatedGroup = await prisma.user.update({
      where: { id },
      data: { permissions: mergedPermissions },
    });

    return res.json({
      success: true,
      data: updatedGroup,
      message: 'Permissions added successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const removeGroupPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const filteredPermissions = (group.permissions || []).filter((p: string) => !permissions.includes(p));
    const updatedGroup = await prisma.user.update({
      where: { id },
      data: { permissions: filteredPermissions },
    });

    return res.json({
      success: true,
      data: updatedGroup,
      message: 'Permissions removed successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getGroupStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalGroups, totalMembers, activeGroups, inactiveGroups] = await Promise.all([
      prisma.user.count({ where: { email: { endsWith: '@group.local' } } }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true, email: { endsWith: '@group.local' } } }),
      prisma.user.count({ where: { isActive: false, email: { endsWith: '@group.local' } } }),
    ]);

    return res.json({
      success: true,
      data: {
        totalGroups,
        totalMembers,
        activeGroups,
        inactiveGroups,
        averageMembersPerGroup: totalGroups > 0 ? totalMembers / totalGroups : 0,
        byRole: {},
      },
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ============================================
// ADDITIONAL GROUP METHODS
// ============================================

export const createGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groups } = req.body;
    
    if (!groups || !Array.isArray(groups) || groups.length === 0) {
      throw new AppError('At least one group is required', 400);
    }

    const createdGroups: any[] = [];

    for (const groupData of groups) {
      const groupEmail = `${groupData.name.toLowerCase().replace(/\s+/g, '.')}@group.local`;
      
      const existingGroup = await prisma.user.findFirst({ where: { email: groupEmail } });
      if (existingGroup) continue;

      const group = await prisma.user.create({
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

    return res.status(201).json({
      success: true,
      data: createdGroups,
      message: `${createdGroups.length} groups created successfully`,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const deleteGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new AppError('At least one group ID is required', 400);
    }

    const result = await prisma.user.deleteMany({
      where: {
        id: { in: ids },
        email: { endsWith: '@group.local' },
      },
    });

    return res.json({
      success: true,
      message: `${result.count} groups deleted successfully`,
      count: result.count,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const assignUsersToMultipleGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignments } = req.body;
    
    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      throw new AppError('At least one assignment is required', 400);
    }

    const results: any[] = [];

    for (const assignment of assignments) {
      const group = await prisma.user.findUnique({ where: { id: assignment.groupId } });
      if (!group || !group.email.endsWith('@group.local')) {
        results.push({ groupId: assignment.groupId, error: 'Group not found' });
        continue;
      }

      const groupPermissions = group.permissions || [];
      const assignedUsers: string[] = [];

      for (const userId of assignment.userIds) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) continue;

        const mergedPermissions = [...new Set([...(user.permissions || []), ...groupPermissions])];
        await prisma.user.update({
          where: { id: userId },
          data: { permissions: mergedPermissions },
        });
        assignedUsers.push(userId);
      }

      results.push({ groupId: assignment.groupId, assignedCount: assignedUsers.length, assignedUsers });
    }

    return res.json({
      success: true,
      data: { results },
      message: 'Users assigned successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getGroupHierarchy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await prisma.user.findMany({
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

    const hierarchy = buildHierarchy(null);

    return res.json({
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getChildGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const children = await prisma.user.findMany({
      where: {
        email: { endsWith: '@group.local' },
        permissions: { has: `parent:${id}` },
      },
      select: {
        id: true,
        firstName: true,
        email: true,
        permissions: true,
        isActive: true,
      },
    });

    return res.json({
      success: true,
      data: children,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const getParentGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group) {
      throw new AppError('Group not found', 404);
    }

    const parentPermission = (group.permissions || []).find((p: string) => p.startsWith('parent:'));
    if (!parentPermission) {
      return res.json({
        success: true,
        data: null,
      });
    }

    const parentId = parentPermission.replace('parent:', '');
    const parent = await prisma.user.findUnique({
      where: { id: parentId },
      select: {
        id: true,
        firstName: true,
        email: true,
        permissions: true,
        isActive: true,
      },
    });

    return res.json({
      success: true,
      data: parent,
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const moveGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { parentGroupId } = req.body;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    if (parentGroupId === id) {
      throw new AppError('Group cannot be its own parent', 400);
    }

    let permissions = (group.permissions || []).filter((p: string) => !p.startsWith('parent:'));
    if (parentGroupId) {
      permissions.push(`parent:${parentGroupId}`);
    }

    const updatedGroup = await prisma.user.update({
      where: { id },
      data: { permissions },
    });

    return res.json({
      success: true,
      data: updatedGroup,
      message: 'Group moved successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const mergeGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceGroupId, targetGroupId } = req.body;
    
    const [sourceGroup, targetGroup] = await Promise.all([
      prisma.user.findUnique({ where: { id: sourceGroupId } }),
      prisma.user.findUnique({ where: { id: targetGroupId } }),
    ]);

    if (!sourceGroup || !targetGroup) {
      throw new AppError('Source or target group not found', 404);
    }

    const mergedPermissions = [...new Set([
      ...(targetGroup.permissions || []),
      ...(sourceGroup.permissions || []),
    ])];

    await prisma.user.update({
      where: { id: targetGroupId },
      data: { permissions: mergedPermissions },
    });

    await prisma.user.delete({ where: { id: sourceGroupId } });

    return res.json({
      success: true,
      data: targetGroup,
      message: 'Groups merged successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const duplicateGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const newGroup = await prisma.user.create({
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

    return res.status(201).json({
      success: true,
      data: newGroup,
      message: 'Group duplicated successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const activateGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const updatedGroup = await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    return res.json({
      success: true,
      data: updatedGroup,
      message: 'Group activated successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const deactivateGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const updatedGroup = await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return res.json({
      success: true,
      data: updatedGroup,
      message: 'Group deactivated successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const archiveGroup = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const group = await prisma.user.findUnique({ where: { id } });
    if (!group || !group.email.endsWith('@group.local')) {
      throw new AppError('Group not found', 404);
    }

    const permissions = [...(group.permissions || []), 'group:archived'];
    const updatedGroup = await prisma.user.update({
      where: { id },
      data: { isActive: false, permissions },
    });

    return res.json({
      success: true,
      data: updatedGroup,
      message: 'Group archived successfully',
    });
  } catch (error) {
    return handleError(error, res, next);
  }
};

export const exportGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'json';
    
    const groups = await prisma.user.findMany({
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

    if (format === 'json') {
      return res.json({
        success: true,
        data: groups,
        total: groups.length,
        format: 'json',
      });
    }

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
      const csvContent = [headers, ...rows].map((row: any[]) => row.join(',')).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=user_groups_${Date.now()}.csv`);
      return res.send(csvContent);
    }

    throw new AppError('Invalid export format', 400);
  } catch (error) {
    return handleError(error, res, next);
  }
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default userController;
