// D:\Projects\Kalwanga\packages\web\types\enums.ts

// ============================================
// USER & AUTH ENUMS
// ============================================
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
  EMPLOYEE = 'EMPLOYEE',
  CASHIER = 'CASHIER',
  USER = 'USER'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended'
}

export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage',
  VIEW = 'view',
  EXPORT = 'export',
  IMPORT = 'import',
  PRINT = 'print',
  EMAIL = 'email',
  APPROVE = 'approve',
  REJECT = 'reject',
  PROCESS = 'process',
  COMPLETE = 'complete',
  CANCEL = 'cancel',
  VOID = 'void',
  HOLD = 'hold',
  RESUME = 'resume',
  ADJUST = 'adjust',
  TRANSFER = 'transfer',
  SHARE = 'share',
  CHECKOUT = 'checkout',
  VIEW_HISTORY = 'view_history'
}

// ============================================
// PERMISSION RESOURCES
// ============================================
export enum PermissionResource {
  CATEGORY = 'category',
  PRODUCT = 'product',
  ORDER = 'order',
  CUSTOMER = 'customer',
  INVENTORY = 'inventory',
  USER = 'user',
  REPORT = 'report',
  SETTINGS = 'settings',
  DASHBOARD = 'dashboard',
  PROMOTION = 'promotion',
  SUPPLIER = 'supplier',
  PAYMENT = 'payment',
  SHIFT = 'shift',
  REGISTER = 'register',
  BOOKKEEPING = 'bookkeeping',
  // Sales specific resources
  SALE = 'sale',
  RETURN = 'return',
  REFUND = 'refund',
  INVOICE = 'invoice',
  RECEIPT = 'receipt',
  POS = 'pos',
  ANALYTICS = 'analytics',
  CASH_REGISTER = 'cash_register',
  // Additional resources
  BRAND = 'brand',
  TAG = 'tag',
  LOYALTY = 'loyalty',
  STOCK = 'stock',
  WAREHOUSE = 'warehouse',
  COMPANY = 'company',
  BUSINESS_UNIT = 'business_unit',
  SHIPPING = 'shipping',
  NOTIFICATION = 'notification',
  INTEGRATION = 'integration',
  API = 'api',
  WEBHOOK = 'webhook',
  // ✅ ADDED: Cart permissions
  CART = 'cart',
  CART_VIEW = 'cart:view',
  CART_MANAGE = 'cart:manage',
  CART_CHECKOUT = 'cart:checkout',
  CART_VIEW_HISTORY = 'cart:view_history',
  CART_SETTINGS = 'cart:settings'
}

// ============================================
// ORDER & SALE ENUMS
// ============================================
export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  ON_HOLD = 'ON_HOLD',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED'
}

export enum OrderType {
  ONLINE = 'ONLINE',
  IN_STORE = 'IN_STORE',
  PHONE = 'PHONE',
  WHOLESALE = 'WHOLESALE'
}

export enum SaleStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
  ON_HOLD = 'ON_HOLD'
}

export enum SaleType {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
  ONLINE = 'ONLINE',
  IN_STORE = 'IN_STORE'
}

// ============================================
// RETURN & REFUND ENUMS
// ============================================
export enum ReturnStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PROCESSED = 'processed',
  CANCELLED = 'cancelled'
}

export enum ReturnType {
  FULL = 'full',
  PARTIAL = 'partial'
}

export enum RefundStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum RefundMethod {
  CASH = 'cash',
  CREDIT = 'credit',
  STORE_CREDIT = 'store_credit',
  ORIGINAL_PAYMENT = 'original_payment',
  BANK_TRANSFER = 'bank_transfer'
}

// ============================================
// INVOICE & RECEIPT ENUMS
// ============================================
export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
  VOID = 'void',
  PARTIALLY_PAID = 'partially_paid'
}

export enum InvoicePaymentTerms {
  NET_7 = 'net_7',
  NET_15 = 'net_15',
  NET_30 = 'net_30',
  NET_60 = 'net_60',
  DUE_ON_RECEIPT = 'due_on_receipt'
}

export enum ReceiptStatus {
  ISSUED = 'issued',
  SENT = 'sent',
  PRINTED = 'printed',
  CANCELLED = 'cancelled',
  VOID = 'void'
}

export enum ReceiptType {
  SALE = 'sale',
  REFUND = 'refund',
  RETURN = 'return'
}

export enum ReceiptFormat {
  PDF = 'PDF',
  HTML = 'HTML',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE'
}

// ============================================
// PAYMENT ENUMS
// ============================================
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIAL = 'PARTIAL',
  PROCESSING = 'PROCESSING',
  AUTHORIZED = 'AUTHORIZED',
  DECLINED = 'DECLINED'
}

export enum PaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  MOBILE_MONEY = 'MOBILE_MONEY',
  BANK_TRANSFER = 'BANK_TRANSFER',
  GIFT_CARD = 'GIFT_CARD',
  LOYALTY_POINTS = 'LOYALTY_POINTS',
  CRYPTO = 'CRYPTO',
  CHECK = 'CHECK'
}

export enum PaymentGateway {
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  FLUTTERWAVE = 'FLUTTERWAVE',
  PAYSTACK = 'PAYSTACK',
  SQUARE = 'SQUARE',
  RAZORPAY = 'RAZORPAY'
}

// ============================================
// CASH REGISTER & SHIFT ENUMS
// ============================================
export enum CashRegisterStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED'
}

export enum CashTransactionType {
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
  SALE = 'SALE',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL'
}

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  VOID = 'VOID',
  PENDING = 'PENDING'
}

export enum ShiftType {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  NIGHT = 'NIGHT',
  WEEKEND = 'WEEKEND'
}

// ============================================
// INVENTORY ENUMS
// ============================================
export enum InventoryTransactionType {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  ISSUE = 'ISSUE',
  INITIAL = 'INITIAL',
  ADJUSTMENT_IN = 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT = 'ADJUSTMENT_OUT',
  DAMAGED = 'DAMAGED',
  LOST = 'LOST',
  RESTOCK = 'RESTOCK'
}

export enum InventoryIssueStatus {
  ISSUED = 'ISSUED',
  RETURNED = 'RETURNED',
  OVERDUE = 'OVERDUE',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED'
}

export enum InventoryTransferStatus {
  PENDING = 'PENDING',
  IN_TRANSIT = 'IN_TRANSIT',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED'
}

// ============================================
// BOOKKEEPING ENUMS
// ============================================
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

export enum AccountCategory {
  CASH = 'CASH',
  ACCOUNTS_RECEIVABLE = 'ACCOUNTS_RECEIVABLE',
  INVENTORY = 'INVENTORY',
  SALES_REVENUE = 'SALES_REVENUE',
  SALES_TAX_PAYABLE = 'SALES_TAX_PAYABLE',
  COST_OF_GOODS_SOLD = 'COST_OF_GOODS_SOLD',
  OPERATING_EXPENSE = 'OPERATING_EXPENSE',
  OWNER_EQUITY = 'OWNER_EQUITY',
  RETAINED_EARNINGS = 'RETAINED_EARNINGS',
  ACCOUNTS_PAYABLE = 'ACCOUNTS_PAYABLE',
  FIXED_ASSETS = 'FIXED_ASSETS',
  DEPRECIATION = 'DEPRECIATION',
  PAYROLL = 'PAYROLL',
  INSURANCE = 'INSURANCE',
  UTILITIES = 'UTILITIES',
  RENT = 'RENT'
}

export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  VOID = 'VOID',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum TaxFilingStatus {
  PENDING = 'PENDING',
  FILED = 'FILED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  AUDITED = 'AUDITED'
}

// ============================================
// PURCHASE ORDER ENUMS
// ============================================
export enum PurchaseOrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ORDERED = 'ORDERED',
  PARTIALLY_RECEIVED = 'PARTIALLY_RECEIVED',
  RECEIVED = 'RECEIVED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED'
}

// ============================================
// REPORT ENUMS
// ============================================
export enum ReportType {
  BALANCE_SHEET = 'BALANCE_SHEET',
  INCOME_STATEMENT = 'INCOME_STATEMENT',
  CASH_FLOW = 'CASH_FLOW',
  TAX_SUMMARY = 'TAX_SUMMARY',
  SALES_REPORT = 'SALES_REPORT',
  INVENTORY_REPORT = 'INVENTORY_REPORT',
  CUSTOMER_REPORT = 'CUSTOMER_REPORT',
  PRODUCT_REPORT = 'PRODUCT_REPORT',
  EMPLOYEE_REPORT = 'EMPLOYEE_REPORT',
  PAYMENT_REPORT = 'PAYMENT_REPORT',
  SUPPLIER_REPORT = 'SUPPLIER_REPORT',
  PURCHASE_ORDER_REPORT = 'PURCHASE_ORDER_REPORT',
  PROFIT_AND_LOSS = 'PROFIT_AND_LOSS',
  AGING_REPORT = 'AGING_REPORT',
  COMPREHENSIVE = 'COMPREHENSIVE'
}

export enum ReportFormat {
  PDF = 'PDF',
  CSV = 'CSV',
  EXCEL = 'EXCEL',
  JSON = 'JSON',
  HTML = 'HTML'
}

export enum ReportDateRange {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_QUARTER = 'this_quarter',
  LAST_QUARTER = 'last_quarter',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom'
}

// ============================================
// NOTIFICATION ENUMS
// ============================================
export enum NotificationType {
  SALE = 'SALE',
  INVENTORY = 'INVENTORY',
  ORDER = 'ORDER',
  PAYMENT = 'PAYMENT',
  CUSTOMER = 'CUSTOMER',
  SYSTEM = 'SYSTEM',
  ALERT = 'ALERT',
  SUCCESS = 'SUCCESS',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  PROMOTION = 'PROMOTION',
  REMINDER = 'REMINDER'
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

// ============================================
// PROMOTION ENUMS
// ============================================
export enum PromotionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
  BUY_X_GET_Y = 'BUY_X_GET_Y',
  FREE_SHIPPING = 'FREE_SHIPPING',
  BOGO = 'BOGO',
  BUNDLE = 'BUNDLE',
  TIERED = 'TIERED'
}

export enum PromotionStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PAUSED = 'PAUSED',
  ENDED = 'ENDED'
}

// ============================================
// CUSTOMER ENUMS
// ============================================
export enum CustomerType {
  INDIVIDUAL = 'INDIVIDUAL',
  BUSINESS = 'BUSINESS',
  WHOLESALE = 'WHOLESALE',
  RETAIL = 'RETAIL'
}

export enum LoyaltyLevel {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND'
}

// ============================================
// PRODUCT ENUMS
// ============================================
export enum ProductStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DISCONTINUED = 'DISCONTINUED'
}

export enum ProductType {
  SIMPLE = 'SIMPLE',
  VARIABLE = 'VARIABLE',
  GROUPED = 'GROUPED',
  BUNDLE = 'BUNDLE',
  DIGITAL = 'DIGITAL',
  SERVICE = 'SERVICE'
}

export enum TaxType {
  INCLUSIVE = 'INCLUSIVE',
  EXCLUSIVE = 'EXCLUSIVE',
  EXEMPT = 'EXEMPT'
}

// ============================================
// SUPPLIER ENUMS
// ============================================
export enum SupplierStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  BLACKLISTED = 'BLACKLISTED'
}

// ============================================
// BUSINESS UNIT ENUMS
// ============================================
export enum BusinessUnitType {
  HEADQUARTERS = 'HEADQUARTERS',
  BRANCH = 'BRANCH',
  WAREHOUSE = 'WAREHOUSE',
  STORE = 'STORE'
}

// ============================================
// AUDIT ENUMS
// ============================================
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  IMPORT = 'IMPORT',
  DOWNLOAD = 'DOWNLOAD',
  APPROVE = 'APPROVE',
  REJECT = 'REJECT'
}

export enum AuditSeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// ============================================
// REVIEW ENUMS
// ============================================
export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FLAGGED = 'FLAGGED'
}

// ============================================
// WISHLIST ENUMS
// ============================================
export enum WishlistStatus {
  ACTIVE = 'ACTIVE',
  REMOVED = 'REMOVED'
}

export enum WishlistVisibility {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE'
}

// ============================================
// REPORT STATUS ENUMS
// ============================================
export enum ReportStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED'
}

// ============================================
// EXPORT ENUMS
// ============================================
export enum ExportFormat {
  CSV = 'CSV',
  EXCEL = 'EXCEL',
  JSON = 'JSON',
  PDF = 'PDF',
  XML = 'XML'
}

export enum ExportStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SCHEDULED = 'scheduled'
}

// ============================================
// SORT ENUMS
// ============================================
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

export enum ProductSortField {
  NAME = 'name',
  PRICE = 'unitPrice',
  CREATED_AT = 'createdAt',
  RATING = 'rating',
  POPULARITY = 'popularity',
  SKU = 'sku'
}

// ============================================
// FILTER ENUMS
// ============================================
export enum ProductFilter {
  IN_STOCK = 'inStock',
  LOW_STOCK = 'lowStock',
  OUT_OF_STOCK = 'outOfStock',
  FEATURED = 'featured',
  DIGITAL = 'digital',
  PHYSICAL = 'physical'
}

// ============================================
// DATE RANGE ENUMS
// ============================================
export enum DateRange {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_QUARTER = 'this_quarter',
  LAST_QUARTER = 'last_quarter',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom'
}

// ============================================
// GROUP BY ENUMS
// ============================================
export enum GroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  HOUR = 'hour'
}

// ============================================
// CURRENCY ENUMS
// ============================================
export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  NGN = 'NGN',
  KES = 'KES',
  ZAR = 'ZAR',
  GHS = 'GHS',
  UGX = 'UGX',
  TZS = 'TZS'
}

// ============================================
// LANGUAGE ENUMS
// ============================================
export enum Language {
  EN = 'en',
  FR = 'fr',
  ES = 'es',
  PT = 'pt',
  AR = 'ar',
  ZH = 'zh',
  HI = 'hi',
  SW = 'sw'
}

// ============================================
// TIMEZONE ENUMS
// ============================================
export enum Timezone {
  UTC = 'UTC',
  EST = 'EST',
  PST = 'PST',
  GMT = 'GMT',
  CET = 'CET',
  EAT = 'EAT',
  WAT = 'WAT',
  CAT = 'CAT',
  SAST = 'SAST'
}

// ============================================
// BARCODE & QR CODE ENUMS
// ============================================
export enum BarcodeFormat {
  EAN13 = 'EAN13',
  CODE128 = 'CODE128',
  QR = 'QR',
}

export enum BarcodeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  EXPIRED = 'EXPIRED',
}

export enum QRCodeType {
  PRODUCT = 'PRODUCT',
  VARIANT = 'VARIANT',
  SALE = 'SALE',
  RECEIPT = 'RECEIPT',
  PROMOTION = 'PROMOTION',
}

// ============================================
// CART ENUMS
// ============================================
export enum CartStatus {
  ACTIVE = 'ACTIVE',
  SAVED = 'SAVED',
  CHECKED_OUT = 'CHECKED_OUT',
  ABANDONED = 'ABANDONED'
}

export enum CartDiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED'
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get all enum values as an array
 */
export const getEnumValues = <T>(enumObj: T): string[] => {
  return Object.values(enumObj as any).filter(v => typeof v === 'string') as string[];
};

/**
 * Get enum label from value
 */
export const getEnumLabel = (enumObj: any, value: string): string => {
  const entry = Object.entries(enumObj).find(([_, v]) => v === value);
  return entry ? entry[0] : value;
};

/**
 * Check if value is a valid enum value
 */
export const isValidEnumValue = <T>(enumObj: T, value: string): boolean => {
  return Object.values(enumObj as any).includes(value);
};

/**
 * Get enum options for select dropdowns
 */
export const getEnumOptions = (enumObj: any): Array<{ value: string; label: string }> => {
  return Object.entries(enumObj)
    .filter(([key]) => isNaN(Number(key)))
    .map(([key, value]) => ({
      value: value as string,
      label: key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1).toLowerCase()
    }));
};

/**
 * Get enum options with custom labels
 */
export const getEnumOptionsWithLabels = (
  enumObj: any,
  labels: Record<string, string>
): Array<{ value: string; label: string }> => {
  return Object.entries(enumObj)
    .filter(([key]) => isNaN(Number(key)))
    .map(([key, value]) => ({
      value: value as string,
      label: labels[key] || key.replace(/_/g, ' ').charAt(0).toUpperCase() + key.replace(/_/g, ' ').slice(1).toLowerCase()
    }));
};

// ============================================
// EXPORT ENUMS CONSTANTS
// ============================================

// Export all enums as constants for easy access
export const ENUMS = {
  UserRole,
  UserStatus,
  PermissionAction,
  PermissionResource,
  OrderStatus,
  OrderType,
  SaleStatus,
  SaleType,
  ReturnStatus,
  ReturnType,
  RefundStatus,
  RefundMethod,
  InvoiceStatus,
  InvoicePaymentTerms,
  ReceiptStatus,
  ReceiptType,
  ReceiptFormat,
  PaymentStatus,
  PaymentMethod,
  PaymentGateway,
  CashRegisterStatus,
  CashTransactionType,
  ShiftStatus,
  ShiftType,
  InventoryTransactionType,
  InventoryIssueStatus,
  InventoryTransferStatus,
  AccountType,
  AccountCategory,
  JournalEntryStatus,
  TaxFilingStatus,
  PurchaseOrderStatus,
  ReportType,
  ReportFormat,
  ReportDateRange,
  NotificationType,
  NotificationPriority,
  PromotionType,
  PromotionStatus,
  CustomerType,
  LoyaltyLevel,
  ProductStatus,
  ProductType,
  TaxType,
  SupplierStatus,
  BusinessUnitType,
  AuditAction,
  AuditSeverity,
  ReviewStatus,
  WishlistStatus,
  WishlistVisibility,
  ReportStatus,
  ExportFormat,
  ExportStatus,
  SortOrder,
  ProductSortField,
  ProductFilter,
  DateRange,
  GroupBy,
  Currency,
  Language,
  Timezone,
  BarcodeFormat,
  BarcodeStatus,
  QRCodeType,
  // ✅ ADDED: Cart enums
  CartStatus,
  CartDiscountType
};

export default ENUMS;
