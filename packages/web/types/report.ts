export type ReportType = 'sales' | 'inventory' | 'customers' | 'products' | 'employees' | 'payments' | 'comprehensive' | 'tax';
export type ReportFormat = 'pdf' | 'csv' | 'excel' | 'json' | 'html';
export type ReportGroupBy = 'day' | 'week' | 'month' | 'year';

export interface Report {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  data: Record<string, any>;
  period: string;
  startDate?: string;
  endDate?: string;
  generatedAt: string;
  businessUnitId?: string;
  companyId?: string;
  userId?: string;
  filePath?: string;
  fileSize?: number;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  error?: string;
  createdAt: string;
  updatedAt: string;
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
  trend?: 'up' | 'down' | 'neutral';
}

export interface ScheduledReport {
  id: string;
  reportType: ReportType;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  lastRun?: string;
  nextRun?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportHistory {
  id: string;
  reportId: string;
  generatedAt: string;
  format: ReportFormat;
  fileUrl?: string;
  fileSize?: number;
  status: 'COMPLETED' | 'FAILED';
}

export interface ReportExportOptions {
  format: ReportFormat;
  includeCharts?: boolean;
  includeSummary?: boolean;
  includeData?: boolean;
}

export interface SalesReportData {
  summary: {
    totalRevenue: number;
    totalSales: number;
    averageTicket: number;
    totalItems: number;
    uniqueCustomers: number;
    growthRate: number;
  };
  trends: Array<{
    period: string;
    revenue: number;
    sales: number;
    average: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
    percentage: number;
  }>;
  topCustomers: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    orderCount: number;
  }>;
  paymentMethods: Array<{
    method: string;
    count: number;
    total: number;
    percentage: number;
  }>;
}

export interface InventoryReportData {
  summary: {
    totalItems: number;
    totalValue: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalCategories: number;
  };
  items: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    status: string;
  }>;
  categories: Array<{
    name: string;
    count: number;
    value: number;
  }>;
}

export interface CustomerReportData {
  summary: {
    totalCustomers: number;
    newCustomers: number;
    activeCustomers: number;
    averageSpent: number;
    totalRevenue: number;
  };
  customers: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    totalSpent: number;
    orderCount: number;
    loyaltyPoints: number;
  }>;
}

export interface ProductReportData {
  summary: {
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
    averagePrice: number;
  };
  products: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
    percentage: number;
  }>;
}

export interface EmployeeReportData {
  summary: {
    totalEmployees: number;
    activeEmployees: number;
    totalSales: number;
    totalRevenue: number;
  };
  employees: Array<{
    id: string;
    name: string;
    email: string;
    salesCount: number;
    revenue: number;
    averageTicket: number;
  }>;
}

export interface PaymentReportData {
  summary: {
    totalPayments: number;
    totalAmount: number;
    successfulPayments: number;
    failedPayments: number;
  };
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    status: string;
    date: string;
  }>;
}

export interface ComprehensiveReportData {
  financials: any;
  taxes: any;
  balanceSheet: any;
  sales: SalesReportData;
  inventory: InventoryReportData;
  customers: CustomerReportData;
  generatedAt: string;
}
