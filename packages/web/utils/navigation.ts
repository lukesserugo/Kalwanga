// utils/navigation.ts

// ============================================
// PUBLIC ROUTES (Accessible without authentication)
// ============================================
export const PUBLIC_ROUTES = [
  // Home & Landing
  '/',
  '/features',
  '/pricing',
  '/demo',
  '/contact',
  '/help',
  '/docs',
  '/privacy',
  '/terms',
  
  // Auth Routes
  '/login',
  '/sign-up',
  '/forgot-password',
  '/verify',
  '/reset-password',
  '/sign-in',
  '/register',
  
  // Public Shop Routes
  '/cart',
  '/checkout',
  '/order-confirmation',
  '/product',
  '/category',
  '/categories',
  '/shop',
  '/search',
  
  // About & Support
  '/about',
  '/support',
  '/faq',
  '/blog',
  '/newsletter',
  '/careers',
];

export const isPublicRoute = (pathname: string): boolean => {
  return PUBLIC_ROUTES.some(route => 
    pathname === route || pathname?.startsWith(route + '/')
  );
};

// ============================================
// PUBLIC NAVIGATION ITEMS
// ============================================
export const publicNavItems = [
  { name: 'Features', href: '/features' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'Demo', href: '/demo' },
  { name: 'Help', href: '/help' },
  { name: 'Cart', href: '/cart' },
  { name: 'Shop', href: '/shop' },
  { name: 'Categories', href: '/categories' },
];

// ============================================
// DASHBOARD NAVIGATION ITEMS
// ============================================
export const dashboardNavItems = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'POS', href: '/pos' },
  { name: 'Inventory', href: '/inventory' },
  { name: 'Sales', href: '/sales' },
  { name: 'Customers', href: '/customers' },
  { name: 'Reports', href: '/reports' },
  { name: 'Settings', href: '/settings' },
];

// ============================================
// SALES NAVIGATION ITEMS (with optional permission)
// ============================================
export interface SalesNavItem {
  name: string;
  href: string;
  icon: string;
  permission?: string;
}

export const salesNavItems: SalesNavItem[] = [
  { name: 'All Sales', href: '/admin/sales', icon: 'ShoppingBag', permission: 'canViewSales' },
  { name: 'POS', href: '/admin/sales/pos', icon: 'ShoppingCart', permission: 'canManagePos' },
  { name: 'Dashboard', href: '/admin/sales/dashboard', icon: 'BarChart3', permission: 'canViewSales' },
  { name: 'Analytics', href: '/admin/sales/analytics', icon: 'TrendingUp', permission: 'canViewAnalytics' },
  { name: 'Settings', href: '/admin/sales/settings', icon: 'Settings', permission: 'canManageSales' },
  { name: 'Returns', href: '/admin/sales/returns', icon: 'ArrowLeft', permission: 'canViewReturns' },
  { name: 'Refunds', href: '/admin/sales/refunds', icon: 'ArrowRight', permission: 'canManageReturns' },
  { name: 'Invoices', href: '/admin/sales/invoices', icon: 'FileText', permission: 'canViewInvoices' },
  { name: 'Receipts', href: '/admin/sales/receipts', icon: 'Receipt', permission: 'canViewReceipts' },
  { name: 'Reports', href: '/admin/sales/reports', icon: 'FileSpreadsheet', permission: 'canViewReports' },
  { name: 'Export', href: '/admin/sales/export', icon: 'Download', permission: 'canExport' },
];

// ============================================
// ADMIN ROUTES (Protected, requires authentication)
// ============================================
export const ADMIN_ROUTES = [
  // Core Admin
  '/admin',
  '/admin/dashboard',
  '/admin/settings',
  
  // Sales Admin
  '/admin/sales',
  '/admin/sales/pos',
  '/admin/sales/dashboard',
  '/admin/sales/analytics',
  '/admin/sales/settings',
  '/admin/sales/returns',
  '/admin/sales/refunds',
  '/admin/sales/invoices',
  '/admin/sales/receipts',
  '/admin/sales/reports',
  '/admin/sales/export',
  
  // Catalog Admin
  '/admin/catalog',
  '/admin/catalog/add',
  '/admin/catalog/edit',
  '/admin/catalog/categories',
  '/admin/catalog/suppliers',
  '/admin/catalog/import',
  '/admin/catalog/export',
  '/admin/catalog/tags',
  '/admin/catalog/reviews',
  
  // Inventory Admin
  '/admin/inventory',
  '/admin/inventory/list',
  '/admin/inventory/add',
  '/admin/inventory/edit',
  '/admin/inventory/low-stock',
  '/admin/inventory/transfer',
  '/admin/inventory/import',
  '/admin/inventory/reports',
  '/admin/inventory/audit',
  '/admin/inventory/stock-count',
  '/admin/inventory/valuation',
  '/admin/inventory/transactions',
  '/admin/inventory/categories',
  '/admin/inventory/suppliers',
  '/admin/inventory/settings',
  
  // Customer Admin
  '/admin/customers',
  '/admin/customers/add',
  '/admin/customers/edit',
  '/admin/customers/import',
  '/admin/customers/export',
  
  // User Admin
  '/admin/users',
  '/admin/users/add',
  '/admin/users/edit',
  '/admin/users/roles',
  '/admin/users/permissions',
  
  // Report Admin
  '/admin/reports',
  '/admin/reports/sales',
  '/admin/reports/inventory',
  '/admin/reports/customers',
  '/admin/reports/products',
  '/admin/reports/payments',
  '/admin/reports/tax',
  
  // Other Admin
  '/admin/promotions',
  '/admin/promotions/add',
  '/admin/promotions/edit',
  '/admin/shipping',
  '/admin/tax',
  '/admin/tax/settings',
  '/admin/notifications',
  '/admin/audit-logs',
];

export const isAdminRoute = (pathname: string): boolean => {
  return ADMIN_ROUTES.some(route => 
    pathname === route || pathname?.startsWith(route + '/')
  );
};

// ============================================
// API ROUTES (Protected, requires authentication)
// ============================================
export const API_ROUTES = {
  // Auth
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_REGISTER: '/api/auth/register',
  AUTH_VERIFY: '/api/auth/verify',
  AUTH_FORGOT_PASSWORD: '/api/auth/forgot-password',
  AUTH_RESET_PASSWORD: '/api/auth/reset-password',
  AUTH_REFRESH: '/api/auth/refresh',
  
  // Users
  USERS: '/api/users',
  USER_BY_ID: (id: string) => `/api/users/${id}`,
  USER_PERMISSIONS: '/api/users/permissions',
  USER_ROLES: '/api/users/roles',
  
  // Products
  PRODUCTS: '/api/products',
  PRODUCT_BY_ID: (id: string) => `/api/products/${id}`,
  PRODUCT_SEARCH: '/api/products/search',
  PRODUCT_CATEGORIES: '/api/products/categories',
  
  // Categories
  CATEGORIES: '/api/categories',
  CATEGORY_BY_ID: (id: string) => `/api/categories/${id}`,
  CATEGORY_TREE: '/api/categories/tree',
  
  // Sales
  SALES: '/api/sales',
  SALE_BY_ID: (id: string) => `/api/sales/${id}`,
  SALE_STATS: '/api/sales/stats',
  SALE_EXPORT: '/api/sales/export',
  SALE_ANALYTICS: '/api/sales/analytics',
  SALE_FORECAST: '/api/sales/forecast',
  SALE_COMPARE: '/api/sales/compare',
  SALE_SUMMARY: '/api/sales/summary',
  SALE_PAYMENT_METHODS: '/api/sales/payment-methods',
  SALE_BY_STATUS: (status: string) => `/api/sales/status/${status}`,
  SALE_AGGREGATE: '/api/sales/aggregate',
  SALE_BY_PRODUCT: (productId: string) => `/api/sales/product/${productId}`,
  
  // Checkout
  CHECKOUT: '/api/checkout',
  CHECKOUT_SUMMARY: (cartId: string) => `/api/checkout/summary/${cartId}`,
  CHECKOUT_RECEIPT: (saleId: string) => `/api/checkout/receipt/${saleId}`,
  CHECKOUT_RECEIPT_BY_NUMBER: (receiptNumber: string) => `/api/checkout/receipt/number/${receiptNumber}`,
  CHECKOUT_ADMIN: '/api/checkout/admin/all',
  
  // Returns
  RETURNS: '/api/returns',
  RETURN_BY_ID: (id: string) => `/api/returns/${id}`,
  RETURN_STATS: '/api/returns/stats',
  RETURN_EXPORT: '/api/returns/export',
  RETURN_PROCESS: (id: string) => `/api/returns/${id}/process`,
  RETURN_REJECT: (id: string) => `/api/returns/${id}/reject`,
  
  // Refunds
  REFUNDS: '/api/refunds',
  REFUND_BY_ID: (id: string) => `/api/refunds/${id}`,
  REFUND_STATS: '/api/refunds/stats',
  REFUND_EXPORT: '/api/refunds/export',
  REFUND_APPROVE: (id: string) => `/api/refunds/${id}/approve`,
  REFUND_REJECT: (id: string) => `/api/refunds/${id}/reject`,
  REFUND_COMPLETE: (id: string) => `/api/refunds/${id}/complete`,
  
  // Invoices
  INVOICES: '/api/invoices',
  INVOICE_BY_ID: (id: string) => `/api/invoices/${id}`,
  INVOICE_STATS: '/api/invoices/stats',
  INVOICE_EXPORT: '/api/invoices/export',
  INVOICE_PDF: (id: string) => `/api/invoices/${id}/pdf`,
  INVOICE_SEND: (id: string) => `/api/invoices/${id}/send`,
  INVOICE_PAID: (id: string) => `/api/invoices/${id}/paid`,
  INVOICE_VOID: (id: string) => `/api/invoices/${id}/void`,
  INVOICE_CANCEL: (id: string) => `/api/invoices/${id}/cancel`,
  
  // Receipts
  RECEIPTS: '/api/receipts',
  RECEIPT_BY_ID: (id: string) => `/api/receipts/${id}`,
  RECEIPT_BY_NUMBER: (number: string) => `/api/receipts/number/${number}`,
  RECEIPT_STATS: '/api/receipts/stats',
  RECEIPT_EXPORT: '/api/receipts/export',
  RECEIPT_PDF: (id: string) => `/api/receipts/${id}/pdf`,
  RECEIPT_EMAIL: (id: string) => `/api/receipts/${id}/email`,
  RECEIPT_PRINT: (id: string) => `/api/receipts/${id}/print`,
  RECEIPT_VOID: (id: string) => `/api/receipts/${id}/void`,
  
  // Reports
  REPORTS: '/api/reports',
  REPORTS_SALES: '/api/reports/sales',
  REPORTS_DOWNLOAD: '/api/reports/sales/download',
  REPORTS_FORMATS: '/api/reports/formats',
  
  // Export
  EXPORT_SALES: '/api/export/sales',
  EXPORT_SCHEDULE: '/api/export/schedule',
  EXPORT_HISTORY: '/api/export/history',
  EXPORT_STATS: '/api/export/stats',
  EXPORT_EMAIL: (id: string) => `/api/export/${id}/email`,
  EXPORT_DELETE: (id: string) => `/api/export/${id}`,
  
  // Customers
  CUSTOMERS: '/api/customers',
  CUSTOMER_BY_ID: (id: string) => `/api/customers/${id}`,
  CUSTOMER_SEARCH: '/api/customers/search',
  CUSTOMER_STATS: '/api/customers/stats',
  CUSTOMER_LOYALTY: (id: string) => `/api/customers/${id}/loyalty`,
  
  // Inventory
  INVENTORY: '/api/inventory',
  INVENTORY_BY_ID: (id: string) => `/api/inventory/${id}`,
  INVENTORY_LOW_STOCK: '/api/inventory/low-stock',
  INVENTORY_TRANSACTIONS: '/api/inventory/transactions',
  INVENTORY_TRANSFER: '/api/inventory/transfer',
  INVENTORY_STOCK_COUNT: '/api/inventory/stock-count',
  INVENTORY_VALUATION: '/api/inventory/valuation',
  
  // Suppliers
  SUPPLIERS: '/api/suppliers',
  SUPPLIER_BY_ID: (id: string) => `/api/suppliers/${id}`,
  SUPPLIER_PRODUCTS: (id: string) => `/api/suppliers/${id}/products`,
  
  // Settings
  SETTINGS: '/api/settings',
  SETTINGS_SALES: '/api/settings/sales',
  SETTINGS_INVENTORY: '/api/settings/inventory',
  SETTINGS_PAYMENT: '/api/settings/payment',
  SETTINGS_TAX: '/api/settings/tax',
  SETTINGS_SHIPPING: '/api/settings/shipping',
  SETTINGS_NOTIFICATIONS: '/api/settings/notifications',
};

// ============================================
// NAVIGATION GROUPS
// ============================================
export const navigationGroups = {
  public: publicNavItems,
  dashboard: dashboardNavItems,
  sales: salesNavItems,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the current navigation items based on authentication status
 */
export const getNavigationItems = (isAuthenticated: boolean) => {
  return isAuthenticated ? dashboardNavItems : publicNavItems;
};

/**
 * Get sales navigation items with permission filtering
 */
export const getSalesNavItems = (permissions: Record<string, boolean>): SalesNavItem[] => {
  return salesNavItems.filter((item: SalesNavItem) => {
    // If no permission required, show item
    if (!item.permission) return true;
    // Check if user has the required permission
    return permissions[item.permission] === true;
  });
};

/**
 * Check if a route is in a specific navigation group
 */
export const isRouteInNavGroup = (pathname: string, navItems: Array<{ href: string }>): boolean => {
  return navItems.some(item => 
    pathname === item.href || pathname?.startsWith(item.href + '/')
  );
};

/**
 * Get the active navigation item
 */
export const getActiveNavItem = (pathname: string, navItems: Array<{ href: string; name: string }>) => {
  return navItems.find(item => 
    pathname === item.href || pathname?.startsWith(item.href + '/')
  );
};

/**
 * Get breadcrumb items from pathname
 */
export const getBreadcrumbs = (pathname: string): Array<{ name: string; href: string }> => {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [];
  let currentPath = '';
  
  for (const segment of segments) {
    currentPath += '/' + segment;
    const name = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
    breadcrumbs.push({ name, href: currentPath });
  }
  
  return breadcrumbs;
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  PUBLIC_ROUTES,
  ADMIN_ROUTES,
  API_ROUTES,
  publicNavItems,
  dashboardNavItems,
  salesNavItems,
  navigationGroups,
  isPublicRoute,
  isAdminRoute,
  getNavigationItems,
  getSalesNavItems,
  isRouteInNavGroup,
  getActiveNavItem,
  getBreadcrumbs,
};
