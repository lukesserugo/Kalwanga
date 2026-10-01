// packages/web/services/dashboardService.ts

import { api } from './api';

// ============================================
// TYPES — mirror the backend exactly
// ============================================

export interface SalesPeriodStats {
  total: number;
  count: number;
}

export interface DashboardTopProduct {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  revenue: number;
}

export interface DashboardStats {
  /**
   * ISO 4217 ledger currency for the business unit this response
   * describes. Populated by the backend from
   * `BusinessUnit.currency`.
   */
  currency: string;
  sales: {
    today: SalesPeriodStats;
    week: SalesPeriodStats;
    month: SalesPeriodStats;
    year: SalesPeriodStats;
  };
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStock: number;
    outOfStock: number;
    reorderNeeded: number;
  };
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  suppliers: {
    total: number;
    active: number;
  };
  registers: {
    open: number;
    total: number;
    totalCash: number;
  };
  orders: {
    pending: number;
    completed: number;
    cancelled: number;
  };
  recentActivity: unknown[];
  topProducts: DashboardTopProduct[];
  salesTrend: Array<{ date: string; total: number; count: number }>;
}

export interface RealtimeNotification {
  id: string;
  title?: string;
  message: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export interface RealtimeLowStockItem {
  id: string;
  quantity: number;
  reorderPoint: number;
  product?: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
  } | null;
}

export interface RealtimeAlert {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  count: number;
}

export interface RealtimeData {
  recentSales: unknown[];
  lowStockInventory: RealtimeLowStockItem[];
  notifications: RealtimeNotification[];
  openRegisters: unknown[];
  pendingOrders: unknown[];
  alerts: RealtimeAlert[];
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendsResult {
  range: string;
  sales: TrendPoint[];
  orders: TrendPoint[];
}

export interface LowStockAlert {
  productId: string;
  productName: string;
  sku: string;
  currentQuantity: number;
  reorderPoint: number;
  deficit: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

export interface DashboardActivityEvent {
  id: string;
  type: 'SALE' | 'ORDER' | 'LOW_STOCK' | 'SYSTEM';
  title: string;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type DashboardRange = 'today' | 'week' | 'month' | 'quarter' | 'year';

// ============================================
// SERVICE
// ============================================

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    return api.get<DashboardStats>('/dashboard/stats');
  },

  async getRealtimeData(): Promise<RealtimeData> {
    return api.get<RealtimeData>('/dashboard/realtime');
  },

  async getLiveDashboard(): Promise<DashboardStats & RealtimeData> {
    return api.get<DashboardStats & RealtimeData>('/dashboard/live');
  },

  async getTrends(range: DashboardRange = 'week'): Promise<TrendsResult> {
    return api.get<TrendsResult>('/dashboard/trends', { params: { range } });
  },

  async getActivity(
    limit = 10,
    range: DashboardRange = 'week',
  ): Promise<DashboardActivityEvent[]> {
    return api.get<DashboardActivityEvent[]>('/dashboard/activity', {
      params: { limit, range },
    });
  },

  async getTopProducts(
    limit = 10,
    range: DashboardRange = 'week',
  ): Promise<DashboardTopProduct[]> {
    return api.get<DashboardTopProduct[]>('/dashboard/top-products', {
      params: { limit, range },
    });
  },

  async getLowStockAlerts(): Promise<LowStockAlert[]> {
    return api.get<LowStockAlert[]>('/dashboard/low-stock');
  },

  async getSalesSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<
    Array<{
      date: string;
      totalSales: number;
      totalTax: number;
      totalDiscount: number;
      transactionCount: number;
    }>
  > {
    return api.get('/dashboard/sales-summary', { params });
  },
};

export default dashboardService;
