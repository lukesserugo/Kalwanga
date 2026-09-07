// D:\Projects\Kalwanga\packages\web\services\shiftService.ts
import { api } from './api';
import { CashRegisterSession, CashRegister } from '../types';

export const shiftService = {
  /**
   * Start shift - calls POST /shifts/start
   */
  async startShift(data: { cashRegisterId: string; startingBalance: number }): Promise<CashRegisterSession> {
    const response = await api.post<CashRegisterSession>('/shifts/start', data);
    return response;
  },

  /**
   * End shift - calls POST /shifts/:sessionId/end
   */
  async endShift(sessionId: string, data: { endingBalance: number; notes?: string }): Promise<CashRegisterSession> {
    const response = await api.post<CashRegisterSession>(`/shifts/${sessionId}/end`, data);
    return response;
  },

  /**
   * Get current shift - calls GET /shifts/register/:cashRegisterId
   */
  async getCurrentShift(cashRegisterId?: string): Promise<CashRegisterSession | null> {
    const response = await api.get<CashRegisterSession | null>(`/shifts/register/${cashRegisterId || 'current'}`);
    return response;
  },

  /**
   * Get all shifts - calls GET /shifts
   */
  async getAllShifts(params?: { page?: number; limit?: number; businessUnitId?: string }): Promise<CashRegisterSession[]> {
    const response = await api.get<CashRegisterSession[]>('/shifts', { params });
    return response;
  },

  /**
   * Get shift by ID - calls GET /shifts/:id
   */
  async getShiftById(id: string): Promise<CashRegisterSession> {
    const response = await api.get<CashRegisterSession>(`/shifts/${id}`);
    return response;
  },

  /**
   * Get registers - calls GET /shifts/registers
   */
  async getRegisters(params?: { businessUnitId?: string }): Promise<CashRegister[]> {
    const response = await api.get<CashRegister[]>('/shifts/registers', { params });
    return response;
  },

  /**
   * Create register - calls POST /shifts/registers
   */
  async createRegister(data: { name: string; code: string; businessUnitId: string }): Promise<CashRegister> {
    const response = await api.post<CashRegister>('/shifts/registers', data);
    return response;
  },

  /**
   * Update register - calls PUT /shifts/registers/:id
   */
  async updateRegister(id: string, data: Partial<CashRegister>): Promise<CashRegister> {
    const response = await api.put<CashRegister>(`/shifts/registers/${id}`, data);
    return response;
  },

  /**
   * Delete register - calls DELETE /shifts/registers/:id
   */
  async deleteRegister(id: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/shifts/registers/${id}`);
    return response;
  },

  /**
   * Cash transaction - calls POST /shifts/cash
   */
  async cashTransaction(data: {
    type: string;
    amount: number;
    reason: string;
    notes?: string;
    cashRegisterId: string;
    cashRegisterSessionId?: string;
  }): Promise<any> {
    const response = await api.post<any>('/shifts/cash', data);
    return response;
  },
};
