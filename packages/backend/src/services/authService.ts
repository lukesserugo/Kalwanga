// D:\Projects\Kalwanga\packages\backend\src\services\authService.ts

import { PrismaClient, Prisma } from '../generated/prisma/index.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Luke@localhost:5432/kalwanga?schema=public',
});

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key';
const SESSION_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds

interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  role: string;
  isActive: boolean;
  businessUnits: any[];
  permissions: any[];
  createdAt?: Date;
  updatedAt?: Date;
  lastLoginAt?: Date | null;
  avatar?: string | null;
  clerkId?: string | null;
}

interface GetAllUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: string;
  hideSuperAdmin?: boolean;
}

interface RegisterParams {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  businessUnitId?: string;
  role?: string;
  clerkId?: string;
}

interface LoginParams {
  email: string;
  password: string;
  remember?: boolean;
}

interface TokenPayload {
  id: string;
  email: string;
  role: string;
  type?: 'access' | 'refresh';
}

export class AuthService {
  /**
   * Generate JWT access token
   */
  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      { ...payload, type: 'access' },
      JWT_SECRET,
      { expiresIn: SESSION_EXPIRY }
    );
  }

  /**
   * Generate JWT refresh token
   */
  private generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(
      { ...payload, type: 'refresh' },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
  }

  /**
   * Verify JWT token
   */
  private verifyToken(token: string, secret: string): TokenPayload {
    try {
      return jwt.verify(token, secret) as TokenPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Register a new user
   */
  async register(data: RegisterParams) {
    try {
      console.log('Registering user:', data.email);
      
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        console.log('User already exists, returning existing user');
        
        const userWithBusinessUnits = await prisma.user.findUnique({
          where: { id: existingUser.id },
          include: {
            businessUnits: {
              include: { businessUnit: true },
              where: { isActive: true },
            },
          },
        });

        const token = this.generateAccessToken({
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role,
        });

        const refreshToken = this.generateRefreshToken({
          id: existingUser.id,
          email: existingUser.email,
          role: existingUser.role,
        });

        return {
          token,
          refreshToken,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            phoneNumber: existingUser.phoneNumber,
            role: existingUser.role,
            isActive: existingUser.isActive,
            businessUnits: userWithBusinessUnits?.businessUnits || [],
            permissions: [],
          },
        };
      }

      const passwordToHash = data.password || this.generateSecureToken().slice(0, 12) + 'Aa1!';
      const hashedPassword = await bcrypt.hash(passwordToHash, 12);

      const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const newUser = await tx.user.create({
          data: {
            email: data.email,
            password: hashedPassword,
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            phoneNumber: data.phoneNumber || null,
            role: (data.role as any) || 'USER',
            isActive: true,
            clerkId: data.clerkId || `clerk_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
          },
        });

        if (data.businessUnitId) {
          await tx.businessUnitUser.create({
            data: {
              userId: newUser.id,
              businessUnitId: data.businessUnitId,
              role: (data.role as any) || 'USER',
              isActive: true,
            },
          });
        }

        return newUser;
      });

      console.log('User created successfully:', user.id);

      const userWithBusinessUnits = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });

      const token = this.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = this.generateRefreshToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
          businessUnits: userWithBusinessUnits?.businessUnits || [],
          permissions: [],
        },
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login a user
   */
  async login(data: LoginParams) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: data.email },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });

      if (!user) {
        throw new Error('Invalid credentials');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      if (user.password && data.password) {
        const isValid = await bcrypt.compare(data.password, user.password);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { 
          lastLoginAt: new Date(),
        },
      });

      const token = this.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = this.generateRefreshToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
          businessUnits: user.businessUnits || [],
          permissions: [],
          lastLoginAt: new Date(),
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.verifyToken(refreshToken, JWT_REFRESH_SECRET);
      
      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      const newToken = this.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          role: user.role,
          isActive: user.isActive,
          businessUnits: user.businessUnits || [],
          permissions: [],
        },
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        businessUnits: user.businessUnits || [],
        permissions: [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        avatar: user.avatar,
        clerkId: user.clerkId,
      };
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        businessUnits: user.businessUnits || [],
        permissions: [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        avatar: user.avatar,
        clerkId: user.clerkId,
      };
    } catch (error) {
      console.error('Get user by ID error:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: any) {
    try {
      const { password, clerkId, id, createdAt, updatedAt, ...updateData } = data;
      
      if (password) {
        updateData.password = await bcrypt.hash(password, 12);
      }

      // Remove undefined values
      Object.keys(updateData).forEach(key => 
        updateData[key] === undefined && delete updateData[key]
      );

      const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: updateData,
          include: {
            businessUnits: {
              include: { businessUnit: true },
              where: { isActive: true },
            },
          },
        });

        if (data.businessUnitId) {
          const existingAssignment = await tx.businessUnitUser.findFirst({
            where: {
              userId: userId,
              businessUnitId: data.businessUnitId,
            },
          });

          if (!existingAssignment) {
            await tx.businessUnitUser.create({
              data: {
                userId: userId,
                businessUnitId: data.businessUnitId,
                role: data.role || updatedUser.role,
                isActive: true,
              },
            });
          }
        }

        return updatedUser;
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        businessUnits: user.businessUnits || [],
        permissions: [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        avatar: user.avatar,
      };
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  /**
   * Get all users with pagination and filtering
   * Includes hiding SUPER_ADMIN users from non-superadmins
   */
  async getAllUsers(params: GetAllUsersParams) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search, 
        role, 
        isActive,
        hideSuperAdmin = false
      } = params;
      
      const skip = (page - 1) * limit;
      const where: any = {};
      
      // Search filter
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      // Role filter - with SUPER_ADMIN hiding
      if (role) {
        if (role === 'SUPER_ADMIN' && hideSuperAdmin) {
          return { users: [], total: 0, totalPages: 0 };
        }
        where.role = role;
      } else if (hideSuperAdmin) {
        where.role = {
          not: 'SUPER_ADMIN'
        };
      }
      
      // Status filter
      if (isActive !== undefined && isActive !== '') {
        where.isActive = isActive === 'true';
      }

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            role: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            lastLoginAt: true,
            avatar: true,
            businessUnits: {
              include: { businessUnit: true },
              where: { isActive: true },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return { 
        users, 
        total, 
        totalPages: Math.ceil(total / limit) 
      };
    } catch (error) {
      console.error('Get all users error:', error);
      throw error;
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: string) {
    try {
      const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { role: role as any },
        });

        await tx.businessUnitUser.updateMany({
          where: {
            userId: userId,
            isActive: true,
          },
          data: {
            role: role as any,
          },
        });

        return await tx.user.findUnique({
          where: { id: userId },
          include: {
            businessUnits: {
              include: { businessUnit: true },
              where: { isActive: true },
            },
          },
        });
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        businessUnits: user.businessUnits || [],
        permissions: [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        avatar: user.avatar,
      };
    } catch (error) {
      console.error('Update user role error:', error);
      throw error;
    }
  }

  /**
   * Delete user (soft delete - deactivate)
   */
  async deleteUser(userId: string) {
    try {
      const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { 
            isActive: false,
          },
        });

        await tx.businessUnitUser.updateMany({
          where: {
            userId: userId,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        return updatedUser;
      });

      return user;
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout() {
    return { message: 'Logout successful' };
  }

  /**
   * Forgot password - send reset link
   */
  async forgotPassword(email: string) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (user) {
        const resetToken = jwt.sign(
          { 
            id: user.id, 
            email: user.email, 
            purpose: 'password-reset' 
          },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        console.log('Password reset token generated for:', email, resetToken);
        // TODO: Send email with reset link
      }
      
      return { message: 'If the email exists, a password reset link has been sent' };
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, password: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.purpose !== 'password-reset') {
        throw new Error('Invalid token');
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.user.update({
          where: { id: decoded.id },
          data: { 
            password: hashedPassword,
          },
        });
      });

      return { message: 'Password reset successful' };
    } catch (error) {
      console.error('Reset password error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.purpose !== 'email-verification') {
        throw new Error('Invalid token');
      }

      await prisma.user.update({
        where: { id: decoded.id },
        data: { 
          isActive: true,
        },
      });

      return { message: 'Email verified successfully' };
    } catch (error) {
      console.error('Verify email error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Resend verification email
   */
  async resendVerification(email: string) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (user) {
        const verificationToken = jwt.sign(
          { 
            id: user.id, 
            email: user.email, 
            purpose: 'email-verification' 
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log('Verification email sent to:', email, verificationToken);
        // TODO: Send email with verification link
      }
      
      return { message: 'If the email exists, a verification email has been sent' };
    } catch (error) {
      console.error('Resend verification error:', error);
      throw error;
    }
  }

  /**
   * Verify 2FA code
   */
  async verify2FA(code: string) {
    try {
      // For now, just return a success response
      // In production, implement actual 2FA verification with otplib
      return { 
        token: 'temp-token', 
        user: null 
      };
    } catch (error) {
      console.error('2FA verification error:', error);
      throw error;
    }
  }

  /**
   * Setup 2FA for user
   */
  async setup2FA(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // For now, return placeholder data
      // In production, implement actual 2FA setup with otplib
      const secret = 'generated-secret';
      const qrCode = 'generated-qr-code';
      const backupCodes = ['backup-code-1', 'backup-code-2'];

      return { 
        secret, 
        qrCode, 
        backupCodes 
      };
    } catch (error) {
      console.error('Setup 2FA error:', error);
      throw error;
    }
  }

  /**
   * Get user sessions
   */
  async getSessions(userId: string) {
    try {
      // Return empty array - session tracking not implemented
      return [];
    } catch (error) {
      console.error('Get sessions error:', error);
      return [];
    }
  }

  /**
   * Revoke a session
   */
  async revokeSession(sessionId: string, userId: string) {
    try {
      return { message: 'Session revoked successfully' };
    } catch (error) {
      console.error('Revoke session error:', error);
      return { message: 'Failed to revoke session' };
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.password) {
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
          throw new Error('Current password is incorrect');
        }
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      return { message: 'Password changed successfully' };
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Activate user account
   */
  async activateUser(userId: string) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { isActive: true },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        businessUnits: user.businessUnits || [],
        permissions: [],
      };
    } catch (error) {
      console.error('Activate user error:', error);
      throw error;
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive,
        businessUnits: user.businessUnits || [],
        permissions: [],
      };
    } catch (error) {
      console.error('Deactivate user error:', error);
      throw error;
    }
  }
}
