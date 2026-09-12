// D:\Projects\Kalwanga\packages\web\services\shiftService.ts

import { api } from './api';
import type {
  CashRegister,
  CashRegisterSession,
  ShiftSearchParams,
  ShiftStats,
  ShiftStatsParams,
  StartShiftPayload,
  EndShiftPayload,
  CashTransactionPayload,
  CreateRegisterPayload,
  UpdateRegisterPayload,
} from '../types/register';

// Alias for convenience
type Register = CashRegister;

// ─────────────────────────────────────────────────────────────
// Response unwrapping — keeps shiftService resilient to
// whichever shape `api.ts` hands back (raw body, wrapped, or
// Axios response).
// ─────────────────────────────────────────────────────────────
function unwrap<T>(raw: any): T {
  if (!raw || typeof raw !== 'object') return raw as T;
  // Axios-like response with .data and .headers
  if ('status' in raw && 'data' in raw && 'headers' in raw) {
    return unwrap<T>((raw as any).data);
  }
  return raw as T;
}

function unwrapSingle<T>(raw: any): T | null {
  const body = unwrap<any>(raw);
  if (body == null) return null;
  // Standard envelope { success, data } — take `.data`
  if (typeof body === 'object' && 'data' in body && 'success' in body) {
    return (body.data ?? null) as T | null;
  }
  return body as T;
}

export const shiftService = {
  // ============================================
  // SHIFT LIFECYCLE
  // ============================================

  async startShift(data: StartShiftPayload): Promise<CashRegisterSession> {
    const res = await api.post<CashRegisterSession>('/shifts/start', data);
    return unwrapSingle<CashRegisterSession>(res) as CashRegisterSession;
  },

  async endShift(
    sessionId: string,
    data: EndShiftPayload
  ): Promise<CashRegisterSession> {
    const res = await api.post<CashRegisterSession>(
      `/shifts/${sessionId}/end`,
      data
    );
    return unwrapSingle<CashRegisterSession>(res) as CashRegisterSession;
  },

  /**
   * GET /shifts/register/current
   *
   * Returns the authenticated user's currently OPEN cash register
   * session, or null when none is open.
   *
   * The backend route uses `/register/current` — kept as-is to
   * match the mounted route. If your backend exposes `/shifts/current`
   * instead, change the path below to match.
   */
  async getCurrentShift(): Promise<CashRegisterSession | null> {
    try {
      const res = await api.get<CashRegisterSession | null>(
        '/shifts/register/current'
      );

      const session = unwrapSingle<CashRegisterSession>(res);

      // Guard: some backends return an empty object `{}` when there
      // is no open shift. Treat that as "no shift" so downstream
      // code (OrderForm) doesn't think a shift exists.
      if (!session) return null;
      if (typeof session === 'object' && !('id' in session)) return null;

      return session;
    } catch (error: any) {
      // 404 is a valid "no shift open" answer in some implementations
      if (error?.response?.status === 404) return null;
      console.error('Failed to get current shift:', error);
      return null;
    }
  },

  // ============================================
  // SHIFT QUERIES
  // ============================================

  async getAllShifts(params?: ShiftSearchParams): Promise<{
    shifts: CashRegisterSession[];
    total: number;
    page: number;
    totalPages: number;
    stats?: ShiftStats;
    scope?: string;
  }> {
    try {
      const response = await api.get<any>('/shifts', { params });
      const body = unwrap<any>(response);

      return {
        shifts: Array.isArray(body?.data) ? body.data : [],
        total: body?.pagination?.total ?? 0,
        page: body?.pagination?.page ?? 1,
        totalPages: body?.pagination?.totalPages ?? 1,
        stats: body?.stats,
        scope: body?.scope,
      };
    } catch (error) {
      console.error('Failed to fetch shifts:', error);
      return { shifts: [], total: 0, page: 1, totalPages: 1 };
    }
  },

  async getShiftById(id: string): Promise<CashRegisterSession> {
    const res = await api.get<CashRegisterSession>(`/shifts/${id}`);
    return unwrapSingle<CashRegisterSession>(res) as CashRegisterSession;
  },

  async getShiftSummary(id: string): Promise<any> {
    const res = await api.get<any>(`/shifts/${id}/summary`);
    return unwrapSingle<any>(res);
  },

  async getShiftStats(params?: ShiftStatsParams): Promise<ShiftStats> {
    const res = await api.get<ShiftStats>('/shifts/stats', { params });
    return unwrapSingle<ShiftStats>(res) as ShiftStats;
  },

  // ============================================
  // REGISTER CRUD
  // ============================================

  async getRegisters(params?: {
    businessUnitId?: string;
    isActive?: boolean;
  }): Promise<Register[]> {
    const response = await api.get<any>('/shifts/registers', { params });
    const body = unwrap<any>(response);

    // Handle all plausible shapes
    if (Array.isArray(body)) return body as Register[];
    if (Array.isArray(body?.data)) return body.data as Register[];
    if (Array.isArray(body?.registers)) return body.registers as Register[];
    if (Array.isArray(body?.items)) return body.items as Register[];

    console.warn(
      '⚠️ getRegisters: unexpected response shape, returning []',
      response
    );
    return [];
  },

  async getRegisterById(id: string): Promise<Register> {
    const res = await api.get<Register>(`/shifts/registers/${id}`);
    return unwrapSingle<Register>(res) as Register;
  },

  async getRegisterStatus(id: string): Promise<any> {
    const res = await api.get<any>(`/shifts/registers/${id}/status`);
    return unwrapSingle<any>(res);
  },

  async createRegister(data: CreateRegisterPayload): Promise<Register> {
    const res = await api.post<Register>('/shifts/registers', data);
    return unwrapSingle<Register>(res) as Register;
  },

  async updateRegister(
    id: string,
    data: UpdateRegisterPayload
  ): Promise<Register> {
    const res = await api.put<Register>(`/shifts/registers/${id}`, data);
    return unwrapSingle<Register>(res) as Register;
  },

  async deleteRegister(id: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(
      `/shifts/registers/${id}`
    );
    const body = unwrap<any>(res);
    return { message: body?.message || 'Register deleted successfully' };
  },

  // ============================================
  // CASH TRANSACTIONS
  // ============================================

  async addCash(
    sessionId: string,
    data: CashTransactionPayload
  ): Promise<any> {
    const res = await api.post<any>(`/shifts/${sessionId}/add-cash`, data);
    return unwrapSingle<any>(res);
  },

  async removeCash(
    sessionId: string,
    data: CashTransactionPayload
  ): Promise<any> {
    const res = await api.post<any>(`/shifts/${sessionId}/remove-cash`, data);
    return unwrapSingle<any>(res);
  },

  async cashTransaction(data: {
    type: string;
    amount: number;
    reason: string;
    notes?: string;
    cashRegisterId: string;
    cashRegisterSessionId?: string;
  }): Promise<any> {
    const res = await api.post<any>('/shifts/cash', data);
    return unwrapSingle<any>(res);
  },
};

export default shiftService;
