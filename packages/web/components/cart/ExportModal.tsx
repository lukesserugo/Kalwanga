// D:\Projects\Kalwanga\packages\web\components\cart\ExportModal.tsx

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Download, FileText, FileSpreadsheet, FileJson,
  Loader2, CheckCircle, AlertCircle, Calendar,
  Filter, Layers, Package, ShoppingCart, Users,
  DollarSign, Percent, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ============================================
// INTERFACES
// ============================================

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: any) => Promise<void>;
  type: 'analytics' | 'history' | 'abandoned';
  dateRange?: string;
  customStartDate?: string;
  customEndDate?: string;
  title?: string;
  description?: string;
  availableMetrics?: Array<{ id: string; label: string; icon: any }>;
  additionalOptions?: React.ReactNode;
}

interface ExportOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  includeMetrics: string[];
  dateRange: string;
  startDate?: string;
  endDate?: string;
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetailedData: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', icon: FileText, color: 'text-green-500' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'text-emerald-500' },
  { value: 'json', label: 'JSON', icon: FileJson, color: 'text-blue-500' },
  { value: 'pdf', label: 'PDF', icon: FileText, color: 'text-red-500' },
];

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function ExportModal({
  isOpen,
  onClose,
  onExport,
  type,
  dateRange: initialDateRange = 'week',
  customStartDate: initialStartDate = '',
  customEndDate: initialEndDate = '',
  title,
  description,
  availableMetrics = [],
  additionalOptions,
}: ExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeMetrics: availableMetrics.map(m => m.id),
    dateRange: initialDateRange,
    startDate: initialStartDate,
    endDate: initialEndDate,
    includeCharts: false,
    includeSummary: true,
    includeDetailedData: true,
  });
  const [expandedSections, setExpandedSections] = useState({
    metrics: true,
    options: true,
  });

  // ============================================
  // HANDLERS
  // ============================================

  const handleFormatChange = (format: ExportOptions['format']) => {
    setExportOptions(prev => ({ ...prev, format }));
  };

  const handleMetricToggle = (metricId: string) => {
    setExportOptions(prev => ({
      ...prev,
      includeMetrics: prev.includeMetrics.includes(metricId)
        ? prev.includeMetrics.filter(id => id !== metricId)
        : [...prev.includeMetrics, metricId],
    }));
  };

  const handleToggleAllMetrics = () => {
    setExportOptions(prev => ({
      ...prev,
      includeMetrics: prev.includeMetrics.length === availableMetrics.length
        ? []
        : availableMetrics.map(m => m.id),
    }));
  };

  const handleDateRangeChange = (value: string) => {
    setExportOptions(prev => ({ ...prev, dateRange: value }));
    if (value === 'custom') {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setExportOptions(prev => ({
        ...prev,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      }));
    }
  };

  const handleToggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleExport = async () => {
    if (exportOptions.includeMetrics.length === 0 && availableMetrics.length > 0) {
      toast.error('Please select at least one metric to export');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        format: exportOptions.format,
        metrics: exportOptions.includeMetrics,
        dateRange: exportOptions.dateRange,
        startDate: exportOptions.startDate,
        endDate: exportOptions.endDate,
        includeCharts: exportOptions.includeCharts,
        includeSummary: exportOptions.includeSummary,
        includeDetailedData: exportOptions.includeDetailedData,
      };

      console.log('📤 Exporting with payload:', payload);

      await onExport(payload);

      setSuccess(true);
      toast.success('Export completed successfully!');

      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error('❌ Export failed:', error);
      setError(error?.message || 'Failed to export data');
      toast.error(error?.message || 'Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeLabel = () => {
    if (exportOptions.dateRange === 'custom' && exportOptions.startDate && exportOptions.endDate) {
      return `${new Date(exportOptions.startDate).toLocaleDateString()} - ${new Date(exportOptions.endDate).toLocaleDateString()}`;
    }
    const range = DATE_RANGES.find(r => r.value === exportOptions.dateRange);
    return range?.label || exportOptions.dateRange;
  };

  // ============================================
  // RENDER
  // ============================================

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Download className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {title || 'Export Data'}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {description || 'Export data in various formats'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {success ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Export Successful!
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">
                    Your file has been exported successfully.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                      </div>
                    </div>
                  )}

                  {/* Format Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Export Format
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {EXPORT_FORMATS.map((format) => {
                        const Icon = format.icon;
                        const isSelected = exportOptions.format === format.value;
                        return (
                          <button
                            key={format.value}
                            onClick={() => handleFormatChange(format.value as any)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : format.color}`} />
                            <span className={`text-sm font-medium ${
                              isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                            }`}>
                              {format.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Metrics Selection */}
                  {availableMetrics.length > 0 && (
                    <div>
                      <button
                        onClick={() => handleToggleSection('metrics')}
                        className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        <span>Select Metrics</span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${
                          expandedSections.metrics ? 'rotate-180' : ''
                        }`} />
                      </button>
                      {expandedSections.metrics && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {exportOptions.includeMetrics.length} of {availableMetrics.length} selected
                            </span>
                            <button
                              onClick={handleToggleAllMetrics}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors"
                            >
                              {exportOptions.includeMetrics.length === availableMetrics.length
                                ? 'Deselect All'
                                : 'Select All'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {availableMetrics.map((metric) => {
                              const Icon = metric.icon;
                              const isSelected = exportOptions.includeMetrics.includes(metric.id);
                              return (
                                <label
                                  key={metric.id}
                                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleMetricToggle(metric.id)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                                  />
                                  <Icon className="w-4 h-4 text-gray-500" />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {metric.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Date Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Date Range
                    </label>
                    <select
                      value={exportOptions.dateRange}
                      onChange={(e) => handleDateRangeChange(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {DATE_RANGES.map((range) => (
                        <option key={range.value} value={range.value}>
                          {range.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Date Picker */}
                  {exportOptions.dateRange === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={exportOptions.startDate}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, startDate: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="date"
                        value={exportOptions.endDate}
                        onChange={(e) => setExportOptions(prev => ({ ...prev, endDate: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Additional Options */}
                  {additionalOptions && (
                    <div>
                      <button
                        onClick={() => handleToggleSection('options')}
                        className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        <span>Additional Options</span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${
                          expandedSections.options ? 'rotate-180' : ''
                        }`} />
                      </button>
                      {expandedSections.options && (
                        <div className="mt-3 space-y-3">
                          {additionalOptions}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary Info */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Exporting data for: <strong className="text-gray-900 dark:text-white">{getDateRangeLabel()}</strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {availableMetrics.length > 0 && `${exportOptions.includeMetrics.length} metrics selected`}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                {!success && (
                  <button
                    onClick={handleExport}
                    disabled={loading || (availableMetrics.length > 0 && exportOptions.includeMetrics.length === 0)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Export
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default ExportModal;
