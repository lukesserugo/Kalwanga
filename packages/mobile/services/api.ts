// packages/mobile/services/api.ts
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
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
 * NOTE on typing:
 *   `ApiResponse<T>` from @pos/shared is `{ success, data, message?, timestamp? }`.
 *   Errors are surfaced as `{ success: false, error: { code, message } }`
 *   (see @pos/shared/common/response Ã¢â‚¬â€ ApiErrorSchema).
 *
 *   We do NOT put an HTTP `status` field on responses; it lives on the
 *   thrown/rejected value and is exposed via `ApiError.status`.
 */

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api";

const TOKEN_KEY = "clerk_session_token";

class ApiService {
  private api: AxiosInstance;

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
          status, // kept on the rejected value only, not on ApiResponse
        });
      },
    );
  }

  private async getToken(): Promise<string | null> {
    try {
      let token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token && Platform.OS === "web") {
        token = localStorage.getItem(TOKEN_KEY);
      }
      return token;
    } catch (err) {
      console.error("Error getting token:", err);
      return null;
    }
  }

  private async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      if (Platform.OS === "web") {
        localStorage.setItem(TOKEN_KEY, token);
      }
    } catch (err) {
      console.error("Error setting token:", err);
    }
  }

  private async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      if (Platform.OS === "web") {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (err) {
      console.error("Error removing token:", err);
    }
  }

  private toErrorResponse<T>(err: any): ErrorResponse<T> {
    return {
      success: false,
      data: undefined,
      message: err?.error?.message || err?.message || "Request failed",
    };
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResult<T>> {
    try {
      const response = await this.api.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (err: any) {
      if (err?.success === false) return this.toErrorResponse<T>(err);
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

  async setAuthToken(token: string): Promise<void> {
    await this.setToken(token);
  }

  async clearAuthToken(): Promise<void> {
    await this.removeToken();
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}

export const apiService = new ApiService();
export default apiService;