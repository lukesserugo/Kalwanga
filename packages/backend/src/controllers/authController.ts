// D:\Projects\Kalwanga\packages\backend\src\controllers\authController.ts

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';

const authService = new AuthService();

// Validation schemas
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

// Helper function to handle validation errors
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

// Helper function to handle general errors
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
    
    if (errorMessage.includes('Invalid credentials')) {
      statusCode = 401;
    } else if (errorMessage.includes('not found')) {
      statusCode = 404;
    } else if (errorMessage.includes('deactivated')) {
      statusCode = 403;
    } else if (errorMessage.includes('Invalid or expired token')) {
      statusCode = 400;
    } else if (errorMessage.includes('already exists')) {
      statusCode = 409;
    } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('unauthenticated')) {
      statusCode = 401;
    } else if (errorMessage.includes('Forbidden') || errorMessage.includes('not allowed')) {
      statusCode = 403;
    }
    
    console.error('Controller error:', error);
    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
  
  next(error);
}

export const authController = {
  /**
   * POST /auth/register
   * Register a new user - Only SUPER_ADMIN can create ADMIN users
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('Register request received:', { email: req.body?.email });
      
      const data = registerSchema.parse(req.body);
      
      // Security: If trying to create SUPER_ADMIN, verify the creator is SUPER_ADMIN
      if (data.role === 'SUPER_ADMIN') {
        const currentUserId = (req as any).user?.id || (req as any).userId;
        if (!currentUserId) {
          throw new AppError('Unauthorized to create SUPER_ADMIN', 403);
        }
        const currentUser = await authService.getUserById(currentUserId);
        if (currentUser?.role !== 'SUPER_ADMIN') {
          throw new AppError('Only SUPER_ADMIN can create SUPER_ADMIN users', 403);
        }
      }
      
      const result = await authService.register(data);
      
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
   * Login a user
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
   * Refresh access token
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
   * Get current authenticated user
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }
      
      const user = await authService.getCurrentUser(userId);
      
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
   * Logout current user
   */
  async logout(req: Request, res: Response, next: NextFunction) {
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
   * Send password reset email
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
   * Reset password with token
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
   * Verify user email
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
   * Resend verification email
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
   * Verify 2FA code
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
   * Setup 2FA for current user
   */
  async setup2FA(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }
      
      const result = await authService.setup2FA(userId);
      
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
   * Get current user's sessions
   */
  async getSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }
      
      const sessions = await authService.getSessions(userId);
      
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
   * Revoke a session
   */
  async revokeSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { sessionId } = req.params;
      const userId = (req as any).user?.id || (req as any).userId;
      
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }
      
      await authService.revokeSession(sessionId, userId);
      
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
   * Get all users (Admin/SuperAdmin only) - HIDE SUPER_ADMIN from regular users
   */
  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '10', search, role, isActive } = req.query;
      
      // Get the current user's role
      const currentUserId = (req as any).user?.id || (req as any).userId;
      let isSuperAdmin = false;
      
      if (currentUserId) {
        try {
          const currentUser = await authService.getUserById(currentUserId);
          isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
        } catch (e) {
          console.log('Could not fetch current user for permissions check');
        }
      }
      
      const result = await authService.getAllUsers({
        page: Number(page),
        limit: Number(limit),
        search: search as string,
        role: role as string,
        isActive: isActive as string,
        hideSuperAdmin: !isSuperAdmin,
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
   * Get user by ID (Admin only)
   */
  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }
      
      const user = await authService.getUserById(userId);
      
      // Security: If not SUPER_ADMIN, don't return SUPER_ADMIN user details
      const currentUserId = (req as any).user?.id || (req as any).userId;
      let isSuperAdmin = false;
      
      if (currentUserId) {
        try {
          const currentUser = await authService.getUserById(currentUserId);
          isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
        } catch (e) {
          // User might not exist yet
        }
      }
      
      // If user is SUPER_ADMIN and requester is not SUPER_ADMIN, deny access
      if (user.role === 'SUPER_ADMIN' && !isSuperAdmin) {
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
   * Update user (Admin only)
   */
  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const data = updateUserSchema.parse(req.body);
      
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }
      
      // Security: Check if trying to modify SUPER_ADMIN
      const targetUser = await authService.getUserById(userId);
      const currentUserId = (req as any).user?.id || (req as any).userId;
      let isSuperAdmin = false;
      
      if (currentUserId) {
        try {
          const currentUser = await authService.getUserById(currentUserId);
          isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
        } catch (e) {}
      }
      
      // If target is SUPER_ADMIN and requester is not SUPER_ADMIN, deny
      if (targetUser.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can modify SUPER_ADMIN users', 403);
      }
      
      // Security: Prevent non-superadmins from assigning SUPER_ADMIN role
      if (data.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can assign SUPER_ADMIN role', 403);
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
   * Update user role (Admin only)
   */
  async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      const { role } = updateUserRoleSchema.parse(req.body);
      
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }
      
      // Security: Check if trying to modify SUPER_ADMIN
      const targetUser = await authService.getUserById(userId);
      const currentUserId = (req as any).user?.id || (req as any).userId;
      let isSuperAdmin = false;
      
      if (currentUserId) {
        try {
          const currentUser = await authService.getUserById(currentUserId);
          isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
        } catch (e) {}
      }
      
      // If target is SUPER_ADMIN and requester is not SUPER_ADMIN, deny
      if (targetUser.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can modify SUPER_ADMIN users', 403);
      }
      
      // Security: Prevent non-superadmins from assigning SUPER_ADMIN role
      if (role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can assign SUPER_ADMIN role', 403);
      }
      
      const user = await authService.updateUserRole(userId, role);
      
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
   * Delete user - Only SUPER_ADMIN can delete SUPER_ADMIN
   */
  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }
      
      // Check if trying to delete SUPER_ADMIN
      const targetUser = await authService.getUserById(userId);
      const currentUserId = (req as any).user?.id || (req as any).userId;
      let isSuperAdmin = false;
      
      if (currentUserId) {
        try {
          const currentUser = await authService.getUserById(currentUserId);
          isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
        } catch (e) {}
      }
      
      // If target is SUPER_ADMIN and requester is not SUPER_ADMIN, deny
      if (targetUser.role === 'SUPER_ADMIN' && !isSuperAdmin) {
        throw new AppError('Only SUPER_ADMIN can delete SUPER_ADMIN users', 403);
      }
      
      // Prevent self-deletion
      if (userId === currentUserId) {
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
   * Change user password
   */
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).userId;
      const { currentPassword, newPassword } = req.body;
      
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }
      
      if (!currentPassword || !newPassword) {
        throw new AppError('Current password and new password are required', 400);
      }
      
      await authService.changePassword(userId, currentPassword, newPassword);
      
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
   * Activate user account (Admin only)
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
   * Deactivate user account (Admin only)
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
};
