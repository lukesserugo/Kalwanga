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

// Import types from the types folder
import type { 
  JournalEntry as JournalEntryType,
  JournalLine as JournalLineType,
  Account as AccountType 
} from '../../types/bookkeeping';

// Use the imported types
type JournalEntry = JournalEntryType;
type Account = AccountType;

// Define a type for the form line (without id and journalEntryId)
interface FormJournalLine {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
}

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
        ...filters,
      });
      setEntries(result.data);
      setPagination({
        ...pagination,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      console.error('Failed to load entries:', error);
      toast.error('Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const result = await bookkeepingService.getAccounts();
      setAccounts(result);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleCreateEntry = async () => {
    try {
      // Validate debits equal credits
      const totalDebits = entryData.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredits = entryData.lines.reduce((sum, line) => sum + line.credit, 0);
      if (totalDebits !== totalCredits) {
        toast.warning('Total debits must equal total credits');
        return;
      }
      if (entryData.lines.length === 0) {
        toast.warning('Please add at least one line');
        return;
      }

      // Map form lines to the expected API format (without id and journalEntryId)
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
    } catch (error) {
      toast.error('Failed to create journal entry');
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
    switch (status) {
      case 'POSTED': return 'green';
      case 'DRAFT': return 'yellow';
      case 'VOID': return 'red';
      default: return 'gray';
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
        const total = entry.lines?.reduce((sum: number, line: any) => sum + line.debit + line.credit, 0) || 0;
        return (
          <span className="font-medium">${total.toFixed(2)}</span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (entry: JournalEntry) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${getStatusColor(entry.status)}-100 text-${getStatusColor(entry.status)}-700`}>
          {entry.status}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (entry: JournalEntry) => (
        <div className="flex items-center gap-2">
          <button
            className="p-1 hover:bg-blue-100 rounded transition-colors"
          >
            <Eye className="w-4 h-4 text-blue-600" />
          </button>
          {entry.status === 'DRAFT' && (
            <>
              <button
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <Edit className="w-4 h-4 text-gray-600" />
              </button>
              <button
                className="p-1 hover:bg-red-100 rounded transition-colors"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

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
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted</option>
            <option value="VOID">Void</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Table
          columns={columns}
          data={entries}
          loading={loading}
        />
        <div className="border-t border-gray-200 p-4">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Reference number"
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
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add Line
                </button>
              </div>
              <div className="space-y-2">
                {entryData.lines.map((line, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="flex gap-2 mb-2">
                      <select
                        value={line.accountId}
                        onChange={(e) => updateLine(index, 'accountId', e.target.value)}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        <option value="">Select Account</option>
                        {accounts.map((acc: Account) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name} ({acc.type})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500">Debit</label>
                        <input
                          type="number"
                          value={line.debit}
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
                          value={line.credit}
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
                    ${entryData.lines.reduce((sum, line) => sum + line.debit, 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Credits</span>
                  <span className="font-medium">
                    ${entryData.lines.reduce((sum, line) => sum + line.credit, 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between mt-1 pt-1 border-t">
                  <span className="font-medium">Balance</span>
                  <span className={`font-medium ${
                    entryData.lines.reduce((sum, line) => sum + line.debit, 0) ===
                    entryData.lines.reduce((sum, line) => sum + line.credit, 0)
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {entryData.lines.reduce((sum, line) => sum + line.debit, 0) ===
                     entryData.lines.reduce((sum, line) => sum + line.credit, 0)
                      ? '✓ Balanced'
                      : '⚠️ Unbalanced'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowEntryModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateEntry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Entry
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
