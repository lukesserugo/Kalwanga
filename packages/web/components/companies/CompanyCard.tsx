// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\companies\components\CompanyCard.tsx

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building,
  Users,
  Briefcase,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  MapPin,
  Phone,
  Globe,
  Loader2,
  Copy,
  Check,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ============================================================
// RESERVED ROUTE GUARD
// A company ID must never be one of these route segments.
// If it is, we refuse to build links — this prevents the
// "/admin/companies/settings/edit" style 404 loops.
// ============================================================
const RESERVED_ROUTE_IDS = new Set([
  'settings',
  'default',
  'search',
  'email',
  'by-business-unit',
  'ensure-user',
  'bulk',
  'export',
  'activity',
  'stats',
  'business-units',
  'default-business-unit',
  'new',
  'edit',
]);

function isReservedRouteId(id: string | undefined | null): boolean {
  if (!id) return false;
  return RESERVED_ROUTE_IDS.has(id);
}

interface CompanyCardProps {
  company: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address?: string | null;
    currency: string;
    timezone: string;
    logo?: string | null;
    isActive: boolean;
    createdAt: string;
    _count?: {
      businessUnits: number;
      users: number;
      customers: number;
      suppliers: number;
    };
    businessUnits?: Array<{
      id: string;
      name: string;
      code: string;
      isActive: boolean;
    }>;
  };
  onDelete: (id: string, name: string) => void;
  isDeleting?: boolean;
}

export function CompanyCard({
  company,
  onDelete,
  isDeleting,
}: CompanyCardProps) {
  const [copied, setCopied] = useState<string | null>(null);

  // ✅ Guard: if the id is a reserved route segment, disable all actions
  const invalidId = isReservedRouteId(company.id);

  const copyToClipboard = (
    text: string,
    label: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        <CheckCircle className="w-3 h-3" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
        <XCircle className="w-3 h-3" />
        Inactive
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group">
      {/* Invalid ID warning banner */}
      {invalidId && (
        <div className="mb-4 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            ⚠️ This record has an invalid ID (<code>{company.id}</code>).
            Actions are disabled.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex-shrink-0">
            {company.logo ? (
              <img
                src={company.logo}
                alt={company.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            )}
          </div>
          <div className="min-w-0">
            <h3
              className="font-semibold text-gray-900 dark:text-white truncate"
              title={company.name}
            >
              {company.name}
            </h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                {company.email}
              </p>
              <button
                type="button"
                onClick={(e) => copyToClipboard(company.email, 'Email', e)}
                className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
                title="Copy email"
                aria-label="Copy email"
              >
                {copied === 'Email' ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </button>
            </div>
          </div>
        </div>
        {getStatusBadge(company.isActive)}
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4 text-sm">
        {/* Company ID */}
        <div className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-900/50 rounded-lg px-2 py-1">
          <span className="text-gray-400 dark:text-gray-500 font-mono">
            ID:
          </span>
          <code className="text-gray-600 dark:text-gray-400 font-mono truncate flex-1">
            {company.id}
          </code>
          <button
            type="button"
            onClick={(e) => copyToClipboard(company.id, 'Company ID', e)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
            title="Copy Company ID"
            aria-label="Copy Company ID"
          >
            {copied === 'Company ID' ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Copy className="w-3 h-3 text-gray-400" />
            )}
          </button>
        </div>

        {company.phone && (
          <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            {company.phone}
          </p>
        )}
        {company.address && (
          <p className="text-gray-600 dark:text-gray-400 flex items-start gap-2">
            <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
            <span className="truncate">{company.address}</span>
          </p>
        )}
        <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          {company.currency} • {company.timezone}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Briefcase className="w-3.5 h-3.5" />
          {company._count?.businessUnits || 0} Units
        </span>
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <Users className="w-3.5 h-3.5" />
          {company._count?.users || 0} Users
        </span>
        {company._count?.customers !== undefined && (
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Users className="w-3.5 h-3.5" />
            {company._count?.customers || 0} Customers
          </span>
        )}
      </div>

      {/* Business Units Preview */}
      {company.businessUnits && company.businessUnits.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex flex-wrap gap-1.5">
            {company.businessUnits.slice(0, 3).map((unit) => (
              <span
                key={unit.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded-md text-xs text-blue-700 dark:text-blue-300"
              >
                <Briefcase className="w-2.5 h-2.5" />
                {unit.name}
                {!unit.isActive && (
                  <span className="text-gray-400 dark:text-gray-500">
                    (inactive)
                  </span>
                )}
              </span>
            ))}
            {company.businessUnits.length > 3 && (
              <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-md text-xs text-gray-500 dark:text-gray-400">
                +{company.businessUnits.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatDistanceToNow(new Date(company.createdAt), {
            addSuffix: true,
          })}
        </span>
        <div className="flex gap-1">
          {/* ✅ Disable navigation entirely when the id is invalid */}
          {invalidId ? (
            <span
              className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
              title="Invalid ID — action disabled"
            >
              <Eye className="w-3.5 h-3.5 text-gray-400" />
            </span>
          ) : (
            <Link
              href={`/admin/companies/${company.id}`}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="View Details"
            >
              <Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            </Link>
          )}

          {invalidId ? (
            <span
              className="p-1.5 rounded-lg opacity-40 cursor-not-allowed"
              title="Invalid ID — action disabled"
            >
              <Edit className="w-3.5 h-3.5 text-gray-400" />
            </span>
          ) : (
            <Link
              href={`/admin/companies/${company.id}/edit`}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => {
              if (invalidId) return;
              onDelete(company.id, company.name);
            }}
            disabled={isDeleting || invalidId}
            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={invalidId ? 'Invalid ID — action disabled' : 'Delete'}
            aria-label="Delete company"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 text-red-500 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
