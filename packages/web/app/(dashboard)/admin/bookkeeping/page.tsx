// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\bookkeeping\page.tsx

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CalculatorIcon,
  ChartBarIcon,
  ChartPieIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  DocumentTextIcon,
  PlusIcon,
  RectangleStackIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { bookkeepingService } from '../../../../services/bookkeepingService';
import { useToast } from '../../../../hooks/useToast';
import { formatCurrency, formatDate } from '../../../../utils/helpers';

// ============================================================
// TYPES
// ============================================================

interface AccountRow {
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

interface JournalEntrySummary {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  reference?: string;
  status?: string;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
}

interface TrialBalanceSummary {
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  accountCount: number;
}

// ============================================================
// HELPERS
// ============================================================

function accountTypeTone(type: string): string {
  switch (type) {
    case 'ASSET':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'LIABILITY':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    case 'EQUITY':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'REVENUE':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
    case 'EXPENSE':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
  }
}

function entryStatusTone(status: string | undefined): string {
  switch (status?.toUpperCase()) {
    case 'POSTED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'DRAFT':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'VOID':
    case 'VOIDED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400';
  }
}

// ============================================================
// COMPONENT
// ============================================================

export default function BookkeepingOverviewPage() {
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [entries, setEntries] = useState<JournalEntrySummary[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceSummary | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ────────────────────────────────────────────────────────────
  // DATA LOADING
  // ────────────────────────────────────────────────────────────
  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        // Fetch accounts and recent journal entries in parallel.
        const [accountsResult, entriesResult] = await Promise.allSettled([
          bookkeepingService.getAccounts({ isActive: true }),
          bookkeepingService.getJournalEntries({ page: 1, limit: 5 }),
        ]);

        // ── Accounts ──
        if (accountsResult.status === 'fulfilled') {
          const raw = accountsResult.value as any;
          const arr: any[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.data)
            ? raw.data
            : [];

          const normalized: AccountRow[] = arr.map((a: any) => {
            const lines: any[] = a.lines || [];
            const debit = lines.reduce(
              (s: number, l: any) => s + (l.debit || 0),
              0
            );
            const credit = lines.reduce(
              (s: number, l: any) => s + (l.credit || 0),
              0
            );
            return {
              id: a.id,
              code: a.code,
              name: a.name,
              type: a.type,
              category: a.category,
              isActive: a.isActive,
              debit,
              credit,
              balance: debit - credit,
            };
          });

          setAccounts(normalized);

          // Derive a lightweight trial balance from the account rows.
          const totalDebits = normalized.reduce((s, a) => s + a.debit, 0);
          const totalCredits = normalized.reduce((s, a) => s + a.credit, 0);
          setTrialBalance({
            totalDebits,
            totalCredits,
            isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
            accountCount: normalized.length,
          });
        } else {
          console.warn(
            '[BookkeepingOverview] accounts fetch failed:',
            accountsResult.reason
          );
          setAccounts([]);
          setTrialBalance({
            totalDebits: 0,
            totalCredits: 0,
            isBalanced: true,
            accountCount: 0,
          });
        }

        // ── Recent journal entries ──
        if (entriesResult.status === 'fulfilled') {
          const raw = entriesResult.value as any;
          const arr: any[] = Array.isArray(raw?.data)
            ? raw.data
            : Array.isArray(raw)
            ? raw
            : [];

          const normalized: JournalEntrySummary[] = arr.map((e: any) => {
            const lines: any[] = e.lines || [];
            const totalDebit = lines.reduce(
              (s: number, l: any) => s + (l.debit || 0),
              0
            );
            const totalCredit = lines.reduce(
              (s: number, l: any) => s + (l.credit || 0),
              0
            );
            return {
              id: e.id,
              entryNumber: e.entryNumber,
              date: e.date,
              description: e.description,
              reference: e.reference,
              status: e.status,
              totalDebit,
              totalCredit,
              lineCount: lines.length,
            };
          });

          setEntries(normalized);
        } else {
          console.warn(
            '[BookkeepingOverview] entries fetch failed:',
            entriesResult.reason
          );
          setEntries([]);
        }
      } catch (err: any) {
        console.error('[BookkeepingOverview] load error:', err);
        showToast(
          err?.message || 'Failed to load bookkeeping overview',
          'error'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  // ────────────────────────────────────────────────────────────
  // DERIVED METRICS
  // ────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const totalAccounts = accounts.length;

    const byType = accounts.reduce<Record<string, number>>((acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + 1;
      return acc;
    }, {});

    const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
    const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);
    const net = totalDebit - totalCredit;

    const assetTotal = accounts
      .filter((a) => a.type === 'ASSET')
      .reduce((s, a) => s + a.balance, 0);

    const liabilityTotal = accounts
      .filter((a) => a.type === 'LIABILITY')
      .reduce((s, a) => s + a.balance, 0);

    const revenueTotal = accounts
      .filter((a) => a.type === 'REVENUE')
      .reduce((s, a) => s + Math.abs(a.balance), 0);

    const expenseTotal = accounts
      .filter((a) => a.type === 'EXPENSE')
      .reduce((s, a) => s + a.balance, 0);

    return {
      totalAccounts,
      byType,
      totalDebit,
      totalCredit,
      net,
      assetTotal,
      liabilityTotal,
      revenueTotal,
      expenseTotal,
      isBalanced: Math.abs(net) < 0.01,
    };
  }, [accounts]);

  // ────────────────────────────────────────────────────────────
  // RENDER — LOADING
  // ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Loading bookkeeping overview…
          </p>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // RENDER — MAIN
  // ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpenIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
            Bookkeeping
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Chart of accounts, journal entries, and financial reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <ArrowPathIcon
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
          <Link
            href="/admin/bookkeeping/journal-entries"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Entry
          </Link>
        </div>
      </div>

      {/* ── Balance status banner ─────────────────────────── */}
      <div
        className={`p-4 rounded-lg border ${
          summary.isBalanced
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}
      >
        <div className="flex items-start gap-3">
          <SparklesIcon
            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              summary.isBalanced
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          />
          <div className="flex-1">
            <p
              className={`font-semibold ${
                summary.isBalanced
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-red-800 dark:text-red-300'
              }`}
            >
              {summary.isBalanced
                ? 'Your books are balanced'
                : `Your books are out of balance by ${formatCurrency(
                    Math.abs(summary.net)
                  )}`}
            </p>
            <p
              className={`text-sm mt-0.5 ${
                summary.isBalanced
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {summary.isBalanced
                ? `Total debits equal total credits across ${summary.totalAccounts} account${
                    summary.totalAccounts === 1 ? '' : 's'
                  }.`
                : `Total debits (${formatCurrency(
                    summary.totalDebit
                  )}) do not equal total credits (${formatCurrency(
                    summary.totalCredit
                  )}). Review recent journal entries.`}
            </p>
          </div>
          <Link
            href="/admin/bookkeeping/reports/trial-balance"
            className={`flex items-center gap-1 text-sm font-medium whitespace-nowrap ${
              summary.isBalanced
                ? 'text-green-700 dark:text-green-300 hover:text-green-900'
                : 'text-red-700 dark:text-red-300 hover:text-red-900'
            }`}
          >
            View trial balance
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Assets"
          value={formatCurrency(summary.assetTotal)}
          tone="positive"
          subtitle={`${summary.byType.ASSET ?? 0} account${
            (summary.byType.ASSET ?? 0) === 1 ? '' : 's'
          }`}
          icon={ChartBarIcon}
        />
        <SummaryCard
          label="Total Liabilities"
          value={formatCurrency(summary.liabilityTotal)}
          tone="negative"
          subtitle={`${summary.byType.LIABILITY ?? 0} account${
            (summary.byType.LIABILITY ?? 0) === 1 ? '' : 's'
          }`}
          icon={ChartBarIcon}
        />
        <SummaryCard
          label="Total Revenue"
          value={formatCurrency(summary.revenueTotal)}
          tone="positive"
          subtitle={`${summary.byType.REVENUE ?? 0} account${
            (summary.byType.REVENUE ?? 0) === 1 ? '' : 's'
          }`}
          icon={ChartBarIcon}
        />
        <SummaryCard
          label="Total Expenses"
          value={formatCurrency(summary.expenseTotal)}
          tone="warning"
          subtitle={`${summary.byType.EXPENSE ?? 0} account${
            (summary.byType.EXPENSE ?? 0) === 1 ? '' : 's'
          }`}
          icon={ChartBarIcon}
        />
      </div>

      {/* ── Quick links ───────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Navigate
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLink
            href="/admin/bookkeeping/accounts"
            title="Chart of Accounts"
            description="Manage the accounts your business uses"
            icon={RectangleStackIcon}
            tone="blue"
          />
          <QuickLink
            href="/admin/bookkeeping/journal-entries"
            title="Journal Entries"
            description="Record and review double-entry transactions"
            icon={DocumentTextIcon}
            tone="purple"
          />
          <QuickLink
            href="/admin/bookkeeping/reports"
            title="Financial Reports"
            description="Balance sheet, income statement, trial balance"
            icon={ChartPieIcon}
            tone="green"
          />
          <QuickLink
            href="/admin/bookkeeping/reports/balance-sheet"
            title="Balance Sheet"
            description="Assets, liabilities, and equity at a point in time"
            icon={ChartBarIcon}
            tone="blue"
          />
          <QuickLink
            href="/admin/bookkeeping/reports/income-statement"
            title="Income Statement"
            description="Revenue, costs, and profit over a period"
            icon={ChartPieIcon}
            tone="green"
          />
          <QuickLink
            href="/admin/bookkeeping/reports/trial-balance"
            title="Trial Balance"
            description="Summary of all account balances with balance check"
            icon={CalculatorIcon}
            tone="purple"
          />
        </div>
      </div>

      {/* ── Recent journal entries ────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Journal Entries
          </h2>
          <Link
            href="/admin/bookkeeping/journal-entries"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            View all
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </div>

        {entries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <DocumentTextIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-base font-medium text-gray-900 dark:text-white">
              No journal entries yet
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Create your first journal entry to see it here.
            </p>
            <Link
              href="/admin/bookkeeping/journal-entries"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Create journal entry
            </Link>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/admin/bookkeeping/journal-entries/${entry.id}`}
                className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {entry.entryNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${entryStatusTone(
                          entry.status
                        )}`}
                      >
                        {entry.status ?? 'POSTED'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-white truncate mt-0.5">
                      {entry.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {formatDate(entry.date)}
                      </span>
                      {entry.reference && (
                        <span>· Ref {entry.reference}</span>
                      )}
                      <span>
                        · {entry.lineCount} line
                        {entry.lineCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Debit / Credit
                    </p>
                    <p className="font-mono text-sm text-gray-900 dark:text-white">
                      {formatCurrency(entry.totalDebit)} /{' '}
                      {formatCurrency(entry.totalCredit)}
                    </p>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Account breakdown by type ─────────────────────── */}
      {accounts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Account Breakdown
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const).map(
                (type) => {
                  const count = summary.byType[type] ?? 0;
                  const total = accounts
                    .filter((a) => a.type === type)
                    .reduce((s, a) => s + Math.abs(a.balance), 0);
                  return (
                    <div
                      key={type}
                      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {type}
                      </p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                        {count}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatCurrency(total)}
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function SummaryCard({
  label,
  value,
  subtitle,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone: 'positive' | 'negative' | 'warning' | 'default';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneClass = {
    positive: 'text-green-600 dark:text-green-400',
    negative: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    default: 'text-gray-900 dark:text-white',
  }[tone];

  const iconTone = {
    positive: 'text-green-500 dark:text-green-400',
    negative: 'text-red-500 dark:text-red-400',
    warning: 'text-yellow-500 dark:text-yellow-400',
    default: 'text-blue-500 dark:text-blue-400',
  }[tone];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <Icon className={`w-6 h-6 flex-shrink-0 ${iconTone}`} />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon: Icon,
  tone,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'blue' | 'purple' | 'green';
}) {
  const toneClass = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
  }[tone];

  return (
    <Link
      href={href}
      className="group bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow"
    >
      <Icon className={`w-7 h-7 mb-2 ${toneClass}`} />
      <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        {description}
      </p>
      <span className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-2 group-hover:gap-2 transition-all">
        Open
        <ArrowRightIcon className="w-4 h-4" />
      </span>
    </Link>
  );
}
