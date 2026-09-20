// src/components/common/Table.tsx
import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (item: T) => void;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectRows?: (ids: string[]) => void;
  actions?: (item: T) => React.ReactNode;
  emptyMessage?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  loading = false,
  onRowClick,
  selectable = false,
  selectedRows = [],
  onSelectRows,
  actions,
  emptyMessage = 'No data found',
  sortBy,
  sortDirection,
  onSort,
}: TableProps<T>) {
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSelectRows) {
      if (e.target.checked) {
        onSelectRows(data.map((item) => item.id));
      } else {
        onSelectRows([]);
      }
    }
  };

  const handleSelectRow = (id: string) => {
    if (onSelectRows) {
      if (selectedRows.includes(id)) {
        onSelectRows(selectedRows.filter((rowId) => rowId !== id));
      } else {
        onSelectRows([...selectedRows, id]);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 dark:border-gray-700 border-t-brand-500" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            {selectable && (
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={
                    selectedRows.length === data.length && data.length > 0
                  }
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-gray-600 focus:ring-brand-500 focus:outline-none"
                  aria-label="Select all"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={String(column.key)}
                className="px-6 py-3 text-left text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                style={{ width: column.width }}
              >
                <div className="flex items-center gap-1">
                  {column.header}
                  {column.sortable && onSort && (
                    <button
                      onClick={() => onSort(String(column.key))}
                      className="hover:text-gray-700 dark:hover:text-gray-200 focus-ring rounded"
                      aria-label={`Sort by ${column.header}`}
                    >
                      {sortBy === column.key ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )
                      ) : (
                        <ChevronUp className="w-4 h-4 opacity-30" />
                      )}
                    </button>
                  )}
                </div>
              </th>
            ))}
            {actions && (
              <th className="px-6 py-3 text-right text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {data.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={
                onRowClick
                  ? 'cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors'
                  : 'hover:bg-orange-50 dark:hover:bg-gray-700/50 transition-colors'
              }
            >
              {selectable && (
                <td className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.includes(item.id)}
                    onChange={() => handleSelectRow(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-brand-600 rounded border-gray-300 dark:border-gray-600 focus:ring-brand-500 focus:outline-none"
                    aria-label={`Select row ${item.id}`}
                  />
                </td>
              )}
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white"
                >
                  {column.render
                    ? column.render(item)
                    : (item[column.key as keyof T] as React.ReactNode)}
                </td>
              ))}
              {actions && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {actions(item)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
