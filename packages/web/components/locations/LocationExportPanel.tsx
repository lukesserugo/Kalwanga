'use client';

// packages/web/components/locations/LocationExportPanel.tsx

import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../utils/toast-manager';
import LocationBUSelector from './LocationBUSelector';

type ExportFormat = 'csv' | 'xlsx' | 'json' | 'pdf';

interface LocationExportPanelProps {
  initialBusinessUnitId?: string;
}

const FORMATS: { value: ExportFormat; label: string; icon: React.ElementType; desc: string }[] = [
  {
    value: 'csv',
    label: 'CSV',
    icon: FileText,
    desc: 'Comma-separated values — opens in any spreadsheet app.',
  },
  {
    value: 'xlsx',
    label: 'Excel',
    icon: FileSpreadsheet,
    desc: 'Native Excel workbook with formatting.',
  },
  {
    value: 'json',
    label: 'JSON',
    icon: FileJson,
    desc: 'Structured data for developer use or backup.',
  },
  {
    value: 'pdf',
    label: 'PDF',
    icon: FileText,
    desc: 'Print-ready document.',
  },
];

export function LocationExportPanel({
  initialBusinessUnitId,
}: LocationExportPanelProps) {
  const [businessUnitId, setBusinessUnitId] = useState(
    initialBusinessUnitId ?? ''
  );
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeInventory, setIncludeInventory] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!businessUnitId) {
      toast.error('Select a business unit first');
      return;
    }

    setExporting(true);
    try {
      const response = await api.get('/locations/export', {
        params: {
          businessUnitId,
          format,
          includeInactive: includeInactive ? 'true' : 'false',
          includeInventory: includeInventory ? 'true' : 'false',
        },
        responseType: 'blob',
      });

      // The api client returns either a Blob or an envelope depending on
      // config. Handle both.
      const blob =
        response instanceof Blob
          ? response
          : new Blob([JSON.stringify(response)], {
              type: 'application/json',
            });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `locations-${businessUnitId}-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Export failed'
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <LocationBUSelector value={businessUnitId} onChange={setBusinessUnitId} />

      {/* Format picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Export format
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const selected = format === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                className={`p-4 rounded-xl border text-left transition duration-250 focus-ring ${
                  selected
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-brand'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-card'
                }`}
              >
                <Icon
                  className={`w-5 h-5 mb-2 ${
                    selected
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <p
                  className={`text-sm font-medium ${
                    selected
                      ? 'text-brand-700 dark:text-brand-300'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {f.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                  {f.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Options */}
      <div className="card-brand shadow-soft p-4 space-y-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Include inactive locations
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Deactivated locations are excluded by default.
            </p>
          </div>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 transition duration-250"
          />
        </label>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Include inventory summary
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Adds a column with the current stock count per location.
            </p>
          </div>
          <input
            type="checkbox"
            checked={includeInventory}
            onChange={(e) => setIncludeInventory(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 transition duration-250"
          />
        </label>
      </div>

      {/* Action */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !businessUnitId}
          className="btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparing…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Download <span className="tabular-nums">{format.toUpperCase()}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default LocationExportPanel;
