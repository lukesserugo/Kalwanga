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
      <div className="flex justify-center py-12 animate-fade-in">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600 dark:text-brand-400" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">No reports generated yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {reports.map((report) => (
        <div
          key={report.id}
          className="flex items-center justify-between p-4 card-brand shadow-soft hover:shadow-card-hover transition duration-250"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-xl flex-shrink-0">
              <FileText className="w-5 h-5 text-brand-500 dark:text-brand-400" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">{report.name}</p>
              <p className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
                {report.type.toUpperCase()} • {report.format.toUpperCase()} • {formatDate(report.generatedAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {onView && (
              <button
                onClick={() => onView(report)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition duration-250 focus-ring"
                title="View"
                aria-label={`View ${report.name}`}
              >
                <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={() => onDownload(report)}
                className="p-2 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-lg transition duration-250 focus-ring"
                title="Download"
                aria-label={`Download ${report.name}`}
              >
                <Download className="w-4 h-4 text-brand-500 dark:text-brand-400" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(report)}
                className="p-2 hover:bg-danger-100 dark:hover:bg-danger-900/30 rounded-lg transition duration-250 focus-ring"
                title="Delete"
                aria-label={`Delete ${report.name}`}
              >
                <Trash2 className="w-4 h-4 text-danger-500 dark:text-danger-400" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

