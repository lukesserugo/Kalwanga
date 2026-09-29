// packages/web/services/dashboardService.ts
import { api } from './api';

// ============================================
// TYPES — mirror the backend exactly
// ============================================
//
// Source of truth: packages/backend/src/services/dashboardService.ts.
// The wire shapes are what the backend's `res.json({ data })` emits
// after `api.get<T>` unwraps the envelope.

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
    /** ⚠ Field name is `newThisMonth`, NOT `new`. */
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
  /** Raw Prisma sale rows with customer + items included. */
  recentActivity: unknown[];
  /** Mapped product rows — see `DashboardTopProduct`. */
  topProducts: DashboardTopProduct[];
  /** Daily sales for the last 7 days. */
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
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** Currency amount for sales trends, order total for order trends. */
  value: number;
}

export interface TrendsResult {
  /** Backend echoes the range it used, e.g. `"7d"`. */
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
  /**
   * GET /dashboard/stats
   *
   * `api.get<T>` already unwraps `{ success, data }`, so this returns
   * the payload directly. Do NOT reach for `.data`.
   */
  async getStats(): Promise<DashboardStats> {
    return api.get<DashboardStats>('/dashboard/stats');
  },

  /** GET /dashboard/realtime */
  async getRealtimeData(): Promise<RealtimeData> {
    return api.get<RealtimeData>('/dashboard/realtime');
  },

  /** GET /dashboard/live — stats + realtime in one round trip. */
  async getLiveDashboard(): Promise<DashboardStats & RealtimeData> {
    return api.get<DashboardStats & RealtimeData>('/dashboard/live');
  },

  /** GET /dashboard/trends?range=week */
  async getTrends(range: DashboardRange = 'week'): Promise<TrendsResult> {
    return api.get<TrendsResult>('/dashboard/trends', { params: { range } });
  },

  /** GET /dashboard/activity?limit=10&range=week */
  async getActivity(
    limit = 10,
    range: DashboardRange = 'week',
  ): Promise<DashboardActivityEvent[]> {
    return api.get<DashboardActivityEvent[]>('/dashboard/activity', {
      params: { limit, range },
    });
  },

  /** GET /dashboard/top-products?limit=10&range=week */
  async getTopProducts(
    limit = 10,
    range: DashboardRange = 'week',
  ): Promise<DashboardTopProduct[]> {
    return api.get<DashboardTopProduct[]>('/dashboard/top-products', {
      params: { limit, range },
    });
  },

  /** GET /dashboard/low-stock */
  async getLowStockAlerts(): Promise<LowStockAlert[]> {
    return api.get<LowStockAlert[]>('/dashboard/low-stock');
  },

  /** GET /dashboard/sales-summary?startDate=…&endDate=… */
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
