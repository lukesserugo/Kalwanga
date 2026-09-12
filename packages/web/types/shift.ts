// D:\Projects\Kalwanga\packages\web\types\shift.ts

// ============================================
// Re-export canonical types from register.ts
// ============================================
export type {
  CashRegister,
  CashRegisterSession,
  CashRegisterSessionStatus,
  CashRegisterStatus,
  CashTransaction,
  CashTransactionType,
  Shift,
  ShiftStatus,
  ShiftType,
} from './register';

// ============================================
// Shift-specific types (not in register.ts)
// ============================================

export type ShiftScope = 'mine' | 'businessUnit' | 'all';

export interface ShiftSearchParams {
  page?: number;
  limit?: number;
  businessUnitId?: string;
  status?: string;
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
