// D:\Projects\Kalwanga\packages\web\services\authService.ts

import { api } from './api';

// ============================================
// TYPES
// ============================================

// Export User interface so it can be imported by useAuth
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
  // Extra fields that the backend's `shapeUser()` includes.
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
  role?: string; // Add role support
}

interface RegisterResponse {
  token: string;
  user: User;
}

/**
 * Optional overrides for the `/auth/sync` endpoint.
 *
 * The backend derives identity from the Clerk JWT — these fields are
 * only used when the JWT is missing something (e.g. no email claim in
 * the current session template). Callers can usually call
 * `syncClerkUser()` with no arguments.
 */
interface SyncClerkUserInput {
  clerkId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatar?: string;
}

/**
 * The shape returned by `POST /auth/sync`. Matches the shaped user
 * from the backend (`shapeUser()` in `authService.ts`) plus a couple
 * of convenience fields.
 */
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
 * Strip `undefined` and empty-string values from an object before
 * sending it as a request body.
 *
 * Why: the backend's Zod schema for `/auth/sync` accepts strings only.
 * Sending `{ email: undefined }` is fine, but sending `{ email: "" }`
 * is also fine yet wasteful — the backend would then skip overwriting
 * an existing email with a blank string anyway. Stripping empties up
 * front keeps the payload minimal and lets the backend fall back to
 * the JWT for missing fields.
 */
function pruneEmpty<T extends Record<string, unknown>>(input: T): Partial<T> {
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
      // Even if the API call fails, clear local state.
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
   *
   * Called from `useAuth` on every session. Idempotent: safe to call
   * repeatedly. Returns the canonical `User` row from the database,
   * which includes the CUID (`id`) that every foreign key in the
   * schema expects.
   *
   * Why this exists:
   *   Clerk is the identity provider, but the app stores its own
   *   `User` rows in Postgres. Without this call a freshly-signed-in
   *   Clerk user has no local row, so any endpoint that resolves a
   *   `userId` foreign key will fail with `USER_NOT_SYNCED`.
   *
   * The backend's `syncClerkUser()` handler resolves the identity in
   * this order:
   *   1. Match by `clerkId` → refresh mutable profile fields.
   *   2. Match by `email`   → adopt the row (rebind `clerkId`).
   *   3. No match           → create a fresh row.
   *
   * All three branches preserve the existing `role` and `permissions`.
   *
   * @param input — optional overrides. The backend reads identity from
   *                the verified Clerk JWT first; these are fallbacks
   *                for claims the current session template omits.
   */
  async syncClerkUser(input?: SyncClerkUserInput): Promise<SyncedUser> {
    // Strip undefined/empty values so the backend can fall back to the
    // JWT for any field the caller didn't supply.
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
