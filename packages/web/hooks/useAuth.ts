// D:\Projects\Kalwanga\packages\web\hooks\useAuth.ts
'use client';

import React, { useState, useEffect, useContext, createContext, ReactNode, useCallback, useMemo } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { authService, User as AuthUser } from '../services/authService';

// Permission types
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EDITOR' | 'VIEWER' | 'EMPLOYEE' | 'CASHIER' | 'USER';

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
  
  // User Permissions (Full set)
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

// Role to permissions mapping (Full set)
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    // User Management
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.USER_ROLE_UPDATE,
    PERMISSIONS.USER_PERMISSION_UPDATE,
    PERMISSIONS.USER_BULK_ACTIVATE,
    PERMISSIONS.USER_BULK_DEACTIVATE,
    PERMISSIONS.USER_BULK_DELETE,
    PERMISSIONS.USER_EXPORT,
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    PERMISSIONS.CATEGORY_DELETE,
    PERMISSIONS.CATEGORY_MANAGE,
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PRODUCT_MANAGE,
    PERMISSIONS.PRODUCT_EXPORT,
    PERMISSIONS.PRODUCT_IMPORT,
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    PERMISSIONS.SUPPLIER_DELETE,
    PERMISSIONS.SUPPLIER_MANAGE,
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_DELETE,
    PERMISSIONS.ORDER_MANAGE,
    PERMISSIONS.ORDER_PROCESS,
    PERMISSIONS.ORDER_CANCEL,
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.CUSTOMER_MANAGE,
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    // Report
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.REPORT_MANAGE,
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.SETTINGS_MANAGE,
    // System
    PERMISSIONS.SYSTEM_LOGS,
    PERMISSIONS.SYSTEM_BACKUP,
    PERMISSIONS.SYSTEM_RESTORE,
    PERMISSIONS.SYSTEM_SETTINGS,
    // Business Unit
    PERMISSIONS.BUSINESS_UNIT_VIEW,
    PERMISSIONS.BUSINESS_UNIT_CREATE,
    PERMISSIONS.BUSINESS_UNIT_EDIT,
    PERMISSIONS.BUSINESS_UNIT_DELETE,
    PERMISSIONS.BUSINESS_UNIT_MANAGE,
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_DELETE,
    PERMISSIONS.SALE_MANAGE,
    PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_MANAGE,
    PERMISSIONS.POS_PRINT,
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_MANAGE,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_MANAGE,
    PERMISSIONS.SHIFT_START,
    PERMISSIONS.SHIFT_END,
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    PERMISSIONS.RETURN_DELETE,
    PERMISSIONS.RETURN_MANAGE,
    PERMISSIONS.RETURN_APPROVE,
    PERMISSIONS.RETURN_REJECT,
    PERMISSIONS.RETURN_PROCESS,
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    PERMISSIONS.REFUND_DELETE,
    PERMISSIONS.REFUND_MANAGE,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_REJECT,
    PERMISSIONS.REFUND_COMPLETE,
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_DELETE,
    PERMISSIONS.INVOICE_MANAGE,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    PERMISSIONS.INVOICE_PAID,
    PERMISSIONS.INVOICE_VOID,
    PERMISSIONS.INVOICE_CANCEL,
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT,
    PERMISSIONS.RECEIPT_DELETE,
    PERMISSIONS.RECEIPT_MANAGE,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    PERMISSIONS.RECEIPT_VOID,
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_MANAGE,
    PERMISSIONS.PAYMENT_REFUND,
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_MANAGE,
    // Integration
    PERMISSIONS.INTEGRATION_VIEW,
    PERMISSIONS.INTEGRATION_MANAGE,
    PERMISSIONS.API_VIEW,
    PERMISSIONS.API_MANAGE,
    PERMISSIONS.WEBHOOK_VIEW,
    PERMISSIONS.WEBHOOK_MANAGE,
  ],
  ADMIN: [
    // User Management
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_EDIT,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    PERMISSIONS.USER_ROLE_UPDATE,
    PERMISSIONS.USER_PERMISSION_UPDATE,
    PERMISSIONS.USER_BULK_ACTIVATE,
    PERMISSIONS.USER_BULK_DEACTIVATE,
    PERMISSIONS.USER_BULK_DELETE,
    PERMISSIONS.USER_EXPORT,
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    PERMISSIONS.CATEGORY_DELETE,
    PERMISSIONS.CATEGORY_MANAGE,
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_DELETE,
    PERMISSIONS.PRODUCT_MANAGE,
    PERMISSIONS.PRODUCT_EXPORT,
    PERMISSIONS.PRODUCT_IMPORT,
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    PERMISSIONS.SUPPLIER_DELETE,
    PERMISSIONS.SUPPLIER_MANAGE,
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_DELETE,
    PERMISSIONS.ORDER_MANAGE,
    PERMISSIONS.ORDER_PROCESS,
    PERMISSIONS.ORDER_CANCEL,
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    PERMISSIONS.CUSTOMER_DELETE,
    PERMISSIONS.CUSTOMER_MANAGE,
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.INVENTORY_MANAGE,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    // Report
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.REPORT_MANAGE,
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_EDIT,
    PERMISSIONS.SETTINGS_MANAGE,
    // Business Unit
    PERMISSIONS.BUSINESS_UNIT_VIEW,
    PERMISSIONS.BUSINESS_UNIT_CREATE,
    PERMISSIONS.BUSINESS_UNIT_EDIT,
    PERMISSIONS.BUSINESS_UNIT_DELETE,
    PERMISSIONS.BUSINESS_UNIT_MANAGE,
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_DELETE,
    PERMISSIONS.SALE_MANAGE,
    PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_MANAGE,
    PERMISSIONS.POS_PRINT,
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_MANAGE,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_MANAGE,
    PERMISSIONS.SHIFT_START,
    PERMISSIONS.SHIFT_END,
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    PERMISSIONS.RETURN_DELETE,
    PERMISSIONS.RETURN_MANAGE,
    PERMISSIONS.RETURN_APPROVE,
    PERMISSIONS.RETURN_REJECT,
    PERMISSIONS.RETURN_PROCESS,
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    PERMISSIONS.REFUND_DELETE,
    PERMISSIONS.REFUND_MANAGE,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_REJECT,
    PERMISSIONS.REFUND_COMPLETE,
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_DELETE,
    PERMISSIONS.INVOICE_MANAGE,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    PERMISSIONS.INVOICE_PAID,
    PERMISSIONS.INVOICE_VOID,
    PERMISSIONS.INVOICE_CANCEL,
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT,
    PERMISSIONS.RECEIPT_DELETE,
    PERMISSIONS.RECEIPT_MANAGE,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    PERMISSIONS.RECEIPT_VOID,
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_MANAGE,
    PERMISSIONS.PAYMENT_REFUND,
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_MANAGE,
    // Integration
    PERMISSIONS.INTEGRATION_VIEW,
    PERMISSIONS.INTEGRATION_MANAGE,
    PERMISSIONS.API_VIEW,
    PERMISSIONS.API_MANAGE,
    PERMISSIONS.WEBHOOK_VIEW,
    PERMISSIONS.WEBHOOK_MANAGE,
  ],
  MANAGER: [
    // User Management
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    PERMISSIONS.PRODUCT_EXPORT,
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    PERMISSIONS.ORDER_EDIT,
    PERMISSIONS.ORDER_PROCESS,
    PERMISSIONS.ORDER_CANCEL,
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_TRANSFER,
    // Report
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_EXPORT,
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    // Settings
    PERMISSIONS.SETTINGS_VIEW,
    // Business Unit
    PERMISSIONS.BUSINESS_UNIT_VIEW,
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_EXPORT,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_PRINT,
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_START,
    PERMISSIONS.SHIFT_END,
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    PERMISSIONS.RETURN_APPROVE,
    PERMISSIONS.RETURN_REJECT,
    PERMISSIONS.RETURN_PROCESS,
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    PERMISSIONS.REFUND_APPROVE,
    PERMISSIONS.REFUND_REJECT,
    PERMISSIONS.REFUND_COMPLETE,
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    PERMISSIONS.INVOICE_PAID,
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.DASHBOARD_MANAGE,
  ],
  EDITOR: [
    // User Management
    PERMISSIONS.USER_VIEW,
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_EDIT,
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.PRODUCT_CREATE,
    PERMISSIONS.PRODUCT_EDIT,
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    PERMISSIONS.SUPPLIER_CREATE,
    PERMISSIONS.SUPPLIER_EDIT,
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_EDIT,
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_EDIT,
    // Report
    PERMISSIONS.REPORT_VIEW,
    PERMISSIONS.REPORT_CREATE,
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_EDIT,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_PRINT,
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_OPEN,
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_START,
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    PERMISSIONS.RETURN_EDIT,
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    PERMISSIONS.REFUND_EDIT,
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_EDIT,
    PERMISSIONS.INVOICE_SEND,
    PERMISSIONS.INVOICE_PRINT,
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_EDIT,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  VIEWER: [
    // User Management
    PERMISSIONS.USER_VIEW,
    // Category
    PERMISSIONS.CATEGORY_VIEW,
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    // Supplier
    PERMISSIONS.SUPPLIER_VIEW,
    // Order
    PERMISSIONS.ORDER_VIEW,
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    // Report
    PERMISSIONS.REPORT_VIEW,
    // Analytics
    PERMISSIONS.ANALYTICS_VIEW,
    // Sales
    PERMISSIONS.SALE_VIEW,
    // POS
    PERMISSIONS.POS_VIEW,
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    // Return
    PERMISSIONS.RETURN_VIEW,
    // Refund
    PERMISSIONS.REFUND_VIEW,
    // Invoice
    PERMISSIONS.INVOICE_VIEW,
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  EMPLOYEE: [
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_PRINT,
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  CASHIER: [
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    // Order
    PERMISSIONS.ORDER_VIEW,
    PERMISSIONS.ORDER_CREATE,
    // Customer
    PERMISSIONS.CUSTOMER_VIEW,
    PERMISSIONS.CUSTOMER_CREATE,
    // Inventory
    PERMISSIONS.INVENTORY_VIEW,
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    PERMISSIONS.SALE_PRINT,
    PERMISSIONS.SALE_EMAIL,
    // POS
    PERMISSIONS.POS_VIEW,
    PERMISSIONS.POS_CREATE,
    PERMISSIONS.POS_PRINT,
    // Cash Register
    PERMISSIONS.CASH_REGISTER_VIEW,
    PERMISSIONS.CASH_REGISTER_OPEN,
    PERMISSIONS.CASH_REGISTER_CLOSE,
    // Shift
    PERMISSIONS.SHIFT_VIEW,
    PERMISSIONS.SHIFT_START,
    PERMISSIONS.SHIFT_END,
    // Return
    PERMISSIONS.RETURN_VIEW,
    PERMISSIONS.RETURN_CREATE,
    // Refund
    PERMISSIONS.REFUND_VIEW,
    PERMISSIONS.REFUND_CREATE,
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    PERMISSIONS.RECEIPT_CREATE,
    PERMISSIONS.RECEIPT_PRINT,
    PERMISSIONS.RECEIPT_EMAIL,
    // Payment
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
  USER: [
    // Product
    PERMISSIONS.PRODUCT_VIEW,
    // Order
    PERMISSIONS.ORDER_VIEW,
    // Sales
    PERMISSIONS.SALE_VIEW,
    PERMISSIONS.SALE_CREATE,
    // Receipt
    PERMISSIONS.RECEIPT_VIEW,
    // Dashboard
    PERMISSIONS.DASHBOARD_VIEW,
  ],
};

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
}

export interface AuthContextType {
  // User data
  user: User | null;
  userRole: string;
  clerkUser: any;
  
  // Loading states
  loading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Error state
  error: string | null;
  
  // Setters
  setUser: (user: User | null) => void;
  
  // Auth actions
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<void>;
  verify2FA: (code: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  
  // User management
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  getUsers: (params?: { page?: number; limit?: number; search?: string }) => Promise<{ users: User[]; total: number }>;
  deleteUser: (userId: string) => Promise<void>;
  
  // Permission checking
  hasPermission: (roles: string[]) => boolean;
  hasBusinessUnitAccess: (businessUnitId: string) => boolean;
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
  
  // Role checks
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isEditor: boolean;
  isViewer: boolean;
  isEmployee: boolean;
  isCashier: boolean;
  isUser: boolean;
  
  // ============================================
  // FULL PERMISSION CHECKS - All Resources
  // ============================================
  
  // User Management
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canEditUsers: boolean;
  canDeleteUsers: boolean;
  canManageUsers: boolean;
  canActivateUsers: boolean;
  canDeactivateUsers: boolean;
  canUpdateUserRole: boolean;
  canExportUsers: boolean;
  
  // Category
  canViewCategories: boolean;
  canCreateCategories: boolean;
  canEditCategories: boolean;
  canDeleteCategories: boolean;
  canManageCategories: boolean;
  
  // Product
  canViewProducts: boolean;
  canCreateProducts: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canManageProducts: boolean;
  canExportProducts: boolean;
  canImportProducts: boolean;
  
  // Supplier
  canViewSuppliers: boolean;
  canCreateSuppliers: boolean;
  canEditSuppliers: boolean;
  canDeleteSuppliers: boolean;
  canManageSuppliers: boolean;
  
  // Order
  canViewOrders: boolean;
  canCreateOrders: boolean;
  canEditOrders: boolean;
  canDeleteOrders: boolean;
  canManageOrders: boolean;
  canProcessOrders: boolean;
  canCancelOrders: boolean;
  
  // Customer
  canViewCustomers: boolean;
  canCreateCustomers: boolean;
  canEditCustomers: boolean;
  canDeleteCustomers: boolean;
  canManageCustomers: boolean;
  
  // Inventory
  canViewInventory: boolean;
  canCreateInventory: boolean;
  canEditInventory: boolean;
  canDeleteInventory: boolean;
  canManageInventory: boolean;
  canAdjustInventory: boolean;
  canTransferInventory: boolean;
  
  // Report
  canViewReports: boolean;
  canCreateReports: boolean;
  canExportReports: boolean;
  canManageReports: boolean;
  
  // Analytics
  canViewAnalytics: boolean;
  canExportAnalytics: boolean;
  
  // Settings
  canViewSettings: boolean;
  canEditSettings: boolean;
  canManageSettings: boolean;
  
  // System
  canViewSystemLogs: boolean;
  canBackupSystem: boolean;
  canRestoreSystem: boolean;
  canViewSystemSettings: boolean;
  
  // Business Unit
  canViewBusinessUnits: boolean;
  canCreateBusinessUnits: boolean;
  canEditBusinessUnits: boolean;
  canDeleteBusinessUnits: boolean;
  canManageBusinessUnits: boolean;
  
  // Sales
  canViewSales: boolean;
  canCreateSales: boolean;
  canEditSales: boolean;
  canDeleteSales: boolean;
  canManageSales: boolean;
  canExportSales: boolean;
  canPrintSales: boolean;
  canEmailSales: boolean;
  
  // POS
  canViewPos: boolean;
  canCreatePos: boolean;
  canManagePos: boolean;
  canPrintPos: boolean;
  
  // Cash Register
  canViewCashRegister: boolean;
  canManageCashRegister: boolean;
  canOpenCashRegister: boolean;
  canCloseCashRegister: boolean;
  
  // Shift
  canViewShifts: boolean;
  canManageShifts: boolean;
  canStartShift: boolean;
  canEndShift: boolean;
  
  // Return
  canViewReturns: boolean;
  canCreateReturns: boolean;
  canEditReturns: boolean;
  canDeleteReturns: boolean;
  canManageReturns: boolean;
  canApproveReturns: boolean;
  canRejectReturns: boolean;
  canProcessReturns: boolean;
  
  // Refund
  canViewRefunds: boolean;
  canCreateRefunds: boolean;
  canEditRefunds: boolean;
  canDeleteRefunds: boolean;
  canManageRefunds: boolean;
  canApproveRefunds: boolean;
  canRejectRefunds: boolean;
  canCompleteRefunds: boolean;
  
  // Invoice
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
  
  // Receipt
  canViewReceipts: boolean;
  canCreateReceipts: boolean;
  canEditReceipts: boolean;
  canDeleteReceipts: boolean;
  canManageReceipts: boolean;
  canPrintReceipts: boolean;
  canEmailReceipts: boolean;
  canVoidReceipts: boolean;
  
  // Payment
  canViewPayments: boolean;
  canCreatePayments: boolean;
  canManagePayments: boolean;
  canRefundPayments: boolean;
  
  // Dashboard
  canViewDashboard: boolean;
  canManageDashboard: boolean;
  
  // Integration
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

// Helper to map authService User to local User
const mapAuthUser = (authUser: any, clerkRole?: string): User => {
  const role = (clerkRole || authUser.role || 'USER') as UserRole;
  
  return {
    id: authUser.id || '',
    email: authUser.email || '',
    firstName: authUser.firstName || '',
    lastName: authUser.lastName || '',
    role: role,
    companyId: authUser.companyId,
    businessUnits: authUser.businessUnits || [],
    isActive: authUser.isActive !== undefined ? authUser.isActive : true,
    permissions: authUser.permissions || [],
    createdAt: authUser.createdAt,
    updatedAt: authUser.updatedAt,
    clerkId: authUser.clerkId,
    phoneNumber: authUser.phoneNumber,
    avatar: authUser.avatar,
  };
};

export function AuthProvider({ children }: AuthProviderProps) {
  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user role from Clerk metadata or user object
  const userRole = useMemo(() => {
    if (clerkUser?.publicMetadata?.role) {
      return clerkUser.publicMetadata.role as string;
    }
    if (clerkUser?.unsafeMetadata?.role) {
      return clerkUser.unsafeMetadata.role as string;
    }
    if (user?.role) {
      return user.role;
    }
    return 'USER';
  }, [clerkUser, user]);

  // Permission check helper
  const hasPermission = useCallback((roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  // Check if user has a specific permission
  const can = useCallback((permission: string): boolean => {
    if (!user) return false;
    
    // SUPER_ADMIN has all permissions
    if (user.role === 'SUPER_ADMIN') return true;
    
    // If user has custom permissions, check them first
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(permission);
    }
    
    // Otherwise check role-based permissions
    const rolePermissions = ROLE_PERMISSIONS[user.role] || [];
    return rolePermissions.includes(permission);
  }, [user]);

  // Check if user has any of the given permissions
  const canAny = useCallback((permissions: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return permissions.some(p => can(p));
  }, [user, can]);

  // Check if user has all of the given permissions
  const canAll = useCallback((permissions: string[]): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return permissions.every(p => can(p));
  }, [user, can]);

  // Check if user has access to a business unit
  const hasBusinessUnitAccess = useCallback((businessUnitId: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return user.businessUnits.some(bu => bu.businessUnitId === businessUnitId);
  }, [user]);

  // Memoized role checks
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const isEditor = user?.role === 'EDITOR';
  const isViewer = user?.role === 'VIEWER';
  const isEmployee = user?.role === 'EMPLOYEE';
  const isCashier = user?.role === 'CASHIER';
  const isUser = user?.role === 'USER';

  // ============================================
  // MEMOIZED PERMISSION CHECKS
  // ============================================

  const permissionChecks = useMemo(() => ({
    // User Management
    canViewUsers: can(PERMISSIONS.USER_VIEW),
    canCreateUsers: can(PERMISSIONS.USER_CREATE),
    canEditUsers: can(PERMISSIONS.USER_EDIT),
    canDeleteUsers: can(PERMISSIONS.USER_DELETE),
    canManageUsers: can(PERMISSIONS.USER_MANAGE),
    canActivateUsers: can(PERMISSIONS.USER_ACTIVATE),
    canDeactivateUsers: can(PERMISSIONS.USER_DEACTIVATE),
    canUpdateUserRole: can(PERMISSIONS.USER_ROLE_UPDATE),
    canExportUsers: can(PERMISSIONS.USER_EXPORT),
    
    // Category
    canViewCategories: can(PERMISSIONS.CATEGORY_VIEW),
    canCreateCategories: can(PERMISSIONS.CATEGORY_CREATE),
    canEditCategories: can(PERMISSIONS.CATEGORY_EDIT),
    canDeleteCategories: can(PERMISSIONS.CATEGORY_DELETE),
    canManageCategories: can(PERMISSIONS.CATEGORY_MANAGE),
    
    // Product
    canViewProducts: can(PERMISSIONS.PRODUCT_VIEW),
    canCreateProducts: can(PERMISSIONS.PRODUCT_CREATE),
    canEditProducts: can(PERMISSIONS.PRODUCT_EDIT),
    canDeleteProducts: can(PERMISSIONS.PRODUCT_DELETE),
    canManageProducts: can(PERMISSIONS.PRODUCT_MANAGE),
    canExportProducts: can(PERMISSIONS.PRODUCT_EXPORT),
    canImportProducts: can(PERMISSIONS.PRODUCT_IMPORT),
    
    // Supplier
    canViewSuppliers: can(PERMISSIONS.SUPPLIER_VIEW),
    canCreateSuppliers: can(PERMISSIONS.SUPPLIER_CREATE),
    canEditSuppliers: can(PERMISSIONS.SUPPLIER_EDIT),
    canDeleteSuppliers: can(PERMISSIONS.SUPPLIER_DELETE),
    canManageSuppliers: can(PERMISSIONS.SUPPLIER_MANAGE),
    
    // Order
    canViewOrders: can(PERMISSIONS.ORDER_VIEW),
    canCreateOrders: can(PERMISSIONS.ORDER_CREATE),
    canEditOrders: can(PERMISSIONS.ORDER_EDIT),
    canDeleteOrders: can(PERMISSIONS.ORDER_DELETE),
    canManageOrders: can(PERMISSIONS.ORDER_MANAGE),
    canProcessOrders: can(PERMISSIONS.ORDER_PROCESS),
    canCancelOrders: can(PERMISSIONS.ORDER_CANCEL),
    
    // Customer
    canViewCustomers: can(PERMISSIONS.CUSTOMER_VIEW),
    canCreateCustomers: can(PERMISSIONS.CUSTOMER_CREATE),
    canEditCustomers: can(PERMISSIONS.CUSTOMER_EDIT),
    canDeleteCustomers: can(PERMISSIONS.CUSTOMER_DELETE),
    canManageCustomers: can(PERMISSIONS.CUSTOMER_MANAGE),
    
    // Inventory
    canViewInventory: can(PERMISSIONS.INVENTORY_VIEW),
    canCreateInventory: can(PERMISSIONS.INVENTORY_CREATE),
    canEditInventory: can(PERMISSIONS.INVENTORY_EDIT),
    canDeleteInventory: can(PERMISSIONS.INVENTORY_DELETE),
    canManageInventory: can(PERMISSIONS.INVENTORY_MANAGE),
    canAdjustInventory: can(PERMISSIONS.INVENTORY_ADJUST),
    canTransferInventory: can(PERMISSIONS.INVENTORY_TRANSFER),
    
    // Report
    canViewReports: can(PERMISSIONS.REPORT_VIEW),
    canCreateReports: can(PERMISSIONS.REPORT_CREATE),
    canExportReports: can(PERMISSIONS.REPORT_EXPORT),
    canManageReports: can(PERMISSIONS.REPORT_MANAGE),
    
    // Analytics
    canViewAnalytics: can(PERMISSIONS.ANALYTICS_VIEW),
    canExportAnalytics: can(PERMISSIONS.ANALYTICS_EXPORT),
    
    // Settings
    canViewSettings: can(PERMISSIONS.SETTINGS_VIEW),
    canEditSettings: can(PERMISSIONS.SETTINGS_EDIT),
    canManageSettings: can(PERMISSIONS.SETTINGS_MANAGE),
    
    // System
    canViewSystemLogs: can(PERMISSIONS.SYSTEM_LOGS),
    canBackupSystem: can(PERMISSIONS.SYSTEM_BACKUP),
    canRestoreSystem: can(PERMISSIONS.SYSTEM_RESTORE),
    canViewSystemSettings: can(PERMISSIONS.SYSTEM_SETTINGS),
    
    // Business Unit
    canViewBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_VIEW),
    canCreateBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_CREATE),
    canEditBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_EDIT),
    canDeleteBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_DELETE),
    canManageBusinessUnits: can(PERMISSIONS.BUSINESS_UNIT_MANAGE),
    
    // Sales
    canViewSales: can(PERMISSIONS.SALE_VIEW),
    canCreateSales: can(PERMISSIONS.SALE_CREATE),
    canEditSales: can(PERMISSIONS.SALE_EDIT),
    canDeleteSales: can(PERMISSIONS.SALE_DELETE),
    canManageSales: can(PERMISSIONS.SALE_MANAGE),
    canExportSales: can(PERMISSIONS.SALE_EXPORT),
    canPrintSales: can(PERMISSIONS.SALE_PRINT),
    canEmailSales: can(PERMISSIONS.SALE_EMAIL),
    
    // POS
    canViewPos: can(PERMISSIONS.POS_VIEW),
    canCreatePos: can(PERMISSIONS.POS_CREATE),
    canManagePos: can(PERMISSIONS.POS_MANAGE),
    canPrintPos: can(PERMISSIONS.POS_PRINT),
    
    // Cash Register
    canViewCashRegister: can(PERMISSIONS.CASH_REGISTER_VIEW),
    canManageCashRegister: can(PERMISSIONS.CASH_REGISTER_MANAGE),
    canOpenCashRegister: can(PERMISSIONS.CASH_REGISTER_OPEN),
    canCloseCashRegister: can(PERMISSIONS.CASH_REGISTER_CLOSE),
    
    // Shift
    canViewShifts: can(PERMISSIONS.SHIFT_VIEW),
    canManageShifts: can(PERMISSIONS.SHIFT_MANAGE),
    canStartShift: can(PERMISSIONS.SHIFT_START),
    canEndShift: can(PERMISSIONS.SHIFT_END),
    
    // Return
    canViewReturns: can(PERMISSIONS.RETURN_VIEW),
    canCreateReturns: can(PERMISSIONS.RETURN_CREATE),
    canEditReturns: can(PERMISSIONS.RETURN_EDIT),
    canDeleteReturns: can(PERMISSIONS.RETURN_DELETE),
    canManageReturns: can(PERMISSIONS.RETURN_MANAGE),
    canApproveReturns: can(PERMISSIONS.RETURN_APPROVE),
    canRejectReturns: can(PERMISSIONS.RETURN_REJECT),
    canProcessReturns: can(PERMISSIONS.RETURN_PROCESS),
    
    // Refund
    canViewRefunds: can(PERMISSIONS.REFUND_VIEW),
    canCreateRefunds: can(PERMISSIONS.REFUND_CREATE),
    canEditRefunds: can(PERMISSIONS.REFUND_EDIT),
    canDeleteRefunds: can(PERMISSIONS.REFUND_DELETE),
    canManageRefunds: can(PERMISSIONS.REFUND_MANAGE),
    canApproveRefunds: can(PERMISSIONS.REFUND_APPROVE),
    canRejectRefunds: can(PERMISSIONS.REFUND_REJECT),
    canCompleteRefunds: can(PERMISSIONS.REFUND_COMPLETE),
    
    // Invoice
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
    
    // Receipt
    canViewReceipts: can(PERMISSIONS.RECEIPT_VIEW),
    canCreateReceipts: can(PERMISSIONS.RECEIPT_CREATE),
    canEditReceipts: can(PERMISSIONS.RECEIPT_EDIT),
    canDeleteReceipts: can(PERMISSIONS.RECEIPT_DELETE),
    canManageReceipts: can(PERMISSIONS.RECEIPT_MANAGE),
    canPrintReceipts: can(PERMISSIONS.RECEIPT_PRINT),
    canEmailReceipts: can(PERMISSIONS.RECEIPT_EMAIL),
    canVoidReceipts: can(PERMISSIONS.RECEIPT_VOID),
    
    // Payment
    canViewPayments: can(PERMISSIONS.PAYMENT_VIEW),
    canCreatePayments: can(PERMISSIONS.PAYMENT_CREATE),
    canManagePayments: can(PERMISSIONS.PAYMENT_MANAGE),
    canRefundPayments: can(PERMISSIONS.PAYMENT_REFUND),
    
    // Dashboard
    canViewDashboard: can(PERMISSIONS.DASHBOARD_VIEW),
    canManageDashboard: can(PERMISSIONS.DASHBOARD_MANAGE),
    
    // Integration
    canViewIntegrations: can(PERMISSIONS.INTEGRATION_VIEW),
    canManageIntegrations: can(PERMISSIONS.INTEGRATION_MANAGE),
    canViewApi: can(PERMISSIONS.API_VIEW),
    canManageApi: can(PERMISSIONS.API_MANAGE),
    canViewWebhooks: can(PERMISSIONS.WEBHOOK_VIEW),
    canManageWebhooks: can(PERMISSIONS.WEBHOOK_MANAGE),
  }), [can]);

  // ============================================
  // AUTH ACTIONS
  // ============================================

  const updateUserRole = useCallback(async (userId: string, role: UserRole) => {
    try {
      const updatedUser = await authService.updateUserRole(userId, role);
      const mappedUser = mapAuthUser(updatedUser);
      setUser(mappedUser);
      localStorage.setItem('user', JSON.stringify(mappedUser));
    } catch (error) {
      console.error('Failed to update user role:', error);
      throw error;
    }
  }, []);

  const updateUser = useCallback(async (userId: string, data: Partial<User>) => {
    try {
      const updatedUser = await authService.updateUser(userId, data);
      const mappedUser = mapAuthUser(updatedUser);
      setUser(mappedUser);
      localStorage.setItem('user', JSON.stringify(mappedUser));
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }, []);

  const getUsers = useCallback(async (params?: { page?: number; limit?: number; search?: string }) => {
    try {
      const response = await authService.getUsers(params);
      return {
        users: response.users.map(u => mapAuthUser(u)),
        total: response.total,
      };
    } catch (error) {
      console.error('Failed to get users:', error);
      throw error;
    }
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      await authService.deleteUser(userId);
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }, []);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (clerkLoaded && isSignedIn && clerkUser) {
        const clerkRole = (clerkUser?.publicMetadata?.role as string) || 
                          (clerkUser?.unsafeMetadata?.role as string) || 
                          'USER';
        
        console.log('Clerk role:', clerkRole);
        
        const token = localStorage.getItem('auth_token');
        
        if (token) {
          try {
            const userData = await authService.getCurrentUser();
            if (userData) {
              const mappedUser = mapAuthUser(userData, clerkRole);
              setUser(mappedUser);
              setIsAuthenticated(true);
              localStorage.setItem('user', JSON.stringify(mappedUser));
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('Failed to get user from backend:', error);
          }
        }

        // If Clerk says SUPER_ADMIN, use that directly
        if (clerkRole === 'SUPER_ADMIN') {
          const adminUser: User = {
            id: clerkUser.id,
            email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
            firstName: clerkUser.firstName || '',
            lastName: clerkUser.lastName || '',
            role: 'SUPER_ADMIN',
            businessUnits: [],
            isActive: true,
            permissions: [],
          };
          setUser(adminUser);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(adminUser));
          setLoading(false);
          return;
        }

        // If no user found, create one
        try {
          const randomPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
          
          const userData = await authService.register({
            email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
            firstName: clerkUser.firstName || '',
            lastName: clerkUser.lastName || '',
            phoneNumber: clerkUser.phoneNumbers?.[0]?.phoneNumber || '',
            password: randomPassword,
            role: clerkRole,
          });
          
          const mappedUser = mapAuthUser(userData, clerkRole);
          setUser(mappedUser);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(mappedUser));
        } catch (error) {
          console.error('Failed to create user in backend:', error);
          const fallbackUser: User = {
            id: clerkUser.id,
            email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
            firstName: clerkUser.firstName || '',
            lastName: clerkUser.lastName || '',
            role: clerkRole as UserRole,
            businessUnits: [],
            isActive: true,
            permissions: [],
          };
          setUser(fallbackUser);
          setIsAuthenticated(true);
          localStorage.setItem('user', JSON.stringify(fallbackUser));
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        localStorage.removeItem('user');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setError('Authentication failed');
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [clerkLoaded, isSignedIn, clerkUser]);

  const refreshUser = useCallback(async () => {
    try {
      const clerkRole = (clerkUser?.publicMetadata?.role as string) || 
                        (clerkUser?.unsafeMetadata?.role as string);
      
      const userData = await authService.getCurrentUser();
      if (userData) {
        const mappedUser = mapAuthUser(userData, clerkRole);
        setUser(mappedUser);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(mappedUser));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [clerkUser]);

  const login = async (email: string, password: string, remember?: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.login({ email, password, remember });
      localStorage.setItem('auth_token', response.token);
      const mappedUser = mapAuthUser(response.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(mappedUser));
    } catch (error) {
      setError('Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      setUser(null);
      setIsAuthenticated(false);
      
      try {
        await signOut();
      } catch (error) {
        console.error('Clerk sign out error:', error);
      }
    }
  };

  const register = async (data: any) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.register(data);
      localStorage.setItem('auth_token', response.token);
      const mappedUser = mapAuthUser(response.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(mappedUser));
    } catch (error) {
      setError('Registration failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.verify2FA(code);
      localStorage.setItem('auth_token', response.token);
      const mappedUser = mapAuthUser(response.user);
      setUser(mappedUser);
      setIsAuthenticated(true);
      localStorage.setItem('user', JSON.stringify(mappedUser));
    } catch (error) {
      setError('2FA verification failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Run auth check on mount and when Clerk state changes
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load user from localStorage on mount
  useEffect(() => {
    try {
      const cachedUser = localStorage.getItem('user');
      if (cachedUser) {
        const parsedUser = JSON.parse(cachedUser);
        if (clerkUser?.publicMetadata?.role === 'SUPER_ADMIN') {
          parsedUser.role = 'SUPER_ADMIN';
        }
        setUser(parsedUser);
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to load user from localStorage:', error);
    }
  }, [clerkUser]);

  // Listen for auth token changes
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        if (e.newValue) {
          refreshUser();
        } else {
          setUser(null);
          setIsAuthenticated(false);
          localStorage.removeItem('user');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshUser]);

  const value: AuthContextType = {
    // User data
    user,
    userRole,
    clerkUser,
    
    // Loading states
    loading,
    isLoaded: clerkLoaded,
    isSignedIn: isSignedIn || false,
    isLoading: loading || !clerkLoaded,
    isAuthenticated,
    
    // Error state
    error,
    
    // Setters
    setUser,
    
    // Auth actions
    login,
    logout,
    register,
    verify2FA,
    refreshUser,
    
    // User management
    updateUserRole,
    updateUser,
    getUsers,
    deleteUser,
    
    // Permission checking
    hasPermission,
    hasBusinessUnitAccess,
    can,
    canAny,
    canAll,
    
    // Role checks
    isSuperAdmin,
    isAdmin,
    isManager,
    isEditor,
    isViewer,
    isEmployee,
    isCashier,
    isUser,
    
    // All permission checks
    ...permissionChecks,
  };

  return React.createElement(
    AuthContext.Provider,
    { value },
    children
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default useAuth;
