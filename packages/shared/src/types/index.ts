// ============================================
// USER TYPES
// ============================================

export interface User {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatar?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  businessUnits?: BusinessUnitUser[];
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CASHIER';

export interface BusinessUnitUser {
  id: string;
  userId: string;
  businessUnitId: string;
  role: UserRole;
  isActive: boolean;
  businessUnit?: BusinessUnit;
  user?: User;
}

// ============================================
// COMPANY TYPES
// ============================================

export interface Company {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  taxId?: string;
  currency: string;
  timezone: string;
  logo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
}

// ============================================
// BUSINESS UNIT TYPES
// ============================================

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  companyId: string;
  company?: Company;
  users?: BusinessUnitUser[];
  inventory?: Inventory[];
  products?: Product[];
  orders?: Order[];
  sales?: Sale[];
  cashRegisters?: CashRegister[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// PRODUCT TYPES
// ============================================

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  unitPrice: number;
  costPrice?: number;
  taxRate?: number;
  minStock: number;
  maxStock?: number;
  isActive: boolean;
  isDigital: boolean;
  weight?: number;
  dimensions?: ProductDimensions;
  images: string[];
  attributes?: Record<string, any>;
  notes?: string;
  categoryId?: string;
  category?: Category;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  inventory?: Inventory[];
  variants?: ProductVariant[];
  stock?: number;
  createdBy?: string;
  creator?: User;
  updatedBy?: string;
  updater?: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductDimensions {
  length?: number;
  width?: number;
  height?: number;
  unit?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  product?: Product;
  name: string;
  sku: string;
  price: number;
  costPrice?: number;
  stock: number;
  attributes: Record<string, any>;
  isActive: boolean;
  inventory?: Inventory[];
  saleItems?: SaleItem[];
  orderItems?: OrderItem[];
  inventoryTransactions?: InventoryTransaction[];
  inventoryIssues?: InventoryIssue[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: Category;
  children: Category[];
  isActive: boolean;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  products: Product[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// INVENTORY TYPES
// ============================================

export interface Inventory {
  id: string;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  quantity: number;
  reserved: number;
  reorderPoint: number;
  reorderQuantity: number;
  location?: string;
  shelfNumber?: string;
  supplier?: string;
  notes?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  transactions?: InventoryTransaction[];
  issues?: InventoryIssue[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryTransaction {
  id: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  notes?: string;
  reference?: string;
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
  createdAt: Date;
}

export type InventoryTransactionType = 
  | 'PURCHASE' 
  | 'SALE' 
  | 'RETURN' 
  | 'ADJUSTMENT' 
  | 'TRANSFER'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ISSUE'
  | 'INITIAL'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

// ============================================
// INVENTORY ISSUE TYPES (NEW)
// ============================================

export interface InventoryIssue {
  id: string;
  inventoryId: string;
  inventory: Inventory;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  businessUnitId: string;
  businessUnit: BusinessUnit;
  issuedTo: string;
  quantity: number;
  purpose?: string;
  remarks?: string;
  status: InventoryIssueStatus;
  expectedReturnDate?: Date;
  returnDate?: Date;
  userId: string;
  user: User;
  createdAt: Date;
  updatedAt: Date;
}

export type InventoryIssueStatus = 'ISSUED' | 'RETURNED' | 'OVERDUE';

// ============================================
// ORDER TYPES
// ============================================

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  customerId?: string;
  customer?: Customer;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  items: OrderItem[];
  payment?: Payment;
  sale?: Sale;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'ON_HOLD';

export interface OrderItem {
  id: string;
  orderId: string;
  order?: Order;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

// ============================================
// SALE TYPES
// ============================================

export interface Sale {
  id: string;
  receiptNumber: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
  notes?: string;
  status: string;
  saleDate: Date;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user?: User;
  customerId?: string;
  customer?: Customer;
  items: SaleItem[];
  payments: Payment[];
  orderId?: string;
  order?: Order;
  cashRegisterId?: string;
  cashRegister?: CashRegister;
  cashRegisterSessionId?: string;
  cashRegisterSession?: CashRegisterSession;
  invoice?: Invoice;
  receipt?: Receipt;
  inventoryTransactions?: InventoryTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SaleItem {
  id: string;
  saleId: string;
  sale?: Sale;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

// ============================================
// PAYMENT TYPES
// ============================================

export interface Payment {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string;
  reference?: string;
  notes?: string;
  processedAt: Date;
  saleId?: string;
  sale?: Sale;
  orderId?: string;
  order?: Order;
  cashRegisterId?: string;
  cashRegister?: CashRegister;
  cashRegisterSessionId?: string;
  cashRegisterSession?: CashRegisterSession;
  userId: string;
  user?: User;
  gatewayId?: string;
  paymentGateway?: PaymentGateway;
}

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'MOBILE_MONEY' | 'BANK_TRANSFER' | 'GIFT_CARD';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIAL';

export interface PaymentGateway {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  credentials: Record<string, any>;
  testMode: boolean;
  companyId: string;
  company?: Company;
  payments: Payment[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// CUSTOMER TYPES
// ============================================

export interface Customer {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notes?: string;
  isActive: boolean;
  loyaltyPoints: number;
  totalSpent: number;
  lastPurchaseAt?: Date;
  companyId: string;
  company?: Company;
  orders: Order[];
  sales: Sale[];
  giftCards: GiftCard[];
  loyaltyHistory: LoyaltyHistory[];
  invoices: Invoice[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// GIFT CARD TYPES
// ============================================

export interface GiftCard {
  id: string;
  cardNumber: string;
  pin?: string;
  balance: number;
  initialBalance: number;
  isActive: boolean;
  expiresAt?: Date;
  customerId?: string;
  customer?: Customer;
  companyId: string;
  company?: Company;
  transactions: GiftCardTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GiftCardTransaction {
  id: string;
  amount: number;
  type: 'ISSUE' | 'REDEEM' | 'REFUND' | 'ADJUST';
  notes?: string;
  giftCardId: string;
  giftCard: GiftCard;
  saleId?: string;
  sale?: Sale;
  userId: string;
  user: User;
  createdAt: Date;
}

// ============================================
// LOYALTY TYPES
// ============================================

export interface LoyaltyProgram {
  id: string;
  name: string;
  description?: string;
  pointsPerDollar: number;
  minPointsForRedeem: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  companyId: string;
  company?: Company;
  rewards: LoyaltyReward[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description?: string;
  pointsRequired: number;
  discountValue?: number;
  freeProductId?: string;
  isActive: boolean;
  loyaltyProgramId: string;
  loyaltyProgram: LoyaltyProgram;
  redemptions: LoyaltyHistory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LoyaltyHistory {
  id: string;
  points: number;
  type: 'EARN' | 'REDEEM' | 'ADJUST';
  notes?: string;
  customerId: string;
  customer: Customer;
  saleId?: string;
  sale?: Sale;
  rewardId?: string;
  reward?: LoyaltyReward;
  userId: string;
  user: User;
  createdAt: Date;
}

// ============================================
// PROMOTION TYPES
// ============================================

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED' | 'BUY_GET' | 'FREE_SHIPPING';
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isStackable: boolean;
  applicableProducts?: string[];
  excludedProducts?: string[];
  applicableCategories?: string[];
  companyId: string;
  company?: Company;
  productPromotions: ProductPromotion[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductPromotion {
  promotionId: string;
  productId: string;
  promotion: Promotion;
  product: Product;
}

// ============================================
// CASH REGISTER TYPES
// ============================================

export interface CashRegister {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  cashBalance: number;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  sessions: CashRegisterSession[];
  sales: Sale[];
  payments: Payment[];
  cashTransactions: CashTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CashRegisterSession {
  id: string;
  openedAt: Date;
  closedAt?: Date;
  startingBalance: number;
  endingBalance?: number;
  expectedEndingBalance?: number;
  notes?: string;
  status: 'OPEN' | 'CLOSED' | 'SUSPENDED';
  cashRegisterId: string;
  cashRegister: CashRegister;
  userId: string;
  user: User;
  sales: Sale[];
  payments: Payment[];
  cashTransactions: CashTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CashTransaction {
  id: string;
  type: 'IN' | 'OUT';
  amount: number;
  reason: string;
  notes?: string;
  cashRegisterId: string;
  cashRegister: CashRegister;
  cashRegisterSessionId?: string;
  cashRegisterSession?: CashRegisterSession;
  userId: string;
  user: User;
  createdAt: Date;
}

// ============================================
// PURCHASE ORDER TYPES
// ============================================

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  supplier: Supplier;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';
  total: number;
  notes?: string;
  expectedDelivery?: Date;
  receivedAt?: Date;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
  userId: string;
  user: User;
  items: PurchaseOrderItem[];
  inventoryTransactions: InventoryTransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  purchaseOrder: PurchaseOrder;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  total: number;
  receivedQuantity: number;
  notes?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  email: string;
  phone: string;
  address?: string;
  taxId?: string;
  notes?: string;
  isActive: boolean;
  companyId: string;
  company?: Company;
  purchaseOrders: PurchaseOrder[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// INVOICE & RECEIPT TYPES
// ============================================

export interface Invoice {
  id: string;
  invoiceNumber: string;
  total: number;
  tax: number;
  subtotal: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  dueDate?: Date;
  paidAt?: Date;
  notes?: string;
  companyId: string;
  company?: Company;
  saleId?: string;
  sale?: Sale;
  customerId: string;
  customer: Customer;
  userId: string;
  user: User;
  createdAt: Date;
  updatedAt: Date;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  content?: string;
  format: string;
  sentAt?: Date;
  companyId: string;
  company?: Company;
  saleId?: string;
  sale?: Sale;
  orderId?: string;
  order?: Order;
  createdAt: Date;
}

// ============================================
// AUDIT & NOTIFICATION TYPES
// ============================================

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  userId: string;
  user: User;
  companyId?: string;
  company?: Company;
  createdAt: Date;
}

export interface ShiftLog {
  id: string;
  shiftStart: Date;
  shiftEnd?: Date;
  startingCash: number;
  endingCash?: number;
  expectedCash?: number;
  notes?: string;
  status: 'OPEN' | 'CLOSED';
  userId: string;
  user: User;
  businessUnitId: string;
  businessUnit: BusinessUnit;
  createdAt: Date;
  updatedAt: Date;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  link?: string;
  userId: string;
  user: User;
  companyId?: string;
  company?: Company;
  createdAt: Date;
  readAt?: Date;
}

// ============================================
// REPORT TYPES
// ============================================

export interface Report {
  id: string;
  name: string;
  type: 'SALES' | 'INVENTORY' | 'EMPLOYEE' | 'FINANCIAL' | 'CUSTOMER';
  format: 'PDF' | 'CSV' | 'EXCEL' | 'HTML';
  data: Record<string, any>;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
  startDate?: Date;
  endDate?: Date;
  companyId: string;
  company?: Company;
  userId: string;
  user: User;
  generatedAt: Date;
}

// ============================================
// CART TYPES
// ============================================

export interface CartItem {
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  customerId?: string;
  customer?: Customer;
  businessUnitId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// INVENTORY DTO TYPES (NEW)
// ============================================

export interface CreateItemDto {
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStock?: number;
  maxStock?: number;
  location?: string;
  supplier?: string;
  unitPrice?: number;
  purchaseDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface UpdateItemDto {
  name?: string;
  category?: string;
  quantity?: number;
  unit?: string;
  minStock?: number;
  maxStock?: number;
  location?: string;
  supplier?: string;
  unitPrice?: number;
  purchaseDate?: string;
  expiryDate?: string;
  notes?: string;
}

export interface IssueItemDto {
  issuedTo: string;
  quantity: number;
  purpose?: string;
  remarks?: string;
  expectedReturnDate?: string;
}

export interface ReturnItemDto {
  quantity?: number;
  returnDate?: string;
  remarks?: string;
}

export interface RestockItemDto {
  quantity: number;
  unitPrice?: number;
  supplier?: string;
  purchaseDate?: string;
}

export interface BulkCreateItemsDto {
  items: CreateItemDto[];
}

export interface BulkUpdateStockDto {
  updates: Array<{
    id: string;
    quantity: number;
  }>;
}

export interface ListItemsQueryDto {
  category?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface ListIssuesQueryDto {
  status?: InventoryIssueStatus;
  page?: number;
  limit?: number;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
  path?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SearchParams {
  query?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// ============================================
// STATS TYPES
// ============================================

export interface SalesStats {
  totalSales: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  averageTicket: number;
  totalCustomers?: number;
  topProducts?: Array<{
    productId: string;
    product?: Product;
    totalQuantity: number;
    totalRevenue: number;
  }>;
}

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  lowStockItems: number;
  outOfStockItems: number;
}

export interface CustomerStats {
  totalCustomers: number;
  totalRevenue: number;
  averageSpent: number;
  topCustomers?: Customer[];
}

export interface PaymentSummary {
  totalAmount: number;
  totalCount: number;
  averageAmount: number;
  byMethod: Record<PaymentMethod, number>;
}

// ============================================
// AUTH TYPES
// ============================================

export interface AuthUser {
  id: string;
  clerkId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  businessUnitId?: string;
  businessUnit?: BusinessUnit;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  businessUnitId?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  refreshToken?: string;
}

// ============================================
// ENVIRONMENT TYPES
// ============================================

export interface Environment {
  NEXT_PUBLIC_API_URL: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  NEXT_PUBLIC_APP_NAME: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
  NODE_ENV: 'development' | 'production' | 'test';
}

// ===== Auth =====

// ============================================
// NOTE
// ============================================
// This file used to re-export inferred types from ../schemas and
// ../common at the bottom. Those blocks were removed because:
//   1. They duplicated what ./schemas/index.ts already exports.
//   2. The paths (../../../shared/src/...) were stale after the
//      package moved from api-contract to shared.
// Consume those types via '@pos/shared/schemas' or '@pos/shared'.
// ============================================
