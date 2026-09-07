// D:\Projects\Kalwanga\packages\web\types\permissions.ts

import { UserRole } from './enums';

// ============================================
// PERMISSIONS DEFINITION
// ============================================

export const PERMISSIONS = {
  // ============================================
  // USER MANAGEMENT PERMISSIONS
  // ============================================
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  USER_ACTIVATE: 'user:activate',
  USER_DEACTIVATE: 'user:deactivate',
  USER_ROLE_UPDATE: 'user:role:update',
  USER_PERMISSION_UPDATE: 'user:permission:update',
  USER_BULK_ACTIVATE: 'user:bulk:activate',
  USER_BULK_DEACTIVATE: 'user:bulk:deactivate',
  USER_BULK_DELETE: 'user:bulk:delete',
  USER_EXPORT: 'user:export',

  // ============================================
  // CATEGORY PERMISSIONS
  // ============================================
  CATEGORY_VIEW: 'category:view',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_EDIT: 'category:edit',
  CATEGORY_DELETE: 'category:delete',
  CATEGORY_MANAGE: 'category:manage',
  
  // ============================================
  // PRODUCT PERMISSIONS
  // ============================================
  PRODUCT_VIEW: 'product:view',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_EDIT: 'product:edit',
  PRODUCT_DELETE: 'product:delete',
  PRODUCT_MANAGE: 'product:manage',
  PRODUCT_EXPORT: 'product:export',
  PRODUCT_IMPORT: 'product:import',
  
  // ============================================
  // SUPPLIER PERMISSIONS
  // ============================================
  SUPPLIER_VIEW: 'supplier:view',
  SUPPLIER_CREATE: 'supplier:create',
  SUPPLIER_EDIT: 'supplier:edit',
  SUPPLIER_DELETE: 'supplier:delete',
  SUPPLIER_MANAGE: 'supplier:manage',
  
  // ============================================
  // ORDER PERMISSIONS
  // ============================================
  ORDER_VIEW: 'order:view',
  ORDER_CREATE: 'order:create',
  ORDER_EDIT: 'order:edit',
  ORDER_DELETE: 'order:delete',
  ORDER_MANAGE: 'order:manage',
  ORDER_PROCESS: 'order:process',
  ORDER_CANCEL: 'order:cancel',
  
  // ============================================
  // CUSTOMER PERMISSIONS
  // ============================================
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_EDIT: 'customer:edit',
  CUSTOMER_DELETE: 'customer:delete',
  CUSTOMER_MANAGE: 'customer:manage',
  
  // ============================================
  // INVENTORY PERMISSIONS
  // ============================================
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_TRANSFER: 'inventory:transfer',
  
  // ============================================
  // REPORT PERMISSIONS
  // ============================================
  REPORT_VIEW: 'report:view',
  REPORT_CREATE: 'report:create',
  REPORT_EXPORT: 'report:export',
  REPORT_MANAGE: 'report:manage',
  
  // ============================================
  // ANALYTICS PERMISSIONS
  // ============================================
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',
  
  // ============================================
  // SETTINGS PERMISSIONS
  // ============================================
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  SETTINGS_MANAGE: 'settings:manage',
  
  // ============================================
  // SYSTEM PERMISSIONS
  // ============================================
  SYSTEM_LOGS: 'system:logs',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  SYSTEM_SETTINGS: 'system:settings',
  
  // ============================================
  // BUSINESS UNIT PERMISSIONS
  // ============================================
  BUSINESS_UNIT_VIEW: 'business_unit:view',
  BUSINESS_UNIT_CREATE: 'business_unit:create',
  BUSINESS_UNIT_EDIT: 'business_unit:edit',
  BUSINESS_UNIT_DELETE: 'business_unit:delete',
  BUSINESS_UNIT_MANAGE: 'business_unit:manage',
  
  // ============================================
  // SALES PERMISSIONS
  // ============================================
  SALE_VIEW: 'sale:view',
  SALE_CREATE: 'sale:create',
  SALE_EDIT: 'sale:edit',
  SALE_DELETE: 'sale:delete',
  SALE_MANAGE: 'sale:manage',
  SALE_EXPORT: 'sale:export',
  SALE_PRINT: 'sale:print',
  SALE_EMAIL: 'sale:email',
  
  // ============================================
  // POS PERMISSIONS
  // ============================================
  POS_VIEW: 'pos:view',
  POS_CREATE: 'pos:create',
  POS_MANAGE: 'pos:manage',
  POS_PRINT: 'pos:print',
  
  // ============================================
  // CASH REGISTER PERMISSIONS
  // ============================================
  CASH_REGISTER_VIEW: 'cash_register:view',
  CASH_REGISTER_MANAGE: 'cash_register:manage',
  CASH_REGISTER_OPEN: 'cash_register:open',
  CASH_REGISTER_CLOSE: 'cash_register:close',
  
  // ============================================
  // SHIFT PERMISSIONS
  // ============================================
  SHIFT_VIEW: 'shift:view',
  SHIFT_MANAGE: 'shift:manage',
  SHIFT_START: 'shift:start',
  SHIFT_END: 'shift:end',
  
  // ============================================
  // RETURN PERMISSIONS
  // ============================================
  RETURN_VIEW: 'return:view',
  RETURN_CREATE: 'return:create',
  RETURN_EDIT: 'return:edit',
  RETURN_DELETE: 'return:delete',
  RETURN_MANAGE: 'return:manage',
  RETURN_APPROVE: 'return:approve',
  RETURN_REJECT: 'return:reject',
  RETURN_PROCESS: 'return:process',
  
  // ============================================
  // REFUND PERMISSIONS
  // ============================================
  REFUND_VIEW: 'refund:view',
  REFUND_CREATE: 'refund:create',
  REFUND_EDIT: 'refund:edit',
  REFUND_DELETE: 'refund:delete',
  REFUND_MANAGE: 'refund:manage',
  REFUND_APPROVE: 'refund:approve',
  REFUND_REJECT: 'refund:reject',
  REFUND_COMPLETE: 'refund:complete',
  
  // ============================================
  // INVOICE PERMISSIONS
  // ============================================
  INVOICE_VIEW: 'invoice:view',
  INVOICE_CREATE: 'invoice:create',
  INVOICE_EDIT: 'invoice:edit',
  INVOICE_DELETE: 'invoice:delete',
  INVOICE_MANAGE: 'invoice:manage',
  INVOICE_SEND: 'invoice:send',
  INVOICE_PRINT: 'invoice:print',
  INVOICE_PAID: 'invoice:paid',
  INVOICE_VOID: 'invoice:void',
  INVOICE_CANCEL: 'invoice:cancel',
  
  // ============================================
  // RECEIPT PERMISSIONS
  // ============================================
  RECEIPT_VIEW: 'receipt:view',
  RECEIPT_CREATE: 'receipt:create',
  RECEIPT_EDIT: 'receipt:edit',
  RECEIPT_DELETE: 'receipt:delete',
  RECEIPT_MANAGE: 'receipt:manage',
  RECEIPT_PRINT: 'receipt:print',
  RECEIPT_EMAIL: 'receipt:email',
  RECEIPT_VOID: 'receipt:void',
  
  // ============================================
  // PAYMENT PERMISSIONS
  // ============================================
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_MANAGE: 'payment:manage',
  PAYMENT_REFUND: 'payment:refund',
  
  // ============================================
  // DASHBOARD PERMISSIONS
  // ============================================
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_MANAGE: 'dashboard:manage',
  
  // ============================================
  // INTEGRATION PERMISSIONS
  // ============================================
  INTEGRATION_VIEW: 'integration:view',
  INTEGRATION_MANAGE: 'integration:manage',
  API_VIEW: 'api:view',
  API_MANAGE: 'api:manage',
  WEBHOOK_VIEW: 'webhook:view',
  WEBHOOK_MANAGE: 'webhook:manage',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ============================================
// ROLE PERMISSIONS MAPPING
// ============================================

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    // User Management
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.USER_ROLE_UPDATE,
    PERMISSIONS.USER_PERMISSION_UPDATE,
    PERMISSIONS.USER_BULK_ACTIVATE,
    PERMISSIONS.USER_BULK_DEACTIVATE,
    PERMISSIONS.USER_BULK_DELETE,
    PERMISSIONS.USER_EXPORT,
    
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    PERMISSIONS.CATEGORY_DELETE,
    PERMISSIONS.CATEGORY_MANAGE,
    
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PRODUCT_MANAGE,
    PERMISSIONS.PRODUCT_EXPORT,
    PERMISSIONS.PRODUCT_IMPORT,
    
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    PERMISSIONS.SUPPLIER_DELETE,
    PERMISSIONS.SUPPLIER_MANAGE,
    
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_DELETE,
    PERMISSIONS.ORDER_MANAGE,
    PERMISSIONS.ORDER_PROCESS,
    PERMISSIONS.ORDER_CANCEL,
    
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.CUSTOMER_MANAGE,
    
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    
    // Report
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.REPORT_MANAGE,
    
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.SETTINGS_MANAGE,
    
    // System
    PERMISSIONS.SYSTEM_LOGS,
    PERMISSIONS.SYSTEM_BACKUP,
    PERMISSIONS.SYSTEM_RESTORE,
    PERMISSIONS.SYSTEM_SETTINGS,
    
    // Business Unit
    PERMISSIONS.BUSINESS_UNIT_VIEW,
    PERMISSIONS.BUSINESS_UNIT_CREATE,
    PERMISSIONS.BUSINESS_UNIT_EDIT,
    PERMISSIONS.BUSINESS_UNIT_DELETE,
    PERMISSIONS.BUSINESS_UNIT_MANAGE,
    
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_DELETE,
    PERMISSIONS.SALE_MANAGE,
    PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_MANAGE,
    PERMISSIONS.POS_PRINT,
    
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_MANAGE,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_MANAGE,
    PERMISSIONS.SHIFT_START,
    PERMISSIONS.SHIFT_END,
    
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    PERMISSIONS.RETURN_DELETE,
    PERMISSIONS.RETURN_MANAGE,
    PERMISSIONS.RETURN_APPROVE,
    PERMISSIONS.RETURN_REJECT,
    PERMISSIONS.RETURN_PROCESS,
    
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    PERMISSIONS.REFUND_DELETE,
    PERMISSIONS.REFUND_MANAGE,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_REJECT,
    PERMISSIONS.REFUND_COMPLETE,
    
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_DELETE,
    PERMISSIONS.INVOICE_MANAGE,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    PERMISSIONS.INVOICE_PAID,
    PERMISSIONS.INVOICE_VOID,
    PERMISSIONS.INVOICE_CANCEL,
    
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT,
    PERMISSIONS.RECEIPT_DELETE,
    PERMISSIONS.RECEIPT_MANAGE,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    PERMISSIONS.RECEIPT_VOID,
    
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_MANAGE,
    PERMISSIONS.PAYMENT_REFUND,
    
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_MANAGE,
    
    // Integration
    PERMISSIONS.INTEGRATION_VIEW,
    PERMISSIONS.INTEGRATION_MANAGE,
    PERMISSIONS.API_VIEW,
    PERMISSIONS.API_MANAGE,
    PERMISSIONS.WEBHOOK_VIEW,
    PERMISSIONS.WEBHOOK_MANAGE,
  ],
  
  [UserRole.ADMIN]: [
    // User Management
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.USER_ROLE_UPDATE,
    PERMISSIONS.USER_PERMISSION_UPDATE,
    PERMISSIONS.USER_BULK_ACTIVATE,
    PERMISSIONS.USER_BULK_DEACTIVATE,
    PERMISSIONS.USER_BULK_DELETE,
    PERMISSIONS.USER_EXPORT,
    
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    PERMISSIONS.CATEGORY_DELETE,
    PERMISSIONS.CATEGORY_MANAGE,
    
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PRODUCT_MANAGE,
    PERMISSIONS.PRODUCT_EXPORT,
    PERMISSIONS.PRODUCT_IMPORT,
    
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    PERMISSIONS.SUPPLIER_DELETE,
    PERMISSIONS.SUPPLIER_MANAGE,
    
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_DELETE,
    PERMISSIONS.ORDER_MANAGE,
    PERMISSIONS.ORDER_PROCESS,
    PERMISSIONS.ORDER_CANCEL,
    
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.CUSTOMER_MANAGE,
    
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    
    // Report
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.REPORT_MANAGE,
    
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.SETTINGS_MANAGE,
    
    // Business Unit
    PERMISSIONS.BUSINESS_UNIT_VIEW,
    PERMISSIONS.BUSINESS_UNIT_CREATE,
    PERMISSIONS.BUSINESS_UNIT_EDIT,
    PERMISSIONS.BUSINESS_UNIT_DELETE,
    PERMISSIONS.BUSINESS_UNIT_MANAGE,
    
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_DELETE,
    PERMISSIONS.SALE_MANAGE,
    PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_MANAGE,
    PERMISSIONS.POS_PRINT,
    
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_MANAGE,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_MANAGE,
    PERMISSIONS.SHIFT_START,
    PERMISSIONS.SHIFT_END,
    
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    PERMISSIONS.RETURN_DELETE,
    PERMISSIONS.RETURN_MANAGE,
    PERMISSIONS.RETURN_APPROVE,
    PERMISSIONS.RETURN_REJECT,
    PERMISSIONS.RETURN_PROCESS,
    
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    PERMISSIONS.REFUND_DELETE,
    PERMISSIONS.REFUND_MANAGE,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_REJECT,
    PERMISSIONS.REFUND_COMPLETE,
    
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_DELETE,
    PERMISSIONS.INVOICE_MANAGE,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    PERMISSIONS.INVOICE_PAID,
    PERMISSIONS.INVOICE_VOID,
    PERMISSIONS.INVOICE_CANCEL,
    
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT,
    PERMISSIONS.RECEIPT_DELETE,
    PERMISSIONS.RECEIPT_MANAGE,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    PERMISSIONS.RECEIPT_VOID,
    
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_MANAGE,
    PERMISSIONS.PAYMENT_REFUND,
    
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_MANAGE,
    
    // Integration
    PERMISSIONS.INTEGRATION_VIEW,
    PERMISSIONS.INTEGRATION_MANAGE,
    PERMISSIONS.API_VIEW,
    PERMISSIONS.API_MANAGE,
    PERMISSIONS.WEBHOOK_VIEW,
    PERMISSIONS.WEBHOOK_MANAGE,
  ],
  
  [UserRole.MANAGER]: [
    // User Management
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_EXPORT,
    
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_PROCESS,
    PERMISSIONS.ORDER_CANCEL,
    
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    
    // Report
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT,
    
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    
    // Business Unit
    PERMISSIONS.BUSINESS_UNIT_VIEW,
    
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_PRINT,
    
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_START,
    PERMISSIONS.SHIFT_END,
    
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    PERMISSIONS.RETURN_APPROVE,
    PERMISSIONS.RETURN_REJECT,
    PERMISSIONS.RETURN_PROCESS,
    
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_REJECT,
    PERMISSIONS.REFUND_COMPLETE,
    
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    PERMISSIONS.INVOICE_PAID,
    
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_MANAGE,
  ],
  
  [UserRole.EDITOR]: [
    // User Management
    PERMISSIONS.USER_VIEW,
    
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    
    // Report
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,
    
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_PRINT,
    
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_OPEN,
    
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_START,
    
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  
  [UserRole.VIEWER]: [
    // User Management
    PERMISSIONS.USER_VIEW,
    
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    
    // Order
    PERMISSIONS.ORDER_VIEW,
    
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    
    // Report
    PERMISSIONS.REPORT_VIEW,
    
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    
    // Sales
    PERMISSIONS.SALE_VIEW,
    
    // POS
    PERMISSIONS.POS_VIEW,
    
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    
    // Return
    PERMISSIONS.RETURN_VIEW,
    
    // Refund
    PERMISSIONS.REFUND_VIEW,
    
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  
  [UserRole.EMPLOYEE]: [
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_PRINT,
    
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  
  [UserRole.CASHIER]: [
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_PRINT,
    
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_START,
    PERMISSIONS.SHIFT_END,
    
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  
  [UserRole.USER]: [
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    
    // Order
    PERMISSIONS.ORDER_VIEW,
    
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if user has a specific permission
 */
export const hasPermission = (userRole: UserRole, permission: Permission | string): boolean => {
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  return userPermissions.includes(permission as Permission);
};

/**
 * Check if user has any of the given permissions
 */
export const hasAnyPermission = (userRole: UserRole, permissions: (Permission | string)[]): boolean => {
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.some(p => userPermissions.includes(p as Permission));
};

/**
 * Check if user has all of the given permissions
 */
export const hasAllPermissions = (userRole: UserRole, permissions: (Permission | string)[]): boolean => {
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  return permissions.every(p => userPermissions.includes(p as Permission));
};

/**
 * Get all permissions for a specific role
 */
export const getPermissionsForRole = (role: UserRole): Permission[] => {
  return ROLE_PERMISSIONS[role] || [];
};

/**
 * Get the highest role level
 */
export const getHighestRole = (roles: UserRole[]): UserRole => {
  const roleLevel: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 7,
    [UserRole.ADMIN]: 6,
    [UserRole.MANAGER]: 5,
    [UserRole.EDITOR]: 4,
    [UserRole.VIEWER]: 3,
    [UserRole.EMPLOYEE]: 2,
    [UserRole.CASHIER]: 1,
    [UserRole.USER]: 0,
  };
  
  return roles.reduce((highest, current) => 
    roleLevel[current] > roleLevel[highest] ? current : highest
  );
};

/**
 * Check if a user role is at least the given level
 */
export const isAtLeast = (userRole: UserRole, requiredRole: UserRole): boolean => {
  const roleLevel: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 7,
    [UserRole.ADMIN]: 6,
    [UserRole.MANAGER]: 5,
    [UserRole.EDITOR]: 4,
    [UserRole.VIEWER]: 3,
    [UserRole.EMPLOYEE]: 2,
    [UserRole.CASHIER]: 1,
    [UserRole.USER]: 0,
  };
  
  return roleLevel[userRole] >= roleLevel[requiredRole];
};

/**
 * Check if user has permission to perform an action on a resource
 */
export const can = (userRole: UserRole, resource: string, action: string): boolean => {
  const permission = `${resource}:${action}`;
  return hasPermission(userRole, permission);
};

/**
 * Check if user can view a resource
 */
export const canView = (userRole: UserRole, resource: string): boolean => {
  return can(userRole, resource, 'view');
};

/**
 * Check if user can create a resource
 */
export const canCreate = (userRole: UserRole, resource: string): boolean => {
  return can(userRole, resource, 'create');
};

/**
 * Check if user can edit a resource
 */
export const canEdit = (userRole: UserRole, resource: string): boolean => {
  return can(userRole, resource, 'edit');
};

/**
 * Check if user can delete a resource
 */
export const canDelete = (userRole: UserRole, resource: string): boolean => {
  return can(userRole, resource, 'delete');
};

/**
 * Check if user can manage a resource
 */
export const canManage = (userRole: UserRole, resource: string): boolean => {
  return can(userRole, resource, 'manage');
};

/**
 * Get role display name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  const displayNames: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Admin',
    [UserRole.ADMIN]: 'Admin',
    [UserRole.MANAGER]: 'Manager',
    [UserRole.EDITOR]: 'Editor',
    [UserRole.VIEWER]: 'Viewer',
    [UserRole.EMPLOYEE]: 'Employee',
    [UserRole.CASHIER]: 'Cashier',
    [UserRole.USER]: 'User',
  };
  return displayNames[role] || role;
};

/**
 * Get role badge color
 */
export const getRoleBadgeColor = (role: UserRole): string => {
  const colors: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    [UserRole.ADMIN]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    [UserRole.MANAGER]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    [UserRole.EDITOR]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    [UserRole.VIEWER]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    [UserRole.EMPLOYEE]: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    [UserRole.CASHIER]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    [UserRole.USER]: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-400',
  };
  return colors[role] || colors[UserRole.USER];
};

/**
 * Get role icon
 */
export const getRoleIcon = (role: UserRole): string => {
  const icons: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: '👑',
    [UserRole.ADMIN]: '🛡️',
    [UserRole.MANAGER]: '📊',
    [UserRole.EDITOR]: '✏️',
    [UserRole.VIEWER]: '👁️',
    [UserRole.EMPLOYEE]: '👤',
    [UserRole.CASHIER]: '💰',
    [UserRole.USER]: '👤',
  };
  return icons[role] || '👤';
};

/**
 * Get all available roles
 */
export const getAllRoles = (): UserRole[] => {
  return Object.values(UserRole);
};

/**
 * Get roles that have more permissions than the given role
 */
export const getHigherRoles = (role: UserRole): UserRole[] => {
  const roleLevel: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 7,
    [UserRole.ADMIN]: 6,
    [UserRole.MANAGER]: 5,
    [UserRole.EDITOR]: 4,
    [UserRole.VIEWER]: 3,
    [UserRole.EMPLOYEE]: 2,
    [UserRole.CASHIER]: 1,
    [UserRole.USER]: 0,
  };
  
  const currentLevel = roleLevel[role];
  return Object.values(UserRole).filter(r => roleLevel[r] > currentLevel);
};

/**
 * Get roles that have fewer permissions than the given role
 */
export const getLowerRoles = (role: UserRole): UserRole[] => {
  const roleLevel: Record<UserRole, number> = {
    [UserRole.SUPER_ADMIN]: 7,
    [UserRole.ADMIN]: 6,
    [UserRole.MANAGER]: 5,
    [UserRole.EDITOR]: 4,
    [UserRole.VIEWER]: 3,
    [UserRole.EMPLOYEE]: 2,
    [UserRole.CASHIER]: 1,
    [UserRole.USER]: 0,
  };
  
  const currentLevel = roleLevel[role];
  return Object.values(UserRole).filter(r => roleLevel[r] < currentLevel);
};

/**
 * Check if a role can manage another role
 * SUPER_ADMIN can manage all
 * ADMIN can manage MANAGER and below
 * MANAGER can manage EMPLOYEE, CASHIER, and USER
 */
export const canManageRole = (managerRole: UserRole, targetRole: UserRole): boolean => {
  if (managerRole === UserRole.SUPER_ADMIN) return true;
  if (managerRole === UserRole.ADMIN && targetRole !== UserRole.SUPER_ADMIN) return true;
  if (managerRole === UserRole.MANAGER && 
      [UserRole.EMPLOYEE, UserRole.CASHIER, UserRole.USER].includes(targetRole)) return true;
  return false;
};