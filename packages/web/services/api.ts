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
  cooldownPeriod: number;
}

const tokenState: TokenRefreshState = {
  isRefreshing: false,
  attempts: 0,
  maxAttempts: 3,
  lastAttemptTime: 0,
  cooldownPeriod: 30000,
};

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================

/**
 * ✅ NEW: Resolve the active business unit ID from localStorage.
 * Checked in this order:
 *   1. businessUnitId key
 *   2. user.businessUnitId
 *   3. user.businessUnits[0].businessUnitId
 * Returns null if nothing is found (caller decides whether to send the header).
 */
function resolveBusinessUnitId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const direct = localStorage.getItem('businessUnitId');
    if (direct && direct !== 'undefined' && direct !== 'null' && direct !== 'default') {
      return direct;
    }
  } catch (_e) {
    /* ignore */
  }

  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user?.businessUnitId && user.businessUnitId !== 'default') {
        return user.businessUnitId;
      }
      if (
        user?.businessUnits?.[0]?.businessUnitId &&
        user.businessUnits[0].businessUnitId !== 'default'
      ) {
        return user.businessUnits[0].businessUnitId;
      }
    }
  } catch (_e) {
    /* ignore */
  }

  return null;
}

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

    // ============================================
    // REQUEST INTERCEPTOR
    // Adds Authorization + X-Business-Unit-Id on every request
    // ============================================
    this.client.interceptors.request.use(
      async (config) => {
        // Skip auth for webhook endpoints
        if (config.url?.includes('/webhook')) {
          return config;
        }

        // ✅ Attach Authorization
        const authHeaders = await this.getAuthHeaders();
        if (authHeaders.Authorization) {
          config.headers.Authorization = authHeaders.Authorization;
        }

        // ✅ FIXED: attach business unit ID header if available.
        // The backend controller reads req.headers['x-business-unit-id']
        // as an explicit override. Never send 'default' — that would
        // confuse the resolver.
        const businessUnitId = resolveBusinessUnitId();
        if (businessUnitId) {
          config.headers['x-business-unit-id'] = businessUnitId;
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

  public resetTokenState(): void {
    tokenState.attempts = 0;
    tokenState.isRefreshing = false;
    tokenState.lastAttemptTime = 0;
    this.isRefreshing = false;
    this.tokenRefreshPromise = null;
    console.log('🔄 Token state reset');
  }

  private shouldAttemptTokenRefresh(): boolean {
    const now = Date.now();

    if (tokenState.attempts >= tokenState.maxAttempts) {
      const timeSinceLastAttempt = now - tokenState.lastAttemptTime;
      if (timeSinceLastAttempt < tokenState.cooldownPeriod) {
        console.log(
          `⏳ Token refresh on cooldown (${Math.round(
            (tokenState.cooldownPeriod - timeSinceLastAttempt) / 1000
          )}s remaining)`
        );
        return false;
      }
      tokenState.attempts = 0;
      console.log('🔄 Token refresh cooldown expired, resetting attempts');
    }

    return true;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (!this.getClerkToken) {
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
      if (!this.shouldAttemptTokenRefresh()) {
        const backendToken = localStorage.getItem('auth_token');
        if (backendToken) {
          headers.Authorization = `Bearer ${backendToken}`;
          console.log('⚠️ Using backend token during cooldown');
          return headers;
        }
        return headers;
      }

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

      this.isRefreshing = true;
      this.tokenRefreshPromise = this.getTokenWithRetry();

      const token = await this.tokenRefreshPromise;

      if (token) {
        headers.Authorization = `Bearer ${token}`;
        console.log('✅ Using Clerk token');
        tokenState.attempts = 0;
        tokenState.isRefreshing = false;
        tokenState.lastAttemptTime = Date.now();
      } else {
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

  private async getTokenWithRetry(): Promise<string | null> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ Retry ${attempt}/${maxRetries} after ${delay}ms delay...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        tokenState.attempts++;
        tokenState.lastAttemptTime = Date.now();

        console.log(
          `🔑 Getting Clerk token (attempt ${tokenState.attempts}/${tokenState.maxAttempts})...`
        );
        const token = await this.getClerkToken!();

        if (token) {
          console.log('✅ Clerk token retrieved successfully');
          return token;
        }

        console.warn('⚠️ Clerk token getter returned null/empty');
        lastError = new Error('Token getter returned null');
      } catch (error: any) {
        console.error(
          `❌ Token attempt ${attempt + 1} failed:`,
          error.message || error
        );
        lastError = error;

        if (
          error.code === 'ERR_NETWORK' ||
          error.message?.includes('Network error')
        ) {
          console.warn('🌐 Network error, will retry...');
          continue;
        }

        if (error.message?.includes('Token refresh failed')) {
          console.warn('🔄 Token refresh failed, will retry...');
          continue;
        }

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
    console.log(
      `📥 ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`
    );
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

      // ✅ FIXED: Never fabricate a "success" response for 404s.
      // Just log a warning and let the caller decide how to handle it.
      if (
        error.response?.status === 404 &&
        error.config?.url?.includes('/payment-providers')
      ) {
        console.warn(
          '⚠️ Payment providers endpoint not found (may not be configured yet)'
        );
      }

      if (error.response?.status === 401) {
        console.error('❌ 401 Unauthorized - Token invalid or expired');
        if (!error.config?.url?.includes('/auth/')) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          // ✅ FIXED: also clear businessUnitId so a re-login sets it fresh
          localStorage.removeItem('businessUnitId');
          this.resetTokenState();
        }
      }
    } else if (error.code === 'ERR_NETWORK') {
      console.error('❌ NETWORK ERROR - Cannot reach backend');
      console.error(
        '   Expected URL:',
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      );
      console.error('   Check if backend is running on port 3001');
    }

    return Promise.reject(error);
  }

  /**
   * Extract data from the standard `{ success, data, ... }` envelope.
   *
   * Preserves sibling fields (`pagination`, `stats`, `scope`) by
   * attaching them to the returned value as non-enumerable properties.
   * This means:
   *   - `extractData<Register[]>(resp)` returns the array (as before)
   *   - `extractData<any>(resp)` still exposes `.pagination` and `.stats`
   *     when the caller reads them (like productService.getAllProducts does)
   */
  private extractData<T>(responseData: any): T {
    if (
      responseData &&
      typeof responseData === 'object' &&
      'success' in responseData &&
      'data' in responseData
    ) {
      const data = responseData.data;

      // ✅ Preserve sibling metadata so callers like
      //    `productService.getAllProducts` can read `response.pagination`
      //    even after the unwrap.
      if (data !== null && typeof data === 'object') {
        if ('pagination' in responseData && !('pagination' in data)) {
          Object.defineProperty(data, 'pagination', {
            value: responseData.pagination,
            enumerable: false,
            configurable: true,
            writable: true,
          });
        }
        if ('stats' in responseData && !('stats' in data)) {
          Object.defineProperty(data, 'stats', {
            value: responseData.stats,
            enumerable: false,
            configurable: true,
            writable: true,
          });
        }
        if ('scope' in responseData && !('scope' in data)) {
          Object.defineProperty(data, 'scope', {
            value: responseData.scope,
            enumerable: false,
            configurable: true,
            writable: true,
          });
        }
      }

      console.log('✅ Extracted data from response wrapper');
      return data as T;
    }

    if (
      responseData &&
      typeof responseData === 'object' &&
      'data' in responseData &&
      !('success' in responseData)
    ) {
      return responseData.data as T;
    }

    return responseData as T;
  }

  // ============================================
  // HTTP METHODS
  // ============================================

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<any> = await this.client.get(url, {
        ...config,
      });

      return this.extractData<T>(response.data);
    } catch (error) {
      console.error(`GET ${url} failed:`, error);
      throw error;
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      if (data && typeof data === 'object' && !(data instanceof FormData)) {
        const logData = { ...data };
        if (logData.password) logData.password = '***';
        if (logData.token) logData.token = '***';
        if (logData.apiKey) logData.apiKey = '***';
        if (logData.secretKey) logData.secretKey = '***';
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
        maxBodyLength: 10 * 1024 * 1024,
        maxContentLength: 10 * 1024 * 1024,
      });

      return this.extractData<T>(response.data);
    } catch (error: any) {
      console.error(`❌ POST ${url} failed:`, error);

      if (error?.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        console.error('Request URL:', error.config?.url);

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
      const response = await this.client.put(url, data, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...config?.headers,
        },
      });

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
      const response = await this.client.patch(url, data, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...config?.headers,
        },
      });

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
      const response: AxiosResponse<any> = await this.client.delete(url, {
        ...config,
      });

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

  /**
   * ✅ FIXED: Accepts either a `File` (with optional `additionalData`)
   * OR a pre-built `FormData` — because `productService.importProducts`
   * passes a FormData directly.
   */
  async upload<T>(
    url: string,
    fileOrFormData: File | FormData,
    fieldName: string = 'file',
    additionalData?: Record<string, any>
  ): Promise<T> {
    let formData: FormData;

    if (fileOrFormData instanceof FormData) {
      formData = fileOrFormData;
    } else {
      formData = new FormData();
      formData.append(fieldName, fileOrFormData);
      if (additionalData) {
        Object.entries(additionalData).forEach(([key, value]) => {
          formData.append(key, String(value));
        });
      }
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

  async downloadFile(
    url: string,
    filename: string,
    config?: AxiosRequestConfig
  ): Promise<void> {
    const blob = await this.download(url, config);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  getClient(): AxiosInstance {
    return this.client;
  }

  setBaseURL(baseURL: string): void {
    this.client.defaults.baseURL = baseURL;
    console.log('🔗 API Base URL updated to:', baseURL);
  }

  addRequestInterceptor(
    onFulfilled: (config: any) => any,
    onRejected?: (error: any) => any
  ): number {
    return this.client.interceptors.request.use(onFulfilled, onRejected);
  }

  addResponseInterceptor(
    onFulfilled: (response: any) => any,
    onRejected?: (error: any) => any
  ): number {
    return this.client.interceptors.response.use(onFulfilled, onRejected);
  }

  removeInterceptor(interceptorId: number): void {
    this.client.interceptors.request.eject(interceptorId);
  }

  removeResponseInterceptor(interceptorId: number): void {
    this.client.interceptors.response.eject(interceptorId);
  }
}

export const api = ApiService.getInstance();
export const apiService = api;
