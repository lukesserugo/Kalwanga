import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { getApiUrl } from "../utils/helpers";
import { ApiResponse } from "@pos/shared/types";

// Define error response type
interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
  timestamp?: string;
  path?: string;
}

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: getApiUrl(),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 30000,
    });

    // Request interceptor - add token
    this.api.interceptors.request.use(
      async (config) => {
        try {
          // Try to get token from SecureStore
          let token = await SecureStore.getItemAsync("clerk_session_token");
          
          // If no token in SecureStore, try localStorage for web
          if (!token && Platform.OS === 'web') {
            token = localStorage.getItem("clerk_session_token");
          }
          
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error("Error getting token:", error);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle errors
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Handle network errors
        if (!error.response) {
          console.error("Network error:", error.message);
          return Promise.reject({
            success: false,
            error: "Network error. Please check your connection.",
            message: error.message,
          });
        }

        // Handle unauthorized
        if (error.response.status === 401) {
          console.log("Unauthorized, clearing session...");
          await SecureStore.deleteItemAsync("clerk_session_token");
          if (Platform.OS === 'web') {
            localStorage.removeItem("clerk_session_token");
          }
          // Redirect to login if needed
          // You can emit an event or use a navigation ref here
        }

        // Handle rate limiting
        if (error.response.status === 429) {
          console.error("Rate limit exceeded");
          return Promise.reject({
            success: false,
            error: "Too many requests. Please try again later.",
            status: 429,
          });
        }

        // Handle server errors
        if (error.response.status >= 500) {
          console.error("Server error:", error.response.data);
          return Promise.reject({
            success: false,
            error: "Server error. Please try again later.",
            status: error.response.status,
          });
        }

        // Return the error response
        return Promise.reject({
          success: false,
          ...error.response.data,
          status: error.response.status,
        });
      }
    );
  }

  private async getToken(): Promise<string | null> {
    try {
      let token = await SecureStore.getItemAsync("clerk_session_token");
      if (!token && Platform.OS === 'web') {
        token = localStorage.getItem("clerk_session_token");
      }
      return token;
    } catch (error) {
      console.error("Error getting token:", error);
      return null;
    }
  }

  private async setToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync("clerk_session_token", token);
      if (Platform.OS === 'web') {
        localStorage.setItem("clerk_session_token", token);
      }
    } catch (error) {
      console.error("Error setting token:", error);
    }
  }

  private async removeToken(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync("clerk_session_token");
      if (Platform.OS === 'web') {
        localStorage.removeItem("clerk_session_token");
      }
    } catch (error) {
      console.error("Error removing token:", error);
    }
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error: any) {
      // If the error is already formatted, return it
      if (error.success === false) {
        return error;
      }
      // Otherwise, format it
      return {
        success: false,
        error: error.message || "Failed to fetch data",
        status: error.response?.status || 500,
      };
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error: any) {
      if (error.success === false) {
        return error;
      }
      return {
        success: false,
        error: error.message || "Failed to post data",
        status: error.response?.status || 500,
      };
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error: any) {
      if (error.success === false) {
        return error;
      }
      return {
        success: false,
        error: error.message || "Failed to update data",
        status: error.response?.status || 500,
      };
    }
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.patch<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error: any) {
      if (error.success === false) {
        return error;
      }
      return {
        success: false,
        error: error.message || "Failed to patch data",
        status: error.response?.status || 500,
      };
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error: any) {
      if (error.success === false) {
        return error;
      }
      return {
        success: false,
        error: error.message || "Failed to delete data",
        status: error.response?.status || 500,
      };
    }
  }

  // Helper methods
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

  // Upload file with progress
  async upload<T>(
    url: string,
    formData: FormData,
    onProgress?: (progress: number) => void
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.post<ApiResponse<T>>(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            onProgress(Math.round(progress));
          }
        },
      });
      return response.data;
    } catch (error: any) {
      if (error.success === false) {
        return error;
      }
      return {
        success: false,
        error: error.message || "Failed to upload file",
        status: error.response?.status || 500,
      };
    }
  }

  // Download file
  async download(url: string, config?: AxiosRequestConfig): Promise<Blob> {
    const response = await this.api.get(url, {
      ...config,
      responseType: 'blob',
    });
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;
