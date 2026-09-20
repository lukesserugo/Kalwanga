// D:\Projects\Kalwanga\packages\web\hooks\useShifts.ts
'use client';

import { useState, useCallback, useMemo } from 'react';
import { shiftService } from '../services/shiftService';

// ============================================
// TYPES
// ============================================

export type ShiftScope = 'mine' | 'businessUnit' | 'all';

export interface FetchShiftsParams {
  page?: number;
  limit?: number;
  scope?: ShiftScope;
  status?: string;
  userId?: string;
  cashRegisterId?: string;
  businessUnitId?: string;
  startDate?: string;
  endDate?: string;
}

export interface FetchShiftsResult {
  shifts: any[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  scope?: ShiftScope;
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

// ============================================
// BUSINESS UNIT RESOLUTION
// ============================================
//
// The registers list must be fetched from the SAME business unit
// the register was created under, or the query returns zero rows
// and the UI shows "No registers yet" even though the row exists.
//
// The backend's `getBusinessUnitId` resolves:
//   1. explicit body/query `businessUnitId`
//   2. the user's primary unit
//   3. any active unit the user belongs to
//
// On CREATE, the modal sends `businessUnitId` in the body, so the
// register lands in unit X. On FETCH, if we send nothing, the
// backend falls through to the user's primary unit — which may not
// be X. Sending the same ID closes the gap.

const BUSINESS_UNIT_STORAGE_KEYS = [
  'selectedBusinessUnitId',
  'businessUnitId',
] as const;

function readStoredBusinessUnitId(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  for (const key of BUSINESS_UNIT_STORAGE_KEYS) {
    try {
      const value = localStorage.getItem(key);
      if (
        value &&
        value !== 'default' &&
        value !== 'null' &&
        value !== 'undefined'
      ) {
        return value;
      }
    } catch {
      /* storage unavailable — fall through */
    }
  }

  // Fall back to the user object if present
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const fromUser =
        user?.businessUnitId || user?.businessUnits?.[0]?.businessUnitId;
      if (
        fromUser &&
        fromUser !== 'default' &&
        fromUser !== 'null' &&
        fromUser !== 'undefined'
      ) {
        return fromUser;
      }
    }
  } catch {
    /* ignore */
  }

  return undefined;
}

// ============================================
// DEFAULT STATE
// ============================================

const DEFAULT_STATS: ShiftStats = {
  totalShifts: 0,
  openShifts: 0,
  closedShifts: 0,
  totalRevenue: 0,
  averageShiftDuration: 0,
  averageShiftRevenue: 0,
  topCashiers: [],
};

const DEFAULT_PAGE_SIZE = 50;

// ============================================
// HOOK
// ============================================

export function useShifts() {
  // ---------- Registers ----------
  const [registers, setRegisters] = useState<any[]>([]);

  // ---------- Current shift ----------
  const [currentShift, setCurrentShift] = useState<any>(null);

  // ---------- Shift history ----------
  const [shifts, setShifts] = useState<any[]>([]);
  const [shiftsTotal, setShiftsTotal] = useState<number>(0);
  const [shiftsTotalPages, setShiftsTotalPages] = useState<number>(1);
  const [shiftsPage, setShiftsPage] = useState<number>(1);
  const [shiftsScope, setShiftsScope] = useState<ShiftScope>('businessUnit');

  // ---------- Stats ----------
  const [stats, setStats] = useState<ShiftStats>(DEFAULT_STATS);

  // ---------- Loading flags ----------
  // A single flag for registers/current/stats (dashboard bootstrap)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // A separate flag for the history fetch so it doesn't block the whole dashboard
  const [isLoadingShifts, setIsLoadingShifts] = useState<boolean>(false);

  // ============================================
  // REGISTERS
  // ============================================
  //
  // Sends the current business unit ID as a query param so the
  // backend's `getBusinessUnitId` sees the same value the modal
  // sent on create. Without this, a user whose primary unit
  // differs from the selected unit would create a register in one
  // place and query in another — "created but can't be fetched".

  const fetchRegisters = useCallback(
    async (businessUnitId?: string) => {
      try {
        setIsLoading(true);

        const effectiveBusinessUnitId =
          businessUnitId || readStoredBusinessUnitId();

        const data = await shiftService.getRegisters(
          effectiveBusinessUnitId
            ? { businessUnitId: effectiveBusinessUnitId }
            : undefined
        );

        setRegisters(Array.isArray(data) ? data : []);
        return data;
      } catch (error) {
        console.error('Failed to fetch registers:', error);
        setRegisters([]);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ============================================
  // CURRENT SHIFT
  // ============================================
  //
  // The backend endpoint `/shifts/register/current` resolves the
  // business unit server-side. No param needed — the user's
  // session already carries it. Kept as-is.

  const fetchCurrentShift = useCallback(async () => {
    try {
      const data = await shiftService.getCurrentShift();
      setCurrentShift(data || null);
      return data;
    } catch (error) {
      console.error('Failed to fetch current shift:', error);
      setCurrentShift(null);
      return null;
    }
  }, []);

  // ============================================
  // STATS
  // ============================================
  //
  // Same reasoning as `fetchRegisters` — pass the business unit so
  // the stats reflect the same scope the register list shows.

  const fetchStats = useCallback(async (businessUnitId?: string) => {
    try {
      const effectiveBusinessUnitId =
        businessUnitId || readStoredBusinessUnitId();

      const data = await shiftService.getShiftStats(
        effectiveBusinessUnitId
          ? { businessUnitId: effectiveBusinessUnitId }
          : undefined
      );

      setStats(data || DEFAULT_STATS);
      return data;
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats(DEFAULT_STATS);
      return null;
    }
  }, []);

  // ============================================
  // SHIFT HISTORY
  // ============================================

  const fetchShifts = useCallback(
    async (params?: FetchShiftsParams): Promise<FetchShiftsResult | null> => {
      try {
        setIsLoadingShifts(true);

        const effectiveScope = params?.scope ?? shiftsScope;
        const effectivePage = params?.page ?? shiftsPage;
        const effectiveLimit = params?.limit ?? DEFAULT_PAGE_SIZE;

        // Resolve the business unit ID the same way `fetchRegisters`
        // does, unless the caller explicitly provided one.
        const effectiveBusinessUnitId =
          params?.businessUnitId ||
          (effectiveScope === 'businessUnit'
            ? readStoredBusinessUnitId()
            : undefined);

        const result = await shiftService.getAllShifts({
          page: effectivePage,
          limit: effectiveLimit,
          scope: effectiveScope,
          status: params?.status,
          userId: params?.userId,
          cashRegisterId: params?.cashRegisterId,
          businessUnitId: effectiveBusinessUnitId,
          startDate: params?.startDate,
          endDate: params?.endDate,
        });

        // Backend returns: { shifts, total, page, totalPages }
        const normalizedShifts = Array.isArray(result?.shifts)
          ? result.shifts
          : Array.isArray(result)
          ? result
          : [];

        setShifts(normalizedShifts);
        setShiftsTotal(result?.total ?? normalizedShifts.length);
        setShiftsTotalPages(result?.totalPages ?? 1);
        setShiftsPage(result?.page ?? effectivePage);
        setShiftsScope(effectiveScope);

        return {
          shifts: normalizedShifts,
          total: result?.total ?? normalizedShifts.length,
          page: result?.page ?? effectivePage,
          totalPages: result?.totalPages ?? 1,
          limit: effectiveLimit,
          scope: effectiveScope,
        };
      } catch (error) {
        console.error('Failed to fetch shifts:', error);
        setShifts([]);
        setShiftsTotal(0);
        setShiftsTotalPages(1);
        return null;
      } finally {
        setIsLoadingShifts(false);
      }
    },
    [shiftsScope, shiftsPage]
  );

  /**
   * Change the scope and reset to page 1
   */
  const changeShiftsScope = useCallback(
    async (scope: ShiftScope) => {
      setShiftsScope(scope);
      setShiftsPage(1);
      return fetchShifts({ scope, page: 1 });
    },
    [fetchShifts]
  );

  /**
   * Go to a specific page
   */
  const changeShiftsPage = useCallback(
    async (page: number) => {
      setShiftsPage(page);
      return fetchShifts({ page });
    },
    [fetchShifts]
  );

  // ============================================
  // REGISTER CRUD
  // ============================================
  //
  // `createRegister` doesn't need to send anything extra — the
  // modal already passes `businessUnitId` in the payload, and the
  // backend's `getBusinessUnitId` reads it from `req.body`.
  //
  // After create, the caller (RegisterManagement / ShiftsDashboard)
  // calls `loadData()` which re-fetches. `fetchRegisters` will now
  // pick up the same business unit from localStorage, closing the
  // loop.

  const createRegister = useCallback(async (data: any) => {
    const result = await shiftService.createRegister(data);
    return result;
  }, []);

  const updateRegister = useCallback(async (id: string, data: any) => {
    const result = await shiftService.updateRegister(id, data);
    return result;
  }, []);

  const deleteRegister = useCallback(async (id: string) => {
    const result = await shiftService.deleteRegister(id);
    return result;
  }, []);

  // ============================================
  // SHIFT OPERATIONS
  // ============================================

  const startShift = useCallback(async (data: any) => {
    const result = await shiftService.startShift(data);
    return result;
  }, []);

  const endShift = useCallback(async (id: string, data: any) => {
    const result = await shiftService.endShift(id, data);
    return result;
  }, []);

  const addCash = useCallback(async (sessionId: string, data: any) => {
    const result = await shiftService.addCash(sessionId, data);
    return result;
  }, []);

  const removeCash = useCallback(async (sessionId: string, data: any) => {
    const result = await shiftService.removeCash(sessionId, data);
    return result;
  }, []);

  // ============================================
  // MEMOIZED AGGREGATES
  // ============================================

  const activeRegisterCount = useMemo(
    () => registers.filter((r: any) => r.isActive).length,
    [registers]
  );

  const openRegisterCount = useMemo(
    () => registers.filter((r: any) => r.isOpen).length,
    [registers]
  );

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    registers,
    currentShift,
    shifts,
    stats,

    // History pagination
    shiftsTotal,
    shiftsTotalPages,
    shiftsPage,
    shiftsScope,

    // Loading flags
    isLoading,
    isLoadingShifts,

    // Register fetchers
    fetchRegisters,
    fetchCurrentShift,
    fetchStats,
    fetchShifts,

    // History helpers
    changeShiftsScope,
    changeShiftsPage,

    // Register CRUD
    createRegister,
    updateRegister,
    deleteRegister,

    // Shift operations
    startShift,
    endShift,
    addCash,
    removeCash,

    // Aggregates
    activeRegisterCount,
    openRegisterCount,
  };
}

export default useShifts;
