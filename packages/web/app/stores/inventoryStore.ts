// D:\Projects\Kalwanga\packages\web\stores\inventoryStore.ts
import { create } from 'zustand';
import { api } from '../../services/api';
import { Inventory, InventoryTransaction, InventorySearchParams } from '../../types';

// Define PaginatedResponse locally since it's not exported from types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

interface InventoryState {
  // State
  inventory: Inventory[];
  transactions: InventoryTransaction[];
  lowStockItems: Inventory[];
  outOfStockItems: Inventory[];
  totalItems: number;
  totalValue: number;
  isLoading: boolean;
  pagination: {
    page: number;
    total: number;
    totalPages: number;
    limit: number;
  };
  filters: InventorySearchParams;
  
  // Actions
  loadInventory: (params?: InventorySearchParams) => Promise<void>;
  loadTransactions: (params?: any) => Promise<void>;
  loadLowStock: () => Promise<void>;
  loadOutOfStock: () => Promise<void>;
  loadStats: () => Promise<void>;
  adjustStock: (id: string, quantity: number, notes?: string) => Promise<void>;
  transferStock: (data: { productId: string; fromLocation: string; toLocation: string; quantity: number; notes?: string }) => Promise<void>;
  reserveStock: (id: string, quantity: number) => Promise<void>;
  releaseStock: (id: string, quantity: number) => Promise<void>;
  setFilters: (filters: InventorySearchParams) => void;
  reset: () => void;
}

const initialState = {
  inventory: [],
  transactions: [],
  lowStockItems: [],
  outOfStockItems: [],
  totalItems: 0,
  totalValue: 0,
  isLoading: false,
  pagination: {
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  },
  filters: {},
};

export const useInventoryStore = create<InventoryState>((set, get) => ({
  ...initialState,

  loadInventory: async (params?: InventorySearchParams) => {
    set({ isLoading: true });
    try {
      const response = await api.get<PaginatedResponse<Inventory>>('/inventory', { 
        params: { ...get().filters, ...params } 
      });
      set({
        inventory: response.data,
        pagination: {
          page: response.page,
          total: response.total,
          totalPages: response.totalPages,
          limit: response.limit,
        },
      });
    } catch (error) {
      console.error('Failed to load inventory:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadTransactions: async (params?: any) => {
    set({ isLoading: true });
    try {
      const response = await api.get<PaginatedResponse<InventoryTransaction>>('/inventory/transactions', { params });
      set({ transactions: response.data });
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadLowStock: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get<Inventory[]>('/inventory/low-stock');
      set({ lowStockItems: response });
    } catch (error) {
      console.error('Failed to load low stock items:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadOutOfStock: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get<Inventory[]>('/inventory/out-of-stock');
      set({ outOfStockItems: response });
    } catch (error) {
      console.error('Failed to load out of stock items:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loadStats: async () => {
    try {
      const response = await api.get<{ totalItems: number; totalValue: number }>('/inventory/stats');
      set({
        totalItems: response.totalItems,
        totalValue: response.totalValue,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  },

  adjustStock: async (id: string, quantity: number, notes?: string) => {
    set({ isLoading: true });
    try {
      await api.put(`/inventory/${id}/stock`, { quantity, notes });
      await get().loadInventory();
      await get().loadStats();
    } catch (error) {
      console.error('Failed to adjust stock:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  transferStock: async (data: { productId: string; fromLocation: string; toLocation: string; quantity: number; notes?: string }) => {
    set({ isLoading: true });
    try {
      await api.post('/inventory/transfer', data);
      await get().loadInventory();
      await get().loadStats();
    } catch (error) {
      console.error('Failed to transfer stock:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  reserveStock: async (id: string, quantity: number) => {
    set({ isLoading: true });
    try {
      await api.post(`/inventory/${id}/reserve`, { quantity });
      await get().loadInventory();
    } catch (error) {
      console.error('Failed to reserve stock:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  releaseStock: async (id: string, quantity: number) => {
    set({ isLoading: true });
    try {
      await api.post(`/inventory/${id}/release`, { quantity });
      await get().loadInventory();
    } catch (error) {
      console.error('Failed to release stock:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  setFilters: (filters: InventorySearchParams) => {
    set({ filters });
    get().loadInventory(filters);
  },

  reset: () => {
    set(initialState);
  },
}));
