// D:\Projects\Kalwanga\packages\web\types\inventoryPermissions.ts

export type InventoryPermission = 
  | 'inventory:view'
  | 'inventory:create'
  | 'inventory:edit'
  | 'inventory:delete'
  | 'inventory:export'
  | 'inventory:import'
  | 'inventory:adjust'
  | 'inventory:transfer'
  | 'inventory:issue'
  | 'inventory:restock'
  | 'inventory:manage_categories'
  | 'inventory:manage_suppliers'
  | 'inventory:view_reports'
  | 'inventory:view_audit'
  | 'inventory:manage_settings'
  | 'inventory:view_low_stock'
  | 'inventory:approve_transfers';

export const INVENTORY_PERMISSIONS = {
  VIEW: 'inventory:view' as InventoryPermission,
  CREATE: 'inventory:create' as InventoryPermission,
  EDIT: 'inventory:edit' as InventoryPermission,
  DELETE: 'inventory:delete' as InventoryPermission,
  EXPORT: 'inventory:export' as InventoryPermission,
  IMPORT: 'inventory:import' as InventoryPermission,
  ADJUST: 'inventory:adjust' as InventoryPermission,
  TRANSFER: 'inventory:transfer' as InventoryPermission,
  ISSUE: 'inventory:issue' as InventoryPermission,
  RESTOCK: 'inventory:restock' as InventoryPermission,
  MANAGE_CATEGORIES: 'inventory:manage_categories' as InventoryPermission,
  MANAGE_SUPPLIERS: 'inventory:manage_suppliers' as InventoryPermission,
  VIEW_REPORTS: 'inventory:view_reports' as InventoryPermission,
  VIEW_AUDIT: 'inventory:view_audit' as InventoryPermission,
  MANAGE_SETTINGS: 'inventory:manage_settings' as InventoryPermission,
  VIEW_LOW_STOCK: 'inventory:view_low_stock' as InventoryPermission,
  APPROVE_TRANSFERS: 'inventory:approve_transfers' as InventoryPermission,
};

// Role-based permission mapping
export const INVENTORY_ROLE_PERMISSIONS: Record<string, InventoryPermission[]> = {
  SUPER_ADMIN: [
    INVENTORY_PERMISSIONS.VIEW,
    INVENTORY_PERMISSIONS.CREATE,
    INVENTORY_PERMISSIONS.EDIT,
    INVENTORY_PERMISSIONS.DELETE,
    INVENTORY_PERMISSIONS.EXPORT,
    INVENTORY_PERMISSIONS.IMPORT,
    INVENTORY_PERMISSIONS.ADJUST,
    INVENTORY_PERMISSIONS.TRANSFER,
    INVENTORY_PERMISSIONS.ISSUE,
    INVENTORY_PERMISSIONS.RESTOCK,
    INVENTORY_PERMISSIONS.MANAGE_CATEGORIES,
    INVENTORY_PERMISSIONS.MANAGE_SUPPLIERS,
    INVENTORY_PERMISSIONS.VIEW_REPORTS,
    INVENTORY_PERMISSIONS.VIEW_AUDIT,
    INVENTORY_PERMISSIONS.MANAGE_SETTINGS,
    INVENTORY_PERMISSIONS.VIEW_LOW_STOCK,
    INVENTORY_PERMISSIONS.APPROVE_TRANSFERS,
  ],
  ADMIN: [
    INVENTORY_PERMISSIONS.VIEW,
    INVENTORY_PERMISSIONS.CREATE,
    INVENTORY_PERMISSIONS.EDIT,
    INVENTORY_PERMISSIONS.EXPORT,
    INVENTORY_PERMISSIONS.IMPORT,
    INVENTORY_PERMISSIONS.ADJUST,
    INVENTORY_PERMISSIONS.TRANSFER,
    INVENTORY_PERMISSIONS.ISSUE,
    INVENTORY_PERMISSIONS.RESTOCK,
    INVENTORY_PERMISSIONS.MANAGE_CATEGORIES,
    INVENTORY_PERMISSIONS.MANAGE_SUPPLIERS,
    INVENTORY_PERMISSIONS.VIEW_REPORTS,
    INVENTORY_PERMISSIONS.VIEW_AUDIT,
    INVENTORY_PERMISSIONS.VIEW_LOW_STOCK,
  ],
  MANAGER: [
    INVENTORY_PERMISSIONS.VIEW,
    INVENTORY_PERMISSIONS.CREATE,
    INVENTORY_PERMISSIONS.EDIT,
    INVENTORY_PERMISSIONS.ADJUST,
    INVENTORY_PERMISSIONS.TRANSFER,
    INVENTORY_PERMISSIONS.ISSUE,
    INVENTORY_PERMISSIONS.RESTOCK,
    INVENTORY_PERMISSIONS.VIEW_REPORTS,
    INVENTORY_PERMISSIONS.VIEW_LOW_STOCK,
    INVENTORY_PERMISSIONS.VIEW_AUDIT,
  ],
  EDITOR: [
    INVENTORY_PERMISSIONS.VIEW,
    INVENTORY_PERMISSIONS.CREATE,
    INVENTORY_PERMISSIONS.EDIT,
    INVENTORY_PERMISSIONS.ADJUST,
    INVENTORY_PERMISSIONS.RESTOCK,
    INVENTORY_PERMISSIONS.VIEW_LOW_STOCK,
  ],
  VIEWER: [
    INVENTORY_PERMISSIONS.VIEW,
    INVENTORY_PERMISSIONS.VIEW_LOW_STOCK,
  ],
  EMPLOYEE: [
    INVENTORY_PERMISSIONS.VIEW,
    INVENTORY_PERMISSIONS.VIEW_LOW_STOCK,
  ],
  CASHIER: [
    INVENTORY_PERMISSIONS.VIEW,
    INVENTORY_PERMISSIONS.VIEW_LOW_STOCK,
  ],
};
