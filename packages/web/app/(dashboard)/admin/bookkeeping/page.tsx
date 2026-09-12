// src/app/(dashboard)/admin/bookkeeping/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { bookkeepingService } from '../../../../services/bookkeepingService';
import { useToast } from '../../../../hooks/useToast';
import { formatCurrency } from '../../../../utils/helpers';

// ============================================
// LOCAL TYPES (matching the actual API responses)
// ============================================

interface JournalLine {
  id: string;
  account: {
    code: string;
    name: string;
  };
  debit: number;
  credit: number;
  description?: string;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string;
  status?: string;
  lines: JournalLine[];
}

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: string;
  category?: string;
  isActive?: boolean;
  debit: number;
  credit: number;
  balance: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================
// COMPONENT
// ============================================

export default function BookkeepingPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'journal' | 'accounts'>('journal');
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
    limit: 50,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch journal entries with pagination
      const entriesResponse = await bookkeepingService.getJournalEntries({
        page: pagination.page,
        limit: pagination.limit,
      });
      
      // Fetch accounts
      const accountsResponse = await bookkeepingService.getAccounts({
        isActive: true,
      });

      // Handle entries response - it should be PaginatedResponse<JournalEntry>
      if (entriesResponse) {
        // Check if it's a paginated response with data property
        const responseData = entriesResponse as any;
        if (responseData && typeof responseData === 'object') {
          if ('data' in responseData && Array.isArray(responseData.data)) {
            setEntries(responseData.data as JournalEntry[]);
            setPagination({
              page: responseData.page || 1,
              total: responseData.total || 0,
              totalPages: responseData.totalPages || 0,
              limit: responseData.limit || 50,
            });
          } else if (Array.isArray(entriesResponse)) {
            setEntries(entriesResponse as JournalEntry[]);
          } else {
            setEntries([]);
          }
        } else {
          setEntries([]);
        }
      } else {
        setEntries([]);
      }

      // Handle accounts response - it should be Account[]
      if (accountsResponse) {
        const responseData = accountsResponse as any;
        let accountArray: any[] = [];
        
        if (Array.isArray(responseData)) {
          accountArray = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          accountArray = responseData.data;
        }
        
        // Transform Account[] to AccountBalance[]
        const accountBalances: AccountBalance[] = accountArray.map((account: any) => {
          const lines = account.lines || [];
          const debit = lines.reduce((sum: number, line: any) => sum + (line.debit || 0), 0);
          const credit = lines.reduce((sum: number, line: any) => sum + (line.credit || 0), 0);
          
          return {
            id: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            category: account.category,
            isActive: account.isActive,
            debit: debit,
            credit: credit,
            balance: debit - credit,
          };
        });
        setAccounts(accountBalances);
      } else {
        setAccounts([]);
      }
    } catch (error: any) {
      console.error('Error fetching bookkeeping data:', error);
      showToast(error?.message || 'Failed to load bookkeeping data', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalDebit = entries.reduce((sum, entry) => 
    sum + (entry.lines || []).reduce((s, line) => s + (line.debit || 0), 0), 0);
  const totalCredit = entries.reduce((sum, entry) => 
    sum + (entry.lines || []).reduce((s, line) => s + (line.credit || 0), 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookkeeping</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Debits</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatCurrency(totalDebit)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Credits</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {formatCurrency(totalCredit)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Balance</p>
          <p className={`text-2xl font-bold ${isBalanced ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
            {formatCurrency(totalDebit - totalCredit)}
          </p>
          {!isBalanced && (
            <p className="text-xs text-yellow-500 mt-1">⚠️ Journal entries are out of balance</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('journal')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'journal'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Journal Entries
          {pagination.total > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
              {pagination.total}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'accounts'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Account Balances
          {accounts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
              {accounts.length}
            </span>
          )}
        </button>
      </div>

      {/* Journal Entries Tab */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="text-lg">No journal entries found</p>
              <p className="text-sm mt-1">Create a new journal entry to get started</p>
            </div>
          ) : (
            <>
              {entries.map((entry) => (
                <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                  <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                    <div>
                      <p className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {entry.entryNumber}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {entry.description}
                      </p>
                      {entry.reference && (
                        <p className="text-xs text-gray-400">Ref: {entry.reference}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(entry.date).toLocaleDateString()}
                      </p>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        entry.status === 'POSTED' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                          : entry.status === 'VOIDED'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                      }`}>
                        {entry.status || 'DRAFT'}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700">
                          <th className="text-left py-2">Account</th>
                          <th className="text-left py-2">Description</th>
                          <th className="text-right py-2">Debit</th>
                          <th className="text-right py-2">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(entry.lines || []).map((line) => (
                          <tr key={line.id} className="border-b dark:border-gray-700 last:border-0">
                            <td className="py-2">
                              <span className="font-mono text-xs text-gray-500">{line.account?.code}</span>
                              <span className="ml-2">{line.account?.name || 'N/A'}</span>
                            </td>
                            <td className="py-2 text-gray-500 dark:text-gray-400">
                              {line.description || '-'}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {line.debit > 0 ? formatCurrency(line.debit) : '-'}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {line.credit > 0 ? formatCurrency(line.credit) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 dark:border-gray-700">
                        <tr className="font-semibold">
                          <td colSpan={2} className="py-2 text-right">Total:</td>
                          <td className="py-2 text-right font-mono text-green-600 dark:text-green-400">
                            {formatCurrency(entry.lines.reduce((s, l) => s + l.debit, 0))}
                          </td>
                          <td className="py-2 text-right font-mono text-red-600 dark:text-red-400">
                            {formatCurrency(entry.lines.reduce((s, l) => s + l.credit, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 py-4">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  <span className="text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.totalPages}
                    className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Accounts Tab */}
      {activeTab === 'accounts' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Credit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No accounts found
                    </td>
                  </tr>
                ) : (
                  accounts.map((account) => (
                    <tr key={account.id || account.code} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 font-mono text-sm text-gray-600 dark:text-gray-400">
                        {account.code}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          account.type === 'ASSET' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                          account.type === 'LIABILITY' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                          account.type === 'EQUITY' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                          account.type === 'REVENUE' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                          account.type === 'EXPENSE' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {account.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono">
                        {account.debit > 0 ? formatCurrency(account.debit) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-mono">
                        {account.credit > 0 ? formatCurrency(account.credit) : '-'}
                      </td>
                      <td className={`px-6 py-4 text-sm text-right font-mono font-semibold ${
                        account.balance > 0 ? 'text-green-600 dark:text-green-400' :
                        account.balance < 0 ? 'text-red-600 dark:text-red-400' :
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formatCurrency(account.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
