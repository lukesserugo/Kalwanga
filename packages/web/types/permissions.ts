// packages/web/types/permissions.ts
export interface UserPermissions {
  // Dashboard
  canViewDashboard: boolean;
  canManageDashboard: boolean;

  // Categories
  canViewCategories: boolean;
  canManageCategories: boolean;

  // Products
  canViewProducts: boolean;
  canManageProducts: boolean;
  canExportProducts: boolean;
  canImportProducts: boolean;

  // Orders
  canViewOrders: boolean;
  canManageOrders: boolean;

  // Customers
  canViewCustomers: boolean;
  canManageCustomers: boolean;

  // Inventory — canonical flags mirror `inventory:*` strings 1:1
  canViewInventory: boolean;              // inventory:view
  canCreateInventory: boolean;            // inventory:create
  canEditInventory: boolean;              // inventory:edit
  canDeleteInventory: boolean;            // inventory:delete
  canManageInventory: boolean;            // inventory:manage
  canExportInventory: boolean;            // inventory:export
  canImportInventory: boolean;            // inventory:import
  canAdjustInventory: boolean;            // inventory:adjust
  canTransferInventory: boolean;          // inventory:transfer
  canIssueInventory: boolean;             // inventory:issue
  canRestockInventory: boolean;           // inventory:restock
  canViewInventoryLowStock: boolean;      // inventory:view_low_stock
  canViewInventoryReports: boolean;       // inventory:view_reports
  canViewInventoryAudit: boolean;         // inventory:view_audit

  // Inventory — convenience aliases (not 1:1 with a single string)
  canManageStockCount: boolean;           // alias of inventory:manage
  canViewInventoryValuation: boolean;     // alias of inventory:view_reports
  canViewInventoryTransactions: boolean;  // alias of inventory:view_audit

  // Reports
  canViewReports: boolean;

  // Users
  canManageUsers: boolean;
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canManageUserRoles: boolean;
  canManageUserPermissions: boolean;
  canViewUserActivity: boolean;
  canExportUsers: boolean;
  canImportUsers: boolean;
  canInviteUsers: boolean;
  canManageUserGroups: boolean;

  // Settings
  canManageSettings: boolean;

  // Suppliers
  canViewSuppliers: boolean;
  canManageSuppliers: boolean;
  canCreateSuppliers: boolean;
  canEditSuppliers: boolean;
  canDeleteSuppliers: boolean;
  canViewSupplierProducts: boolean;
  canViewSupplierOrders: boolean;

  // Sales / POS / Returns / Invoices / Receipts
  canViewSales: boolean;
  canManageSales: boolean;
  canViewAnalytics: boolean;
  canManagePos: boolean;
  canViewReturns: boolean;
  canManageReturns: boolean;
  canViewInvoices: boolean;
  canManageInvoices: boolean;
  canViewReceipts: boolean;
  canPrintReceipts: boolean;

  // Barcodes
  canViewBarcodes: boolean;
  canManageBarcodes: boolean;

  // Business units & companies
  canViewBusinessUnits: boolean;
  canManageBusinessUnits: boolean;
  canViewCompanies: boolean;
  canManageCompanies: boolean;

  // Cart
  canViewCart: boolean;
  canManageCart: boolean;
  canCheckout: boolean;
  canViewCartHistory: boolean;
  canManageCartSettings: boolean;

  // Checkout
  canViewCheckout: boolean;
  canManageCheckout: boolean;
  canViewCheckoutStats: boolean;
  canManageCheckoutStats: boolean;
  canViewCheckoutSettings: boolean;
  canManageCheckoutSettings: boolean;

  // Payments
  canViewPayments: boolean;
  canManagePayments: boolean;
  canViewPaymentStats: boolean;
  canManagePaymentStats: boolean;
  canViewPaymentSettings: boolean;
  canManagePaymentSettings: boolean;
  canExportPayments: boolean;
  canRefundPayments: boolean;

  // Bookkeeping / accounting
  canViewBookkeeping: boolean;
  canManageBookkeeping: boolean;
  canViewJournalEntries: boolean;
  canCreateJournalEntries: boolean;
  canViewAccounts: boolean;
  canManageAccounts: boolean;

  // Shifts & registers
  canViewShifts: boolean;
  canManageShifts: boolean;
  canViewRegisters: boolean;
  canManageRegisters: boolean;
  canStartShift: boolean;
  canEndShift: boolean;
  canManageCash: boolean;
}

// ============================================
// WILDCARD
// ============================================
//
// The single string that, when present in a permission set, grants
// every flag `buildPermissionsFromSet` derives. Only SUPER_ADMIN
// carries it. The backend mirrors this in
// `packages/backend/src/middleware/auth.ts` (`ALL_PERMISSIONS` ends
// with `'*'`).

export const WILDCARD = '*' as const;

// ============================================
// PERMISSIONS — string registry
// ============================================
//
// Canonical string identifiers for every permission the UI can
// grant or check. Consumer code (admin pages, forms, guards) reads
// from this map instead of hardcoding strings.
//
// ⚠️ Keep in sync with the backend's `ALL_PERMISSIONS` array in
//    `packages/backend/src/middleware/auth.ts`. Every key here
//    should correspond to a string the backend recognises.

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_MANAGE: 'dashboard:manage',

  // Users
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  USER_EXPORT: 'user:export',
  USER_IMPORT: 'user:import',
  USER_INVITE: 'user:invite',
  USER_ROLE_UPDATE: 'user:role:update',
  USER_PERMISSION_UPDATE: 'user:permission:update',
  GROUP_MANAGE: 'group:manage',
  ACTIVITY_VIEW: 'activity:view',

  // Products
  PRODUCT_VIEW: 'product:view',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_EDIT: 'product:edit',
  PRODUCT_DELETE: 'product:delete',
  PRODUCT_MANAGE: 'product:manage',
  PRODUCT_EXPORT: 'product:export',
  PRODUCT_IMPORT: 'product:import',

  // Categories
  CATEGORY_VIEW: 'category:view',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_EDIT: 'category:edit',
  CATEGORY_DELETE: 'category:delete',
  CATEGORY_MANAGE: 'category:manage',

  // Inventory
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_VIEW_LOW_STOCK: 'inventory:view_low_stock',
  INVENTORY_VIEW_REPORTS: 'inventory:view_reports',
  INVENTORY_VIEW_AUDIT: 'inventory:view_audit',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_TRANSFER: 'inventory:transfer',
  INVENTORY_EXPORT: 'inventory:export',
  INVENTORY_IMPORT: 'inventory:import',
  INVENTORY_ISSUE: 'inventory:issue',
  INVENTORY_RESTOCK: 'inventory:restock',

  // Orders
  ORDER_VIEW: 'order:view',
  ORDER_CREATE: 'order:create',
  ORDER_EDIT: 'order:edit',
  ORDER_DELETE: 'order:delete',
  ORDER_MANAGE: 'order:manage',

  // Sales / POS
  SALE_VIEW: 'sale:view',
  SALE_CREATE: 'sale:create',
  SALE_EDIT: 'sale:edit',
  SALE_DELETE: 'sale:delete',
  SALE_MANAGE: 'sale:manage',
  POS_VIEW: 'pos:view',
  POS_CREATE: 'pos:create',
  POS_MANAGE: 'pos:manage',
  POS_PRINT: 'pos:print',
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // Customers
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_EDIT: 'customer:edit',
  CUSTOMER_DELETE: 'customer:delete',
  CUSTOMER_MANAGE: 'customer:manage',

  // Suppliers
  SUPPLIER_VIEW: 'supplier:view',
  SUPPLIER_CREATE: 'supplier:create',
  SUPPLIER_EDIT: 'supplier:edit',
  SUPPLIER_DELETE: 'supplier:delete',
  SUPPLIER_MANAGE: 'supplier:manage',

  // Returns
  RETURN_VIEW: 'return:view',
  RETURN_CREATE: 'return:create',
  RETURN_EDIT: 'return:edit',
  RETURN_DELETE: 'return:delete',
  RETURN_MANAGE: 'return:manage',

  // Invoices
  INVOICE_VIEW: 'invoice:view',
  INVOICE_CREATE: 'invoice:create',
  INVOICE_EDIT: 'invoice:edit',
  INVOICE_DELETE: 'invoice:delete',
  INVOICE_MANAGE: 'invoice:manage',

  // Receipts
  RECEIPT_VIEW: 'receipt:view',
  RECEIPT_CREATE: 'receipt:create',
  RECEIPT_EDIT: 'receipt:edit',
  RECEIPT_DELETE: 'receipt:delete',
  RECEIPT_MANAGE: 'receipt:manage',
  RECEIPT_PRINT: 'receipt:print',
  RECEIPT_EMAIL: 'receipt:email',

  // Reports
  REPORT_VIEW: 'report:view',
  REPORT_MANAGE: 'report:manage',
  REPORT_CREATE: 'report:create',
  REPORT_EXPORT: 'report:export',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  SETTINGS_MANAGE: 'settings:manage',

  // Business units / companies
  BUSINESS_UNIT_VIEW: 'business_unit:view',
  BUSINESS_UNIT_CREATE: 'business_unit:create',
  BUSINESS_UNIT_EDIT: 'business_unit:edit',
  BUSINESS_UNIT_DELETE: 'business_unit:delete',
  BUSINESS_UNIT_MANAGE: 'business_unit:manage',
  COMPANY_VIEW: 'company:view',
  COMPANY_MANAGE: 'company:manage',

  // Payments
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_MANAGE: 'payment:manage',
  PAYMENT_REFUND: 'payment:refund',

  // Accounting
  ACCOUNTING_VIEW: 'accounting:view',
  ACCOUNTING_MANAGE: 'accounting:manage',
  ACCOUNTING_CREATE: 'accounting:create',

  // Shifts & registers
  SHIFT_VIEW: 'shift:view',
  SHIFT_MANAGE: 'shift:manage',
  SHIFT_START: 'shift:start',
  SHIFT_END: 'shift:end',
  CASH_REGISTER_VIEW: 'cash_register:view',
  CASH_REGISTER_MANAGE: 'cash_register:manage',
  CASH_REGISTER_OPEN: 'cash_register:open',
  CASH_REGISTER_CLOSE: 'cash_register:close',

  // Wildcard
  ALL: WILDCARD,
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type PermissionValue = (typeof PERMISSIONS)[PermissionKey];

// ============================================
// SUPER ADMIN ROLE CHECK
// ============================================
//
// Single source of truth for "is this the SUPER_ADMIN role?".
// Used by the layout, the Sidebar, `useAuth`, and every guard that
// needs to short-circuit for the ultimate-rights user.
//
// ⚠️ Accepts `string | null | undefined` because Clerk metadata is
//    typed loosely (its values can be anything). Normalises case so
//    a lowercase "super_admin" from a token still matches.

export function isSuperAdminRole(
  role: string | null | undefined
): boolean {
  if (!role) return false;
  return String(role).trim().toUpperCase() === 'SUPER_ADMIN';
}

// ============================================
// ALL_ACCESS_PERMISSIONS
// ============================================
//
// Wildcard flag set — every boolean `true`. Returned when the
// caller is SUPER_ADMIN (or when the resolved permission set
// contains the wildcard `'*'`).

export const ALL_ACCESS_PERMISSIONS: UserPermissions = {
  // Dashboard
  canViewDashboard: true,
  canManageDashboard: true,

  // Categories
  canViewCategories: true,
  canManageCategories: true,

  // Products
  canViewProducts: true,
  canManageProducts: true,
  canExportProducts: true,
  canImportProducts: true,

  // Orders
  canViewOrders: true,
  canManageOrders: true,

  // Customers
  canViewCustomers: true,
  canManageCustomers: true,

  // Inventory
  canViewInventory: true,
  canCreateInventory: true,
  canEditInventory: true,
  canDeleteInventory: true,
  canManageInventory: true,
  canExportInventory: true,
  canImportInventory: true,
  canAdjustInventory: true,
  canTransferInventory: true,
  canIssueInventory: true,
  canRestockInventory: true,
  canViewInventoryLowStock: true,
  canViewInventoryReports: true,
  canViewInventoryAudit: true,
  canManageStockCount: true,
  canViewInventoryValuation: true,
  canViewInventoryTransactions: true,

  // Reports
  canViewReports: true,

  // Users
  canManageUsers: true,
  canViewUsers: true,
  canCreateUsers: true,
  canEditUsers: true,
  canDeleteUsers: true,
  canManageUserRoles: true,
  canManageUserPermissions: true,
  canViewUserActivity: true,
  canExportUsers: true,
  canImportUsers: true,
  canInviteUsers: true,
  canManageUserGroups: true,

  // Settings
  canManageSettings: true,

  // Suppliers
  canViewSuppliers: true,
  canManageSuppliers: true,
  canCreateSuppliers: true,
  canEditSuppliers: true,
  canDeleteSuppliers: true,
  canViewSupplierProducts: true,
  canViewSupplierOrders: true,

  // Sales / POS / Returns / Invoices / Receipts
  canViewSales: true,
  canManageSales: true,
  canViewAnalytics: true,
  canManagePos: true,
  canViewReturns: true,
  canManageReturns: true,
  canViewInvoices: true,
  canManageInvoices: true,
  canViewReceipts: true,
  canPrintReceipts: true,

  // Barcodes
  canViewBarcodes: true,
  canManageBarcodes: true,

  // Business units & companies
  canViewBusinessUnits: true,
  canManageBusinessUnits: true,
  canViewCompanies: true,
  canManageCompanies: true,

  // Cart
  canViewCart: true,
  canManageCart: true,
  canCheckout: true,
  canViewCartHistory: true,
  canManageCartSettings: true,

  // Checkout
  canViewCheckout: true,
  canManageCheckout: true,
  canViewCheckoutStats: true,
  canManageCheckoutStats: true,
  canViewCheckoutSettings: true,
  canManageCheckoutSettings: true,

  // Payments
  canViewPayments: true,
  canManagePayments: true,
  canViewPaymentStats: true,
  canManagePaymentStats: true,
  canViewPaymentSettings: true,
  canManagePaymentSettings: true,
  canExportPayments: true,
  canRefundPayments: true,

  // Bookkeeping / accounting
  canViewBookkeeping: true,
  canManageBookkeeping: true,
  canViewJournalEntries: true,
  canCreateJournalEntries: true,
  canViewAccounts: true,
  canManageAccounts: true,

  // Shifts & registers
  canViewShifts: true,
  canManageShifts: true,
  canViewRegisters: true,
  canManageRegisters: true,
  canStartShift: true,
  canEndShift: true,
  canManageCash: true,
};

// ============================================
// NO_ACCESS_PERMISSIONS
// ============================================
//
// Fully locked-out baseline. Returned when the role is unrecognised
// or missing.

export const NO_ACCESS_PERMISSIONS: UserPermissions = {
  // Dashboard
  canViewDashboard: false,
  canManageDashboard: false,

  // Categories
  canViewCategories: false,
  canManageCategories: false,

  // Products
  canViewProducts: false,
  canManageProducts: false,
  canExportProducts: false,
  canImportProducts: false,

  // Orders
  canViewOrders: false,
  canManageOrders: false,

  // Customers
  canViewCustomers: false,
  canManageCustomers: false,

  // Inventory
  canViewInventory: false,
  canCreateInventory: false,
  canEditInventory: false,
  canDeleteInventory: false,
  canManageInventory: false,
  canExportInventory: false,
  canImportInventory: false,
  canAdjustInventory: false,
  canTransferInventory: false,
  canIssueInventory: false,
  canRestockInventory: false,
  canViewInventoryLowStock: false,
  canViewInventoryReports: false,
  canViewInventoryAudit: false,
  canManageStockCount: false,
  canViewInventoryValuation: false,
  canViewInventoryTransactions: false,

  // Reports
  canViewReports: false,

  // Users
  canManageUsers: false,
  canViewUsers: false,
  canCreateUsers: false,
  canEditUsers: false,
  canDeleteUsers: false,
  canManageUserRoles: false,
  canManageUserPermissions: false,
  canViewUserActivity: false,
  canExportUsers: false,
  canImportUsers: false,
  canInviteUsers: false,
  canManageUserGroups: false,

  // Settings
  canManageSettings: false,

  // Suppliers
  canViewSuppliers: false,
  canManageSuppliers: false,
  canCreateSuppliers: false,
  canEditSuppliers: false,
  canDeleteSuppliers: false,
  canViewSupplierProducts: false,
  canViewSupplierOrders: false,

  // Sales / POS / Returns / Invoices / Receipts
  canViewSales: false,
  canManageSales: false,
  canViewAnalytics: false,
  canManagePos: false,
  canViewReturns: false,
  canManageReturns: false,
  canViewInvoices: false,
  canManageInvoices: false,
  canViewReceipts: false,
  canPrintReceipts: false,

  // Barcodes
  canViewBarcodes: false,
  canManageBarcodes: false,

  // Business units & companies
  canViewBusinessUnits: false,
  canManageBusinessUnits: false,
  canViewCompanies: false,
  canManageCompanies: false,

  // Cart
  canViewCart: false,
  canManageCart: false,
  canCheckout: false,
  canViewCartHistory: false,
  canManageCartSettings: false,

  // Checkout
  canViewCheckout: false,
  canManageCheckout: false,
  canViewCheckoutStats: false,
  canManageCheckoutStats: false,
  canViewCheckoutSettings: false,
  canManageCheckoutSettings: false,

  // Payments
  canViewPayments: false,
  canManagePayments: false,
  canViewPaymentStats: false,
  canManagePaymentStats: false,
  canViewPaymentSettings: false,
  canManagePaymentSettings: false,
  canExportPayments: false,
  canRefundPayments: false,

  // Bookkeeping / accounting
  canViewBookkeeping: false,
  canManageBookkeeping: false,
  canViewJournalEntries: false,
  canCreateJournalEntries: false,
  canViewAccounts: false,
  canManageAccounts: false,

  // Shifts & registers
  canViewShifts: false,
  canManageShifts: false,
  canViewRegisters: false,
  canManageRegisters: false,
  canStartShift: false,
  canEndShift: false,
  canManageCash: false,
};

// ============================================
// ROLE → PERMISSION STRINGS
// ============================================
//
// Mirrors the backend's `getDefaultPermissionsForRole` in
// `packages/backend/src/controllers/userController.ts`. Keep the
// two tables in sync — the sidebar and route guards must agree
// with what the API will actually allow.
//
// SUPER_ADMIN's set is `['*']` — the wildcard.
//
// ⚠️ Every string here MUST be a value defined in `PERMISSIONS`.
//    If `buildPermissionsFromSet` reads a flag via `has('x:y')`,
//    then some role table must include `'x:y'` for that flag to
//    ever be `true` for a non-super role. The `auditRoleTables()`
//    function below enforces this invariant in dev.

const SUPER_ADMIN_PERMISSIONS: string[] = [WILDCARD];

const ADMIN_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.DASHBOARD_MANAGE,

  PERMISSIONS.USER_VIEW,
  PERMISSIONS.USER_CREATE,
  PERMISSIONS.USER_EDIT,
  PERMISSIONS.USER_DELETE,
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.USER_EXPORT,
  PERMISSIONS.USER_IMPORT,
  PERMISSIONS.USER_INVITE,
  PERMISSIONS.USER_ROLE_UPDATE,
  PERMISSIONS.USER_PERMISSION_UPDATE,
  PERMISSIONS.GROUP_MANAGE,
  PERMISSIONS.ACTIVITY_VIEW,

  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.PRODUCT_CREATE,
  PERMISSIONS.PRODUCT_EDIT,
  PERMISSIONS.PRODUCT_DELETE,
  PERMISSIONS.PRODUCT_MANAGE,
  PERMISSIONS.PRODUCT_EXPORT,
  PERMISSIONS.PRODUCT_IMPORT,

  PERMISSIONS.CATEGORY_VIEW,
  PERMISSIONS.CATEGORY_CREATE,
  PERMISSIONS.CATEGORY_EDIT,
  PERMISSIONS.CATEGORY_DELETE,
  PERMISSIONS.CATEGORY_MANAGE,

  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_CREATE,
  PERMISSIONS.INVENTORY_EDIT,
  PERMISSIONS.INVENTORY_DELETE,
  PERMISSIONS.INVENTORY_MANAGE,
  PERMISSIONS.INVENTORY_VIEW_LOW_STOCK,
  PERMISSIONS.INVENTORY_VIEW_REPORTS,
  PERMISSIONS.INVENTORY_VIEW_AUDIT,
  PERMISSIONS.INVENTORY_ADJUST,
  PERMISSIONS.INVENTORY_TRANSFER,
  PERMISSIONS.INVENTORY_EXPORT,
  PERMISSIONS.INVENTORY_IMPORT,
  PERMISSIONS.INVENTORY_ISSUE,
  PERMISSIONS.INVENTORY_RESTOCK,

  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.ORDER_CREATE,
  PERMISSIONS.ORDER_EDIT,
  PERMISSIONS.ORDER_MANAGE,

  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.SALE_CREATE,
  PERMISSIONS.SALE_EDIT,
  PERMISSIONS.SALE_MANAGE,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.ANALYTICS_EXPORT,
  PERMISSIONS.POS_VIEW,
  PERMISSIONS.POS_CREATE,
  PERMISSIONS.POS_MANAGE,
  PERMISSIONS.POS_PRINT,

  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.CUSTOMER_CREATE,
  PERMISSIONS.CUSTOMER_EDIT,
  PERMISSIONS.CUSTOMER_MANAGE,

  PERMISSIONS.SUPPLIER_VIEW,
  PERMISSIONS.SUPPLIER_CREATE,
  PERMISSIONS.SUPPLIER_EDIT,
  PERMISSIONS.SUPPLIER_MANAGE,

  PERMISSIONS.RETURN_VIEW,
  PERMISSIONS.RETURN_CREATE,
  PERMISSIONS.RETURN_EDIT,
  PERMISSIONS.RETURN_MANAGE,

  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_EDIT,
  PERMISSIONS.INVOICE_MANAGE,

  PERMISSIONS.RECEIPT_VIEW,
  PERMISSIONS.RECEIPT_CREATE,
  PERMISSIONS.RECEIPT_EDIT,
  PERMISSIONS.RECEIPT_MANAGE,
  PERMISSIONS.RECEIPT_PRINT,
  PERMISSIONS.RECEIPT_EMAIL,

  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.REPORT_CREATE,
  PERMISSIONS.REPORT_MANAGE,
  PERMISSIONS.REPORT_EXPORT,

  PERMISSIONS.SETTINGS_VIEW,
  PERMISSIONS.SETTINGS_EDIT,
  PERMISSIONS.SETTINGS_MANAGE,

  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.PAYMENT_CREATE,
  PERMISSIONS.PAYMENT_MANAGE,
  PERMISSIONS.PAYMENT_REFUND,

  PERMISSIONS.BUSINESS_UNIT_VIEW,
  PERMISSIONS.BUSINESS_UNIT_CREATE,
  PERMISSIONS.BUSINESS_UNIT_EDIT,
  PERMISSIONS.BUSINESS_UNIT_DELETE,
  PERMISSIONS.BUSINESS_UNIT_MANAGE,

  PERMISSIONS.SHIFT_VIEW,
  PERMISSIONS.SHIFT_MANAGE,
  PERMISSIONS.SHIFT_START,
  PERMISSIONS.SHIFT_END,
  PERMISSIONS.CASH_REGISTER_VIEW,
  PERMISSIONS.CASH_REGISTER_MANAGE,
  PERMISSIONS.CASH_REGISTER_OPEN,
  PERMISSIONS.CASH_REGISTER_CLOSE,

  PERMISSIONS.ACCOUNTING_VIEW,
  PERMISSIONS.ACCOUNTING_MANAGE,
  PERMISSIONS.ACCOUNTING_CREATE,

  PERMISSIONS.COMPANY_VIEW,
];

const MANAGER_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.DASHBOARD_MANAGE,

  PERMISSIONS.USER_VIEW,

  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.PRODUCT_CREATE,
  PERMISSIONS.PRODUCT_EDIT,
  PERMISSIONS.PRODUCT_MANAGE,
  PERMISSIONS.PRODUCT_EXPORT,

  PERMISSIONS.CATEGORY_VIEW,
  PERMISSIONS.CATEGORY_CREATE,
  PERMISSIONS.CATEGORY_EDIT,
  PERMISSIONS.CATEGORY_MANAGE,

  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_CREATE,
  PERMISSIONS.INVENTORY_EDIT,
  PERMISSIONS.INVENTORY_MANAGE,
  PERMISSIONS.INVENTORY_VIEW_LOW_STOCK,
  PERMISSIONS.INVENTORY_VIEW_REPORTS,
  PERMISSIONS.INVENTORY_VIEW_AUDIT,
  PERMISSIONS.INVENTORY_ADJUST,
  PERMISSIONS.INVENTORY_TRANSFER,
  PERMISSIONS.INVENTORY_ISSUE,
  PERMISSIONS.INVENTORY_RESTOCK,

  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.ORDER_CREATE,
  PERMISSIONS.ORDER_EDIT,
  PERMISSIONS.ORDER_MANAGE,

  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.SALE_CREATE,
  PERMISSIONS.SALE_MANAGE,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.POS_VIEW,
  PERMISSIONS.POS_CREATE,
  PERMISSIONS.POS_MANAGE,
  PERMISSIONS.POS_PRINT,

  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.CUSTOMER_CREATE,
  PERMISSIONS.CUSTOMER_EDIT,
  PERMISSIONS.CUSTOMER_MANAGE,

  PERMISSIONS.SUPPLIER_VIEW,
  PERMISSIONS.SUPPLIER_MANAGE,

  PERMISSIONS.RETURN_VIEW,
  PERMISSIONS.RETURN_MANAGE,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.INVOICE_MANAGE,
  PERMISSIONS.RECEIPT_VIEW,
  PERMISSIONS.RECEIPT_PRINT,

  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.REPORT_CREATE,
  PERMISSIONS.REPORT_EXPORT,

  PERMISSIONS.SETTINGS_VIEW,

  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.PAYMENT_CREATE,

  PERMISSIONS.BUSINESS_UNIT_VIEW,

  PERMISSIONS.SHIFT_VIEW,
  PERMISSIONS.SHIFT_START,
  PERMISSIONS.SHIFT_END,
  PERMISSIONS.CASH_REGISTER_VIEW,
  PERMISSIONS.CASH_REGISTER_MANAGE,
  PERMISSIONS.CASH_REGISTER_OPEN,
  PERMISSIONS.CASH_REGISTER_CLOSE,
];

const EDITOR_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_VIEW,

  PERMISSIONS.USER_VIEW,

  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.PRODUCT_CREATE,
  PERMISSIONS.PRODUCT_EDIT,
  PERMISSIONS.PRODUCT_MANAGE,

  PERMISSIONS.CATEGORY_VIEW,
  PERMISSIONS.CATEGORY_CREATE,
  PERMISSIONS.CATEGORY_EDIT,
  PERMISSIONS.CATEGORY_MANAGE,

  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_CREATE,
  PERMISSIONS.INVENTORY_EDIT,
  PERMISSIONS.INVENTORY_MANAGE,
  PERMISSIONS.INVENTORY_VIEW_LOW_STOCK,
  PERMISSIONS.INVENTORY_VIEW_AUDIT,
  PERMISSIONS.INVENTORY_ISSUE,
  PERMISSIONS.INVENTORY_RESTOCK,

  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.ORDER_CREATE,

  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.SALE_CREATE,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.POS_VIEW,
  PERMISSIONS.POS_CREATE,
  PERMISSIONS.POS_PRINT,

  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.CUSTOMER_CREATE,
  PERMISSIONS.CUSTOMER_EDIT,

  PERMISSIONS.SUPPLIER_VIEW,
  PERMISSIONS.SUPPLIER_CREATE,
  PERMISSIONS.SUPPLIER_EDIT,

  PERMISSIONS.RETURN_VIEW,
  PERMISSIONS.RETURN_CREATE,

  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.INVOICE_CREATE,
  PERMISSIONS.INVOICE_EDIT,

  PERMISSIONS.RECEIPT_VIEW,
  PERMISSIONS.RECEIPT_CREATE,
  PERMISSIONS.RECEIPT_PRINT,

  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.REPORT_CREATE,

  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.PAYMENT_CREATE,

  PERMISSIONS.SHIFT_VIEW,
  PERMISSIONS.SHIFT_START,
  PERMISSIONS.CASH_REGISTER_VIEW,
  PERMISSIONS.CASH_REGISTER_OPEN,
];

const VIEWER_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_VIEW,

  PERMISSIONS.USER_VIEW,
  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.CATEGORY_VIEW,
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_VIEW_LOW_STOCK,
  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.SUPPLIER_VIEW,
  PERMISSIONS.RETURN_VIEW,
  PERMISSIONS.INVOICE_VIEW,
  PERMISSIONS.RECEIPT_VIEW,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.ANALYTICS_VIEW,
  PERMISSIONS.POS_VIEW,
  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.BUSINESS_UNIT_VIEW,
  PERMISSIONS.COMPANY_VIEW,
  PERMISSIONS.SHIFT_VIEW,
  PERMISSIONS.CASH_REGISTER_VIEW,
];

const EMPLOYEE_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.INVENTORY_VIEW_LOW_STOCK,
  PERMISSIONS.INVENTORY_ISSUE,
  PERMISSIONS.INVENTORY_RESTOCK,
  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.ORDER_CREATE,
  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.SALE_CREATE,
  PERMISSIONS.POS_VIEW,
  PERMISSIONS.POS_CREATE,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.CUSTOMER_CREATE,
  PERMISSIONS.RETURN_VIEW,
  PERMISSIONS.RETURN_CREATE,
  PERMISSIONS.RECEIPT_VIEW,
  PERMISSIONS.RECEIPT_CREATE,
  PERMISSIONS.RECEIPT_PRINT,
];

const CASHIER_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.INVENTORY_VIEW,
  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.ORDER_CREATE,
  PERMISSIONS.ORDER_MANAGE,
  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.SALE_CREATE,
  PERMISSIONS.SALE_MANAGE,
  PERMISSIONS.POS_VIEW,
  PERMISSIONS.POS_CREATE,
  PERMISSIONS.POS_MANAGE,
  PERMISSIONS.POS_PRINT,
  PERMISSIONS.CUSTOMER_VIEW,
  PERMISSIONS.CUSTOMER_CREATE,
  PERMISSIONS.RETURN_VIEW,
  PERMISSIONS.RETURN_CREATE,
  PERMISSIONS.RECEIPT_VIEW,
  PERMISSIONS.RECEIPT_CREATE,
  PERMISSIONS.RECEIPT_PRINT,
  PERMISSIONS.RECEIPT_EMAIL,
  PERMISSIONS.PAYMENT_VIEW,
  PERMISSIONS.PAYMENT_CREATE,
  PERMISSIONS.SHIFT_VIEW,
  PERMISSIONS.SHIFT_START,
  PERMISSIONS.SHIFT_END,
  PERMISSIONS.CASH_REGISTER_VIEW,
  PERMISSIONS.CASH_REGISTER_OPEN,
  PERMISSIONS.CASH_REGISTER_CLOSE,
];

const USER_PERMISSIONS: string[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.PRODUCT_VIEW,
  PERMISSIONS.ORDER_VIEW,
  PERMISSIONS.SALE_VIEW,
  PERMISSIONS.SALE_CREATE,
  PERMISSIONS.RECEIPT_VIEW,
  PERMISSIONS.INVENTORY_VIEW,
];

// ============================================
// BUILD PERMISSIONS FOR ROLE
// ============================================
//
// Resolve permission *strings* for a role, then feed them through
// `buildPermissionsFromSet` to get the boolean-flag view.
//
// SUPER_ADMIN short-circuits to `['*']` — the wildcard — which
// flips every flag in `ALL_ACCESS_PERMISSIONS` to `true`.

export function buildPermissionsForRole(
  role: string | null | undefined
): UserPermissions {
  if (!role) return NO_ACCESS_PERMISSIONS;

  if (isSuperAdminRole(role)) {
    return ALL_ACCESS_PERMISSIONS;
  }

  const normalized = String(role).trim().toUpperCase();

  switch (normalized) {
    case 'ADMIN':
      return buildPermissionsFromSet(ADMIN_PERMISSIONS);
    case 'MANAGER':
      return buildPermissionsFromSet(MANAGER_PERMISSIONS);
    case 'EDITOR':
      return buildPermissionsFromSet(EDITOR_PERMISSIONS);
    case 'VIEWER':
      return buildPermissionsFromSet(VIEWER_PERMISSIONS);
    case 'EMPLOYEE':
      return buildPermissionsFromSet(EMPLOYEE_PERMISSIONS);
    case 'CASHIER':
      return buildPermissionsFromSet(CASHIER_PERMISSIONS);
    case 'USER':
    default:
      return buildPermissionsFromSet(USER_PERMISSIONS);
  }
}

// ============================================
// BUILDER
// ============================================
//
// Turn a resolved permission string array into the boolean-flag view.
//
// ⚠️ This function does NOT decide who has what. It only asks
//    "does this string appear in the set?" for each flag. The
//    backend decides who has what, via `resolvePermissions` in
//    `packages/backend/src/lib/permissions.ts`.
//
//    A SUPER_ADMIN's set contains the wildcard `'*'`, so every flag
//    below becomes `true` automatically. No special-casing is needed.

export function buildPermissionsFromSet(perms: string[]): UserPermissions {
  const has = (p: string) => perms.includes(WILDCARD) || perms.includes(p);

  return {
    // Dashboard
    canViewDashboard: has('dashboard:view'),
    canManageDashboard: has('dashboard:manage'),

    // Categories
    canViewCategories: has('category:view'),
    canManageCategories: has('category:manage'),

    // Products
    canViewProducts: has('product:view'),
    canManageProducts: has('product:manage'),
    canExportProducts: has('product:export'),
    canImportProducts: has('product:import'),

    // Orders
    canViewOrders: has('order:view'),
    canManageOrders: has('order:manage'),

    // Customers
    canViewCustomers: has('customer:view'),
    canManageCustomers: has('customer:manage'),

    // Inventory — canonical 1:1 flags
    canViewInventory: has('inventory:view'),
    canCreateInventory: has('inventory:create'),
    canEditInventory: has('inventory:edit'),
    canDeleteInventory: has('inventory:delete'),
    canManageInventory: has('inventory:manage'),
    canExportInventory: has('inventory:export'),
    canImportInventory: has('inventory:import'),
    canAdjustInventory: has('inventory:adjust'),
    canTransferInventory: has('inventory:transfer'),
    canIssueInventory: has('inventory:issue'),
    canRestockInventory: has('inventory:restock'),
    canViewInventoryLowStock: has('inventory:view_low_stock'),
    canViewInventoryReports: has('inventory:view_reports'),
    canViewInventoryAudit: has('inventory:view_audit'),

    // Inventory — aliases
    canManageStockCount: has('inventory:manage'),
    canViewInventoryValuation: has('inventory:view_reports'),
    canViewInventoryTransactions: has('inventory:view_audit'),

    // Reports
    canViewReports: has('report:view'),

    // Users
    canManageUsers: has('user:manage'),
    canViewUsers: has('user:view'),
    canCreateUsers: has('user:create'),
    canEditUsers: has('user:edit'),
    canDeleteUsers: has('user:delete'),
    canManageUserRoles: has('user:role:update'),
    canManageUserPermissions: has('user:permission:update'),
    canViewUserActivity: has('activity:view'),
    canExportUsers: has('user:export'),
    canImportUsers: has('user:import'),
    canInviteUsers: has('user:invite'),
    canManageUserGroups: has('group:manage'),

    // Settings
    canManageSettings: has('settings:manage'),

    // Suppliers
    canViewSuppliers: has('supplier:view'),
    canManageSuppliers: has('supplier:manage'),
    canCreateSuppliers: has('supplier:create'),
    canEditSuppliers: has('supplier:edit'),
    canDeleteSuppliers: has('supplier:delete'),
    canViewSupplierProducts: has('supplier:view'),
    canViewSupplierOrders: has('supplier:view'),

    // Sales / POS / Returns / Invoices / Receipts
    canViewSales: has('sale:view'),
    canManageSales: has('sale:manage'),
    canViewAnalytics: has('analytics:view'),
    canManagePos: has('pos:manage'),
    canViewReturns: has('return:view'),
    canManageReturns: has('return:manage'),
    canViewInvoices: has('invoice:view'),
    canManageInvoices: has('invoice:manage'),
    canViewReceipts: has('receipt:view'),
    canPrintReceipts: has('receipt:print'),

    // Barcodes
    canViewBarcodes: has('product:view'),
    canManageBarcodes: has('product:manage'),

    // Business units & companies
    canViewBusinessUnits: has('business_unit:view'),
    canManageBusinessUnits: has('business_unit:manage'),
    canViewCompanies: has('company:view'),
    canManageCompanies: has('company:manage'),

    // Cart
    canViewCart: has('sale:view'),
    canManageCart: has('sale:create'),
    canCheckout: has('sale:create'),
    canViewCartHistory: has('sale:view'),
    canManageCartSettings: has('settings:manage'),

    // Checkout
    canViewCheckout: has('sale:view'),
    canManageCheckout: has('sale:create'),
    canViewCheckoutStats: has('report:view'),
    canManageCheckoutStats: has('report:manage'),
    canViewCheckoutSettings: has('settings:view'),
    canManageCheckoutSettings: has('settings:manage'),

    // Payments
    canViewPayments: has('payment:view'),
    canManagePayments: has('payment:manage'),
    canViewPaymentStats: has('report:view'),
    canManagePaymentStats: has('report:manage'),
    canViewPaymentSettings: has('settings:view'),
    canManagePaymentSettings: has('settings:manage'),
    canExportPayments: has('payment:view'),
    canRefundPayments: has('payment:refund'),

    // Bookkeeping / accounting
    canViewBookkeeping: has('accounting:view'),
    canManageBookkeeping: has('accounting:manage'),
    canViewJournalEntries: has('accounting:view'),
    canCreateJournalEntries: has('accounting:create'),
    canViewAccounts: has('accounting:view'),
    canManageAccounts: has('accounting:manage'),

    // Shifts & registers
    canViewShifts: has('shift:view'),
    canManageShifts: has('shift:manage'),
    canViewRegisters: has('cash_register:view'),
    canManageRegisters: has('cash_register:manage'),
    canStartShift: has('shift:start'),
    canEndShift: has('shift:end'),
    canManageCash: has('cash_register:manage'),
  };
}

// ============================================
// UTILITY HELPERS
// ============================================

/**
 * Returns true when the resolved permission set grants the given
 * string. The wildcard `'*'` always wins.
 */
export function hasPermission(
  perms: string[] | null | undefined,
  permission: string
): boolean {
  if (!perms || perms.length === 0) return false;
  return perms.includes(WILDCARD) || perms.includes(permission);
}

/**
 * Returns true when the resolved permission set grants every
 * string in `required`. The wildcard always wins.
 */
export function hasAllPermissions(
  perms: string[] | null | undefined,
  required: string[]
): boolean {
  if (!perms || perms.length === 0) return false;
  if (perms.includes(WILDCARD)) return true;
  return required.every((p) => perms.includes(p));
}

/**
 * Returns true when the resolved permission set grants at least one
 * of `required`. The wildcard always wins.
 */
export function hasAnyPermission(
  perms: string[] | null | undefined,
  required: string[]
): boolean {
  if (!perms || perms.length === 0) return false;
  if (perms.includes(WILDCARD)) return true;
  return required.some((p) => perms.includes(p));
}

// ============================================
// DEVELOPMENT-ONLY AUDIT
// ============================================
//
// Runs at module load in dev/test. Verifies that every flag
// `buildPermissionsFromSet` reads corresponds to a string that at
// least ONE non-super role table grants. A flag that no role can
// ever turn on is almost always a typo or a forgotten table entry.
//
// In production this is a no-op so we don't pay the cost.
//
// ⚠️ If you intentionally add a flag that no role has (e.g. a
//    future feature gated by a not-yet-shipped permission), add
//    the flag name to `INTENTIONALLY_UNASSIGNED` below.

const INTENTIONALLY_UNASSIGNED = new Set<string>([
  // Admin-only destructive actions that no non-super role should
  // carry. Super-admins bypass the role tables via the `'*'`
  // wildcard, so these flags are reachable without being present
  // in any role table.
  'supplier:delete',
  'company:manage',
]);

function auditRoleTables(): void {
  if (
    typeof process === 'undefined' ||
    (process.env.NODE_ENV !== 'development' &&
      process.env.NODE_ENV !== 'test')
  ) {
    return;
  }

  // Every string that `buildPermissionsFromSet` reads.
  const flagsRead: string[] = [
    'dashboard:view', 'dashboard:manage',
    'category:view', 'category:manage',
    'product:view', 'product:manage', 'product:export', 'product:import',
    'order:view', 'order:manage',
    'customer:view', 'customer:manage',
    'inventory:view', 'inventory:create', 'inventory:edit',
    'inventory:delete', 'inventory:manage', 'inventory:export',
    'inventory:import', 'inventory:adjust', 'inventory:transfer',
    'inventory:issue', 'inventory:restock',
    'inventory:view_low_stock', 'inventory:view_reports',
    'inventory:view_audit',
    'report:view',
    'user:manage', 'user:view', 'user:create', 'user:edit',
    'user:delete', 'user:role:update', 'user:permission:update',
    'activity:view', 'user:export', 'user:import', 'user:invite',
    'group:manage',
    'settings:manage',
    'supplier:view', 'supplier:manage', 'supplier:create',
    'supplier:edit', 'supplier:delete',
    'sale:view', 'sale:manage',
    'analytics:view', 'pos:manage',
    'return:view', 'return:manage',
    'invoice:view', 'invoice:manage',
    'receipt:view', 'receipt:print',
    'product:view', 'product:manage', // barcodes
    'business_unit:view', 'business_unit:manage',
    'company:view', 'company:manage',
    'payment:view', 'payment:manage', 'payment:refund',
    'accounting:view', 'accounting:manage', 'accounting:create',
    'shift:view', 'shift:manage', 'shift:start', 'shift:end',
    'cash_register:view', 'cash_register:manage',
  ];

  const roleTables: Array<[string, string[]]> = [
    ['ADMIN', ADMIN_PERMISSIONS],
    ['MANAGER', MANAGER_PERMISSIONS],
    ['EDITOR', EDITOR_PERMISSIONS],
    ['VIEWER', VIEWER_PERMISSIONS],
    ['EMPLOYEE', EMPLOYEE_PERMISSIONS],
    ['CASHIER', CASHIER_PERMISSIONS],
    ['USER', USER_PERMISSIONS],
  ];

  const unassigned: string[] = [];
  for (const flag of flagsRead) {
    if (INTENTIONALLY_UNASSIGNED.has(flag)) continue;
    const granted = roleTables.some(([, table]) => table.includes(flag));
    if (!granted) unassigned.push(flag);
  }

  if (unassigned.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[permissions] Role tables do not grant these flags to any ' +
        'non-super role:\n  ' +
        unassigned.join('\n  ') +
        '\nAdd the flag to at least one role table, or add it to ' +
        'INTENTIONALLY_UNASSIGNED in types/permissions.ts.'
    );
  }
}

auditRoleTables();
