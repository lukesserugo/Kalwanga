// src/components/reports/ReportGenerator.tsx
import React, { useState } from 'react';
import {
  FileText, Download, Calendar, Filter, RefreshCw,
  FileSpreadsheet, FileJson, File, Printer,
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, ShoppingBag, AlertCircle, CheckCircle,
  Eye // Add Eye import
} from 'lucide-react';
import { reportService } from '../../services/reportService';
import { toast } from '../../utils/toast-manager';

// Define Report type
interface Report {
  id: string;
  name: string;
  type: string;
  format: string;
  data: any;
  period: string;
  startDate?: string;
  endDate?: string;
  generatedAt: string;
}

export function ReportGenerator() {
  const [reportType, setReportType] = useState('sales');
  const [format, setFormat] = useState('pdf');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [generating, setGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [preview, setPreview] = useState(false);

  const reportTypes = [
    { id: 'sales', label: 'Sales Report', icon: TrendingUp, color: 'blue' },
    { id: 'inventory', label: 'Inventory Report', icon: Package, color: 'green' },
    { id: 'customers', label: 'Customer Report', icon: Users, color: 'purple' },
    { id: 'products', label: 'Product Report', icon: ShoppingBag, color: 'orange' },
    { id: 'employees', label: 'Employee Report', icon: Users, color: 'indigo' },
    { id: 'payments', label: 'Payment Report', icon: DollarSign, color: 'teal' },
    { id: 'financial', label: 'Financial Report', icon: FileText, color: 'red' },
    { id: 'tax', label: 'Tax Report', icon: AlertCircle, color: 'yellow' },
  ];

  const formats = [
    { id: 'pdf', label: 'PDF', icon: File },
    { id: 'csv', label: 'CSV', icon: FileSpreadsheet },
    { id: 'excel', label: 'Excel', icon: FileSpreadsheet },
    { id: 'json', label: 'JSON', icon: FileJson },
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const report = await reportService.generateReport({
        type: reportType,
        format,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setGeneratedReports([report, ...generatedReports]);
      toast.success('Report generated successfully');
      setSelectedReport(report);
      setPreview(true);
    } catch (error) {
      console.error('Failed to generate report:', error);
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (report: Report) => {
    try {
      await reportService.downloadReport(report.id);
      toast.success('Report downloaded');
    } catch (error) {
      toast.error('Failed to download report');
    }
  };

  const handlePrint = (report: Report) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>${report.name}</title></head>
          <body>
            <h1>${report.name}</h1>
            <pre>${JSON.stringify(report.data, null, 2)}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const selectedType = reportTypes.find(t => t.id === reportType);
  const TypeIcon = selectedType?.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Generator</h1>
          <p className="text-gray-600 mt-1">Generate and download business reports</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Configuration</h2>
          
          <div className="space-y-4">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {reportTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setReportType(type.id)}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        reportType === type.id
                          ? `border-${type.color}-600 bg-${type.color}-50 text-${type.color}-600`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-5 h-5 mx-auto mb-1" />
                      <span className="text-xs font-medium block">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {formats.map((f) => {
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={`p-2 rounded-lg border-2 text-center transition-colors ${
                        format === f.id
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-5 h-5 mx-auto" />
                      <span className="text-xs font-medium block">{f.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range *
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Preview & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Preview */}
          {preview && selectedReport && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedReport.name}</h3>
                    <p className="text-sm text-gray-500">
                      Generated: {new Date(selectedReport.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownload(selectedReport)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                  <button
                    onClick={() => handlePrint(selectedReport)}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1 text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-3 border-b">
                  <div className="flex items-center gap-2 text-sm">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">
                      {selectedReport.period || `${dateRange.startDate} to ${dateRange.endDate}`}
                    </span>
                  </div>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm font-mono bg-gray-50 p-4 rounded">
                    {JSON.stringify(selectedReport.data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Report History */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Recent Reports</h3>
            </div>
            <div className="divide-y">
              {generatedReports.slice(0, 5).map((report) => (
                <div key={report.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(report.generatedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDownload(report)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Download className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handlePrint(report)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <Printer className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {generatedReports.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No reports generated yet</p>
                  <p className="text-sm">Configure and generate your first report</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
