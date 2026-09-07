'use client';

import React, { useState } from 'react';
import { Download, Loader2, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import { reportService } from '../../services/reportService';
import { toast } from '../../utils/toast-manager';
import { ReportType, ReportFormat } from '../../types/report';

interface ReportFormProps {
  businessUnitId: string;
  companyId: string;
}

const REPORT_TYPES: Array<{ value: ReportType; label: string; description: string }> = [
  { value: 'sales', label: 'Sales Report', description: 'Revenue, trends, and top products' },
  { value: 'inventory', label: 'Inventory Report', description: 'Stock levels and valuation' },
  { value: 'customers', label: 'Customer Report', description: 'Customer analytics and spending' },
  { value: 'products', label: 'Product Report', description: 'Product performance and sales' },
  { value: 'employees', label: 'Employee Report', description: 'Employee performance' },
  { value: 'payments', label: 'Payment Report', description: 'Payment methods and transactions' },
  { value: 'comprehensive', label: 'Comprehensive Report', description: 'Full business overview' },
  { value: 'tax', label: 'Tax Report', description: 'Tax summary and filing' },
];

const REPORT_FORMATS: Array<{ value: ReportFormat; label: string; icon: any }> = [
  { value: 'pdf', label: 'PDF', icon: FileText },
  { value: 'csv', label: 'CSV', icon: FileSpreadsheet },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { value: 'json', label: 'JSON', icon: FileJson },
];

export function ReportForm({ businessUnitId, companyId }: ReportFormProps) {
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        type: reportType,
        format,
        startDate,
        endDate,
        businessUnitId,
      };

      if (reportType === 'sales' && groupBy) {
        params.groupBy = groupBy;
      }

      if (reportType === 'customers') {
        params.companyId = companyId;
      }

      const response = await reportService.generateReport(params);

      if (response && response.filePath) {
        // Trigger download
        const downloadUrl = response.filePath;
        window.open(downloadUrl, '_blank');
      }

      toast.success('Report generated successfully');
    } catch (error: any) {
      console.error('Failed to generate report:', error);
      toast.error(error?.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 space-y-6">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Generate Report</h3>
        
        {/* Report Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {REPORT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setReportType(type.value)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                reportType === type.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-sm text-gray-900 dark:text-white">{type.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{type.description}</p>
            </button>
          ))}
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date *</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            />
          </div>
        </div>

        {/* Group By (for sales report) */}
        {reportType === 'sales' && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
        )}

        {/* Format */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Format</label>
          <div className="flex gap-2">
            {REPORT_FORMATS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    format === f.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Download className="w-5 h-5" />
          )}
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>
    </div>
  );
}
