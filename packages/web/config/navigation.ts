// D:\Projects\Kalwanga\packages\web\config\navigation.ts
import { 
  INVENTORY_PERMISSIONS,
  InventoryPermission 
} from '../types/inventoryPermissions';

export interface NavigationItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  permission?: InventoryPermission;
  roles?: string[];
  children?: NavigationItem[];
}

export const navigationConfig: NavigationItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    permission: INVENTORY_PERMISSIONS.VIEW,
  },
  {
    label: 'Products',
    href: '/products',
    icon: 'Package',
    permission: INVENTORY_PERMISSIONS.VIEW,
    children: [
      {
        label: 'All Products',
        href: '/products',
        permission: INVENTORY_PERMISSIONS.VIEW,
      },
      {
        label: 'Add Product',
        href: '/products/add',
        permission: INVENTORY_PERMISSIONS.CREATE,
      },
      {
        label: 'Categories',
        href: '/categories',
        permission: INVENTORY_PERMISSIONS.MANAGE_CATEGORIES,
      },
      {
        label: 'Suppliers',
        href: '/suppliers',
        permission: INVENTORY_PERMISSIONS.VIEW,
      },
    ],
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: 'CubeIcon',
    permission: INVENTORY_PERMISSIONS.VIEW,
    children: [
      {
        label: 'Dashboard',
        href: '/inventory',
        permission: INVENTORY_PERMISSIONS.VIEW,
      },
      {
        label: 'All Items',
        href: '/inventory/list',
        permission: INVENTORY_PERMISSIONS.VIEW,
      },
      {
        label: 'Low Stock',
        href: '/inventory/low-stock',
        permission: INVENTORY_PERMISSIONS.VIEW_LOW_STOCK,
      },
      {
        label: 'Add Item',
        href: '/inventory/add',
        permission: INVENTORY_PERMISSIONS.CREATE,
      },
      {
        label: 'Transfer',
        href: '/inventory/transfer',
        permission: INVENTORY_PERMISSIONS.TRANSFER,
      },
      {
        label: 'Import',
        href: '/inventory/import',
        permission: INVENTORY_PERMISSIONS.IMPORT,
      },
      {
        label: 'Transactions',
        href: '/inventory/transactions',
        permission: INVENTORY_PERMISSIONS.VIEW_AUDIT,
      },
      {
        label: 'Stock Count',
        href: '/inventory/stock-count',
        permission: INVENTORY_PERMISSIONS.ADJUST,
      },
      {
        label: 'Valuation',
        href: '/inventory/valuation',
        permission: INVENTORY_PERMISSIONS.VIEW_REPORTS,
      },
      {
        label: 'Reports',
        href: '/inventory/reports',
        permission: INVENTORY_PERMISSIONS.VIEW_REPORTS,
      },
      {
        label: 'Audit Log',
        href: '/inventory/audit',
        permission: INVENTORY_PERMISSIONS.VIEW_AUDIT,
      },
      {
        label: 'Categories',
        href: '/inventory/categories',
        permission: INVENTORY_PERMISSIONS.MANAGE_CATEGORIES,
      },
      {
        label: 'Suppliers',
        href: '/inventory/suppliers',
        permission: INVENTORY_PERMISSIONS.MANAGE_SUPPLIERS,
      },
      {
        label: 'Settings',
        href: '/inventory/settings',
        permission: INVENTORY_PERMISSIONS.MANAGE_SETTINGS,
      },
    ],
  },
  {
    label: 'Sales',
    href: '/sales',
    icon: 'ShoppingBag',
    permission: INVENTORY_PERMISSIONS.VIEW,
  },
  {
    label: 'Customers',
    href: '/customers',
    icon: 'Users',
    permission: INVENTORY_PERMISSIONS.VIEW,
  },
  {
    label: 'Reports',
    href: '/reports',
    icon: 'BarChart3',
    permission: INVENTORY_PERMISSIONS.VIEW_REPORTS,
  },
  {
    label: 'Users',
    href: '/users',
    icon: 'UserCog',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: 'Settings',
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
];
