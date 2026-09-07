// D:\Projects\Kalwanga\packages\web\components\inventory\RoleBasedInventoryView.tsx
'use client';

import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { InventoryPermissionGuard } from './InventoryPermissionGuard';
import { INVENTORY_PERMISSIONS } from '../../types/inventoryPermissions';
import { InventoryList } from './InventoryList';
import { LowStockAlert } from './LowStockAlert';
import { StockTransfer } from './StockTransfer';
import { InventoryReports } from './InventoryReports';
import { InventoryAuditLog } from './InventoryAuditLog';
import { InventorySettings } from './InventorySettings';
import { CategoryManagement } from './CategoryManagement';
import { SupplierManagement } from './SupplierManagement';

export function RoleBasedInventoryView() {
  const { 
    user, 
    isSuperAdmin, 
    isAdmin, 
    isManager, 
    isEditor, 
    isViewer,
    can
  } = useAuth();

  // Get user role from user object
  const userRole = user?.role || 'USER';

  // Helper to check if user has inventory permission using the can function
  const hasInventoryPermission = (permission: string) => {
    return can(permission);
  };

  // Helper to check if user can view admin sections
  const canViewAdminSections = isSuperAdmin || isAdmin || isManager;
  const canViewAdminOnlySections = isSuperAdmin || isAdmin;
  const canViewSuperAdminSections = isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Role Badge */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <span className="text-sm text-gray-600 dark:text-gray-300">Your Role:</span>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          isSuperAdmin ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
          isAdmin ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
          isManager ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
          isEditor ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
          'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300'
        }`}>
          {userRole}
        </span>
        {isSuperAdmin && (
          <span className="text-xs text-purple-600 dark:text-purple-400">(Full Access)</span>
        )}
      </div>

      {/* Low Stock Alert - Visible to all with view permission */}
      {hasInventoryPermission(INVENTORY_PERMISSIONS.VIEW_LOW_STOCK) && (
        <LowStockAlert />
      )}

      {/* Main Inventory List - Visible to all with view permission */}
      {hasInventoryPermission(INVENTORY_PERMISSIONS.VIEW) && (
        <InventoryList />
      )}

      {/* Admin/Manager Only Sections */}
      {canViewAdminSections && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Transfer - Only for users with transfer permission */}
          {hasInventoryPermission(INVENTORY_PERMISSIONS.TRANSFER) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Transfer</h3>
              <StockTransfer />
            </div>
          )}

          {/* Reports - Only for users with reports permission */}
          {hasInventoryPermission(INVENTORY_PERMISSIONS.VIEW_REPORTS) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Reports Summary</h3>
              <InventoryReports />
            </div>
          )}
        </div>
      )}

      {/* Admin Only Sections */}
      {canViewAdminOnlySections && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Category Management */}
          {hasInventoryPermission(INVENTORY_PERMISSIONS.MANAGE_CATEGORIES) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Categories</h3>
              <CategoryManagement />
            </div>
          )}

          {/* Supplier Management */}
          {hasInventoryPermission(INVENTORY_PERMISSIONS.MANAGE_SUPPLIERS) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Suppliers</h3>
              <SupplierManagement />
            </div>
          )}
        </div>
      )}

      {/* Super Admin Only Sections */}
      {canViewSuperAdminSections && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Audit Log */}
          {hasInventoryPermission(INVENTORY_PERMISSIONS.VIEW_AUDIT) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Audit Log</h3>
              <InventoryAuditLog />
            </div>
          )}

          {/* Settings */}
          {hasInventoryPermission(INVENTORY_PERMISSIONS.MANAGE_SETTINGS) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Settings</h3>
              <InventorySettings />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
