// D:\Projects\Kalwanga\packages\web\hooks\usePermission.ts

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import { UserRole } from '../types/enums';
import { PERMISSIONS, ROLE_PERMISSIONS, hasPermission, hasAnyPermission, hasAllPermissions } from '../types/permissions';
import type { Permission } from '../types/permissions';

// ============================================
// BUSINESS UNIT TYPES
// ============================================

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  type?: string;
  isActive?: boolean;
  companyId?: string;
  companyName?: string;
}

export interface BusinessUnitContextType {
  businessUnits: BusinessUnit[];
  currentBusinessUnit: BusinessUnit | null;
  loading: boolean;
  switchBusinessUnit: (id: string) => Promise<void>;
  refreshBusinessUnits: () => Promise<void>;
  hasBusinessUnitAccess: (businessUnitId: string) => boolean;
  getBusinessUnitById: (id: string) => BusinessUnit | undefined;
}

export interface UsePermissionReturn {
  // Loading state
  isLoading: boolean;
  
  // Basic permission checks
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  
  // Role checks
  isRole: (role: UserRole | string) => boolean;
  isAtLeast: (role: UserRole) => boolean;
  isSuperAdmin: () => boolean;
  isAdminOrAbove: () => boolean;
  isManagerOrAbove: () => boolean;
  isEditorOrAbove: () => boolean;
  isViewerOrAbove: () => boolean;
  
  // Resource-specific permission checks
  canView: (resource: string) => boolean;
  canCreate: (resource: string) => boolean;
  canEdit: (resource: string) => boolean;
  canDelete: (resource: string) => boolean;
  canManage: (resource: string) => boolean;
  canExport: () => boolean;
  canImport: () => boolean;
  
  // Pre-defined permission checks - User Management
  canManageUsers: () => boolean;
  canViewUsers: () => boolean;
  canCreateUsers: () => boolean;
  canEditUsers: () => boolean;
  canDeleteUsers: () => boolean;
  canExportUsers: () => boolean;
  canActivateUsers: () => boolean;
  canDeactivateUsers: () => boolean;
  canUpdateUserRole: () => boolean;
  
  // Pre-defined permission checks - Category
  canManageCategories: () => boolean;
  canViewCategories: () => boolean;
  canCreateCategories: () => boolean;
  canEditCategories: () => boolean;
  canDeleteCategories: () => boolean;
  
  // Pre-defined permission checks - Product
  canManageProducts: () => boolean;
  canViewProducts: () => boolean;
  canCreateProducts: () => boolean;
  canEditProducts: () => boolean;
  canDeleteProducts: () => boolean;
  canExportProducts: () => boolean;
  canImportProducts: () => boolean;
  
  // Pre-defined permission checks - Orders
  canManageOrders: () => boolean;
  canViewOrders: () => boolean;
  canCreateOrders: () => boolean;
  canEditOrders: () => boolean;
  canDeleteOrders: () => boolean;
  canProcessOrders: () => boolean;
  canCancelOrders: () => boolean;
  
  // Pre-defined permission checks - Customers
  canManageCustomers: () => boolean;
  canViewCustomers: () => boolean;
  canCreateCustomers: () => boolean;
  canEditCustomers: () => boolean;
  canDeleteCustomers: () => boolean;
  
  // Pre-defined permission checks - Inventory
  canManageInventory: () => boolean;
  canViewInventory: () => boolean;
  canCreateInventory: () => boolean;
  canEditInventory: () => boolean;
  canDeleteInventory: () => boolean;
  canAdjustInventory: () => boolean;
  canTransferInventory: () => boolean;
  
  // Pre-defined permission checks - Sales
  canManageSales: () => boolean;
  canViewSales: () => boolean;
  canCreateSales: () => boolean;
  canEditSales: () => boolean;
  canDeleteSales: () => boolean;
  canExportSales: () => boolean;
  canPrintSales: () => boolean;
  canEmailSales: () => boolean;
  
  // Pre-defined permission checks - Returns
  canManageReturns: () => boolean;
  canViewReturns: () => boolean;
  canCreateReturns: () => boolean;
  canEditReturns: () => boolean;
  canDeleteReturns: () => boolean;
  canApproveReturns: () => boolean;
  canRejectReturns: () => boolean;
  canProcessReturns: () => boolean;
  
  // Pre-defined permission checks - Refunds
  canManageRefunds: () => boolean;
  canViewRefunds: () => boolean;
  canCreateRefunds: () => boolean;
  canEditRefunds: () => boolean;
  canDeleteRefunds: () => boolean;
  canApproveRefunds: () => boolean;
  canRejectRefunds: () => boolean;
  canCompleteRefunds: () => boolean;
  
  // Pre-defined permission checks - Invoices
  canManageInvoices: () => boolean;
  canViewInvoices: () => boolean;
  canCreateInvoices: () => boolean;
  canEditInvoices: () => boolean;
  canDeleteInvoices: () => boolean;
  canSendInvoices: () => boolean;
  canPrintInvoices: () => boolean;
  canMarkInvoicePaid: () => boolean;
  canVoidInvoices: () => boolean;
  canCancelInvoices: () => boolean;
  
  // Pre-defined permission checks - Receipts
  canManageReceipts: () => boolean;
  canViewReceipts: () => boolean;
  canCreateReceipts: () => boolean;
  canEditReceipts: () => boolean;
  canDeleteReceipts: () => boolean;
  canPrintReceipts: () => boolean;
  canEmailReceipts: () => boolean;
  canVoidReceipts: () => boolean;
  
  // Pre-defined permission checks - Payments
  canManagePayments: () => boolean;
  canViewPayments: () => boolean;
  canCreatePayments: () => boolean;
  canRefundPayments: () => boolean;
  
  // Pre-defined permission checks - POS
  canManagePos: () => boolean;
  canViewPos: () => boolean;
  canCreatePos: () => boolean;
  canPrintPos: () => boolean;
  
  // Pre-defined permission checks - Cash Register
  canManageCashRegister: () => boolean;
  canViewCashRegister: () => boolean;
  canOpenCashRegister: () => boolean;
  canCloseCashRegister: () => boolean;
  
  // Pre-defined permission checks - Shifts
  canManageShifts: () => boolean;
  canViewShifts: () => boolean;
  canStartShift: () => boolean;
  canEndShift: () => boolean;
  
  // Pre-defined permission checks - Reports
  canManageReports: () => boolean;
  canViewReports: () => boolean;
  canCreateReports: () => boolean;
  canExportReports: () => boolean;
  
  // Pre-defined permission checks - Analytics
  canViewAnalytics: () => boolean;
  canExportAnalytics: () => boolean;
  
  // Pre-defined permission checks - Settings
  canManageSettings: () => boolean;
  canViewSettings: () => boolean;
  canEditSettings: () => boolean;
  
  // Pre-defined permission checks - Business Units
  canManageBusinessUnits: () => boolean;
  canViewBusinessUnits: () => boolean;
  canCreateBusinessUnits: () => boolean;
  canEditBusinessUnits: () => boolean;
  canDeleteBusinessUnits: () => boolean;
  
  // Pre-defined permission checks - System
  canViewSystemLogs: () => boolean;
  canBackupSystem: () => boolean;
  canRestoreSystem: () => boolean;
  
  // Pre-defined permission checks - Dashboard
  canViewDashboard: () => boolean;
  canManageDashboard: () => boolean;
  
  // Pre-defined permission checks - Integrations
  canManageIntegrations: () => boolean;
  canViewIntegrations: () => boolean;
  canManageApi: () => boolean;
  canViewApi: () => boolean;
  canManageWebhooks: () => boolean;
  canViewWebhooks: () => boolean;
  
  // Utility functions
  getPermissions: () => string[];
  getPermissionsByResource: () => Record<string, string[]>;
  
  // Business Unit functions
  getBusinessUnits: () => BusinessUnit[];
  getCurrentBusinessUnit: () => BusinessUnit | null;
  switchBusinessUnit: (id: string) => Promise<void>;
  refreshBusinessUnits: () => Promise<void>;
  hasBusinessUnitAccess: (businessUnitId: string) => boolean;
  getBusinessUnitById: (id: string) => BusinessUnit | undefined;
  isBusinessUnitSelected: () => boolean;
  getBusinessUnitName: (id: string) => string;
  
  // User info
  user: any;
  userRole: string;
}

// ============================================
// BUSINESS UNIT PROVIDER STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
  BUSINESS_UNITS: 'businessUnits',
  CURRENT_BUSINESS_UNIT: 'businessUnitId',
  SELECTED_BUSINESS_UNIT: 'selectedBusinessUnitId',
} as const;

// ============================================
// MAIN HOOK
// ============================================

export function usePermission(): UsePermissionReturn {
  const { 
    user, 
    userRole, 
    loading: authLoading, 
    can,
    isSuperAdmin,
    isAdmin,
    isManager,
    isEditor,
    isViewer
  } = useAuth();
  
  const [isClient, setIsClient] = useState(false);
  
  // Business Unit State
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [currentBusinessUnit, setCurrentBusinessUnit] = useState<BusinessUnit | null>(null);
  const [loadingBusinessUnits, setLoadingBusinessUnits] = useState(false);
  const [businessUnitsLoaded, setBusinessUnitsLoaded] = useState(false);

  // Set isClient to true once component mounts (client-side only)
  useEffect(() => {
    setIsClient(true);
  }, []);

  // ============================================
  // BUSINESS UNIT HELPERS
  // ============================================

  const extractBusinessUnits = useCallback((userData: any): BusinessUnit[] => {
    if (!userData) return [];
    
    const units: BusinessUnit[] = [];
    const userAny = userData as any;
    
    // Try multiple sources for business units
    
    // 1. From user.businessUnits array
    if (userAny?.businessUnits && Array.isArray(userAny.businessUnits)) {
      const extracted = userAny.businessUnits
        .map((bu: any) => {
          const id = bu.businessUnitId || bu.id || bu;
          if (!id || id === 'default' || id === 'default-business-unit') return null;
          
          return {
            id: id,
            name: bu.businessUnit?.name || bu.name || bu.businessUnitName || 'Unnamed Business Unit',
            code: bu.businessUnit?.code || bu.code || '',
            type: bu.businessUnit?.type || bu.type || '',
            isActive: bu.businessUnit?.isActive !== undefined 
              ? bu.businessUnit.isActive 
              : (bu.isActive !== undefined ? bu.isActive : true),
            companyId: bu.businessUnit?.companyId || bu.companyId || '',
            companyName: bu.businessUnit?.company?.name || bu.companyName || '',
          };
        })
        .filter((bu: BusinessUnit | null): bu is BusinessUnit => bu !== null);
      
      units.push(...extracted);
    }
    
    // 2. From direct businessUnitId
    if (units.length === 0 && userAny?.businessUnitId) {
      const id = userAny.businessUnitId;
      if (id && id !== 'default' && id !== 'default-business-unit') {
        units.push({
          id: id,
          name: userAny.businessUnit?.name || 'Default Business Unit',
          code: userAny.businessUnit?.code || '',
          type: userAny.businessUnit?.type || '',
          isActive: true,
          companyId: userAny.businessUnit?.companyId || '',
          companyName: userAny.businessUnit?.company?.name || '',
        });
      }
    }
    
    // 3. From localStorage
    if (units.length === 0) {
      const stored = localStorage.getItem(STORAGE_KEYS.BUSINESS_UNITS);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const extracted = parsed
              .map((bu: any) => {
                const id = bu.businessUnitId || bu.id || bu;
                if (!id || id === 'default' || id === 'default-business-unit') return null;
                return {
                  id: id,
                  name: bu.businessUnit?.name || bu.name || 'Unnamed Business Unit',
                  code: bu.businessUnit?.code || bu.code || '',
                  type: bu.businessUnit?.type || bu.type || '',
                  isActive: true,
                  companyId: bu.businessUnit?.companyId || bu.companyId || '',
                  companyName: bu.businessUnit?.company?.name || bu.companyName || '',
                };
              })
              .filter((bu: BusinessUnit | null): bu is BusinessUnit => bu !== null);
            units.push(...extracted);
          }
        } catch (e) {
          console.warn('Failed to parse business units from localStorage:', e);
        }
      }
    }
    
    // 4. From single localStorage entry
    if (units.length === 0) {
      const defaultBU = localStorage.getItem(STORAGE_KEYS.CURRENT_BUSINESS_UNIT);
      if (defaultBU && defaultBU !== 'default' && defaultBU !== 'default-business-unit') {
        units.push({
          id: defaultBU,
          name: 'Default Business Unit',
          code: 'DEFAULT',
          type: 'STORE',
          isActive: true,
        });
      }
    }
    
    return units;
  }, []);

  const loadBusinessUnits = useCallback(async (): Promise<void> => {
    if (!isClient) return;
    if (!user) {
      setBusinessUnits([]);
      setCurrentBusinessUnit(null);
      setBusinessUnitsLoaded(true);
      return;
    }
    
    // If SUPER_ADMIN, we might want to load all business units from API
    // For now, extract from user data
    setLoadingBusinessUnits(true);
    
    try {
      let units = extractBusinessUnits(user);
      
      // If SUPER_ADMIN and no units found, try to fetch from API
      if (isSuperAdmin && units.length === 0) {
        try {
          // Try to fetch from API
          const response = await fetch('/api/business-units', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.data && Array.isArray(data.data)) {
              units = data.data.map((bu: any) => ({
                id: bu.id,
                name: bu.name || 'Unnamed Business Unit',
                code: bu.code || '',
                type: bu.type || '',
                isActive: bu.isActive !== false,
                companyId: bu.companyId || '',
                companyName: bu.company?.name || '',
              }));
            }
          }
        } catch (e) {
          console.warn('Failed to fetch business units from API:', e);
        }
      }
      
      // Save to state
      setBusinessUnits(units);
      
      // Auto-select business unit
      if (units.length > 0) {
        // Try saved selection
        const savedId = localStorage.getItem(STORAGE_KEYS.SELECTED_BUSINESS_UNIT) || 
                       localStorage.getItem(STORAGE_KEYS.CURRENT_BUSINESS_UNIT);
        
        if (savedId) {
          const saved = units.find(bu => bu.id === savedId && bu.isActive !== false);
          if (saved) {
            setCurrentBusinessUnit(saved);
            localStorage.setItem(STORAGE_KEYS.CURRENT_BUSINESS_UNIT, saved.id);
            return;
          }
        }
        
        // Try first active unit
        const active = units.find(bu => bu.isActive !== false);
        if (active) {
          setCurrentBusinessUnit(active);
          localStorage.setItem(STORAGE_KEYS.CURRENT_BUSINESS_UNIT, active.id);
          localStorage.setItem(STORAGE_KEYS.SELECTED_BUSINESS_UNIT, active.id);
          return;
        }
        
        // Fallback to first unit
        if (units.length > 0) {
          setCurrentBusinessUnit(units[0]);
          localStorage.setItem(STORAGE_KEYS.CURRENT_BUSINESS_UNIT, units[0].id);
        }
      } else {
        setCurrentBusinessUnit(null);
      }
      
      // Save units to localStorage for persistence
      if (units.length > 0) {
        localStorage.setItem(STORAGE_KEYS.BUSINESS_UNITS, JSON.stringify(units));
      }
      
    } catch (error) {
      console.error('Failed to load business units:', error);
    } finally {
      setLoadingBusinessUnits(false);
      setBusinessUnitsLoaded(true);
    }
  }, [isClient, user, isSuperAdmin, extractBusinessUnits]);

  // Load business units on mount and when user changes
  useEffect(() => {
    if (isClient && user) {
      loadBusinessUnits();
    }
  }, [isClient, user, loadBusinessUnits]);

  // Listen for business unit changes from other tabs
  useEffect(() => {
    if (!isClient) return;
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.CURRENT_BUSINESS_UNIT && e.newValue) {
        const unit = businessUnits.find(bu => bu.id === e.newValue);
        if (unit) {
          setCurrentBusinessUnit(unit);
          localStorage.setItem(STORAGE_KEYS.SELECTED_BUSINESS_UNIT, unit.id);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isClient, businessUnits]);

  // ============================================
  // BUSINESS UNIT FUNCTIONS
  // ============================================

  const getBusinessUnits = useCallback((): BusinessUnit[] => {
    return businessUnits;
  }, [businessUnits]);

  const getCurrentBusinessUnit = useCallback((): BusinessUnit | null => {
    return currentBusinessUnit;
  }, [currentBusinessUnit]);

  const switchBusinessUnit = useCallback(async (id: string): Promise<void> => {
    const unit = businessUnits.find(bu => bu.id === id);
    if (!unit) {
      throw new Error(`Business unit with ID ${id} not found`);
    }
    if (unit.isActive === false) {
      throw new Error('Business unit is inactive');
    }
    
    try {
      // Update state
      setCurrentBusinessUnit(unit);
      
      // Persist to localStorage
      localStorage.setItem(STORAGE_KEYS.CURRENT_BUSINESS_UNIT, unit.id);
      localStorage.setItem(STORAGE_KEYS.SELECTED_BUSINESS_UNIT, unit.id);
      
      // Dispatch event for other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('businessUnitChanged', { 
          detail: { businessUnitId: unit.id, businessUnit: unit } 
        }));
      }
      
      // Optionally call API to update user's default
      try {
        await fetch('/api/user/set-default-business-unit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({ businessUnitId: unit.id }),
        });
      } catch (e) {
        // Silently fail - localStorage persistence is enough
        console.warn('Failed to update default business unit on server:', e);
      }
      
    } catch (error) {
      console.error('Failed to switch business unit:', error);
      throw error;
    }
  }, [businessUnits]);

  const refreshBusinessUnits = useCallback(async (): Promise<void> => {
    // Clear cache
    localStorage.removeItem(STORAGE_KEYS.BUSINESS_UNITS);
    setBusinessUnitsLoaded(false);
    await loadBusinessUnits();
  }, [loadBusinessUnits]);

  const hasBusinessUnitAccess = useCallback((businessUnitId: string): boolean => {
    if (!businessUnitId) return false;
    if (isSuperAdmin) return true;
    return businessUnits.some(bu => bu.id === businessUnitId && bu.isActive !== false);
  }, [businessUnits, isSuperAdmin]);

  const getBusinessUnitById = useCallback((id: string): BusinessUnit | undefined => {
    return businessUnits.find(bu => bu.id === id);
  }, [businessUnits]);

  const isBusinessUnitSelected = useCallback((): boolean => {
    return currentBusinessUnit !== null;
  }, [currentBusinessUnit]);

  const getBusinessUnitName = useCallback((id: string): string => {
    const unit = businessUnits.find(bu => bu.id === id);
    return unit?.name || 'Unknown Business Unit';
  }, [businessUnits]);

  // ============================================
  // EXISTING PERMISSION CHECKS (UNCHANGED)
  // ============================================

  // Check if user has a specific permission
  const hasPermission = useCallback((permission: string): boolean => {
    if (!isClient) return false;
    if (!user) return false;
    return can(permission);
  }, [isClient, user, can]);

  // Check if user has any of the given permissions
  const hasAnyPermissionFn = useCallback((permissions: string[]): boolean => {
    if (!isClient) return false;
    if (!user) return false;
    return permissions.some(p => can(p));
  }, [isClient, user, can]);

  // Check if user has all of the given permissions
  const hasAllPermissionsFn = useCallback((permissions: string[]): boolean => {
    if (!isClient) return false;
    if (!user) return false;
    return permissions.every(p => can(p));
  }, [isClient, user, can]);

  // Check if user has a specific role
  const isRole = useCallback((role: UserRole | string): boolean => {
    if (!isClient) return false;
    return userRole === role;
  }, [isClient, userRole]);

  // Check if user's role is at least the given level
  const isAtLeast = useCallback((role: UserRole): boolean => {
    if (!isClient) return false;
    const roleLevel: Record<UserRole, number> = {
      [UserRole.USER]: 0,
      [UserRole.CASHIER]: 1,
      [UserRole.VIEWER]: 1,
      [UserRole.EMPLOYEE]: 2,
      [UserRole.EDITOR]: 3,
      [UserRole.MANAGER]: 4,
      [UserRole.ADMIN]: 5,
      [UserRole.SUPER_ADMIN]: 6,
    };
    
    const userLevel = roleLevel[userRole as UserRole] || 0;
    const requiredLevel = roleLevel[role] || 0;
    return userLevel >= requiredLevel;
  }, [isClient, userRole]);

  // Check if user is SUPER_ADMIN
  const isSuperAdminFn = useCallback((): boolean => {
    if (!isClient) return false;
    return isSuperAdmin;
  }, [isClient, isSuperAdmin]);

  // Check if user is ADMIN or above
  const isAdminOrAbove = useCallback((): boolean => {
    if (!isClient) return false;
    return isAdmin || isSuperAdmin;
  }, [isClient, isAdmin, isSuperAdmin]);

  // Check if user is MANAGER or above
  const isManagerOrAbove = useCallback((): boolean => {
    if (!isClient) return false;
    return isManager || isAdmin || isSuperAdmin;
  }, [isClient, isManager, isAdmin, isSuperAdmin]);

  // Check if user is EDITOR or above
  const isEditorOrAbove = useCallback((): boolean => {
    if (!isClient) return false;
    return isEditor || isManager || isAdmin || isSuperAdmin;
  }, [isClient, isEditor, isManager, isAdmin, isSuperAdmin]);

  // Check if user is VIEWER or above
  const isViewerOrAbove = useCallback((): boolean => {
    if (!isClient) return false;
    return isViewer || isEditor || isManager || isAdmin || isSuperAdmin;
  }, [isClient, isViewer, isEditor, isManager, isAdmin, isSuperAdmin]);

  // Resource-specific permission checks
  const canView = useCallback((resource: string): boolean => {
    if (!isClient) return false;
    return can(`${resource}:view`) || can(`${resource}:read`);
  }, [isClient, can]);

  const canCreate = useCallback((resource: string): boolean => {
    if (!isClient) return false;
    return can(`${resource}:create`);
  }, [isClient, can]);

  const canEdit = useCallback((resource: string): boolean => {
    if (!isClient) return false;
    return can(`${resource}:edit`) || can(`${resource}:update`);
  }, [isClient, can]);

  const canDelete = useCallback((resource: string): boolean => {
    if (!isClient) return false;
    return can(`${resource}:delete`);
  }, [isClient, can]);

  const canManage = useCallback((resource: string): boolean => {
    if (!isClient) return false;
    return can(`${resource}:manage`);
  }, [isClient, can]);

  // Check if user can export any data
  const canExport = useCallback((): boolean => {
    if (!isClient) return false;
    if (!user) return false;
    
    // Super admin can export anything
    if (isSuperAdmin) return true;
    
    // Check for any export permission
    const exportPermissions = [
      PERMISSIONS.PRODUCT_EXPORT,
      PERMISSIONS.REPORT_EXPORT,
      PERMISSIONS.SALE_EXPORT,
      PERMISSIONS.USER_EXPORT,
      PERMISSIONS.INVENTORY_VIEW,
    ];
    
    return exportPermissions.some(p => can(p));
  }, [isClient, user, can, isSuperAdmin]);

  // Check if user can import data
  const canImport = useCallback((): boolean => {
    if (!isClient) return false;
    if (!user) return false;
    
    // Super admin can import anything
    if (isSuperAdmin) return true;
    
    // Check for any import permission
    const importPermissions = [
      PERMISSIONS.PRODUCT_IMPORT,
    ];
    
    return importPermissions.some(p => can(p));
  }, [isClient, user, can, isSuperAdmin]);

  // Get all permissions for the current user
  const getPermissions = useCallback((): string[] => {
    if (!isClient) return [];
    if (!user) return [];
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions;
    }
    return ROLE_PERMISSIONS[userRole as UserRole] || [];
  }, [isClient, user, userRole]);

  // Get all permissions grouped by resource
  const getPermissionsByResource = useCallback((): Record<string, string[]> => {
    if (!isClient) return {};
    const permissions = getPermissions();
    const grouped: Record<string, string[]> = {};
    
    permissions.forEach(permission => {
      const [resource, action] = permission.split(':');
      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      if (!grouped[resource].includes(action)) {
        grouped[resource].push(action);
      }
    });
    
    return grouped;
  }, [isClient, getPermissions]);

  // ============================================
  // PRE-DEFINED PERMISSION CHECKS (UNCHANGED)
  // ============================================

  // User Management
  const canManageUsers = useCallback((): boolean => can(PERMISSIONS.USER_MANAGE), [can]);
  const canViewUsers = useCallback((): boolean => can(PERMISSIONS.USER_VIEW), [can]);
  const canCreateUsers = useCallback((): boolean => can(PERMISSIONS.USER_CREATE), [can]);
  const canEditUsers = useCallback((): boolean => can(PERMISSIONS.USER_EDIT), [can]);
  const canDeleteUsers = useCallback((): boolean => can(PERMISSIONS.USER_DELETE), [can]);
  const canExportUsers = useCallback((): boolean => can(PERMISSIONS.USER_EXPORT), [can]);
  const canActivateUsers = useCallback((): boolean => can(PERMISSIONS.USER_ACTIVATE), [can]);
  const canDeactivateUsers = useCallback((): boolean => can(PERMISSIONS.USER_DEACTIVATE), [can]);
  const canUpdateUserRole = useCallback((): boolean => can(PERMISSIONS.USER_ROLE_UPDATE), [can]);

  // Category
  const canManageCategories = useCallback((): boolean => can(PERMISSIONS.CATEGORY_MANAGE), [can]);
  const canViewCategories = useCallback((): boolean => can(PERMISSIONS.CATEGORY_VIEW), [can]);
  const canCreateCategories = useCallback((): boolean => can(PERMISSIONS.CATEGORY_CREATE), [can]);
  const canEditCategories = useCallback((): boolean => can(PERMISSIONS.CATEGORY_EDIT), [can]);
  const canDeleteCategories = useCallback((): boolean => can(PERMISSIONS.CATEGORY_DELETE), [can]);

  // Product
  const canManageProducts = useCallback((): boolean => can(PERMISSIONS.PRODUCT_MANAGE), [can]);
  const canViewProducts = useCallback((): boolean => can(PERMISSIONS.PRODUCT_VIEW), [can]);
  const canCreateProducts = useCallback((): boolean => can(PERMISSIONS.PRODUCT_CREATE), [can]);
  const canEditProducts = useCallback((): boolean => can(PERMISSIONS.PRODUCT_EDIT), [can]);
  const canDeleteProducts = useCallback((): boolean => can(PERMISSIONS.PRODUCT_DELETE), [can]);
  const canExportProducts = useCallback((): boolean => can(PERMISSIONS.PRODUCT_EXPORT), [can]);
  const canImportProducts = useCallback((): boolean => can(PERMISSIONS.PRODUCT_IMPORT), [can]);

  // Orders
  const canManageOrders = useCallback((): boolean => can(PERMISSIONS.ORDER_MANAGE), [can]);
  const canViewOrders = useCallback((): boolean => can(PERMISSIONS.ORDER_VIEW), [can]);
  const canCreateOrders = useCallback((): boolean => can(PERMISSIONS.ORDER_CREATE), [can]);
  const canEditOrders = useCallback((): boolean => can(PERMISSIONS.ORDER_EDIT), [can]);
  const canDeleteOrders = useCallback((): boolean => can(PERMISSIONS.ORDER_DELETE), [can]);
  const canProcessOrders = useCallback((): boolean => can(PERMISSIONS.ORDER_PROCESS), [can]);
  const canCancelOrders = useCallback((): boolean => can(PERMISSIONS.ORDER_CANCEL), [can]);

  // Customers
  const canManageCustomers = useCallback((): boolean => can(PERMISSIONS.CUSTOMER_MANAGE), [can]);
  const canViewCustomers = useCallback((): boolean => can(PERMISSIONS.CUSTOMER_VIEW), [can]);
  const canCreateCustomers = useCallback((): boolean => can(PERMISSIONS.CUSTOMER_CREATE), [can]);
  const canEditCustomers = useCallback((): boolean => can(PERMISSIONS.CUSTOMER_EDIT), [can]);
  const canDeleteCustomers = useCallback((): boolean => can(PERMISSIONS.CUSTOMER_DELETE), [can]);

  // Inventory
  const canManageInventory = useCallback((): boolean => can(PERMISSIONS.INVENTORY_MANAGE), [can]);
  const canViewInventory = useCallback((): boolean => can(PERMISSIONS.INVENTORY_VIEW), [can]);
  const canCreateInventory = useCallback((): boolean => can(PERMISSIONS.INVENTORY_CREATE), [can]);
  const canEditInventory = useCallback((): boolean => can(PERMISSIONS.INVENTORY_EDIT), [can]);
  const canDeleteInventory = useCallback((): boolean => can(PERMISSIONS.INVENTORY_DELETE), [can]);
  const canAdjustInventory = useCallback((): boolean => can(PERMISSIONS.INVENTORY_ADJUST), [can]);
  const canTransferInventory = useCallback((): boolean => can(PERMISSIONS.INVENTORY_TRANSFER), [can]);

  // Sales
  const canManageSales = useCallback((): boolean => can(PERMISSIONS.SALE_MANAGE), [can]);
  const canViewSales = useCallback((): boolean => can(PERMISSIONS.SALE_VIEW), [can]);
  const canCreateSales = useCallback((): boolean => can(PERMISSIONS.SALE_CREATE), [can]);
  const canEditSales = useCallback((): boolean => can(PERMISSIONS.SALE_EDIT), [can]);
  const canDeleteSales = useCallback((): boolean => can(PERMISSIONS.SALE_DELETE), [can]);
  const canExportSales = useCallback((): boolean => can(PERMISSIONS.SALE_EXPORT), [can]);
  const canPrintSales = useCallback((): boolean => can(PERMISSIONS.SALE_PRINT), [can]);
  const canEmailSales = useCallback((): boolean => can(PERMISSIONS.SALE_EMAIL), [can]);

  // Returns
  const canManageReturns = useCallback((): boolean => can(PERMISSIONS.RETURN_MANAGE), [can]);
  const canViewReturns = useCallback((): boolean => can(PERMISSIONS.RETURN_VIEW), [can]);
  const canCreateReturns = useCallback((): boolean => can(PERMISSIONS.RETURN_CREATE), [can]);
  const canEditReturns = useCallback((): boolean => can(PERMISSIONS.RETURN_EDIT), [can]);
  const canDeleteReturns = useCallback((): boolean => can(PERMISSIONS.RETURN_DELETE), [can]);
  const canApproveReturns = useCallback((): boolean => can(PERMISSIONS.RETURN_APPROVE), [can]);
  const canRejectReturns = useCallback((): boolean => can(PERMISSIONS.RETURN_REJECT), [can]);
  const canProcessReturns = useCallback((): boolean => can(PERMISSIONS.RETURN_PROCESS), [can]);

  // Refunds
  const canManageRefunds = useCallback((): boolean => can(PERMISSIONS.REFUND_MANAGE), [can]);
  const canViewRefunds = useCallback((): boolean => can(PERMISSIONS.REFUND_VIEW), [can]);
  const canCreateRefunds = useCallback((): boolean => can(PERMISSIONS.REFUND_CREATE), [can]);
  const canEditRefunds = useCallback((): boolean => can(PERMISSIONS.REFUND_EDIT), [can]);
  const canDeleteRefunds = useCallback((): boolean => can(PERMISSIONS.REFUND_DELETE), [can]);
  const canApproveRefunds = useCallback((): boolean => can(PERMISSIONS.REFUND_APPROVE), [can]);
  const canRejectRefunds = useCallback((): boolean => can(PERMISSIONS.REFUND_REJECT), [can]);
  const canCompleteRefunds = useCallback((): boolean => can(PERMISSIONS.REFUND_COMPLETE), [can]);

  // Invoices
  const canManageInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_MANAGE), [can]);
  const canViewInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_VIEW), [can]);
  const canCreateInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_CREATE), [can]);
  const canEditInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_EDIT), [can]);
  const canDeleteInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_DELETE), [can]);
  const canSendInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_SEND), [can]);
  const canPrintInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_PRINT), [can]);
  const canMarkInvoicePaid = useCallback((): boolean => can(PERMISSIONS.INVOICE_PAID), [can]);
  const canVoidInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_VOID), [can]);
  const canCancelInvoices = useCallback((): boolean => can(PERMISSIONS.INVOICE_CANCEL), [can]);

  // Receipts
  const canManageReceipts = useCallback((): boolean => can(PERMISSIONS.RECEIPT_MANAGE), [can]);
  const canViewReceipts = useCallback((): boolean => can(PERMISSIONS.RECEIPT_VIEW), [can]);
  const canCreateReceipts = useCallback((): boolean => can(PERMISSIONS.RECEIPT_CREATE), [can]);
  const canEditReceipts = useCallback((): boolean => can(PERMISSIONS.RECEIPT_EDIT), [can]);
  const canDeleteReceipts = useCallback((): boolean => can(PERMISSIONS.RECEIPT_DELETE), [can]);
  const canPrintReceipts = useCallback((): boolean => can(PERMISSIONS.RECEIPT_PRINT), [can]);
  const canEmailReceipts = useCallback((): boolean => can(PERMISSIONS.RECEIPT_EMAIL), [can]);
  const canVoidReceipts = useCallback((): boolean => can(PERMISSIONS.RECEIPT_VOID), [can]);

  // Payments
  const canManagePayments = useCallback((): boolean => can(PERMISSIONS.PAYMENT_MANAGE), [can]);
  const canViewPayments = useCallback((): boolean => can(PERMISSIONS.PAYMENT_VIEW), [can]);
  const canCreatePayments = useCallback((): boolean => can(PERMISSIONS.PAYMENT_CREATE), [can]);
  const canRefundPayments = useCallback((): boolean => can(PERMISSIONS.PAYMENT_REFUND), [can]);

  // POS
  const canManagePos = useCallback((): boolean => can(PERMISSIONS.POS_MANAGE), [can]);
  const canViewPos = useCallback((): boolean => can(PERMISSIONS.POS_VIEW), [can]);
  const canCreatePos = useCallback((): boolean => can(PERMISSIONS.POS_CREATE), [can]);
  const canPrintPos = useCallback((): boolean => can(PERMISSIONS.POS_PRINT), [can]);

  // Cash Register
  const canManageCashRegister = useCallback((): boolean => can(PERMISSIONS.CASH_REGISTER_MANAGE), [can]);
  const canViewCashRegister = useCallback((): boolean => can(PERMISSIONS.CASH_REGISTER_VIEW), [can]);
  const canOpenCashRegister = useCallback((): boolean => can(PERMISSIONS.CASH_REGISTER_OPEN), [can]);
  const canCloseCashRegister = useCallback((): boolean => can(PERMISSIONS.CASH_REGISTER_CLOSE), [can]);

  // Shifts
  const canManageShifts = useCallback((): boolean => can(PERMISSIONS.SHIFT_MANAGE), [can]);
  const canViewShifts = useCallback((): boolean => can(PERMISSIONS.SHIFT_VIEW), [can]);
  const canStartShift = useCallback((): boolean => can(PERMISSIONS.SHIFT_START), [can]);
  const canEndShift = useCallback((): boolean => can(PERMISSIONS.SHIFT_END), [can]);

  // Reports
  const canManageReports = useCallback((): boolean => can(PERMISSIONS.REPORT_MANAGE), [can]);
  const canViewReports = useCallback((): boolean => can(PERMISSIONS.REPORT_VIEW), [can]);
  const canCreateReports = useCallback((): boolean => can(PERMISSIONS.REPORT_CREATE), [can]);
  const canExportReports = useCallback((): boolean => can(PERMISSIONS.REPORT_EXPORT), [can]);

  // Analytics
  const canViewAnalytics = useCallback((): boolean => can(PERMISSIONS.ANALYTICS_VIEW), [can]);
  const canExportAnalytics = useCallback((): boolean => can(PERMISSIONS.ANALYTICS_EXPORT), [can]);

  // Settings
  const canManageSettings = useCallback((): boolean => can(PERMISSIONS.SETTINGS_MANAGE), [can]);
  const canViewSettings = useCallback((): boolean => can(PERMISSIONS.SETTINGS_VIEW), [can]);
  const canEditSettings = useCallback((): boolean => can(PERMISSIONS.SETTINGS_EDIT), [can]);

  // Business Units
  const canManageBusinessUnits = useCallback((): boolean => can(PERMISSIONS.BUSINESS_UNIT_MANAGE), [can]);
  const canViewBusinessUnits = useCallback((): boolean => can(PERMISSIONS.BUSINESS_UNIT_VIEW), [can]);
  const canCreateBusinessUnits = useCallback((): boolean => can(PERMISSIONS.BUSINESS_UNIT_CREATE), [can]);
  const canEditBusinessUnits = useCallback((): boolean => can(PERMISSIONS.BUSINESS_UNIT_EDIT), [can]);
  const canDeleteBusinessUnits = useCallback((): boolean => can(PERMISSIONS.BUSINESS_UNIT_DELETE), [can]);

  // System
  const canViewSystemLogs = useCallback((): boolean => can(PERMISSIONS.SYSTEM_LOGS), [can]);
  const canBackupSystem = useCallback((): boolean => can(PERMISSIONS.SYSTEM_BACKUP), [can]);
  const canRestoreSystem = useCallback((): boolean => can(PERMISSIONS.SYSTEM_RESTORE), [can]);

  // Dashboard
  const canViewDashboard = useCallback((): boolean => can(PERMISSIONS.DASHBOARD_VIEW), [can]);
  const canManageDashboard = useCallback((): boolean => can(PERMISSIONS.DASHBOARD_MANAGE), [can]);

  // Integrations
  const canManageIntegrations = useCallback((): boolean => can(PERMISSIONS.INTEGRATION_MANAGE), [can]);
  const canViewIntegrations = useCallback((): boolean => can(PERMISSIONS.INTEGRATION_VIEW), [can]);
  const canManageApi = useCallback((): boolean => can(PERMISSIONS.API_MANAGE), [can]);
  const canViewApi = useCallback((): boolean => can(PERMISSIONS.API_VIEW), [can]);
  const canManageWebhooks = useCallback((): boolean => can(PERMISSIONS.WEBHOOK_MANAGE), [can]);
  const canViewWebhooks = useCallback((): boolean => can(PERMISSIONS.WEBHOOK_VIEW), [can]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // Loading state
    isLoading: authLoading || !isClient || loadingBusinessUnits,
    
    // Basic permission checks
    hasPermission,
    hasAnyPermission: hasAnyPermissionFn,
    hasAllPermissions: hasAllPermissionsFn,
    
    // Role checks
    isRole,
    isAtLeast,
    isSuperAdmin: isSuperAdminFn,
    isAdminOrAbove,
    isManagerOrAbove,
    isEditorOrAbove,
    isViewerOrAbove,
    
    // Resource-specific permission checks
    canView,
    canCreate,
    canEdit,
    canDelete,
    canManage,
    canExport,
    canImport,
    
    // Pre-defined permission checks - User Management
    canManageUsers,
    canViewUsers,
    canCreateUsers,
    canEditUsers,
    canDeleteUsers,
    canExportUsers,
    canActivateUsers,
    canDeactivateUsers,
    canUpdateUserRole,
    
    // Pre-defined permission checks - Category
    canManageCategories,
    canViewCategories,
    canCreateCategories,
    canEditCategories,
    canDeleteCategories,
    
    // Pre-defined permission checks - Product
    canManageProducts,
    canViewProducts,
    canCreateProducts,
    canEditProducts,
    canDeleteProducts,
    canExportProducts,
    canImportProducts,
    
    // Pre-defined permission checks - Orders
    canManageOrders,
    canViewOrders,
    canCreateOrders,
    canEditOrders,
    canDeleteOrders,
    canProcessOrders,
    canCancelOrders,
    
    // Pre-defined permission checks - Customers
    canManageCustomers,
    canViewCustomers,
    canCreateCustomers,
    canEditCustomers,
    canDeleteCustomers,
    
    // Pre-defined permission checks - Inventory
    canManageInventory,
    canViewInventory,
    canCreateInventory,
    canEditInventory,
    canDeleteInventory,
    canAdjustInventory,
    canTransferInventory,
    
    // Pre-defined permission checks - Sales
    canManageSales,
    canViewSales,
    canCreateSales,
    canEditSales,
    canDeleteSales,
    canExportSales,
    canPrintSales,
    canEmailSales,
    
    // Pre-defined permission checks - Returns
    canManageReturns,
    canViewReturns,
    canCreateReturns,
    canEditReturns,
    canDeleteReturns,
    canApproveReturns,
    canRejectReturns,
    canProcessReturns,
    
    // Pre-defined permission checks - Refunds
    canManageRefunds,
    canViewRefunds,
    canCreateRefunds,
    canEditRefunds,
    canDeleteRefunds,
    canApproveRefunds,
    canRejectRefunds,
    canCompleteRefunds,
    
    // Pre-defined permission checks - Invoices
    canManageInvoices,
    canViewInvoices,
    canCreateInvoices,
    canEditInvoices,
    canDeleteInvoices,
    canSendInvoices,
    canPrintInvoices,
    canMarkInvoicePaid,
    canVoidInvoices,
    canCancelInvoices,
    
    // Pre-defined permission checks - Receipts
    canManageReceipts,
    canViewReceipts,
    canCreateReceipts,
    canEditReceipts,
    canDeleteReceipts,
    canPrintReceipts,
    canEmailReceipts,
    canVoidReceipts,
    
    // Pre-defined permission checks - Payments
    canManagePayments,
    canViewPayments,
    canCreatePayments,
    canRefundPayments,
    
    // Pre-defined permission checks - POS
    canManagePos,
    canViewPos,
    canCreatePos,
    canPrintPos,
    
    // Pre-defined permission checks - Cash Register
    canManageCashRegister,
    canViewCashRegister,
    canOpenCashRegister,
    canCloseCashRegister,
    
    // Pre-defined permission checks - Shifts
    canManageShifts,
    canViewShifts,
    canStartShift,
    canEndShift,
    
    // Pre-defined permission checks - Reports
    canManageReports,
    canViewReports,
    canCreateReports,
    canExportReports,
    
    // Pre-defined permission checks - Analytics
    canViewAnalytics,
    canExportAnalytics,
    
    // Pre-defined permission checks - Settings
    canManageSettings,
    canViewSettings,
    canEditSettings,
    
    // Pre-defined permission checks - Business Units
    canManageBusinessUnits,
    canViewBusinessUnits,
    canCreateBusinessUnits,
    canEditBusinessUnits,
    canDeleteBusinessUnits,
    
    // Pre-defined permission checks - System
    canViewSystemLogs,
    canBackupSystem,
    canRestoreSystem,
    
    // Pre-defined permission checks - Dashboard
    canViewDashboard,
    canManageDashboard,
    
    // Pre-defined permission checks - Integrations
    canManageIntegrations,
    canViewIntegrations,
    canManageApi,
    canViewApi,
    canManageWebhooks,
    canViewWebhooks,
    
    // Utility functions
    getPermissions,
    getPermissionsByResource,
    
    // Business Unit functions
    getBusinessUnits,
    getCurrentBusinessUnit,
    switchBusinessUnit,
    refreshBusinessUnits,
    hasBusinessUnitAccess,
    getBusinessUnitById,
    isBusinessUnitSelected,
    getBusinessUnitName,
    
    // User info
    user,
    userRole,
  };
}

// Also export as a named hook for convenience
export { usePermission as usePermissions };

// Export a convenience hook for components
export function useCan(permission: string): boolean {
  const { hasPermission } = usePermission();
  return hasPermission(permission);
}

// Export a convenience hook for checking multiple permissions
export function useCanAny(permissions: string[]): boolean {
  const { hasAnyPermission } = usePermission();
  return hasAnyPermission(permissions);
}

// Export a convenience hook for checking all permissions
export function useCanAll(permissions: string[]): boolean {
  const { hasAllPermissions } = usePermission();
  return hasAllPermissions(permissions);
}

// ============================================
// BUSINESS UNIT SPECIFIC HOOK
// ============================================

export function useBusinessUnitContext(): BusinessUnitContextType {
  const {
    getBusinessUnits,
    getCurrentBusinessUnit,
    switchBusinessUnit,
    refreshBusinessUnits,
    hasBusinessUnitAccess,
    getBusinessUnitById,
    isLoading,
  } = usePermission();

  return {
    businessUnits: getBusinessUnits(),
    currentBusinessUnit: getCurrentBusinessUnit(),
    loading: isLoading,
    switchBusinessUnit,
    refreshBusinessUnits,
    hasBusinessUnitAccess,
    getBusinessUnitById,
  };
}

// ============================================
// BUSINESS UNIT SELECTOR HOOK
// ============================================

export function useBusinessUnitSelector() {
  const {
    getBusinessUnits,
    getCurrentBusinessUnit,
    switchBusinessUnit,
    isBusinessUnitSelected,
    getBusinessUnitName,
    isLoading,
  } = usePermission();

  return {
    businessUnits: getBusinessUnits(),
    currentBusinessUnit: getCurrentBusinessUnit(),
    isSelected: isBusinessUnitSelected(),
    switchBusinessUnit,
    getBusinessUnitName,
    isLoading,
  };
}
