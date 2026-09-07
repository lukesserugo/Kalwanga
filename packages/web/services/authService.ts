// D:\Projects\Kalwanga\packages\web\services\authService.ts
import { api } from './api';

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

export const authService = {
  /**
   * Login user - calls POST /auth/login
   */
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data);
    return response;
  },

  /**
   * Register user - calls POST /auth/register
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    const response = await api.post<RegisterResponse>('/auth/register', data);
    return response;
  },

  /**
   * Logout user - calls POST /auth/logout
   */
  async logout(): Promise<void> {
    await api.post('/auth/logout');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  /**
   * Get current user - calls GET /auth/me
   */
  async getCurrentUser(): Promise<User> {
    const response = await api.get<User>('/auth/me');
    return response;
  },

  /**
   * Update user role - calls PATCH /auth/users/:userId/role
   */
  async updateUserRole(userId: string, role: string): Promise<User> {
    const response = await api.patch<User>(`/auth/users/${userId}/role`, { role });
    return response;
  },

  /**
   * Update user profile - calls PUT /auth/users/:userId
   */
  async updateUser(userId: string, data: Partial<User>): Promise<User> {
    const response = await api.put<User>(`/auth/users/${userId}`, data);
    return response;
  },

  /**
   * Get all users - calls GET /auth/users (Admin only)
   */
  async getUsers(params?: { page?: number; limit?: number; search?: string }): Promise<{ users: User[]; total: number }> {
    const response = await api.get<{ users: User[]; total: number }>('/auth/users', { params });
    return response;
  },

  /**
   * Get user by ID - calls GET /auth/users/:userId
   */
  async getUserById(userId: string): Promise<User> {
    const response = await api.get<User>(`/auth/users/${userId}`);
    return response;
  },

  /**
   * Delete user - calls DELETE /auth/users/:userId (Admin only)
   */
  async deleteUser(userId: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/auth/users/${userId}`);
    return response;
  },

  /**
   * Forgot password - calls POST /auth/forgot-password
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email });
    return response;
  },

  /**
   * Reset password - calls POST /auth/reset-password
   */
  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/reset-password', { token, password });
    return response;
  },

  /**
   * Verify 2FA - calls POST /auth/verify-2fa
   */
  async verify2FA(code: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/verify-2fa', { code });
    return response;
  },

  /**
   * Setup 2FA - calls POST /auth/setup-2fa
   */
  async setup2FA(): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const response = await api.post<{ secret: string; qrCode: string; backupCodes: string[] }>('/auth/setup-2fa');
    return response;
  },

  /**
   * Verify email - calls POST /auth/verify-email
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/verify-email', { token });
    return response;
  },

  /**
   * Resend verification email - calls POST /auth/resend-verification
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/auth/resend-verification', { email });
    return response;
  },

  /**
   * Get user sessions - calls GET /auth/sessions
   */
  async getSessions(): Promise<any[]> {
    const response = await api.get<any[]>('/auth/sessions');
    return response;
  },

  /**
   * Revoke session - calls DELETE /auth/sessions/:sessionId
   */
  async revokeSession(sessionId: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
    return response;
  },

  /**
   * Get user permissions - calls GET /auth/permissions
   */
  async getPermissions(): Promise<string[]> {
    const response = await api.get<string[]>('/auth/permissions');
    return response;
  },

  /**
   * Update user permissions - calls PUT /auth/users/:userId/permissions (Admin only)
   */
  async updateUserPermissions(userId: string, permissions: string[]): Promise<User> {
    const response = await api.put<User>(`/auth/users/${userId}/permissions`, { permissions });
    return response;
  },
};
