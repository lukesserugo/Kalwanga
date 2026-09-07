// src/stores/salesStore.ts
import { create } from 'zustand';
import { apiService } from '../../services/api';
import { realtimeClient } from '../../../backend/src/services/realtimeClient';

interface Sale {
  id: string;
  receiptNumber: string;
  total: number;
  saleDate: Date;
  customer?: any;
  items: any[];
  payments: any[];
}

interface SalesState {
  sales: Sale[];
  loading: boolean;
  todayTotal: number;
  todayCount: number;
  weekTotal: number;
  monthTotal: number;
  
  fetchSales: (params?: any) => Promise<void>;
  fetchStats: () => Promise<void>;
  subscribeToSales: (businessUnitId: string) => void;
  refundSale: (id: string, reason: string) => Promise<void>;
}

export const useSalesStore = create<SalesState>((set, get) => ({
  sales: [],
  loading: false,
  todayTotal: 0,
  todayCount: 0,
  weekTotal: 0,
  monthTotal: 0,

  fetchSales: async (params) => {
    set({ loading: true });
    try {
      const response = await apiService.get('/sales', { params });
      set({ sales: response.data.data, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const response = await apiService.get('/sales/dashboard');
      const data = response.data.data;
      set({
        todayTotal: data.today.totalRevenue,
        todayCount: data.today.totalSales,
        weekTotal: data.week.totalRevenue,
        monthTotal: data.month.totalRevenue,
      });
    } catch (error) {
      console.error('Failed to fetch sales stats:', error);
    }
  },

  subscribeToSales: (businessUnitId) => {
    realtimeClient.subscribe('SALE_CREATED', () => {
      get().fetchSales();
      get().fetchStats();
    }, businessUnitId);
  },

  refundSale: async (id, reason) => {
    await apiService.post(`/sales/${id}/refund`, { reason });
    await get().fetchSales();
  },
}));
