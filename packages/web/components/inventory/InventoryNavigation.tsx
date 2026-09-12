// D:\Projects\Kalwanga\packages\web\components\inventory\InventoryNavigation.tsx

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, Truck, History, Building, ClipboardList,
  Settings, BarChart3, AlertTriangle, Upload, Tag, Shield,
  DollarSign, FolderTree, Home, ShoppingCart, Users,
  FileText, Download, Scan, QrCode, Barcode,
  Layers, Grid, List, Filter, Search, Bell,
  RefreshCw, ChevronDown, ChevronUp, X,
  ArrowLeft, ArrowRight, Menu, Maximize2
} from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { PermissionResource } from '../../types/enums';
import { ROUTES } from '../../utils/routeMapping';

// ============================================
// TYPES
// ============================================

export interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  children?: NavItem[];
  badge?: string | number;
  exact?: boolean;
  description?: string;
}

export interface InventoryNavigationProps {
  className?: string;
  showLabels?: boolean;
  compact?: boolean;
  vertical?: boolean;
  onNavigate?: (path: string) => void;
  renderAs?: 'tabs' | 'sidebar' | 'breadcrumb';
  maxVisibleItems?: number;
}

// ============================================
// CONSTANTS
// ============================================

const NAV_ITEMS: NavItem[] = [
  { 
    label: 'Dashboard', 
    path: ROUTES.INVENTORY.DASHBOARD || '/admin/inventory', 
    icon: <Home className="w-4 h-4" />,
    exact: true,
    description: 'Overview and insights'
  },
  { 
    label: 'Add Item', 
    path: ROUTES.INVENTORY.ADD || '/admin/inventory/add', 
    icon: <Plus className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:create`,
    description: 'Create new inventory item'
  },
  { 
    label: 'Scan', 
    path: '/admin/inventory/scan', 
    icon: <Scan className="w-4 h-4" />,
    description: 'Scan barcode or QR code'
  },
  { 
    label: 'Transfer', 
    path: ROUTES.INVENTORY.TRANSFER || '/admin/inventory/transfer', 
    icon: <Truck className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:transfer`,
    description: 'Move items between locations'
  },
  { 
    label: 'Transactions', 
    path: ROUTES.INVENTORY.TRANSACTIONS || '/admin/inventory/transactions', 
    icon: <History className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:audit`,
    description: 'View transaction history'
  },
  { 
    label: 'Suppliers', 
    path: ROUTES.INVENTORY.SUPPLIERS || '/admin/inventory/suppliers', 
    icon: <Building className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:edit`,
    description: 'Manage suppliers'
  },
  { 
    label: 'Stock Count', 
    path: ROUTES.INVENTORY.STOCK_COUNT || '/admin/inventory/stock-count', 
    icon: <ClipboardList className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:adjust`,
    description: 'Count inventory items'
  },
  { 
    label: 'Categories', 
    path: ROUTES.INVENTORY.CATEGORIES || '/admin/inventory/categories', 
    icon: <FolderTree className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:edit`,
    description: 'Manage categories'
  },
  { 
    label: 'Low Stock', 
    path: ROUTES.INVENTORY.LOW_STOCK || '/admin/inventory/low-stock', 
    icon: <AlertTriangle className="w-4 h-4" />,
    permission: `${PermissionResource.INVENTORY}:view`,
    description: 'Items needing restock'
  },
  { 
    label: 'Reports', 
    path: ROUTES.INVENTORY.REPORTS || '/admin/inventory/reports', 
    icon: <BarChart3 className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:view`,
    description: 'Analytics and reports'
  },
  { 
    label: 'Audit', 
    path: ROUTES.INVENTORY.AUDIT || '/admin/inventory/audit', 
    icon: <Shield className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:audit`,
    description: 'Audit trail'
  },
  { 
    label: 'Valuation', 
    path: ROUTES.INVENTORY.VALUATION || '/admin/inventory/valuation', 
    icon: <DollarSign className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:view`,
    description: 'Inventory value analysis'
  },
  { 
    label: 'Import', 
    path: ROUTES.INVENTORY.IMPORT || '/admin/inventory/import', 
    icon: <Upload className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:create`,
    description: 'Bulk import items'
  },
  { 
    label: 'Settings', 
    path: ROUTES.INVENTORY.SETTINGS || '/admin/inventory/settings', 
    icon: <Settings className="w-4 h-4" />, 
    permission: `${PermissionResource.INVENTORY}:manage`,
    description: 'Configure inventory settings'
  },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const NavLink: React.FC<{
  item: NavItem;
  isActive: boolean;
  showLabels?: boolean;
  compact?: boolean;
  onClick?: () => void;
}> = ({ item, isActive, showLabels = true, compact = false, onClick }) => {
  return (
    <Link
      href={item.path}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 ${
        isActive
          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
      } ${compact ? 'px-2 py-1.5' : ''}`}
      title={item.description}
    >
      <span className={`${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`}>
        {item.icon}
      </span>
      {showLabels && (
        <span className={`${compact ? 'hidden sm:inline' : 'inline'}`}>
          {item.label}
        </span>
      )}
      {item.badge && (
        <span className={`ml-auto px-1.5 py-0.5 text-xs rounded-full ${
          isActive 
            ? 'bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300' 
            : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
        }`}>
          {item.badge}
        </span>
      )}
    </Link>
  );
};

const BreadcrumbNav: React.FC<{
  items: NavItem[];
  pathname: string;
}> = ({ items, pathname }) => {
  const activeItem = items.find(item => isPathActive(item, pathname));
  const pathSegments = pathname?.split('/').filter(Boolean) || [];
  
  if (!activeItem) return null;
  
  // Build breadcrumb trail
  const breadcrumbs: NavItem[] = [];
  let currentPath = '';
  
  for (const segment of pathSegments) {
    currentPath += `/${segment}`;
    const match = items.find(item => item.path === currentPath);
    if (match) {
      breadcrumbs.push(match);
    }
  }
  
  if (breadcrumbs.length === 0 && activeItem) {
    breadcrumbs.push(activeItem);
  }
  
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && (
            <span className="text-gray-300 dark:text-gray-600">/</span>
          )}
          <Link
            href={item.path}
            className={`hover:text-gray-700 dark:hover:text-gray-300 transition-colors ${
              index === breadcrumbs.length - 1 
                ? 'text-gray-900 dark:text-white font-medium' 
                : ''
            }`}
          >
            {item.label}
          </Link>
        </React.Fragment>
      ))}
    </nav>
  );
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function isPathActive(item: NavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  if (item.exact) {
    return pathname === item.path;
  }
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InventoryNavigation({ 
  className = '',
  showLabels = true,
  compact = false,
  vertical = false,
  onNavigate,
  renderAs = 'tabs',
  maxVisibleItems,
}: InventoryNavigationProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasPermission, isLoading } = usePermission();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Filter items based on permissions
  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter(item => {
      if (!item.permission) return true;
      // Super admin bypass
      if (user?.role === 'SUPER_ADMIN') return true;
      // Check permission using hasPermission
      return hasPermission(item.permission);
    });
  }, [user, hasPermission]);

  // Limit visible items if maxVisibleItems is set
  const displayItems = useMemo(() => {
    if (!maxVisibleItems) return visibleItems;
    if (showAll) return visibleItems;
    return visibleItems.slice(0, maxVisibleItems);
  }, [visibleItems, maxVisibleItems, showAll]);

  const hasMoreItems = maxVisibleItems && visibleItems.length > maxVisibleItems;

  // Handle navigation
  const handleNavigate = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
    }
  };

  // Breadcrumb render
  if (renderAs === 'breadcrumb') {
    return (
      <BreadcrumbNav items={visibleItems} pathname={pathname || ''} />
    );
  }

  // Sidebar render
  if (renderAs === 'sidebar') {
    return (
      <nav className={`${className} ${vertical ? 'flex-col' : ''}`}>
        <div className={`space-y-1 ${vertical ? 'w-full' : ''}`}>
          {displayItems.map((item) => {
            const active = isPathActive(item, pathname);
            return (
              <NavLink
                key={item.path}
                item={item}
                isActive={active}
                showLabels={showLabels}
                compact={compact}
                onClick={() => handleNavigate(item.path)}
              />
            );
          })}
          
          {/* Show More / Show Less */}
          {hasMoreItems && (
            <button
              onClick={() => setShowAll(!showAll)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors w-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700`}
            >
              {showAll ? (
                <> <ChevronUp className="w-4 h-4" /> Show Less</>
              ) : (
                <> <ChevronDown className="w-4 h-4" /> Show More ({visibleItems.length - (maxVisibleItems || 0)})</>
              )}
            </button>
          )}
        </div>
      </nav>
    );
  }

  // Tabs render (default)
  return (
    <div className={`${className}`}>
      <nav className={`flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 ${vertical ? 'flex-col' : ''}`}>
        {displayItems.map((item) => {
          const active = isPathActive(item, pathname);
          return (
            <NavLink
              key={item.path}
              item={item}
              isActive={active}
              showLabels={showLabels}
              compact={compact}
              onClick={() => handleNavigate(item.path)}
            />
          );
        })}
        
        {/* Show More / Show Less */}
        {hasMoreItems && (
          <button
            onClick={() => setShowAll(!showAll)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showAll
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {showAll ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {showAll ? 'Show Less' : `+${visibleItems.length - (maxVisibleItems || 0)}`}
            </span>
          </button>
        )}
      </nav>

      {/* Mobile Expand/Collapse */}
      {compact && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors w-full flex items-center justify-center gap-2 text-sm"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {isExpanded ? 'Hide Navigation' : 'Expand Navigation'}
        </button>
      )}
    </div>
  );
}

// ============================================
// PRESET COMPONENTS
// ============================================

export function CompactInventoryNav(props: Omit<InventoryNavigationProps, 'compact'>) {
  return <InventoryNavigation {...props} compact={true} showLabels={true} />;
}

export function IconOnlyNav(props: Omit<InventoryNavigationProps, 'compact' | 'showLabels'>) {
  return <InventoryNavigation {...props} compact={true} showLabels={false} />;
}

export function SidebarInventoryNav(props: Omit<InventoryNavigationProps, 'renderAs'>) {
  return <InventoryNavigation {...props} renderAs="sidebar" vertical={true} />;
}

export function BreadcrumbInventoryNav(props: Omit<InventoryNavigationProps, 'renderAs'>) {
  return <InventoryNavigation {...props} renderAs="breadcrumb" />;
}

// ============================================
// EXPORT
// ============================================

export default InventoryNavigation;
