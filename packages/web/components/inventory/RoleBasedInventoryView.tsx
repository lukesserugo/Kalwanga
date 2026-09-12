// D:\Projects\Kalwanga\packages\web\components\inventory\RoleBasedInventoryView.tsx

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Shield, Lock, User, Users, Building, Crown,
  Package, AlertTriangle, BarChart3, Settings,
  Truck, FileText, Eye, Edit, Trash2, Plus,
  RefreshCw, ChevronDown, ChevronUp, Grid,
  List, LayoutGrid, Filter, Search, X,
  CheckCircle, AlertCircle, Info, HelpCircle,
  Award, Star, Globe, Archive, Clock, Calendar,
  Activity, TrendingUp, TrendingDown, DollarSign,
  Tag, MapPin, Bell, Download, Upload, Scan
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';
import { InventoryPermissionGuard } from './InventoryPermissionGuard';
import { InventoryList } from './InventoryList';
import { LowStockAlert } from './LowStockAlert';
import { StockTransfer } from './StockTransfer';
import { InventoryReports } from './InventoryReports';
import { InventoryAuditLog } from './InventoryAuditLog';
import { InventorySettings } from './InventorySettings';
import { InventoryWidgets } from './InventoryWidgets';
import { QuickActions } from './QuickActions';

// ============================================
// TYPES
// ============================================

type TabId = 'overview' | 'inventory' | 'reports' | 'audit' | 'settings';

interface RoleBasedInventoryViewProps {
  className?: string;
  showWelcome?: boolean;
  defaultTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ElementType;
  permission?: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'reports', label: 'Reports', icon: BarChart3, permission: `${PermissionResource.INVENTORY}:view` },
  { id: 'audit', label: 'Audit Log', icon: FileText, adminOnly: true, permission: `${PermissionResource.INVENTORY}:audit` },
  { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true, permission: `${PermissionResource.INVENTORY}:manage` },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const RoleBadge: React.FC<{ userRole: string; isSuperAdmin: boolean }> = ({ userRole, isSuperAdmin }) => {
  const roleConfig: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
    SUPER_ADMIN: {
      label: 'Super Admin',
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      icon: Crown,
      description: 'Full system access'
    },
    ADMIN: {
      label: 'Administrator',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      icon: Shield,
      description: 'Full inventory access'
    },
    MANAGER: {
      label: 'Manager',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      icon: Users,
      description: 'Manage inventory operations'
    },
    INVENTORY_MANAGER: {
      label: 'Inventory Manager',
      color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      icon: Package,
      description: 'Manage inventory and stock'
    },
    STORE_KEEPER: {
      label: 'Store Keeper',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      icon: Building,
      description: 'Manage store inventory'
    },
    STAFF: {
      label: 'Staff',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      icon: User,
      description: 'Basic inventory access'
    },
    VIEWER: {
      label: 'Viewer',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300',
      icon: Eye,
      description: 'Read-only access'
    },
  };

  const config = roleConfig[userRole] || roleConfig.VIEWER;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
      <div className={`p-1.5 rounded-full ${config.color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Role:</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          {isSuperAdmin && (
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">(Full Access)</span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{config.description}</p>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}> = ({ tab, isActive, onClick, disabled }) => {
  const Icon = tab.icon;
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
        isActive
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-4 h-4" />
      {tab.label}
    </button>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function RoleBasedInventoryView({
  className = '',
  showWelcome = true,
  defaultTab = 'overview',
  onTabChange,
}: RoleBasedInventoryViewProps) {
  const router = useRouter();
  const { user, isAuthenticated, isSuperAdmin, isAdmin, isManager } = useAuth();
  const { hasPermission } = usePermission();
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(showWelcome);

  // ✅ FIXED: Get user role from user object - use user?.role or fallback
  const userRole = (user as any)?.role || (user as any)?.userRole || 'VIEWER';

  // Compute role-based permissions
  const canViewAdminSections = isSuperAdmin || isAdmin || isManager;
  const canViewAdminOnlySections = isSuperAdmin || isAdmin;
  const canViewSuperAdminSections = isSuperAdmin;

  // Check inventory permissions
  const canViewInventory = hasPermission(`${PermissionResource.INVENTORY}:view`) || isSuperAdmin;
  const canViewReports = hasPermission(`${PermissionResource.INVENTORY}:view`) || isSuperAdmin;
  const canViewAudit = hasPermission(`${PermissionResource.INVENTORY}:audit`) || isSuperAdmin;
  const canManageSettings = hasPermission(`${PermissionResource.INVENTORY}:manage`) || isSuperAdmin;

  // Build visible tabs based on permissions
  const visibleTabs = useMemo(() => {
    return TABS.filter(tab => {
      // Super admin sees all tabs
      if (isSuperAdmin) return true;
      
      // Check permission for the tab
      if (tab.permission && !hasPermission(tab.permission)) return false;
      
      // Check admin-only tabs
      if (tab.adminOnly && !canViewAdminSections) return false;
      if (tab.superAdminOnly && !isSuperAdmin) return false;
      
      return true;
    });
  }, [isSuperAdmin, canViewAdminSections, hasPermission]);

  // Handle tab change
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  // Handle quick actions - ✅ FIXED: Use type-safe mapping
  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'add':
        router.push('/admin/inventory/add');
        break;
      case 'scan':
        router.push('/admin/inventory/scan');
        break;
      case 'transfer':
        router.push('/admin/inventory/transfer');
        break;
      case 'adjust':
        router.push('/admin/inventory/adjust');
        break;
      case 'import':
        router.push('/admin/inventory/import');
        break;
      case 'export':
        router.push('/admin/inventory/export');
        break;
      case 'low-stock':
        router.push('/admin/inventory/low-stock');
        break;
      case 'reports':
        setActiveTab('reports');
        break;
      case 'settings':
        setActiveTab('settings');
        break;
      default:
        break;
    }
  };

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Please Login</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You need to be logged in to access inventory management.
        </p>
        <button 
          onClick={() => router.push('/login')} 
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Check if user has any inventory access
  if (!canViewInventory && !isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          You don't have permission to access inventory management.
        </p>
        <button 
          onClick={() => router.push('/dashboard')} 
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Welcome Banner */}
      {showWelcomeBanner && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800/30"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Inventory Management
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                {isSuperAdmin 
                  ? 'You have full access to all inventory features.'
                  : isAdmin 
                    ? 'You have administrative access to inventory.'
                    : isManager 
                      ? 'You can manage inventory operations.'
                      : 'You have view and basic access to inventory.'}
              </p>
            </div>
            <button
              onClick={() => setShowWelcomeBanner(false)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              aria-label="Dismiss welcome banner"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Role Badge - ✅ FIXED: Pass userRole instead of role */}
      <RoleBadge userRole={userRole} isSuperAdmin={!!isSuperAdmin} />

      {/* Quick Actions */}
      <QuickActions
        onAction={handleQuickAction}
        permissions={{
          canCreate: hasPermission(`${PermissionResource.INVENTORY}:create`) || isSuperAdmin,
          canTransfer: hasPermission(`${PermissionResource.INVENTORY}:transfer`) || isSuperAdmin,
          canAdjust: hasPermission(`${PermissionResource.INVENTORY}:adjust`) || isSuperAdmin,
          canExport: hasPermission(`${PermissionResource.INVENTORY}:export`) || isSuperAdmin,
        }}
      />

      {/* Tab Navigation */}
      {visibleTabs.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
          {visibleTabs.map((tab) => (
            <TabButton
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onClick={() => handleTabChange(tab.id)}
              disabled={tab.permission ? !hasPermission(tab.permission) : false}
            />
          ))}
        </div>
      )}

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Widgets */}
              <InventoryWidgets compact={false} showAlerts showQuickActions={false} />

              {/* Low Stock Alert */}
              <LowStockAlert compact={false} showActions />

              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <Package className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Items</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">-</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <DollarSign className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Value</p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">-</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Low Stock</p>
                      <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">-</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Out of Stock</p>
                      <p className="text-lg font-bold text-red-600 dark:text-red-400">-</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <InventoryList />
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && canViewReports && (
            <InventoryReports />
          )}

          {/* Audit Log Tab */}
          {activeTab === 'audit' && canViewAudit && canViewAdminOnlySections && (
            <InventoryAuditLog />
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && canManageSettings && canViewAdminOnlySections && (
            <InventorySettings />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer - Super Admin Only */}
      {isSuperAdmin && (
        <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 dark:text-gray-500">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-purple-500" />
              <span>Super Admin Mode</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>Full system access</span>
            </div>
            <div>
              User ID: {user?.id?.slice(0, 8)}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// EXPORT
// ============================================

export default RoleBasedInventoryView;
