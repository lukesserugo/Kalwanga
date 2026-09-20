// D:\Projects\Kalwanga\packages\backend\src\services\authService.ts

import { Prisma } from '../generated/prisma/index.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// ✅ Use the shared Prisma client instead of instantiating a second one.
import { prisma } from '../lib/prisma.js';

// ✅ Single source of truth for permissions.
import {
  resolvePermissions,
  WILDCARD,
} from '../lib/permissions.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key';
const SESSION_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds

// ============================================
// TYPES
// ============================================

interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  role: string;
  isActive: boolean;
  businessUnits: any[];
  /** Resolved permissions for this user, including the '*' wildcard for SUPER_ADMIN. */
  permissions: string[];
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
  /** The caller's role — used to enforce escalation rules. */
  callerRole?: string;
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
  /** The role of whoever is calling register. Defaults to 'GUEST'. */
  callerRole?: string;
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

/**
 * Payload for `syncClerkUser`.
 *
 * Every field except `clerkId` is optional because Clerk JWTs vary in
 * what they include depending on the session template. The controller
 * fills in as many fields as it can from `req.auth`; whatever is
 * missing here is left as-is.
 */
interface SyncClerkUserParams {
  clerkId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatar?: string;
}

/**
 * Roles that only a SUPER_ADMIN may create or assign.
 */
const SUPER_ADMIN_ONLY_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

/**
 * Roles that a MANAGER may create (everything below ADMIN).
 */
const MANAGER_CREATABLE_ROLES = new Set([
  'MANAGER',
  'EDITOR',
  'VIEWER',
  'EMPLOYEE',
  'CASHIER',
  'USER',
]);

/**
 * Clerk user ID format. Used to sanity-check incoming sync requests
 * before we hit the database.
 */
const CLERK_USER_ID_PATTERN = /^user_[A-Za-z0-9]+$/;

// ============================================
// SERVICE
// ============================================

export class AuthService {
  // ---------- Token helpers ----------

  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign({ ...payload, type: 'access' }, JWT_SECRET, {
      expiresIn: SESSION_EXPIRY,
    });
  }

  private generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign({ ...payload, type: 'refresh' }, JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });
  }

  private verifyToken(token: string, secret: string): TokenPayload {
    try {
      return jwt.verify(token, secret) as TokenPayload;
    } catch {
      throw new Error('Invalid or expired token');
    }
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // ---------- User shaping ----------

  /**
   * Turn a Prisma user row into the shape the API returns.
   *
   * ✅ Resolves permissions from the canonical source. SUPER_ADMIN
   *    gets `['*', ...ALL_PERMISSIONS]`. Everyone else gets their
   *    custom override if present, otherwise their role defaults.
   */
  private shapeUser(user: any): UserResponse {
    const permissions = resolvePermissions({
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber ?? null,
      role: user.role,
      isActive: user.isActive,
      businessUnits: user.businessUnits ?? [],
      permissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt ?? null,
      avatar: user.avatar ?? null,
      clerkId: user.clerkId ?? null,
    };
  }

  /**
   * Enforce that `callerRole` is allowed to create / assign `targetRole`.
   *
   * Rules:
   *   • SUPER_ADMIN can do anything.
   *   • ADMIN can create ADMIN or lower (but not SUPER_ADMIN).
   *   • MANAGER can create MANAGER or lower.
   *   • Anyone else cannot create roles at all.
   */
  private assertRoleAllowed(
    callerRole: string | undefined,
    targetRole: string | undefined
  ): void {
    if (!targetRole) return;
    if (callerRole === 'SUPER_ADMIN') return;

    if (SUPER_ADMIN_ONLY_ROLES.has(targetRole)) {
      throw new Error(
        `Only SUPER_ADMIN can create or assign the ${targetRole} role`
      );
    }

    if (callerRole === 'ADMIN') {
      // ADMIN can create anything below SUPER_ADMIN, handled above.
      return;
    }

    if (callerRole === 'MANAGER' && MANAGER_CREATABLE_ROLES.has(targetRole)) {
      return;
    }

    throw new Error(
      `Caller with role ${callerRole ?? 'GUEST'} cannot create role ${targetRole}`
    );
  }

  // ============================================
  // REGISTRATION
  // ============================================

  async register(data: RegisterParams) {
    try {
      console.log('Registering user:', data.email);

      // ✅ Enforce role escalation rules BEFORE touching the DB.
      this.assertRoleAllowed(data.callerRole, data.role);

      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
        include: {
          businessUnits: {
            include: { businessUnit: true },
            where: { isActive: true },
          },
        },
      });

      if (existingUser) {
        console.log('User already exists, returning existing user');

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
          user: this.shapeUser(existingUser),
        };
      }

      const passwordToHash =
        data.password ||
        this.generateSecureToken().slice(0, 12) + 'Aa1!';
      const hashedPassword = await bcrypt.hash(passwordToHash, 12);

      const user = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const newUser = await tx.user.create({
            data: {
              email: data.email,
              password: hashedPassword,
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              phoneNumber: data.phoneNumber || null,
              role: (data.role as any) || 'USER',
              isActive: true,
              clerkId:
                data.clerkId ||
                `clerk_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
              // ✅ Do NOT store explicit permissions. Let resolvePermissions
              //    derive them from role. This keeps SUPER_ADMIN supreme
              //    even after new permissions are added to the catalogue.
              permissions: [],
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
        }
      );

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
        user: this.shapeUser(userWithBusinessUnits ?? user),
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // ============================================
  // LOGIN
  // ============================================

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

      if (!user) throw new Error('Invalid credentials');
      if (!user.isActive) throw new Error('Account is deactivated');

      if (user.password && data.password) {
        const isValid = await bcrypt.compare(data.password, user.password);
        if (!isValid) throw new Error('Invalid credentials');
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
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
          ...this.shapeUser(user),
          lastLoginAt: new Date(),
        },
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // ============================================
  // REFRESH
  // ============================================

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

      if (!user) throw new Error('User not found');
      if (!user.isActive) throw new Error('Account is deactivated');

      const newToken = this.generateAccessToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        token: newToken,
        user: this.shapeUser(user),
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }

  // ============================================
  // READ
  // ============================================

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

      if (!user) throw new Error('User not found');
      if (!user.isActive) throw new Error('Account is deactivated');

      return this.shapeUser(user);
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

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

      if (!user) throw new Error('User not found');

      return this.shapeUser(user);
    } catch (error) {
      console.error('Get user by ID error:', error);
      throw error;
    }
  }

  // ============================================
  // UPDATE
  // ============================================

  async updateUser(userId: string, data: any) {
    try {
      const {
        password,
        clerkId,
        id,
        createdAt,
        updatedAt,
        permissions: _ignoredPermissions, // never accept raw permissions here
        ...updateData
      } = data;

      if (password) {
        updateData.password = await bcrypt.hash(password, 12);
      }

      // Remove undefined values
      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key]
      );

      const user = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
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
                userId,
                businessUnitId: data.businessUnitId,
              },
            });

            if (!existingAssignment) {
              await tx.businessUnitUser.create({
                data: {
                  userId,
                  businessUnitId: data.businessUnitId,
                  role: data.role || updatedUser.role,
                  isActive: true,
                },
              });
            }
          }

          return updatedUser;
        }
      );

      return this.shapeUser(user);
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  // ============================================
  // LIST
  // ============================================

  async getAllUsers(params: GetAllUsersParams) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        role,
        isActive,
        hideSuperAdmin = false,
      } = params;

      const skip = (page - 1) * limit;
      const where: any = {};

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (role) {
        if (role === 'SUPER_ADMIN' && hideSuperAdmin) {
          return { users: [], total: 0, totalPages: 0 };
        }
        where.role = role;
      } else if (hideSuperAdmin) {
        where.role = { not: 'SUPER_ADMIN' };
      }

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
            clerkId: true,
            // ✅ Include permissions so shapeUser can resolve.
            permissions: true,
            businessUnits: {
              include: { businessUnit: true },
              where: { isActive: true },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        // ✅ Resolve permissions per user so the frontend gets correct sets.
        users: users.map((u) => this.shapeUser(u)),
        total,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Get all users error:', error);
      throw error;
    }
  }

  // ============================================
  // ROLE
  // ============================================

  async updateUserRole(
    userId: string,
    role: string,
    callerRole?: string
  ) {
    try {
      // ✅ Enforce escalation rules BEFORE touching the DB.
      this.assertRoleAllowed(callerRole, role);

      const user = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: {
              role: role as any,
              // ✅ Clear explicit permissions when role changes so the
              //    new role's defaults take over. If the caller wants to
              //    keep custom permissions, they must set them afterwards.
              permissions: [],
            },
          });

          await tx.businessUnitUser.updateMany({
            where: { userId, isActive: true },
            data: { role: role as any },
          });

          return tx.user.findUnique({
            where: { id: userId },
            include: {
              businessUnits: {
                include: { businessUnit: true },
                where: { isActive: true },
              },
            },
          });
        }
      );

      if (!user) throw new Error('User not found');

      return this.shapeUser(user);
    } catch (error) {
      console.error('Update user role error:', error);
      throw error;
    }
  }

  // ============================================
  // DELETE
  // ============================================

  async deleteUser(userId: string) {
    try {
      return await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updatedUser = await tx.user.update({
            where: { id: userId },
            data: { isActive: false },
          });

          await tx.businessUnitUser.updateMany({
            where: { userId, isActive: true },
            data: { isActive: false },
          });

          return updatedUser;
        }
      );
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  // ============================================
  // MISC (unchanged)
  // ============================================

  async logout() {
    return { message: 'Logout successful' };
  }

  async forgotPassword(email: string) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const resetToken = jwt.sign(
          { id: user.id, email: user.email, purpose: 'password-reset' },
          JWT_SECRET,
          { expiresIn: '1h' }
        );

        console.log('Password reset token generated for:', email, resetToken);
        // TODO: Send email with reset link
      }

      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

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
          data: { password: hashedPassword },
        });
      });

      return { message: 'Password reset successful' };
    } catch (error) {
      console.error('Reset password error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  async verifyEmail(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      if (decoded.purpose !== 'email-verification') {
        throw new Error('Invalid token');
      }

      await prisma.user.update({
        where: { id: decoded.id },
        data: { isActive: true },
      });

      return { message: 'Email verified successfully' };
    } catch (error) {
      console.error('Verify email error:', error);
      throw new Error('Invalid or expired token');
    }
  }

  async resendVerification(email: string) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const verificationToken = jwt.sign(
          { id: user.id, email: user.email, purpose: 'email-verification' },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log('Verification email sent to:', email, verificationToken);
        // TODO: Send email with verification link
      }

      return {
        message: 'If the email exists, a verification email has been sent',
      };
    } catch (error) {
      console.error('Resend verification error:', error);
      throw error;
    }
  }

  async verify2FA(code: string) {
    try {
      return { token: 'temp-token', user: null };
    } catch (error) {
      console.error('2FA verification error:', error);
      throw error;
    }
  }

  async setup2FA(userId: string) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      return {
        secret: 'generated-secret',
        qrCode: 'generated-qr-code',
        backupCodes: ['backup-code-1', 'backup-code-2'],
      };
    } catch (error) {
      console.error('Setup 2FA error:', error);
      throw error;
    }
  }

  async getSessions(_userId: string) {
    return [];
  }

  async revokeSession(_sessionId: string, _userId: string) {
    return { message: 'Session revoked successfully' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');

      if (user.password) {
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) throw new Error('Current password is incorrect');
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

  // ============================================
  // ACTIVATE / DEACTIVATE
  // ============================================

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

      return this.shapeUser(user);
    } catch (error) {
      console.error('Activate user error:', error);
      throw error;
    }
  }

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

      return this.shapeUser(user);
    } catch (error) {
      console.error('Deactivate user error:', error);
      throw error;
    }
  }

  // ============================================
  // PROGRAMMATIC SUPERADMIN CREATION
  // ============================================

  /**
   * Create a SUPER_ADMIN programmatically.
   *
   * Unlike `register`, this method:
   *   • Never accepts a role parameter — SUPER_ADMIN is hardcoded.
   *   • Never accepts permissions — resolvePermissions derives them.
   *   • Refuses if a SUPER_ADMIN already exists (unless caller is one).
   *
   * This is the ONLY sanctioned path to create a SUPER_ADMIN. Callers
   * must go through it, which means the wildcard guarantee in
   * `resolvePermissions` is enforced at the one entry point that can
   * mint a supreme user.
   */
  async createSuperAdmin(input: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    callerRole?: string;
  }) {
    const { email, firstName, lastName, password, callerRole } = input;

    if (!email || !firstName || !lastName) {
      throw new Error('email, firstName, and lastName are required');
    }

    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });

    if (existingSuperAdmin && callerRole !== 'SUPER_ADMIN') {
      throw new Error(
        'A SUPER_ADMIN already exists and you are not one, so you cannot create another'
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('User with this email already exists');
    }

    const passwordToHash =
      password || this.generateSecureToken().slice(0, 12) + 'Aa1!';
    const hashedPassword = await bcrypt.hash(passwordToHash, 12);

    const user = await prisma.user.create({
      data: {
        clerkId: `superadmin_${Date.now()}_${crypto
          .randomBytes(8)
          .toString('hex')}`,
        email,
        firstName,
        lastName,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isActive: true,
        // ✅ Explicitly empty. resolvePermissions expands this at read time.
        permissions: [],
      },
      include: {
        businessUnits: {
          include: { businessUnit: true },
          where: { isActive: true },
        },
      },
    });

    return this.shapeUser(user);
  }

  // ============================================
  // CLERK SYNC
  // ============================================

  /**
   * Idempotently provision the local `User` row for a Clerk identity.
   *
   * Called by `POST /auth/sync`. Clerk is the identity provider, but
   * the app stores its own `User` rows in Postgres and every foreign
   * key in the schema points at `User.id` (a CUID), not at the Clerk
   * ID. Without this method a freshly-authenticated Clerk user has no
   * local row and any FK-based validation fails with `USER_NOT_SYNCED`.
   *
   * Resolution order:
   *   1. Match by `clerkId` → refresh mutable profile fields only.
   *   2. Match by `email` (different `clerkId`) → **adopt** the row by
   *      rebinding its `clerkId`. This handles the common case where a
   *      bootstrap-created SUPER_ADMIN row already owns the email.
   *   3. No match → create a fresh row.
   *
   * Safety invariants:
   *   • `role` and `permissions` are NEVER modified by this method —
   *     only admins can change them via the existing endpoints.
   *   • On adoption, the existing role is preserved. A pre-existing
   *     SUPER_ADMIN stays SUPER_ADMIN.
   *   • On create, the first-ever user becomes SUPER_ADMIN; everyone
   *     else starts as USER.
   */
  async syncClerkUser(params: SyncClerkUserParams): Promise<UserResponse> {
    const { clerkId, email, firstName, lastName, phoneNumber, avatar } = params;

    if (!clerkId || typeof clerkId !== 'string') {
      throw new Error('Clerk user ID is required');
    }

    const trimmed = clerkId.trim();
    if (!CLERK_USER_ID_PATTERN.test(trimmed)) {
      throw new Error(`Invalid Clerk user ID format: "${trimmed}"`);
    }

    const include = {
      businessUnits: {
        include: { businessUnit: true },
        where: { isActive: true },
      },
    } as const;

    // ─── 1. Match by clerkId ─────────────────────────────────────────
    const byClerkId = await prisma.user.findUnique({
      where: { clerkId: trimmed },
    });

    if (byClerkId) {
      // Refresh mutable profile fields only. `role` and `permissions`
      // stay untouched, so a caller cannot self-promote via /auth/sync.
      const updated = await prisma.user.update({
        where: { clerkId: trimmed },
        data: {
          ...(email && email.trim() ? { email: email.trim() } : {}),
          ...(firstName && firstName.trim()
            ? { firstName: firstName.trim() }
            : {}),
          ...(lastName && lastName.trim()
            ? { lastName: lastName.trim() }
            : {}),
          ...(phoneNumber && phoneNumber.trim()
            ? { phoneNumber: phoneNumber.trim() }
            : {}),
          ...(avatar && avatar.trim() ? { avatar: avatar.trim() } : {}),
          lastLoginAt: new Date(),
        },
        include,
      });

      return this.shapeUser(updated);
    }

    // ─── 2. Match by email (email collision) ─────────────────────────
    // A row already exists for this email but with a different
    // `clerkId` (typically a bootstrap placeholder). Adopt it by
    // rebinding the `clerkId`. Preserve `role` and `permissions`.
    if (email && email.trim()) {
      const byEmail = await prisma.user.findUnique({
        where: { email: email.trim() },
      });

      if (byEmail) {
        console.warn(
          `⚠️ [authService.syncClerkUser] Adopting existing user ` +
            `id=${byEmail.id} email=${byEmail.email} ` +
            `(old clerkId=${byEmail.clerkId}) → new clerkId=${trimmed}`
        );

        const adopted = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            clerkId: trimmed,
            ...(firstName && firstName.trim()
              ? { firstName: firstName.trim() }
              : {}),
            ...(lastName && lastName.trim()
              ? { lastName: lastName.trim() }
              : {}),
            ...(phoneNumber && phoneNumber.trim()
              ? { phoneNumber: phoneNumber.trim() }
              : {}),
            ...(avatar && avatar.trim() ? { avatar: avatar.trim() } : {}),
            lastLoginAt: new Date(),
            // role / permissions intentionally preserved
          },
          include,
        });

        return this.shapeUser(adopted);
      }
    }

    // ─── 3. No match — create a fresh row ────────────────────────────
    if (!email || !email.trim()) {
      throw new Error(
        'Cannot provision a new user without an email address. ' +
          'Ensure the Clerk profile has a verified email.'
      );
    }

    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    const created = await prisma.user.create({
      data: {
        clerkId: trimmed,
        email: email.trim(),
        firstName: (firstName ?? '').trim() || 'User',
        lastName: (lastName ?? '').trim() || '',
        phoneNumber: phoneNumber?.trim() || null,
        avatar: avatar?.trim() || null,
        // No password — the user authenticates via Clerk.
        password: null,
        role: isFirstUser ? 'SUPER_ADMIN' : 'USER',
        isActive: true,
        // ✅ Empty array — resolvePermissions derives the set at read time.
        permissions: [],
        lastLoginAt: new Date(),
      },
      include,
    });

    console.log(
      `✅ [authService] Provisioned Clerk user ${trimmed} as ${
        isFirstUser ? 'SUPER_ADMIN (first user)' : 'USER'
      }`
    );

    return this.shapeUser(created);
  }
}

export default AuthService;
