// D:\Projects\Kalwanga\packages\web\services\authService.ts

import { api } from './api';

// ============================================
// TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  businessUnits: Array<{ businessUnitId: string; role: string }>;
  isActive?: boolean;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
  clerkId?: string;
  phoneNumber?: string | null;
  avatar?: string | null;
  lastLoginAt?: string | null;
}

interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

interface LoginResponse {
  token: string;
  user: User;
}

interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  businessUnitId?: string;
  role?: string;
}

interface RegisterResponse {
  token: string;
  user: User;
}

interface SyncClerkUserInput {
  clerkId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatar?: string;
}

export interface SyncedUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  businessUnits?: Array<{
    businessUnitId: string;
    role: string;
    businessUnit?: { id: string; name: string; code?: string };
  }>;
  phoneNumber?: string | null;
  avatar?: string | null;
  lastLoginAt?: string | null;
}

/**
 * Strip `undefined`, `null`, and empty-string values from an object
 * before sending it as a request body.
 *
 * ⚠ The constraint is `object`, not `Record<string, unknown>`.
 *   `Record<string, unknown>` requires the argument to have a
 *   string index signature; plain interfaces with named optional
 *   fields (`SyncClerkUserInput`, etc.) do not have one, so
 *   `pruneEmpty(someInterface)` was rejected with TS2345.
 *
 *   `T extends object` accepts any non-primitive, and the cast
 *   `key as keyof T` inside the loop keeps the return type precise
 *   (`Partial<T>`, not `Record<string, unknown>`).
 */
function pruneEmpty<T extends object>(input: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    out[key as keyof T] = value as T[keyof T];
  }
  return out;
}

// ============================================
// SERVICE
// ============================================

export const authService = {
  /**
   * Login user — POST /auth/login
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response;
  },

  /**
   * Register user — POST /auth/register
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register', data);
    return response;
  },

  /**
   * Logout user — POST /auth/logout
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('businessUnitId');
      }
    }
  },

  /**
   * Sync the currently-authenticated Clerk user with the local
   * `users` table.
   */
  async syncClerkUser(input?: SyncClerkUserInput): Promise<SyncedUser> {
    const body = input ? pruneEmpty(input) : {};
    const response = await api.post<SyncedUser>('/auth/sync', body);
    return response;
  },

  /**
   * Get current user — GET /auth/me
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response;
  },

  /**
   * Update user role — PATCH /auth/users/:userId/role
   */
  async updateUserRole(userId: string, role: string): Promise<User> {
    const response = await api.patch<User>(`/auth/users/${userId}/role`, {
      role,
    });
    return response;
  },

  /**
   * Update user profile — PUT /auth/users/:userId
   */
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const response = await api.put<User>(`/auth/users/${userId}`, data);
    return response;
  },

  /**
   * Get all users — GET /auth/users (Admin only)
   */
  async getUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ users: User[]; total: number }> {
    const response = await api.get<{ users: User[]; total: number }>(
      '/auth/users',
      { params }
    );
    return response;
  },

  /**
   * Get user by ID — GET /auth/users/:userId
   */
  async getUserById(userId: string): Promise<User> {
    const response = await api.get<User>(`/auth/users/${userId}`);
    return response;
  },

  /**
   * Delete user — DELETE /auth/users/:userId (Admin only)
   */
  async deleteUser(userId: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(
      `/auth/users/${userId}`
    );
    return response;
  },

  /**
   * Forgot password — POST /auth/forgot-password
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      '/auth/forgot-password',
      { email }
    );
    return response;
  },

  /**
   * Reset password — POST /auth/reset-password
   */
  async resetPassword(
    token: string,
    password: string
  ): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      '/auth/reset-password',
      { token, password }
    );
    return response;
  },

  /**
   * Verify 2FA — POST /auth/verify-2fa
   */
  async verify2FA(code: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/verify-2fa', {
      code,
    });
    return response;
  },

  /**
   * Setup 2FA — POST /auth/setup-2fa
   */
  async setup2FA(): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    const response = await api.post<{
      secret: string;
      qrCode: string;
      backupCodes: string[];
    }>('/auth/setup-2fa');
    return response;
  },

  /**
   * Verify email — POST /auth/verify-email
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      '/auth/verify-email',
      { token }
    );
    return response;
  },

  /**
   * Resend verification email — POST /auth/resend-verification
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      '/auth/resend-verification',
      { email }
    );
    return response;
  },

  /**
   * Get user sessions — GET /auth/sessions
   */
  async getSessions(): Promise<any[]> {
    const response = await api.get<any[]>('/auth/sessions');
    return response;
  },

  /**
   * Revoke session — DELETE /auth/sessions/:sessionId
   */
  async revokeSession(sessionId: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(
      `/auth/sessions/${sessionId}`
    );
    return response;
  },

  /**
   * Get user permissions — GET /auth/permissions
   */
  async getPermissions(): Promise<string[]> {
    const response = await api.get<string[]>('/auth/permissions');
    return response;
  },

  /**
   * Update user permissions —
   * PUT /auth/users/:userId/permissions (Admin only)
   */
  async updateUserPermissions(
    userId: string,
    permissions: string[]
  ): Promise<User> {
    const response = await api.put<User>(
      `/auth/users/${userId}/permissions`,
      { permissions }
    );
    return response;
  },
};

export default authService;
