// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\stock-count\page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ClipboardList, Plus, RefreshCw, Search,
  Check, X, Loader2, Lock, AlertCircle,
  Calendar, User, Package, Edit, Trash2,
  ArrowLeft, Save
} from 'lucide-react';
import { useAuth } from '../../../../../hooks/useAuth';
import { toast } from '../../../../../utils/toast-manager';
import { formatDate } from '../../../../../utils/formatters';

export default function StockCountPage() {
  const router = useRouter();
  const { user, canManageInventory } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    expectedItems: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  const businessUnitId = user?.businessUnits?.[0]?.businessUnitId || '';

  // Check permission
  if (!canManageInventory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">You don't have permission to manage stock counts.</p>
      </div>
    );
  }

  useEffect(() => {
    loadSessions();
  }, [businessUnitId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      // Load stock count sessions from API
      // const data = await inventoryService.getStockCountSessions(businessUnitId);
      // setSessions(data);
      setSessions([
        { id: '1', name: 'Warehouse Count Q1 2024', location: 'Warehouse', status: 'COMPLETED', expectedItems: 150, countedItems: 148, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() },
        { id: '2', name: 'Store A Inventory', location: 'Store A', status: 'IN_PROGRESS', expectedItems: 80, countedItems: 45, createdAt: new Date().toISOString() },
        { id: '3', name: 'Monthly Stock Take', location: 'All Locations', status: 'PENDING', expectedItems: 230, countedItems: 0, createdAt: new Date().toISOString() },
      ]);
    } catch (error) {
      console.error('Failed to load stock count sessions:', error);
      toast.error('Failed to load stock count sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.location) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      // await inventoryService.createStockCountSession({ ...formData, businessUnitId });
      toast.success('Stock count session created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', location: '', expectedItems: 0 });
      loadSessions();
    } catch (error) {
      toast.error('Failed to create stock count session');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'PENDING':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-blue-500" />
            Stock Count
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage physical inventory counts</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadSessions}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setFormData({ name: '', location: '', expectedItems: 0 });
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Count
          </button>
        </div>
      </div>

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
            <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No stock count sessions</h3>
            <p className="text-gray-500 dark:text-gray-400">Create your first stock count session</p>
            <button
              onClick={() => {
                setFormData({ name: '', location: '', expectedItems: 0 });
                setShowCreateModal(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              New Count
            </button>
          </div>
        ) : (
          sessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/inventory/stock-count/${session.id}`)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{session.name}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{session.location}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                  {session.status.replace('_', ' ')}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Expected</p>
                  <p className="font-medium text-gray-900 dark:text-white">{session.expectedItems}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400">Counted</p>
                  <p className="font-medium text-gray-900 dark:text-white">{session.countedItems}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 dark:text-gray-400">Progress</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {session.expectedItems > 0 
                      ? Math.round((session.countedItems / session.expectedItems) * 100)
                      : 0}%
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Created: {formatDate(session.createdAt)}</span>
                {session.completedAt && (
                  <span>Completed: {formatDate(session.completedAt)}</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">New Stock Count</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Session Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Warehouse Count Q1 2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Warehouse"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expected Items
                </label>
                <input
                  type="number"
                  value={formData.expectedItems}
                  onChange={(e) => setFormData({ ...formData, expectedItems: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !formData.name || !formData.location}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
