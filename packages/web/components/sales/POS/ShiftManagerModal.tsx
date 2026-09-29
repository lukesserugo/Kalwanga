// packages/web/components/pos/ShiftManagerModal.tsx
'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  X,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  DollarSign,
  Calendar,
  Users,
  RefreshCw,
  Play,
  StopCircle,
  History,
  TrendingUp,
  CreditCard,
  Wallet,
  ChevronDown,
  ChevronUp,
  User,
  Receipt,
  BarChart3,
  ArrowUpRight,
  Smartphone,
  Banknote,
} from 'lucide-react';

import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDuration,
} from '../../../utils/formatters';
import { shiftService } from '../../../services/shiftService';
import { toast } from '../../../utils/toast-manager';
import { useAuth } from '../../../hooks/useAuth';

// ============================================
// TYPES
// ============================================

interface ShiftSummary {
  totalSales: number;
  totalRevenue: number;
  averageTicket: number;
  cashReceived?: number;
  cardReceived?: number;
  mobileReceived?: number;
  otherReceived?: number;
  cashOut?: number;
  cashIn?: number;
}

interface Shift {
  id: string;
  cashRegisterId: string;
  cashRegister: {
    id: string;
    name: string;
    code: string;
  };
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  endingBalance?: number;
  expectedEndingBalance?: number;
  discrepancy?: number;
  status: 'OPEN' | 'CLOSED' | 'VOID' | 'PENDING';
  userId: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
  notes?: string;
  summary?: ShiftSummary;
  sales?: unknown[];
  payments?: unknown[];
  cashTransactions?: unknown[];
}

interface Register {
  id: string;
  name: string;
  code: string;
  cashBalance: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING' | 'SUSPENDED';
  isActive: boolean;
  currentSessionId?: string;
}

interface TopCashier {
  userId: string;
  userName: string;
  shiftCount: number;
  totalRevenue: number;
}

interface ShiftStats {
  totalShifts: number;
  openShifts: number;
  closedShifts: number;
  totalRevenue: number;
  averageShiftDuration: number;
  averageShiftRevenue: number;
  topCashiers: TopCashier[];
}

interface ShiftManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShiftChanged?: () => void;
}

type TabKey = 'current' | 'history' | 'stats';

/**
 * Live comparison between the operator's entered ending balance and
 * the system's expected balance.
 */
interface DiscrepancyInfo {
  /** Positive = over, negative = short, 0 = exact. */
  amount: number;
  absolute: number;
  direction: 'over' | 'short' | 'exact';
  /** True when the discrepancy magnitude exceeds the alert threshold. */
  significant: boolean;
  expected: number;
}

// ============================================
// CONSTANTS
// ============================================

const TABS: Array<{ key: TabKey; label: string; Icon: React.ElementType }> = [
  { key: 'current', label: 'Current Shift', Icon: Clock },
  { key: 'history', label: 'History', Icon: History },
  { key: 'stats', label: 'Statistics', Icon: BarChart3 },
];

/**
 * Discrepancies above this amount are flagged for the operator.
 * Below it, the difference is displayed but not called out
 * aggressively — small rounding differences are normal.
 */
const DISCREPANCY_ALERT_THRESHOLD = 1;

// ============================================
// HELPERS
// ============================================

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

function parseMoney(input: string): number {
  if (!input) return 0;
  const n = parseFloat(input);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/**
 * Format a shift duration from its start and (optional) end
 * timestamps. Uses the shared `formatDuration` from `formatters` so
 * the whole app renders durations identically.
 */
function formatShiftDuration(startIso: string, endIso?: string): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return '—';
  }
  const seconds = Math.floor((end - start) / 1000);
  return formatDuration(seconds);
}

interface StatusConfig {
  label: string;
  classes: string;
  Icon: React.ElementType;
}

function getStatusConfig(status: string): StatusConfig {
  switch (status) {
    case 'OPEN':
      return {
        label: 'Open',
        classes:
          'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
        Icon: CheckCircle,
      };
    case 'CLOSED':
      return {
        label: 'Closed',
        classes:
          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
        Icon: CheckCircle,
      };
    case 'VOID':
      return {
        label: 'Void',
        classes:
          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
        Icon: AlertCircle,
      };
    case 'PENDING':
    default:
      return {
        label: 'Pending',
        classes:
          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
        Icon: Clock,
      };
  }
}

/**
 * Normalize a raw shift returned by the service. Handles the two
 * shapes `shiftService` may produce:
 *
 *   1. A fully-hydrated `Shift` with `cashRegister` and `user`
 *      relations populated.
 *   2. A flat row with only `cashRegisterId` / `userId` — the
 *      modal fills in "Unknown" placeholders.
 */
function normalizeShift(raw: unknown): Shift | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === 'string' ? r.id : null;
  if (!id) return null;

  const cashRegisterId =
    typeof r.cashRegisterId === 'string' ? r.cashRegisterId : '';

  const cashRegister =
    r.cashRegister && typeof r.cashRegister === 'object'
      ? {
          id: String((r.cashRegister as any).id ?? cashRegisterId),
          name: String((r.cashRegister as any).name ?? 'Unknown'),
          code: String((r.cashRegister as any).code ?? 'N/A'),
        }
      : { id: cashRegisterId, name: 'Unknown', code: 'N/A' };

  const userId = typeof r.userId === 'string' ? r.userId : '';

  const user =
    r.user && typeof r.user === 'object'
      ? {
          id: String((r.user as any).id ?? userId),
          firstName: String((r.user as any).firstName ?? ''),
          lastName: String((r.user as any).lastName ?? ''),
          email: typeof (r.user as any).email === 'string'
            ? (r.user as any).email
            : undefined,
        }
      : undefined;

  const rawStatus = typeof r.status === 'string' ? r.status.toUpperCase() : 'PENDING';
  const status: Shift['status'] =
    rawStatus === 'OPEN' ||
    rawStatus === 'CLOSED' ||
    rawStatus === 'VOID' ||
    rawStatus === 'PENDING'
      ? rawStatus
      : 'PENDING';

  const summaryRaw =
    r.summary && typeof r.summary === 'object'
      ? (r.summary as Record<string, unknown>)
      : null;

  const summary = summaryRaw
    ? {
        totalSales: toNumber(summaryRaw.totalSales),
        totalRevenue: toNumber(summaryRaw.totalRevenue),
        averageTicket: toNumber(summaryRaw.averageTicket),
        cashReceived: toNumber(summaryRaw.cashReceived),
        cardReceived: toNumber(summaryRaw.cardReceived),
        mobileReceived: toNumber(summaryRaw.mobileReceived),
        otherReceived: toNumber(summaryRaw.otherReceived),
        cashIn: toNumber(summaryRaw.cashIn),
        cashOut: toNumber(summaryRaw.cashOut),
      }
    : undefined;

  return {
    id,
    cashRegisterId,
    cashRegister,
    openedAt:
      typeof r.openedAt === 'string' ? r.openedAt : new Date().toISOString(),
    closedAt: typeof r.closedAt === 'string' ? r.closedAt : undefined,
    startingBalance: toNumber(r.startingBalance),
    endingBalance:
      typeof r.endingBalance === 'number'
        ? r.endingBalance
        : typeof r.endingBalance === 'string'
        ? parseMoney(r.endingBalance)
        : undefined,
    expectedEndingBalance:
      typeof r.expectedEndingBalance === 'number'
        ? r.expectedEndingBalance
        : undefined,
    discrepancy:
      typeof r.discrepancy === 'number' ? r.discrepancy : undefined,
    status,
    userId,
    user,
    notes: typeof r.notes === 'string' ? r.notes : undefined,
    summary,
  };
}

function normalizeRegister(raw: unknown): Register | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === 'string' ? r.id : null;
  if (!id) return null;

  const rawStatus = typeof r.status === 'string' ? r.status.toUpperCase() : '';
  const status: Register['status'] =
    rawStatus === 'OPEN' ||
    rawStatus === 'CLOSED' ||
    rawStatus === 'PENDING' ||
    rawStatus === 'SUSPENDED'
      ? rawStatus
      : 'CLOSED';

  return {
    id,
    name: typeof r.name === 'string' ? r.name : 'Unnamed Register',
    code: typeof r.code === 'string' ? r.code : '',
    cashBalance: toNumber(r.cashBalance),
    status,
    isActive: r.isActive !== false,
    currentSessionId:
      typeof r.currentSessionId === 'string' ? r.currentSessionId : undefined,
  };
}

function normalizeShiftStats(raw: unknown): ShiftStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const topCashiersRaw = Array.isArray(r.topCashiers) ? r.topCashiers : [];

  return {
    totalShifts: toNumber(r.totalShifts),
    openShifts: toNumber(r.openShifts),
    closedShifts: toNumber(r.closedShifts),
    totalRevenue: toNumber(r.totalRevenue),
    averageShiftDuration: toNumber(r.averageShiftDuration),
    averageShiftRevenue: toNumber(r.averageShiftRevenue),
    topCashiers: topCashiersRaw
      .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
      .map((c) => ({
        userId: typeof c.userId === 'string' ? c.userId : '',
        userName: typeof c.userName === 'string' ? c.userName : 'Unknown',
        shiftCount: toNumber(c.shiftCount),
        totalRevenue: toNumber(c.totalRevenue),
      })),
  };
}

// ============================================
// COMPONENT
// ============================================

export function ShiftManagerModal({
  isOpen,
  onClose,
  onShiftChanged,
}: ShiftManagerModalProps) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [shiftHistory, setShiftHistory] = useState<Shift[]>([]);
  const [shiftStats, setShiftStats] = useState<ShiftStats | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('current');
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [startingBalanceInput, setStartingBalanceInput] = useState('');
  const [startNotes, setStartNotes] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  const [endingBalanceInput, setEndingBalanceInput] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const mountedRef = useRef(true);
  const fetchRequestIdRef = useRef(0);
  const startInFlightRef = useRef(false);
  const closeInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Reset on open transition ─────────────────────────────

  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      setActiveTab('current');
      setExpandedShiftId(null);
      setSelectedRegisterId('');
      setStartingBalanceInput('');
      setStartNotes('');
      setEndingBalanceInput('');
      setCloseNotes('');
      setIsStarting(false);
      setIsClosing(false);
      setLoadError(null);
    }
  }, [isOpen]);

  // ── Load ─────────────────────────────────────────────────

  const loadAllShiftData = useCallback(async (): Promise<boolean> => {
    const requestId = ++fetchRequestIdRef.current;
    setLoading(true);
    setLoadError(null);

    // Load each section independently. A failure in one doesn't
    // blank the others — but we track overall failure so the UI can
    // distinguish "no data" from "couldn't load".
    const results = await Promise.allSettled([
      shiftService.getCurrentShift(),
      shiftService.getRegisters({ isActive: true }),
      shiftService.getAllShifts({ page: 1, limit: 20 }),
      shiftService.getShiftStats(),
    ]);

    if (requestId !== fetchRequestIdRef.current) return false;
    if (!mountedRef.current) return false;

    const [currentResult, registersResult, historyResult, statsResult] =
      results;

    const errors: string[] = [];

    // ── Current shift ──────────────────────────────────────
    if (currentResult.status === 'fulfilled') {
      const normalized = normalizeShift(currentResult.value);
      setCurrentShift(normalized);
    } else {
      console.error(
        '[ShiftManagerModal] current shift load failed:',
        currentResult.reason,
      );
      errors.push(
        extractErrorMessage(
          currentResult.reason,
          'Failed to load current shift',
        ),
      );
      setCurrentShift(null);
    }

    // ── Registers ──────────────────────────────────────────
    if (registersResult.status === 'fulfilled') {
      const raw: unknown = registersResult.value;

      // Narrow to `unknown[]` before mapping so the chain is fully
      // typed. Without this, `list` is `any` and the subsequent
      // `.filter((x): x is Register => …)` fails with TS7006 — the
      // type predicate requires `x` to be inferable, and `any` isn't.
      const list: unknown[] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as any).data)
        ? ((raw as any).data as unknown[])
        : [];

      const normalized: Register[] = list
        .map(normalizeRegister)
        .filter((x: Register | null): x is Register => x !== null);

      setRegisters(normalized);
    } else {
      console.error(
        '[ShiftManagerModal] registers load failed:',
        registersResult.reason,
      );
      errors.push(
        extractErrorMessage(
          registersResult.reason,
          'Failed to load registers',
        ),
      );
      setRegisters([]);
    }

    // ── History ────────────────────────────────────────────
    if (historyResult.status === 'fulfilled') {
      const raw: unknown = historyResult.value;

      // Same treatment — narrow to `unknown[]` so the `.map` /
      // `.filter` chain has well-typed parameters.
      let list: unknown[] = [];
      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (Array.isArray(obj.shifts)) {
          list = obj.shifts as unknown[];
        } else if (Array.isArray(obj.data)) {
          list = obj.data as unknown[];
        }
      } else if (Array.isArray(raw)) {
        list = raw as unknown[];
      }

      const normalized: Shift[] = list
        .map(normalizeShift)
        .filter((x: Shift | null): x is Shift => x !== null);

      setShiftHistory(normalized);
    } else {
      console.error(
        '[ShiftManagerModal] history load failed:',
        historyResult.reason,
      );
      errors.push(
        extractErrorMessage(
          historyResult.reason,
          'Failed to load shift history',
        ),
      );
      setShiftHistory([]);
    }

    // ── Stats ──────────────────────────────────────────────
    if (statsResult.status === 'fulfilled') {
      const normalized = normalizeShiftStats(statsResult.value);
      setShiftStats(normalized);
    } else {
      console.error(
        '[ShiftManagerModal] stats load failed:',
        statsResult.reason,
      );
      errors.push(
        extractErrorMessage(
          statsResult.reason,
          'Failed to load shift stats',
        ),
      );
      setShiftStats(null);
    }

    setLoadError(errors.length > 0 ? errors[0] : null);
    setLoading(false);
    return errors.length === 0;
  }, []);

  useEffect(() => {
    if (isOpen) void loadAllShiftData();
  }, [isOpen, loadAllShiftData]);

  // ── Auto-select register ─────────────────────────────────

  useEffect(() => {
    if (registers.length === 0) {
      setSelectedRegisterId('');
      return;
    }
    setSelectedRegisterId((prev) => {
      if (prev && registers.some((r) => r.id === prev)) return prev;
      const openRegister = registers.find((r) => r.status === 'OPEN');
      return openRegister?.id ?? registers[0].id;
    });
  }, [registers]);

  // ── Derived: close-shift discrepancy ─────────────────────
  //
  // The comparison the operator most needs to see: how their
  // entered ending balance compares to what the system expects.
  // Shown live so a mis-count is caught before Close Shift is
  // clicked.

  const expectedEndingBalance = useMemo(() => {
    if (!currentShift) return 0;
    return (
      currentShift.expectedEndingBalance ??
      currentShift.startingBalance + (currentShift.summary?.totalRevenue ?? 0)
    );
  }, [currentShift]);

  const discrepancyInfo = useMemo((): DiscrepancyInfo | null => {
    if (!currentShift) return null;
    if (endingBalanceInput.trim().length === 0) return null;

    const entered = round2(parseMoney(endingBalanceInput));
    const expected = round2(expectedEndingBalance);
    const amount = round2(entered - expected);
    const absolute = round2(Math.abs(amount));

    let direction: DiscrepancyInfo['direction'] = 'exact';
    if (amount > 0) direction = 'over';
    else if (amount < 0) direction = 'short';

    return {
      amount,
      absolute,
      direction,
      significant: absolute >= DISCREPANCY_ALERT_THRESHOLD,
      expected,
    };
  }, [currentShift, endingBalanceInput, expectedEndingBalance]);

  // ── Handlers ─────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    const ok = await loadAllShiftData();
    if (ok) {
      toast.success('Shift data refreshed');
    } else {
      toast.error('Failed to refresh shift data');
    }
  }, [loadAllShiftData]);

  const handleStartShift = useCallback(async () => {
    if (startInFlightRef.current || isStarting) return;

    if (!selectedRegisterId) {
      toast.warning('Please select a register');
      return;
    }

    const balance = parseMoney(startingBalanceInput);
    if (balance < 0) {
      toast.warning('Starting balance cannot be negative');
      return;
    }

    startInFlightRef.current = true;
    setIsStarting(true);

    try {
      const result = await shiftService.startShift({
        cashRegisterId: selectedRegisterId,
        startingBalance: balance,
        notes: startNotes.trim() || undefined,
      });

      if (!mountedRef.current) return;

      if (!result) {
        throw new Error('Shift was not created');
      }

      toast.success(`Shift started with ${formatCurrency(balance)}`);
      setStartingBalanceInput('');
      setStartNotes('');
      await loadAllShiftData();
      onShiftChanged?.();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(error, 'Failed to start shift');
      console.error('[ShiftManagerModal] start shift failed:', message);
      toast.error(message);
    } finally {
      startInFlightRef.current = false;
      if (mountedRef.current) setIsStarting(false);
    }
  }, [
    isStarting,
    selectedRegisterId,
    startingBalanceInput,
    startNotes,
    loadAllShiftData,
    onShiftChanged,
  ]);

  const handleCloseShift = useCallback(async () => {
    if (closeInFlightRef.current || isClosing) return;
    if (!currentShift) {
      toast.warning('No active shift to close');
      return;
    }

    if (endingBalanceInput.trim().length === 0) {
      toast.warning('Please enter the ending balance');
      return;
    }

    const balance = parseMoney(endingBalanceInput);
    if (balance < 0) {
      toast.warning('Ending balance cannot be negative');
      return;
    }

    // Warn on a significant discrepancy before submitting. The
    // server still records it, but the operator gets a chance to
    // re-count.
    if (discrepancyInfo && discrepancyInfo.significant) {
      const verb = discrepancyInfo.direction === 'over' ? 'over' : 'short';
      const confirmed =
        typeof window !== 'undefined' &&
        window.confirm(
          `Ending balance is ${formatCurrency(
            discrepancyInfo.absolute,
          )} ${verb} the expected ${formatCurrency(discrepancyInfo.expected)}.\n\n` +
            `Click OK to close the shift with this discrepancy, or Cancel to re-count.`,
        );
      if (!confirmed) return;
    }

    closeInFlightRef.current = true;
    setIsClosing(true);

    try {
      const result = await shiftService.endShift(currentShift.id, {
        endingBalance: balance,
        notes: closeNotes.trim() || 'Shift closed',
      });

      if (!mountedRef.current) return;

      if (!result) {
        throw new Error('Shift was not closed');
      }

      toast.success(`Shift closed with ${formatCurrency(balance)}`);
      setEndingBalanceInput('');
      setCloseNotes('');
      await loadAllShiftData();
      onShiftChanged?.();
    } catch (error) {
      if (!mountedRef.current) return;
      const message = extractErrorMessage(error, 'Failed to close shift');
      console.error('[ShiftManagerModal] close shift failed:', message);
      toast.error(message);
    } finally {
      closeInFlightRef.current = false;
      if (mountedRef.current) setIsClosing(false);
    }
  }, [
    isClosing,
    currentShift,
    endingBalanceInput,
    closeNotes,
    discrepancyInfo,
    loadAllShiftData,
    onShiftChanged,
  ]);

  const toggleShiftExpand = useCallback((shiftId: string) => {
    setExpandedShiftId((prev) => (prev === shiftId ? null : shiftId));
  }, []);

  // ── Keyboard: Escape closes ──────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isStarting && !isClosing) {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, isStarting, isClosing, onClose]);

  // ── Render ───────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-manager-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2
              id="shift-manager-title"
              className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3"
            >
              <span className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <Clock
                  className="w-5 h-5 text-orange-600 dark:text-orange-400"
                  aria-hidden="true"
                />
              </span>
              <span>Shift Manager</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Manage cash register shifts and track daily performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              aria-label="Refresh shift data"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring disabled:opacity-50"
              disabled={loading}
            >
              <RefreshCw
                className={`w-5 h-5 text-gray-500 ${
                  loading ? 'animate-spin' : ''
                }`}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isStarting || isClosing}
              aria-label="Close"
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading && !currentShift && shiftHistory.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2
              className="w-10 h-10 text-orange-500 animate-spin"
              aria-hidden="true"
            />
            <span className="ml-3 text-gray-500 dark:text-gray-400 text-lg">
              Loading shift data…
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {loadError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300"
              >
                <AlertCircle
                  className="w-4 h-4 flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <p className="flex-1">{loadError}</p>
              </div>
            )}

            {/* Tabs */}
            <div
              role="tablist"
              aria-label="Shift manager sections"
              className="flex gap-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl p-1"
            >
              {TABS.map(({ key, label, Icon }) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(key)}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all focus-ring ${
                      active
                        ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Current Shift */}
            {activeTab === 'current' && (
              <div className="space-y-6">
                <CurrentShiftCard shift={currentShift} />

                {!currentShift && (
                  <StartShiftForm
                    registers={registers}
                    selectedRegisterId={selectedRegisterId}
                    onSelectRegister={setSelectedRegisterId}
                    startingBalanceInput={startingBalanceInput}
                    onStartingBalanceChange={setStartingBalanceInput}
                    notes={startNotes}
                    onNotesChange={setStartNotes}
                    isStarting={isStarting}
                    onSubmit={() => void handleStartShift()}
                  />
                )}

                {currentShift && (
                  <CloseShiftForm
                    shift={currentShift}
                    expectedEndingBalance={expectedEndingBalance}
                    endingBalanceInput={endingBalanceInput}
                    onEndingBalanceChange={setEndingBalanceInput}
                    discrepancy={discrepancyInfo}
                    notes={closeNotes}
                    onNotesChange={setCloseNotes}
                    isClosing={isClosing}
                    onSubmit={() => void handleCloseShift()}
                  />
                )}
              </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Shift History
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                    {shiftHistory.length} shift
                    {shiftHistory.length === 1 ? '' : 's'}
                  </span>
                </div>

                {shiftHistory.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-200 dark:border-gray-700">
                    <History
                      className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"
                      aria-hidden="true"
                    />
                    <p className="text-gray-500 dark:text-gray-400">
                      No shift history available
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      Start your first shift to begin tracking
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shiftHistory.map((shift) => (
                      <ShiftHistoryItem
                        key={shift.id}
                        shift={shift}
                        isExpanded={expandedShiftId === shift.id}
                        onToggle={() => toggleShiftExpand(shift.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            {activeTab === 'stats' && shiftStats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard
                    label="Total Shifts"
                    value={shiftStats.totalShifts}
                    icon={Clock}
                    color="blue"
                  />
                  <StatCard
                    label="Open Shifts"
                    value={shiftStats.openShifts}
                    icon={Play}
                    color="green"
                  />
                  <StatCard
                    label="Total Revenue"
                    value={formatCurrency(shiftStats.totalRevenue)}
                    icon={DollarSign}
                    color="purple"
                  />
                  <StatCard
                    label="Avg. Shift Revenue"
                    value={formatCurrency(shiftStats.averageShiftRevenue)}
                    icon={TrendingUp}
                    color="orange"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Average Shift Duration
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {shiftStats.averageShiftDuration > 0
                        ? formatDuration(
                            Math.round(shiftStats.averageShiftDuration),
                          )
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Closed Shifts
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {shiftStats.closedShifts}
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        / {shiftStats.totalShifts}
                      </span>
                    </p>
                  </div>
                </div>

                {shiftStats.topCashiers.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Users
                        className="w-4 h-4 text-blue-500"
                        aria-hidden="true"
                      />
                      Top Cashiers
                    </h4>
                    <div className="space-y-2">
                      {shiftStats.topCashiers.map((cashier, index) => (
                        <div
                          key={cashier.userId || index}
                          className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-full text-xs font-bold text-blue-600 dark:text-blue-400 flex-shrink-0 tabular-nums">
                              {index + 1}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {cashier.userName}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
                              {cashier.shiftCount} shift
                              {cashier.shiftCount === 1 ? '' : 's'}
                            </span>
                          </div>
                          <span className="font-bold text-green-600 dark:text-green-400 tabular-nums flex-shrink-0">
                            {formatCurrency(cashier.totalRevenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'stats' && !shiftStats && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <BarChart3
                  className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3"
                  aria-hidden="true"
                />
                <p>Statistics are not available</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isStarting || isClosing}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium disabled:opacity-50 focus-ring"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

// ── Current shift card ──────────────────────────────────────

function CurrentShiftCard({ shift }: { shift: Shift | null }) {
  if (!shift) {
    return (
      <div className="rounded-xl border p-6 bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Shift Status
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-3 h-3 bg-gray-400 rounded-full" />
          <span className="text-lg font-semibold text-gray-600 dark:text-gray-400">
            No Active Shift
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-6 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Shift Status
          </p>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-lg font-semibold text-green-700 dark:text-green-300">
                Active
              </span>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              since {formatTime(shift.openedAt)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Starting Balance
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(shift.startingBalance)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-green-200 dark:border-green-800/50">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Register</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {shift.cashRegister.name}
            <span className="text-sm text-gray-400 ml-2 font-mono">
              #{shift.cashRegister.code}
            </span>
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cashier</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {shift.user
              ? `${shift.user.firstName} ${shift.user.lastName}`.trim() ||
                'Unknown'
              : 'Unknown'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
          <p className="font-medium text-gray-900 dark:text-white tabular-nums">
            {formatShiftDuration(shift.openedAt)}
          </p>
        </div>
      </div>

      {shift.summary && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-green-200 dark:border-green-800/50">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Sales</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
              {shift.summary.totalSales}
            </p>
          </div>
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Revenue</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">
              {formatCurrency(shift.summary.totalRevenue)}
            </p>
          </div>
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Avg. Ticket
            </p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatCurrency(shift.summary.averageTicket)}
            </p>
          </div>
          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Expected Balance
            </p>
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400 tabular-nums">
              {formatCurrency(
                shift.expectedEndingBalance ??
                  shift.startingBalance + shift.summary.totalRevenue,
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Start shift form ────────────────────────────────────────

interface StartShiftFormProps {
  registers: Register[];
  selectedRegisterId: string;
  onSelectRegister: (id: string) => void;
  startingBalanceInput: string;
  onStartingBalanceChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  isStarting: boolean;
  onSubmit: () => void;
}

function StartShiftForm({
  registers,
  selectedRegisterId,
  onSelectRegister,
  startingBalanceInput,
  onStartingBalanceChange,
  notes,
  onNotesChange,
  isStarting,
  onSubmit,
}: StartShiftFormProps) {
  const hasRegisters = registers.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Play className="w-5 h-5 text-green-500" aria-hidden="true" />
        Start New Shift
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="shift-register"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Select Register <span className="text-red-500">*</span>
          </label>
          <select
            id="shift-register"
            value={selectedRegisterId}
            onChange={(e) => onSelectRegister(e.target.value)}
            disabled={isStarting || !hasRegisters}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
          >
            <option value="">Select a register…</option>
            {registers.map((reg) => (
              <option key={reg.id} value={reg.id}>
                {reg.name} ({reg.code}) — {reg.status}
              </option>
            ))}
          </select>
          {!hasRegisters && (
            <p className="mt-1 text-sm text-yellow-600 dark:text-yellow-400">
              No registers available. Please create a register first.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="shift-starting-balance"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Starting Balance <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              aria-hidden="true"
            >
              $
            </span>
            <input
              id="shift-starting-balance"
              type="text"
              inputMode="decimal"
              value={startingBalanceInput}
              onChange={(e) => {
                const next = e.target.value;
                if (next === '' || /^\d*(\.\d{0,2})?$/.test(next)) {
                  onStartingBalanceChange(next);
                }
              }}
              disabled={isStarting}
              className="w-full pl-7 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums disabled:opacity-50"
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="shift-start-notes"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Notes (optional)
          </label>
          <input
            id="shift-start-notes"
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            disabled={isStarting}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            placeholder="Add notes for this shift…"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isStarting || !selectedRegisterId || !hasRegisters}
          className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm focus-ring"
        >
          {isStarting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="w-4 h-4" aria-hidden="true" />
          )}
          {isStarting ? 'Starting…' : 'Start Shift'}
        </button>
      </div>
    </div>
  );
}

// ── Close shift form ────────────────────────────────────────

interface CloseShiftFormProps {
  shift: Shift;
  expectedEndingBalance: number;
  endingBalanceInput: string;
  onEndingBalanceChange: (value: string) => void;
  discrepancy: DiscrepancyInfo | null;
  notes: string;
  onNotesChange: (value: string) => void;
  isClosing: boolean;
  onSubmit: () => void;
}

function CloseShiftForm({
  expectedEndingBalance,
  endingBalanceInput,
  onEndingBalanceChange,
  discrepancy,
  notes,
  onNotesChange,
  isClosing,
  onSubmit,
}: CloseShiftFormProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <StopCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
        Close Active Shift
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="shift-ending-balance"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Ending Balance <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              aria-hidden="true"
            >
              $
            </span>
            <input
              id="shift-ending-balance"
              type="text"
              inputMode="decimal"
              value={endingBalanceInput}
              onChange={(e) => {
                const next = e.target.value;
                if (next === '' || /^\d*(\.\d{0,2})?$/.test(next)) {
                  onEndingBalanceChange(next);
                }
              }}
              disabled={isClosing}
              className="w-full pl-7 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white tabular-nums disabled:opacity-50"
              placeholder="0.00"
              autoFocus
            />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
            Expected: {formatCurrency(expectedEndingBalance)}
          </p>
        </div>

        <div>
          <label
            htmlFor="shift-close-notes"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Notes (optional)
          </label>
          <input
            id="shift-close-notes"
            type="text"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            disabled={isClosing}
            className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
            placeholder="Closing notes…"
          />
        </div>
      </div>

      {/* Live discrepancy display */}
      {discrepancy && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 rounded-lg p-3 flex items-start gap-2 text-sm ${
            discrepancy.direction === 'exact'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : discrepancy.significant
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
          }`}
        >
          <AlertCircle
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1">
            {discrepancy.direction === 'exact' ? (
              <p>Counted balance matches the expected balance exactly.</p>
            ) : (
              <>
                <p className="font-medium">
                  {discrepancy.direction === 'over' ? 'Overage' : 'Shortage'}:{' '}
                  <span className="tabular-nums">
                    {formatCurrency(discrepancy.absolute)}
                  </span>
                </p>
                <p className="text-xs opacity-90">
                  {discrepancy.direction === 'over'
                    ? 'The counted balance is higher than expected.'
                    : 'The counted balance is lower than expected.'}{' '}
                  {discrepancy.significant &&
                    'You will be asked to confirm before the shift closes.'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isClosing || endingBalanceInput.trim().length === 0}
          className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm focus-ring"
        >
          {isClosing ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <StopCircle className="w-4 h-4" aria-hidden="true" />
          )}
          {isClosing ? 'Closing…' : 'Close Shift'}
        </button>
      </div>
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green:
      'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple:
      'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange:
      'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
        {value}
      </p>
    </div>
  );
}

// ── Shift history item ──────────────────────────────────────

interface ShiftHistoryItemProps {
  shift: Shift;
  isExpanded: boolean;
  onToggle: () => void;
}

function ShiftHistoryItem({
  shift,
  isExpanded,
  onToggle,
}: ShiftHistoryItemProps) {
  const hasDiscrepancy =
    typeof shift.discrepancy === 'number' && shift.discrepancy !== 0;

  const statusConfig = getStatusConfig(shift.status);
  const StatusIcon = statusConfig.Icon;

  const displayBalance = shift.endingBalance ?? shift.startingBalance;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left focus-ring"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <Receipt
              className="w-5 h-5 text-gray-500"
              aria-hidden="true"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-white">
                Shift #{shift.id.slice(-6).toUpperCase()}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig.classes}`}
              >
                <StatusIcon className="w-3 h-3" aria-hidden="true" />
                {statusConfig.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" aria-hidden="true" />
                {formatDate(shift.openedAt)}
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Clock className="w-3 h-3" aria-hidden="true" />
                {formatTime(shift.openedAt)}
              </span>
              {shift.closedAt && (
                <span className="flex items-center gap-1 tabular-nums">
                  <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                  {formatTime(shift.closedAt)}
                </span>
              )}
              <span className="flex items-center gap-1 truncate">
                <User className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                {shift.user
                  ? `${shift.user.firstName} ${shift.user.lastName}`.trim() ||
                    'Unknown'
                  : 'Unknown'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0 ml-3">
          <div className="text-right">
            <p className="font-bold text-gray-900 dark:text-white tabular-nums">
              {formatCurrency(displayBalance)}
            </p>
            {hasDiscrepancy && (
              <p
                className={`text-xs tabular-nums ${
                  shift.discrepancy! > 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {shift.discrepancy! > 0 ? '+' : ''}
                {formatCurrency(shift.discrepancy!)}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
              {shift.summary?.totalSales ?? 0} sale
              {shift.summary?.totalSales === 1 ? '' : 's'}
            </p>
          </div>
          <span className="p-1" aria-hidden="true">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Starting Balance
              </p>
              <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(shift.startingBalance)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ending Balance
              </p>
              <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(shift.endingBalance ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Total Revenue
              </p>
              <p className="font-medium text-green-600 dark:text-green-400 tabular-nums">
                {formatCurrency(shift.summary?.totalRevenue ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Duration
              </p>
              <p className="font-medium text-gray-900 dark:text-white tabular-nums">
                {formatShiftDuration(shift.openedAt, shift.closedAt)}
              </p>
            </div>
          </div>

          {shift.summary && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Payment Breakdown
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="flex items-center gap-1 text-sm">
                  <Wallet
                    className="w-3 h-3 text-green-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-gray-600 dark:text-gray-400">Cash:</span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(shift.summary.cashReceived ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <CreditCard
                    className="w-3 h-3 text-blue-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-gray-600 dark:text-gray-400">Card:</span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(shift.summary.cardReceived ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Smartphone
                    className="w-3 h-3 text-purple-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-gray-600 dark:text-gray-400">
                    Mobile:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(shift.summary.mobileReceived ?? 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <Banknote
                    className="w-3 h-3 text-orange-500 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-gray-600 dark:text-gray-400">
                    Other:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(shift.summary.otherReceived ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {shift.notes && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {shift.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ShiftManagerModal;
