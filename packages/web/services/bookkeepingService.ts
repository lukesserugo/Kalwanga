// D:\Projects\Kalwanga\packages\web\services\bookkeepingService.ts

import { api } from './api';
import { 
  JournalEntry, 
  Account, 
  TrialBalance, 
  BalanceSheet, 
  IncomeStatement 
} from '../types';

// Define PaginatedResponse locally since it's not exported from types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// Export the service object directly (not as default)
export const bookkeepingService = {
  // ============================================
  // JOURNAL ENTRY ROUTES
  // ============================================

  /**
   * Get journal entries - GET /bookkeeping/journal-entries
   */
  async getJournalEntries(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    businessUnitId?: string;
  }): Promise<PaginatedResponse<JournalEntry>> {
    const response = await api.get<PaginatedResponse<JournalEntry>>('/bookkeeping/journal-entries', { params });
    return response;
  },

  /**
   * Get journal entry by ID - GET /bookkeeping/journal-entries/:id
   */
  async getJournalEntryById(id: string): Promise<JournalEntry> {
    const response = await api.get<JournalEntry>(`/bookkeeping/journal-entries/${id}`);
    return response;
  },

  /**
   * Create journal entry - POST /bookkeeping/journal-entries
   */
  async createJournalEntry(data: {
    date: string | Date;
    description: string;
    reference?: string;
    lines: Array<{ 
      accountId: string; 
      debit: number; 
      credit: number; 
      description?: string 
    }>;
    businessUnitId?: string;
  }): Promise<JournalEntry> {
    const response = await api.post<JournalEntry>('/bookkeeping/journal-entries', data);
    return response;
  },

  /**
   * Void journal entry - POST /bookkeeping/journal-entries/:id/void
   */
  async voidJournalEntry(id: string): Promise<JournalEntry> {
    const response = await api.post<JournalEntry>(`/bookkeeping/journal-entries/${id}/void`);
    return response;
  },

  // ============================================
  // ACCOUNT ROUTES
  // ============================================

  /**
   * Get accounts - GET /bookkeeping/accounts
   */
  async getAccounts(params?: { businessUnitId?: string; isActive?: boolean }): Promise<Account[]> {
    const response = await api.get<Account[]>('/bookkeeping/accounts', { params });
    return response;
  },

  /**
   * Get account by ID - GET /bookkeeping/accounts/:id
   */
  async getAccountById(id: string): Promise<Account> {
    const response = await api.get<Account>(`/bookkeeping/accounts/${id}`);
    return response;
  },

  /**
   * Get account balance - GET /bookkeeping/accounts/:id/balance
   */
  async getAccountBalance(id: string): Promise<{
    accountId: string;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    balance: number;
  }> {
    const response = await api.get<any>(`/bookkeeping/accounts/${id}/balance`);
    return response;
  },

  /**
   * Create account - POST /bookkeeping/accounts
   */
  async createAccount(data: {
    code: string;
    name: string;
    type: string;
    category: string;
    businessUnitId: string;
    isActive?: boolean;
  }): Promise<Account> {
    const response = await api.post<Account>('/bookkeeping/accounts', data);
    return response;
  },

  /**
   * Update account - PUT /bookkeeping/accounts/:id
   */
  async updateAccount(id: string, data: Partial<Account>): Promise<Account> {
    const response = await api.put<Account>(`/bookkeeping/accounts/${id}`, data);
    return response;
  },

  // ============================================
  // FINANCIAL REPORT ROUTES
  // ============================================

  /**
   * Generate balance sheet - GET /bookkeeping/reports/balance-sheet
   * Also supports /bookkeeping/balance-sheet for backward compatibility
   */
  async generateBalanceSheet(businessUnitId: string): Promise<BalanceSheet> {
    // Try the new endpoint first, fallback to old if needed
    try {
      const response = await api.get<BalanceSheet>('/bookkeeping/reports/balance-sheet', { 
        params: { businessUnitId } 
      });
      return response;
    } catch (error) {
      // Fallback to old endpoint
      const response = await api.get<BalanceSheet>('/bookkeeping/balance-sheet', { 
        params: { businessUnitId } 
      });
      return response;
    }
  },

  /**
   * Generate income statement - GET /bookkeeping/reports/income-statement
   * Also supports /bookkeeping/income-statement for backward compatibility
   */
  async generateIncomeStatement(params: {
    businessUnitId: string;
    startDate: string | Date;
    endDate: string | Date;
  }): Promise<IncomeStatement> {
    const queryParams = {
      businessUnitId: params.businessUnitId,
      startDate: typeof params.startDate === 'string' ? params.startDate : params.startDate.toISOString(),
      endDate: typeof params.endDate === 'string' ? params.endDate : params.endDate.toISOString(),
    };
    
    try {
      const response = await api.get<IncomeStatement>('/bookkeeping/reports/income-statement', { 
        params: queryParams 
      });
      return response;
    } catch (error) {
      // Fallback to old endpoint
      const response = await api.get<IncomeStatement>('/bookkeeping/income-statement', { 
        params: queryParams 
      });
      return response;
    }
  },

  /**
   * Generate trial balance - GET /bookkeeping/reports/trial-balance
   * Also supports /bookkeeping/trial-balance for backward compatibility
   */
  async generateTrialBalance(businessUnitId: string): Promise<TrialBalance> {
    try {
      const response = await api.get<TrialBalance>('/bookkeeping/reports/trial-balance', { 
        params: { businessUnitId } 
      });
      return response;
    } catch (error) {
      // Fallback to old endpoint
      const response = await api.get<TrialBalance>('/bookkeeping/trial-balance', { 
        params: { businessUnitId } 
      });
      return response;
    }
  },

  // ============================================
  // SALE RECORDING ROUTES
  // ============================================

  /**
   * Record a sale in the journal - POST /bookkeeping/record-sale/:saleId
   */
  async recordSale(saleId: string): Promise<JournalEntry[]> {
    const response = await api.post<JournalEntry[]>(`/bookkeeping/record-sale/${saleId}`);
    return response;
  },

  // ============================================
  // TAX ROUTES
  // ============================================

  /**
   * Calculate tax - POST /bookkeeping/calculate-tax
   */
  async calculateTax(subtotal: number, businessUnitId?: string): Promise<{
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
    taxBreakdown: {
      federal: number;
      state: number;
      local: number;
      vat: number;
      salesTax: number;
    };
  }> {
    const response = await api.post<any>('/bookkeeping/calculate-tax', { 
      subtotal,
      businessUnitId 
    });
    return response;
  },
};

// Also export as default for compatibility
export default bookkeepingService;
