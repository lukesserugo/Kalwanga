// src/components/bookkeeping/JournalEntries.tsx

import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Eye, Edit, Trash2, FileText,
  DollarSign, Calendar, Filter, Download,
  CheckCircle, XCircle, Clock, AlertCircle
} from 'lucide-react';
import { bookkeepingService } from '../../services/bookkeepingService';
import { Table } from '../common/Table';
import { Pagination } from '../common/Pagination';
import { Modal } from '../common/Modal';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

interface JournalLine {
  id: string;
  account: {
    code: string;
    name: string;
  };
  accountId?: string;
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
  status: string;
  lines: JournalLine[];
}

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  category?: string;
  isActive?: boolean;
}

interface FormJournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
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

export function JournalEntries() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    limit: 20,
  });
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [entryData, setEntryData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [] as FormJournalLine[],
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadEntries();
    loadAccounts();
  }, [filters, pagination.page]);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const result = await bookkeepingService.getJournalEntries({
        page: pagination.page,
        limit: pagination.limit,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        ...(filters.search && { search: filters.search }),
        ...(filters.status && { status: filters.status }),
      });
      
      // Handle the response - it might be PaginatedResponse or direct array
      const responseData = result as any;
      if (responseData && typeof responseData === 'object') {
        if ('data' in responseData && Array.isArray(responseData.data)) {
          setEntries(responseData.data);
          setPagination({
            ...pagination,
            total: responseData.total || 0,
            totalPages: responseData.totalPages || 1,
          });
        } else if (Array.isArray(responseData)) {
          setEntries(responseData);
        } else {
          setEntries([]);
        }
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
      toast.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const result = await bookkeepingService.getAccounts({ isActive: true });
      // Handle the response - it might be Account[] or wrapped
      const responseData = result as any;
      if (Array.isArray(responseData)) {
        setAccounts(responseData);
      } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
        setAccounts(responseData.data);
      } else {
        setAccounts([]);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleCreateEntry = async () => {
    try {
      setSubmitting(true);
      
      // Validate debits equal credits
      const totalDebits = entryData.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredits = entryData.lines.reduce((sum, line) => sum + line.credit, 0);
      
      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        toast.warning('Total debits must equal total credits');
        setSubmitting(false);
        return;
      }
      
      if (entryData.lines.length === 0) {
        toast.warning('Please add at least one line');
        setSubmitting(false);
        return;
      }

      // Check for empty account selections
      const hasEmptyAccount = entryData.lines.some(line => !line.accountId);
      if (hasEmptyAccount) {
        toast.warning('Please select an account for each line');
        setSubmitting(false);
        return;
      }

      // Map form lines to the expected API format
      const linesToCreate = entryData.lines.map(line => ({
        accountId: line.accountId,
        debit: line.debit,
        credit: line.credit,
        description: line.description || undefined,
      }));

      await bookkeepingService.createJournalEntry({
        date: entryData.date,
        description: entryData.description,
        reference: entryData.reference || undefined,
        lines: linesToCreate,
      });
      
      toast.success('Journal entry created successfully');
      setShowEntryModal(false);
      setEntryData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        lines: [],
      });
      loadEntries();
    } catch (error: any) {
      console.error('Failed to create journal entry:', error);
      toast.error(error?.message || 'Failed to create journal entry');
    } finally {
      setSubmitting(false);
    }
  };

  const addLine = () => {
    setEntryData({
      ...entryData,
      lines: [
        ...entryData.lines,
        { accountId: '', debit: 0, credit: 0, description: '' },
      ],
    });
  };

  const removeLine = (index: number) => {
    setEntryData({
      ...entryData,
      lines: entryData.lines.filter((_, i) => i !== index),
    });
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...entryData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setEntryData({ ...entryData, lines: newLines });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'POSTED': return 'green';
      case 'DRAFT': return 'yellow';
      case 'VOIDED':
      case 'VOID': return 'red';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'POSTED': return <CheckCircle className="w-4 h-4" />;
      case 'DRAFT': return <Clock className="w-4 h-4" />;
      case 'VOIDED':
      case 'VOID': return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const columns = [
    {
      key: 'entry',
      header: 'Entry',
      render: (entry: JournalEntry) => (
        <div>
          <p className="font-medium text-gray-900">{entry.entryNumber}</p>
          <p className="text-sm text-gray-500">
            {new Date(entry.date).toLocaleDateString()}
          </p>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (entry: JournalEntry) => (
        <div>
          <p className="text-gray-900">{entry.description}</p>
          {entry.reference && (
            <p className="text-sm text-gray-500">Ref: {entry.reference}</p>
          )}
        </div>
      ),
    },
    {
      key: 'lines',
      header: 'Lines',
      render: (entry: JournalEntry) => (
        <span>{entry.lines?.length || 0} entries</span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (entry: JournalEntry) => {
        const total = entry.lines?.reduce((sum: number, line: any) => 
          sum + (line.debit || 0) + (line.credit || 0), 0) || 0;
        return (
          <span className="font-medium">${total.toFixed(2)}</span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry: JournalEntry) => {
        const color = getStatusColor(entry.status);
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-700`}>
            {getStatusIcon(entry.status)}
            {entry.status || 'DRAFT'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (entry: JournalEntry) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedEntry(entry)}
            className="p-1 hover:bg-blue-100 rounded transition-colors"
            title="View Entry"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {entry.status === 'DRAFT' && (
            <>
              <button
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Edit Entry"
              >
                <Edit className="w-4 h-4 text-gray-600" />
              </button>
              <button
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Delete Entry"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // Calculate totals for the current entry form
  const totalDebits = entryData.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = entryData.lines.reduce((sum, line) => sum + line.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal Entries</h1>
          <p className="text-gray-600 mt-1">Manage all journal entries</p>
        </div>
        <button
          onClick={() => setShowEntryModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search entries..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="VOIDED">Voided</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={() => setFilters({ search: '', status: '', startDate: '', endDate: '' })}
            className="px-3 py-2 text-gray-600 hover:text-gray-800"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={entries}
          loading={loading}
        />
        <div className="border-t border-gray-200 p-4 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            Showing {entries.length} of {pagination.total} entries
          </span>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={(page) => setPagination({ ...pagination, page })}
          />
        </div>
      </div>

      {/* Create Entry Modal */}
      <Modal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        title="New Journal Entry"
      >
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={entryData.date}
                onChange={(e) => setEntryData({ ...entryData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <input
                type="text"
                value={entryData.description}
                onChange={(e) => setEntryData({ ...entryData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Entry description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference
              </label>
              <input
                type="text"
                value={entryData.reference}
                onChange={(e) => setEntryData({ ...entryData, reference: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Reference number (optional)"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Journal Lines *
                </label>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Add Line
                </button>
              </div>
              <div className="space-y-2">
                {entryData.lines.map((line, index) => (
                  <div key={index} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex gap-2 mb-2">
                      <select
                        value={line.accountId}
                        onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select Account</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500">Debit</label>
                        <input
                          type="number"
                          value={line.debit || ''}
                          onChange={(e) => updateLine(index, 'debit', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500">Credit</label>
                        <input
                          type="number"
                          value={line.credit || ''}
                          onChange={(e) => updateLine(index, 'credit', parseFloat(e.target.value) || 0)}
                          step="0.01"
                          min="0"
                          className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Line description (optional)"
                      />
                    </div>
                  </div>
                ))}
                {entryData.lines.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No lines added. Click "Add Line" to start.
                  </p>
                )}
              </div>
            </div>

            {/* Summary */}
            {entryData.lines.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Debits</span>
                  <span className="font-medium">
                    ${totalDebits.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Credits</span>
                  <span className="font-medium">
                    ${totalCredits.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mt-1 pt-1 border-t border-gray-200">
                  <span className="font-medium">Balance</span>
                  <span className={`font-medium ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                    {isBalanced ? '✓ Balanced' : `⚠️ Unbalanced (${(totalDebits - totalCredits).toFixed(2)})`}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowEntryModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateEntry}
              disabled={submitting || !isBalanced || entryData.lines.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Entry'}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Entry Modal */}
      {selectedEntry && (
        <Modal
          isOpen={!!selectedEntry}
          onClose={() => setSelectedEntry(null)}
          title={`Journal Entry: ${selectedEntry.entryNumber}`}
        >
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">{new Date(selectedEntry.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(selectedEntry.status)}-100 text-${getStatusColor(selectedEntry.status)}-700`}>
                    {getStatusIcon(selectedEntry.status)}
                    {selectedEntry.status || 'DRAFT'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium">{selectedEntry.description}</p>
              </div>
              {selectedEntry.reference && (
                <div>
                  <p className="text-sm text-gray-500">Reference</p>
                  <p className="font-medium">{selectedEntry.reference}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 mb-2">Lines</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Account</th>
                      <th className="text-right py-2">Debit</th>
                      <th className="text-right py-2">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedEntry.lines || []).map((line) => (
                      <tr key={line.id} className="border-b last:border-0">
                        <td className="py-2">{line.account?.name || 'N/A'}</td>
                        <td className="text-right font-mono">{line.debit > 0 ? line.debit.toFixed(2) : '-'}</td>
                        <td className="text-right font-mono">{line.credit > 0 ? line.credit.toFixed(2) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
