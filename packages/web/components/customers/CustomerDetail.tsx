// packages/web/components/customers/CustomerDetail.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Award,
  ShoppingBag,
  Calendar,
  Clock,
  Star,
  DollarSign,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { customerService } from '../../services/customerService';
import type {
  CustomerDetail as CustomerDetailShape,
  CustomerSale,
  CustomerStats,
  LoyaltyHistoryEntry,
} from '../../services/customerService';
import { formatCurrency } from '../../utils/formatters';
import { toast } from '../../utils/toast-manager';

// ============================================
// TYPES
// ============================================

type TabKey = 'overview' | 'purchases' | 'loyalty' | 'notes';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'notes', label: 'Notes' },
];

// ============================================
// HELPERS
// ============================================

/**
 * Extract the customer id from `useParams()`. Guards against the
 * value being an array (catch-all routes) or undefined.
 */
function readIdParam(params: ReturnType<typeof useParams>): string | null {
  const raw = (params as Record<string, unknown>)?.id;
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return null;
}

/**
 * Loyalty tier thresholds. The floor is the value the previous tier
 * ends at (exclusive). Used for both the tier label and the progress
 * bar's "next tier" target.
 */
const TIER_THRESHOLDS = [0, 200, 500, 1000] as const;

interface Tier {
  label: string;
  icon: typeof Award;
  floor: number;
  nextFloor: number | null;
}

function getLoyaltyTier(points: number): Tier {
  if (points >= 1000) {
    return { label: 'Platinum', icon: Star, floor: 1000, nextFloor: null };
  }
  if (points >= 500) {
    return { label: 'Gold', icon: Award, floor: 500, nextFloor: 1000 };
  }
  if (points >= 200) {
    return { label: 'Silver', icon: Award, floor: 200, nextFloor: 500 };
  }
  return { label: 'Bronze', icon: Award, floor: 0, nextFloor: 200 };
}

/**
 * Progress from the current tier's floor to the next tier's floor,
 * expressed 0–100. Returns 100 when the customer is at the top tier
 * (there's nothing left to reach).
 */
function tierProgress(points: number, tier: Tier): number {
  if (tier.nextFloor === null) return 100;
  const span = tier.nextFloor - tier.floor;
  if (span <= 0) return 100;
  const progress = ((points - tier.floor) / span) * 100;
  return Math.max(0, Math.min(100, progress));
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
  } catch {
    return '—';
  }
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  try {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  } catch {
    return '—';
  }
}

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

/**
 * Derive the customer's most recent purchase date.
 *
 * Prefers `lastPurchaseAt` (a denormalized column the backend
 * sometimes returns), falls back to the newest sale in
 * `customer.sales` when present.
 */
function deriveLastPurchaseAt(
  customer: CustomerDetailShape | null,
): string | null {
  if (!customer) return null;
  const explicit = (customer as any).lastPurchaseAt;
  if (typeof explicit === 'string' && explicit.length > 0) return explicit;

  const sales = Array.isArray(customer.sales) ? customer.sales : [];
  if (sales.length === 0) return null;

  // `getCustomerById` orders sales by `saleDate: 'desc'`, so [0] is
  // the most recent.
  const first = sales[0]?.saleDate;
  return typeof first === 'string' ? first : null;
}

// ============================================
// COMPONENT
// ============================================

export function CustomerDetail() {
  const params = useParams();
  const router = useRouter();
  const id = readIdParam(params);

  const [customer, setCustomer] = useState<CustomerDetailShape | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // ── Notes state ───────────────────────────────────────────
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  // ── Purchases tab — lazily fetched ────────────────────────
  const [sales, setSales] = useState<CustomerSale[] | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  // ── Concurrency guards ────────────────────────────────────
  const fetchRequestIdRef = useRef(0);
  const notesRequestIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load customer + stats ─────────────────────────────────

  const loadData = useCallback(async (customerId: string) => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const [customerData, statsData] = await Promise.all([
        customerService.getCustomerById(customerId),
        customerService.getCustomerStats(customerId),
      ]);

      if (requestId !== fetchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      setCustomer(customerData);
      setStats(statsData);
      setNotes(customerData?.notes ?? '');
    } catch (error) {
      if (requestId !== fetchRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const message = extractErrorMessage(error, 'Failed to load customer');
      console.error('[CustomerDetail] load failed:', message);
      setLoadError(message);
      toast.error(message);
    } finally {
      if (requestId === fetchRequestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setLoadError('Invalid customer id');
      return;
    }
    void loadData(id);
  }, [id, loadData]);

  // ── Lazily fetch paginated sales when the tab opens ───────

  useEffect(() => {
    if (activeTab !== 'purchases') return;
    if (!id) return;
    if (sales !== null) return; // already fetched

    let cancelled = false;
    setSalesLoading(true);
    setSalesError(null);

    customerService
      .getCustomerPurchaseHistory(id, { page: 1, limit: 20 })
      .then((response) => {
        if (cancelled || !mountedRef.current) return;
        setSales(response.data);
      })
      .catch((error) => {
        if (cancelled || !mountedRef.current) return;
        const message = extractErrorMessage(error, 'Failed to load purchases');
        console.error('[CustomerDetail] purchases fetch failed:', message);
        setSalesError(message);
        setSales([]);
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setSalesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, id, sales]);

  // ── Delete ────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!id) return;
    if (typeof window === 'undefined') return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this customer?',
    );
    if (!confirmed) return;

    try {
      await customerService.deleteCustomer(id);
      toast.success('Customer deleted');
      router.push('/customers');
    } catch (error) {
      const message = extractErrorMessage(error, 'Failed to delete customer');
      console.error('[CustomerDetail] delete failed:', message);
      toast.error(message);
    }
  }, [id, router]);

  // ── Save notes ────────────────────────────────────────────

  const handleSaveNotes = useCallback(async () => {
    if (!customer) return;
    if (notesSaving) return;
    if (notes === (customer.notes ?? '')) return;

    const requestId = ++notesRequestIdRef.current;
    setNotesSaving(true);

    try {
      const updated = await customerService.updateCustomer(customer.id, {
        notes,
      });

      if (requestId !== notesRequestIdRef.current) return;
      if (!mountedRef.current) return;

      setCustomer((prev) =>
        prev ? { ...prev, notes: updated?.notes ?? notes } : prev,
      );
      toast.success('Notes saved');
    } catch (error) {
      if (requestId !== notesRequestIdRef.current) return;
      if (!mountedRef.current) return;

      const message = extractErrorMessage(error, 'Failed to save notes');
      console.error('[CustomerDetail] notes save failed:', message);
      toast.error(message);
      // Roll back the local draft to what the server actually has.
      setNotes(customer.notes ?? '');
    } finally {
      if (requestId === notesRequestIdRef.current && mountedRef.current) {
        setNotesSaving(false);
      }
    }
  }, [customer, notes, notesSaving]);

  // ── Derived values ────────────────────────────────────────

  const tier = useMemo(
    () => getLoyaltyTier(customer?.loyaltyPoints ?? 0),
    [customer?.loyaltyPoints],
  );
  const progress = useMemo(
    () => tierProgress(customer?.loyaltyPoints ?? 0, tier),
    [customer?.loyaltyPoints, tier],
  );
  const lastPurchaseAt = useMemo(
    () => deriveLastPurchaseAt(customer),
    [customer],
  );

  // ── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────

  if (loadError || !customer) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-danger-500 mx-auto" />
        <p className="text-gray-700 dark:text-gray-300">
          {loadError ?? 'Customer not found'}
        </p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => id && loadData(id)}
            className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all focus-ring"
          >
            Retry
          </button>
          <Link
            href="/customers"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-orange-50 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors focus-ring"
          >
            Back to customers
          </Link>
        </div>
      </div>
    );
  }

  const TierIcon = tier.icon;

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/customers')}
            className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
            aria-label="Back to customers"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 text-2xl font-bold">
              {customer.firstName?.[0] ?? '?'}
              {customer.lastName?.[0] ?? ''}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {customer.fullName ||
                  `${customer.firstName} ${customer.lastName}`.trim()}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {customer.email}
                  </span>
                )}
                {customer.phoneNumber && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {customer.phoneNumber}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/customers/${customer.id}/edit`}
            className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all flex items-center gap-2 focus-ring"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg transition-colors flex items-center gap-2 focus-ring"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Loyalty Card */}
      <div className="bg-brand-gradient rounded-2xl shadow-brand p-6 mb-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/85">Loyalty Status</p>
            <div className="flex items-center gap-3 mt-1">
              <TierIcon className="w-8 h-8" />
              <h2 className="text-2xl font-bold">{tier.label}</h2>
            </div>
            <p className="text-white/85 mt-1 tabular-nums">
              {customer.loyaltyPoints || 0} points
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/85">Total Spent</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatCurrency(customer.totalSpent || 0)}
            </p>
          </div>
        </div>
        <div
          className="mt-4 w-full bg-white/25 rounded-full h-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label={
            tier.nextFloor !== null
              ? `Progress to next tier (${tier.nextFloor} points)`
              : 'Top tier reached'
          }
        >
          <div
            className="bg-white h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Orders</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {stats?.totalOrders || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-success-600 dark:text-success-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Average Order
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(stats?.averageSaleValue || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Last Purchase
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {lastPurchaseAt ? formatDate(lastPurchaseAt) : 'Never'}
              </p>
            </div>
          </div>
        </div>
        <div className="card-brand !p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-warning-600 dark:text-warning-400" />
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Member Since
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card-brand !p-0 overflow-hidden">
        <div
          className="border-b border-gray-200 dark:border-gray-700 px-6"
          role="tablist"
          aria-label="Customer details"
        >
          <nav className="flex gap-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`panel-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 border-b-2 font-medium text-sm transition-colors focus-ring rounded-t ${
                  activeTab === tab.key
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* ── Overview ───────────────────────────────── */}
          {activeTab === 'overview' && (
            <div
              id="panel-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
              className="space-y-6"
            >
              {customer.address && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Address
                  </h3>
                  <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {customer.address}
                      {customer.city && `, ${customer.city}`}
                      {customer.state && `, ${customer.state}`}
                      {customer.zipCode && ` ${customer.zipCode}`}
                      {customer.country && `, ${customer.country}`}
                    </span>
                  </div>
                </div>
              )}

              {!customer.address && !customer.notes && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No details recorded for this customer yet.
                </p>
              )}
            </div>
          )}

          {/* ── Purchases ──────────────────────────────── */}
          {activeTab === 'purchases' && (
            <div
              id="panel-purchases"
              role="tabpanel"
              aria-labelledby="tab-purchases"
            >
              {salesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                </div>
              ) : salesError ? (
                <p className="text-center text-danger-600 dark:text-danger-400 py-8">
                  {salesError}
                </p>
              ) : sales && sales.length > 0 ? (
                <div className="space-y-3">
                  {sales.map((sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white font-mono tabular-nums">
                          #{sale.receiptNumber}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                          {formatDateTime(sale.saleDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                          {formatCurrency(sale.total)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                          {sale.items?.length || 0} item
                          {(sale.items?.length || 0) === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No purchase history
                </p>
              )}
            </div>
          )}

          {/* ── Loyalty ────────────────────────────────── */}
          {activeTab === 'loyalty' && (
            <div
              id="panel-loyalty"
              role="tabpanel"
              aria-labelledby="tab-loyalty"
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Current Points
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {customer.loyaltyPoints || 0}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Points to Next Tier
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                    {tier.nextFloor !== null
                      ? Math.max(0, tier.nextFloor - (customer.loyaltyPoints || 0))
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Loyalty history */}
              {Array.isArray(customer.loyaltyHistory) &&
                customer.loyaltyHistory.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Recent Activity
                    </h3>
                    <ul className="space-y-2">
                      {customer.loyaltyHistory
                        .slice(0, 10)
                        .map((entry: LoyaltyHistoryEntry) => (
                          <li
                            key={entry.id}
                            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {entry.notes || entry.type}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                                {formatDate(entry.createdAt)}
                              </p>
                            </div>
                            <span
                              className={`text-sm font-medium tabular-nums ${
                                entry.points >= 0
                                  ? 'text-success-600 dark:text-success-400'
                                  : 'text-danger-600 dark:text-danger-400'
                              }`}
                            >
                              {entry.points >= 0 ? '+' : ''}
                              {entry.points}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

              <div className="p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                <p className="text-sm text-warning-700 dark:text-warning-300">
                  💡 Earn 1 point for every $1 spent. Redeem 100 points for $1
                  off.
                </p>
              </div>
            </div>
          )}

          {/* ── Notes ──────────────────────────────────── */}
          {activeTab === 'notes' && (
            <div
              id="panel-notes"
              role="tabpanel"
              aria-labelledby="tab-notes"
              className="space-y-3"
            >
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={notesSaving}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow disabled:opacity-50"
                rows={4}
                placeholder="Add a note about this customer..."
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Changes save when you click Save.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveNotes()}
                  disabled={notesSaving || notes === (customer.notes ?? '')}
                  className="px-4 py-2 bg-brand-gradient text-white rounded-lg shadow-brand hover:shadow-brand-lg transition-all disabled:opacity-50 focus-ring flex items-center gap-2"
                >
                  {notesSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save Notes'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerDetail;
