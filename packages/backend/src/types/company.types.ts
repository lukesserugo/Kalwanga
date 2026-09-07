// D:\Projects\Kalwanga\packages\backend\src\types\company.types.ts

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

export interface CompanyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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

export interface CompanySettingsDto {
  taxRate?: number;
  taxInclusive?: boolean;
  receiptFooter?: string;
  receiptHeader?: string;
  lowStockThreshold?: number;
  autoReorder?: boolean;
  allowReturns?: boolean;
  requireCustomerForReturn?: boolean;
  maxReturnDays?: number;
  allowCash?: boolean;
  allowCard?: boolean;
  allowMobileMoney?: boolean;
  allowGiftCards?: boolean;
}

export interface SalesSettingsDto {
  taxRate?: number;
  discountEnabled?: boolean;
  maxDiscount?: number;
  loyaltyPointsEnabled?: boolean;
  pointsPerDollar?: number;
  autoPrintReceipt?: boolean;
  emailReceipts?: boolean;
  receiptFooter?: string;
  defaultPaymentMethod?: string;
  currencySymbol?: string;
  currencyCode?: string;
  invoicePrefix?: string;
  receiptPrefix?: string;
}
