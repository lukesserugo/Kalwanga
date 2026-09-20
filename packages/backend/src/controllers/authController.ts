// D:\Projects\Kalwanga\packages\backend\src\controllers\authController.ts

import type { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';
import {
  PERMISSION_CATALOGUE,
  ROLE_PERMISSIONS,
  WILDCARD,
  resolvePermissions,
  permissionSetHas,
} from '../lib/permissions.js';
import { z } from 'zod';

const authService = new AuthService();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  businessUnitId: z.string().optional(),
  role: z.string().optional(),
  clerkId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const verify2FASchema = z.object({
  code: z.string().min(6, 'Code must be at least 6 characters'),
});

const updateUserRoleSchema = z.object({
  role: z.string().min(1, 'Role is required'),
});

const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phoneNumber: z.string().optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

const checkPermissionsSchema = z.object({
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

const createSuperAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

/**
 * Schema for POST /auth/sync.
 *
 * Every field is optional because the caller's identity is normally
 * derived from the Clerk JWT via `requireAuth`. The body is only used
 * to *override* or *fill in* missing fields (e.g. when Clerk omits the
 * email from the JWT).
 */
const syncClerkUserSchema = z.object({
  clerkId: z.string().optional(),
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phoneNumber: z.string().optional(),
  avatar: z.string().url('Invalid avatar URL').optional(),
});

// ============================================
// HELPERS
// ============================================

function handleValidationError(error: z.ZodError, res: Response) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map((err) => ({
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
    const errorMessage = error.message || 'Internal server error';
    let statusCode = 500;

    if (errorMessage.includes('Invalid credentials')) statusCode = 401;
    else if (errorMessage.includes('not found')) statusCode = 404;
    else if (errorMessage.includes('deactivated')) statusCode = 403;
    else if (errorMessage.includes('Invalid or expired token')) statusCode = 400;
    else if (errorMessage.includes('already exists')) statusCode = 409;
    else if (
      errorMessage.includes('Unauthorized') ||
      errorMessage.includes('unauthenticated')
    )
      statusCode = 401;
    else if (
      errorMessage.includes('Forbidden') ||
      errorMessage.includes('not allowed') ||
      errorMessage.includes('Only SUPER_ADMIN') ||
      errorMessage.includes('cannot create role')
    )
      statusCode = 403;

    console.error('Controller error:', error);
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }

  next(error);
}

/**
 * Read the caller's identity from req.user.
 * The auth middleware already sets `id` and `role`; no DB round-trip needed.
 */
function callerFromReq(req: Request): { id?: string; role?: string } {
  const u = (req as any).user;
  return {
    id: u?.id || (req as any).userId,
    role: u?.role,
  };
}

/**
 * Extract the Clerk user payload from wherever the auth middleware
 * chose to attach it. Different middleware versions put it on
 * `req.auth`, `req.clerkUser`, or `req.user`, so we try all three.
 */
function clerkUserFromReq(req: Request): {
  clerkId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatar?: string;
} {
  const candidates = [
    (req as any).auth,
    (req as any).clerkUser,
    (req as any).user,
  ].filter(Boolean);

  for (const c of candidates) {
    const clerkId =
      c?.userId ?? c?.sub ?? c?.clerkId ?? c?.id ?? undefined;

    if (clerkId && typeof clerkId === 'string' && clerkId.startsWith('user_')) {
      return {
        clerkId,
        email:
          c?.email ??
          c?.emailAddress ??
          c?.primaryEmailAddress?.emailAddress ??
          undefined,
        firstName: c?.firstName ?? c?.givenName ?? undefined,
        lastName: c?.lastName ?? c?.familyName ?? undefined,
        phoneNumber:
          c?.phoneNumber ??
          c?.primaryPhoneNumber?.phoneNumber ??
          undefined,
        avatar: c?.imageUrl ?? c?.avatar ?? undefined,
      };
    }
  }

  return {};
}

/**
 * Recognised user ID formats.
 */
const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]+$/;

/**
 * Merge a JWT-derived identity with body-provided overrides.
 *
 * Rule: the JWT always wins when it has a value, BUT when the JWT is
 * missing a field, the body value is used instead. This makes the
 * email-adoption path in `authService.syncClerkUser` reliable even
 * when the current Clerk session template omits the email claim.
 */
function mergeClerkIdentity(
  fromToken: ReturnType<typeof clerkUserFromReq>,
  fromBody: Partial<z.infer<typeof syncClerkUserSchema>>
): {
  clerkId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatar?: string;
} {
  const pick = <T>(jwtVal: T | undefined, bodyVal: T | undefined): T | undefined => {
    if (jwtVal !== undefined && jwtVal !== null && jwtVal !== '') return jwtVal;
    return bodyVal;
  };

  return {
    clerkId: pick(fromToken.clerkId, fromBody.clerkId),
    email: pick(fromToken.email, fromBody.email),
    firstName: pick(fromToken.firstName, fromBody.firstName),
    lastName: pick(fromToken.lastName, fromBody.lastName),
    phoneNumber: pick(fromToken.phoneNumber, fromBody.phoneNumber),
    avatar: pick(fromToken.avatar, fromBody.avatar),
  };
}

// ============================================
// CONTROLLER
// ============================================

export const authController = {
  // ...existing methods unchanged...

  /**
   * POST /auth/register
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('Register request received:', { email: req.body?.email });

      const data = registerSchema.parse(req.body);
      const caller = callerFromReq(req);

      const result = await authService.register({
        ...data,
        callerRole: caller.role,
      });

      return res.status(201).json({
        success: true,
        token: result.token,
        refreshToken: result.refreshToken,
        user: result.user,
        message: 'User registered successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/login
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('Login request received:', { email: req.body?.email });

      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);

      return res.json({
        success: true,
        token: result.token,
        refreshToken: result.refreshToken,
        user: result.user,
        message: 'Login successful',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/refresh
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError('Refresh token is required', 400);
      }

      const result = await authService.refreshToken(refreshToken);

      return res.json({
        success: true,
        token: result.token,
        user: result.user,
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /auth/me
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = callerFromReq(req);

      if (!caller.id) {
        throw new AppError('User not authenticated', 401);
      }

      const user = await authService.getCurrentUser(caller.id);

      return res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/logout
   */
  async logout(_req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout();
      return res.json({
        success: true,
        message: 'Logout successful',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await authService.forgotPassword(email);

      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/reset-password
   */
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(token, password);

      return res.json({
        success: true,
        message: 'Password reset successful',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/verify-email
   */
  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = verifyEmailSchema.parse(req.body);
      await authService.verifyEmail(token);

      return res.json({
        success: true,
        message: 'Email verified successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/resend-verification
   */
  async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = resendVerificationSchema.parse(req.body);
      await authService.resendVerification(email);

      return res.json({
        success: true,
        message: 'Verification email resent',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/verify-2fa
   */
  async verify2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = verify2FASchema.parse(req.body);
      const result = await authService.verify2FA(code);

      return res.json({
        success: true,
        token: result.token,
        user: result.user,
        message: '2FA verified successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/setup-2fa
   */
  async setup2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = callerFromReq(req);

      if (!caller.id) {
        throw new AppError('User not authenticated', 401);
      }

      const result = await authService.setup2FA(caller.id);

      return res.json({
        success: true,
        data: result,
        message: '2FA setup successful',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /auth/sessions
   */
  async getSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = callerFromReq(req);

      if (!caller.id) {
        throw new AppError('User not authenticated', 401);
      }

      const sessions = await authService.getSessions(caller.id);

      return res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * DELETE /auth/sessions/:sessionId
   */
  async revokeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const caller = callerFromReq(req);

      if (!caller.id) {
        throw new AppError('User not authenticated', 401);
      }

      await authService.revokeSession(sessionId, caller.id);

      return res.json({
        success: true,
        message: 'Session revoked successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /auth/users
   */
  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '10', search, role, isActive } = req.query;

      const caller = callerFromReq(req);
      const callerIsSuperAdmin = caller.role === 'SUPER_ADMIN';

      const result = await authService.getAllUsers({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        role: role as string,
        isActive: isActive as string,
        hideSuperAdmin: !callerIsSuperAdmin,
      });

      return res.json({
        success: true,
        data: result.users,
        pagination: {
          total: result.total,
          page: Number(page),
          totalPages: result.totalPages,
          limit: Number(limit),
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * GET /auth/users/:userId
   */
  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await authService.getUserById(userId);

      const caller = callerFromReq(req);
      const callerIsSuperAdmin = caller.role === 'SUPER_ADMIN';

      if (user.role === 'SUPER_ADMIN' && !callerIsSuperAdmin) {
        throw new AppError('Access denied', 403);
      }

      return res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * PUT /auth/users/:userId
   */
  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const data = updateUserSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const targetUser = await authService.getUserById(userId);
      const caller = callerFromReq(req);
      const callerIsSuperAdmin = caller.role === 'SUPER_ADMIN';

      if (targetUser.role === 'SUPER_ADMIN' && !callerIsSuperAdmin) {
        throw new AppError(
          'Only SUPER_ADMIN can modify SUPER_ADMIN users',
          403
        );
      }

      if (data.role === 'SUPER_ADMIN' && !callerIsSuperAdmin) {
        throw new AppError(
          'Only SUPER_ADMIN can assign SUPER_ADMIN role',
          403
        );
      }

      const user = await authService.updateUser(userId, data);

      return res.json({
        success: true,
        data: user,
        message: 'User updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * PATCH /auth/users/:userId/role
   */
  async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { role } = updateUserRoleSchema.parse(req.body);

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const targetUser = await authService.getUserById(userId);
      const caller = callerFromReq(req);
      const callerIsSuperAdmin = caller.role === 'SUPER_ADMIN';

      if (targetUser.role === 'SUPER_ADMIN' && !callerIsSuperAdmin) {
        throw new AppError(
          'Only SUPER_ADMIN can modify SUPER_ADMIN users',
          403
        );
      }

      if (role === 'SUPER_ADMIN' && !callerIsSuperAdmin) {
        throw new AppError(
          'Only SUPER_ADMIN can assign SUPER_ADMIN role',
          403
        );
      }

      const user = await authService.updateUserRole(
        userId,
        role,
        caller.role
      );

      return res.json({
        success: true,
        data: user,
        message: `User role updated to ${role}`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  /**
   * DELETE /auth/users/:userId
   */
  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const targetUser = await authService.getUserById(userId);
      const caller = callerFromReq(req);
      const callerIsSuperAdmin = caller.role === 'SUPER_ADMIN';

      if (targetUser.role === 'SUPER_ADMIN' && !callerIsSuperAdmin) {
        throw new AppError(
          'Only SUPER_ADMIN can delete SUPER_ADMIN users',
          403
        );
      }

      if (userId === caller.id) {
        throw new AppError('You cannot delete your own account', 403);
      }

      await authService.deleteUser(userId);

      return res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/change-password
   */
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const caller = callerFromReq(req);
      const { currentPassword, newPassword } = req.body;

      if (!caller.id) {
        throw new AppError('User not authenticated', 401);
      }

      if (!currentPassword || !newPassword) {
        throw new AppError(
          'Current password and new password are required',
          400
        );
      }

      await authService.changePassword(
        caller.id,
        currentPassword,
        newPassword
      );

      return res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/activate/:userId
   */
  async activateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await authService.activateUser(userId);

      return res.json({
        success: true,
        data: user,
        message: 'User activated successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/deactivate/:userId
   */
  async deactivateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;

      if (!userId) {
        throw new AppError('User ID is required', 400);
      }

      const user = await authService.deactivateUser(userId);

      return res.json({
        success: true,
        data: user,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  // ============================================
  // CLERK USER SYNC
  // ============================================

  /**
   * POST /auth/sync
   *
   * Idempotently provisions the local `User` row for the currently
   * authenticated Clerk user.
   *
   * The controller's job is narrow:
   *   1. Extract the Clerk identity from the request (JWT preferred,
   *      body as fallback for missing claims).
   *   2. Delegate to `authService.syncClerkUser()`.
   *   3. Shape the HTTP response.
   *
   * All business rules — the email-adoption path, the first-user-becomes-
   * SUPER_ADMIN rule, the role/permission immunity — live in the service.
   */
  async syncClerkUser(req: Request, res: Response, next: NextFunction) {
    try {
      // ---- 1. Parse the optional body overrides ----------------------
      let bodyData: Partial<z.infer<typeof syncClerkUserSchema>> = {};
      if (
        req.body &&
        typeof req.body === 'object' &&
        Object.keys(req.body).length > 0
      ) {
        try {
          bodyData = syncClerkUserSchema.parse(req.body);
        } catch (err) {
          if (err instanceof z.ZodError) {
            return handleValidationError(err, res);
          }
          throw err;
        }
      }

      // ---- 2. Extract the Clerk identity from the JWT ---------------
      const fromToken = clerkUserFromReq(req);

      // ---- 3. Merge — JWT wins, body fills gaps ---------------------
      // This is what makes the email-adoption path reliable: even when
      // the Clerk session template omits the email claim, the frontend
      // can supply it in the request body.
      const identity = mergeClerkIdentity(fromToken, bodyData);

      // ---- 4. Require the minimum necessary -------------------------
      const clerkId = identity.clerkId;

      if (!clerkId || !CLERK_USER_ID_PATTERN.test(clerkId)) {
        throw new AppError(
          'Could not determine the Clerk user ID from the request. ' +
            'Ensure the request carries a valid Clerk session token.',
          401
        );
      }

      // ---- 5. Delegate to the service -------------------------------
      // The service handles:
      //   • Match by clerkId       → refresh profile
      //   • Match by email         → adopt + rebind clerkId
      //   • No match               → create (first user = SUPER_ADMIN)
      const user = await authService.syncClerkUser({
        clerkId,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        phoneNumber: identity.phoneNumber,
        avatar: identity.avatar,
      });

      // ---- 6. Respond ----------------------------------------------
      return res.json({
        success: true,
        data: user,
        message: 'User synced successfully',
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  // ============================================
  // PERMISSIONS
  // ============================================

  /**
   * GET /auth/permissions
   */
  async getPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const current = (req as any).user;

      if (!current) {
        return res.json({
          success: true,
          data: {
            catalogue: PERMISSION_CATALOGUE,
            roles: ROLE_PERMISSIONS,
            resolved: [],
            wildcard: WILDCARD,
          },
        });
      }

      const resolved = resolvePermissions({
        role: current.role,
        permissions: current.permissions ?? [],
      });

      return res.json({
        success: true,
        data: {
          catalogue: PERMISSION_CATALOGUE,
          roles: ROLE_PERMISSIONS,
          resolved,
          wildcard: WILDCARD,
        },
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  },

  /**
   * POST /auth/check
   */
  async checkPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = checkPermissionsSchema.parse(req.body);
      const current = (req as any).user;

      const resolved = current
        ? resolvePermissions({
            role: current.role,
            permissions: current.permissions ?? [],
          })
        : [];

      const result: Record<string, boolean> = {};
      for (const p of parsed.permissions) {
        result[p] = permissionSetHas(resolved, p);
      }

      return res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },

  // ============================================
  // PROGRAMMATIC SUPERADMIN CREATION
  // ============================================

  /**
   * POST /auth/create-superadmin
   */
  async createSuperAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createSuperAdminSchema.parse(req.body);
      const caller = callerFromReq(req);

      const user = await authService.createSuperAdmin({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        callerRole: caller.role,
      });

      return res.status(201).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
        },
        message: 'SUPER_ADMIN created with supreme rights',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return handleValidationError(error, res);
      }
      return handleError(error, res, next);
    }
  },
};

export default authController;
