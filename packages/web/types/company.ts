// D:\Projects\Kalwanga\packages\web\types\company.ts

import type { BusinessUnit } from './businessUnit';
import type { User } from './user';

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  taxId?: string | null;
  currency: string;
  timezone: string;
  logo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  businessUnits?: BusinessUnit[];
  users?: User[];
  settings?: CompanySettings;
  salesSettings?: SalesSettings;
  
  // Counts
  _count?: {
    businessUnits: number;
    users: number;
    customers: number;
    suppliers: number;
    invoices: number;
    giftCards: number;
    promotions: number;
  };
  
  // Stats
  stats?: CompanyStats;
}

export interface CompanySettings {
  id: string;
  companyId: string;
  taxRate: number;
  taxInclusive: boolean;
  receiptFooter?: string;
  receiptHeader?: string;
  lowStockThreshold: number;
  autoReorder: boolean;
  allowReturns: boolean;
  requireCustomerForReturn: boolean;
  maxReturnDays: number;
  allowCash: boolean;
  allowCard: boolean;
  allowMobileMoney: boolean;
  allowGiftCards: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalesSettings {
  id: string;
  companyId: string;
  taxRate: number;
  discountEnabled: boolean;
  maxDiscount: number;
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;
  autoPrintReceipt: boolean;
  emailReceipts: boolean;
  receiptFooter: string;
  defaultPaymentMethod: string;
  currencySymbol: string;
  currencyCode: string;
  invoicePrefix: string;
  receiptPrefix: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyStats {
  totalUsers: number;
  totalBusinessUnits: number;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalCustomers: number;
  totalSuppliers: number;
}

export interface CreateCompanyDto {
  name: string;
  email: string;
  phone: string;
  address?: string;
  taxId?: string;
  currency?: string;
  timezone?: string;
  logo?: string;
  isActive?: boolean;
}

export interface UpdateCompanyDto {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  currency?: string;
  timezone?: string;
  logo?: string;
  isActive?: boolean;
}
