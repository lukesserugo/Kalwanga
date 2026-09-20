'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  Loader2,
  CheckCircle,
  AlertCircle,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { toast } from '../../utils/toast-manager';

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

const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV', icon: FileText, color: 'text-success-500' },
  {
    value: 'excel',
    label: 'Excel',
    icon: FileSpreadsheet,
    color: 'text-success-500',
  },
  { value: 'json', label: 'JSON', icon: FileJson, color: 'text-brand-500' },
  { value: 'pdf', label: 'PDF', icon: FileText, color: 'text-danger-500' },
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
    includeMetrics: availableMetrics.map((m) => m.id),
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

  const handleFormatChange = (format: ExportOptions['format']) => {
    setExportOptions((prev) => ({ ...prev, format }));
  };

  const handleMetricToggle = (metricId: string) => {
    setExportOptions((prev) => ({
      ...prev,
      includeMetrics: prev.includeMetrics.includes(metricId)
        ? prev.includeMetrics.filter((id) => id !== metricId)
        : [...prev.includeMetrics, metricId],
    }));
  };

  const handleToggleAllMetrics = () => {
    setExportOptions((prev) => ({
      ...prev,
      includeMetrics:
        prev.includeMetrics.length === availableMetrics.length
          ? []
          : availableMetrics.map((m) => m.id),
    }));
  };

  const handleDateRangeChange = (value: string) => {
    setExportOptions((prev) => ({ ...prev, dateRange: value }));
    if (value === 'custom') {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setExportOptions((prev) => ({
        ...prev,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      }));
    }
  };

  const handleToggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleExport = async () => {
    if (
      exportOptions.includeMetrics.length === 0 &&
      availableMetrics.length > 0
    ) {
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
    if (
      exportOptions.dateRange === 'custom' &&
      exportOptions.startDate &&
      exportOptions.endDate
    ) {
      return `${new Date(
        exportOptions.startDate
      ).toLocaleDateString()} - ${new Date(
        exportOptions.endDate
      ).toLocaleDateString()}`;
    }
    const range = DATE_RANGES.find(
      (r) => r.value === exportOptions.dateRange
    );
    return range?.label || exportOptions.dateRange;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-card-hover max-w-2xl w-full max-h-[90vh] overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                  <Download className="w-5 h-5 text-brand-600 dark:text-brand-400" />
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
                className="p-2 hover:bg-orange-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] custom-scrollbar">
              {success ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-success-600 dark:text-success-400" />
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
                    <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 flex items-start gap-3 animate-slide-down">
                      <AlertCircle className="w-5 h-5 text-danger-600 dark:text-danger-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-danger-800 dark:text-danger-200">
                          {error}
                        </p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Export Format
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {EXPORT_FORMATS.map((format) => {
                        const Icon = format.icon;
                        const isSelected =
                          exportOptions.format === format.value;
                        return (
                          <button
                            key={format.value}
                            onClick={() =>
                              handleFormatChange(format.value as any)
                            }
                            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 focus-ring ${
                              isSelected
                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            <Icon
                              className={`w-6 h-6 ${
                                isSelected
                                  ? 'text-brand-600'
                                  : format.color
                              }`}
                            />
                            <span
                              className={`text-sm font-medium ${
                                isSelected
                                  ? 'text-brand-600 dark:text-brand-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              {format.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {availableMetrics.length > 0 && (
                    <div>
                      <button
                        onClick={() => handleToggleSection('metrics')}
                        className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 focus-ring rounded"
                      >
                        <span>Select Metrics</span>
                        <ChevronDown
                          className={`w-5 h-5 transition-transform ${
                            expandedSections.metrics ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {expandedSections.metrics && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                              {exportOptions.includeMetrics.length} of{' '}
                              {availableMetrics.length} selected
                            </span>
                            <button
                              onClick={handleToggleAllMetrics}
                              className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors focus-ring rounded"
                            >
                              {exportOptions.includeMetrics.length ===
                              availableMetrics.length
                                ? 'Deselect All'
                                : 'Select All'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {availableMetrics.map((metric) => {
                              const Icon = metric.icon;
                              const isSelected =
                                exportOptions.includeMetrics.includes(
                                  metric.id
                                );
                              return (
                                <label
                                  key={metric.id}
                                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                                    isSelected
                                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      handleMetricToggle(metric.id)
                                    }
                                    className="w-4 h-4 text-brand-600 border-gray-300 dark:border-gray-600 rounded focus:ring-brand-500 focus:outline-none"
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Date Range
                    </label>
                    <select
                      value={exportOptions.dateRange}
                      onChange={(e) =>
                        handleDateRangeChange(e.target.value)
                      }
                      className="input-brand"
                    >
                      {DATE_RANGES.map((range) => (
                        <option key={range.value} value={range.value}>
                          {range.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {exportOptions.dateRange === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={exportOptions.startDate}
                        onChange={(e) =>
                          setExportOptions((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        className="input-brand tabular-nums"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="date"
                        value={exportOptions.endDate}
                        onChange={(e) =>
                          setExportOptions((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        className="input-brand tabular-nums"
                      />
                    </div>
                  )}

                  {additionalOptions && (
                    <div>
                      <button
                        onClick={() => handleToggleSection('options')}
                        className="w-full flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 focus-ring rounded"
                      >
                        <span>Additional Options</span>
                        <ChevronDown
                          className={`w-5 h-5 transition-transform ${
                            expandedSections.options ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {expandedSections.options && (
                        <div className="mt-3 space-y-3">
                          {additionalOptions}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>
                        Exporting data for:{' '}
                        <strong className="text-gray-900 dark:text-white">
                          {getDateRangeLabel()}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                {availableMetrics.length > 0 &&
                  `${exportOptions.includeMetrics.length} metrics selected`}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="btn-secondary focus-ring disabled:opacity-50"
                >
                  Cancel
                </button>
                {!success && (
                  <button
                    onClick={handleExport}
                    disabled={
                      loading ||
                      (availableMetrics.length > 0 &&
                        exportOptions.includeMetrics.length === 0)
                    }
                    className="px-6 py-2 bg-brand-gradient hover:shadow-brand-lg text-white rounded-lg shadow-brand transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
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
