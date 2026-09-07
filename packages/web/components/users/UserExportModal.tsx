// D:\Projects\Kalwanga\packages\web\components\users\UserExportModal.tsx

'use client';

import React, { useState } from 'react';
import { 
  X, Download, FileText, FileSpreadsheet, FileJson,
  Loader2, CheckCircle, AlertCircle, Calendar,
  Filter, Users, Mail, Phone, Building, Shield,
  ChevronDown, ChevronUp, Clock, Hash
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { userService } from '../../services/userService';

interface UserExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onExportComplete?: () => void;
}

export function UserExportModal({
  isOpen,
  onClose,
  userId,
  onExportComplete,
}: UserExportModalProps) {
  const [format, setFormat] = useState<'csv' | 'excel' | 'json'>('csv');
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [includeFields, setIncludeFields] = useState({
    basic: true,
    contact: true,
    role: true,
    permissions: true,
    businessUnits: true,
    activity: false,
    metadata: false,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      let result;
      
      if (userId) {
        // Export single user
        result = await userService.exportUsers(format);
      } else {
        // Export all users
        result = await userService.exportUsers(format);
      }
      
      setSuccess(true);
      toast.success('Export completed successfully');
      setTimeout(() => {
        onExportComplete?.();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error?.message || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Download className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Export Users
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Export user data to file
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Format Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setFormat('csv')}
                  className={`p-3 rounded-lg border transition-all ${
                    format === 'csv'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FileText className="w-6 h-6 mx-auto text-gray-500" />
                  <span className="text-xs font-medium mt-1 block">CSV</span>
                </button>
                <button
                  onClick={() => setFormat('excel')}
                  className={`p-3 rounded-lg border transition-all ${
                    format === 'excel'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FileSpreadsheet className="w-6 h-6 mx-auto text-green-500" />
                  <span className="text-xs font-medium mt-1 block">Excel</span>
                </button>
                <button
                  onClick={() => setFormat('json')}
                  className={`p-3 rounded-lg border transition-all ${
                    format === 'json'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <FileJson className="w-6 h-6 mx-auto text-yellow-500" />
                  <span className="text-xs font-medium mt-1 block">JSON</span>
                </button>
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date Range
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 'all', label: 'All Time' },
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'This Week' },
                  { value: 'month', label: 'This Month' },
                ].map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setDateRange(range.value as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      dateRange === range.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Include Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Include Fields
              </label>
              <div className="space-y-2">
                {[
                  { key: 'basic', label: 'Basic Information (Name, Email)' },
                  { key: 'contact', label: 'Contact Information (Phone)' },
                  { key: 'role', label: 'Role and Status' },
                  { key: 'permissions', label: 'Permissions' },
                  { key: 'businessUnits', label: 'Business Units' },
                  { key: 'activity', label: 'Activity Data' },
                  { key: 'metadata', label: 'Metadata' },
                ].map((field) => (
                  <label key={field.key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={includeFields[field.key as keyof typeof includeFields]}
                      onChange={(e) => setIncludeFields(prev => ({
                        ...prev,
                        [field.key]: e.target.checked,
                      }))}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    {field.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {loading ? 'Exporting...' : success ? 'Done!' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserExportModal;
