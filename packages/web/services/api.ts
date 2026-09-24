// D:\Projects\Kalwanga\packages\web\services\api.ts

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

interface SilentableRequestConfig extends AxiosRequestConfig {
  silent?: boolean;
}

const PAGINATION_KEY = Symbol.for('api.pagination');
const STATS_KEY = Symbol.for('api.stats');
const SCOPE_KEY = Symbol.for('api.scope');

/**
 * Attach a sibling field to the extracted `data` without clobbering
 * anything the data already owns.
 *
 * - Arrays: assign directly (they don't have these keys) — this makes
 *   the field visible to `Object.keys` and `JSON.stringify`, which is
 *   what most consumers want.
 * - Objects: same — unless the key already exists, in which case we
 *   fall back to a Symbol so nothing is lost.
 *
 * Either way, also attach the Symbol-keyed copy so a caller that
 * prefers symbol access can use `data[PAGINATION_KEY]`.
 */
function attachSibling<T extends object>(
  target: T,
  key: 'pagination' | 'stats' | 'scope',
  value: unknown,
): void {
  if (!target || typeof target !== 'object') return;
  if (value === undefined || value === null) return;

  // Symbol copy — always set, never overwrites anything.
  const symbol =
    key === 'pagination'
      ? PAGINATION_KEY
      : key === 'stats'
      ? STATS_KEY
      : SCOPE_KEY;

  try {
    Object.defineProperty(target, symbol, {
      value,
      enumerable: false,
      configurable: true,
      writable: true,
    });
  } catch {
    /* ignore */
  }

  // Direct copy — only when the key isn't already present.
  if (!(key in target)) {
    try {
      Object.defineProperty(target, key, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    } catch {
      /* ignore */
    }
  }
}

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
// ONBOARDING MUTATION EVENT
// ============================================

const ONBOARDING_MUTATED_EVENT = 'onboarding:mutated';

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================

function resolveBusinessUnitId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const direct = localStorage.getItem('businessUnitId');
    if (
      direct &&
      direct !== 'undefined' &&
      direct !== 'null' &&
      direct !== 'default'
    ) {
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
    const baseURL =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    console.log('🔗 API Base URL:', baseURL);

    this.client = axios.create({
      baseURL: baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      withCredentials: true,
    });

    // ============================================
    // REQUEST INTERCEPTOR
    // ============================================

    this.client.interceptors.request.use(
      async (config) => {
        if (config.url?.includes('/webhook')) {
          return config;
        }

        const authHeaders = await this.getAuthHeaders();
        if (authHeaders.Authorization) {
          config.headers.Authorization = authHeaders.Authorization;
        }

        const businessUnitId = resolveBusinessUnitId();
        if (businessUnitId) {
          config.headers['x-business-unit-id'] = businessUnitId;
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.client.interceptors.response.use(
      this.handleResponse.bind(this),
      this.handleResponseError.bind(this),
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
            (tokenState.cooldownPeriod - timeSinceLastAttempt) / 1000,
          )}s remaining)`,
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
          console.log(
            `⏳ Retry ${attempt}/${maxRetries} after ${delay}ms delay...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        tokenState.attempts++;
        tokenState.lastAttemptTime = Date.now();

        console.log(
          `🔑 Getting Clerk token (attempt ${tokenState.attempts}/${tokenState.maxAttempts})...`,
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
          error.message || error,
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
    const silent = (response.config as SilentableRequestConfig | undefined)
      ?.silent;
    if (!silent) {
      console.log(
        `📥 ${response.config.method?.toUpperCase()} ${response.config.url} - Status: ${response.status}`,
      );
    }

    this.notifyMutationIfApplicable(response);

    return response;
  }

  private notifyMutationIfApplicable(response: AxiosResponse): void {
    if (typeof window === 'undefined') return;

    const method = response.config?.method?.toLowerCase();
    if (!method) return;
    if (!['post', 'put', 'patch', 'delete'].includes(method)) return;
    if (response.status < 200 || response.status >= 300) return;

    const url = response.config?.url ?? '';
    if (
      url.includes('/auth/') ||
      url.includes('/sign-in') ||
      url.includes('/sign-up') ||
      url.includes('/webhook')
    ) {
      return;
    }

    try {
      window.dispatchEvent(new Event(ONBOARDING_MUTATED_EVENT));
    } catch {
      /* ignore */
    }
  }

  private async handleResponseError(error: any): Promise<any> {
    const config = error.config as
      | (SilentableRequestConfig & { _retry?: boolean })
      | undefined;
    const silent = config?.silent === true;

    // ── 401 refresh-and-retry ────────────────────────────────
    //
    // On the first 401 for a non-auth URL, attempt one token
    // refresh and re-issue the original request. This is critical
    // for POS and scanner flows: a single stale token must not
    // drop a live cart. Only if the retry also 401s do we wipe
    // the session.
    if (
      error.response?.status === 401 &&
      !config?._retry &&
      !config?.url?.includes('/auth/')
    ) {
      if (!silent) {
        console.warn(
          '⚠️ 401 — attempting one refresh-and-retry before logout',
        );
      }

      // Reset the token cooldown so getAuthHeaders actually
      // attempts a fresh Clerk token instead of falling back to
      // the stale backend token.
      this.resetTokenState();

      const original = config ?? {};
      (original as any)._retry = true;

      const freshHeaders = await this.getAuthHeaders();

      // If we got nothing fresh, we can't retry meaningfully —
      // fall through to the destructive path below.
      if (!freshHeaders.Authorization) {
        if (!silent) {
          console.error(
            '❌ No fresh token available — clearing session',
          );
        }
        this.clearAuthState();
        return Promise.reject(error);
      }

      try {
        const retryConfig: AxiosRequestConfig = {
          ...original,
          headers: {
            ...(original.headers ?? {}),
            Authorization: freshHeaders.Authorization,
          },
        };

        const retried = await this.client.request(retryConfig);

        if (!silent) {
          console.log(
            `✅ Retry after 401 succeeded: ${retried.config.method?.toUpperCase()} ${retried.config.url}`,
          );
        }

        return retried;
      } catch (retryError: any) {
        if (!silent) {
          console.error(
            '❌ Retry after 401 also failed — clearing session',
          );
        }
        if (retryError?.response?.status === 401) {
          this.clearAuthState();
        }
        return Promise.reject(retryError);
      }
    }

    if (silent) {
      if (error.response?.status === 401) {
        if (!error.config?.url?.includes('/auth/')) {
          this.clearAuthState();
        }
      }
      return Promise.reject(error);
    }

    if (error.response) {
      console.error(
        `❌ API Error ${error.response.status}:`,
        error.response.data,
      );
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
            console.error(
              `     - ${err.field}: ${err.message} (${err.code})`,
            );
          });
        } else if (responseData?.message) {
          console.error(`   Message: ${responseData.message}`);
        } else if (responseData?.error) {
          console.error(`   Error: ${responseData.error}`);
        } else {
          console.error(
            '   Response data:',
            JSON.stringify(responseData, null, 2),
          );
        }
      }

      if (
        error.response?.status === 404 &&
        error.config?.url?.includes('/payment-providers')
      ) {
        console.warn(
          '⚠️ Payment providers endpoint not found (may not be configured yet)',
        );
      }

      if (error.response?.status === 401) {
        console.error(
          '❌ 401 Unauthorized — retry already exhausted',
        );
        this.clearAuthState();
      }
    } else if (error.code === 'ERR_NETWORK') {
      console.error('❌ NETWORK ERROR - Cannot reach backend');
      console.error(
        '   Expected URL:',
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      );
      console.error('   Check if backend is running on port 3001');
    }

    return Promise.reject(error);
  }

  /**
   * Single place that clears persisted auth state. Called only when
   * a 401 has survived the refresh-and-retry, or when no fresh token
   * could be obtained.
   */
  private clearAuthState(): void {
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('businessUnitId');
    } catch {
      /* ignore */
    }
    this.resetTokenState();
  }

  /**
   * Extract data from the standard `{ success, data, ... }` envelope.
   *
   * Sibling fields (`pagination`, `stats`, `scope`) are attached to the
   * returned value so callers can read them. For arrays, the fields are
   * attached as **enumerable** properties so `Object.keys`,
   * `JSON.stringify`, and spread work as expected. A Symbol-keyed copy
   * is always attached for callers that prefer symbol access.
   */
  private extractData<T>(responseData: any, silent = false): T {
    if (
      responseData &&
      typeof responseData === 'object' &&
      'success' in responseData &&
      'data' in responseData
    ) {
      const data = responseData.data;

      if (data !== null && typeof data === 'object') {
        if ('pagination' in responseData) {
          attachSibling(data, 'pagination', responseData.pagination);
        }
        if ('stats' in responseData) {
          attachSibling(data, 'stats', responseData.stats);
        }
        if ('scope' in responseData) {
          attachSibling(data, 'scope', responseData.scope);
        }
      }

      if (!silent) {
        console.log('✅ Extracted data from response wrapper');
      }
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

  /**
   * Normalize any response shape into `{ data, pagination }`.
   *
   * Public helper for callers that want a consistent shape without
   * writing their own normalization. Handles:
   *
   *   1. Array                       → { data: T[], pagination: null }
   *   2. { data: T[] }               → { data: T[], pagination: sibling }
   *   3. { data: { data: T[], ... } } → { data: T[], pagination: from-inner }
   *   4. { products: T[], total }    → { data: T[], pagination: built }
   *
   * Used by `productService.getPublicProducts` and its siblings.
   */
  public normalizeListResponse<T = any>(
    response: any,
    fallbackLimit = 12,
  ): {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  } {
    // 1 — Raw array
    if (Array.isArray(response)) {
      const pagination = (response as any).pagination;
      return {
        data: response,
        total: Number(pagination?.total ?? response.length),
        page: Number(pagination?.page ?? 1),
        totalPages: Number(pagination?.totalPages ?? 1),
        limit: Number(pagination?.limit ?? fallbackLimit),
      };
    }

    // 2 — `{ data: T[], pagination }`
    if (response && Array.isArray(response.data)) {
      return {
        data: response.data,
        total: Number(
          response.pagination?.total ?? response.data.length,
        ),
        page: Number(response.pagination?.page ?? 1),
        totalPages: Number(response.pagination?.totalPages ?? 1),
        limit: Number(response.pagination?.limit ?? fallbackLimit),
      };
    }

    // 3 — `{ data: { data: T[], total, page, ... } }`
    if (
      response &&
      response.data &&
      Array.isArray(response.data.data)
    ) {
      return {
        data: response.data.data,
        total: Number(
          response.data.total ?? response.data.data.length,
        ),
        page: Number(response.data.page ?? 1),
        totalPages: Number(response.data.totalPages ?? 1),
        limit: Number(response.data.limit ?? fallbackLimit),
      };
    }

    // 4 — `{ products: T[], total, page, ... }`
    if (response && Array.isArray(response.products)) {
      return {
        data: response.products,
        total: Number(response.total ?? response.products.length),
        page: Number(response.page ?? 1),
        totalPages: Number(response.totalPages ?? 1),
        limit: Number(response.limit ?? fallbackLimit),
      };
    }

    // 5 — `{ data: { items: T[], ... } }`
    if (
      response &&
      response.data &&
      Array.isArray(response.data.items)
    ) {
      return {
        data: response.data.items,
        total: Number(response.data.total ?? response.data.items.length),
        page: Number(response.data.page ?? 1),
        totalPages: Number(response.data.totalPages ?? 1),
        limit: Number(response.data.limit ?? fallbackLimit),
      };
    }

    return {
      data: [],
      total: 0,
      page: 1,
      totalPages: 1,
      limit: fallbackLimit,
    };
  }

  // ============================================
  // HTTP METHODS
  // ============================================

  async get<T>(url: string, config?: SilentableRequestConfig): Promise<T> {
    const silent = config?.silent === true;
    try {
      const response: AxiosResponse<any> = await this.client.get(url, {
        ...config,
      });

      return this.extractData<T>(response.data, silent);
    } catch (error) {
      if (!silent) {
        console.error(`GET ${url} failed:`, error);
      }
      throw error;
    }
  }

  async post<T>(
    url: string,
    data?: any,
    config?: SilentableRequestConfig,
  ): Promise<T> {
    const silent = config?.silent === true;
    try {
      if (
        !silent &&
        data &&
        typeof data === 'object' &&
        !(data instanceof FormData)
      ) {
        const logData = { ...data };
        if (logData.password) logData.password = '***';
        if (logData.token) logData.token = '***';
        if (logData.apiKey) logData.apiKey = '***';
        if (logData.secretKey) logData.secretKey = '***';
        if (logData.images && Array.isArray(logData.images)) {
          logData.images = logData.images.map(
            (img: string, index: number) => {
              if (img && img.length > 200) {
                return `[Image ${index + 1}: ${Math.round(
                  img.length / 1024,
                )}KB]`;
              }
              return img;
            },
          );
        }
        console.log('📦 Payload:', JSON.stringify(logData, null, 2));
      }

      const response = await this.client.post(url, data, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...config?.headers,
        },
        maxBodyLength: 10 * 1024 * 1024,
        maxContentLength: 10 * 1024 * 1024,
      });

      return this.extractData<T>(response.data, silent);
    } catch (error: any) {
      if (!silent) {
        console.error(`❌ POST ${url} failed:`, error);

        if (error?.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          console.error('Request URL:', error.config?.url);

          if (
            error.response.status === 400 &&
            error.response.data?.errors
          ) {
            console.error('📋 Validation Errors:');
            error.response.data.errors.forEach((err: any) => {
              console.error(`   - ${err.field}: ${err.message}`);
            });
          }
        }
      }

      throw error;
    }
  }

  async put<T>(
    url: string,
    data?: any,
    config?: SilentableRequestConfig,
  ): Promise<T> {
    const silent = config?.silent === true;
    try {
      const response = await this.client.put(url, data, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...config?.headers,
        },
      });

      return this.extractData<T>(response.data, silent);
    } catch (error: any) {
      if (!silent) {
        console.error(`❌ PUT ${url} failed:`, error);

        if (error?.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          console.error('Request URL:', error.config?.url);
        }
      }

      throw error;
    }
  }

  async patch<T>(
    url: string,
    data?: any,
    config?: SilentableRequestConfig,
  ): Promise<T> {
    const silent = config?.silent === true;
    try {
      const response = await this.client.patch(url, data, {
        ...config,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...config?.headers,
        },
      });

      return this.extractData<T>(response.data, silent);
    } catch (error: any) {
      if (!silent) {
        console.error(`❌ PATCH ${url} failed:`, error);

        if (error?.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          console.error('Request URL:', error.config?.url);
        }
      }

      throw error;
    }
  }

  async delete<T>(
    url: string,
    config?: SilentableRequestConfig,
  ): Promise<T> {
    const silent = config?.silent === true;
    try {
      const response: AxiosResponse<any> = await this.client.delete(url, {
        ...config,
      });

      return this.extractData<T>(response.data, silent);
    } catch (error: any) {
      if (!silent) {
        console.error(`❌ DELETE ${url} failed:`, error);

        if (error?.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          console.error('Request URL:', error.config?.url);
        }
      }

      throw error;
    }
  }

  // ============================================
  // UPLOAD / DOWNLOAD
  // ============================================

  async upload<T>(
    url: string,
    fileOrFormData: File | FormData,
    fieldName: string = 'file',
    additionalData?: Record<string, any>,
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

  async download(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<Blob> {
    const response: AxiosResponse<Blob> = await this.client.get(url, {
      ...config,
      responseType: 'blob',
    });
    return response.data;
  }

  async downloadFile(
    url: string,
    filename: string,
    config?: AxiosRequestConfig,
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
    onRejected?: (error: any) => any,
  ): number {
    return this.client.interceptors.request.use(onFulfilled, onRejected);
  }

  addResponseInterceptor(
    onFulfilled: (response: any) => any,
    onRejected?: (error: any) => any,
  ): number {
    return this.client.interceptors.response.use(
      onFulfilled,
      onRejected,
    );
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

// Re-export the pagination symbols for consumers that prefer symbol
// access to the attached sibling fields.
export { PAGINATION_KEY, STATS_KEY, SCOPE_KEY };
