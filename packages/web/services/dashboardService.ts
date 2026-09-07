// D:\Projects\Kalwanga\packages\web\services\dashboardService.ts
import { apiService } from './api';

// Define types for dashboard data
export interface SalesData {
  today: {
    total: number;
    count: number;
    trend?: 'up' | 'down' | 'neutral';
  };
  week: {
    total: number;
    count: number;
    trend?: 'up' | 'down' | 'neutral';
  };
  month: {
    total: number;
    count: number;
    trend?: 'up' | 'down' | 'neutral';
  };
}

export interface CustomersData {
  total: number;
  new: number;
  trend?: 'up' | 'down' | 'neutral';
}

export interface InventoryData {
  totalValue: number;
  totalItems: number;
  lowStock: number;
  outOfStock: number;
}

export interface RegistersData {
  open: number;
}

export interface OrdersData {
  pending: number;
}

export interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
  isRead?: boolean;
}

export interface LowStockItem {
  id: string;
  quantity: number;
  reorderPoint: number;
  product?: {
    name: string;
    sku: string;
  };
}

export interface RealtimeData {
  sales: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: TopProduct[];
  notifications: Notification[];
  lowStockInventory: LowStockItem[];
}

export interface DashboardStats {
  sales: SalesData;
  customers: CustomersData;
  inventory: InventoryData;
  registers: RegistersData;
  orders: OrdersData;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export const dashboardService = {
  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    const response = await apiService.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return response.data;
  },

  /**
   * Get real-time dashboard data
   */
  async getRealtimeData(): Promise<RealtimeData> {
    const response = await apiService.get<ApiResponse<RealtimeData>>('/dashboard/realtime');
    return response.data;
  },

  /**
   * Get sales data for chart
   */
  async getSalesData(range?: 'today' | 'week' | 'month' | 'year'): Promise<{ date: string; revenue: number; orders: number }[]> {
    const response = await apiService.get<ApiResponse<{ date: string; revenue: number; orders: number }[]>>('/dashboard/sales', {
      params: { range }
    });
    return response.data;
  },

  /**
   * Get top products
   */
  async getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    const response = await apiService.get<ApiResponse<TopProduct[]>>('/dashboard/top-products', {
      params: { limit }
    });
    return response.data;
  },

  /**
   * Get low stock items
   */
  async getLowStockItems(limit: number = 5): Promise<LowStockItem[]> {
    const response = await apiService.get<ApiResponse<LowStockItem[]>>('/dashboard/low-stock', {
      params: { limit }
    });
    return response.data;
  },

  /**
   * Get notifications
   */
  async getNotifications(limit: number = 10): Promise<Notification[]> {
    const response = await apiService.get<ApiResponse<Notification[]>>('/dashboard/notifications', {
      params: { limit }
    });
    return response.data;
  },

  /**
   * Get customer statistics
   */
  async getCustomerStats(): Promise<CustomersData> {
    const response = await apiService.get<ApiResponse<CustomersData>>('/dashboard/customers');
    return response.data;
  },

  /**
   * Get inventory statistics
   */
  async getInventoryStats(): Promise<InventoryData> {
    const response = await apiService.get<ApiResponse<InventoryData>>('/dashboard/inventory');
    return response.data;
  },

  /**
   * Get sales overview for a specific period
   */
  async getSalesOverview(period: 'today' | 'week' | 'month' | 'year' = 'today'): Promise<{
    total: number;
    count: number;
    average: number;
    trend: number;
  }> {
    const response = await apiService.get<ApiResponse<{
      total: number;
      count: number;
      average: number;
      trend: number;
    }>>('/dashboard/sales-overview', {
      params: { period }
    });
    return response.data;
  },

  /**
   * Get revenue breakdown
   */
  async getRevenueBreakdown(): Promise<{
    byCategory: Array<{ category: string; amount: number; percentage: number }>;
    byPaymentMethod: Array<{ method: string; amount: number; percentage: number }>;
    byTime: Array<{ hour: number; amount: number }>;
  }> {
    const response = await apiService.get<ApiResponse<{
      byCategory: Array<{ category: string; amount: number; percentage: number }>;
      byPaymentMethod: Array<{ method: string; amount: number; percentage: number }>;
      byTime: Array<{ hour: number; amount: number }>;
    }>>('/dashboard/revenue-breakdown');
    return response.data;
  },

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    conversionRate: number;
    averageOrderValue: number;
    customerRetentionRate: number;
    inventoryTurnover: number;
  }> {
    const response = await apiService.get<ApiResponse<{
      conversionRate: number;
      averageOrderValue: number;
      customerRetentionRate: number;
      inventoryTurnover: number;
    }>>('/dashboard/performance-metrics');
    return response.data;
  }
};
