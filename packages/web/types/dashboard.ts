// packages/web/types/dashboard.ts
import type { Sale } from './sale';
import type { Inventory } from './inventory';

/**
 * Prisma `Notification` row as returned by `/dashboard/realtime`.
 *
 * ⚠ The `type` field is a free-form string in the DB, not a union.
 *   Narrow it with a guard before rendering a specific icon.
 */
export interface Notification {
  id: string;
  title?: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  data?: Record<string, unknown>;
}

export interface DashboardSalesPeriod {
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
    today: DashboardSalesPeriod;
    week: DashboardSalesPeriod;
    month: DashboardSalesPeriod;
    year: DashboardSalesPeriod;
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
    /** Backend field name is `newThisMonth`. */
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
  recentActivity: Sale[];
  topProducts: DashboardTopProduct[];
  salesTrend: Array<{ date: string; total: number; count: number }>;
}

export interface RealtimeAlert {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  count: number;
}

export interface RealtimeData {
  recentSales: Sale[];
  lowStockInventory: Inventory[];
  notifications: Notification[];
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

export interface ActivityItem {
  id: string;
  type: 'SALE' | 'ORDER' | 'LOW_STOCK' | 'SYSTEM';
  title: string;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}
