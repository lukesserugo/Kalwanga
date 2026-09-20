// packages/backend/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { UserRole } from '../generated/prisma/index.js';

// ✅ Single source of truth
import {
  ALL_PERMISSIONS,
  WILDCARD,
  resolvePermissions,
  permissionSetHas,
} from '../lib/permissions.js';

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

// ✅ Re-export so existing importers of `ALL_PERMISSIONS` from this
//    file keep working. The value now comes from lib/permissions.
export { ALL_PERMISSIONS, WILDCARD };

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('🔐 Auth middleware called');
    console.log('   Method:', req.method);
    console.log('   URL:', req.url);

    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
      console.log('   Token present:', token ? 'YES' : 'NO');
    }

    const defaultEmail = 'lukesserugo09@gmail.com';

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
          // ✅ Persist only the role defaults; resolvePermissions will
          //    expand to ALL + '*' at request time based on role.
          //    This keeps the row small and future-proof.
          permissions: [],
        },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });
      console.log('✅ Default SUPER_ADMIN created:', user.email);
    }

    // ────────────────────────────────────────────────────────────
    // Resolve permissions through the canonical resolver.
    // SUPER_ADMIN → [ '*', ...ALL_PERMISSIONS ]
    // Others     → user.permissions (if any) else role defaults
    // ────────────────────────────────────────────────────────────
    const permissions = resolvePermissions({
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    });

    console.log(
      `✅ Resolved ${permissions.length} permissions for ${user.role}` +
        (user.role === UserRole.SUPER_ADMIN ? ' (wildcard included)' : '')
    );

    // ────────────────────────────────────────────────────────────
    // Resolve companyId (unchanged behaviour, only cosmetic edits)
    // ────────────────────────────────────────────────────────────
    let companyId: string | null = (user as any).companyId ?? null;

    if (!companyId && user.businessUnits[0]?.businessUnit) {
      companyId =
        ((user.businessUnits[0].businessUnit as any).companyId as string | null) ??
        null;
    }

    if (!companyId) {
      console.warn(
        `⚠️  User ${user.email} has no companyId — resolving fallback company`
      );

      let fallbackCompany = await prisma.company.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (!fallbackCompany) {
        fallbackCompany = await prisma.company.create({
          data: {
            name: 'Default Company',
            email: 'admin@kalwanga.local',
            phone: '+0000000000',
            isActive: true,
          } as any,
        });
        console.log('✅ Created fallback Company:', fallbackCompany.id);
      }

      companyId = fallbackCompany.id;

      await prisma.user
        .update({
          where: { id: user.id },
          data: { companyId: fallbackCompany.id },
        })
        .catch((err: any) =>
          console.warn('⚠️  Could not persist user.companyId:', err?.message || err)
        );
    }

    req.user = {
      id: user.id,
      userId: user.id,
      clerkId: user.clerkId,
      email: user.email,
      role: user.role,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      businessUnitId: user.businessUnits[0]?.businessUnitId,
      businessUnits: user.businessUnits.map((bu) => bu.businessUnitId),
      companyId: companyId ?? undefined,
      permissions,
    };

    console.log(`✅ Authenticated as: ${user.email} (${user.role})`);
    console.log(`   companyId: ${companyId}`);
    console.log(`   Permissions: ${permissions.length}`);
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

export const requireAuth = authMiddleware;

/**
 * Require an exact role (kept for backwards compatibility).
 */
export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'NO_USER',
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

/**
 * ✅ New: require a specific permission string. Uses the resolved set
 * from req.user, which already knows about '*' and role defaults.
 *
 * SUPER_ADMIN always passes.
 * Any role with the explicit permission passes.
 * A user with custom permissions passes if the string is present.
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'NO_USER',
      });
    }

    const perms = req.user.permissions ?? [];

    if (!permissionSetHas(perms, permission)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN_PERMISSION',
        required: permission,
      });
    }

    next();
  };
};

/**
 * Require any one of the given permissions.
 */
export const requireAnyPermission = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'NO_USER',
      });
    }

    const perms = req.user.permissions ?? [];
    if (perms.includes(WILDCARD)) return next();

    const ok = permissions.some((p) => perms.includes(p));
    if (!ok) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN_PERMISSION',
        required: permissions,
      });
    }

    next();
  };
};

export const optionalAuth = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  next();
};
