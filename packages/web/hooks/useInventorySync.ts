// D:\Projects\Kalwanga\packages\web\hooks\useInventorySync.ts
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { inventoryService } from '../services/inventoryService';
import { toast } from '../utils/toast-manager';
import { useAuth } from './useAuth';

interface InventorySyncOptions {
  productId?: string;
  businessUnitId?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

export function useInventorySync(options: InventorySyncOptions = {}) {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const businessUnitId = options.businessUnitId || user?.businessUnits?.[0]?.businessUnitId || '';

  const syncInventory = useCallback(async () => {
    if (!businessUnitId || !options.productId) {
      setLoading(false);
      return;
    }

    try {
      setSyncing(true);
      setError(null);
      
      const data = await inventoryService.getInventoryByProduct(
        options.productId,
        businessUnitId
      );
      
      if (isMountedRef.current) {
        setInventory(data);
        setLastSync(new Date());
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to sync inventory');
        toast.error('Failed to sync inventory');
      }
    } finally {
      if (isMountedRef.current) {
        setSyncing(false);
        setLoading(false);
      }
    }
  }, [businessUnitId, options.productId]);

  const updateStock = useCallback(async (quantity: number, notes?: string) => {
    if (!inventory || !options.productId) {
      toast.error('Inventory not loaded');
      return null;
    }

    try {
      setSyncing(true);
      const result = await inventoryService.updateStock(inventory.id, {
        quantity,
        notes: notes || 'Stock adjustment',
        transactionType: quantity >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
      });
      
      await syncInventory();
      toast.success('Stock updated successfully');
      return result;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update stock');
      return null;
    } finally {
      setSyncing(false);
    }
  }, [inventory, options.productId, syncInventory]);

  // Auto-sync on interval
  useEffect(() => {
    if (options.autoSync !== false && options.productId) {
      syncInventory();
      
      const interval = setInterval(() => {
        syncInventory();
      }, options.syncInterval || 30000);
      
      return () => {
        clearInterval(interval);
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
      };
    }
  }, [options.productId, options.autoSync, options.syncInterval, syncInventory]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    inventory,
    loading,
    syncing,
    lastSync,
    error,
    syncInventory,
    updateStock,
    isAvailable: inventory ? inventory.quantity - (inventory.reserved || 0) : 0,
    totalStock: inventory?.quantity || 0,
    reserved: inventory?.reserved || 0,
  };
}
