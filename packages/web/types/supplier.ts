// D:\Projects\Kalwanga\packages\web\types\supplier.ts

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  taxId?: string;
  contactPerson?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  notes?: string;
  isActive: boolean;
  rating?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  createdAt: string;
  updatedAt: string;
  businessUnitId?: string;
  companyId?: string;
  productCount?: number;
  totalSpent?: number;
  lastOrderDate?: string;
  _count?: {
    products?: number;
    purchaseOrders?: number;
  };
}

export interface SupplierContact {
  id: string;
  supplierId: string;
  name: string;
  email: string;
  phone: string;
  position?: string;
  isPrimary: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierProduct {
  id: string;
  supplierId: string;
  productId: string;
  supplierSku?: string;
  unitPrice: number;
  leadTime?: number;
  minimumOrderQuantity?: number;
  isPreferred: boolean;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  businessUnitId: string;
  userId: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'SENT' | 'RECEIVED' | 'CANCELLED' | 'PARTIALLY_RECEIVED' | 'COMPLETED';
  orderDate: string;
  expectedDeliveryDate?: string;
  receivedDate?: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  items: PurchaseOrderItem[];
  supplier?: Supplier;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  receivedQuantity: number;
  productName: string;
  productSku: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reference: string;
  notes?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  updatedAt?: string;
}

export interface SupplierRating {
  id: string;
  supplierId: string;
  rating: number;
  review?: string;
  userId: string;
  businessUnitId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface SupplierSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
  businessUnitId?: string;
  isActive?: boolean;
  minRating?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface SupplierFilterOptions {
  categories?: string[];
  locations?: string[];
  ratingRange?: {
    min: number;
    max: number;
  };
  hasContactPerson?: boolean;
  activeOnly?: boolean;
}

export interface SupplierStatistics {
  total: number;
  active: number;
  inactive: number;
  totalSpent: number;
  totalOrders: number;
  averageRating: number;
  topSuppliers: Supplier[];
  recentOrders: number;
  averageLeadTime: number;
}

export interface SupplierSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  rating?: number;
  isActive: boolean;
  productCount: number;
  totalSpent: number;
  lastOrderDate?: string;
}

export interface SupplierPerformance {
  supplierId: string;
  supplierName: string;
  onTimeDeliveryRate: number;
  averageLeadTime: number;
  orderFulfillmentRate: number;
  qualityRating: number;
  responseTime: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  period: {
    start: string;
    end: string;
  };
}

export interface SupplierOrderHistory {
  id: string;
  orderNumber: string;
  orderDate: string;
  total: number;
  status: string;
  itemsCount: number;
  deliveryDate?: string;
}

export interface SupplierResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface BulkSupplierOperationResult {
  success: boolean;
  total: number;
  processed: number;
  failed: number;
  errors: Array<{
    id?: string;
    row?: number;
    message: string;
  }>;
  results: Supplier[];
}

export interface SupplierImportData {
  name: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  contactPerson?: string;
  contactPersonPhone?: string;
  contactPersonEmail?: string;
  taxId?: string;
  notes?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
}

export interface SupplierExportOptions {
  format: 'csv' | 'excel' | 'json';
  includeContacts?: boolean;
  includeProducts?: boolean;
  includeOrders?: boolean;
  includePayments?: boolean;
  businessUnitId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}
