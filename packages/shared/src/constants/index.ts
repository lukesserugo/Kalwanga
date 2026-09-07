// ============================================
// API ENDPOINTS
// ============================================

export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: '/api/auth',
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  ME: '/api/auth/me',

  // Product endpoints
  PRODUCTS: '/api/products',
  PRODUCT: '/api/products/:id',
  PRODUCT_BY_SKU: '/api/products/search/sku/:sku',
  PRODUCT_BY_BARCODE: '/api/products/search/barcode/:barcode',
  PRODUCT_VARIANTS: '/api/products/:id/variants',
  PRODUCT_VARIANT: '/api/products/variants/:variantId',

  // Sale endpoints
  SALES: '/api/sales',
  SALE: '/api/sales/:id',
  SALE_BY_RECEIPT: '/api/sales/receipt/:receiptNumber',
  SALE_STATS: '/api/sales/stats',
  SALE_REFUND: '/api/sales/:id/refund',

  // Inventory endpoints
  INVENTORY: '/api/inventory',
  INVENTORY_LOW_STOCK: '/api/inventory/low-stock',
  INVENTORY_VALUE: '/api/inventory/value',
  INVENTORY_TRANSACTIONS: '/api/inventory/transactions',
  INVENTORY_BY_PRODUCT: '/api/inventory/product/:productId',
  INVENTORY_UPDATE_STOCK: '/api/inventory/:productId/stock',

  // Customer endpoints
  CUSTOMERS: '/api/customers',
  CUSTOMER: '/api/customers/:id',
  CUSTOMER_STATS: '/api/customers/:id/stats',
  CUSTOMER_LOYALTY_ADD: '/api/customers/:id/loyalty/add',
  CUSTOMER_LOYALTY_REDEEM: '/api/customers/:id/loyalty/redeem',

  // User endpoints
  USERS: '/api/users',
  USER: '/api/users/:id',
  USER_ME: '/api/users/me',
  USER_BUSINESS: '/api/users/business/:businessUnitId',
  USER_ASSIGN_BUSINESS: '/api/users/:userId/business/:businessUnitId',
  USER_DEACTIVATE: '/api/users/:id/deactivate',
  USER_ACTIVATE: '/api/users/:id/activate',

  // Business Unit endpoints
  BUSINESS_UNITS: '/api/business-units',
  BUSINESS_UNIT: '/api/business-units/:id',
  BUSINESS_UNIT_STATS: '/api/business-units/:id/stats',

  // Category endpoints
  CATEGORIES: '/api/categories',
  CATEGORY: '/api/categories/:id',
  CATEGORY_TREE: '/api/categories/tree/:businessUnitId',

  // Order endpoints
  ORDERS: '/api/orders',
  ORDER: '/api/orders/:id',
  ORDER_BY_NUMBER: '/api/orders/number/:orderNumber',
  ORDER_STATUS: '/api/orders/:id/status',
  ORDER_CANCEL: '/api/orders/:id/cancel',
  ORDER_CONVERT: '/api/orders/:id/convert-to-sale',

  // Payment endpoints
  PAYMENTS: '/api/payments',
  PAYMENT: '/api/payments/:id',
  PAYMENT_REFUND: '/api/payments/:id/refund',
  PAYMENT_SUMMARY: '/api/payments/summary',

  // Report endpoints
  REPORTS_SALES: '/api/reports/sales',
  REPORTS_INVENTORY: '/api/reports/inventory',
  REPORTS_CUSTOMERS: '/api/reports/customers',
  REPORTS_PRODUCTS: '/api/reports/products',
  REPORTS_EMPLOYEES: '/api/reports/employees',
  REPORTS_PAYMENTS: '/api/reports/payments',

  // WebSocket
  WS_CONNECT: '/socket.io',
} as const;

// ============================================
// USER ROLES
// ============================================

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  CASHIER: 'CASHIER',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  CASHIER: 'Cashier',
};

export const USER_ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  MANAGER: 3,
  EMPLOYEE: 2,
  CASHIER: 1,
};

// ============================================
// ORDER STATUS
// ============================================

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  ON_HOLD: 'ON_HOLD',
} as const;

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  ON_HOLD: 'On Hold',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: '#FFA500',
  PROCESSING: '#3498DB',
  COMPLETED: '#2ECC71',
  CANCELLED: '#E74C3C',
  REFUNDED: '#9B59B6',
  ON_HOLD: '#F39C12',
};

// ============================================
// PAYMENT METHODS
// ============================================

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CREDIT_CARD: 'CREDIT_CARD',
  DEBIT_CARD: 'DEBIT_CARD',
  MOBILE_MONEY: 'MOBILE_MONEY',
  BANK_TRANSFER: 'BANK_TRANSFER',
  GIFT_CARD: 'GIFT_CARD',
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Bank Transfer',
  GIFT_CARD: 'Gift Card',
};

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, string> = {
  CASH: 'cash-outline',
  CREDIT_CARD: 'card-outline',
  DEBIT_CARD: 'card-outline',
  MOBILE_MONEY: 'phone-portrait-outline',
  BANK_TRANSFER: 'business-outline',
  GIFT_CARD: 'gift-outline',
};

// ============================================
// PAYMENT STATUS
// ============================================

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  PARTIAL: 'PARTIAL',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  PARTIAL: 'Partial',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  PENDING: '#FFA500',
  PAID: '#2ECC71',
  FAILED: '#E74C3C',
  REFUNDED: '#9B59B6',
  PARTIAL: '#3498DB',
};

// ============================================
// INVENTORY TRANSACTION TYPES
// ============================================

export const INVENTORY_TRANSACTION_TYPES = {
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  RETURN: 'RETURN',
  ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER: 'TRANSFER',
} as const;

export type InventoryTransactionType = typeof INVENTORY_TRANSACTION_TYPES[keyof typeof INVENTORY_TRANSACTION_TYPES];

export const INVENTORY_TRANSACTION_LABELS: Record<InventoryTransactionType, string> = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  RETURN: 'Return',
  ADJUSTMENT: 'Adjustment',
  TRANSFER: 'Transfer',
};

// ============================================
// REPORT TYPES
// ============================================

export const REPORT_TYPES = {
  SALES: 'SALES',
  INVENTORY: 'INVENTORY',
  EMPLOYEE: 'EMPLOYEE',
  FINANCIAL: 'FINANCIAL',
  CUSTOMER: 'CUSTOMER',
} as const;

export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  SALES: 'Sales Report',
  INVENTORY: 'Inventory Report',
  EMPLOYEE: 'Employee Report',
  FINANCIAL: 'Financial Report',
  CUSTOMER: 'Customer Report',
};

// ============================================
// NOTIFICATION TYPES
// ============================================

export const NOTIFICATION_TYPES = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
} as const;

export type NotificationType = typeof NOTIFICATION_TYPES[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_TYPE_COLORS: Record<NotificationType, string> = {
  INFO: '#3498DB',
  SUCCESS: '#2ECC71',
  WARNING: '#F39C12',
  ERROR: '#E74C3C',
};

// ============================================
// CURRENCIES
// ============================================

export const CURRENCIES = {
  USD: 'USD',
  EUR: 'EUR',
  GBP: 'GBP',
  UGX: 'UGX',
  KES: 'KES',
  TZS: 'TZS',
} as const;

export type Currency = typeof CURRENCIES[keyof typeof CURRENCIES];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  UGX: 'USh',
  KES: 'KSh',
  TZS: 'TSh',
};

// ============================================
// DATE FORMATS
// ============================================

export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_WITH_TIME: 'MMM dd, yyyy HH:mm',
  API: 'yyyy-MM-dd',
  API_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
  TIME: 'HH:mm',
  SHORT: 'MM/dd/yyyy',
};

// ============================================
// PAGINATION
// ============================================

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE = 1;

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER: 'user',
  THEME: 'theme',
  LANGUAGE: 'language',
  CART: 'cart',
  BUSINESS_UNIT: 'selected_business_unit',
} as const;

// ============================================
// WEBSOCKET EVENTS
// ============================================

export const WS_EVENTS = {
  // Client to Server
  JOIN_BUSINESS: 'join-business',
  JOIN_USER: 'join-user',
  
  // Server to Client
  NEW_SALE: 'new-sale',
  PRODUCT_UPDATED: 'product-updated',
  INVENTORY_UPDATED: 'inventory-updated',
  LOW_STOCK_ALERT: 'low-stock-alert',
  NOTIFICATION: 'notification',
  ORDER_UPDATED: 'order-updated',
  PAYMENT_RECEIVED: 'payment-received',
} as const;

export type WSEvent = typeof WS_EVENTS[keyof typeof WS_EVENTS];
