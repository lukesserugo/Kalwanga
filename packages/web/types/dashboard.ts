// D:\Projects\Kalwanga\packages\web\types\dashboard.ts

// Import required types from other files
import { Sale } from './sale';
import { Inventory } from './inventory';

// Define Notification locally since it's not exported from index
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  data?: Record<string, any>;
}

export interface DashboardStats {
  sales: {
    today: { total: number; count: number; trend?: number };
    week: { total: number; count: number; trend?: number };
    month: { total: number; count: number; trend?: number };
  };
  inventory: {
    totalItems: number;
    totalValue: number;
    lowStock: number;
    outOfStock: number;
  };
  customers: { 
    total: number;
    new?: number;
    trend?: number;
  };
  suppliers: { total: number };
  registers: { open: number };
  orders: { pending: number };
}

export interface SalesStats {
  totalRevenue: number;
  totalSales: number;
  averageTicket: number;
  todayRevenue: number;
  todaySales: number;
  weekRevenue?: number;
  weekSales?: number;
  monthRevenue?: number;
  monthSales?: number;
  yearRevenue?: number;
  yearSales?: number;
}

export interface CustomerStats {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number;
  averageLoyaltyPoints: number;
  topSpenders: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    loyaltyPoints: number;
    lastPurchase: string | null;
  }>;
  customerSegments: {
    highValue: number;
    mediumValue: number;
    lowValue: number;
  };
}

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  turnoverRate: number;
  averageStockValue: number;
  categories: Array<{
    id: string;
    name: string;
    productCount: number;
    totalValue: number;
  }>;
}

export interface RealtimeData {
  recentSales: Sale[];
  lowStockInventory: Inventory[];
  notifications: Notification[];
  topProducts: Array<{
    id: string;
    name: string;
    sku: string;
    sales: number;
    revenue: number;
  }>;
}

export interface SalesTrend {
  date: string;
  total: number;
  count: number;
  averageTicket: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  revenue: number;
  averagePrice: number;
}

export interface CustomerInsight {
  totalCustomers: number;
  newCustomersLast30Days: number;
  returningCustomersLast30Days: number;
  retentionRate: number;
  topSpenders: Array<{
    id: string;
    name: string;
    email: string;
    totalSpent: number;
    loyaltyPoints: number;
    lastPurchase: string | null;
  }>;
}

export interface ActivityItem {
  id: string;
  type: 'sale' | 'inventory' | 'customer' | 'order' | 'payment' | 'alert' | 'notification';
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  link?: string;
  icon?: string;
}
