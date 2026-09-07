// D:\Projects\Kalwanga\packages\web\app\(dashboard)\layout.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';

interface UserPermissions {
  canViewDashboard: boolean;
  canViewCategories: boolean;
  canManageCategories: boolean;
  canViewProducts: boolean;
  canManageProducts: boolean;
  canViewOrders: boolean;
  canManageOrders: boolean;
  canViewCustomers: boolean;
  canManageCustomers: boolean;
  canViewInventory: boolean;
  canManageInventory: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
  canExportProducts: boolean;
  canImportProducts: boolean;
  canViewSuppliers: boolean;
  canManageSuppliers: boolean;
  // Sales specific permissions - ADD THESE
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
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
    canViewDashboard: true,
    canViewCategories: true,
    canManageCategories: true,
    canViewProducts: true,
    canManageProducts: true,
    canViewOrders: true,
    canManageOrders: true,
    canViewCustomers: true,
    canManageCustomers: true,
    canViewInventory: true,
    canManageInventory: true,
    canViewReports: true,
    canManageUsers: true,
    canManageSettings: true,
    canExportProducts: true,
    canImportProducts: true,
    canViewSuppliers: true,
    canManageSuppliers: true,
    // Sales permissions defaults
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      } else {
        setIsCollapsed(true);
      }
    } catch (error) {
      console.error('Failed to load sidebar state:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('sidebarCollapsed', String(isCollapsed));
    } catch (error) {
      console.error('Failed to save sidebar state:', error);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadUserPermissions();
    } else if (isLoaded && !isSignedIn) {
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  const loadUserPermissions = () => {
    try {
      const role = (user?.publicMetadata?.role as string) || 
                   (user?.unsafeMetadata?.role as string) || 
                   'ADMIN';
      
      console.log('User role:', role);
      
      const permissions: UserPermissions = {
        canViewDashboard: true,
        canViewCategories: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'].includes(role),
        canManageCategories: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewProducts: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'].includes(role),
        canManageProducts: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewOrders: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'].includes(role),
        canManageOrders: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewCustomers: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'].includes(role),
        canManageCustomers: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewInventory: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'].includes(role),
        canManageInventory: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewReports: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canManageUsers: ['SUPER_ADMIN', 'ADMIN'].includes(role),
        canManageSettings: ['SUPER_ADMIN', 'ADMIN'].includes(role),
        canExportProducts: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canImportProducts: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewSuppliers: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'].includes(role),
        canManageSuppliers: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        // Sales permissions
        canViewSales: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'CASHIER'].includes(role),
        canManageSales: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewAnalytics: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canManagePos: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'].includes(role),
        canViewReturns: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'CASHIER'].includes(role),
        canManageReturns: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewInvoices: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'].includes(role),
        canManageInvoices: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'].includes(role),
        canViewReceipts: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'CASHIER'].includes(role),
        canPrintReceipts: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'CASHIER'].includes(role),
      };
      
      setUserPermissions(permissions);
    } catch (error) {
      console.error('Failed to load user permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      const redirectPath = pathname || '/dashboard';
      router.push(`/login?redirect_url=${encodeURIComponent(redirectPath)}`);
    }
  }, [isLoaded, isSignedIn, router, pathname]);

  useEffect(() => {
    if (isLoaded && isSignedIn && !loading) {
      const hasAccess = checkRouteAccess(pathname, userPermissions);
      if (!hasAccess) {
        router.push('/unauthorized');
      }
    }
  }, [isLoaded, isSignedIn, loading, pathname, userPermissions, router]);

  const checkRouteAccess = (path: string, permissions: UserPermissions): boolean => {
    const publicRoutes = ['/dashboard', '/admin', '/admin/catalog'];
    
    if (publicRoutes.some(route => path === route || path.startsWith(route + '/'))) {
      return true;
    }

    if (path.startsWith('/admin') || path.startsWith('/dashboard/admin')) {
      const hasAdminPermission = 
        permissions.canManageProducts ||
        permissions.canViewProducts ||
        permissions.canManageInventory ||
        permissions.canViewInventory ||
        permissions.canManageCategories ||
        permissions.canViewCategories ||
        permissions.canManageOrders ||
        permissions.canViewOrders ||
        permissions.canManageCustomers ||
        permissions.canViewCustomers ||
        permissions.canManageUsers ||
        permissions.canViewReports ||
        permissions.canManageSettings ||
        permissions.canManageSuppliers ||
        permissions.canViewSuppliers ||
        permissions.canViewSales ||
        permissions.canManageSales ||
        permissions.canViewAnalytics ||
        permissions.canManagePos ||
        permissions.canViewReturns ||
        permissions.canManageReturns ||
        permissions.canViewInvoices ||
        permissions.canManageInvoices ||
        permissions.canViewReceipts ||
        permissions.canPrintReceipts;
      
      return hasAdminPermission;
    }

    const routePermissions: Record<string, keyof UserPermissions> = {
      '/categories': 'canViewCategories',
      '/categories/create': 'canManageCategories',
      '/categories/edit': 'canManageCategories',
      '/shop': 'canViewProducts',
      '/shop/create': 'canManageProducts',
      '/shop/edit': 'canManageProducts',
      '/admin/catalog': 'canViewProducts',
      '/admin/catalog/add': 'canManageProducts',
      '/admin/catalog/edit': 'canManageProducts',
      '/admin/catalog/categories': 'canViewCategories',
      '/admin/catalog/suppliers': 'canViewSuppliers',
      '/admin/catalog/import': 'canImportProducts',
      '/admin/catalog/export': 'canExportProducts',
      '/admin/catalog/tags': 'canManageProducts',
      '/orders': 'canViewOrders',
      '/orders/create': 'canManageOrders',
      '/customers': 'canViewCustomers',
      '/inventory': 'canViewInventory',
      '/reports': 'canViewReports',
      '/users': 'canManageUsers',
      '/settings': 'canManageSettings',
      '/pos': 'canViewOrders',
      '/suppliers': 'canViewSuppliers',
      // Sales routes
      '/admin/sales': 'canViewSales',
      '/admin/sales/dashboard': 'canViewSales',
      '/admin/sales/analytics': 'canViewAnalytics',
      '/admin/sales/pos': 'canManagePos',
      '/admin/sales/returns': 'canViewReturns',
      '/admin/sales/refunds': 'canManageReturns',
      '/admin/sales/invoices': 'canViewInvoices',
      '/admin/sales/receipts': 'canViewReceipts',
      '/admin/sales/settings': 'canManageSales',
      '/admin/sales/reports': 'canViewReports',
      '/admin/sales/export': 'canViewSales',
    };

    for (const [route, permission] of Object.entries(routePermissions)) {
      if (path === route || path.startsWith(route + '/')) {
        return permissions[permission] || false;
      }
    }

    return true;
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
  };

  const handleToggleMobile = () => {
    setIsMobileOpen((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onToggleCollapse={handleToggleCollapse}
          onToggleMobile={handleToggleMobile}
          permissions={userPermissions}
        />
        
        {/* Main content - REMOVED margin-left since Sidebar has spacer */}
        <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out">
          <Header 
            onMenuClick={handleToggleMobile} 
            permissions={userPermissions}
          />
          
          <motion.main 
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-1 overflow-y-auto p-4 md:p-6"
          >
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </motion.main>
        </div>
      </div>
    </div>
  );
}
