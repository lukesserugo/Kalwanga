// packages/backend/src/lib/permissions.ts

// ============================================
// PERMISSION CATALOGUE
// ============================================
//
// The single source of truth for every permission string the
// backend recognises. Mirrored on the frontend in
// `packages/web/types/permissions.ts` — keep both catalogues in
// sync. Any string that appears in one MUST appear in the other.

export const PERMISSION_CATALOGUE = {
  // ---------- Users ----------
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
  USER_IMPORT: 'user:import',
  USER_INVITE: 'user:invite',

  // ---------- Groups ----------
  GROUP_VIEW: 'group:view',
  GROUP_CREATE: 'group:create',
  GROUP_EDIT: 'group:edit',
  GROUP_DELETE: 'group:delete',
  GROUP_MANAGE: 'group:manage',

  // ---------- Invitations ----------
  INVITATION_VIEW: 'invitation:view',
  INVITATION_CREATE: 'invitation:create',
  INVITATION_EDIT: 'invitation:edit',
  INVITATION_DELETE: 'invitation:delete',
  INVITATION_RESEND: 'invitation:resend',
  INVITATION_CANCEL: 'invitation:cancel',

  // ---------- Business Units ----------
  BUSINESS_UNIT_VIEW: 'business_unit:view',
  BUSINESS_UNIT_CREATE: 'business_unit:create',
  BUSINESS_UNIT_EDIT: 'business_unit:edit',
  BUSINESS_UNIT_DELETE: 'business_unit:delete',
  BUSINESS_UNIT_MANAGE: 'business_unit:manage',

  // ---------- Companies ----------
  COMPANY_VIEW: 'company:view',
  COMPANY_MANAGE: 'company:manage',

  // ---------- Categories ----------
  CATEGORY_VIEW: 'category:view',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_EDIT: 'category:edit',
  CATEGORY_DELETE: 'category:delete',
  CATEGORY_MANAGE: 'category:manage',

  // ---------- Products ----------
  PRODUCT_VIEW: 'product:view',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_EDIT: 'product:edit',
  PRODUCT_DELETE: 'product:delete',
  PRODUCT_MANAGE: 'product:manage',
  PRODUCT_EXPORT: 'product:export',
  PRODUCT_IMPORT: 'product:import',

  // ---------- Suppliers ----------
  SUPPLIER_VIEW: 'supplier:view',
  SUPPLIER_CREATE: 'supplier:create',
  SUPPLIER_EDIT: 'supplier:edit',
  SUPPLIER_DELETE: 'supplier:delete',
  SUPPLIER_MANAGE: 'supplier:manage',

  // ---------- Inventory ----------
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_TRANSFER: 'inventory:transfer',
  INVENTORY_ISSUE: 'inventory:issue',
  INVENTORY_RESTOCK: 'inventory:restock',
  INVENTORY_VIEW_LOW_STOCK: 'inventory:view_low_stock',
  INVENTORY_VIEW_REPORTS: 'inventory:view_reports',
  INVENTORY_VIEW_AUDIT: 'inventory:view_audit',
  INVENTORY_EXPORT: 'inventory:export',
  INVENTORY_IMPORT: 'inventory:import',
  INVENTORY_MANAGE_SETTINGS: 'inventory:manage_settings',
  INVENTORY_APPROVE_TRANSFERS: 'inventory:approve_transfers',

  // ---------- Orders ----------
  ORDER_VIEW: 'order:view',
  ORDER_CREATE: 'order:create',
  ORDER_EDIT: 'order:edit',
  ORDER_DELETE: 'order:delete',
  ORDER_MANAGE: 'order:manage',
  ORDER_PROCESS: 'order:process',
  ORDER_CANCEL: 'order:cancel',

  // ---------- Customers ----------
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_EDIT: 'customer:edit',
  CUSTOMER_DELETE: 'customer:delete',
  CUSTOMER_MANAGE: 'customer:manage',

  // ---------- Sales ----------
  SALE_VIEW: 'sale:view',
  SALE_CREATE: 'sale:create',
  SALE_EDIT: 'sale:edit',
  SALE_DELETE: 'sale:delete',
  SALE_MANAGE: 'sale:manage',
  SALE_EXPORT: 'sale:export',
  SALE_PRINT: 'sale:print',
  SALE_EMAIL: 'sale:email',

  // ---------- POS ----------
  POS_VIEW: 'pos:view',
  POS_CREATE: 'pos:create',
  POS_MANAGE: 'pos:manage',
  POS_PRINT: 'pos:print',

  // ---------- Cash Register ----------
  CASH_REGISTER_VIEW: 'cash_register:view',
  CASH_REGISTER_MANAGE: 'cash_register:manage',
  CASH_REGISTER_OPEN: 'cash_register:open',
  CASH_REGISTER_CLOSE: 'cash_register:close',

  // ---------- Shifts ----------
  SHIFT_VIEW: 'shift:view',
  SHIFT_MANAGE: 'shift:manage',
  SHIFT_START: 'shift:start',
  SHIFT_END: 'shift:end',

  // ---------- Returns ----------
  RETURN_VIEW: 'return:view',
  RETURN_CREATE: 'return:create',
  RETURN_EDIT: 'return:edit',
  RETURN_DELETE: 'return:delete',
  RETURN_MANAGE: 'return:manage',
  RETURN_APPROVE: 'return:approve',
  RETURN_REJECT: 'return:reject',
  RETURN_PROCESS: 'return:process',

  // ---------- Refunds ----------
  REFUND_VIEW: 'refund:view',
  REFUND_CREATE: 'refund:create',
  REFUND_EDIT: 'refund:edit',
  REFUND_DELETE: 'refund:delete',
  REFUND_MANAGE: 'refund:manage',
  REFUND_APPROVE: 'refund:approve',
  REFUND_REJECT: 'refund:reject',
  REFUND_COMPLETE: 'refund:complete',

  // ---------- Invoices ----------
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

  // ---------- Receipts ----------
  RECEIPT_VIEW: 'receipt:view',
  RECEIPT_CREATE: 'receipt:create',
  RECEIPT_EDIT: 'receipt:edit',
  RECEIPT_DELETE: 'receipt:delete',
  RECEIPT_MANAGE: 'receipt:manage',
  RECEIPT_PRINT: 'receipt:print',
  RECEIPT_EMAIL: 'receipt:email',
  RECEIPT_VOID: 'receipt:void',

  // ---------- Payments ----------
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_MANAGE: 'payment:manage',
  PAYMENT_REFUND: 'payment:refund',

  // ---------- Reports ----------
  REPORT_VIEW: 'report:view',
  REPORT_CREATE: 'report:create',
  REPORT_EXPORT: 'report:export',
  REPORT_MANAGE: 'report:manage',

  // ---------- Analytics ----------
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // ---------- Settings ----------
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  SETTINGS_MANAGE: 'settings:manage',

  // ---------- System ----------
  SYSTEM_LOGS: 'system:logs',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  SYSTEM_SETTINGS: 'system:settings',

  // ---------- Dashboard ----------
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_MANAGE: 'dashboard:manage',

  // ---------- Integrations ----------
  INTEGRATION_VIEW: 'integration:view',
  INTEGRATION_MANAGE: 'integration:manage',
  API_VIEW: 'api:view',
  API_MANAGE: 'api:manage',
  WEBHOOK_VIEW: 'webhook:view',
  WEBHOOK_MANAGE: 'webhook:manage',

  // ---------- Audit & Activity ----------
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',
  ACTIVITY_VIEW: 'activity:view',
  ACTIVITY_CLEAR: 'activity:clear',
  ACTIVITY_EXPORT: 'activity:export',

  // ---------- Imports / Exports ----------
  IMPORT_VIEW: 'import:view',
  IMPORT_CREATE: 'import:create',
  IMPORT_DELETE: 'import:delete',
  IMPORT_VALIDATE: 'import:validate',
  EXPORT_VIEW: 'export:view',
  EXPORT_CREATE: 'export:create',
  EXPORT_DELETE: 'export:delete',

  // ---------- Accounting ----------
  ACCOUNTING_VIEW: 'accounting:view',
  ACCOUNTING_CREATE: 'accounting:create',
  ACCOUNTING_EDIT: 'accounting:edit',
  ACCOUNTING_DELETE: 'accounting:delete',
  ACCOUNTING_POST: 'accounting:post',
  ACCOUNTING_VOID: 'accounting:void',

  // ---------- Tax ----------
  TAX_VIEW: 'tax:view',
  TAX_CREATE: 'tax:create',
  TAX_EDIT: 'tax:edit',
  TAX_DELETE: 'tax:delete',
  TAX_FILE: 'tax:file',
} as const;

export type PermissionKey = keyof typeof PERMISSION_CATALOGUE;
export type Permission = (typeof PERMISSION_CATALOGUE)[PermissionKey];

/** Wildcard that SUPER_ADMIN implicitly holds. */
export const WILDCARD = '*' as const;

/** Every permission string, in a stable order. */
export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_CATALOGUE);

// ============================================
// ROLE → PERMISSIONS
// ============================================
//
// Role → permission list, for every role EXCEPT SUPER_ADMIN.
//
// SUPER_ADMIN is intentionally omitted. It always gets every
// permission plus '*'. Do not add SUPER_ADMIN here.
//
// ⚠️ Every entry here MUST be a value defined in
//    `PERMISSION_CATALOGUE`. Every permission string that the
//    backend middleware checks via `permissionSetHas` should be
//    granted to at least one non-super role — otherwise it can
//    never be satisfied by anyone but SUPER_ADMIN, which is
//    almost always a mistake.
//
//    The dev-only `auditRolePermissions()` at the bottom of this
//    file enforces that invariant.

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [
    // Users & groups
    PERMISSION_CATALOGUE.USER_VIEW,
    PERMISSION_CATALOGUE.USER_CREATE,
    PERMISSION_CATALOGUE.USER_EDIT,
    PERMISSION_CATALOGUE.USER_DELETE,
    PERMISSION_CATALOGUE.USER_MANAGE,
    PERMISSION_CATALOGUE.USER_ACTIVATE,
    PERMISSION_CATALOGUE.USER_DEACTIVATE,
    PERMISSION_CATALOGUE.USER_ROLE_UPDATE,
    PERMISSION_CATALOGUE.USER_PERMISSION_UPDATE,
    PERMISSION_CATALOGUE.USER_EXPORT,
    PERMISSION_CATALOGUE.USER_IMPORT,
    PERMISSION_CATALOGUE.USER_INVITE,

    PERMISSION_CATALOGUE.GROUP_VIEW,
    PERMISSION_CATALOGUE.GROUP_CREATE,
    PERMISSION_CATALOGUE.GROUP_EDIT,
    PERMISSION_CATALOGUE.GROUP_DELETE,

    PERMISSION_CATALOGUE.INVITATION_VIEW,
    PERMISSION_CATALOGUE.INVITATION_CREATE,
    PERMISSION_CATALOGUE.INVITATION_EDIT,
    PERMISSION_CATALOGUE.INVITATION_DELETE,
    PERMISSION_CATALOGUE.INVITATION_RESEND,

    // Tenancy
    PERMISSION_CATALOGUE.BUSINESS_UNIT_VIEW,
    PERMISSION_CATALOGUE.BUSINESS_UNIT_CREATE,
    PERMISSION_CATALOGUE.BUSINESS_UNIT_EDIT,
    PERMISSION_CATALOGUE.BUSINESS_UNIT_DELETE,

    PERMISSION_CATALOGUE.COMPANY_VIEW,
    // ✅ FIXED: `company:manage` was declared in the catalogue but
    //    never granted to any role. Company-level operations
    //    (create, rename, deactivate) belong to ADMIN, same tier
    //    as `business_unit:delete`. Without this, the permission
    //    could never be satisfied by anyone except SUPER_ADMIN.
    PERMISSION_CATALOGUE.COMPANY_MANAGE,

    // Catalog
    PERMISSION_CATALOGUE.CATEGORY_VIEW,
    PERMISSION_CATALOGUE.CATEGORY_CREATE,
    PERMISSION_CATALOGUE.CATEGORY_EDIT,
    PERMISSION_CATALOGUE.CATEGORY_DELETE,

    PERMISSION_CATALOGUE.PRODUCT_VIEW,
    PERMISSION_CATALOGUE.PRODUCT_CREATE,
    PERMISSION_CATALOGUE.PRODUCT_EDIT,
    PERMISSION_CATALOGUE.PRODUCT_DELETE,
    PERMISSION_CATALOGUE.PRODUCT_MANAGE,
    PERMISSION_CATALOGUE.PRODUCT_EXPORT,
    PERMISSION_CATALOGUE.PRODUCT_IMPORT,

    PERMISSION_CATALOGUE.SUPPLIER_VIEW,
    PERMISSION_CATALOGUE.SUPPLIER_CREATE,
    PERMISSION_CATALOGUE.SUPPLIER_EDIT,
    // ✅ FIXED: `supplier:delete` was declared in the catalogue
    //    but never granted to any role. Managers create/edit
    //    suppliers; admins delete them — the same split used for
    //    categories, products, customers, and every other
    //    create/edit/delete triad in this file.
    PERMISSION_CATALOGUE.SUPPLIER_DELETE,

    // Inventory
    PERMISSION_CATALOGUE.INVENTORY_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_CREATE,
    PERMISSION_CATALOGUE.INVENTORY_EDIT,
    PERMISSION_CATALOGUE.INVENTORY_DELETE,
    PERMISSION_CATALOGUE.INVENTORY_MANAGE,
    PERMISSION_CATALOGUE.INVENTORY_ADJUST,
    PERMISSION_CATALOGUE.INVENTORY_TRANSFER,
    PERMISSION_CATALOGUE.INVENTORY_ISSUE,
    PERMISSION_CATALOGUE.INVENTORY_RESTOCK,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_LOW_STOCK,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_REPORTS,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_AUDIT,
    PERMISSION_CATALOGUE.INVENTORY_EXPORT,
    PERMISSION_CATALOGUE.INVENTORY_IMPORT,
    PERMISSION_CATALOGUE.INVENTORY_MANAGE_SETTINGS,
    PERMISSION_CATALOGUE.INVENTORY_APPROVE_TRANSFERS,

    // Orders
    PERMISSION_CATALOGUE.ORDER_VIEW,
    PERMISSION_CATALOGUE.ORDER_CREATE,
    PERMISSION_CATALOGUE.ORDER_EDIT,
    PERMISSION_CATALOGUE.ORDER_DELETE,
    PERMISSION_CATALOGUE.ORDER_MANAGE,
    PERMISSION_CATALOGUE.ORDER_PROCESS,
    PERMISSION_CATALOGUE.ORDER_CANCEL,

    // Customers
    PERMISSION_CATALOGUE.CUSTOMER_VIEW,
    PERMISSION_CATALOGUE.CUSTOMER_CREATE,
    PERMISSION_CATALOGUE.CUSTOMER_EDIT,
    PERMISSION_CATALOGUE.CUSTOMER_DELETE,
    PERMISSION_CATALOGUE.CUSTOMER_MANAGE,

    // Sales & POS
    PERMISSION_CATALOGUE.SALE_VIEW,
    PERMISSION_CATALOGUE.SALE_CREATE,
    PERMISSION_CATALOGUE.SALE_EDIT,
    PERMISSION_CATALOGUE.SALE_DELETE,
    PERMISSION_CATALOGUE.SALE_MANAGE,
    PERMISSION_CATALOGUE.SALE_EXPORT,
    PERMISSION_CATALOGUE.SALE_PRINT,
    PERMISSION_CATALOGUE.SALE_EMAIL,

    PERMISSION_CATALOGUE.POS_VIEW,
    PERMISSION_CATALOGUE.POS_CREATE,
    PERMISSION_CATALOGUE.POS_MANAGE,
    PERMISSION_CATALOGUE.POS_PRINT,

    // Cash register & shifts
    PERMISSION_CATALOGUE.CASH_REGISTER_VIEW,
    PERMISSION_CATALOGUE.CASH_REGISTER_MANAGE,
    PERMISSION_CATALOGUE.CASH_REGISTER_OPEN,
    PERMISSION_CATALOGUE.CASH_REGISTER_CLOSE,

    PERMISSION_CATALOGUE.SHIFT_VIEW,
    PERMISSION_CATALOGUE.SHIFT_MANAGE,
    PERMISSION_CATALOGUE.SHIFT_START,
    PERMISSION_CATALOGUE.SHIFT_END,

    // Returns & refunds
    PERMISSION_CATALOGUE.RETURN_VIEW,
    PERMISSION_CATALOGUE.RETURN_CREATE,
    PERMISSION_CATALOGUE.RETURN_EDIT,
    PERMISSION_CATALOGUE.RETURN_DELETE,
    PERMISSION_CATALOGUE.RETURN_MANAGE,
    PERMISSION_CATALOGUE.RETURN_APPROVE,
    PERMISSION_CATALOGUE.RETURN_REJECT,
    PERMISSION_CATALOGUE.RETURN_PROCESS,

    PERMISSION_CATALOGUE.REFUND_VIEW,
    PERMISSION_CATALOGUE.REFUND_CREATE,
    PERMISSION_CATALOGUE.REFUND_EDIT,
    PERMISSION_CATALOGUE.REFUND_DELETE,
    PERMISSION_CATALOGUE.REFUND_MANAGE,
    PERMISSION_CATALOGUE.REFUND_APPROVE,
    PERMISSION_CATALOGUE.REFUND_REJECT,
    PERMISSION_CATALOGUE.REFUND_COMPLETE,

    // Invoices & receipts
    PERMISSION_CATALOGUE.INVOICE_VIEW,
    PERMISSION_CATALOGUE.INVOICE_CREATE,
    PERMISSION_CATALOGUE.INVOICE_EDIT,
    PERMISSION_CATALOGUE.INVOICE_DELETE,
    PERMISSION_CATALOGUE.INVOICE_MANAGE,
    PERMISSION_CATALOGUE.INVOICE_SEND,
    PERMISSION_CATALOGUE.INVOICE_PRINT,
    PERMISSION_CATALOGUE.INVOICE_PAID,
    PERMISSION_CATALOGUE.INVOICE_VOID,
    PERMISSION_CATALOGUE.INVOICE_CANCEL,

    PERMISSION_CATALOGUE.RECEIPT_VIEW,
    PERMISSION_CATALOGUE.RECEIPT_CREATE,
    PERMISSION_CATALOGUE.RECEIPT_EDIT,
    PERMISSION_CATALOGUE.RECEIPT_DELETE,
    PERMISSION_CATALOGUE.RECEIPT_MANAGE,
    PERMISSION_CATALOGUE.RECEIPT_PRINT,
    PERMISSION_CATALOGUE.RECEIPT_EMAIL,
    PERMISSION_CATALOGUE.RECEIPT_VOID,

    // Payments
    PERMISSION_CATALOGUE.PAYMENT_VIEW,
    PERMISSION_CATALOGUE.PAYMENT_CREATE,
    PERMISSION_CATALOGUE.PAYMENT_MANAGE,
    PERMISSION_CATALOGUE.PAYMENT_REFUND,

    // Reports & analytics
    PERMISSION_CATALOGUE.REPORT_VIEW,
    PERMISSION_CATALOGUE.REPORT_CREATE,
    PERMISSION_CATALOGUE.REPORT_EXPORT,
    PERMISSION_CATALOGUE.REPORT_MANAGE,

    PERMISSION_CATALOGUE.ANALYTICS_VIEW,
    PERMISSION_CATALOGUE.ANALYTICS_EXPORT,

    // Settings
    PERMISSION_CATALOGUE.SETTINGS_VIEW,
    PERMISSION_CATALOGUE.SETTINGS_EDIT,
    PERMISSION_CATALOGUE.SETTINGS_MANAGE,

    // Dashboard
    PERMISSION_CATALOGUE.DASHBOARD_VIEW,
    PERMISSION_CATALOGUE.DASHBOARD_MANAGE,

    // Integrations
    PERMISSION_CATALOGUE.INTEGRATION_VIEW,
    PERMISSION_CATALOGUE.INTEGRATION_MANAGE,
    PERMISSION_CATALOGUE.API_VIEW,
    PERMISSION_CATALOGUE.API_MANAGE,
    PERMISSION_CATALOGUE.WEBHOOK_VIEW,
    PERMISSION_CATALOGUE.WEBHOOK_MANAGE,

    // Audit & activity
    PERMISSION_CATALOGUE.AUDIT_VIEW,
    PERMISSION_CATALOGUE.AUDIT_EXPORT,
    PERMISSION_CATALOGUE.ACTIVITY_VIEW,
    PERMISSION_CATALOGUE.ACTIVITY_CLEAR,
    PERMISSION_CATALOGUE.ACTIVITY_EXPORT,

    // Imports / exports
    PERMISSION_CATALOGUE.IMPORT_VIEW,
    PERMISSION_CATALOGUE.IMPORT_CREATE,
    PERMISSION_CATALOGUE.IMPORT_DELETE,
    PERMISSION_CATALOGUE.IMPORT_VALIDATE,
    PERMISSION_CATALOGUE.EXPORT_VIEW,
    PERMISSION_CATALOGUE.EXPORT_CREATE,
    PERMISSION_CATALOGUE.EXPORT_DELETE,

    // Accounting
    PERMISSION_CATALOGUE.ACCOUNTING_VIEW,
    PERMISSION_CATALOGUE.ACCOUNTING_CREATE,
    PERMISSION_CATALOGUE.ACCOUNTING_EDIT,
    PERMISSION_CATALOGUE.ACCOUNTING_DELETE,
    PERMISSION_CATALOGUE.ACCOUNTING_POST,
    PERMISSION_CATALOGUE.ACCOUNTING_VOID,

    // Tax
    PERMISSION_CATALOGUE.TAX_VIEW,
    PERMISSION_CATALOGUE.TAX_CREATE,
    PERMISSION_CATALOGUE.TAX_EDIT,
    PERMISSION_CATALOGUE.TAX_DELETE,
    PERMISSION_CATALOGUE.TAX_FILE,
  ],

  MANAGER: [
    // Users (read-only + light)
    PERMISSION_CATALOGUE.USER_VIEW,
    PERMISSION_CATALOGUE.USER_EDIT,
    PERMISSION_CATALOGUE.USER_ACTIVATE,
    PERMISSION_CATALOGUE.USER_DEACTIVATE,

    PERMISSION_CATALOGUE.GROUP_VIEW,
    PERMISSION_CATALOGUE.INVITATION_VIEW,

    // Tenancy (read-only)
    PERMISSION_CATALOGUE.BUSINESS_UNIT_VIEW,
    PERMISSION_CATALOGUE.COMPANY_VIEW,

    // Catalog
    PERMISSION_CATALOGUE.CATEGORY_VIEW,
    PERMISSION_CATALOGUE.CATEGORY_CREATE,
    PERMISSION_CATALOGUE.CATEGORY_EDIT,

    PERMISSION_CATALOGUE.PRODUCT_VIEW,
    PERMISSION_CATALOGUE.PRODUCT_CREATE,
    PERMISSION_CATALOGUE.PRODUCT_EDIT,
    PERMISSION_CATALOGUE.PRODUCT_MANAGE,
    PERMISSION_CATALOGUE.PRODUCT_EXPORT,

    PERMISSION_CATALOGUE.SUPPLIER_VIEW,
    PERMISSION_CATALOGUE.SUPPLIER_CREATE,
    PERMISSION_CATALOGUE.SUPPLIER_EDIT,

    // Inventory
    PERMISSION_CATALOGUE.INVENTORY_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_CREATE,
    PERMISSION_CATALOGUE.INVENTORY_EDIT,
    PERMISSION_CATALOGUE.INVENTORY_ADJUST,
    PERMISSION_CATALOGUE.INVENTORY_TRANSFER,
    PERMISSION_CATALOGUE.INVENTORY_ISSUE,
    PERMISSION_CATALOGUE.INVENTORY_RESTOCK,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_LOW_STOCK,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_REPORTS,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_AUDIT,
    PERMISSION_CATALOGUE.INVENTORY_MANAGE_SETTINGS,
    PERMISSION_CATALOGUE.INVENTORY_APPROVE_TRANSFERS,

    // Orders
    PERMISSION_CATALOGUE.ORDER_VIEW,
    PERMISSION_CATALOGUE.ORDER_CREATE,
    PERMISSION_CATALOGUE.ORDER_EDIT,
    PERMISSION_CATALOGUE.ORDER_MANAGE,
    PERMISSION_CATALOGUE.ORDER_PROCESS,
    PERMISSION_CATALOGUE.ORDER_CANCEL,

    // Customers
    PERMISSION_CATALOGUE.CUSTOMER_VIEW,
    PERMISSION_CATALOGUE.CUSTOMER_CREATE,
    PERMISSION_CATALOGUE.CUSTOMER_EDIT,
    PERMISSION_CATALOGUE.CUSTOMER_MANAGE,

    // Sales & POS
    PERMISSION_CATALOGUE.SALE_VIEW,
    PERMISSION_CATALOGUE.SALE_CREATE,
    PERMISSION_CATALOGUE.SALE_EDIT,
    PERMISSION_CATALOGUE.SALE_MANAGE,
    PERMISSION_CATALOGUE.SALE_EXPORT,
    PERMISSION_CATALOGUE.SALE_PRINT,
    PERMISSION_CATALOGUE.SALE_EMAIL,

    PERMISSION_CATALOGUE.POS_VIEW,
    PERMISSION_CATALOGUE.POS_CREATE,
    PERMISSION_CATALOGUE.POS_MANAGE,
    PERMISSION_CATALOGUE.POS_PRINT,

    // Cash register & shifts
    PERMISSION_CATALOGUE.CASH_REGISTER_VIEW,
    PERMISSION_CATALOGUE.CASH_REGISTER_MANAGE,
    PERMISSION_CATALOGUE.CASH_REGISTER_OPEN,
    PERMISSION_CATALOGUE.CASH_REGISTER_CLOSE,

    PERMISSION_CATALOGUE.SHIFT_VIEW,
    PERMISSION_CATALOGUE.SHIFT_MANAGE,
    PERMISSION_CATALOGUE.SHIFT_START,
    PERMISSION_CATALOGUE.SHIFT_END,

    // Returns & refunds
    PERMISSION_CATALOGUE.RETURN_VIEW,
    PERMISSION_CATALOGUE.RETURN_CREATE,
    PERMISSION_CATALOGUE.RETURN_EDIT,
    PERMISSION_CATALOGUE.RETURN_APPROVE,
    PERMISSION_CATALOGUE.RETURN_REJECT,
    PERMISSION_CATALOGUE.RETURN_PROCESS,

    PERMISSION_CATALOGUE.REFUND_VIEW,
    PERMISSION_CATALOGUE.REFUND_CREATE,
    PERMISSION_CATALOGUE.REFUND_EDIT,
    PERMISSION_CATALOGUE.REFUND_APPROVE,
    PERMISSION_CATALOGUE.REFUND_REJECT,
    PERMISSION_CATALOGUE.REFUND_COMPLETE,

    // Invoices & receipts
    PERMISSION_CATALOGUE.INVOICE_VIEW,
    PERMISSION_CATALOGUE.INVOICE_CREATE,
    PERMISSION_CATALOGUE.INVOICE_EDIT,
    PERMISSION_CATALOGUE.INVOICE_SEND,
    PERMISSION_CATALOGUE.INVOICE_PRINT,
    PERMISSION_CATALOGUE.INVOICE_PAID,

    PERMISSION_CATALOGUE.RECEIPT_VIEW,
    PERMISSION_CATALOGUE.RECEIPT_CREATE,
    PERMISSION_CATALOGUE.RECEIPT_EDIT,
    PERMISSION_CATALOGUE.RECEIPT_PRINT,
    PERMISSION_CATALOGUE.RECEIPT_EMAIL,

    // Payments
    PERMISSION_CATALOGUE.PAYMENT_VIEW,
    PERMISSION_CATALOGUE.PAYMENT_CREATE,

    // Reports & analytics
    PERMISSION_CATALOGUE.REPORT_VIEW,
    PERMISSION_CATALOGUE.REPORT_CREATE,
    PERMISSION_CATALOGUE.REPORT_EXPORT,

    PERMISSION_CATALOGUE.ANALYTICS_VIEW,

    // Settings
    PERMISSION_CATALOGUE.SETTINGS_VIEW,

    // Dashboard
    PERMISSION_CATALOGUE.DASHBOARD_VIEW,
    PERMISSION_CATALOGUE.DASHBOARD_MANAGE,

    // Activity
    PERMISSION_CATALOGUE.ACTIVITY_VIEW,
  ],

  EDITOR: [
    // Users (read-only)
    PERMISSION_CATALOGUE.USER_VIEW,
    PERMISSION_CATALOGUE.GROUP_VIEW,

    // Tenancy (read-only)
    PERMISSION_CATALOGUE.BUSINESS_UNIT_VIEW,
    PERMISSION_CATALOGUE.COMPANY_VIEW,

    // Catalog
    PERMISSION_CATALOGUE.CATEGORY_VIEW,
    PERMISSION_CATALOGUE.CATEGORY_CREATE,
    PERMISSION_CATALOGUE.CATEGORY_EDIT,

    PERMISSION_CATALOGUE.PRODUCT_VIEW,
    PERMISSION_CATALOGUE.PRODUCT_CREATE,
    PERMISSION_CATALOGUE.PRODUCT_EDIT,
    PERMISSION_CATALOGUE.PRODUCT_MANAGE,

    PERMISSION_CATALOGUE.SUPPLIER_VIEW,
    PERMISSION_CATALOGUE.SUPPLIER_CREATE,
    PERMISSION_CATALOGUE.SUPPLIER_EDIT,

    // Inventory
    PERMISSION_CATALOGUE.INVENTORY_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_CREATE,
    PERMISSION_CATALOGUE.INVENTORY_EDIT,
    PERMISSION_CATALOGUE.INVENTORY_ADJUST,
    PERMISSION_CATALOGUE.INVENTORY_RESTOCK,
    PERMISSION_CATALOGUE.INVENTORY_ISSUE,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_LOW_STOCK,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_AUDIT,

    // Orders
    PERMISSION_CATALOGUE.ORDER_VIEW,
    PERMISSION_CATALOGUE.ORDER_CREATE,

    // Customers
    PERMISSION_CATALOGUE.CUSTOMER_VIEW,
    PERMISSION_CATALOGUE.CUSTOMER_CREATE,
    PERMISSION_CATALOGUE.CUSTOMER_EDIT,

    // Sales & POS
    PERMISSION_CATALOGUE.SALE_VIEW,
    PERMISSION_CATALOGUE.SALE_CREATE,
    PERMISSION_CATALOGUE.SALE_EDIT,
    PERMISSION_CATALOGUE.SALE_PRINT,
    PERMISSION_CATALOGUE.SALE_EMAIL,

    PERMISSION_CATALOGUE.POS_VIEW,
    PERMISSION_CATALOGUE.POS_CREATE,
    PERMISSION_CATALOGUE.POS_PRINT,

    // Cash register & shifts    PERMISSION_CATALOGUE.CASH_REGISTER_VIEW,
    PERMISSION_CATALOGUE.CASH_REGISTER_OPEN,

    PERMISSION_CATALOGUE.SHIFT_VIEW,
    PERMISSION_CATALOGUE.SHIFT_START,

    // Returns & refunds
    PERMISSION_CATALOGUE.RETURN_VIEW,
    PERMISSION_CATALOGUE.RETURN_CREATE,
    PERMISSION_CATALOGUE.RETURN_EDIT,

    PERMISSION_CATALOGUE.REFUND_VIEW,
    PERMISSION_CATALOGUE.REFUND_CREATE,
    PERMISSION_CATALOGUE.REFUND_EDIT,

    // Invoices & receipts
    PERMISSION_CATALOGUE.INVOICE_VIEW,
    PERMISSION_CATALOGUE.INVOICE_CREATE,
    PERMISSION_CATALOGUE.INVOICE_EDIT,
    PERMISSION_CATALOGUE.INVOICE_SEND,
    PERMISSION_CATALOGUE.INVOICE_PRINT,

    PERMISSION_CATALOGUE.RECEIPT_VIEW,
    PERMISSION_CATALOGUE.RECEIPT_CREATE,
    PERMISSION_CATALOGUE.RECEIPT_EDIT,
    PERMISSION_CATALOGUE.RECEIPT_PRINT,
    PERMISSION_CATALOGUE.RECEIPT_EMAIL,

    // Payments
    PERMISSION_CATALOGUE.PAYMENT_VIEW,
    PERMISSION_CATALOGUE.PAYMENT_CREATE,

    // Reports & analytics
    PERMISSION_CATALOGUE.REPORT_VIEW,
    PERMISSION_CATALOGUE.REPORT_CREATE,

    PERMISSION_CATALOGUE.ANALYTICS_VIEW,

    // Dashboard
    PERMISSION_CATALOGUE.DASHBOARD_VIEW,

    // Activity
    PERMISSION_CATALOGUE.ACTIVITY_VIEW,
  ],

  VIEWER: [
    PERMISSION_CATALOGUE.USER_VIEW,
    PERMISSION_CATALOGUE.GROUP_VIEW,
    PERMISSION_CATALOGUE.BUSINESS_UNIT_VIEW,
    PERMISSION_CATALOGUE.COMPANY_VIEW,
    PERMISSION_CATALOGUE.CATEGORY_VIEW,
    PERMISSION_CATALOGUE.PRODUCT_VIEW,
    PERMISSION_CATALOGUE.SUPPLIER_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_LOW_STOCK,
    PERMISSION_CATALOGUE.ORDER_VIEW,
    PERMISSION_CATALOGUE.CUSTOMER_VIEW,
    PERMISSION_CATALOGUE.SALE_VIEW,
    PERMISSION_CATALOGUE.POS_VIEW,
    PERMISSION_CATALOGUE.CASH_REGISTER_VIEW,
    PERMISSION_CATALOGUE.SHIFT_VIEW,
    PERMISSION_CATALOGUE.RETURN_VIEW,
    PERMISSION_CATALOGUE.REFUND_VIEW,
    PERMISSION_CATALOGUE.INVOICE_VIEW,
    PERMISSION_CATALOGUE.RECEIPT_VIEW,
    PERMISSION_CATALOGUE.PAYMENT_VIEW,
    PERMISSION_CATALOGUE.REPORT_VIEW,
    PERMISSION_CATALOGUE.ANALYTICS_VIEW,
    PERMISSION_CATALOGUE.DASHBOARD_VIEW,
    PERMISSION_CATALOGUE.ACTIVITY_VIEW,
  ],

  EMPLOYEE: [
    PERMISSION_CATALOGUE.PRODUCT_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_VIEW_LOW_STOCK,
    PERMISSION_CATALOGUE.INVENTORY_ISSUE,
    PERMISSION_CATALOGUE.INVENTORY_RESTOCK,
    PERMISSION_CATALOGUE.ORDER_VIEW,
    PERMISSION_CATALOGUE.ORDER_CREATE,
    PERMISSION_CATALOGUE.CUSTOMER_VIEW,
    PERMISSION_CATALOGUE.CUSTOMER_CREATE,
    PERMISSION_CATALOGUE.SALE_VIEW,
    PERMISSION_CATALOGUE.SALE_CREATE,
    PERMISSION_CATALOGUE.POS_VIEW,
    PERMISSION_CATALOGUE.POS_CREATE,
    PERMISSION_CATALOGUE.CASH_REGISTER_VIEW,
    PERMISSION_CATALOGUE.RETURN_VIEW,
    PERMISSION_CATALOGUE.RETURN_CREATE,
    PERMISSION_CATALOGUE.REFUND_VIEW,
    PERMISSION_CATALOGUE.REFUND_CREATE,
    PERMISSION_CATALOGUE.RECEIPT_VIEW,
    PERMISSION_CATALOGUE.RECEIPT_CREATE,
    PERMISSION_CATALOGUE.RECEIPT_PRINT,
    PERMISSION_CATALOGUE.DASHBOARD_VIEW,
  ],

  CASHIER: [
    PERMISSION_CATALOGUE.PRODUCT_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_VIEW,
    PERMISSION_CATALOGUE.ORDER_VIEW,
    PERMISSION_CATALOGUE.ORDER_CREATE,
    PERMISSION_CATALOGUE.CUSTOMER_VIEW,
    PERMISSION_CATALOGUE.CUSTOMER_CREATE,
    PERMISSION_CATALOGUE.SALE_VIEW,
    PERMISSION_CATALOGUE.SALE_CREATE,
    PERMISSION_CATALOGUE.SALE_PRINT,
    PERMISSION_CATALOGUE.SALE_EMAIL,
    PERMISSION_CATALOGUE.POS_VIEW,
    PERMISSION_CATALOGUE.POS_CREATE,
    PERMISSION_CATALOGUE.POS_PRINT,
    PERMISSION_CATALOGUE.CASH_REGISTER_VIEW,
    PERMISSION_CATALOGUE.CASH_REGISTER_OPEN,
    PERMISSION_CATALOGUE.CASH_REGISTER_CLOSE,
    PERMISSION_CATALOGUE.SHIFT_VIEW,
    PERMISSION_CATALOGUE.SHIFT_START,
    PERMISSION_CATALOGUE.SHIFT_END,
    PERMISSION_CATALOGUE.RETURN_VIEW,
    PERMISSION_CATALOGUE.RETURN_CREATE,
    PERMISSION_CATALOGUE.REFUND_VIEW,
    PERMISSION_CATALOGUE.REFUND_CREATE,
    PERMISSION_CATALOGUE.RECEIPT_VIEW,
    PERMISSION_CATALOGUE.RECEIPT_CREATE,
    PERMISSION_CATALOGUE.RECEIPT_PRINT,
    PERMISSION_CATALOGUE.RECEIPT_EMAIL,
    PERMISSION_CATALOGUE.PAYMENT_VIEW,
    PERMISSION_CATALOGUE.PAYMENT_CREATE,
    PERMISSION_CATALOGUE.DASHBOARD_VIEW,
  ],

  USER: [
    PERMISSION_CATALOGUE.PRODUCT_VIEW,
    PERMISSION_CATALOGUE.INVENTORY_VIEW,
    PERMISSION_CATALOGUE.ORDER_VIEW,
    PERMISSION_CATALOGUE.SALE_VIEW,
    PERMISSION_CATALOGUE.SALE_CREATE,
    PERMISSION_CATALOGUE.RECEIPT_VIEW,
    PERMISSION_CATALOGUE.DASHBOARD_VIEW,
  ],
};

// ============================================
// RESOLUTION
// ============================================

/**
 * Resolve the effective permission list for a user.
 *
 * Rules (in order):
 *   1. SUPER_ADMIN → every permission + '*' (wildcard)
 *   2. If user.permissions is a non-empty array, use it verbatim
 *      (this is how "custom overrides" work)
 *   3. Otherwise, fall back to the role's default list
 *
 * This is the ONE function the rest of the backend should call.
 * Do not reimplement this logic anywhere else.
 *
 * ⚠️ Controllers that serialise a user for the frontend MUST call
 *    this and send the result as `user.permissions`. The frontend
 *    `useAuth` hook reads `user.permissions` and treats a present
 *    `'*'` as the wildcard — without going through this function,
 *    a SUPER_ADMIN would arrive with an empty `permissions` array
 *    and the frontend would have to guess from `role` alone.
 */
export function resolvePermissions(user: {
  role: string;
  permissions?: string[] | null;
}): string[] {
  if (user.role === 'SUPER_ADMIN') {
    return [WILDCARD, ...ALL_PERMISSIONS];
  }

  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    // If a custom override happens to contain the wildcard, honour it.
    return user.permissions;
  }

  return ROLE_PERMISSIONS[user.role] ?? [];
}

/**
 * Does a resolved permission set grant the given permission?
 *
 * The wildcard '*' matches everything. Exact string match otherwise.
 */
export function permissionSetHas(
  permissions: string[],
  required: string
): boolean {
  if (permissions.includes(WILDCARD)) return true;
  return permissions.includes(required);
}

// ============================================
// DEVELOPMENT-ONLY AUDIT
// ============================================
//
// Runs at module load in dev/test. Verifies two invariants:
//
//   1. Every string used in `ROLE_PERMISSIONS` is defined in
//      `PERMISSION_CATALOGUE`. A typo here silently grants
//      nothing — this catches it.
//
//   2. Every permission string the backend middleware is likely
//      to check is granted to at least one non-super role. A
//      permission granted to NO ONE can never be satisfied by
//      anyone but SUPER_ADMIN, which is almost always a mistake.
//
// In production this is a no-op so we don't pay the cost.

const INTENTIONALLY_UNASSIGNED = new Set<string>([
  // Add permission strings here when they are deliberately
  // role-less, e.g. a future feature gated by a not-yet-shipped
  // permission. Format: 'resource:action'.
  //
  // Every entry below MUST also be documented with a comment
  // explaining why. If you can't articulate a reason, the
  // permission probably belongs on a role.
  //
  // Examples (uncomment only if you really mean them):
  // 'system:backup',   // reserved for a not-yet-shipped CLI tool
  // 'system:restore',  // same
  // 'tax:file',        // reserved for the external tax-filing worker
]);

function auditRolePermissions(): void {
  if (
    typeof process === 'undefined' ||
    (process.env.NODE_ENV !== 'development' &&
      process.env.NODE_ENV !== 'test')
  ) {
    return;
  }

  const catalogueValues = new Set<string>(ALL_PERMISSIONS);

  // 1. Every entry in every role table must be a known permission.
  const unknown: Array<{ role: string; permission: string }> = [];
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    for (const p of perms) {
      if (!catalogueValues.has(p)) {
        unknown.push({ role, permission: p });
      }
    }
  }

  if (unknown.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[permissions] Role tables reference permission strings that ' +
        'are NOT in PERMISSION_CATALOGUE:\n  ' +
        unknown.map((u) => `${u.role}: ${u.permission}`).join('\n  ')
    );
  }

  // 2. Every catalogue entry must be granted to at least one role.
  const granted = new Set<string>();
  for (const perms of Object.values(ROLE_PERMISSIONS)) {
    for (const p of perms) granted.add(p);
  }

  const unassigned: string[] = [];
  for (const p of ALL_PERMISSIONS) {
    if (INTENTIONALLY_UNASSIGNED.has(p)) continue;
    if (!granted.has(p)) unassigned.push(p);
  }

  if (unassigned.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      '[permissions] PERMISSION_CATALOGUE entries granted to NO ' +
        'non-super role:\n  ' +
        unassigned.join('\n  ') +
        '\nAdd each to at least one role table, or list it in ' +
        'INTENTIONALLY_UNASSIGNED in lib/permissions.ts.'
    );
  }
}

auditRolePermissions();
