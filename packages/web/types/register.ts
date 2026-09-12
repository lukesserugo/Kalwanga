// D:\Projects\Kalwanga\packages\web\types\register.ts

import { BusinessUnit, User } from './user';
import { Sale } from './sale';
import { Payment } from './payment';

// ============================================
// ENUMS / UNIONS
// ============================================

export type CashRegisterStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'PENDING'
  | 'SUSPENDED';

export type CashRegisterSessionStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'VOID'
  | 'PENDING';

export type CashTransactionType =
  | 'CASH_IN'
  | 'CASH_OUT'
  | 'SALE'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'DEPOSIT'
  | 'WITHDRAWAL';

export type ShiftStatus = 'OPEN' | 'CLOSED' | 'VOID' | 'PENDING';

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'WEEKEND';

// ============================================
// CASH REGISTER
// ============================================

export interface CashRegister {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  cashBalance: number;
  createdAt: string;
  updatedAt: string;
  businessUnitId: string;

  // ============================================
  // Optional fields populated by the API
  // ============================================

  /** Server-side status mirror of the register's session state. */
  status?: CashRegisterStatus;

  /** The currently-open session, if any. */
  currentSessionId?: string;
  currentSession?: CashRegisterSession | null;

  /** Time the register was last opened / closed. */
  lastOpenedAt?: string;
  lastClosedAt?: string;

  // ============================================
  // Relations
  // ============================================

  businessUnit?: BusinessUnit;
  sessions?: CashRegisterSession[];
  sales?: Sale[];
  payments?: Payment[];
  cashTransactions?: CashTransaction[];

  // ============================================
  // Computed fields returned by the API
  // ============================================

  /** Whether the register currently has an open session. */
  isOpen?: boolean;

  /** The user who opened the current session (if any). */
  sessionUser?: {
    firstName: string;
    lastName: string;
  } | null;

  // ============================================
  // Preserve any additional fields from the API
  // ============================================

  [key: string]: any;
}

/** Alias used by many shift UI components. */
export type Register = CashRegister;

// ============================================
// CASH REGISTER SESSION
// ============================================

export interface CashRegisterSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  startingBalance: number;
  endingBalance?: number;
  expectedEndingBalance?: number;
  discrepancy?: number;
  discrepancyReason?: string;
  notes?: string;
  status: CashRegisterSessionStatus | string;
  cashRegisterId: string;
  cashRegister?: CashRegister;
  userId: string;
  user?: User;

  // ============================================
  // Relations
  // ============================================

  sales?: Sale[];
  payments?: Payment[];
  cashTransactions?: CashTransaction[];

  // ============================================
  // Optional computed summary fields
  // ============================================

  summary?: {
    totalSales: number;
    totalRevenue: number;
    averageTicket: number;
    cashReceived?: number;
    cardReceived?: number;
    mobileReceived?: number;
    otherReceived?: number;
    cashIn?: number;
    cashOut?: number;
    expectedBalance?: number;
    discrepancy?: number | null;
    duration?: number;
  };

  totalSales?: number;
  totalRevenue?: number;
  cashReceived?: number;
  cashIn?: number;
  cashOut?: number;
  expectedBalance?: number;
  duration?: number;

  // ============================================
  // Preserve additional fields from the API
  // ============================================

  [key: string]: any;
}

/** Alias used by shift UI components. */
export type Shift = CashRegisterSession;

// ============================================
// CASH TRANSACTION
// ============================================

export interface CashTransaction {
  id: string;
  type: CashTransactionType | string;
  amount: number;
  reason: string;
  notes?: string;
  createdAt: string;
  cashRegisterId: string;
  cashRegister?: CashRegister;
  cashRegisterSessionId?: string;
  cashRegisterSession?: CashRegisterSession;
  userId: string;
  user?: User;
}

// ============================================
// SHIFT LOG
// ============================================

export interface ShiftLog {
  id: string;
  shiftStart: string;
  shiftEnd?: string;
  startingCash: number;
  endingCash?: number;
  expectedCash?: number;
  discrepancy?: number;
  discrepancyReason?: string;
  notes?: string;
  status: ShiftStatus | string;
  type?: ShiftType | string;
  entityName?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user?: User;
  businessUnitId: string;
  businessUnit?: BusinessUnit;
}

// ============================================
// SHIFT STATS
// ============================================

export interface ShiftStats {
  totalShifts: number;
  openShifts: number;
  closedShifts: number;
  totalRevenue: number;
  averageShiftDuration: number;
  averageShiftRevenue: number;
  topCashiers: Array<{
    userId: string;
    userName: string;
    shiftCount: number;
    totalRevenue: number;
  }>;
}

export interface ShiftSummary {
  totalSales: number;
  totalRevenue: number;
  totalCash: number;
  totalCard: number;
  totalMobileMoney: number;
  totalRefunds: number;
  discrepancy: number;
}

// ============================================
// QUERY PARAMS
// ============================================

export type ShiftScope = 'mine' | 'businessUnit' | 'all';

export interface ShiftSearchParams {
  page?: number;
  limit?: number;
  businessUnitId?: string;
  status?: ShiftStatus | string;
  userId?: string;
  cashRegisterId?: string;
  startDate?: string;
  endDate?: string;
  scope?: ShiftScope;
}

export interface ShiftStatsParams {
  businessUnitId?: string;
  startDate?: string;
  endDate?: string;
}

export interface RegisterSearchParams {
  businessUnitId?: string;
  isActive?: boolean;
  search?: string;
}

// ============================================
// MUTATION PAYLOADS
// ============================================

export interface StartShiftPayload {
  cashRegisterId: string;
  startingBalance: number;
  notes?: string;
}

export interface EndShiftPayload {
  endingBalance: number;
  notes?: string;
}

export interface CashTransactionPayload {
  amount: number;
  description?: string;
}

export interface CreateRegisterPayload {
  name: string;
  code: string;
  businessUnitId?: string;
}

export interface UpdateRegisterPayload {
  name?: string;
  code?: string;
  isActive?: boolean;
}

// ============================================
// PROVIDER-AGNOSTIC RESPONSE SHAPES
// ============================================

export interface RegistersListResponse {
  data: CashRegister[];
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
    limit: number;
  };
}

export interface ShiftsListResponse {
  shifts: CashRegisterSession[];
  total: number;
  page: number;
  totalPages: number;
  stats?: ShiftStats;
  scope?: ShiftScope;
}
