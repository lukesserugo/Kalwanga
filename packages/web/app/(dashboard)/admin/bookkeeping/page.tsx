// src/app/dashboard/bookkeeping/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../../../../services/api';
import { useToast } from '../../../../hooks/useToast';
import { formatCurrency } from '../../../../utils/helpers';

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference: string;
  status: string;
  lines: Array<{
    id: string;
    account: { code: string; name: string };
    debit: number;
    credit: number;
  }>;
}

interface AccountBalance {
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

// Define API response structure
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export default function BookkeepingPage() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'journal' | 'accounts'>('journal');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [entriesRes, accountsRes] = await Promise.all([
        apiService.get<ApiResponse<JournalEntry[]>>('/bookkeeping/journal-entries'),
        apiService.get<ApiResponse<AccountBalance[]>>('/bookkeeping/accounts'),
      ]);
      setEntries(entriesRes.data || []);
      setAccounts(accountsRes.data || []);
    } catch (error: any) {
      showToast(error?.response?.data?.message || 'Failed to load bookkeeping data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalDebit = entries.reduce((sum, entry) => 
    sum + entry.lines.reduce((s, line) => s + line.debit, 0), 0);
  const totalCredit = entries.reduce((sum, entry) => 
    sum + entry.lines.reduce((s, line) => s + line.credit, 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Bookkeeping</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Debits</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalDebit)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Total Credits</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCredit)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Balance</p>
          <p className={`text-2xl font-bold ${totalDebit === totalCredit ? 'text-green-600' : 'text-yellow-600'}`}>
            {formatCurrency(totalDebit - totalCredit)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setActiveTab('journal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === 'journal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Journal Entries
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === 'accounts' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          Account Balances
        </button>
      </div>

      {activeTab === 'journal' ? (
        <div className="space-y-4">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No journal entries found</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-mono font-bold text-blue-600">{entry.entryNumber}</p>
                    <p className="text-sm text-gray-500">{entry.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{new Date(entry.date).toLocaleDateString()}</p>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      entry.status === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {entry.status}
                    </span>
                  </div>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-gray-500 uppercase">
                      <th className="text-left py-2">Account</th>
                      <th className="text-right py-2">Debit</th>
                      <th className="text-right py-2">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines.map((line) => (
                      <tr key={line.id} className="border-t">
                        <td className="py-2 text-sm">{line.account?.name || 'N/A'}</td>
                        <td className="py-2 text-sm text-right">{line.debit > 0 ? formatCurrency(line.debit) : '-'}</td>
                        <td className="py-2 text-sm text-right">{line.credit > 0 ? formatCurrency(line.credit) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {accounts.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No accounts found</td></tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.code} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm">{account.code}</td>
                    <td className="px-6 py-4 text-sm font-medium">{account.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{account.type}</td>
                    <td className="px-6 py-4 text-sm text-right">{account.debit > 0 ? formatCurrency(account.debit) : '-'}</td>
                    <td className="px-6 py-4 text-sm text-right">{account.credit > 0 ? formatCurrency(account.credit) : '-'}</td>
                    <td className="px-6 py-4 text-sm text-right font-medium">{formatCurrency(account.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
