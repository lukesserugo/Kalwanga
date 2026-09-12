// D:\Projects\Kalwanga\packages\web\types\index.ts

// ============================================
// ENUMS (single source of truth)
// ============================================
export * from './enums';

// ============================================
// API RESPONSE WRAPPERS
// ============================================

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Array<{ field: string; message: string }>;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  statusCode?: number;
}

// ============================================
// USER / COMPANY / BUSINESS UNIT
// ============================================
export type { User, Company, BusinessUnit, BusinessUnitUser } from './user';

// ============================================
// CATEGORY
// ============================================
export type { Category } from './category';

// ============================================
// PRODUCT
// ============================================
export type { Product, ProductVariant, ProductReview } from './product';

// ============================================
// INVENTORY
// ============================================
export type { Inventory, InventoryTransaction } from './inventory';

export interface InventoryItem {
  id: string;
  inventoryId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitCost?: number;
  totalCost?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAdjustment {
  id: string;
  inventoryId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  type: 'INCREASE' | 'DECREASE';
  reason: string;
  notes?: string;
  userId: string;
  businessUnitId: string;
  createdAt: string;
}

export interface InventoryTransfer {
  id: string;
  transferNumber: string;
  sourceBusinessUnitId: string;
  destinationBusinessUnitId: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  items: InventoryTransferItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransferItem {
  id: string;
  transferId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  receivedQuantity?: number;
}

export interface StockCount {
  id: string;
  countNumber: string;
  businessUnitId: string;
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  items: StockCountItem[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockCountItem {
  id: string;
  stockCountId: string;
  productId: string;
  variantId?: string;
  expectedQuantity: number;
  actualQuantity: number;
  difference: number;
  notes?: string;
}

// ============================================
// SALE
// ============================================
import type { Sale, SaleItem } from './sale';

export interface SaleSearchParams {
  search?: string;
  businessUnitId?: string;
  customerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SaleStats {
  totalSales: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  averageTicket: number;
  topProducts: Array<{
    productId: string;
    quantity: number;
    total: number;
  }>;
}

export interface SalesAnalyticsParams {
  startDate?: string;
  endDate?: string;
  view?: 'daily' | 'weekly' | 'monthly';
  businessUnitId?: string;
}

export interface SalesAnalyticsResponse {
  revenueTrend: Array<{
    date: string;
    revenue: number;
    sales: number;
  }>;
  distribution: Array<{
    name: string;
    value: number;
  }>;
  peakHours: Array<{
    hour: number;
    sales: number;
    revenue: number;
  }>;
  customerInsights: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
  };
  bestCategory: string;
  bestCategorySales: number;
  averageOrderValue: number;
  averageItems: number;
  retentionRate: number;
  conversionRate: number;
  totalVisitors: number;
  topProducts: Array<{
    id: string;
    quantity: number;
    revenue: number;
  }>;
}

export interface SalesSettings {
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
}

export interface DashboardStats {
  totalRevenue: number;
  totalSales: number;
  totalCustomers: number;
  totalProducts: number;
  totalInventory: number;
  recentSales: Sale[];
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesTrend: Array<{
    date: string;
    revenue: number;
  }>;
}

export interface ExportSalesParams {
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
  format: 'CSV' | 'EXCEL' | 'PDF' | 'JSON';
}

// ============================================
// ORDER
// ============================================
export type { Order, OrderItem } from './order';

export interface OrderSearchParams {
  search?: string;
  businessUnitId?: string;
  customerId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  priority?: string;
  paymentStatus?: string;
  minTotal?: number;
  maxTotal?: number;
  includeDeleted?: boolean;
  userId?: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  status: string;
  notes?: string;
  userId: string;
  createdAt: string;
}

// ============================================
// CUSTOMER
// ============================================
export type {
  Customer,
  LoyaltyHistory,
  GiftCard,
  GiftCardTransaction,
} from './customer';

export interface CustomerSearchParams {
  search?: string;
  businessUnitId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CustomerStats {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  totalSpent: number;
  averageSpent: number;
  topCustomers: Array<{
    customerId: string;
    name: string;
    totalSpent: number;
    purchases: number;
  }>;
}

// ============================================
// PAYMENT
// ============================================
export type { Payment, PaymentGateway } from './payment';

export interface PaymentSearchParams {
  search?: string;
  businessUnitId?: string;
  status?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PaymentMethodConfig {
  method: string;
  enabled: boolean;
  displayName: string;
  icon?: string;
  description?: string;
}

export interface PaymentGatewayConfig {
  gateway: string;
  enabled: boolean;
  testMode: boolean;
  credentials: Record<string, string>;
}

export interface PaymentWebhook {
  id: string;
  gateway: string;
  event: string;
  payload: Record<string, any>;
  processed: boolean;
  createdAt: string;
}

export interface Refund {
  id: string;
  refundNumber: string;
  saleId: string;
  amount: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  method: string;
  createdAt: string;
  processedAt?: string;
}

// ============================================
// RETURN & REFUND
// ============================================
export interface Return {
  id: string;
  returnNumber: string;
  saleId: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'CANCELLED';
  returnType: 'FULL' | 'PARTIAL';
  refundMethod: string;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  createdAt: string;
  processedAt?: string;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  reason?: string;
  condition?: string;
}

export interface ReturnFilters {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
}

export interface ReturnStats {
  totalReturns: number;
  totalRefunded: number;
  averageRefund: number;
  pendingReturns: number;
  processedReturns: number;
}

export interface RefundItem {
  id: string;
  refundId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface RefundFilters {
  search?: string;
  status?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
}

export interface RefundStats {
  totalRefunds: number;
  totalAmount: number;
  averageAmount: number;
  pendingRefunds: number;
  completedRefunds: number;
}

// ============================================
// INVOICE & RECEIPT
// ============================================
export type { Invoice, Receipt } from './invoice';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  variantId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceFilters {
  search?: string;
  status?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  businessUnitId?: string;
}

export interface InvoiceStats {
  totalInvoices: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  overdueAmount: number;
  averageInvoice: number;
}

export interface ReceiptItem {
  id: string;
  receiptId: string;
  productId: string;
  variantId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptFilters {
  search?: string;
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReceiptStats {
  totalReceipts: number;
  totalAmount: number;
  printedReceipts: number;
  emailedReceipts: number;
}

export type InvoicePaymentTerms =
  | 'NET_7'
  | 'NET_15'
  | 'NET_30'
  | 'NET_60'
  | 'DUE_ON_RECEIPT';

// ============================================
// SUPPLIER
// ============================================
export type {
  Supplier,
  SupplierContact,
  SupplierProduct,
  PurchaseOrder,
  PurchaseOrderItem,
  SupplierPayment,
  SupplierRating,
  SupplierSearchParams,
} from './supplier';

// ============================================
// CART
// ============================================
export type { Cart, CartItem } from './cart';

export interface CartSummary {
  items: number;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

// ============================================
// REGISTER + SHIFT
// (single source of truth: ./register)
// ============================================

// Cash register
export type {
  CashRegister,
  CashRegisterStatus,
  CashRegisterSession,
  CashRegisterSessionStatus,
  Register,
} from './register';

// Cash / shift primitives
export type {
  CashTransaction,
  CashTransactionType,
  CashTransactionPayload,
  ShiftLog,
} from './register';

// Shift
export type {
  Shift,
  ShiftStatus,
  ShiftType,
  ShiftScope,
  ShiftStats,
  ShiftSummary,
} from './register';

// Query params
export type {
  ShiftSearchParams,
  ShiftStatsParams,
  RegisterSearchParams,
} from './register';

// Mutation payloads
export type {
  StartShiftPayload,
  EndShiftPayload,
  CreateRegisterPayload,
  UpdateRegisterPayload,
} from './register';

// Response envelopes
export type {
  RegistersListResponse,
  ShiftsListResponse,
} from './register';

// ============================================
// BOOKKEEPING
// ============================================
export type {
  Account,
  JournalEntry,
  JournalLine,
  TaxRecord,
  FinancialReport,
  TrialBalance,
  BalanceSheet,
  IncomeStatement,
} from './bookkeeping';

export interface CashFlowStatement {
  operatingActivities: number;
  investingActivities: number;
  financingActivities: number;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
  period: string;
}

export interface LedgerEntry {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  journalEntryId: string;
}

// ============================================
// SEARCH
// ============================================
export type {
  SearchParams,
  UserSearchParams,
  ProductSearchParams,
  InventorySearchParams,
  PurchaseOrderSearchParams,
  ReportSearchParams,
} from './search';

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// DASHBOARD
// ============================================
export type {
  DashboardStats as DashboardStatsType,
  SalesStats as SalesStatsType,
  CustomerStats as CustomerStatsType,
  InventoryStats as InventoryStatsType,
  RealtimeData,
  SalesTrend,
  TopProduct,
  CustomerInsight,
  ActivityItem,
} from './dashboard';

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  position: number;
  config: DashboardWidgetConfig;
}

export interface DashboardWidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'area';
  dataSource?: string;
  refreshInterval?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
}

// ============================================
// REPORT
// ============================================
export interface Report {
  id: string;
  name: string;
  type: string;
  format: string;
  data: Record<string, any>;
  period: string;
  startDate?: string;
  endDate?: string;
  generatedAt: string;
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greater' | 'less' | 'between';
  value: any;
}

export interface ReportData {
  [key: string]: any;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  sortable?: boolean;
  filterable?: boolean;
}

export interface ReportChart {
  type: 'line' | 'bar' | 'pie' | 'area';
  data: any[];
  options?: Record<string, any>;
}

export interface ReportSummary {
  label: string;
  value: number | string;
  change?: number;
}

export interface ScheduledReport {
  id: string;
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  lastRun?: string;
  nextRun?: string;
}

export interface ReportHistory {
  id: string;
  reportId: string;
  generatedAt: string;
  format: string;
  fileUrl?: string;
}

export interface ReportExportOptions {
  format: 'PDF' | 'CSV' | 'EXCEL' | 'JSON' | 'HTML';
  includeCharts?: boolean;
  includeSummary?: boolean;
}

// ============================================
// EXPORT
// ============================================
export interface ExportFilter {
  field: string;
  value: any;
}

export interface ExportHistory {
  id: string;
  fileName: string;
  format: string;
  size: number;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'SCHEDULED';
  downloadUrl?: string;
  createdAt: string;
}

export interface ExportStats {
  totalExports: number;
  completedExports: number;
  failedExports: number;
  averageSize: number;
}

export type ExportFormatType = 'CSV' | 'EXCEL' | 'JSON' | 'PDF' | 'XML';
export type ExportStatusType =
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SCHEDULED';

export interface ExportOptions {
  format: ExportFormatType;
  includeHeaders?: boolean;
  dateRange?: DateRangeParams;
}

export interface ExportSchedule {
  id: string;
  exportType: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  lastRun?: string;
  nextRun?: string;
}

// ============================================
// NOTIFICATION
// ============================================
export type {
  Notification,
  NotificationPreference,
  NotificationTemplate,
  NotificationGroup,
  NotificationStats,
} from './notification';

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
  enabled: boolean;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED' | 'READ';
  sentAt?: string;
  deliveredAt?: string;
}

// ============================================
// PERMISSIONS
// ============================================
export type { PERMISSIONS, ROLE_PERMISSIONS } from './permissions';

export interface Permission {
  action: string;
  resource: string;
  description?: string;
}

export interface PermissionCheck {
  action: string;
  resource: string;
  allowed: boolean;
}

export interface RolePermissions {
  role: string;
  permissions: Permission[];
}

export interface UserPermissionsType {
  userId: string;
  permissions: Permission[];
}

export type PermissionActionType =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'export'
  | 'import';

export type PermissionResourceType =
  | 'products'
  | 'categories'
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'users'
  | 'reports'
  | 'settings';

// ============================================
// AUTH
// ============================================
export type { Session } from './auth';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  avatar?: string;
  phoneNumber?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  companyName?: string;
}

export interface ResetPasswordData {
  email: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface Token {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

// ============================================
// FORM
// ============================================
export interface FormField {
  name: string;
  label: string;
  type:
    | 'text'
    | 'number'
    | 'email'
    | 'password'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'radio'
    | 'date'
    | 'time'
    | 'file';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: Array<{ label: string; value: string }>;
  validation?: FormValidation;
}

export interface FormSection {
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormStep {
  title: string;
  description?: string;
  sections: FormSection[];
}

export interface FormValidation {
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  message?: string;
}

export interface FormError {
  field: string;
  message: string;
}

export interface FormState {
  values: Record<string, any>;
  errors: FormError[];
  isSubmitting: boolean;
  isDirty: boolean;
  isValid: boolean;
}

export interface FormSubmit {
  onSubmit: (values: Record<string, any>) => void;
  onError?: (errors: FormError[]) => void;
}

export interface FormConfig {
  steps: FormStep[];
  initialValues?: Record<string, any>;
  onSubmit: FormSubmit;
}

// ============================================
// TABLE
// ============================================
export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: TableRow) => React.ReactNode;
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

export interface TableSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface TableFilter {
  column: string;
  value: any;
}

export interface TablePagination {
  page: number;
  limit: number;
  total: number;
}

export interface TableSelection {
  selectedIds: string[];
  onSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
}

export interface TableAction {
  label: string;
  icon?: React.ReactNode;
  onClick: (row: TableRow) => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface TableConfig {
  columns: TableColumn[];
  data: TableRow[];
  pagination?: TablePagination;
  sort?: TableSort;
  filters?: TableFilter[];
  selection?: TableSelection;
  actions?: TableAction[];
  loading?: boolean;
}

// ============================================
// CHART
// ============================================
export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    fill?: boolean;
  }>;
}

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  animation?: boolean;
}

export interface ChartAxis {
  label: string;
  min?: number;
  max?: number;
  ticks?: number;
}

export interface ChartLegend {
  position: 'top' | 'bottom' | 'left' | 'right';
  show: boolean;
}

export interface ChartTooltip {
  show: boolean;
  format?: (value: number) => string;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'area' | 'radar';
  data: ChartData | ChartSeries[];
  options?: ChartOptions;
  axis?: {
    x?: ChartAxis;
    y?: ChartAxis;
  };
  legend?: ChartLegend;
  tooltip?: ChartTooltip;
}

export type ChartType =
  | 'line'
  | 'bar'
  | 'pie'
  | 'doughnut'
  | 'area'
  | 'radar';

// ============================================
// COMMON STATISTICS
// ============================================
export interface BaseStats {
  total: number;
  count: number;
  average: number;
  min: number;
  max: number;
  sum: number;
}

export interface TimeSeriesStats extends BaseStats {
  period: string;
  previousPeriod?: number;
  change?: number;
  percentageChange?: number;
}

export interface CategoryStats {
  category: string;
  count: number;
  total: number;
  percentage: number;
}

export interface MethodStats {
  method: string;
  count: number;
  total: number;
  percentage: number;
}

export interface BaseFilter {
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  businessUnitId?: string;
  limit?: number;
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============================================
// HELPER TYPE UTILITIES
// ============================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

export type PickRequired<T, K extends keyof T> = Required<Pick<T, K>> &
  Omit<T, K>;

export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

export type Awaited<T> = T extends Promise<infer U> ? U : T;

export type ArrayElement<T> = T extends (infer U)[] ? U : never;

export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

export type ValueOf<T> = T[keyof T];

export type KeysOfType<T, U> = {
  [P in keyof T]: T[P] extends U ? P : never;
}[keyof T];
