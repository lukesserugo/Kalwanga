// packages/mobile/services/api.ts
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import type { ApiResponse } from "@pos/shared/common";

/**
 * The API returns either a success envelope or an error envelope.
 * Errors are shaped as `{ success: false, data: undefined, message }`
 * so that callers can branch on `response.success`.
 */
type ErrorResponse<T> = {
  success: false;
  data: T | undefined;
  message: string;
};
type ApiResult<T> = ApiResponse<T> | ErrorResponse<T>;

/**
 * Mobile API client.
 *
 * Token handling:
 *   Clerk owns the session token. The API service does NOT read
 *   from expo-secure-store or localStorage — that approach breaks
 *   on web (SecureStore is a native-only stub) and on native
 *   (nothing ever writes `clerk_session_token`).
 *
 *   Instead, a component inside <ClerkProvider> calls
 *   `apiService.setTokenProvider(() => getToken())` at mount time.
 *   Every request then asks Clerk for a fresh token.
 *
 *   When no provider is registered yet (login screen, before Clerk
 *   finishes hydrating), requests go out without an Authorization
 *   header. The backend returns 401 and callers handle it.
 */

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

export type TokenProvider = () => Promise<string | null>;

class ApiService {
  private api: AxiosInstance;
  private tokenProvider: TokenProvider | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30_000,
      headers: { "Content-Type": "application/json" },
    });

    this.api.interceptors.request.use(async (config) => {
      const token = await this.getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Normalize the error into the ApiError shape from the contract.
        const status = error?.response?.status ?? 500;
        const payload = error?.response?.data;
        const message =
          payload?.error?.message ||
          payload?.message ||
          error?.message ||
          "Request failed";

        return Promise.reject({
          success: false as const,
          error: { code: String(status), message },
          status,
        });
      },
    );
  }

  // ----------------------------------------------------------
  // Token plumbing — Clerk owns the session; we just ask for it.
  // ----------------------------------------------------------

  setTokenProvider(provider: TokenProvider | null) {
    this.tokenProvider = provider;
  }

  private async getToken(): Promise<string | null> {
    if (!this.tokenProvider) return null;
    try {
      return await this.tokenProvider();
    } catch (err) {
      console.error("Error getting token:", err);
      return null;
    }
  }

  // ----------------------------------------------------------
  // Error shaping
  // ----------------------------------------------------------

  private toErrorResponse<T>(err: any): ErrorResponse<T> {
    return {
      success: false,
      data: undefined,
      message: err?.error?.message || err?.message || "Request failed",
    };
  }

  // ----------------------------------------------------------
  // HTTP verbs
  // ----------------------------------------------------------

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.api.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (err: any) {
      return this.toErrorResponse<T>(err);
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.api.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (err: any) {
      return this.toErrorResponse<T>(err);
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.api.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (err: any) {
      return this.toErrorResponse<T>(err);
    }
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.api.patch<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (err: any) {
      return this.toErrorResponse<T>(err);
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.api.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (err: any) {
      return this.toErrorResponse<T>(err);
    }
  }

  // ----------------------------------------------------------
  // Backwards-compatible shims
  // ----------------------------------------------------------
  //
  // The old API had `setAuthToken` / `clearAuthToken` /
  // `isAuthenticated` methods for the SecureStore-based flow.
  // If any existing code still calls them, these no-op shims
  // keep it compiling. Delete them once you've confirmed nothing
  // references them.

  async setAuthToken(_token: string): Promise<void> {
    // No-op. Clerk manages the session token now.
  }

  async clearAuthToken(): Promise<void> {
    // No-op. Clerk manages sign-out via its own APIs.
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export const apiService = new ApiService();
export default apiService;
