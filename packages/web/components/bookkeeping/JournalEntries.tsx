// src/components/bookkeeping/JournalEntries.tsx

import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  FileText,
  DollarSign,
  Calendar,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
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
      const responseData = result as any;
      if (Array.isArray(responseData)) {
        setAccounts(responseData);
      } else if (
        responseData &&
        typeof responseData === 'object' &&
        'data' in responseData &&
        Array.isArray(responseData.data)
      ) {
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

      const totalDebits = entryData.lines.reduce(
        (sum, line) => sum + line.debit,
        0
      );
      const totalCredits = entryData.lines.reduce(
        (sum, line) => sum + line.credit,
        0
      );

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

      const hasEmptyAccount = entryData.lines.some((line) => !line.accountId);
      if (hasEmptyAccount) {
        toast.warning('Please select an account for each line');
        setSubmitting(false);
        return;
      }

      const linesToCreate = entryData.lines.map((line) => ({
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
      case 'POSTED':
        return 'success';
      case 'DRAFT':
        return 'warning';
      case 'VOIDED':
      case 'VOID':
        return 'danger';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'POSTED':
        return <CheckCircle className="w-4 h-4" />;
      case 'DRAFT':
        return <Clock className="w-4 h-4" />;
      case 'VOIDED':
      case 'VOID':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const columns = [
    {
      key: 'entry',
      header: 'Entry',
      render: (entry: JournalEntry) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white font-mono tabular-nums">
            {entry.entryNumber}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
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
          <p className="text-gray-900 dark:text-white">{entry.description}</p>
          {entry.reference && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ref: {entry.reference}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'lines',
      header: 'Lines',
      render: (entry: JournalEntry) => (
        <span className="tabular-nums">
          {entry.lines?.length || 0} entries
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      render: (entry: JournalEntry) => {
        const total =
          entry.lines?.reduce(
            (sum: number, line: any) =>
              sum + (line.debit || 0) + (line.credit || 0),
            0
          ) || 0;
        return (
          <span className="font-medium tabular-nums">${total.toFixed(2)}</span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry: JournalEntry) => {
        const color = getStatusColor(entry.status);
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-2xs font-medium bg-${color}-100 text-${color}-700`}
          >
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
            className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
            title="View Entry"
          >
            <Eye className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          </button>
          {entry.status === 'DRAFT' && (
            <>
              <button
                className="p-1 hover:bg-orange-50 dark:hover:bg-gray-700 rounded transition-colors focus-ring"
                title="Edit Entry"
              >
                <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                className="p-1 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-colors focus-ring"
                title="Delete Entry"
              >
                <Trash2 className="w-4 h-4 text-danger-600 dark:text-danger-400" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const totalDebits = entryData.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = entryData.lines.reduce(
    (sum, line) => sum + line.credit,
    0
  );
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div className="p-6 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Journal Entries
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage all journal entries
          </p>
        </div>
        <button
          onClick={() => setShowEntryModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
        >
          <Plus className="w-4 h-4" />
          New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="card-brand !p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search entries..."
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow"
              />
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="input-brand !w-auto"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="VOIDED">Voided</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters({ ...filters, startDate: e.target.value })
            }
            className="input-brand !w-auto"
          />
          <span className="text-gray-500 dark:text-gray-400">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="input-brand !w-auto"
          />
          <button
            onClick={() =>
              setFilters({ search: '', status: '', startDate: '', endDate: '' })
            }
            className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring rounded"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-brand !p-0 overflow-hidden">
        <Table columns={columns} data={entries} loading={loading} />
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
          <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
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
        <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date *
              </label>
              <input
                type="date"
                value={entryData.date}
                onChange={(e) =>
                  setEntryData({ ...entryData, date: e.target.value })
                }
                className="input-brand"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description *
              </label>
              <input
                type="text"
                value={entryData.description}
                onChange={(e) =>
                  setEntryData({ ...entryData, description: e.target.value })
                }
                className="input-brand"
                placeholder="Entry description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reference
              </label>
              <input
                type="text"
                value={entryData.reference}
                onChange={(e) =>
                  setEntryData({ ...entryData, reference: e.target.value })
                }
                className="input-brand"
                placeholder="Reference number (optional)"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Journal Lines *
                </label>
                <button
                  type="button"
                  onClick={addLine}
                  className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium transition-colors focus-ring rounded"
                >
                  + Add Line
                </button>
              </div>
              <div className="space-y-2">
                {entryData.lines.map((line, index) => (
                  <div
                    key={index}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex gap-2 mb-2">
                      <select
                        value={line.accountId}
                        onChange={(e) =>
                          updateLine(index, 'accountId', e.target.value)
                        }
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 text-sm focus:outline-none"
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
                        className="px-2 py-1 text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-colors focus-ring"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-2xs text-gray-500 dark:text-gray-400">
                          Debit
                        </label>
                        <input
                          type="number"
                          value={line.debit || ''}
                          onChange={(e) =>
                            updateLine(
                              index,
                              'debit',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          step="0.01"
                          min="0"
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 text-sm tabular-nums focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-2xs text-gray-500 dark:text-gray-400">
                          Credit
                        </label>
                        <input
                          type="number"
                          value={line.credit || ''}
                          onChange={(e) =>
                            updateLine(
                              index,
                              'credit',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          step="0.01"
                          min="0"
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 text-sm tabular-nums focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) =>
                          updateLine(index, 'description', e.target.value)
                        }
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 text-sm focus:outline-none"
                        placeholder="Line description (optional)"
                      />
                    </div>
                  </div>
                ))}
                {entryData.lines.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No lines added. Click "Add Line" to start.
                  </p>
                )}
              </div>
            </div>

            {/* Summary */}
            {entryData.lines.length > 0 && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Debits
                  </span>
                  <span className="font-medium tabular-nums">
                    ${totalDebits.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Total Credits
                  </span>
                  <span className="font-medium tabular-nums">
                    ${totalCredits.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
                  <span className="font-medium">Balance</span>
                  <span
                    className={`font-medium tabular-nums ${
                      isBalanced
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-danger-600 dark:text-danger-400'
                    }`}
                  >
                    {isBalanced
                      ? '✓ Balanced'
                      : `⚠️ Unbalanced (${(totalDebits - totalCredits).toFixed(
                          2
                        )})`}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowEntryModal(false)}
              className="btn-secondary focus-ring"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateEntry}
              disabled={
                submitting || !isBalanced || entryData.lines.length === 0
              }
              className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-ring"
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Date
                  </p>
                  <p className="font-medium tabular-nums">
                    {new Date(selectedEntry.date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Status
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-2xs font-medium bg-${getStatusColor(
                      selectedEntry.status
                    )}-100 text-${getStatusColor(selectedEntry.status)}-700`}
                  >
                    {getStatusIcon(selectedEntry.status)}
                    {selectedEntry.status || 'DRAFT'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Description
                </p>
                <p className="font-medium">{selectedEntry.description}</p>
              </div>
              {selectedEntry.reference && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Reference
                  </p>
                  <p className="font-medium">{selectedEntry.reference}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Lines
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2">Account</th>
                      <th className="text-right py-2">Debit</th>
                      <th className="text-right py-2">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedEntry.lines || []).map((line) => (
                      <tr
                        key={line.id}
                        className="border-b border-gray-200 dark:border-gray-700 last:border-0"
                      >
                        <td className="py-2">{line.account?.name || 'N/A'}</td>
                        <td className="text-right font-mono tabular-nums">
                          {line.debit > 0 ? line.debit.toFixed(2) : '-'}
                        </td>
                        <td className="text-right font-mono tabular-nums">
                          {line.credit > 0 ? line.credit.toFixed(2) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setSelectedEntry(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors focus-ring"
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
