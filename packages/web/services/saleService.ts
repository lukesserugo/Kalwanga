// D:\Projects\Kalwanga\packages\web\services\saleService.ts

import { api } from './api';
import type { Sale, SaleStatus } from '../types/sale';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SaleSearchParams {
  page?: number;
  limit?: number;
  search?: string;
  businessUnitId?: string;
  customerId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  status?: SaleStatus | string;
  paymentMethod?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  minAmount?: number;
  maxAmount?: number;
  includeDeleted?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  stats?: SalesStats;
}

export interface SalesStats {
  // Core stats
  totalSales: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  averageTicket: number;
  
  // Today's stats
  todayRevenue: number;
  todaySales: number;
  
  // Order status breakdown
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  onHoldOrders: number;
  
  // Product stats
  topProducts: Array<{
    productId: string;
    productName?: string;
    productSku?: string;
    quantity: number;
    total: number;
  }>;
  totalItemsSold: number;
  
  // Customer stats
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  repeatRate: number;
  
  // Additional metrics
  averageItemsPerSale: number;
  totalVisitors: number;
  conversionRate: number;
}

// Sales analytics types
export interface SalesAnalyticsParams {
  startDate?: string;
  endDate?: string;
  view?: 'daily' | 'weekly' | 'monthly' | 'hourly';
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
    repeatRate: number;
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
    name: string;
    quantity: number;
    revenue: number;
  }>;
  totalSales: number;
  totalRevenue: number;
}

// Sales settings types
export interface SalesSettings {
  id?: string;
  companyId?: string;
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
  createdAt?: string;
  updatedAt?: string;
}

// Dashboard stats types - UPDATED to include missing properties
export interface DashboardStats {
  today: {
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
  };
  week: {
    totalSales: number;
    totalRevenue: number;
  };
  month: {
    totalSales: number;
    totalRevenue: number;
  };
  allTime: SalesStats;
  recentSales: Sale[];
  // Added missing properties
  topProducts: Array<{
    id: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByHour: Array<{
    hour: number;
    sales: number;
    revenue: number;
  }>;
  salesByDay: Array<{
    day: string;
    sales: number;
    revenue: number;
  }>;
}

export interface DailySalesSummary {
  date: string;
  totalSales: number;
  totalRevenue: number;
  totalItems: number;
  averageTicket: number;
  paymentMethods: Array<{
    method: string;
    count: number;
    total: number;
    percentage: number;
  }>;
  hourlyBreakdown: Array<{
    hour: number;
    count: number;
    revenue: number;
  }>;
  sales: Sale[];
}

// Export params
export interface ExportSalesParams {
  businessUnitId?: string;
  startDate: string;
  endDate: string;
  format?: 'json' | 'csv' | 'excel' | 'pdf';
}

// ============================================
// POS TYPES
// ============================================

export interface CartItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    images: string[];
  };
  variantId?: string;
  variant?: {
    id: string;
    name: string;
    sku: string;
    price: number;
    attributes: any;
  };
  quantity: number;
  unitPrice: number;
  total: number;
  notes?: string;
  availableStock: number;
  isInStock: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  promotionCode?: string;
  promotionDiscount?: number;
  loyaltyPointsUsed?: number;
  loyaltyDiscount?: number;
  total: number;
  customerId?: string;
  customer?: any;
  businessUnitId: string;
  userId: string;
  notes?: string;
  status: 'ACTIVE' | 'SAVED' | 'CHECKED_OUT' | 'ABANDONED';
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface PosCheckoutData {
  cartId: string;
  paymentMethod: string;
  paidAmount: number;
  customerId?: string;
  discount?: number;
  notes?: string;
  cashRegisterId?: string;
  cashRegisterSessionId?: string;
  applyLoyaltyPoints?: boolean;
  tipAmount?: number;
}

export interface PosSummary {
  cartCount: number;
  itemCount: number;
  totalValue: number;
  averageTicket: number;
  todaySales: number;
  todayRevenue: number;
  activeCarts: number;
  abandonedCarts: number;
}

export interface RegisterStatus {
  id: string;
  name: string;
  balance: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING' | 'SUSPENDED';
  transactions: number;
  cashIn: number;
  cashOut: number;
  sessionId?: string;
  openedAt?: string;
  closedAt?: string;
}

// ============================================
// SALE SERVICE
// ============================================

export const saleService = {
  // ============================================
  // SALES METHODS - GET
  // ============================================

  /**
   * Get all sales with pagination and filters
   * GET /sales
   */
  async getAllSales(params?: SaleSearchParams): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>('/sales', { params });
    return response;
  },

  /**
   * Get sale by ID
   * GET /sales/:id
   */
  async getSaleById(id: string): Promise<Sale> {
    const response = await api.get<Sale>(`/sales/${id}`);
    return response;
  },

  /**
   * Get sale by receipt number
   * GET /sales/receipt/:receiptNumber
   */
  async getSaleByReceiptNumber(receiptNumber: string): Promise<Sale> {
    const response = await api.get<Sale>(`/sales/receipt/${receiptNumber}`);
    return response;
  },

  /**
   * Get sale by invoice number
   * GET /sales/invoice/:invoiceNumber
   */
  async getSaleByInvoiceNumber(invoiceNumber: string): Promise<Sale> {
    const response = await api.get<Sale>(`/sales/invoice/${invoiceNumber}`);
    return response;
  },

  /**
   * Get sales by customer
   * GET /sales/customer/:customerId
   */
  async getSalesByCustomer(
    customerId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/customer/${customerId}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by customer email
   * GET /sales/customer-email/:email
   */
  async getSalesByCustomerEmail(
    email: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/customer-email/${encodeURIComponent(email)}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by customer phone
   * GET /sales/customer-phone/:phone
   */
  async getSalesByCustomerPhone(
    phone: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/customer-phone/${encodeURIComponent(phone)}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by user
   * GET /sales/user/:userId
   */
  async getSalesByUser(
    userId: string,
    params?: { page?: number; limit?: number; startDate?: string; endDate?: string }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/user/${userId}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by business unit
   * GET /sales/business-unit/:businessUnitId
   */
  async getSalesByBusinessUnit(
    businessUnitId: string,
    params?: { page?: number; limit?: number; startDate?: string; endDate?: string }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/business-unit/${businessUnitId}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by status
   * GET /sales/status/:status
   */
  async getSalesByStatus(
    status: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/status/${status}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by date
   * GET /sales/date/:date
   */
  async getSalesByDate(
    date: string,
    params?: { businessUnitId?: string; page?: number; limit?: number }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/date/${date}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by date range
   * GET /sales/date-range
   */
  async getSalesByDateRange(params: {
    businessUnitId?: string;
    startDate: string;
    endDate: string;
  }): Promise<Sale[]> {
    const response = await api.get<Sale[]>('/sales/date-range', { params });
    return response;
  },

  /**
   * Get sales by payment method
   * GET /sales/payment-methods
   */
  async getSalesByPaymentMethod(params?: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Array<{
    paymentMethod: string;
    count: number;
    total: number;
    average: number;
    percentage: number;
  }>> {
    const response = await api.get<any[]>('/sales/payment-methods', { params });
    return response;
  },

  /**
   * Get sales by product
   * GET /sales/product/:productId
   */
  async getSalesByProduct(
    productId: string,
    params?: {
      businessUnitId?: string;
      variantId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
    }
  ): Promise<{
    items: Array<{
      date: string;
      quantity: number;
      revenue: number;
      customerName: string;
      customerEmail: string;
      variantName: string;
    }>;
    totalQuantity: number;
    totalRevenue: number;
    averagePrice: number;
  }> {
    const response = await api.get<any>(`/sales/product/${productId}`, { params });
    return response;
  },

  /**
   * Get sales by cash register
   * GET /sales/cash-register/:cashRegisterId
   */
  async getSalesByCashRegister(
    cashRegisterId: string,
    params?: { page?: number; limit?: number; startDate?: string; endDate?: string }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/cash-register/${cashRegisterId}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by cash register session
   * GET /sales/cash-register-session/:sessionId
   */
  async getSalesByCashRegisterSession(
    sessionId: string,
    params?: { page?: number; limit?: number }
  ): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>(
      `/sales/cash-register-session/${sessionId}`,
      { params }
    );
    return response;
  },

  /**
   * Get sales by order
   * GET /sales/order/:orderId
   */
  async getSalesByOrder(orderId: string): Promise<Sale[]> {
    const response = await api.get<Sale[]>(`/sales/order/${orderId}`);
    return response;
  },

  /**
   * Get sales by payment
   * GET /sales/payment/:paymentId
   */
  async getSalesByPayment(paymentId: string): Promise<Sale[]> {
    const response = await api.get<Sale[]>(`/sales/payment/${paymentId}`);
    return response;
  },

  /**
   * Get sales by month
   * GET /sales/monthly/:year/:month
   */
  async getSalesByMonth(
    year: number,
    month: number,
    params?: { businessUnitId?: string }
  ): Promise<{
    data: Sale[];
    total: number;
    revenue: number;
    average: number;
  }> {
    const response = await api.get<any>(`/sales/monthly/${year}/${month}`, { params });
    return response;
  },

  /**
   * Get sales by year
   * GET /sales/yearly/:year
   */
  async getSalesByYear(
    year: number,
    params?: { businessUnitId?: string }
  ): Promise<{
    data: Sale[];
    total: number;
    revenue: number;
    average: number;
    monthlyBreakdown: Array<{ month: number; revenue: number; sales: number }>;
  }> {
    const response = await api.get<any>(`/sales/yearly/${year}`, { params });
    return response;
  },

  /**
   * Get sales by week
   * GET /sales/weekly/:year/:week
   */
  async getSalesByWeek(
    year: number,
    week: number,
    params?: { businessUnitId?: string }
  ): Promise<{
    data: Sale[];
    total: number;
    revenue: number;
    average: number;
    dailyBreakdown: Array<{ day: string; revenue: number; sales: number }>;
  }> {
    const response = await api.get<any>(`/sales/weekly/${year}/${week}`, { params });
    return response;
  },

  /**
   * Get sales by quarter
   * GET /sales/quarterly/:year/:quarter
   */
  async getSalesByQuarter(
    year: number,
    quarter: number,
    params?: { businessUnitId?: string }
  ): Promise<{
    data: Sale[];
    total: number;
    revenue: number;
    average: number;
    monthlyBreakdown: Array<{ month: number; revenue: number; sales: number }>;
  }> {
    const response = await api.get<any>(`/sales/quarterly/${year}/${quarter}`, { params });
    return response;
  },

  /**
   * Get sales by time period
   * GET /sales/period/:period
   */
  async getSalesByPeriod(
    period: 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year',
    params?: { businessUnitId?: string; date?: string }
  ): Promise<{
    data: Sale[];
    total: number;
    revenue: number;
    average: number;
    comparison: {
      previousPeriod: number;
      percentageChange: number;
    };
  }> {
    const response = await api.get<any>(`/sales/period/${period}`, { params });
    return response;
  },

  /**
   * Get recent sales
   * GET /sales/recent
   */
  async getRecentSales(params?: {
    businessUnitId?: string;
    limit?: number;
  }): Promise<Sale[]> {
    const response = await api.get<Sale[]>('/sales/recent', { params });
    return response;
  },

  /**
   * Get sales count
   * GET /sales/count
   */
  async getSalesCount(params?: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<{ total: number }> {
    const response = await api.get<{ total: number }>('/sales/count', { params });
    return response;
  },

  // ============================================
  // STATISTICS & ANALYTICS
  // ============================================

  /**
   * Get sales statistics
   * GET /sales/stats
   */
  async getSalesStats(params?: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<SalesStats> {
    const response = await api.get<SalesStats>('/sales/stats', { params });
    return response;
  },

  /**
   * Get daily sales summary
   * GET /sales/daily-summary
   */
  async getDailySalesSummary(params: {
    businessUnitId?: string;
    date: string;
  }): Promise<DailySalesSummary> {
    const response = await api.get<DailySalesSummary>('/sales/daily-summary', { params });
    return response;
  },

  /**
   * Get today's sales summary
   * GET /sales/today
   */
  async getTodaySalesSummary(params?: { businessUnitId?: string }): Promise<{
    date: string;
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    totalCustomers: number;
    paymentBreakdown: Record<string, number>;
  }> {
    const response = await api.get<any>('/sales/today', { params });
    return response;
  },

  /**
   * Get dashboard sales data
   * GET /sales/dashboard
   */
  async getDashboardSalesData(params?: {
    businessUnitId?: string;
  }): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/sales/dashboard', { params });
    return response;
  },

  /**
   * Get sales analytics
   * GET /sales/analytics
   */
  async getSalesAnalytics(params?: SalesAnalyticsParams): Promise<SalesAnalyticsResponse> {
    const response = await api.get<SalesAnalyticsResponse>('/sales/analytics', { params });
    return response;
  },

  /**
   * Get sales forecast
   * GET /sales/forecast
   */
  async getSalesForecast(params?: {
    businessUnitId?: string;
    days?: number;
  }): Promise<{
    forecast: Array<{ date: string; predicted: number; confidence: number }>;
    trend: 'up' | 'down' | 'stable';
    growthRate: number;
  }> {
    const response = await api.get<any>('/sales/forecast', { params });
    return response;
  },

  /**
   * Get sales comparison
   * GET /sales/compare
   */
  async getSalesComparison(params: {
    businessUnitId?: string;
    period1Start: string;
    period1End: string;
    period2Start: string;
    period2End: string;
  }): Promise<{
    period1: { revenue: number; sales: number; average: number };
    period2: { revenue: number; sales: number; average: number };
    difference: { revenue: number; sales: number; average: number };
    percentageChange: { revenue: number; sales: number; average: number };
  }> {
    const response = await api.get<any>('/sales/compare', { params });
    return response;
  },

  /**
   * Get sales summary by period
   * GET /sales/summary
   */
  async getSalesSummary(params?: {
    businessUnitId?: string;
    period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    date?: string;
  }): Promise<{
    period: string;
    startDate: string;
    endDate: string;
    totalRevenue: number;
    totalSales: number;
    averageTicket: number;
    totalItems: number;
    uniqueCustomers: number;
    topCategory: string;
    topProduct: string;
  }> {
    const response = await api.get<any>('/sales/summary', { params });
    return response;
  },

  /**
   * Get sales summary by date range
   * GET /sales/summary/range
   */
  async getSalesSummaryByDateRange(params: {
    businessUnitId?: string;
    startDate: string;
    endDate: string;
  }): Promise<{
    totalRevenue: number;
    totalSales: number;
    averageTicket: number;
    totalItems: number;
    uniqueCustomers: number;
    topProducts: Array<{ productId: string; name: string; quantity: number; revenue: number }>;
    paymentBreakdown: Record<string, { count: number; total: number }>;
  }> {
    const response = await api.get<any>('/sales/summary/range', { params });
    return response;
  },

  /**
   * Get sales report by period
   * GET /sales/reports/period
   */
  async getSalesReportByPeriod(params?: {
    businessUnitId?: string;
    period?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    date?: string;
  }): Promise<{
    period: string;
    startDate: string;
    endDate: string;
    totalRevenue: number;
    totalSales: number;
    averageTicket: number;
    growthRate: number;
    previousRevenue: number;
    paymentMethods: Record<string, number>;
    dailyBreakdown: Array<{ date: string; revenue: number; count: number; items: number }>;
    sales: Sale[];
  }> {
    const response = await api.get<any>('/sales/reports/period', { params });
    return response;
  },

  /**
   * Get aggregated sales data
   * GET /sales/aggregate
   */
  async getAggregatedSales(params: {
    businessUnitId?: string;
    startDate: string;
    endDate: string;
    groupBy?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<Array<{
    group: string;
    date: string;
    revenue: number;
    sales: number;
    average: number;
    items: number;
  }>> {
    const response = await api.get<any[]>('/sales/aggregate', { params });
    return response;
  },

  /**
   * Get abandoned carts
   * GET /sales/abandoned-carts
   */
  async getAbandonedCarts(params?: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
    minValue?: number;
    hours?: number;
  }): Promise<Array<{
    id: string;
    items: any[];
    itemCount: number;
    total: number;
    customerId?: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    createdAt: string;
    updatedAt: string;
    status: string;
    abandonmentAge: number;
  }>> {
    const response = await api.get<any[]>('/sales/abandoned-carts', { params });
    return response;
  },

  /**
   * Get customer sales stats
   * GET /sales/customer-stats/:customerId
   */
  async getCustomerSalesStats(customerId: string): Promise<{
    customer: {
      id: string;
      name: string;
      email: string;
      loyaltyPoints: number;
      loyaltyLevel: string;
    };
    totalSpent: number;
    totalPurchases: number;
    averageTicket: number;
    firstPurchase: string | null;
    lastPurchase: string | null;
    favoriteCategory: string;
    favoriteProduct: string;
    monthlyTrend: Array<{ month: string; revenue: number; count: number }>;
    recentPurchases: Array<{
      receiptNumber: string;
      total: number;
      date: string;
      items: number;
    }>;
  }> {
    const response = await api.get<any>(`/sales/customer-stats/${customerId}`);
    return response;
  },

  // ============================================
  // SALES SETTINGS
  // ============================================

  /**
   * Get sales settings
   * GET /sales/settings
   */
  async getSalesSettings(companyId?: string): Promise<SalesSettings> {
    const params = companyId ? { companyId } : undefined;
    const response = await api.get<SalesSettings>('/sales/settings', { params });
    return response;
  },

  /**
   * Update sales settings
   * PUT /sales/settings
   */
  async updateSalesSettings(settings: Partial<SalesSettings>, companyId?: string): Promise<SalesSettings> {
    const params = companyId ? { companyId } : undefined;
    const response = await api.put<SalesSettings>('/sales/settings', settings, { params });
    return response;
  },

  // ============================================
  // SALE OPERATIONS - POST
  // ============================================

  /**
   * Create sale
   * POST /sales
   */
  async createSale(data: {
    customerId?: string;
    items: Array<{ productId: string; variantId?: string; quantity: number; unitPrice: number }>;
    paymentMethod: string;
    paidAmount: number;
    discount?: number;
    notes?: string;
    businessUnitId?: string;
    cashRegisterId?: string;
    cashRegisterSessionId?: string;
    tipAmount?: number;
    loyaltyPointsUsed?: number;
  }): Promise<Sale> {
    const response = await api.post<Sale>('/sales', data);
    return response;
  },

  /**
   * Create sale from cart
   * POST /sales/checkout
   */
  async createSaleFromCart(data: {
    cartId: string;
    paymentMethod: string;
    paidAmount: number;
    cashRegisterId?: string;
    cashRegisterSessionId?: string;
    customerId?: string;
    discount?: number;
    notes?: string;
    applyLoyaltyPoints?: boolean;
    tipAmount?: number;
  }): Promise<Sale> {
    const response = await api.post<Sale>('/sales/checkout', data);
    return response;
  },

  /**
   * Create sale from POS
   * POST /sales/pos
   */
  async createSaleFromPos(data: {
    cartId: string;
    paymentMethod: string;
    paidAmount: number;
    cashRegisterId?: string;
    cashRegisterSessionId?: string;
    customerId?: string;
    discount?: number;
    notes?: string;
    applyLoyaltyPoints?: boolean;
    tipAmount?: number;
  }): Promise<Sale> {
    const response = await api.post<Sale>('/sales/pos', data);
    return response;
  },

  /**
   * Refund sale
   * POST /sales/:id/refund
   */
  async refundSale(id: string, reason?: string, amount?: number, items?: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
    reason?: string;
  }>): Promise<{
    refund: any;
    sale: Sale;
  }> {
    const response = await api.post<any>(`/sales/${id}/refund`, { reason, amount, items });
    return response;
  },

  /**
   * Process return
   * POST /sales/:id/return
   */
  async processReturn(id: string, data: {
    reason: string;
    items?: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      reason?: string;
    }>;
  }): Promise<{
    return: any;
    sale: Sale;
  }> {
    const response = await api.post<any>(`/sales/${id}/return`, data);
    return response;
  },

  /**
   * Cancel sale
   * POST /sales/:id/cancel
   */
  async cancelSale(id: string, reason?: string): Promise<Sale> {
    const response = await api.post<Sale>(`/sales/${id}/cancel`, { reason });
    return response;
  },

  /**
   * Void sale
   * POST /sales/:id/void
   */
  async voidSale(id: string, reason?: string): Promise<Sale> {
    const response = await api.post<Sale>(`/sales/${id}/void`, { reason });
    return response;
  },

  /**
   * Hold sale
   * POST /sales/:id/hold
   */
  async holdSale(id: string): Promise<Sale> {
    const response = await api.post<Sale>(`/sales/${id}/hold`);
    return response;
  },

  /**
   * Resume held sale
   * POST /sales/:id/resume
   */
  async resumeSale(id: string): Promise<Sale> {
    const response = await api.post<Sale>(`/sales/${id}/resume`);
    return response;
  },

  /**
   * Apply discount to sale
   * POST /sales/:id/discount
   */
  async applyDiscount(id: string, discount: number, discountType?: 'PERCENTAGE' | 'FIXED'): Promise<Sale> {
    const response = await api.post<Sale>(`/sales/${id}/discount`, { discount, discountType });
    return response;
  },

  /**
   * Remove discount from sale
   * DELETE /sales/:id/discount
   */
  async removeDiscount(id: string): Promise<Sale> {
    const response = await api.delete<Sale>(`/sales/${id}/discount`);
    return response;
  },

  /**
   * Send receipt email
   * POST /sales/:id/email-receipt
   */
  async sendReceiptEmail(id: string, email: string): Promise<{
    saleId: string;
    receiptNumber: string;
    email: string;
    sent: boolean;
    timestamp: string;
  }> {
    const response = await api.post<any>(`/sales/${id}/email-receipt`, { email });
    return response;
  },

  /**
   * Resend receipt email
   * POST /sales/:id/resend-receipt
   */
  async resendReceiptEmail(id: string): Promise<{
    saleId: string;
    receiptNumber: string;
    email: string;
    sent: boolean;
    timestamp: string;
  }> {
    const response = await api.post<any>(`/sales/${id}/resend-receipt`);
    return response;
  },

  // ============================================
  // SALE OPERATIONS - PUT/PATCH
  // ============================================

  /**
   * Update sale
   * PUT /sales/:id
   */
  async updateSale(id: string, data: Partial<Sale>): Promise<Sale> {
    const response = await api.put<Sale>(`/sales/${id}`, data);
    return response;
  },

  /**
   * Update sale status
   * PATCH /sales/:id/status
   */
  async updateSaleStatus(id: string, status: SaleStatus): Promise<Sale> {
    const response = await api.patch<Sale>(`/sales/${id}/status`, { status });
    return response;
  },

  /**
   * Update sale notes
   * PATCH /sales/:id/notes
   */
  async updateSaleNotes(id: string, notes: string): Promise<Sale> {
    const response = await api.patch<Sale>(`/sales/${id}/notes`, { notes });
    return response;
  },

  /**
   * Bulk update sales status
   * PATCH /sales/bulk-status
   */
  async bulkUpdateStatus(
    saleIds: string[],
    status: string
  ): Promise<{ updated: number; failed: number }> {
    const response = await api.patch<{ updated: number; failed: number }>(
      '/sales/bulk-status',
      { saleIds, status }
    );
    return response;
  },

  // ============================================
  // SALE OPERATIONS - DELETE
  // ============================================

  /**
   * Delete sale (soft delete)
   * DELETE /sales/:id
   */
  async deleteSale(id: string): Promise<Sale> {
    const response = await api.delete<Sale>(`/sales/${id}`);
    return response;
  },

  /**
   * Bulk delete sales
   * DELETE /sales/bulk
   */
  async bulkDeleteSales(saleIds: string[]): Promise<{ deleted: number; failed: number }> {
    const response = await api.delete<{ deleted: number; failed: number }>('/sales/bulk', {
      data: { saleIds }
    });
    return response;
  },

  // ============================================
  // EXPORT METHODS
  // ============================================

  /**
   * Export sales
   * GET /sales/export
   */
  async exportSales(params: ExportSalesParams): Promise<{
    data: any[];
    total: number;
    period: { startDate: string; endDate: string };
    summary: {
      totalRevenue: number;
      totalSales: number;
      averageTicket: number;
      totalItems: number;
    };
    format: string;
    generatedAt: string;
  }> {
    const response = await api.get<any>('/sales/export', { params });
    return response;
  },

  /**
   * Export sales to CSV
   * GET /sales/export/csv
   */
  async exportSalesCsv(params: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const response = await api.download('/sales/export/csv', { params });
    return response;
  },

  /**
   * Export sales to Excel
   * GET /sales/export/excel
   */
  async exportSalesExcel(params: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const response = await api.download('/sales/export/excel', { params });
    return response;
  },

  /**
   * Export sales to PDF
   * GET /sales/export/pdf
   */
  async exportSalesPdf(params: {
    businessUnitId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const response = await api.download('/sales/export/pdf', { params });
    return response;
  },

  /**
   * Get sale receipt for printing
   * GET /sales/:id/print-receipt
   */
  async printReceipt(id: string): Promise<Blob> {
    const response = await api.download(`/sales/${id}/print-receipt`);
    return response;
  },

  /**
   * Export individual sale
   * GET /sales/export/:id
   */
  async exportSale(id: string, format: 'pdf' | 'csv' = 'pdf'): Promise<Blob> {
    const response = await api.download(`/sales/export/${id}`, { params: { format } });
    return response;
  },

  // ============================================
  // RECEIPTS & INVOICES
  // ============================================

  /**
   * Get sale receipt
   * GET /sales/:id/receipt
   */
  async getSaleReceipt(id: string): Promise<any> {
    const response = await api.get<any>(`/sales/${id}/receipt`);
    return response;
  },

  /**
   * Get receipts
   * GET /sales/receipts
   */
  async getReceipts(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<any>> {
    const response = await api.get<PaginatedResponse<any>>('/sales/receipts', { params });
    return response;
  },

  /**
   * Get invoices
   * GET /sales/invoices
   */
  async getInvoices(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<any>> {
    const response = await api.get<PaginatedResponse<any>>('/sales/invoices', { params });
    return response;
  },

  /**
   * Get returns
   * GET /sales/returns
   */
  async getReturns(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>('/sales/returns', { params });
    return response;
  },

  /**
   * Get refunds
   * GET /sales/refunds
   */
  async getRefunds(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Sale>> {
    const response = await api.get<PaginatedResponse<Sale>>('/sales/refunds', { params });
    return response;
  },

  // ============================================
  // POS METHODS - Cart Operations
  // ============================================

  /**
   * Get POS cart
   * GET /sales/pos/cart
   */
  async getPosCart(): Promise<Cart> {
    const response = await api.get<Cart>('/sales/pos/cart');
    return response;
  },

  /**
   * Get POS cart details
   * GET /sales/pos/cart/details
   */
  async getPosCartDetails(): Promise<Cart> {
    const response = await api.get<Cart>('/sales/pos/cart/details');
    return response;
  },

  /**
   * Get cart count
   * GET /sales/pos/cart/count
   */
  async getPosCartCount(): Promise<{ count: number }> {
    const response = await api.get<{ count: number }>('/sales/pos/cart/count');
    return response;
  },

  /**
   * Clear POS cart
   * DELETE /sales/pos/cart
   */
  async clearPosCart(): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>('/sales/pos/cart');
    return response;
  },

  /**
   * Add item to POS cart
   * POST /sales/pos/items
   */
  async addPosItem(data: { productId: string; quantity: number; variantId?: string; notes?: string }): Promise<Cart> {
    const response = await api.post<Cart>('/sales/pos/items', data);
    return response;
  },

  /**
   * Add multiple items to POS cart
   * POST /sales/pos/items/bulk
   */
  async addPosItems(items: Array<{ productId: string; quantity: number; variantId?: string; notes?: string }>): Promise<Cart> {
    const response = await api.post<Cart>('/sales/pos/items/bulk', { items });
    return response;
  },

  /**
   * Update POS cart item
   * PUT /sales/pos/items/:itemId
   */
  async updatePosItem(itemId: string, data: { quantity: number; unitPrice?: number; notes?: string }): Promise<Cart> {
    const response = await api.put<Cart>(`/sales/pos/items/${itemId}`, data);
    return response;
  },

  /**
   * Remove POS cart item
   * DELETE /sales/pos/items/:itemId
   */
  async removePosItem(itemId: string): Promise<Cart> {
    const response = await api.delete<Cart>(`/sales/pos/items/${itemId}`);
    return response;
  },

  /**
   * POS Checkout
   * POST /sales/pos/checkout
   */
  async posCheckout(data: PosCheckoutData): Promise<Sale> {
    const response = await api.post<Sale>('/sales/pos/checkout', data);
    return response;
  },

  // ============================================
  // POS METHODS - Customer Operations
  // ============================================

  /**
   * Search POS customers
   * GET /sales/pos/customers/search
   */
  async searchPosCustomers(query: string, limit?: number): Promise<any[]> {
    const response = await api.get<any[]>('/sales/pos/customers/search', { params: { query, limit } });
    return response;
  },

  /**
   * Get POS customer
   * GET /sales/pos/customers/:id
   */
  async getPosCustomer(id: string): Promise<any> {
    const response = await api.get<any>(`/sales/pos/customers/${id}`);
    return response;
  },

  /**
   * Create POS customer
   * POST /sales/pos/customers
   */
  async createPosCustomer(data: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }): Promise<any> {
    const response = await api.post<any>('/sales/pos/customers', data);
    return response;
  },

  // ============================================
  // POS METHODS - Product Operations
  // ============================================

  /**
   * Search POS products
   * GET /sales/pos/products/search
   */
  async searchPosProducts(query: string, category?: string, limit?: number): Promise<any[]> {
    const response = await api.get<any[]>('/sales/pos/products/search', {
      params: { query, category, limit }
    });
    return response;
  },

  /**
   * Get POS product by barcode
   * GET /sales/pos/products/barcode/:barcode
   */
  async getPosProductByBarcode(barcode: string): Promise<any> {
    const response = await api.get<any>(`/sales/pos/products/barcode/${barcode}`);
    return response;
  },

  /**
   * Get POS product by SKU
   * GET /sales/pos/products/sku/:sku
   */
  async getPosProductBySku(sku: string): Promise<any> {
    const response = await api.get<any>(`/sales/pos/products/sku/${sku}`);
    return response;
  },

  // ============================================
  // POS METHODS - Summary & Status
  // ============================================

  /**
   * Get POS summary
   * GET /sales/pos/summary
   */
  async getPosSummary(): Promise<PosSummary> {
    const response = await api.get<PosSummary>('/sales/pos/summary');
    return response;
  },

  /**
   * Get POS register status
   * GET /sales/pos/register/status
   */
  async getPosRegisterStatus(): Promise<RegisterStatus> {
    const response = await api.get<RegisterStatus>('/sales/pos/register/status');
    return response;
  }
};

// Export types for use in other files
export type { Sale };
export default saleService;
