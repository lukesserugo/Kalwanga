// D:\Projects\Kalwanga\packages\web\services\api.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

// ============================================
// TOKEN REFRESH STATE
// ============================================

interface TokenRefreshState {
  isRefreshing: boolean;
  attempts: number;
  maxAttempts: number;
  lastAttemptTime: number;
  cooldownPeriod: number; // milliseconds
}

const tokenState: TokenRefreshState = {
  isRefreshing: false,
  attempts: 0,
  maxAttempts: 3,
  lastAttemptTime: 0,
  cooldownPeriod: 30000, // 30 seconds cooldown after max attempts
};

// ============================================
// API SERVICE
// ============================================

class ApiService {
  private client: AxiosInstance;
  private static instance: ApiService;
  private getClerkToken: (() => Promise<string | null>) | null = null;
  private tokenRefreshPromise: Promise<string | null> | null = null;
  private isRefreshing: boolean = false;

  private constructor() {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    console.log('🔗 API Base URL:', baseURL);
    
    this.client = axios.create({
      baseURL: baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: true,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      async (config) => {
        // Skip auth for webhook endpoints
        if (config.url?.includes('/webhook')) {
          return config;
        }
        
        const authHeaders = await this.getAuthHeaders();
        if (authHeaders.Authorization) {
          config.headers.Authorization = authHeaders.Authorization;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this)
    );
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  public setClerkTokenGetter(getter: () => Promise<string | null>) {
    this.getClerkToken = getter;
  }

  // ============================================
  // TOKEN MANAGEMENT
  // ============================================

  /**
   * Reset token refresh state (call on successful token refresh or login)
   */
  public resetTokenState(): void {
    tokenState.attempts = 0;
    tokenState.isRefreshing = false;
    tokenState.lastAttemptTime = 0;
    this.isRefreshing = false;
    this.tokenRefreshPromise = null;
    console.log('🔄 Token state reset');
  }

  /**
   * Check if we should attempt token refresh based on rate limiting
   */
  private shouldAttemptTokenRefresh(): boolean {
    const now = Date.now();
    
    // If we've exceeded max attempts, check cooldown
    if (tokenState.attempts >= tokenState.maxAttempts) {
      const timeSinceLastAttempt = now - tokenState.lastAttemptTime;
      if (timeSinceLastAttempt < tokenState.cooldownPeriod) {
        console.log(`⏳ Token refresh on cooldown (${Math.round((tokenState.cooldownPeriod - timeSinceLastAttempt) / 1000)}s remaining)`);
        return false;
      }
      // Reset attempts after cooldown
      tokenState.attempts = 0;
      console.log('🔄 Token refresh cooldown expired, resetting attempts');
    }
    
    return true;
  }

  /**
   * Get auth token with retry and rate limiting
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    
    if (!this.getClerkToken) {
      // Fallback to localStorage token
      const backendToken = localStorage.getItem('auth_token');
      if (backendToken) {
        headers.Authorization = `Bearer ${backendToken}`;
        console.log('⚠️ Using backend token (fallback)');
      } else {
        console.log('❌ NO TOKEN AVAILABLE - No token getter set');
      }
      return headers;
    }

    try {
      // Check if we should attempt token retrieval
      if (!this.shouldAttemptTokenRefresh()) {
        // Try localStorage as fallback during cooldown
        const backendToken = localStorage.getItem('auth_token');
        if (backendToken) {
          headers.Authorization = `Bearer ${backendToken}`;
          console.log('⚠️ Using backend token during cooldown');
          return headers;
        }
        return headers;
      }

      // Use promise chain to prevent concurrent token refreshes
      if (this.isRefreshing && this.tokenRefreshPromise) {
        console.log('⏳ Waiting for existing token refresh...');
        const token = await this.tokenRefreshPromise;
        if (token) {
          headers.Authorization = `Bearer ${token}`;
          console.log('✅ Using token from existing refresh');
          return headers;
        }
        return headers;
      }

      // Start new token refresh
      this.isRefreshing = true;
      this.tokenRefreshPromise = this.getTokenWithRetry();

      const token = await this.tokenRefreshPromise;
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
        console.log('✅ Using Clerk token');
        // Reset attempts on success
        tokenState.attempts = 0;
        tokenState.isRefreshing = false;
        tokenState.lastAttemptTime = Date.now();
      } else {
        // Try localStorage as fallback
        const backendToken = localStorage.getItem('auth_token');
        if (backendToken) {
          headers.Authorization = `Bearer ${backendToken}`;
          console.log('⚠️ Using backend token (fallback after token failure)');
        } else {
          console.log('❌ NO TOKEN AVAILABLE');
        }
      }
    } catch (error) {
      console.error('❌ Failed to get Clerk token:', error);
      tokenState.isRefreshing = false;
      tokenState.lastAttemptTime = Date.now();
      
      // Try localStorage as fallback
      const backendToken = localStorage.getItem('auth_token');
      if (backendToken) {
        headers.Authorization = `Bearer ${backendToken}`;
        console.log('⚠️ Using backend token (fallback after error)');
      }
    } finally {
      this.isRefreshing = false;
      this.tokenRefreshPromise = null;
    }
    
    return headers;
  }

  /**
   * Get token with retry logic
   */
  private async getTokenWithRetry(): Promise<string | null> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ Retry ${attempt}/${maxRetries} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        tokenState.attempts++;
        tokenState.lastAttemptTime = Date.now();
        
        console.log(`🔑 Getting Clerk token (attempt ${tokenState.attempts}/${tokenState.maxAttempts})...`);
        const token = await this.getClerkToken!();
        
        if (token) {
          console.log('✅ Clerk token retrieved successfully');
          return token;
        }
        
        console.warn('⚠️ Clerk token getter returned null/empty');
        lastError = new Error('Token getter returned null');
      } catch (error: any) {
        console.error(`❌ Token attempt ${attempt + 1} failed:`, error.message || error);
        lastError = error;
        
        // If it's a network error, we might want to retry
        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network error')) {
          console.warn('🌐 Network error, will retry...');
          continue;
        }
        
        // If it's a Clerk-specific error, check if it's recoverable
        if (error.message?.includes('Token refresh failed')) {
          console.warn('🔄 Token refresh failed, will retry...');
          continue;
        }
        
        // For other errors, don't retry
        break;
      }
    }

    console.error('❌ All token retrieval attempts failed');
    if (lastError) {
      console.error('Last error:', lastError);
    }
    return null;
  }

  // ============================================
  // RESPONSE HANDLING
  // ============================================

  private handleResponse(response: AxiosResponse): AxiosResponse {
    console.log(`📥 ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`);
    return response;
  }

  private handleResponseError(error: any): Promise<any> {
    if (error.response) {
      console.error(`❌ API Error ${error.response.status}:`, error.response.data);
      console.error('📋 Error details:', {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data,
        baseURL: error.config?.baseURL,
        fullUrl: `${error.config?.baseURL}${error.config?.url}`,
        responseData: error.response?.data,
        requestHeaders: error.config?.headers,
        responseHeaders: error.response?.headers,
      });

      // Log validation errors in detail
      if (error.response?.status === 400) {
        const responseData = error.response?.data;
        console.error('📋 400 Bad Request - Validation Error Details:');
        
        if (responseData?.errors && Array.isArray(responseData.errors)) {
          console.error('   Validation Errors:');
          responseData.errors.forEach((err: any) => {
            console.error(`     - ${err.field}: ${err.message} (${err.code})`);
          });
        } else if (responseData?.message) {
          console.error(`   Message: ${responseData.message}`);
        } else if (responseData?.error) {
          console.error(`   Error: ${responseData.error}`);
        } else {
          console.error('   Response data:', JSON.stringify(responseData, null, 2));
        }
      }

      // Handle 404 for payment-providers specifically - don't show as error
      if (error.response?.status === 404 && error.config?.url?.includes('/payment-providers')) {
        console.warn('⚠️ Payment providers endpoint not found (may not be configured yet)');
        // Return a fallback empty response instead of rejecting
        return Promise.resolve({
          data: {
            success: true,
            data: [],
            message: 'Payment providers not configured yet',
          },
        });
      }

      if (error.response?.status === 401) {
        console.error('❌ 401 Unauthorized - Token invalid or expired');
        if (!error.config?.url?.includes('/auth/')) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          this.resetTokenState();
        }
      }
    } else if (error.code === 'ERR_NETWORK') {
      console.error('❌ NETWORK ERROR - Cannot reach backend');
      console.error('   Expected URL:', process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      console.error('   Check if backend is running on port 3001');
    }
    
    return Promise.reject(error);
  }

  /**
   * Helper method to extract data from API response
   * The backend returns { success: true, data: ..., message: "..." }
   * This method extracts just the data part
   */
  private extractData<T>(responseData: any): T {
    // If response has success and data properties, return data
    if (responseData && typeof responseData === 'object' && 'success' in responseData && 'data' in responseData) {
      console.log('✅ Extracted data from response wrapper');
      return responseData.data as T;
    }
    
    // If response has data property (pagination style), return data
    if (responseData && typeof responseData === 'object' && 'data' in responseData && !('success' in responseData)) {
      return responseData.data as T;
    }
    
    // Otherwise return the response as-is
    return responseData as T;
  }

  // ============================================
  // HTTP METHODS - Using axios consistently
  // ============================================

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const fullUrl = `${this.client.defaults.baseURL}${url}`;
      console.log(`📤 GET ${fullUrl}`);
      
      const response: AxiosResponse<any> = await this.client.get(url, {
        ...config,
      });
      
      console.log(`📥 GET ${url} - Status: ${response.status}`);
      console.log('📥 GET response data:', response.data);
      
      return this.extractData<T>(response.data);
    } catch (error) {
      console.error(`GET ${url} failed:`, error);
      throw error;
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const fullUrl = `${this.client.defaults.baseURL}${url}`;
      console.log(`📤 POST ${fullUrl}`);
      
      // Log the data (redact sensitive info, truncate large fields)
      if (data && typeof data === 'object') {
        const logData = { ...data };
        if (logData.password) logData.password = '***';
        if (logData.token) logData.token = '***';
        if (logData.apiKey) logData.apiKey = '***';
        if (logData.secretKey) logData.secretKey = '***';
        // Truncate large fields for logging
        if (logData.images && Array.isArray(logData.images)) {
          logData.images = logData.images.map((img: string, index: number) => {
            if (img && img.length > 200) {
              return `[Image ${index + 1}: ${Math.round(img.length / 1024)}KB]`;
            }
            return img;
          });
        }
        console.log('📦 Payload:', JSON.stringify(logData, null, 2));
      }
      
      const response = await this.client.post(url, data, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...config?.headers,
        },
        maxBodyLength: 10 * 1024 * 1024, // 10MB
        maxContentLength: 10 * 1024 * 1024,
      });
      
      console.log(`📥 POST ${url} - Status: ${response.status}`);
      console.log('📥 POST response:', response.data);
      
      return this.extractData<T>(response.data);
    } catch (error: any) {
      console.error(`❌ POST ${url} failed:`, error);
      
      if (error?.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Request URL:', error.config?.url);
        
        // Show validation errors clearly
        if (error.response.status === 400 && error.response.data?.errors) {
          console.error('📋 Validation Errors:');
          error.response.data.errors.forEach((err: any) => {
            console.error(`   - ${err.field}: ${err.message}`);
          });
        }
      }
      
      throw error;
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const fullUrl = `${this.client.defaults.baseURL}${url}`;
      console.log(`📤 PUT ${fullUrl}`);
      
      const response = await this.client.put(url, data, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...config?.headers,
        },
      });
      
      console.log(`📥 PUT ${url} - Status: ${response.status}`);
      console.log('📥 PUT response:', response.data);
      
      return this.extractData<T>(response.data);
    } catch (error: any) {
      console.error(`❌ PUT ${url} failed:`, error);
      
      if (error?.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Request URL:', error.config?.url);
      }
      
      throw error;
    }
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const fullUrl = `${this.client.defaults.baseURL}${url}`;
      console.log(`📤 PATCH ${fullUrl}`);
      
      const response = await this.client.patch(url, data, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...config?.headers,
        },
      });
      
      console.log(`📥 PATCH ${url} - Status: ${response.status}`);
      console.log('📥 PATCH response:', response.data);
      
      return this.extractData<T>(response.data);
    } catch (error: any) {
      console.error(`❌ PATCH ${url} failed:`, error);
      
      if (error?.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Request URL:', error.config?.url);
      }
      
      throw error;
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const fullUrl = `${this.client.defaults.baseURL}${url}`;
      console.log(`📤 DELETE ${fullUrl}`);
      
      const response: AxiosResponse<any> = await this.client.delete(url, {
        ...config,
      });
      
      console.log(`📥 DELETE ${url} - Status: ${response.status}`);
      console.log('📥 DELETE response data:', response.data);
      
      return this.extractData<T>(response.data);
    } catch (error: any) {
      console.error(`❌ DELETE ${url} failed:`, error);
      
      if (error?.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Request URL:', error.config?.url);
      }
      
      throw error;
    }
  }

  // ============================================
  // UPLOAD / DOWNLOAD
  // ============================================

  async upload<T>(url: string, file: File, fieldName: string = 'file', additionalData?: Record<string, any>): Promise<T> {
    const formData = new FormData();
    formData.append(fieldName, file);
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }
    
    const response = await this.client.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      maxBodyLength: 10 * 1024 * 1024,
      maxContentLength: 10 * 1024 * 1024,
    });
    
    return this.extractData<T>(response.data);
  }

  async download(url: string, config?: AxiosRequestConfig): Promise<Blob> {
    const response: AxiosResponse<Blob> = await this.client.get(url, {
      ...config,
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadFile(url: string, filename: string, config?: AxiosRequestConfig): Promise<void> {
    const blob = await this.download(url, config);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  /**
   * Get the underlying axios client for custom requests
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Set the base URL dynamically
   */
  setBaseURL(baseURL: string): void {
    this.client.defaults.baseURL = baseURL;
    console.log('🔗 API Base URL updated to:', baseURL);
  }

  /**
   * Add a request interceptor
   */
  addRequestInterceptor(onFulfilled: (config: any) => any, onRejected?: (error: any) => any): number {
    return this.client.interceptors.request.use(onFulfilled, onRejected);
  }

  /**
   * Add a response interceptor
   */
  addResponseInterceptor(onFulfilled: (response: any) => any, onRejected?: (error: any) => any): number {
    return this.client.interceptors.response.use(onFulfilled, onRejected);
  }

  /**
   * Remove an interceptor
   */
  removeInterceptor(interceptorId: number): void {
    this.client.interceptors.request.eject(interceptorId);
  }

  /**
   * Remove a response interceptor
   */
  removeResponseInterceptor(interceptorId: number): void {
    this.client.interceptors.response.eject(interceptorId);
  }
}

export const api = ApiService.getInstance();
export const apiService = api;
