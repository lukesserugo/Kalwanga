// D:\Projects\Kalwanga\packages\web\hooks\useBusinessUnits.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  companyId: string;
  company?: {
    id: string;
    name: string;
    code?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface UseBusinessUnitsReturn {
  businessUnits: BusinessUnit[];
  isLoading: boolean;
  error: string | null;
  fetchBusinessUnits: () => Promise<void>;
  getBusinessUnitById: (id: string) => BusinessUnit | undefined;
  getActiveBusinessUnits: () => BusinessUnit[];
  createBusinessUnit: (data: Partial<BusinessUnit>) => Promise<BusinessUnit>;
  updateBusinessUnit: (id: string, data: Partial<BusinessUnit>) => Promise<BusinessUnit>;
  deleteBusinessUnit: (id: string) => Promise<void>;
}

export function useBusinessUnits(): UseBusinessUnitsReturn {
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBusinessUnits = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await api.get<{ data: BusinessUnit[] }>('/business-units');
      const units = response?.data || response || [];
      setBusinessUnits(Array.isArray(units) ? units : []);
    } catch (err: any) {
      console.error('Failed to fetch business units:', err);
      setError(err.message || 'Failed to fetch business units');
      
      // Fallback to localStorage
      try {
        const cached = localStorage.getItem('businessUnits');
        if (cached) {
          const parsed = JSON.parse(cached);
          setBusinessUnits(Array.isArray(parsed) ? parsed : []);
        } else {
          // Create default business unit
          const defaultUnit: BusinessUnit = {
            id: 'default',
            name: 'Default Business Unit',
            code: 'DEFAULT',
            isActive: true,
            companyId: 'default',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setBusinessUnits([defaultUnit]);
          localStorage.setItem('businessUnits', JSON.stringify([defaultUnit]));
        }
      } catch (cacheErr) {
        console.error('Failed to load cached business units:', cacheErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getBusinessUnitById = useCallback((id: string): BusinessUnit | undefined => {
    return businessUnits.find(unit => unit.id === id);
  }, [businessUnits]);

  const getActiveBusinessUnits = useCallback((): BusinessUnit[] => {
    return businessUnits.filter(unit => unit.isActive !== false);
  }, [businessUnits]);

  const createBusinessUnit = useCallback(async (data: Partial<BusinessUnit>): Promise<BusinessUnit> => {
    try {
      const response = await api.post<{ data: BusinessUnit }>('/business-units', data);
      const newUnit = response?.data || response;
      setBusinessUnits(prev => [...prev, newUnit]);
      localStorage.setItem('businessUnits', JSON.stringify([...businessUnits, newUnit]));
      return newUnit;
    } catch (err: any) {
      // Fallback: Create locally
      const newUnit: BusinessUnit = {
        id: `bu_${Date.now()}`,
        name: data.name || 'New Business Unit',
        code: data.code || `BU${Date.now()}`,
        isActive: true,
        companyId: data.companyId || 'default',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...data,
      };
      setBusinessUnits(prev => [...prev, newUnit]);
      localStorage.setItem('businessUnits', JSON.stringify([...businessUnits, newUnit]));
      return newUnit;
    }
  }, [businessUnits]);

  const updateBusinessUnit = useCallback(async (id: string, data: Partial<BusinessUnit>): Promise<BusinessUnit> => {
    try {
      const response = await api.put<{ data: BusinessUnit }>(`/business-units/${id}`, data);
      const updatedUnit = response?.data || response;
      setBusinessUnits(prev => prev.map(unit => unit.id === id ? updatedUnit : unit));
      return updatedUnit;
    } catch (err: any) {
      const updatedUnit = businessUnits.find(unit => unit.id === id);
      if (!updatedUnit) throw new Error('Business unit not found');
      
      const newUnit = { ...updatedUnit, ...data, updatedAt: new Date().toISOString() };
      setBusinessUnits(prev => prev.map(unit => unit.id === id ? newUnit : unit));
      return newUnit;
    }
  }, [businessUnits]);

  const deleteBusinessUnit = useCallback(async (id: string): Promise<void> => {
    try {
      await api.delete(`/business-units/${id}`);
      setBusinessUnits(prev => prev.filter(unit => unit.id !== id));
    } catch (err: any) {
      setBusinessUnits(prev => prev.filter(unit => unit.id !== id));
    }
  }, []);

  useEffect(() => {
    fetchBusinessUnits();
  }, [fetchBusinessUnits]);

  return {
    businessUnits,
    isLoading,
    error,
    fetchBusinessUnits,
    getBusinessUnitById,
    getActiveBusinessUnits,
    createBusinessUnit,
    updateBusinessUnit,
    deleteBusinessUnit,
  };
}

export default useBusinessUnits;
