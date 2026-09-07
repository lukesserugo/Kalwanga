// D:\Projects\Kalwanga\packages\backend\src\middleware\auth.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { UserRole } from '../generated/prisma/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        clerkId: string;
        role: UserRole;
        email: string;
        firstName?: string;
        lastName?: string;
        businessUnitId?: string;
        businessUnits?: string[];
        companyId?: string;
        permissions?: string[];
      };
    }
  }
}

// All available permissions in the system
const ALL_PERMISSIONS = [
  'user:view', 'user:create', 'user:edit', 'user:delete', 'user:manage',
  'user:activate', 'user:deactivate', 'user:role:update', 'user:permission:update',
  'user:bulk:activate', 'user:bulk:deactivate', 'user:bulk:delete', 'user:export',
  'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete', 'inventory:manage',
  'inventory:view_low_stock', 'inventory:view_reports', 'inventory:view_audit',
  'inventory:export', 'inventory:import', 'inventory:issue', 'inventory:restock',
  'inventory:adjust', 'inventory:transfer', 'inventory:approve_transfers',
  'product:view', 'product:create', 'product:edit', 'product:delete', 'product:manage',
  'product:export', 'product:import',
  'category:view', 'category:create', 'category:edit', 'category:delete', 'category:manage',
  'report:view', 'report:create', 'report:export', 'report:manage',
  'analytics:view', 'analytics:export',
  'settings:view', 'settings:edit', 'settings:manage',
  'system:logs', 'system:backup', 'system:restore', 'system:settings',
  'business_unit:view', 'business_unit:create', 'business_unit:edit', 
  'business_unit:delete', 'business_unit:manage',
  'sale:view', 'sale:create', 'sale:edit', 'sale:delete', 'sale:manage',
  'sale:export', 'sale:print', 'sale:email',
  'pos:view', 'pos:create', 'pos:manage', 'pos:print',
  'cash_register:view', 'cash_register:manage', 'cash_register:open', 'cash_register:close',
  'shift:view', 'shift:manage', 'shift:start', 'shift:end',
  'return:view', 'return:create', 'return:edit', 'return:delete', 'return:manage',
  'return:approve', 'return:reject', 'return:process',
  'refund:view', 'refund:create', 'refund:edit', 'refund:delete', 'refund:manage',
  'refund:approve', 'refund:reject', 'refund:complete',
  'invoice:view', 'invoice:create', 'invoice:edit', 'invoice:delete', 'invoice:manage',
  'invoice:send', 'invoice:print', 'invoice:paid', 'invoice:void', 'invoice:cancel',
  'receipt:view', 'receipt:create', 'receipt:edit', 'receipt:delete', 'receipt:manage',
  'receipt:print', 'receipt:email', 'receipt:void',
  'payment:view', 'payment:create', 'payment:manage', 'payment:refund',
  'dashboard:view', 'dashboard:manage',
  'integration:view', 'integration:manage',
  'api:view', 'api:manage',
  'webhook:view', 'webhook:manage',
  'group:view', 'group:create', 'group:edit', 'group:delete', 'group:manage',
  'invitation:view', 'invitation:create', 'invitation:edit', 'invitation:delete',
  'invitation:resend', 'invitation:cancel',
  'import:view', 'import:create', 'import:delete', 'import:validate',
  'export:view', 'export:create', 'export:delete',
  'activity:view', 'activity:clear', 'activity:export',
  'audit:view', 'audit:export',
  'accounting:view', 'accounting:create', 'accounting:edit', 'accounting:delete',
  'accounting:post', 'accounting:void',
  'tax:view', 'tax:create', 'tax:edit', 'tax:delete', 'tax:file',
];

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('🔐 Auth middleware called');
    console.log('   Method:', req.method);
    console.log('   URL:', req.url);
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log('   Token present:', token ? 'YES' : 'NO');
    }
    
    // For now, use the default SUPER_ADMIN user
    const defaultEmail = 'lukesserugo09@gmail.com';
    
    // Find or create the default SUPER_ADMIN user
    let user = await prisma.user.findFirst({
      where: { email: defaultEmail },
      include: {
        businessUnits: {
          include: { businessUnit: true },
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      console.log('🆕 Creating default SUPER_ADMIN user...');
      
      try {
        // Try creating with permissions field
        user = await prisma.user.create({
          data: {
            clerkId: `clerk_default_${Date.now()}`,
            email: defaultEmail,
            firstName: 'Luke',
            lastName: 'Sserugo',
            phoneNumber: null,
            role: UserRole.SUPER_ADMIN,
            isActive: true,
            lastLoginAt: new Date(),
            permissions: ALL_PERMISSIONS,
          },
          include: {
            businessUnits: {
              include: { businessUnit: true },
              where: { isActive: true },
            },
          },
        });
        console.log('✅ Default user created with permissions:', user.email);
      } catch (createError: any) {
        // If permissions field doesn't exist, create without it
        if (createError.message?.includes('Unknown argument `permissions`')) {
          console.log('⚠️ Permissions field not available, creating user without permissions...');
          user = await prisma.user.create({
            data: {
              clerkId: `clerk_default_${Date.now()}`,
              email: defaultEmail,
              firstName: 'Luke',
              lastName: 'Sserugo',
              phoneNumber: null,
              role: UserRole.SUPER_ADMIN,
              isActive: true,
              lastLoginAt: new Date(),
            },
            include: {
              businessUnits: {
                include: { businessUnit: true },
                where: { isActive: true },
              },
            },
          });
          console.log('✅ Default user created without permissions:', user.email);
        } else {
          throw createError;
        }
      }
    }

    // Get user permissions
    let permissions: string[] = [];
    
    // Try to get permissions from user object
    try {
      // Check if permissions field exists on user
      if (user && 'permissions' in user && user.permissions) {
        permissions = Array.isArray(user.permissions) ? user.permissions : [];
        console.log(`✅ Got ${permissions.length} permissions from user`);
      }
    } catch (e) {
      console.log('⚠️ Permissions field not available, using role-based permissions');
    }
    
    // If no permissions found or SUPER_ADMIN, use role-based permissions
    if (permissions.length === 0 || user.role === UserRole.SUPER_ADMIN) {
      permissions = getRoleBasedPermissions(user.role);
      console.log(`✅ Using ${permissions.length} role-based permissions for ${user.role}`);
    }

    req.user = {
      id: user.id,
      userId: user.id,
      clerkId: user.clerkId,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      businessUnitId: user.businessUnits[0]?.businessUnitId,
      businessUnits: user.businessUnits.map(bu => bu.businessUnitId),
      companyId: user.companyId || undefined,
      permissions: permissions,
    };

    console.log(`✅ Authenticated as: ${user.email} (${user.role})`);
    console.log(`   Permissions: ${permissions.length} permissions`);
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'AUTH_ERROR',
    });
  }
};

// Helper function to get role-based permissions
function getRoleBasedPermissions(role: UserRole): string[] {
  const permissionsMap: Record<UserRole, string[]> = {
    [UserRole.SUPER_ADMIN]: ALL_PERMISSIONS,
    [UserRole.ADMIN]: [
      'user:view', 'user:create', 'user:edit', 'user:delete',
      'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:delete',
      'inventory:view_low_stock', 'inventory:view_reports',
      'product:view', 'product:create', 'product:edit', 'product:delete',
      'category:view', 'category:create', 'category:edit', 'category:delete',
      'report:view', 'report:create', 'report:export',
      'settings:view', 'settings:edit',
      'sale:view', 'sale:create', 'sale:edit', 'sale:delete',
      'customer:view', 'customer:create', 'customer:edit', 'customer:delete',
      'payment:view', 'payment:create', 'payment:manage',
      'invoice:view', 'invoice:create', 'invoice:edit', 'invoice:delete',
      'receipt:view', 'receipt:create', 'receipt:print',
      'business_unit:view', 'business_unit:create', 'business_unit:edit',
      'group:view', 'group:create', 'group:edit', 'group:delete',
      'invitation:view', 'invitation:create', 'invitation:edit', 'invitation:delete',
      'import:view', 'import:create', 'import:delete',
      'export:view', 'export:create',
      'activity:view', 'activity:clear',
      'audit:view', 'audit:export',
    ],
    [UserRole.MANAGER]: [
      'user:view',
      'inventory:view', 'inventory:create', 'inventory:edit',
      'inventory:view_low_stock', 'inventory:view_reports',
      'product:view', 'product:create', 'product:edit',
      'category:view', 'category:create', 'category:edit',
      'report:view', 'report:create',
      'sale:view', 'sale:create', 'sale:edit',
      'customer:view', 'customer:create', 'customer:edit',
      'payment:view', 'payment:create',
      'invoice:view', 'invoice:create', 'invoice:edit',
      'receipt:view', 'receipt:create', 'receipt:print',
      'business_unit:view',
      'group:view',
      'invitation:view',
      'import:view',
      'export:view',
      'activity:view',
      'audit:view',
    ],
    [UserRole.EDITOR]: [
      'inventory:view', 'inventory:create', 'inventory:edit',
      'inventory:view_low_stock',
      'product:view', 'product:create', 'product:edit',
      'category:view', 'category:create', 'category:edit',
      'report:view',
      'sale:view', 'sale:create', 'sale:edit',
      'customer:view', 'customer:create', 'customer:edit',
      'payment:view', 'payment:create',
      'invoice:view', 'invoice:create', 'invoice:edit',
      'receipt:view', 'receipt:create', 'receipt:print',
      'business_unit:view',
      'group:view',
      'import:view',
      'export:view',
      'activity:view',
    ],
    [UserRole.VIEWER]: [
      'inventory:view',
      'inventory:view_low_stock',
      'product:view',
      'category:view',
      'report:view',
      'sale:view',
      'customer:view',
      'payment:view',
      'invoice:view',
      'receipt:view',
      'business_unit:view',
      'group:view',
      'activity:view',
    ],
    [UserRole.EMPLOYEE]: [
      'inventory:view',
      'inventory:view_low_stock',
      'product:view',
      'sale:view',
      'sale:create',
      'customer:view',
      'customer:create',
      'payment:view',
      'payment:create',
      'receipt:view',
      'receipt:create',
      'receipt:print',
      'cash_register:view',
    ],
    [UserRole.CASHIER]: [
      'inventory:view',
      'product:view',
      'sale:view',
      'sale:create',
      'customer:view',
      'customer:create',
      'payment:view',
      'payment:create',
      'receipt:view',
      'receipt:create',
      'receipt:print',
      'cash_register:view',
      'cash_register:open',
    ],
    [UserRole.USER]: [
      'inventory:view',
      'product:view',
      'sale:view',
      'customer:view',
      'payment:view',
      'receipt:view',
    ],
  };
  return permissionsMap[role] || [];
}

export const requireAuth = authMiddleware;

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized', 
        code: 'NO_USER' 
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Insufficient role', 
        code: 'FORBIDDEN',
        required: roles,
        current: req.user.role,
      });
    }
    next();
  };
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  next();
};

// Export ALL_PERMISSIONS for use in other files
export { ALL_PERMISSIONS };
