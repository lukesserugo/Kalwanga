// src/utils/constants.ts

export const constants = {
  APP_NAME: 'POS System',
  APP_VERSION: '1.0.0',
  API_URL: process.env.REACT_APP_API_URL || '/api',
  TOKEN_KEY: 'auth_token',
  USER_KEY: 'user',

  CURRENCY: 'USD',
  CURRENCY_SYMBOL: '$',
  DATE_FORMAT: 'MMM dd, yyyy',
  TIME_FORMAT: 'hh:mm A',
  DATE_TIME_FORMAT: 'MMM dd, yyyy hh:mm A',

  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 10,
    LIMITS: [10, 20, 50, 100],
  },

  FILE_UPLOAD: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ACCEPTED_EXTENSIONS: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    MAX_FILES: 10,
  },

  USER_ROLES: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    EDITOR: 'EDITOR',
    VIEWER: 'VIEWER',
    EMPLOYEE: 'EMPLOYEE',
    CASHIER: 'CASHIER',
    USER: 'USER',
  },

  // ============================================
  // ORDER STATUSES (Existing - Kept for backward compatibility)
  // ============================================
  ORDER_STATUSES: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    ON_HOLD: 'ON_HOLD',
  },

  // ============================================
  // SALE STATUSES (New - Extended from ORDER_STATUSES)
  // ============================================
  SALE_STATUSES: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'REFUNDED',
    ON_HOLD: 'ON_HOLD',
  },

  // ============================================
  // PAYMENT METHODS (Existing - Kept for backward compatibility)
  // ============================================
  PAYMENT_METHODS: {
    CASH: 'CASH',
    CREDIT_CARD: 'CREDIT_CARD',
    DEBIT_CARD: 'DEBIT_CARD',
    MOBILE_MONEY: 'MOBILE_MONEY',
    BANK_TRANSFER: 'BANK_TRANSFER',
    GIFT_CARD: 'GIFT_CARD',
    LOYALTY_POINTS: 'LOYALTY_POINTS',
    CRYPTO: 'CRYPTO',
    CHECK: 'CHECK',
  },

  // ============================================
  // PAYMENT STATUSES (Existing - Kept for backward compatibility)
  // ============================================
  PAYMENT_STATUSES: {
    PENDING: 'PENDING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED',
    PARTIAL: 'PARTIAL',
    PROCESSING: 'PROCESSING',
    AUTHORIZED: 'AUTHORIZED',
    DECLINED: 'DECLINED',
  },

  // ============================================
  // INVENTORY TRANSACTION TYPES (Existing - Kept for backward compatibility)
  // ============================================
  INVENTORY_TRANSACTION_TYPES: {
    PURCHASE: 'PURCHASE',
    SALE: 'SALE',
    RETURN: 'RETURN',
    ADJUSTMENT: 'ADJUSTMENT',
    TRANSFER: 'TRANSFER',
    TRANSFER_IN: 'TRANSFER_IN',
    TRANSFER_OUT: 'TRANSFER_OUT',
    ISSUE: 'ISSUE',
    INITIAL: 'INITIAL',
    ADJUSTMENT_IN: 'ADJUSTMENT_IN',
    ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
    DAMAGED: 'DAMAGED',
    LOST: 'LOST',
    RESTOCK: 'RESTOCK',
  },

  // ============================================
  // RETURN STATUSES (New)
  // ============================================
  RETURN_STATUSES: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PROCESSED: 'processed',
    CANCELLED: 'cancelled',
  },

  RETURN_TYPES: {
    FULL: 'full',
    PARTIAL: 'partial',
  },

  // ============================================
  // REFUND STATUSES (New)
  // ============================================
  REFUND_STATUSES: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },

  REFUND_METHODS: {
    CASH: 'cash',
    CREDIT: 'credit',
    STORE_CREDIT: 'store_credit',
    ORIGINAL_PAYMENT: 'original_payment',
    BANK_TRANSFER: 'bank_transfer',
  },

  // ============================================
  // INVOICE STATUSES (New)
  // ============================================
  INVOICE_STATUSES: {
    DRAFT: 'draft',
    SENT: 'sent',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled',
    VOID: 'void',
    PARTIALLY_PAID: 'partially_paid',
  },

  INVOICE_PAYMENT_TERMS: {
    NET_7: 'net_7',
    NET_15: 'net_15',
    NET_30: 'net_30',
    NET_60: 'net_60',
    DUE_ON_RECEIPT: 'due_on_receipt',
  },

  // ============================================
  // RECEIPT STATUSES (New)
  // ============================================
  RECEIPT_STATUSES: {
    ISSUED: 'issued',
    SENT: 'sent',
    PRINTED: 'printed',
    CANCELLED: 'cancelled',
    VOID: 'void',
  },

  RECEIPT_TYPES: {
    SALE: 'sale',
    REFUND: 'refund',
    RETURN: 'return',
  },

  // ============================================
  // SHIFT STATUSES (New)
  // ============================================
  SHIFT_STATUSES: {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED',
    VOID: 'VOID',
    PENDING: 'PENDING',
  },

  SHIFT_TYPES: {
    MORNING: 'MORNING',
    AFTERNOON: 'AFTERNOON',
    NIGHT: 'NIGHT',
    WEEKEND: 'WEEKEND',
  },

  // ============================================
  // CASH REGISTER STATUSES (New)
  // ============================================
  CASH_REGISTER_STATUSES: {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED',
    PENDING: 'PENDING',
    SUSPENDED: 'SUSPENDED',
  },

  CASH_TRANSACTION_TYPES: {
    CASH_IN: 'CASH_IN',
    CASH_OUT: 'CASH_OUT',
    SALE: 'SALE',
    REFUND: 'REFUND',
    ADJUSTMENT: 'ADJUSTMENT',
    DEPOSIT: 'DEPOSIT',
    WITHDRAWAL: 'WITHDRAWAL',
  },

  // ============================================
  // REPORT TYPES (New)
  // ============================================
  REPORT_TYPES: {
    BALANCE_SHEET: 'BALANCE_SHEET',
    INCOME_STATEMENT: 'INCOME_STATEMENT',
    CASH_FLOW: 'CASH_FLOW',
    TAX_SUMMARY: 'TAX_SUMMARY',
    SALES_REPORT: 'SALES_REPORT',
    INVENTORY_REPORT: 'INVENTORY_REPORT',
    CUSTOMER_REPORT: 'CUSTOMER_REPORT',
    PRODUCT_REPORT: 'PRODUCT_REPORT',
    EMPLOYEE_REPORT: 'EMPLOYEE_REPORT',
    PAYMENT_REPORT: 'PAYMENT_REPORT',
    SUPPLIER_REPORT: 'SUPPLIER_REPORT',
    PURCHASE_ORDER_REPORT: 'PURCHASE_ORDER_REPORT',
    PROFIT_AND_LOSS: 'PROFIT_AND_LOSS',
    AGING_REPORT: 'AGING_REPORT',
    COMPREHENSIVE: 'COMPREHENSIVE',
  },

  REPORT_FORMATS: {
    PDF: 'PDF',
    CSV: 'CSV',
    EXCEL: 'EXCEL',
    JSON: 'JSON',
    HTML: 'HTML',
  },

  REPORT_DATE_RANGES: {
    TODAY: 'today',
    YESTERDAY: 'yesterday',
    THIS_WEEK: 'this_week',
    LAST_WEEK: 'last_week',
    THIS_MONTH: 'this_month',
    LAST_MONTH: 'last_month',
    THIS_QUARTER: 'this_quarter',
    LAST_QUARTER: 'last_quarter',
    THIS_YEAR: 'this_year',
    CUSTOM: 'custom',
  },

  // ============================================
  // EXPORT FORMATS (New)
  // ============================================
  EXPORT_FORMATS: {
    CSV: 'csv',
    EXCEL: 'excel',
    PDF: 'pdf',
    JSON: 'json',
    XML: 'xml',
  },

  EXPORT_TYPES: {
    SALES: 'sales',
    REVENUE: 'revenue',
    PRODUCTS: 'products',
    CUSTOMERS: 'customers',
    PAYMENT_METHODS: 'payment_methods',
    TAX: 'tax',
    INVENTORY: 'inventory',
    ALL: 'all',
  },

  EXPORT_STATUSES: {
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    SCHEDULED: 'scheduled',
  },

  // ============================================
  // DATE RANGES (New)
  // ============================================
  DATE_RANGES: {
    TODAY: 'today',
    YESTERDAY: 'yesterday',
    THIS_WEEK: 'this_week',
    LAST_WEEK: 'last_week',
    THIS_MONTH: 'this_month',
    LAST_MONTH: 'last_month',
    THIS_QUARTER: 'this_quarter',
    LAST_QUARTER: 'last_quarter',
    THIS_YEAR: 'this_year',
    CUSTOM: 'custom',
  },

  // ============================================
  // GROUP BY OPTIONS (New)
  // ============================================
  GROUP_BY: {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    QUARTER: 'quarter',
    YEAR: 'year',
    HOUR: 'hour',
  },

  // ============================================
  // NOTIFICATION TYPES (New)
  // ============================================
  NOTIFICATION_TYPES: {
    SALE: 'SALE',
    INVENTORY: 'INVENTORY',
    ORDER: 'ORDER',
    PAYMENT: 'PAYMENT',
    CUSTOMER: 'CUSTOMER',
    SYSTEM: 'SYSTEM',
    ALERT: 'ALERT',
    SUCCESS: 'SUCCESS',
    INFO: 'INFO',
    WARNING: 'WARNING',
    ERROR: 'ERROR',
    PROMOTION: 'PROMOTION',
    REMINDER: 'REMINDER',
  },

  NOTIFICATION_PRIORITIES: {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT',
  },

  // ============================================
  // CURRENCIES (New)
  // ============================================
  CURRENCIES: {
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    NGN: 'NGN',
    KES: 'KES',
    ZAR: 'ZAR',
    GHS: 'GHS',
    UGX: 'UGX',
    TZS: 'TZS',
  },

  // ============================================
  // COLOR CONFIGURATIONS
  // ============================================
  STATUS_COLORS: {
    // Sale statuses
    PENDING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    PROCESSING: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    REFUNDED: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    ON_HOLD: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    
    // Return statuses
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    approved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    processed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    
    // Invoice statuses
    draft: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    paid: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    void: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    
    // Receipt statuses
    issued: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    printed: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  },

  PAYMENT_METHOD_COLORS: {
    CASH: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    CREDIT_CARD: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    DEBIT_CARD: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    MOBILE_MONEY: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    BANK_TRANSFER: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    GIFT_CARD: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
    LOYALTY_POINTS: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    CRYPTO: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
    CHECK: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  },

  // ============================================
  // LABELS
  // ============================================
  STATUS_LABELS: {
    PENDING: 'Pending',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
    ON_HOLD: 'On Hold',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    PROCESSED: 'Processed',
    DRAFT: 'Draft',
    SENT: 'Sent',
    PAID: 'Paid',
    OVERDUE: 'Overdue',
    VOID: 'Void',
    ISSUED: 'Issued',
    PRINTED: 'Printed',
  },

  PAYMENT_METHOD_LABELS: {
    CASH: 'Cash',
    CREDIT_CARD: 'Credit Card',
    DEBIT_CARD: 'Debit Card',
    MOBILE_MONEY: 'Mobile Money',
    BANK_TRANSFER: 'Bank Transfer',
    GIFT_CARD: 'Gift Card',
    LOYALTY_POINTS: 'Loyalty Points',
    CRYPTO: 'Cryptocurrency',
    CHECK: 'Check',
  },

  // ============================================
  // DATE & TIME CONSTANTS
  // ============================================
  DATE_RANGES_LABELS: {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    last_week: 'Last Week',
    this_month: 'This Month',
    last_month: 'Last Month',
    this_quarter: 'This Quarter',
    last_quarter: 'Last Quarter',
    this_year: 'This Year',
    custom: 'Custom Range',
  },

  // ============================================
  // TAX & CURRENCY CONSTANTS
  // ============================================
  TAX_RATE: 0.08,
  LOYALTY_POINTS_PER_DOLLAR: 10,

  // ============================================
  // SALE SETTINGS DEFAULTS
  // ============================================
  SALE_SETTINGS: {
    defaultTaxRate: 8,
    defaultDiscount: 0,
    maxDiscount: 20,
    autoPrintReceipt: true,
    emailReceipts: true,
    defaultPaymentMethod: 'CASH',
    receiptFooter: 'Thank you for your business!',
    invoicePrefix: 'INV-',
    receiptPrefix: 'RCP-',
  },
};

// ============================================
// EXPORT INDIVIDUAL CONSTANTS FOR EASY IMPORT
// ============================================
export const {
  APP_NAME,
  APP_VERSION,
  API_URL,
  TOKEN_KEY,
  USER_KEY,
  CURRENCY,
  CURRENCY_SYMBOL,
  DATE_FORMAT,
  TIME_FORMAT,
  DATE_TIME_FORMAT,
  PAGINATION,
  FILE_UPLOAD,
  USER_ROLES,
  ORDER_STATUSES,
  SALE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  INVENTORY_TRANSACTION_TYPES,
  RETURN_STATUSES,
  RETURN_TYPES,
  REFUND_STATUSES,
  REFUND_METHODS,
  INVOICE_STATUSES,
  INVOICE_PAYMENT_TERMS,
  RECEIPT_STATUSES,
  RECEIPT_TYPES,
  SHIFT_STATUSES,
  SHIFT_TYPES,
  CASH_REGISTER_STATUSES,
  CASH_TRANSACTION_TYPES,
  REPORT_TYPES,
  REPORT_FORMATS,
  REPORT_DATE_RANGES,
  EXPORT_FORMATS,
  EXPORT_TYPES,
  EXPORT_STATUSES,
  DATE_RANGES,
  GROUP_BY,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  CURRENCIES,
  STATUS_COLORS,
  PAYMENT_METHOD_COLORS,
  STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  DATE_RANGES_LABELS,
  TAX_RATE,
  LOYALTY_POINTS_PER_DOLLAR,
  SALE_SETTINGS,
} = constants;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get status color for a given status
 */
export const getStatusColor = (status: string): string => {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

/**
 * Get payment method color for a given method
 */
export const getPaymentMethodColor = (method: string): string => {
  return PAYMENT_METHOD_COLORS[method as keyof typeof PAYMENT_METHOD_COLORS] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

/**
 * Get status label for a given status
 */
export const getStatusLabel = (status: string): string => {
  return STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status;
};

/**
 * Get payment method label for a given method
 */
export const getPaymentMethodLabel = (method: string): string => {
  return PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] || method;
};

/**
 * Get date range label for a given range
 */
export const getDateRangeLabel = (range: string): string => {
  return DATE_RANGES_LABELS[range as keyof typeof DATE_RANGES_LABELS] || range;
};

/**
 * Check if a status is a sale status
 */
export const isSaleStatus = (status: string): boolean => {
  return Object.values(SALE_STATUSES).includes(status as any);
};

/**
 * Check if a status is a return status
 */
export const isReturnStatus = (status: string): boolean => {
  return Object.values(RETURN_STATUSES).includes(status as any);
};

/**
 * Check if a status is a refund status
 */
export const isRefundStatus = (status: string): boolean => {
  return Object.values(REFUND_STATUSES).includes(status as any);
};

/**
 * Check if a status is an invoice status
 */
export const isInvoiceStatus = (status: string): boolean => {
  return Object.values(INVOICE_STATUSES).includes(status as any);
};

/**
 * Check if a status is a receipt status
 */
export const isReceiptStatus = (status: string): boolean => {
  return Object.values(RECEIPT_STATUSES).includes(status as any);
};

/**
 * Get all payment methods as an array
 */
export const getPaymentMethodsArray = (): string[] => {
  return Object.values(PAYMENT_METHODS);
};

/**
 * Get all sale statuses as an array
 */
export const getSaleStatusesArray = (): string[] => {
  return Object.values(SALE_STATUSES);
};

/**
 * Get all return statuses as an array
 */
export const getReturnStatusesArray = (): string[] => {
  return Object.values(RETURN_STATUSES);
};

/**
 * Get all refund statuses as an array
 */
export const getRefundStatusesArray = (): string[] => {
  return Object.values(REFUND_STATUSES);
};

/**
 * Get all invoice statuses as an array
 */
export const getInvoiceStatusesArray = (): string[] => {
  return Object.values(INVOICE_STATUSES);
};

/**
 * Get all receipt statuses as an array
 */
export const getReceiptStatusesArray = (): string[] => {
  return Object.values(RECEIPT_STATUSES);
};

export default constants;
