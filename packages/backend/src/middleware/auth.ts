// packages/backend/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { UserRole } from '../generated/prisma/index.js';
import { verifyToken } from '@clerk/backend';

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

// ✅ Re-export so existing importers keep working.
export { ALL_PERMISSIONS, WILDCARD };

// ============================================
// CLERK CONFIG
// ============================================
//
// Read once at module load so a misconfigured deployment fails at
// boot instead of on the first authenticated request.
//
// `@clerk/backend@0.5.x` requires BOTH `secretKey` and `issuer` in
// VerifyTokenOptions. `issuer` is the full HTTPS URL of your Clerk
// frontend API — the `iss` claim on every session JWT.
//
//   Test:       https://<slug>.clerk.accounts.dev
//   Production: https://clerk.<yourdomain>
//
// Find the exact value in the Clerk dashboard under
// API Keys → Show JWT verification URL.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `[auth] Missing required environment variable: ${name}. ` +
        `Add it to packages/backend/.env and restart the server.`,
    );
  }
  return value;
}

const CLERK_SECRET_KEY = requireEnv('CLERK_SECRET_KEY');
const CLERK_ISSUER = requireEnv('CLERK_ISSUER');

// ============================================
// TOKEN EXTRACTION
// ============================================

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

// ============================================
// AUTH MIDDLEWARE
// ============================================

/**
 * Authenticated request handler.
 *
 * Flow:
 *   1. Extract the bearer token. Missing → 401 NO_TOKEN.
 *   2. Verify the token via Clerk. Invalid → 401 INVALID_TOKEN.
 *   3. Look up the local user by clerkId. Not found OR inactive
 *      → 403 USER_NOT_PROVISIONED. We DO NOT auto-create users
 *      here — provisioning is an explicit admin action.
 *   4. Resolve permissions via `resolvePermissions`.
 *   5. Resolve companyId. Missing → 403 NO_COMPANY_ASSIGNED.
 *      We DO NOT silently attach the user to a fallback company.
 *   6. Populate req.user and continue.
 *
 * Any mutation the user might need to trigger (creating a user,
 * assigning a company) is an admin operation, not something the
 * middleware does as a side effect of a random HTTP request.
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // ── 1. Extract token ─────────────────────────────────────
    const token = extractBearerToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NO_TOKEN',
      });
    }

    // ── 2. Verify token ──────────────────────────────────────
    //
    // `verifyToken` throws on invalid/expired/malformed tokens.
    // We treat every failure mode identically to avoid leaking
    // which part of the token was wrong.
    let clerkUserId: string;
    try {
      const payload = await verifyToken(token, {
        secretKey: CLERK_SECRET_KEY,
        issuer: CLERK_ISSUER,
      });

      const sub = payload?.sub;
      if (typeof sub !== 'string' || sub.length === 0) {
        throw new Error('Token payload missing `sub`');
      }
      clerkUserId = sub;
    } catch (err) {
      logger.warn('Token verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }

    // ── 3. Look up local user by clerkId ─────────────────────
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: {
        businessUnits: {
          where: { isActive: true },
          include: { businessUnit: true },
        },
      },
    });

    if (!user || !user.isActive) {
      logger.warn('User not provisioned', { clerkUserId });
      return res.status(403).json({
        success: false,
        error: 'User not provisioned. Contact an administrator.',
        code: 'USER_NOT_PROVISIONED',
      });
    }

    // ── 4. Resolve permissions ───────────────────────────────
    const permissions = resolvePermissions({
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    });

    // ── 5. Resolve companyId ─────────────────────────────────
    let companyId: string | null = (user as any).companyId ?? null;

    if (!companyId && user.businessUnits[0]?.businessUnit) {
      companyId =
        ((user.businessUnits[0].businessUnit as any).companyId as
          | string
          | null) ?? null;
    }

    if (!companyId) {
      logger.warn('User has no companyId', {
        userId: user.id,
        email: user.email,
      });
      return res.status(403).json({
        success: false,
        error:
          'Your account is not associated with a company. Contact an administrator.',
        code: 'NO_COMPANY_ASSIGNED',
      });
    }

    // ── 6. Attach to request ─────────────────────────────────
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
      companyId,
      permissions,
    };

    next();
  } catch (error) {
    logger.error('Auth middleware error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: req.originalUrl,
      method: req.method,
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'AUTH_ERROR',
    });
  }
};

export const requireAuth = authMiddleware;

// ============================================
// OPTIONAL AUTH
// ============================================

/**
 * Populates `req.user` if a valid token is present, otherwise
 * continues without it. Unlike `authMiddleware`, NEVER rejects —
 * the route decides what to do with an absent user.
 *
 * Use this on public endpoints that behave differently for signed-in
 * users (e.g. showing cart contents, personalised pricing).
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const token = extractBearerToken(req);
  if (!token) return next();

  try {
    const payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
      issuer: CLERK_ISSUER,
    });
    const clerkUserId = payload?.sub;
    if (typeof clerkUserId !== 'string' || clerkUserId.length === 0) {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
      include: {
        businessUnits: {
          where: { isActive: true },
          include: { businessUnit: true },
        },
      },
    });

    if (!user || !user.isActive) return next();

    const permissions = resolvePermissions({
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    });

    let companyId: string | null = (user as any).companyId ?? null;
    if (!companyId && user.businessUnits[0]?.businessUnit) {
      companyId =
        ((user.businessUnits[0].businessUnit as any).companyId as
          | string
          | null) ?? null;
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
  } catch (err) {
    logger.debug('optionalAuth: token rejected', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  next();
};

// ============================================
// ROLE / PERMISSION GUARDS
// ============================================

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
