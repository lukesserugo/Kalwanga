// packages/web/components/pos/ReprintReceiptModal.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  X,
  Printer,
  Search,
  Loader2,
  Receipt as ReceiptIcon,
  Calendar,
  User,
  Check,
  AlertCircle,
  FileText,
  Clock,
} from 'lucide-react';

import { saleService } from '../../../services/saleService';
import type { Sale } from '../../../types/sale';
import { toast } from '../../../utils/toast-manager';
import { formatDate } from '../../../utils/formatters';
import { formatPosCurrency, pickPosCurrency } from './posDisplay';

interface ReceiptRow {
  id: string;
  receiptNumber: string;
  saleId: string;
  customerName: string;
  total: number;
  createdAt: string;
  status: 'issued' | 'printed' | 'sent' | 'voided';
  /** ISO 4217 ledger currency for this receipt. Optional. */
  currency?: string;
}

export interface ReprintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReprint: (receiptNumber: string) => void | Promise<void>;
  /**
   * Optional ISO 4217 fallback currency supplied by the POS parent.
   * Used only when a search result payload doesn't carry one of its
   * own. Never hardcode.
   */
  currency?: string;
}

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

function extractErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as any;
  const data = anyErr?.response?.data;

  if (data) {
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return String(data.error.message);
    if (data.message) return String(data.message);
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors
        .map((e: any) => `${e.field ?? 'field'}: ${e.message ?? 'invalid'}`)
        .join(', ');
    }
  }

  if (anyErr?.message) return String(anyErr.message);
  return fallback;
}

function normalizeReceiptRow(raw: unknown): ReceiptRow | null {
  if (!raw || typeof raw !== 'object') return null;

  const r = raw as Record<string, unknown>;

  const id = typeof r.id === 'string' ? r.id : null;
  const receiptNumber =
    typeof r.receiptNumber === 'string' && r.receiptNumber.length > 0
      ? r.receiptNumber
      : null;

  if (!id || !receiptNumber) return null;

  let customerName = 'Guest';
  if (typeof r.customerName === 'string' && r.customerName.length > 0) {
    customerName = r.customerName;
  } else if (r.customer && typeof r.customer === 'object') {
    const c = r.customer as Record<string, unknown>;
    const first = typeof c.firstName === 'string' ? c.firstName : '';
    const last = typeof c.lastName === 'string' ? c.lastName : '';
    const composed = `${first} ${last}`.trim();
    if (composed.length > 0) customerName = composed;
  }

  const total =
    typeof r.total === 'number' && Number.isFinite(r.total) ? r.total : 0;

  const dateValue =
    typeof r.saleDate === 'string'
      ? r.saleDate
      : typeof r.createdAt === 'string'
      ? r.createdAt
      : null;
  const createdAt = dateValue ?? new Date().toISOString();

  const rawStatus =
    typeof r.status === 'string' ? r.status.toUpperCase() : '';
  let status: ReceiptRow['status'] = 'issued';
  if (
    rawStatus === 'VOID' ||
    rawStatus === 'CANCELLED' ||
    rawStatus === 'DELETED'
  ) {
    status = 'voided';
  }

  if (r.receipt && typeof r.receipt === 'object') {
    const rec = r.receipt as Record<string, unknown>;
    const recStatus =
      typeof rec.status === 'string' ? rec.status.toUpperCase() : '';
    if (recStatus === 'PRINTED') status = 'printed';
    else if (recStatus === 'SENT' || recStatus === 'EMAILED') status = 'sent';
  }

  const payment = Array.isArray(r.payments)
    ? (r.payments[0] as Record<string, unknown> | undefined)
    : undefined;

  const currency = pickPosCurrency(
    r.currency,
    payment?.currency,
    payment?.displayCurrency,
  );

  return {
    id,
    receiptNumber,
    saleId: id,
    customerName,
    total,
    createdAt,
    status,
    currency,
  };
}

export function ReprintReceiptModal({
  isOpen,
  onClose,
  onReprint,
  currency: currencyProp,
}: ReprintReceiptModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRow | null>(
    null,
  );
  const [reprinting, setReprinting] = useState(false);

  const mountedRef = useRef(true);
  const searchRequestIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      setSearchQuery('');
      setReceipts([]);
      setSearching(false);
      setSearchError(null);
      setSelectedReceipt(null);
      setReprinting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [isOpen]);

  const listCurrency = pickPosCurrency(
    receipts[0]?.currency,
    currencyProp,
  );

  const selectedCurrency = pickPosCurrency(
    selectedReceipt?.currency,
    listCurrency,
  );

  const searchReceipts = useCallback(async (query: string): Promise<void> => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    const requestId = ++searchRequestIdRef.current;
    setSearching(true);
    setSearchError(null);

    try {
      const looksLikeReceiptNumber = !trimmed.includes(' ');

      let rows: ReceiptRow[] = [];

      if (looksLikeReceiptNumber) {
        try {
          const sale = await saleService.getSaleByReceiptNumber(trimmed);
          const normalized = normalizeReceiptRow(sale);
          if (normalized) rows = [normalized];
        } catch (err) {
          const status = (err as any)?.response?.status;
          if (status !== 404) {
            throw err;
          }
        }
      }

      if (rows.length === 0) {
        const result = await saleService.getAllSales({
          search: trimmed,
          page: 1,
          limit: 20,
          sortBy: 'saleDate',
          sortOrder: 'desc',
        });

        const sales: Sale[] = Array.isArray(result?.data) ? result.data : [];
        rows = sales
          .map(normalizeReceiptRow)
          .filter((x): x is ReceiptRow => x !== null);
      }

      if (requestId !== searchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      setReceipts(rows);
      setSearching(false);
    } catch (error) {
      if (requestId !== searchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const message = extractErrorMessage(error, 'Failed to search receipts');
      console.error('[ReprintReceiptModal] search failed:', message);
      setSearchError(message);
      setReceipts([]);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const trimmed = searchQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setReceipts([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      void searchReceipts(trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, searchReceipts]);

  const handleSelectReceipt = useCallback((receipt: ReceiptRow) => {
    setSelectedReceipt(receipt);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setReceipts([]);
    setSelectedReceipt(null);
    searchInputRef.current?.focus();
  }, []);

  const handleReprint = useCallback(async () => {
    if (!selectedReceipt) return;
    if (selectedReceipt.status === 'voided') {
      toast.error(
        'This receipt belongs to a voided sale and cannot be reprinted',
      );
      return;
    }
    if (reprinting) return;

    setReprinting(true);
    try {
      await onReprint(selectedReceipt.receiptNumber);
      if (!mountedRef.current) return;
      onClose();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(
        error,
        'Failed to reprint receipt',
      );
      console.error('[ReprintReceiptModal] reprint failed:', message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setReprinting(false);
    }
  }, [selectedReceipt, reprinting, onReprint, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!reprinting) onClose();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, reprinting, onClose]);

  if (!isOpen) return null;

  const trimmedQuery = searchQuery.trim();
  const showEmptySearch = trimmedQuery.length < MIN_QUERY_LENGTH;
  const showNoResults =
    !showEmptySearch && !searching && receipts.length === 0 && !searchError;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reprint-receipt-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2
              id="reprint-receipt-title"
              className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"
            >
              <Printer
                className="w-5 h-5 text-gray-600"
                aria-hidden="true"
              />
              Reprint Receipt
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search and reprint past receipts
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={reprinting}
            aria-label="Close"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring disabled:opacity-50"
          >
            <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search by receipt # or customer name…"
              aria-label="Search receipts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus-ring rounded"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className="w-8 h-8 text-blue-500 animate-spin"
                aria-hidden="true"
              />
              <span className="ml-2 text-gray-500 dark:text-gray-400">
                Searching…
              </span>
            </div>
          ) : searchError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300"
            >
              <AlertCircle
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="flex-1">{searchError}</p>
            </div>
          ) : receipts.length > 0 ? (
            <div className="space-y-2" role="list">
              {receipts.map((receipt) => (
                <ReceiptResultItem
                  key={receipt.id}
                  receipt={receipt}
                  isSelected={selectedReceipt?.id === receipt.id}
                  onSelect={() => handleSelectReceipt(receipt)}
                  currency={pickPosCurrency(receipt.currency, listCurrency)}
                />
              ))}
            </div>
          ) : showNoResults ? (
            <div className="text-center py-12">
              <ReceiptIcon
                className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2"
                aria-hidden="true"
              />
              <p className="text-gray-500 dark:text-gray-400">
                No receipts found
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Try a different search term
              </p>
            </div>
          ) : showEmptySearch ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <FileText
                className="w-12 h-12 mx-auto mb-2 opacity-50"
                aria-hidden="true"
              />
              <p>
                Enter a receipt number or customer name to search
              </p>
            </div>
          ) : null}
        </div>

        {selectedReceipt && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {selectedReceipt.receiptNumber}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1 truncate">
                    <User
                      className="w-3 h-3 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {selectedReceipt.customerName}
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    {formatPosCurrency(selectedReceipt.total, selectedCurrency)}
                  </span>
                  <span className="flex items-center gap-1 tabular-nums">
                    <Clock
                      className="w-3 h-3 flex-shrink-0"
                      aria-hidden="true"
                    />
                    {formatDate(selectedReceipt.createdAt)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleReprint()}
                disabled={reprinting || selectedReceipt.status === 'voided'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
              >
                {reprinting ? (
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Printer className="w-4 h-4" aria-hidden="true" />
                )}
                {reprinting ? 'Reprinting…' : 'Reprint'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ReceiptResultItemProps {
  receipt: ReceiptRow;
  isSelected: boolean;
  onSelect: () => void;
  currency?: string;
}

function getStatusBadgeClasses(status: ReceiptRow['status']): string {
  switch (status) {
    case 'printed':
      return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
    case 'sent':
      return 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300';
    case 'voided':
      return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
    case 'issued':
    default:
      return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
  }
}

function ReceiptResultItem({
  receipt,
  isSelected,
  onSelect,
  currency,
}: ReceiptResultItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={isSelected}
      className={`w-full p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center justify-between text-left focus-ring ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ReceiptIcon
            className="w-4 h-4 text-gray-500 flex-shrink-0"
            aria-hidden="true"
          />
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {receipt.receiptNumber}
          </p>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(
              receipt.status,
            )}`}
          >
            {receipt.status}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
          <span className="flex items-center gap-1 truncate">
            <User className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
            {receipt.customerName}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            {formatPosCurrency(receipt.total, currency)}
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <Calendar
              className="w-3 h-3 flex-shrink-0"
              aria-hidden="true"
            />
            {formatDate(receipt.createdAt)}
          </span>
        </div>
      </div>
      {isSelected && (
        <Check
          className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-3"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export default ReprintReceiptModal;