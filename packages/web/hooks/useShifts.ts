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

  const fetchRegisters = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await shiftService.getRegisters();
      setRegisters(Array.isArray(data) ? data : []);
      return data;
    } catch (error) {
      console.error('Failed to fetch registers:', error);
      setRegisters([]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================
  // CURRENT SHIFT
  // ============================================

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

  const fetchStats = useCallback(async () => {
    try {
      const data = await shiftService.getShiftStats();
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

        // Merge with current state for defaults
        const effectiveScope = params?.scope ?? shiftsScope;
        const effectivePage = params?.page ?? shiftsPage;
        const effectiveLimit = params?.limit ?? DEFAULT_PAGE_SIZE;

        const result = await shiftService.getAllShifts({
          page: effectivePage,
          limit: effectiveLimit,
          scope: effectiveScope,
          status: params?.status,
          userId: params?.userId,
          cashRegisterId: params?.cashRegisterId,
          businessUnitId: params?.businessUnitId,
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
