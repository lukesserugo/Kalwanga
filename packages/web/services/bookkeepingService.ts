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
  /**
   * Get journal entries - calls GET /bookkeeping/journal
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
    const response = await api.get<PaginatedResponse<JournalEntry>>('/bookkeeping/journal', { params });
    return response;
  },

  /**
   * Create journal entry - calls POST /bookkeeping/journal
   */
  async createJournalEntry(data: {
    date: string;
    description: string;
    reference?: string;
    lines: Array<{ accountId: string; debit: number; credit: number; description?: string }>;
    businessUnitId?: string;
  }): Promise<JournalEntry> {
    const response = await api.post<JournalEntry>('/bookkeeping/journal', data);
    return response;
  },

  /**
   * Get accounts - calls GET /bookkeeping/accounts
   */
  async getAccounts(params?: { businessUnitId?: string; isActive?: boolean }): Promise<Account[]> {
    const response = await api.get<Account[]>('/bookkeeping/accounts', { params });
    return response;
  },

  /**
   * Get account by ID - calls GET /bookkeeping/accounts/:id
   */
  async getAccountById(id: string): Promise<Account> {
    const response = await api.get<Account>(`/bookkeeping/accounts/${id}`);
    return response;
  },

  /**
   * Generate balance sheet - calls GET /bookkeeping/balance-sheet
   */
  async generateBalanceSheet(businessUnitId: string): Promise<BalanceSheet> {
    const response = await api.get<BalanceSheet>('/bookkeeping/balance-sheet', { params: { businessUnitId } });
    return response;
  },

  /**
   * Generate income statement - calls GET /bookkeeping/income-statement
   */
  async generateIncomeStatement(params: {
    businessUnitId: string;
    startDate: string;
    endDate: string;
  }): Promise<IncomeStatement> {
    const response = await api.get<IncomeStatement>('/bookkeeping/income-statement', { params });
    return response;
  },

  /**
   * Generate trial balance - calls GET /bookkeeping/trial-balance
   */
  async generateTrialBalance(businessUnitId: string): Promise<TrialBalance> {
    const response = await api.get<TrialBalance>('/bookkeeping/trial-balance', { params: { businessUnitId } });
    return response;
  },

  /**
   * Create account - calls POST /bookkeeping/accounts
   */
  async createAccount(data: {
    code: string;
    name: string;
    type: string;
    category: string;
    businessUnitId: string;
  }): Promise<Account> {
    const response = await api.post<Account>('/bookkeeping/accounts', data);
    return response;
  },

  /**
   * Update account - calls PUT /bookkeeping/accounts/:id
   */
  async updateAccount(id: string, data: Partial<Account>): Promise<Account> {
    const response = await api.put<Account>(`/bookkeeping/accounts/${id}`, data);
    return response;
  },
};

// Also export as default for compatibility
export default bookkeepingService;
