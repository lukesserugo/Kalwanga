// D:\Projects\Kalwanga\packages\web\types\search.ts
import { UserRole, OrderStatus, PaymentMethod, PaymentStatus } from './enums';

export interface SearchParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface UserSearchParams extends SearchParams {
  role?: UserRole;
  businessUnitId?: string;
  isActive?: boolean;
  companyId?: string;
}

export interface ProductSearchParams extends SearchParams {
  categoryId?: string;
  businessUnitId?: string;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  supplierId?: string;
  inStock?: boolean;
  minRating?: number;
}

export interface SaleSearchParams extends SearchParams {
  businessUnitId?: string;
  customerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  minTotal?: number;
  maxTotal?: number;
}

export interface OrderSearchParams extends SearchParams {
  businessUnitId?: string;
  customerId?: string;
  userId?: string;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  minTotal?: number;
  maxTotal?: number;
}

export interface InventorySearchParams extends SearchParams {
  businessUnitId?: string;
  location?: string;
  lowStock?: boolean;
  productId?: string;
  category?: string;
  status?: string;
}

export interface CustomerSearchParams extends SearchParams {
  companyId?: string;
  isActive?: boolean;
  minLoyaltyPoints?: number;
  maxLoyaltyPoints?: number;
  minSpent?: number;
  maxSpent?: number;
}

export interface PurchaseOrderSearchParams extends SearchParams {
  businessUnitId?: string;
  supplierId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface PaymentSearchParams extends SearchParams {
  businessUnitId?: string;
  saleId?: string;
  method?: PaymentMethod;
  status?: PaymentStatus;
  startDate?: string;
  endDate?: string;
}

export interface ReportSearchParams extends SearchParams {
  type?: string;
  format?: string;
  startDate?: string;
  endDate?: string;
  generatedBy?: string;
}
