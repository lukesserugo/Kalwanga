'use client';

// packages/web/components/locations/LocationDataTable.tsx

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  /** Right-align numeric cells. */
  align?: 'left' | 'right' | 'center';
  /** Hide below this Tailwind breakpoint prefix, e.g. 'md' hides below md. */
  hideBelow?: 'sm' | 'md' | 'lg';
  render: (row: T) => React.ReactNode;
}

interface LocationDataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

const alignClass: Record<NonNullable<Column<any>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const hideClass: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

export function LocationDataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyMessage = 'No records found.',
  onRowClick,
}: LocationDataTableProps<T>) {
  if (loading) {
    return (
      <div className="card-brand shadow-soft p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600 dark:text-brand-400 mx-auto" />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card-brand shadow-soft p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="card-brand shadow-soft overflow-hidden p-0">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider eyebrow ${
                    alignClass[col.align ?? 'left']
                  } ${col.hideBelow ? hideClass[col.hideBelow] : ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`transition duration-250 focus-ring ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 text-sm ${
                      alignClass[col.align ?? 'left']
                    } ${col.hideBelow ? hideClass[col.hideBelow] : ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LocationDataTable;
