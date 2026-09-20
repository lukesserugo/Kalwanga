'use client';

// packages/web/components/locations/LocationImportWizard.tsx

import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { api } from '../../services/api';
import { toast } from '../../utils/toast-manager';
import LocationBUSelector from './LocationBUSelector';

interface PreviewRow {
  name: string;
  code?: string;
  type?: string;
  description?: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
  __error?: string;
}

interface LocationImportWizardProps {
  initialBusinessUnitId?: string;
}

const TEMPLATE_HEADERS = [
  'name',
  'code',
  'type',
  'description',
  'address',
  'phone',
  'isDefault',
];

export function LocationImportWizard({
  initialBusinessUnitId,
}: LocationImportWizardProps) {
  const [businessUnitId, setBusinessUnitId] = useState(
    initialBusinessUnitId ?? ''
  );
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const csv = `${TEMPLATE_HEADERS.join(',')}\nMain Warehouse,WH-01,WAREHOUSE,Primary storage,123 Main St,+1 555 0100,true\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'locations-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): PreviewRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const rows: PreviewRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',').map((c) => c.trim());
      const row: PreviewRow = { name: '' };
      headers.forEach((h, idx) => {
        const val = cells[idx] ?? '';
        switch (h) {
          case 'name':
            row.name = val;
            break;
          case 'code':
            row.code = val;
            break;
          case 'type':
            row.type = val.toUpperCase();
            break;
          case 'description':
            row.description = val;
            break;
          case 'address':
            row.address = val;
            break;
          case 'phone':
            row.phone = val;
            break;
          case 'isDefault':
            row.isDefault = val.toLowerCase() === 'true';
            break;
        }
      });
      if (!row.name) row.__error = 'Missing name';
      rows.push(row);
    }
    return rows;
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setParsing(true);
    try {
      const text = await f.text();
      setPreview(parseCSV(text));
    } catch (err) {
      toast.error('Could not read the file');
      setPreview([]);
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = async () => {
    if (!businessUnitId) {
      toast.error('Select a business unit first');
      return;
    }
    const valid = preview.filter((r) => !r.__error && r.name);
    if (valid.length === 0) {
      toast.error('No valid rows to import');
      return;
    }

    setUploading(true);
    try {
      const raw = await api.post<any>('/locations/import', {
        businessUnitId,
        rows: valid,
      });
      const res = raw?.data ?? raw;
      setResult({
        created: res?.created ?? valid.length,
        failed: res?.failed ?? 0,
        errors: res?.errors ?? [],
      });
      toast.success('Import complete');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Import failed'
      );
    } finally {
      setUploading(false);
    }
  };

  const validCount = preview.filter((r) => !r.__error && r.name).length;
  const invalidCount = preview.length - validCount;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <LocationBUSelector value={businessUnitId} onChange={setBusinessUnitId} />
        <button
          type="button"
          onClick={downloadTemplate}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors inline-flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" />
          Download template
        </button>
        {file && (
          <button
            type="button"
            onClick={reset}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!file && (
        <label
          className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Upload className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Drop a CSV file here, or click to browse
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Supported: .csv — max 5MB
          </p>
        </label>
      )}

      {/* Preview */}
      {file && !parsing && preview.length > 0 && !result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {file.name}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {validCount} valid · {invalidCount} invalid
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Code
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {preview.map((row, idx) => (
                  <tr
                    key={idx}
                    className={
                      row.__error ? 'bg-red-50/40 dark:bg-red-900/10' : ''
                    }
                  >
                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                      {row.name || <em className="text-gray-400">—</em>}
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-500 dark:text-gray-400">
                      {row.code || '—'}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {row.type || 'STORE'}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {row.__error ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {row.__error}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button
              type="button"
              onClick={reset}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || validCount === 0 || !businessUnitId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Import {validCount} row{validCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Import complete
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {result.created} created
              {result.failed > 0 && `, ${result.failed} failed`}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-4 text-left text-xs text-red-600 dark:text-red-400 space-y-1 max-h-48 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocationImportWizard;
