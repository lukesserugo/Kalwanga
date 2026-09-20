// D:\Projects\Kalwanga\packages\web\hooks\useAuth.ts

'use client';

import React, {
  useState,
  useEffect,
  useContext,
  createContext,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { authService, User as AuthUser } from '../services/authService';

// ============================================
// CANONICAL PERMISSION UTILITIES
// ============================================

import {
  isSuperAdminRole,
  WILDCARD,
} from '../types/permissions';

// ============================================
// PERMISSION TYPES
// ============================================

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'MANAGER'
  | 'EDITOR'
  | 'VIEWER'
  | 'EMPLOYEE'
  | 'CASHIER'
  | 'USER';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage' | 'view';
}

export const PERMISSIONS = {
  // Category Permissions
  CATEGORY_VIEW: 'category:view',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_EDIT: 'category:edit',
  CATEGORY_DELETE: 'category:delete',
  CATEGORY_MANAGE: 'category:manage',

  // Product Permissions
  PRODUCT_VIEW: 'product:view',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_EDIT: 'product:edit',
  PRODUCT_DELETE: 'product:delete',
  PRODUCT_MANAGE: 'product:manage',
  PRODUCT_EXPORT: 'product:export',
  PRODUCT_IMPORT: 'product:import',

  // Supplier Permissions
  SUPPLIER_VIEW: 'supplier:view',
  SUPPLIER_CREATE: 'supplier:create',
  SUPPLIER_EDIT: 'supplier:edit',
  SUPPLIER_DELETE: 'supplier:delete',
  SUPPLIER_MANAGE: 'supplier:manage',

  // Order Permissions
  ORDER_VIEW: 'order:view',
  ORDER_CREATE: 'order:create',
  ORDER_EDIT: 'order:edit',
  ORDER_DELETE: 'order:delete',
  ORDER_MANAGE: 'order:manage',
  ORDER_PROCESS: 'order:process',
  ORDER_CANCEL: 'order:cancel',

  // Customer Permissions
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_EDIT: 'customer:edit',
  CUSTOMER_DELETE: 'customer:delete',
  CUSTOMER_MANAGE: 'customer:manage',

  // Inventory Permissions
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_EDIT: 'inventory:edit',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_MANAGE: 'inventory:manage',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_TRANSFER: 'inventory:transfer',

  // User Permissions
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

  // Report Permissions
  REPORT_VIEW: 'report:view',
  REPORT_CREATE: 'report:create',
  REPORT_EXPORT: 'report:export',
  REPORT_MANAGE: 'report:manage',

  // Analytics Permissions
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // Settings Permissions
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  SETTINGS_MANAGE: 'settings:manage',

  // System Permissions
  SYSTEM_LOGS: 'system:logs',
  SYSTEM_BACKUP: 'system:backup',
  SYSTEM_RESTORE: 'system:restore',
  SYSTEM_SETTINGS: 'system:settings',

  // Business Unit Permissions
  BUSINESS_UNIT_VIEW: 'business_unit:view',
  BUSINESS_UNIT_CREATE: 'business_unit:create',
  BUSINESS_UNIT_EDIT: 'business_unit:edit',
  BUSINESS_UNIT_DELETE: 'business_unit:delete',
  BUSINESS_UNIT_MANAGE: 'business_unit:manage',

  // Sales Permissions
  SALE_VIEW: 'sale:view',
  SALE_CREATE: 'sale:create',
  SALE_EDIT: 'sale:edit',
  SALE_DELETE: 'sale:delete',
  SALE_MANAGE: 'sale:manage',
  SALE_EXPORT: 'sale:export',
  SALE_PRINT: 'sale:print',
  SALE_EMAIL: 'sale:email',

  // POS Permissions
  POS_VIEW: 'pos:view',
  POS_CREATE: 'pos:create',
  POS_MANAGE: 'pos:manage',
  POS_PRINT: 'pos:print',

  // Cash Register Permissions
  CASH_REGISTER_VIEW: 'cash_register:view',
  CASH_REGISTER_MANAGE: 'cash_register:manage',
  CASH_REGISTER_OPEN: 'cash_register:open',
  CASH_REGISTER_CLOSE: 'cash_register:close',

  // Shift Permissions
  SHIFT_VIEW: 'shift:view',
  SHIFT_MANAGE: 'shift:manage',
  SHIFT_START: 'shift:start',
  SHIFT_END: 'shift:end',

  // Return Permissions
  RETURN_VIEW: 'return:view',
  RETURN_CREATE: 'return:create',
  RETURN_EDIT: 'return:edit',
  RETURN_DELETE: 'return:delete',
  RETURN_MANAGE: 'return:manage',
  RETURN_APPROVE: 'return:approve',
  RETURN_REJECT: 'return:reject',
  RETURN_PROCESS: 'return:process',

  // Refund Permissions
  REFUND_VIEW: 'refund:view',
  REFUND_CREATE: 'refund:create',
  REFUND_EDIT: 'refund:edit',
  REFUND_DELETE: 'refund:delete',
  REFUND_MANAGE: 'refund:manage',
  REFUND_APPROVE: 'refund:approve',
  REFUND_REJECT: 'refund:reject',
  REFUND_COMPLETE: 'refund:complete',

  // Invoice Permissions
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

  // Receipt Permissions
  RECEIPT_VIEW: 'receipt:view',
  RECEIPT_CREATE: 'receipt:create',
  RECEIPT_EDIT: 'receipt:edit',
  RECEIPT_DELETE: 'receipt:delete',
  RECEIPT_MANAGE: 'receipt:manage',
  RECEIPT_PRINT: 'receipt:print',
  RECEIPT_EMAIL: 'receipt:email',
  RECEIPT_VOID: 'receipt:void',

  // Payment Permissions
  PAYMENT_VIEW: 'payment:view',
  PAYMENT_CREATE: 'payment:create',
  PAYMENT_MANAGE: 'payment:manage',
  PAYMENT_REFUND: 'payment:refund',

  // Dashboard Permissions
  DASHBOARD_VIEW: 'dashboard:view',
  DASHBOARD_MANAGE: 'dashboard:manage',

  // Integration Permissions
  INTEGRATION_VIEW: 'integration:view',
  INTEGRATION_MANAGE: 'integration:manage',
  API_VIEW: 'api:view',
  API_MANAGE: 'api:manage',
  WEBHOOK_VIEW: 'webhook:view',
  WEBHOOK_MANAGE: 'webhook:manage',
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// ============================================
// ROLE → PERMISSIONS MAP
// ============================================

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: [WILDCARD],
  ADMIN: [
    PERMISSIONS.USER_VIEW, PERMISSIONS.USER_CREATE, PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_DELETE, PERMISSIONS.USER_MANAGE, PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE, PERMISSIONS.USER_ROLE_UPDATE,
    PERMISSIONS.USER_PERMISSION_UPDATE, PERMISSIONS.USER_BULK_ACTIVATE,
    PERMISSIONS.USER_BULK_DEACTIVATE, PERMISSIONS.USER_BULK_DELETE,
    PERMISSIONS.USER_EXPORT,
    PERMISSIONS.CATEGORY_VIEW, PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT, PERMISSIONS.CATEGORY_DELETE,
    PERMISSIONS.CATEGORY_MANAGE,
    PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT, PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PRODUCT_MANAGE, PERMISSIONS.PRODUCT_EXPORT,
    PERMISSIONS.PRODUCT_IMPORT,
    PERMISSIONS.SUPPLIER_VIEW, PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT, PERMISSIONS.SUPPLIER_DELETE,
    PERMISSIONS.SUPPLIER_MANAGE,
    PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_DELETE, PERMISSIONS.ORDER_MANAGE,
    PERMISSIONS.ORDER_PROCESS, PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT, PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.CUSTOMER_MANAGE,
    PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.INVENTORY_MANAGE, PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT, PERMISSIONS.REPORT_MANAGE,
    PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.BUSINESS_UNIT_VIEW, PERMISSIONS.BUSINESS_UNIT_CREATE,
    PERMISSIONS.BUSINESS_UNIT_EDIT, PERMISSIONS.BUSINESS_UNIT_DELETE,
    PERMISSIONS.BUSINESS_UNIT_MANAGE,
    PERMISSIONS.SALE_VIEW, PERMISSIONS.SALE_CREATE, PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_DELETE, PERMISSIONS.SALE_MANAGE, PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.SALE_PRINT, PERMISSIONS.SALE_EMAIL,
    PERMISSIONS.POS_VIEW, PERMISSIONS.POS_CREATE, PERMISSIONS.POS_MANAGE,
    PERMISSIONS.POS_PRINT,
    PERMISSIONS.CASH_REGISTER_VIEW, PERMISSIONS.CASH_REGISTER_MANAGE,
    PERMISSIONS.CASH_REGISTER_OPEN, PERMISSIONS.CASH_REGISTER_CLOSE,
    PERMISSIONS.SHIFT_VIEW, PERMISSIONS.SHIFT_MANAGE,
    PERMISSIONS.SHIFT_START, PERMISSIONS.SHIFT_END,
    PERMISSIONS.RETURN_VIEW, PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT, PERMISSIONS.RETURN_DELETE,
    PERMISSIONS.RETURN_MANAGE, PERMISSIONS.RETURN_APPROVE,
    PERMISSIONS.RETURN_REJECT, PERMISSIONS.RETURN_PROCESS,
    PERMISSIONS.REFUND_VIEW, PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT, PERMISSIONS.REFUND_DELETE,
    PERMISSIONS.REFUND_MANAGE, PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_REJECT, PERMISSIONS.REFUND_COMPLETE,
    PERMISSIONS.INVOICE_VIEW, PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT, PERMISSIONS.INVOICE_DELETE,
    PERMISSIONS.INVOICE_MANAGE, PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT, PERMISSIONS.INVOICE_PAID,
    PERMISSIONS.INVOICE_VOID, PERMISSIONS.INVOICE_CANCEL,
    PERMISSIONS.RECEIPT_VIEW, PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT, PERMISSIONS.RECEIPT_DELETE,
    PERMISSIONS.RECEIPT_MANAGE, PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL, PERMISSIONS.RECEIPT_VOID,
    PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_MANAGE, PERMISSIONS.PAYMENT_REFUND,
    PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.DASHBOARD_MANAGE,
    PERMISSIONS.INTEGRATION_VIEW, PERMISSIONS.INTEGRATION_MANAGE,
    PERMISSIONS.API_VIEW, PERMISSIONS.API_MANAGE,
    PERMISSIONS.WEBHOOK_VIEW, PERMISSIONS.WEBHOOK_MANAGE,
  ],
  MANAGER: [
    PERMISSIONS.USER_VIEW, PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.CATEGORY_VIEW, PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT, PERMISSIONS.PRODUCT_EXPORT,
    PERMISSIONS.SUPPLIER_VIEW, PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_CREATE, PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_PROCESS, PERMISSIONS.ORDER_CANCEL,
    PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.BUSINESS_UNIT_VIEW,
    PERMISSIONS.SALE_VIEW, PERMISSIONS.SALE_CREATE, PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_EXPORT, PERMISSIONS.SALE_PRINT, PERMISSIONS.SALE_EMAIL,
    PERMISSIONS.POS_VIEW, PERMISSIONS.POS_CREATE, PERMISSIONS.POS_PRINT,
    PERMISSIONS.CASH_REGISTER_VIEW, PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    PERMISSIONS.SHIFT_VIEW, PERMISSIONS.SHIFT_START, PERMISSIONS.SHIFT_END,
    PERMISSIONS.RETURN_VIEW, PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT, PERMISSIONS.RETURN_APPROVE,
    PERMISSIONS.RETURN_REJECT, PERMISSIONS.RETURN_PROCESS,
    PERMISSIONS.REFUND_VIEW, PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT, PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_REJECT, PERMISSIONS.REFUND_COMPLETE,
    PERMISSIONS.INVOICE_VIEW, PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT, PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT, PERMISSIONS.INVOICE_PAID,
    PERMISSIONS.RECEIPT_VIEW, PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT, PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.DASHBOARD_MANAGE,
  ],
  EDITOR: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.CATEGORY_VIEW, PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    PERMISSIONS.PRODUCT_VIEW, PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.SUPPLIER_VIEW, PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.REPORT_VIEW, PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.SALE_VIEW, PERMISSIONS.SALE_CREATE, PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_PRINT, PERMISSIONS.SALE_EMAIL,
    PERMISSIONS.POS_VIEW, PERMISSIONS.POS_CREATE, PERMISSIONS.POS_PRINT,
    PERMISSIONS.CASH_REGISTER_VIEW, PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.SHIFT_VIEW, PERMISSIONS.SHIFT_START,
    PERMISSIONS.RETURN_VIEW, PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    PERMISSIONS.REFUND_VIEW, PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    PERMISSIONS.INVOICE_VIEW, PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT, PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    PERMISSIONS.RECEIPT_VIEW, PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT, PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  VIEWER: [
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  EMPLOYEE: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.SALE_VIEW, PERMISSIONS.SALE_CREATE,
    PERMISSIONS.POS_VIEW, PERMISSIONS.POS_CREATE,
    PERMISSIONS.RETURN_VIEW, PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.REFUND_VIEW, PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.RECEIPT_VIEW, PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  CASHIER: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.ORDER_VIEW, PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.CUSTOMER_VIEW, PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.SALE_VIEW, PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_PRINT, PERMISSIONS.SALE_EMAIL,
    PERMISSIONS.POS_VIEW, PERMISSIONS.POS_CREATE, PERMISSIONS.POS_PRINT,
    PERMISSIONS.CASH_REGISTER_VIEW, PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    PERMISSIONS.SHIFT_VIEW, PERMISSIONS.SHIFT_START, PERMISSIONS.SHIFT_END,
    PERMISSIONS.RETURN_VIEW, PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.REFUND_VIEW, PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.RECEIPT_VIEW, PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_PRINT, PERMISSIONS.RECEIPT_EMAIL,
    PERMISSIONS.PAYMENT_VIEW, PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  USER: [
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.SALE_VIEW, PERMISSIONS.SALE_CREATE,
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.DASHBOARD_VIEW,
  ],
};

// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId?: string;
  businessUnits: Array<{ businessUnitId: string; role: string }>;
  isActive: boolean;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
  clerkId?: string;
  phoneNumber?: string;
  avatar?: string;
  businessUnitId?: string | null;
}

export interface AuthContextType {
  user: User | null;
  userRole: string;
  clerkUser: any;
  loading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  getUsers: (params?: { page?: number; limit?: number; search?: string }) => Promise<{ users: User[]; total: number }>;
  deleteUser: (userId: string) => Promise<void>;
  hasPermission: (roles: string[]) => boolean;
  hasBusinessUnitAccess: (businessUnitId: string) => boolean;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isEditor: boolean;
  isViewer: boolean;
  isEmployee: boolean;
  isCashier: boolean;
  isUser: boolean;
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canManageUsers: boolean;
  canActivateUsers: boolean;
  canDeactivateUsers: boolean;
  canUpdateUserRole: boolean;
  canExportUsers: boolean;
  canViewCategories: boolean;
  canCreateCategories: boolean;
  canEditCategories: boolean;
  canDeleteCategories: boolean;
  canManageCategories: boolean;
  canViewProducts: boolean;
  canCreateProducts: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canManageProducts: boolean;
  canExportProducts: boolean;
  canImportProducts: boolean;
  canViewSuppliers: boolean;
  canCreateSuppliers: boolean;
  canEditSuppliers: boolean;
  canDeleteSuppliers: boolean;
  canManageSuppliers: boolean;
  canViewOrders: boolean;
  canCreateOrders: boolean;
  canEditOrders: boolean;
  canDeleteOrders: boolean;
  canManageOrders: boolean;
  canProcessOrders: boolean;
  canCancelOrders: boolean;
  canViewCustomers: boolean;
  canCreateCustomers: boolean;
  canEditCustomers: boolean;
  canDeleteCustomers: boolean;
  canManageCustomers: boolean;
  canViewInventory: boolean;
  canCreateInventory: boolean;
  canEditInventory: boolean;
  canDeleteInventory: boolean;
  canManageInventory: boolean;
  canAdjustInventory: boolean;
  canTransferInventory: boolean;
  canViewReports: boolean;
  canCreateReports: boolean;
  canExportReports: boolean;
  canManageReports: boolean;
  canViewAnalytics: boolean;
  canExportAnalytics: boolean;
  canViewSettings: boolean;
  canEditSettings: boolean;
  canManageSettings: boolean;
  canViewSystemLogs: boolean;
  canBackupSystem: boolean;
  canRestoreSystem: boolean;
  canViewSystemSettings: boolean;
  canViewBusinessUnits: boolean;
  canCreateBusinessUnits: boolean;
  canEditBusinessUnits: boolean;
  canDeleteBusinessUnits: boolean;
  canManageBusinessUnits: boolean;
  canViewSales: boolean;
  canCreateSales: boolean;
  canEditSales: boolean;
  canDeleteSales: boolean;
  canManageSales: boolean;
  canExportSales: boolean;
  canPrintSales: boolean;
  canEmailSales: boolean;
  canViewPos: boolean;
  canCreatePos: boolean;
  canManagePos: boolean;
  canPrintPos: boolean;
  canViewCashRegister: boolean;
  canManageCashRegister: boolean;
  canOpenCashRegister: boolean;
  canCloseCashRegister: boolean;
  canViewShifts: boolean;
  canManageShifts: boolean;
  canStartShift: boolean;
  canEndShift: boolean;
  canViewReturns: boolean;
  canCreateReturns: boolean;
  canEditReturns: boolean;
  canDeleteReturns: boolean;
  canManageReturns: boolean;
  canApproveReturns: boolean;
  canRejectReturns: boolean;
  canProcessReturns: boolean;
  canViewRefunds: boolean;
  canCreateRefunds: boolean;
  canEditRefunds: boolean;
  canDeleteRefunds: boolean;
  canManageRefunds: boolean;
  canApproveRefunds: boolean;
  canRejectRefunds: boolean;
  canCompleteRefunds: boolean;
  canViewInvoices: boolean;
  canCreateInvoices: boolean;
  canEditInvoices: boolean;
  canDeleteInvoices: boolean;
  canManageInvoices: boolean;
  canSendInvoices: boolean;
  canPrintInvoices: boolean;
  canMarkInvoicePaid: boolean;
  canVoidInvoices: boolean;
  canCancelInvoices: boolean;
  canViewReceipts: boolean;
  canCreateReceipts: boolean;
  canEditReceipts: boolean;
  canDeleteReceipts: boolean;
  canManageReceipts: boolean;
  canPrintReceipts: boolean;
  canEmailReceipts: boolean;
  canVoidReceipts: boolean;
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canManagePayments: boolean;
  canRefundPayments: boolean;
  canViewDashboard: boolean;
  canManageDashboard: boolean;
  canViewIntegrations: boolean;
  canManageIntegrations: boolean;
  canViewApi: boolean;
  canManageApi: boolean;
  canViewWebhooks: boolean;
  canManageWebhooks: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// BUSINESS UNIT HELPERS
// ============================================

function resolveBusinessUnitIdFromUser(
  user: Partial<User> | null | undefined,
  fallbackFromStorage?: string | null
): string | null {
  if (user?.businessUnitId && user.businessUnitId !== 'default') {
    return user.businessUnitId;
  }
  const fromArray = user?.businessUnits?.[0]?.businessUnitId;
  if (fromArray && fromArray !== 'default') {
    return fromArray;
  }
  if (fallbackFromStorage && fallbackFromStorage !== 'default') {
    return fallbackFromStorage;
  }
  return null;
}

function persistBusinessUnitId(user: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    const resolved = resolveBusinessUnitIdFromUser(
      user,
      localStorage.getItem('businessUnitId')
    );
    if (resolved) {
      localStorage.setItem('businessUnitId', resolved);
    }
  } catch (_e) {
    /* ignore */
  }
}

const mapAuthUser = (authUser: any, clerkRole?: string): User => {
  const role = (
    clerkRole ||
    authUser?.role ||
    'USER'
  ) as UserRole;

  return {
    id: authUser?.id || '',
    email: authUser?.email || '',
    firstName: authUser?.firstName || '',
    lastName: authUser?.lastName || '',
    role,
    companyId: authUser?.companyId,
    businessUnits: authUser?.businessUnits || [],
    isActive: authUser?.isActive !== undefined ? authUser.isActive : true,
    permissions: authUser?.permissions || [],
    createdAt: authUser?.createdAt,
    updatedAt: authUser?.updatedAt,
    clerkId: authUser?.clerkId,
    phoneNumber: authUser?.phoneNumber,
    avatar: authUser?.avatar,
    businessUnitId: authUser?.businessUnitId ?? null,
  };
};

function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('user');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as User;
  } catch {
    return null;
  }
}

// ============================================
// PROVIDER
// ============================================

export function AuthProvider({ children }: AuthProviderProps) {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable primitives from clerkUser
  const clerkUserId = clerkUser?.id ?? null;
  const clerkPublicRole =
    (clerkUser?.publicMetadata?.role as string) || null;
  const clerkUnsafeRole =
    (clerkUser?.unsafeMetadata?.role as string) || null;
  const clerkPrimaryEmail =
    clerkUser?.emailAddresses?.[0]?.emailAddress || '';
  const clerkFirstName = clerkUser?.firstName || '';
  const clerkLastName = clerkUser?.lastName || '';
  const clerkPhoneNumber =
    clerkUser?.phoneNumbers?.[0]?.phoneNumber || '';
  const clerkAvatar = clerkUser?.imageUrl || '';

  // ============================================
  // CLERK SYNC — the missing piece
  // ============================================
  //
  // This effect is what was missing from the original file. Without
  // it, the frontend never tells the backend to provision a `users`
  // row for the currently-authenticated Clerk user. The result was
  // that every FK lookup for `userId` failed with USER_NOT_SYNCED.
  //
  // We fire this exactly once per Clerk user session (deduped via
  // `syncAttemptedForRef`) so we don't hammer the endpoint on every
  // render.
  //
  // The backend reads the identity from the verified Clerk JWT.
  // The body fields below are belt-and-suspenders fallbacks for
  // cases where the session template omits a claim.
  const syncAttemptedForRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait until Clerk has resolved the session.
    if (!clerkLoaded) return;
    if (!isSignedIn || !clerkUserId) return;

    // Dedupe: only attempt once per Clerk user ID.
    if (syncAttemptedForRef.current === clerkUserId) return;
    syncAttemptedForRef.current = clerkUserId;

    let cancelled = false;

    (async () => {
      try {
        console.log('🔄 [useAuth] Syncing Clerk user with backend...');
        const syncedUser = await authService.syncClerkUser({
          clerkId: clerkUserId,
          email: clerkPrimaryEmail || undefined,
          firstName: clerkFirstName || undefined,
          lastName: clerkLastName || undefined,
          avatar: clerkAvatar || undefined,
        });

        if (cancelled) return;

        console.log('✅ [useAuth] Clerk user synced with DB:', {
          id: syncedUser.id,
          clerkId: syncedUser.clerkId,
          role: syncedUser.role,
        });
      } catch (syncErr) {
        if (cancelled) return;

        // Reset the dedupe ref so a future session can retry.
        syncAttemptedForRef.current = null;

        console.error('❌ [useAuth] Clerk user sync failed:', syncErr);
        // Non-fatal — do not crash the app. The next successful
        // sync will fix the DB row.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkLoaded, isSignedIn, clerkUserId]);

  const userRole = useMemo(() => {
    if (clerkPublicRole) return clerkPublicRole;
    if (clerkUnsafeRole) return clerkUnsafeRole;
    if (user?.role) return user.role;

    const cached = readCachedUser();
    if (cached?.role) return cached.role;

    return 'USER';
  }, [clerkPublicRole, clerkUnsafeRole, user?.role]);

  const isSuper = useMemo(() => {
    if (isSuperAdminRole(userRole)) return true;
    if (isSuperAdminRole(user?.role)) return true;

    const perms = user?.permissions;
    if (Array.isArray(perms) && perms.includes(WILDCARD)) return true;

    const cached = readCachedUser();
    if (cached && isSuperAdminRole(cached.role)) return true;

    return false;
  }, [userRole, user?.role, user?.permissions]);

  const hasPermission = useCallback(
    (roles: string[]): boolean => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const can = useCallback(
    (permission: string): boolean => {
      if (isSuper) return true;
      if (!user) return false;

      if (user.permissions && user.permissions.length > 0) {
        if (user.permissions.includes(WILDCARD)) return true;
        return user.permissions.includes(permission);
      }

      const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
      if (rolePermissions.includes(WILDCARD)) return true;
      return rolePermissions.includes(permission);
    },
    [user, isSuper]
  );

  const canAny = useCallback(
    (permissions: string[]): boolean => {
      if (isSuper) return true;
      if (!user) return false;
      return permissions.some((p) => can(p));
    },
    [user, isSuper, can]
  );

  const canAll = useCallback(
    (permissions: string[]): boolean => {
      if (isSuper) return true;
      if (!user) return false;
      return permissions.every((p) => can(p));
    },
    [user, isSuper, can]
  );

  const hasBusinessUnitAccess = useCallback(
    (businessUnitId: string): boolean => {
      if (isSuper) return true;
      if (!user) return false;
      if (user.role === 'ADMIN') return true;
      return (
        user.businessUnits?.some(
          (bu) => bu.businessUnitId === businessUnitId
        ) ?? false
      );
    },
    [user, isSuper]
  );

  const isSuperAdmin = isSuper;
  const isAdmin = isSuper || user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isEditor = user?.role === 'EDITOR';
  const isViewer = user?.role === 'VIEWER';
  const isEmployee = user?.role === 'EMPLOYEE';
  const isCashier = user?.role === 'CASHIER';
  const isUser = user?.role === 'USER';

  const permissionChecks = useMemo(
    () => ({
      canViewUsers: can(PERMISSIONS.USER_VIEW),
      canCreateUsers: can(PERMISSIONS.USER_CREATE),
      canEditUsers: can(PERMISSIONS.USER_EDIT),
      canDeleteUsers: can(PERMISSIONS.USER_DELETE),
      canManageUsers: can(PERMISSIONS.USER_MANAGE),
      canActivateUsers: can(PERMISSIONS.USER_ACTIVATE),
      canDeactivateUsers: can(PERMISSIONS.USER_DEACTIVATE),
      canUpdateUserRole: can(PERMISSIONS.USER_ROLE_UPDATE),
      canExportUsers: can(PERMISSIONS.USER_EXPORT),
      canViewCategories: can(PERMISSIONS.CATEGORY_VIEW),
      canCreateCategories: can(PERMISSIONS.CATEGORY_CREATE),
      canEditCategories: can(PERMISSIONS.CATEGORY_EDIT),
      canDeleteCategories: can(PERMISSIONS.CATEGORY_DELETE),
      canManageCategories: can(PERMISSIONS.CATEGORY_MANAGE),
      canViewProducts: can(PERMISSIONS.PRODUCT_VIEW),
      canCreateProducts: can(PERMISSIONS.PRODUCT_CREATE),
      canEditProducts: can(PERMISSIONS.PRODUCT_EDIT),
      canDeleteProducts: can(PERMISSIONS.PRODUCT_DELETE),
      canManageProducts: can(PERMISSIONS.PRODUCT_MANAGE),
      canExportProducts: can(PERMISSIONS.PRODUCT_EXPORT),
      canImportProducts: can(PERMISSIONS.PRODUCT_IMPORT),
      canViewSuppliers: can(PERMISSIONS.SUPPLIER_VIEW),
      canCreateSuppliers: can(PERMISSIONS.SUPPLIER_CREATE),
      canEditSuppliers: can(PERMISSIONS.SUPPLIER_EDIT),
      canDeleteSuppliers: can(PERMISSIONS.SUPPLIER_DELETE),
      canManageSuppliers: can(PERMISSIONS.SUPPLIER_MANAGE),
      canViewOrders: can(PERMISSIONS.ORDER_VIEW),
      canCreateOrders: can(PERMISSIONS.ORDER_CREATE),
      canEditOrders: can(PERMISSIONS.ORDER_EDIT),
      canDeleteOrders: can(PERMISSIONS.ORDER_DELETE),
      canManageOrders: can(PERMISSIONS.ORDER_MANAGE),
      canProcessOrders: can(PERMISSIONS.ORDER_PROCESS),
      canCancelOrders: can(PERMISSIONS.ORDER_CANCEL),
      canViewCustomers: can(PERMISSIONS.CUSTOMER_VIEW),
      canCreateCustomers: can(PERMISSIONS.CUSTOMER_CREATE),
      canEditCustomers: can(PERMISSIONS.CUSTOMER_EDIT),
      canDeleteCustomers: can(PERMISSIONS.CUSTOMER_DELETE),
      canManageCustomers: can(PERMISSIONS.CUSTOMER_MANAGE),
      canViewInventory: can(PERMISSIONS.INVENTORY_VIEW),
      canCreateInventory: can(PERMISSIONS.INVENTORY_CREATE),
      canEditInventory: can(PERMISSIONS.INVENTORY_EDIT),
      canDeleteInventory: can(PERMISSIONS.INVENTORY_DELETE),
      canManageInventory: can(PERMISSIONS.INVENTORY_MANAGE),
      canAdjustInventory: can(PERMISSIONS.INVENTORY_ADJUST),
      canTransferInventory: can(PERMISSIONS.INVENTORY_TRANSFER),
      canViewReports: can(PERMISSIONS.REPORT_VIEW),
      canCreateReports: can(PERMISSIONS.REPORT_CREATE),
      canExportReports: can(PERMISSIONS.REPORT_EXPORT),
      canManageReports: can(PERMISSIONS.REPORT_MANAGE),
      canViewAnalytics: can(PERMISSIONS.ANALYTICS_VIEW),
      canExportAnalytics: can(PERMISSIONS.ANALYTICS_EXPORT),
      canViewSettings: can(PERMISSIONS.SETTINGS_VIEW),
      canEditSettings: can(PERMISSIONS.SETTINGS_EDIT),
      canManageSettings: can(PERMISSIONS.SETTINGS_MANAGE),
      canViewSystemLogs: can(PERMISSIONS.SYSTEM_LOGS),
      canBackupSystem: can(PERMISSIONS.SYSTEM_BACKUP),
      canRestoreSystem: can(PERMISSIONS.SYSTEM_RESTORE),
      canViewSystemSettings: can(PERMISSIONS.SYSTEM_SETTINGS),
      canViewBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_VIEW),
      canCreateBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_CREATE),
      canEditBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_EDIT),
      canDeleteBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_DELETE),
      canManageBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_MANAGE),
      canViewSales: can(PERMISSIONS.SALE_VIEW),
      canCreateSales: can(PERMISSIONS.SALE_CREATE),
      canEditSales: can(PERMISSIONS.SALE_EDIT),
      canDeleteSales: can(PERMISSIONS.SALE_DELETE),
      canManageSales: can(PERMISSIONS.SALE_MANAGE),
      canExportSales: can(PERMISSIONS.SALE_EXPORT),
      canPrintSales: can(PERMISSIONS.SALE_PRINT),
      canEmailSales: can(PERMISSIONS.SALE_EMAIL),
      canViewPos: can(PERMISSIONS.POS_VIEW),
      canCreatePos: can(PERMISSIONS.POS_CREATE),
      canManagePos: can(PERMISSIONS.POS_MANAGE),
      canPrintPos: can(PERMISSIONS.POS_PRINT),
      canViewCashRegister: can(PERMISSIONS.CASH_REGISTER_VIEW),
      canManageCashRegister: can(PERMISSIONS.CASH_REGISTER_MANAGE),
      canOpenCashRegister: can(PERMISSIONS.CASH_REGISTER_OPEN),
      canCloseCashRegister: can(PERMISSIONS.CASH_REGISTER_CLOSE),
      canViewShifts: can(PERMISSIONS.SHIFT_VIEW),
      canManageShifts: can(PERMISSIONS.SHIFT_MANAGE),
      canStartShift: can(PERMISSIONS.SHIFT_START),
      canEndShift: can(PERMISSIONS.SHIFT_END),
      canViewReturns: can(PERMISSIONS.RETURN_VIEW),
      canCreateReturns: can(PERMISSIONS.RETURN_CREATE),
      canEditReturns: can(PERMISSIONS.RETURN_EDIT),
      canDeleteReturns: can(PERMISSIONS.RETURN_DELETE),
      canManageReturns: can(PERMISSIONS.RETURN_MANAGE),
      canApproveReturns: can(PERMISSIONS.RETURN_APPROVE),
      canRejectReturns: can(PERMISSIONS.RETURN_REJECT),
      canProcessReturns: can(PERMISSIONS.RETURN_PROCESS),
      canViewRefunds: can(PERMISSIONS.REFUND_VIEW),
      canCreateRefunds: can(PERMISSIONS.REFUND_CREATE),
      canEditRefunds: can(PERMISSIONS.REFUND_EDIT),
      canDeleteRefunds: can(PERMISSIONS.REFUND_DELETE),
      canManageRefunds: can(PERMISSIONS.REFUND_MANAGE),
      canApproveRefunds: can(PERMISSIONS.REFUND_APPROVE),
      canRejectRefunds: can(PERMISSIONS.REFUND_REJECT),
      canCompleteRefunds: can(PERMISSIONS.REFUND_COMPLETE),
      canViewInvoices: can(PERMISSIONS.INVOICE_VIEW),
      canCreateInvoices: can(PERMISSIONS.INVOICE_CREATE),
      canEditInvoices: can(PERMISSIONS.INVOICE_EDIT),
      canDeleteInvoices: can(PERMISSIONS.INVOICE_DELETE),
      canManageInvoices: can(PERMISSIONS.INVOICE_MANAGE),
      canSendInvoices: can(PERMISSIONS.INVOICE_SEND),
      canPrintInvoices: can(PERMISSIONS.INVOICE_PRINT),
      canMarkInvoicePaid: can(PERMISSIONS.INVOICE_PAID),
      canVoidInvoices: can(PERMISSIONS.INVOICE_VOID),
      canCancelInvoices: can(PERMISSIONS.INVOICE_CANCEL),
      canViewReceipts: can(PERMISSIONS.RECEIPT_VIEW),
      canCreateReceipts: can(PERMISSIONS.RECEIPT_CREATE),
      canEditReceipts: can(PERMISSIONS.RECEIPT_EDIT),
      canDeleteReceipts: can(PERMISSIONS.RECEIPT_DELETE),
      canManageReceipts: can(PERMISSIONS.RECEIPT_MANAGE),
      canPrintReceipts: can(PERMISSIONS.RECEIPT_PRINT),
      canEmailReceipts: can(PERMISSIONS.RECEIPT_EMAIL),
      canVoidReceipts: can(PERMISSIONS.RECEIPT_VOID),
      canViewPayments: can(PERMISSIONS.PAYMENT_VIEW),
      canCreatePayments: can(PERMISSIONS.PAYMENT_CREATE),
      canManagePayments: can(PERMISSIONS.PAYMENT_MANAGE),
      canRefundPayments: can(PERMISSIONS.PAYMENT_REFUND),
      canViewDashboard: can(PERMISSIONS.DASHBOARD_VIEW),
      canManageDashboard: can(PERMISSIONS.DASHBOARD_MANAGE),
      canViewIntegrations: can(PERMISSIONS.INTEGRATION_VIEW),
      canManageIntegrations: can(PERMISSIONS.INTEGRATION_MANAGE),
      canViewApi: can(PERMISSIONS.API_VIEW),
      canManageApi: can(PERMISSIONS.API_MANAGE),
      canViewWebhooks: can(PERMISSIONS.WEBHOOK_VIEW),
      canManageWebhooks: can(PERMISSIONS.WEBHOOK_MANAGE),
    }),
    [can]
  );

  // ============================================
  // AUTH ACTIONS
  // ============================================

  const updateUserRole = useCallback(async (userId: string, role: UserRole) => {
    try {
      const updatedUser = await authService.updateUserRole(userId, role);
      const mappedUser = mapAuthUser(updatedUser);
      setUser(mappedUser);
      localStorage.setItem('user', JSON.stringify(mappedUser));
      persistBusinessUnitId(mappedUser);
    } catch (err) {
      console.error('Failed to update user role:', err);
      throw err;
    }
  }, []);

  const updateUser = useCallback(async (userId: string, data: Partial<User>) => {
    try {
      const updatedUser = await authService.updateUser(userId, data);
      const mappedUser = mapAuthUser(updatedUser);
      setUser(mappedUser);
      localStorage.setItem('user', JSON.stringify(mappedUser));
      persistBusinessUnitId(mappedUser);
    } catch (err) {
      console.error('Failed to update user:', err);
      throw err;
    }
  }, []);

  const getUsers = useCallback(
    async (params?: { page?: number; limit?: number; search?: string }) => {
      try {
        const response = await authService.getUsers(params);
        return {
          users: response.users.map((u) => mapAuthUser(u)),
          total: response.total,
        };
      } catch (err) {
        console.error('Failed to get users:', err);
        throw err;
      }
    },
    []
  );

  const deleteUser = useCallback(async (userId: string) => {
    try {
      await authService.deleteUser(userId);
    } catch (err) {
      console.error('Failed to delete user:', err);
      throw err;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const cachedUser = readCachedUser();

      const storedBusinessUnitId =
        typeof window !== 'undefined'
          ? localStorage.getItem('businessUnitId')
          : null;

      if (clerkLoaded && isSignedIn && clerkUserId) {
        const clerkRole = clerkPublicRole || clerkUnsafeRole || 'USER';

        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('Clerk role:', clerkRole);
        }

        const token =
          typeof window !== 'undefined'
            ? localStorage.getItem('auth_token')
            : null;

        if (token) {
          try {
            const userData = await authService.getCurrentUser();
            if (userData) {
              const mappedUser = mapAuthUser(userData, clerkRole);

              if (!mappedUser.businessUnitId && storedBusinessUnitId) {
                mappedUser.businessUnitId = storedBusinessUnitId;
              }

              if (
                (!mappedUser.businessUnits ||
                  mappedUser.businessUnits.length === 0) &&
                cachedUser?.businessUnits?.length
              ) {
                mappedUser.businessUnits = cachedUser.businessUnits;
              }

              setUser(mappedUser);
              setIsAuthenticated(true);
              localStorage.setItem('user', JSON.stringify(mappedUser));
              persistBusinessUnitId(mappedUser);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error('Failed to get user from backend:', err);
          }
        }

        if (cachedUser && cachedUser.id === clerkUserId) {
          if (
            isSuperAdminRole(clerkRole) &&
            !isSuperAdminRole(cachedUser.role)
          ) {
            cachedUser.role = 'SUPER_ADMIN';
          }
          if (!cachedUser.businessUnitId && storedBusinessUnitId) {
            cachedUser.businessUnitId = storedBusinessUnitId;
          }
          setUser(cachedUser);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(cachedUser));
          persistBusinessUnitId(cachedUser);
          setLoading(false);
          return;
        }

        if (isSuperAdminRole(clerkRole)) {
          const adminUser: User = {
            id: clerkUserId,
            email: clerkPrimaryEmail,
            firstName: clerkFirstName,
            lastName: clerkLastName,
            role: 'SUPER_ADMIN',
            businessUnits: cachedUser?.businessUnits ?? [],
            isActive: true,
            permissions: cachedUser?.permissions ?? [],
            businessUnitId:
              cachedUser?.businessUnitId ?? storedBusinessUnitId ?? null,
          };
          setUser(adminUser);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(adminUser));
          persistBusinessUnitId(adminUser);
          setLoading(false);
          return;
        }

        try {
          const randomPassword =
            Math.random().toString(36).slice(-8) + 'Aa1!';
          const userData = await authService.register({
            email: clerkPrimaryEmail,
            firstName: clerkFirstName,
            lastName: clerkLastName,
            phoneNumber: clerkPhoneNumber,
            password: randomPassword,
            role: clerkRole,
          });
          const mappedUser = mapAuthUser(userData, clerkRole);
          setUser(mappedUser);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(mappedUser));
          persistBusinessUnitId(mappedUser);
        } catch (err) {
          console.error('Failed to create user in backend:', err);
          const fallbackUser: User = {
            id: clerkUserId,
            email: clerkPrimaryEmail,
            firstName: clerkFirstName,
            lastName: clerkLastName,
            role: clerkRole as UserRole,
            businessUnits: cachedUser?.businessUnits ?? [],
            isActive: true,
            permissions: cachedUser?.permissions ?? [],
            businessUnitId:
              cachedUser?.businessUnitId ?? storedBusinessUnitId ?? null,
          };
          setUser(fallbackUser);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
          persistBusinessUnitId(fallbackUser);
        }
      } else if (clerkLoaded) {
        setUser(null);
        setIsAuthenticated(false);
      } else {
        // Clerk hasn't finished loading — do nothing.
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setError('Authentication failed');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [
    clerkLoaded,
    isSignedIn,
    clerkUserId,
    clerkPublicRole,
    clerkUnsafeRole,
    clerkPrimaryEmail,
    clerkFirstName,
    clerkLastName,
    clerkPhoneNumber,
  ]);

  const refreshUser = useCallback(async () => {
    try {
      const clerkRole = clerkPublicRole || clerkUnsafeRole || undefined;

      const userData = await authService.getCurrentUser();
      if (userData) {
        const mappedUser = mapAuthUser(userData, clerkRole);
        if (!mappedUser.businessUnitId) {
          const stored =
            typeof window !== 'undefined'
              ? localStorage.getItem('businessUnitId')
              : null;
          if (stored) mappedUser.businessUnitId = stored;
        }
        setUser(mappedUser);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(mappedUser));
        persistBusinessUnitId(mappedUser);
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  }, [clerkPublicRole, clerkUnsafeRole]);

  const login = useCallback(
    async (email: string, password: string, remember?: boolean) => {
      try {
        setLoading(true);
        setError(null);
        const response = await authService.login({
          email,
          password,
          remember,
        });
        localStorage.setItem('auth_token', response.token);
        const mappedUser = mapAuthUser(response.user);
        setUser(mappedUser);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(mappedUser));
        persistBusinessUnitId(mappedUser);
      } catch (err) {
        setError('Login failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      localStorage.removeItem('businessUnitId');
      setUser(null);
      setIsAuthenticated(false);
      // Reset sync dedupe so the next login re-syncs.
      syncAttemptedForRef.current = null;
      try {
        await signOut();
      } catch (err) {
        console.error('Clerk sign out error:', err);
      }
    }
  }, [signOut]);

  const register = useCallback(async (data: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.register(data);
      localStorage.setItem('auth_token', response.token);
      const mappedUser = mapAuthUser(response.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(mappedUser));
      persistBusinessUnitId(mappedUser);
    } catch (err) {
      setError('Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verify2FA = useCallback(async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.verify2FA(code);
      localStorage.setItem('auth_token', response.token);
      const mappedUser = mapAuthUser(response.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(mappedUser));
      persistBusinessUnitId(mappedUser);
    } catch (err) {
      setError('2FA verification failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const lastClerkFingerprintRef = useRef<string>('');

  useEffect(() => {
    const fingerprint = `${clerkLoaded}|${isSignedIn}|${clerkUserId}`;
    if (lastClerkFingerprintRef.current === fingerprint) return;
    lastClerkFingerprintRef.current = fingerprint;

    if (!clerkLoaded) return;

    checkAuth();
  }, [clerkLoaded, isSignedIn, clerkUserId, checkAuth]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        if (e.newValue) {
          refreshUser();
        } else {
          setUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('user');
          localStorage.removeItem('businessUnitId');
        }
      }
    };

    if (typeof window === 'undefined') return;
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshUser]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      userRole,
      clerkUser,
      loading,
      isLoaded: clerkLoaded,
      isSignedIn: isSignedIn || false,
      isLoading: loading || !clerkLoaded,
      isAuthenticated,
      error,
      setUser,
      login,
      logout,
      register,
      verify2FA,
      refreshUser,
      updateUserRole,
      updateUser,
      getUsers,
      deleteUser,
      hasPermission,
      hasBusinessUnitAccess,
      can,
      canAny,
      canAll,
      isSuperAdmin,
      isAdmin,
      isManager,
      isEditor,
      isViewer,
      isEmployee,
      isCashier,
      isUser,
      ...permissionChecks,
    }),
    [
      user,
      userRole,
      clerkUser,
      loading,
      clerkLoaded,
      isSignedIn,
      isAuthenticated,
      error,
      login,
      logout,
      register,
      verify2FA,
      refreshUser,
      updateUserRole,
      updateUser,
      getUsers,
      deleteUser,
      hasPermission,
      hasBusinessUnitAccess,
      can,
      canAny,
      canAll,
      isSuperAdmin,
      isAdmin,
      isManager,
      isEditor,
      isViewer,
      isEmployee,
      isCashier,
      isUser,
      permissionChecks,
    ]
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
