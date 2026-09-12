'use client';

import React, { useState } from 'react';
import {
  X,
  Printer,
  Search,
  Loader2,
  Receipt,
  Calendar,
  DollarSign,
  User,
  Check,
  AlertCircle,
  FileText,
  Clock
} from 'lucide-react';
import { useToast } from '../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../utils/formatters';

interface Receipt {
  id: string;
  receiptNumber: string;
  saleId: string;
  customerName: string;
  total: number;
  createdAt: string;
  status: 'issued' | 'printed' | 'sent';
}

interface ReprintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReprint: (receiptNumber: string) => void;
}

export function ReprintReceiptModal({
  isOpen,
  onClose,
  onReprint,
}: ReprintReceiptModalProps) {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      showToast('Please enter at least 2 characters', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Mock data for demo
      const mockReceipts: Receipt[] = [
        {
          id: '1',
          receiptNumber: 'RCP-123456',
          saleId: 'sale-1',
          customerName: 'John Doe',
          total: 125.50,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'issued',
        },
        {
          id: '2',
          receiptNumber: 'RCP-123457',
          saleId: 'sale-2',
          customerName: 'Jane Smith',
          total: 89.99,
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          status: 'printed',
        },
        {
          id: '3',
          receiptNumber: 'RCP-123458',
          saleId: 'sale-3',
          customerName: 'Robert Johnson',
          total: 234.75,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          status: 'sent',
        },
      ];

      const filtered = mockReceipts.filter(
        (r) =>
          r.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setReceipts(filtered);
    } catch (error) {
      console.error('Failed to search receipts:', error);
      showToast('Failed to search receipts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReprint = () => {
    if (selectedReceipt) {
      onReprint(selectedReceipt.receiptNumber);
      setSelectedReceipt(null);
      setSearchQuery('');
      setReceipts([]);
      onClose();
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      issued: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      printed: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
      sent: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    };
    return styles[status as keyof typeof styles] || styles.issued;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Printer className="w-5 h-5 text-gray-600" />
              Reprint Receipt
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search and reprint past receipts
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by receipt # or customer name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loading || searchQuery.length < 2}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">Searching...</span>
            </div>
          ) : receipts.length > 0 ? (
            <div className="space-y-2">
              {receipts.map((receipt) => (
                <ReceiptResultItem
                  key={receipt.id}
                  receipt={receipt}
                  isSelected={selectedReceipt?.id === receipt.id}
                  onSelect={() => setSelectedReceipt(receipt)}
                />
              ))}
            </div>
          ) : searchQuery.length >= 2 && !loading ? (
            <div className="text-center py-12">
              <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No receipts found</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Try a different search term</p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Enter a receipt number or customer name to search</p>
            </div>
          )}
        </div>

        {/* Selected Receipt Actions */}
        {selectedReceipt && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedReceipt.receiptNumber}
                </p>
                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {selectedReceipt.customerName}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {formatCurrency(selectedReceipt.total)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(selectedReceipt.createdAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleReprint}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Reprint
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// RECEIPT RESULT ITEM
// ============================================

interface ReceiptResultItemProps {
  receipt: Receipt;
  isSelected: boolean;
  onSelect: () => void;
}

function ReceiptResultItem({ receipt, isSelected, onSelect }: ReceiptResultItemProps) {
  const getStatusBadge = (status: string) => {
    const styles = {
      issued: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
      printed: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
      sent: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    };
    return styles[status as keyof typeof styles] || styles.issued;
  };

  return (
    <div
      onClick={onSelect}
      className={`p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center justify-between ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600' : ''
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-500" />
          <p className="font-medium text-gray-900 dark:text-white">{receipt.receiptNumber}</p>
          <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusBadge(receipt.status)}`}>
            {receipt.status}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {receipt.customerName}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {formatCurrency(receipt.total)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(receipt.createdAt)}
          </span>
        </div>
      </div>
      {isSelected && (
        <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      )}
    </div>
  );
}
