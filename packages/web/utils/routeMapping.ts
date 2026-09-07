// D:\Projects\Kalwanga\packages\web\utils\routeMapping.ts

/**
 * Route mapping utility to ensure frontend routes match backend API endpoints
 * This solves the 404 errors by providing a consistent mapping between frontend paths and API endpoints
 */

export const ROUTES = {
  // ============================================
  // INVENTORY ROUTES
  // ============================================
  INVENTORY: {
    // Page routes (frontend)
    DASHBOARD: '/admin/inventory',
    ADD: '/admin/inventory/add',
    DETAIL: (id: string) => `/admin/inventory/${id}`,
    EDIT: (id: string) => `/admin/inventory/${id}/edit`,
    TRANSFER: '/admin/inventory/transfer',
    TRANSACTIONS: '/admin/inventory/transactions',
    SUPPLIERS: '/admin/inventory/suppliers',
    STOCK_COUNT: '/admin/inventory/stock-count',
    SETTINGS: '/admin/inventory/settings',
    REPORTS: '/admin/inventory/reports',
    LOW_STOCK: '/admin/inventory/low-stock',
    IMPORT: '/admin/inventory/import',
    CATEGORIES: '/admin/inventory/categories',
    AUDIT: '/admin/inventory/audit',
    VALUATION: '/admin/inventory/valuation',
  },

  // ============================================
  // SALES ROUTES
  // ============================================
  SALES: {
    // Page routes (frontend)
    LIST: '/admin/sales',
    POS: '/admin/sales/pos',
    DASHBOARD: '/admin/sales/dashboard',
    ANALYTICS: '/admin/sales/analytics',
    SETTINGS: '/admin/sales/settings',
    RETURNS: '/admin/sales/returns',
    REFUNDS: '/admin/sales/refunds',
    INVOICES: '/admin/sales/invoices',
    RECEIPTS: '/admin/sales/receipts',
    REPORTS: '/admin/sales/reports',
    EXPORT: '/admin/sales/export',
    DETAIL: (id: string) => `/admin/sales/${id}`,
    EDIT: (id: string) => `/admin/sales/${id}/edit`,
  },

  // ============================================
  // CUSTOMER ROUTES
  // ============================================
  CUSTOMERS: {
    LIST: '/admin/customers',
    ADD: '/admin/customers/add',
    DETAIL: (id: string) => `/admin/customers/${id}`,
    EDIT: (id: string) => `/admin/customers/${id}/edit`,
    IMPORT: '/admin/customers/import',
    EXPORT: '/admin/customers/export',
  },

  // ============================================
  // USER ROUTES
  // ============================================
  USERS: {
    LIST: '/admin/users',
    ADD: '/admin/users/add',
    EDIT: (id: string) => `/admin/users/${id}/edit`,
    ROLES: '/admin/users/roles',
    PERMISSIONS: '/admin/users/permissions',
  },

  // ============================================
  // REPORT ROUTES
  // ============================================
  REPORTS: {
    LIST: '/admin/reports',
    SALES: '/admin/reports/sales',
    INVENTORY: '/admin/reports/inventory',
    CUSTOMERS: '/admin/reports/customers',
    PRODUCTS: '/admin/reports/products',
    PAYMENTS: '/admin/reports/payments',
    TAX: '/admin/reports/tax',
  },

  // ============================================
  // SETTINGS ROUTES
  // ============================================
  SETTINGS: {
    GENERAL: '/admin/settings',
    SALES: '/admin/settings/sales',
    INVENTORY: '/admin/settings/inventory',
    PAYMENT: '/admin/settings/payment',
    TAX: '/admin/settings/tax',
    SHIPPING: '/admin/settings/shipping',
    NOTIFICATIONS: '/admin/settings/notifications',
    USERS: '/admin/settings/users',
    BUSINESS: '/admin/settings/business',
  },

  // ============================================
  // API ROUTES (Backend)
  // ============================================
  API: {
    // Inventory API
    INVENTORY: {
      BASE: '/api/inventory',
      ALL: '/api/inventory/all',
      ITEMS: '/api/inventory/items',
      ITEM: (id: string) => `/api/inventory/items/${id}`,
      PRODUCT: (productId: string) => `/api/inventory/product/${productId}`,
      LOW_STOCK: '/api/inventory/low-stock',
      OUT_OF_STOCK: '/api/inventory/out-of-stock',
      VALUE: '/api/inventory/value',
      TRANSACTIONS: '/api/inventory/transactions',
      LOCATION: (location: string) => `/api/inventory/location/${location}`,
      CATEGORY: (category: string) => `/api/inventory/category/${category}`,
      SEARCH: '/api/inventory/search',
      EXPORT: '/api/inventory/export',
      SUMMARY: '/api/inventory/summary',
      MOVEMENTS: '/api/inventory/movements',
      TOTAL: '/api/inventory/total',
      CATEGORY_SUMMARY: '/api/inventory/category-summary',
      BULK: '/api/inventory/bulk',
      BULK_STOCK: '/api/inventory/bulk/stock',
      TRANSFER: '/api/inventory/transfer',
      RESERVE: (id: string) => `/api/inventory/${id}/reserve`,
      RELEASE: (id: string) => `/api/inventory/${id}/release`,
      STOCK: (id: string) => `/api/inventory/items/${id}/stock`,
      ISSUE: (id: string) => `/api/inventory/items/${id}/issue`,
      RETURN: (id: string) => `/api/inventory/items/${id}/return`,
      RESTOCK: (id: string) => `/api/inventory/items/${id}/restock`,
      DELETE: (id: string) => `/api/inventory/items/${id}`,
      REPORTS: '/api/inventory/reports',
    },

    // Sales API
    SALES: {
      BASE: '/api/sales',
      ALL: '/api/sales',
      BY_ID: (id: string) => `/api/sales/${id}`,
      BY_RECEIPT: (receiptNumber: string) => `/api/sales/receipt/${receiptNumber}`,
      STATS: '/api/sales/stats',
      EXPORT: '/api/sales/export',
      ANALYTICS: '/api/sales/analytics',
      FORECAST: '/api/sales/forecast',
      COMPARE: '/api/sales/compare',
      SUMMARY: '/api/sales/summary',
      PAYMENT_METHODS: '/api/sales/payment-methods',
      BY_STATUS: (status: string) => `/api/sales/status/${status}`,
      AGGREGATE: '/api/sales/aggregate',
      BY_PRODUCT: (productId: string) => `/api/sales/product/${productId}`,
      BY_CUSTOMER: (customerId: string) => `/api/sales/customer/${customerId}`,
      CUSTOMER_STATS: (customerId: string) => `/api/sales/customer-stats/${customerId}`,
      RECENT: '/api/sales/recent',
      DASHBOARD: '/api/sales/dashboard',
      DAILY_SUMMARY: '/api/sales/daily-summary',
      TODAY: '/api/sales/today',
      DATE_RANGE: '/api/sales/date-range',
    },

    // Checkout API
    CHECKOUT: {
      BASE: '/api/checkout',
      SUMMARY: (cartId: string) => `/api/checkout/summary/${cartId}`,
      PROCESS: '/api/checkout',
      RECEIPT: (saleId: string) => `/api/checkout/receipt/${saleId}`,
      RECEIPT_BY_NUMBER: (receiptNumber: string) => `/api/checkout/receipt/number/${receiptNumber}`,
      ADMIN_ALL: '/api/checkout/admin/all',
      VALIDATE: '/api/checkout/validate',
      PAYMENT_METHODS: '/api/checkout/payment-methods',
      SETTINGS: '/api/checkout/settings',
      HISTORY: '/api/checkout/history',
      CALCULATE: '/api/checkout/calculate',
      CANCEL: (saleId: string) => `/api/checkout/cancel/${saleId}`,
      CART: (cartId: string) => `/api/checkout/cart/${cartId}`,
    },

    // Returns API
    RETURNS: {
      BASE: '/api/returns',
      ALL: '/api/returns',
      BY_ID: (id: string) => `/api/returns/${id}`,
      STATS: '/api/returns/stats',
      EXPORT: '/api/returns/export',
      PROCESS: (id: string) => `/api/returns/${id}/process`,
      REJECT: (id: string) => `/api/returns/${id}/reject`,
    },

    // Refunds API
    REFUNDS: {
      BASE: '/api/refunds',
      ALL: '/api/refunds',
      BY_ID: (id: string) => `/api/refunds/${id}`,
      STATS: '/api/refunds/stats',
      EXPORT: '/api/refunds/export',
      APPROVE: (id: string) => `/api/refunds/${id}/approve`,
      REJECT: (id: string) => `/api/refunds/${id}/reject`,
      COMPLETE: (id: string) => `/api/refunds/${id}/complete`,
    },

    // Invoices API
    INVOICES: {
      BASE: '/api/invoices',
      ALL: '/api/invoices',
      BY_ID: (id: string) => `/api/invoices/${id}`,
      STATS: '/api/invoices/stats',
      EXPORT: '/api/invoices/export',
      PDF: (id: string) => `/api/invoices/${id}/pdf`,
      SEND: (id: string) => `/api/invoices/${id}/send`,
      PAID: (id: string) => `/api/invoices/${id}/paid`,
      VOID: (id: string) => `/api/invoices/${id}/void`,
      CANCEL: (id: string) => `/api/invoices/${id}/cancel`,
    },

    // Receipts API
    RECEIPTS: {
      BASE: '/api/receipts',
      ALL: '/api/receipts',
      BY_ID: (id: string) => `/api/receipts/${id}`,
      BY_NUMBER: (number: string) => `/api/receipts/number/${number}`,
      STATS: '/api/receipts/stats',
      EXPORT: '/api/receipts/export',
      PDF: (id: string) => `/api/receipts/${id}/pdf`,
      EMAIL: (id: string) => `/api/receipts/${id}/email`,
      PRINT: (id: string) => `/api/receipts/${id}/print`,
      VOID: (id: string) => `/api/receipts/${id}/void`,
    },

    // Reports API
    REPORTS: {
      BASE: '/api/reports',
      SALES: '/api/reports/sales',
      DOWNLOAD: '/api/reports/sales/download',
      FORMATS: '/api/reports/formats',
    },

    // Export API
    EXPORT: {
      SALES: '/api/export/sales',
      SCHEDULE: '/api/export/schedule',
      HISTORY: '/api/export/history',
      STATS: '/api/export/stats',
      EMAIL: (id: string) => `/api/export/${id}/email`,
      DELETE: (id: string) => `/api/export/${id}`,
    },

    // Customers API
    CUSTOMERS: {
      BASE: '/api/customers',
      ALL: '/api/customers',
      BY_ID: (id: string) => `/api/customers/${id}`,
      SEARCH: '/api/customers/search',
      STATS: '/api/customers/stats',
      LOYALTY: (id: string) => `/api/customers/${id}/loyalty`,
      EXPORT: '/api/customers/export',
      IMPORT: '/api/customers/import',
    },

    // Suppliers API
    SUPPLIERS: {
      BASE: '/api/suppliers',
      ALL: '/api/suppliers',
      BY_ID: (id: string) => `/api/suppliers/${id}`,
      PRODUCTS: (id: string) => `/api/suppliers/${id}/products`,
      SEARCH: '/api/suppliers/search',
      STATS: '/api/suppliers/stats',
    },

    // Categories API
    CATEGORIES: {
      BASE: '/api/categories',
      ALL: '/api/categories',
      BY_ID: (id: string) => `/api/categories/${id}`,
      TREE: '/api/categories/tree',
      SEARCH: '/api/categories/search',
      BY_NAME: (name: string) => `/api/categories/by-name/${name}`,
      SUB: (id: string) => `/api/categories/${id}/subcategories`,
      PRODUCTS: (id: string) => `/api/categories/${id}/products`,
    },

    // Products API
    PRODUCTS: {
      BASE: '/api/products',
      ALL: '/api/products',
      BY_ID: (id: string) => `/api/products/${id}`,
      SEARCH: '/api/products/search',
      BY_CATEGORY: (categoryId: string) => `/api/products/category/${categoryId}`,
      BY_SKU: (sku: string) => `/api/products/sku/${sku}`,
      BY_BARCODE: (barcode: string) => `/api/products/barcode/${barcode}`,
      STATS: '/api/products/stats',
      EXPORT: '/api/products/export',
      IMPORT: '/api/products/import',
      RECENT: '/api/products/recent',
      FEATURED: '/api/products/featured',
    },

    // Users API
    USERS: {
      BASE: '/api/users',
      ALL: '/api/users',
      BY_ID: (id: string) => `/api/users/${id}`,
      PERMISSIONS: '/api/users/permissions',
      ROLES: '/api/users/roles',
      PROFILE: '/api/users/profile',
      SEARCH: '/api/users/search',
    },

    // Settings API
    SETTINGS: {
      BASE: '/api/settings',
      SALES: '/api/settings/sales',
      INVENTORY: '/api/settings/inventory',
      PAYMENT: '/api/settings/payment',
      TAX: '/api/settings/tax',
      SHIPPING: '/api/settings/shipping',
      NOTIFICATIONS: '/api/settings/notifications',
      BUSINESS: '/api/settings/business',
      USERS: '/api/settings/users',
    },

    // Auth API
    AUTH: {
      LOGIN: '/api/auth/login',
      LOGOUT: '/api/auth/logout',
      REGISTER: '/api/auth/register',
      VERIFY: '/api/auth/verify',
      FORGOT_PASSWORD: '/api/auth/forgot-password',
      RESET_PASSWORD: '/api/auth/reset-password',
      REFRESH: '/api/auth/refresh',
      PROFILE: '/api/auth/profile',
      PERMISSIONS: '/api/auth/permissions',
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Maps frontend route to API endpoint
 */
export const mapRouteToApi = (frontendPath: string): string => {
  // Remove /dashboard prefix for API calls
  const cleanPath = frontendPath.replace('/dashboard', '');
  
  // ============================================
  // Map Inventory routes
  // ============================================
  if (cleanPath.startsWith('/admin/inventory')) {
    const path = cleanPath.replace('/admin/inventory', '');
    
    if (path === '' || path === '/') return ROUTES.API.INVENTORY.BASE;
    if (path === '/add') return ROUTES.API.INVENTORY.ITEMS;
    if (path === '/all') return ROUTES.API.INVENTORY.ALL;
    if (path === '/transfer') return ROUTES.API.INVENTORY.TRANSFER;
    if (path === '/transactions') return ROUTES.API.INVENTORY.TRANSACTIONS;
    if (path === '/suppliers') return ROUTES.API.SUPPLIERS.BASE;
    if (path === '/stock-count') return '/api/stock-count';
    if (path === '/settings') return ROUTES.API.SETTINGS.INVENTORY;
    if (path === '/reports') return ROUTES.API.INVENTORY.REPORTS;
    if (path === '/low-stock') return ROUTES.API.INVENTORY.LOW_STOCK;
    if (path === '/import') return ROUTES.API.INVENTORY.BULK;
    if (path === '/categories') return ROUTES.API.CATEGORIES.BASE;
    if (path === '/audit') return '/api/audit';
    if (path === '/valuation') return ROUTES.API.INVENTORY.VALUE;
    
    // Handle dynamic routes
    const detailMatch = path.match(/^\/([^\/]+)$/);
    if (detailMatch) {
      return ROUTES.API.INVENTORY.ITEM(detailMatch[1]);
    }
    
    const stockMatch = path.match(/^\/([^\/]+)\/stock$/);
    if (stockMatch) {
      return ROUTES.API.INVENTORY.STOCK(stockMatch[1]);
    }
  }

  // ============================================
  // Map Sales routes
  // ============================================
  if (cleanPath.startsWith('/admin/sales')) {
    const path = cleanPath.replace('/admin/sales', '');
    
    if (path === '' || path === '/') return ROUTES.API.SALES.BASE;
    if (path === '/pos') return ROUTES.API.SALES.BASE;
    if (path === '/dashboard') return ROUTES.API.SALES.DASHBOARD;
    if (path === '/analytics') return ROUTES.API.SALES.ANALYTICS;
    if (path === '/settings') return ROUTES.API.SETTINGS.SALES;
    if (path === '/returns') return ROUTES.API.RETURNS.BASE;
    if (path === '/refunds') return ROUTES.API.REFUNDS.BASE;
    if (path === '/invoices') return ROUTES.API.INVOICES.BASE;
    if (path === '/receipts') return ROUTES.API.RECEIPTS.BASE;
    if (path === '/reports') return ROUTES.API.REPORTS.SALES;
    if (path === '/export') return ROUTES.API.EXPORT.SALES;
    if (path === '/stats') return ROUTES.API.SALES.STATS;
    if (path === '/recent') return ROUTES.API.SALES.RECENT;
    if (path === '/today') return ROUTES.API.SALES.TODAY;
    if (path === '/daily-summary') return ROUTES.API.SALES.DAILY_SUMMARY;
    if (path === '/date-range') return ROUTES.API.SALES.DATE_RANGE;
    if (path === '/payment-methods') return ROUTES.API.SALES.PAYMENT_METHODS;
    if (path === '/summary') return ROUTES.API.SALES.SUMMARY;
    if (path === '/aggregate') return ROUTES.API.SALES.AGGREGATE;
    if (path === '/forecast') return ROUTES.API.SALES.FORECAST;
    if (path === '/compare') return ROUTES.API.SALES.COMPARE;
    
    // Handle dynamic routes
    const idMatch = path.match(/^\/([^\/]+)$/);
    if (idMatch) {
      return ROUTES.API.SALES.BY_ID(idMatch[1]);
    }
    
    const receiptMatch = path.match(/^\/receipt\/([^\/]+)$/);
    if (receiptMatch) {
      return ROUTES.API.SALES.BY_RECEIPT(receiptMatch[1]);
    }
    
    const customerMatch = path.match(/^\/customer\/([^\/]+)$/);
    if (customerMatch) {
      return ROUTES.API.SALES.BY_CUSTOMER(customerMatch[1]);
    }
    
    const productMatch = path.match(/^\/product\/([^\/]+)$/);
    if (productMatch) {
      return ROUTES.API.SALES.BY_PRODUCT(productMatch[1]);
    }
    
    const statusMatch = path.match(/^\/status\/([^\/]+)$/);
    if (statusMatch) {
      return ROUTES.API.SALES.BY_STATUS(statusMatch[1]);
    }
  }

  // ============================================
  // Map Customer routes
  // ============================================
  if (cleanPath.startsWith('/admin/customers')) {
    const path = cleanPath.replace('/admin/customers', '');
    if (path === '' || path === '/') return ROUTES.API.CUSTOMERS.BASE;
    if (path === '/add') return ROUTES.API.CUSTOMERS.BASE;
    if (path === '/search') return ROUTES.API.CUSTOMERS.SEARCH;
    if (path === '/stats') return ROUTES.API.CUSTOMERS.STATS;
    if (path === '/export') return ROUTES.API.CUSTOMERS.EXPORT;
    if (path === '/import') return ROUTES.API.CUSTOMERS.IMPORT;
    
    const customerIdMatch = path.match(/^\/([^\/]+)$/);
    if (customerIdMatch) {
      return ROUTES.API.CUSTOMERS.BY_ID(customerIdMatch[1]);
    }
  }

  // ============================================
  // Map User routes
  // ============================================
  if (cleanPath.startsWith('/admin/users')) {
    const path = cleanPath.replace('/admin/users', '');
    if (path === '' || path === '/') return ROUTES.API.USERS.BASE;
    if (path === '/add') return ROUTES.API.USERS.BASE;
    if (path === '/roles') return ROUTES.API.USERS.ROLES;
    if (path === '/permissions') return ROUTES.API.USERS.PERMISSIONS;
    
    const userIdMatch = path.match(/^\/([^\/]+)$/);
    if (userIdMatch) {
      return ROUTES.API.USERS.BY_ID(userIdMatch[1]);
    }
  }

  // ============================================
  // Map Report routes
  // ============================================
  if (cleanPath.startsWith('/admin/reports')) {
    const path = cleanPath.replace('/admin/reports', '');
    if (path === '' || path === '/') return ROUTES.API.REPORTS.BASE;
    if (path === '/sales') return ROUTES.API.REPORTS.SALES;
  }

  // ============================================
  // Map Settings routes
  // ============================================
  if (cleanPath.startsWith('/admin/settings')) {
    const path = cleanPath.replace('/admin/settings', '');
    if (path === '' || path === '/') return ROUTES.API.SETTINGS.BASE;
    if (path === '/sales') return ROUTES.API.SETTINGS.SALES;
    if (path === '/inventory') return ROUTES.API.SETTINGS.INVENTORY;
    if (path === '/payment') return ROUTES.API.SETTINGS.PAYMENT;
    if (path === '/tax') return ROUTES.API.SETTINGS.TAX;
    if (path === '/shipping') return ROUTES.API.SETTINGS.SHIPPING;
    if (path === '/notifications') return ROUTES.API.SETTINGS.NOTIFICATIONS;
    if (path === '/business') return ROUTES.API.SETTINGS.BUSINESS;
  }

  // ============================================
  // Map Category routes
  // ============================================
  if (cleanPath.startsWith('/admin/categories') || cleanPath.startsWith('/categories')) {
    const path = cleanPath.replace(/^\/admin\/categories/, '').replace(/^\/categories/, '');
    if (path === '' || path === '/') return ROUTES.API.CATEGORIES.BASE;
    if (path === '/tree') return ROUTES.API.CATEGORIES.TREE;
    if (path === '/search') return ROUTES.API.CATEGORIES.SEARCH;
    
    const categoryIdMatch = path.match(/^\/([^\/]+)$/);
    if (categoryIdMatch) {
      return ROUTES.API.CATEGORIES.BY_ID(categoryIdMatch[1]);
    }
  }

  // ============================================
  // Map Product routes
  // ============================================
  if (cleanPath.startsWith('/admin/products') || cleanPath.startsWith('/products')) {
    const path = cleanPath.replace(/^\/admin\/products/, '').replace(/^\/products/, '');
    if (path === '' || path === '/') return ROUTES.API.PRODUCTS.BASE;
    if (path === '/search') return ROUTES.API.PRODUCTS.SEARCH;
    if (path === '/featured') return ROUTES.API.PRODUCTS.FEATURED;
    if (path === '/recent') return ROUTES.API.PRODUCTS.RECENT;
    if (path === '/stats') return ROUTES.API.PRODUCTS.STATS;
    if (path === '/export') return ROUTES.API.PRODUCTS.EXPORT;
    if (path === '/import') return ROUTES.API.PRODUCTS.IMPORT;
    
    const productIdMatch = path.match(/^\/([^\/]+)$/);
    if (productIdMatch) {
      return ROUTES.API.PRODUCTS.BY_ID(productIdMatch[1]);
    }
  }

  // ============================================
  // Map Checkout routes
  // ============================================
  if (cleanPath.startsWith('/checkout')) {
    const path = cleanPath.replace('/checkout', '');
    if (path === '' || path === '/') return ROUTES.API.CHECKOUT.BASE;
    if (path === '/validate') return ROUTES.API.CHECKOUT.VALIDATE;
    if (path === '/calculate') return ROUTES.API.CHECKOUT.CALCULATE;
    if (path === '/payment-methods') return ROUTES.API.CHECKOUT.PAYMENT_METHODS;
    if (path === '/settings') return ROUTES.API.CHECKOUT.SETTINGS;
    if (path === '/history') return ROUTES.API.CHECKOUT.HISTORY;
    
    const cartMatch = path.match(/^\/cart\/([^\/]+)$/);
    if (cartMatch) {
      return ROUTES.API.CHECKOUT.CART(cartMatch[1]);
    }
    
    const receiptMatch = path.match(/^\/receipt\/([^\/]+)$/);
    if (receiptMatch) {
      return ROUTES.API.CHECKOUT.RECEIPT(receiptMatch[1]);
    }
  }

  // Default to the original path
  return `/api${cleanPath}`;
};

/**
 * Navigation helper to ensure consistent routing
 */
export const navigateTo = (path: string): string => {
  // Ensure the path starts with /dashboard/admin for inventory pages
  if (path.includes('inventory') && !path.startsWith('/dashboard')) {
    return `/dashboard${path}`;
  }
  
  // Ensure the path starts with /admin for sales pages
  if (path.includes('sales') && !path.startsWith('/admin') && !path.startsWith('/dashboard')) {
    return `/admin${path}`;
  }
  
  return path;
};

/**
 * Get the API URL for a given frontend route
 */
export const getApiUrl = (frontendPath: string): string => {
  const apiPath = mapRouteToApi(frontendPath);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return `${baseUrl}${apiPath}`;
};

/**
 * Check if a route is a sales route
 */
export const isSalesRoute = (pathname: string): boolean => {
  return pathname.includes('/admin/sales') || pathname.includes('/pos') || pathname.includes('/checkout');
};

/**
 * Check if a route is an inventory route
 */
export const isInventoryRoute = (pathname: string): boolean => {
  return pathname.includes('/admin/inventory') || pathname.includes('/inventory');
};

/**
 * Check if a route is a customer route
 */
export const isCustomerRoute = (pathname: string): boolean => {
  return pathname.includes('/admin/customers') || pathname.includes('/customers');
};

/**
 * Check if a route is a report route
 */
export const isReportRoute = (pathname: string): boolean => {
  return pathname.includes('/admin/reports') || pathname.includes('/reports');
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  ROUTES,
  mapRouteToApi,
  navigateTo,
  getApiUrl,
  isSalesRoute,
  isInventoryRoute,
  isCustomerRoute,
  isReportRoute,
};
