// D:\Projects\Kalwanga\packages\web\types\inventory.ts

import { Product, ProductVariant } from './product';
import { BusinessUnit, User } from './user';
import { Sale } from './sale';
import { PurchaseOrder } from './order';

// ============================================
// ENUMS & TYPE ALIASES
// ============================================

export type InventoryTransactionType = 
  | 'INITIAL'
  | 'ADJUSTMENT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'SALE'
  | 'PURCHASE'
  | 'ISSUE'
  | 'RETURN'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RESERVATION'
  | 'RESTOCK'
  | 'DAMAGED'
  | 'LOST'
  | 'TRANSFER';

export type InventoryIssueStatus = 
  | 'ISSUED'
  | 'RETURNED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'LOST'
  | 'DAMAGED';

export type InventoryStatus = 
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DISCONTINUED'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK';

export type InventoryTransferStatus =
  | 'PENDING'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'CANCELLED';

// ============================================
// CORE INTERFACES
// ============================================

export interface Inventory {
  id: string;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  
  // Stock quantities
  quantity: number;
  reserved: number;
  available: number; // quantity - reserved
  reorderPoint: number;
  reorderQuantity: number;
  
  // Location & physical attributes
  location?: string;
  shelfNumber?: string;
  supplier?: string;
  supplierId?: string;
  notes?: string;
  
  // Product attributes (sometimes directly on inventory)
  name?: string;
  sku?: string;
  barcode?: string | null;
  unitPrice?: number;
  costPrice?: number;
  price?: number;
  unit?: string;
  weight?: number;
  taxRate?: number;
  tags?: string[];
  description?: string;
  images?: string[];
  category?: string;
  categoryId?: string;
  
  // Status flags
  status: InventoryStatus;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  
  // Relations
  transactions?: InventoryTransaction[];
  issues?: InventoryIssue[];
  transfers?: InventoryTransfer[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface InventoryTransaction {
  id: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  notes?: string;
  reference?: string;
  
  // Relations
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
  inventoryId: string;
  inventory?: Inventory;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  saleId?: string;
  sale?: Sale;
  purchaseOrderId?: string;
  purchaseOrder?: PurchaseOrder;
  
  // Timestamps
  createdAt: string;
  updatedAt?: string;
}

export interface InventoryIssue {
  id: string;
  inventoryId: string;
  inventory?: Inventory;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  
  // Issue details
  issuedTo: string;
  issuedToUser?: User;
  quantity: number;
  purpose?: string;
  remarks?: string;
  status: InventoryIssueStatus;
  expectedReturnDate?: string;
  returnDate?: string;
  
  // Relations
  userId: string;
  user?: User;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransfer {
  id: string;
  fromInventoryId: string;
  fromInventory?: Inventory;
  toInventoryId: string;
  toInventory?: Inventory;
  productId: string;
  product?: Product;
  variantId?: string;
  variant?: ProductVariant;
  quantity: number;
  status: InventoryTransferStatus;
  notes?: string;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
}

// ============================================
// REQUEST & RESPONSE INTERFACES
// ============================================

export interface InventorySearchParams {
  page?: number;
  limit?: number;
  search?: string;
  businessUnitId?: string;
  productId?: string;
  variantId?: string;
  category?: string;
  categoryId?: string;
  location?: string;
  status?: InventoryStatus | string;
  lowStock?: boolean;
  outOfStock?: boolean;
  hasBarcode?: boolean;
  minPrice?: number;
  maxPrice?: number;
  supplier?: string;
  supplierId?: string;
  inStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  includeDeleted?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface InventoryStats {
  totalProducts: number;
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  profitMargin: number;
  averagePrice: number;
  totalCategories: number;
  totalSuppliers: number;
  withBarcode: number;
  withoutBarcode: number;
  inStock: number;
  inStockValue: number;
  locations?: Array<{ location: string; count: number; value: number }>;
  categories?: Array<{ category: string; count: number; value: number }>;
}

export interface InventoryPagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface InventoryListResponse {
  data: Inventory[];
  stats: InventoryStats;
  pagination: InventoryPagination;
}

// ============================================
// DTOs (Data Transfer Objects)
// ============================================

export interface CreateInventoryItemData {
  name: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  supplierId?: string;
  quantity: number;
  minStock?: number;
  maxStock?: number;
  unitPrice: number;
  costPrice?: number;
  location?: string;
  shelfNumber?: string;
  barcode?: string;
  notes?: string;
  businessUnitId?: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  weight?: number;
  taxRate?: number;
  unit?: string;
  tags?: string[];
  images?: string[];
  productType?: 'SIMPLE' | 'VARIABLE' | 'GROUPED' | 'BUNDLE' | 'DIGITAL' | 'SERVICE';
  variants?: Array<{
    name: string;
    sku: string;
    price: number;
    costPrice?: number;
    stock?: number;
    attributes: Record<string, any>;
    images?: string[];
  }>;
}

export interface UpdateInventoryItemData {
  name?: string;
  sku?: string;
  description?: string;
  categoryId?: string;
  supplierId?: string;
  quantity?: number;
  minStock?: number;
  maxStock?: number;
  unitPrice?: number;
  costPrice?: number;
  location?: string;
  shelfNumber?: string;
  barcode?: string;
  notes?: string;
  businessUnitId?: string;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  weight?: number;
  taxRate?: number;
  unit?: string;
  tags?: string[];
  images?: string[];
}

export interface AdjustStockData {
  inventoryId: string;
  quantity: number;
  transactionType: InventoryTransactionType;
  notes?: string;
  reference?: string;
}

export interface TransferStockData {
  fromInventoryId: string;
  toInventoryId: string;
  quantity: number;
  notes?: string;
  productId: string;
  variantId?: string;
  businessUnitId: string;
}

export interface IssueItemData {
  inventoryId: string;
  issuedTo: string;
  quantity: number;
  purpose?: string;
  remarks?: string;
  expectedReturnDate?: string;
}

export interface RestockItemData {
  inventoryId: string;
  quantity: number;
  supplier?: string;
  unitPrice?: number;
  purchaseDate?: string;
  notes?: string;
  invoiceNumber?: string;
}

export interface ReturnItemData {
  inventoryId: string;
  quantity: number;
  returnDate?: string;
  remarks?: string;
  condition?: 'good' | 'damaged' | 'used';
}

// ============================================
// SUMMARY & ANALYTICS
// ============================================

export interface InventorySummary {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  categories: Array<{ category: string; count: number; value: number }>;
  locations: Array<{ location: string; count: number; value: number }>;
  stockStatus: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
  };
}

export interface InventoryValue {
  totalValue: number;
  totalCost: number;
  profitMargin: number;
  byLocation: Array<{ location: string; value: number; cost: number }>;
  byCategory: Array<{ category: string; value: number; cost: number }>;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  variantName?: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  notes?: string;
  user: string;
  createdAt: string;
}

// ============================================
// BULK OPERATIONS
// ============================================

export interface BulkUpdateResult {
  results: any[];
  errors: Array<{ id: string; error: string }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export interface BulkCreateResult {
  created: Array<{ id: string; name: string }>;
  errors: Array<{ index: number; error: string }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

export interface BulkDeleteResult {
  deleted: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

// ============================================
// EXPORT FORMATS
// ============================================

export type ExportFormat = 'csv' | 'excel' | 'json' | 'pdf';

export interface ExportFilters {
  businessUnitId?: string;
  startDate?: string;
  endDate?: string;
  category?: string;
  location?: string;
  status?: InventoryStatus | string;
  lowStock?: boolean;
  hasBarcode?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface InventoryItemResponse {
  success: boolean;
  data?: Inventory;
  message?: string;
  errors?: string[];
}

export interface InventoryListResponseWithMeta {
  success: boolean;
  data: Inventory[];
  pagination: InventoryPagination;
  stats: InventoryStats;
  message?: string;
}

export interface BulkOperationResponse {
  success: boolean;
  data?: BulkUpdateResult | BulkCreateResult | BulkDeleteResult;
  message?: string;
  errors?: string[];
}

// ============================================
// SORTING & FILTERING HELPERS
// ============================================

export type InventorySortField = 
  | 'name'
  | 'sku'
  | 'quantity'
  | 'unitPrice'
  | 'costPrice'
  | 'totalValue'
  | 'createdAt'
  | 'updatedAt'
  | 'status';

export interface InventorySortOptions {
  field: InventorySortField;
  order: 'asc' | 'desc';
}

export interface InventoryFilterOptions {
  search?: string;
  categoryId?: string;
  location?: string;
  status?: InventoryStatus | string;
  minPrice?: number;
  maxPrice?: number;
  lowStock?: boolean;
  outOfStock?: boolean;
  hasBarcode?: boolean;
  supplierId?: string;
  inStock?: boolean;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  tags?: string[];
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
}

// ============================================
// STOCK LEVEL HELPERS
// ============================================

export interface StockLevel {
  current: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  maxStock?: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isOverStock: boolean;
  percentage: number;
  status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'HIGH' | 'OVERSTOCK';
}

export interface StockAlert {
  id: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderPoint: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  createdAt: string;
  isRead: boolean;
}
