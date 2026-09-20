'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export interface CompanyReportsRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  currency: string;
  createdAt: string;
  businessUnitCount: number;
  userCount: number;
  customerCount: number;
  supplierCount: number;
}

interface Props {
  rows: CompanyReportsRow[];
}

type SortKey =
  | 'name'
  | 'businessUnitCount'
  | 'userCount'
  | 'customerCount'
  | 'supplierCount'
  | 'createdAt';

export default function CompanyReportsTable({ rows }: Props) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q),
        )
      : rows;
    const sorted = [...base].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      if (as < bs) return sortDir === 'asc' ? -1 : 1;
      if (as > bs) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const HeaderCell = ({
    label,
    k,
    align = 'left',
  }: {
    label: string;
    k: SortKey;
    align?: 'left' | 'right';
  }) => (
    <th
      className={`px-4 py-3 text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => toggleSort(k)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus-ring rounded ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {label}
        {sortKey === k ? (
          sortDir === 'asc' ? (
            <ChevronUpIcon className="w-3 h-3" />
          ) : (
            <ChevronDownIcon className="w-3 h-3" />
          )
        ) : (
          <ChevronDownIcon className="w-3 h-3 opacity-30" />
        )}
      </button>
    </th>
  );

  return (
    <div>
      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:outline-none transition-shadow"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <HeaderCell label="Company" k="name" />
              <th className="px-4 py-3 text-2xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left">
                Status
              </th>
              <HeaderCell
                label="Business Units"
                k="businessUnitCount"
                align="right"
              />
              <HeaderCell label="Users" k="userCount" align="right" />
              <HeaderCell
                label="Customers"
                k="customerCount"
                align="right"
              />
              <HeaderCell
                label="Suppliers"
                k="supplierCount"
                align="right"
              />
              <HeaderCell label="Created" k="createdAt" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {query
                    ? 'No companies match your search.'
                    : 'No companies to display.'}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-orange-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[220px]">
                      {row.name}
                    </p>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                      {row.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {row.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700 dark:text-gray-300 tabular-nums">
                    {row.businessUnitCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700 dark:text-gray-300 tabular-nums">
                    {row.userCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700 dark:text-gray-300 tabular-nums">
                    {row.customerCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-gray-700 dark:text-gray-300 tabular-nums">
                    {row.supplierCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/companies/${row.id}`}
                      prefetch={false}
                      className="inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors focus-ring rounded"
                    >
                      View
                      <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
