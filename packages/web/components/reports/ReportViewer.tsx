'use client';

import React from 'react';
import { Download, FileText, Eye, Trash2, Loader2 } from 'lucide-react';
import { Report } from '../../types/report';
import { formatDate } from '../../utils/formatters';

interface ReportViewerProps {
  reports: Report[];
  loading?: boolean;
  onView?: (report: Report) => void;
  onDownload?: (report: Report) => void;
  onDelete?: (report: Report) => void;
}

export function ReportViewer({ reports, loading, onView, onDownload, onDelete }: ReportViewerProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No reports generated yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <div
          key={report.id}
          className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">{report.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {report.type.toUpperCase()} • {report.format.toUpperCase()} • {formatDate(report.generatedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {onView && (
              <button
                onClick={() => onView(report)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                title="View"
              >
                <Eye className="w-4 h-4 text-gray-500" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={() => onDownload(report)}
                className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg"
                title="Download"
              >
                <Download className="w-4 h-4 text-blue-500" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(report)}
                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
