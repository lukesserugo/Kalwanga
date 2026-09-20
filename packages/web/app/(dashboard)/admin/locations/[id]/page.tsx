'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Package, Edit, Trash2, Loader2,
  Star, CheckCircle, AlertCircle, Building2,
} from 'lucide-react';
import { locationService, type Location } from '../../../../../services/locationService';
import { inventoryService } from '../../../../../services/inventoryService';
import { toast } from '../../../../../utils/toast-manager';

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [location, setLocation] = useState<Location | null>(null);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const buId =
          typeof window !== 'undefined'
            ? localStorage.getItem('selectedBusinessUnitId') ||
              localStorage.getItem('businessUnitId') ||
              undefined
            : undefined;

        const list = await locationService.list(buId);
        const found = list.find((l) => l.id === id);
        if (!found) {
          setError('Location not found');
          setLocation(null);
          return;
        }
        if (cancelled) return;
        setLocation(found);

        try {
          const all = await inventoryService.getAllInventory(found.businessUnitId);
          const count = (all.items || []).filter(
            (i: any) => i.location === found.name
          ).length;
          if (!cancelled) setInventoryCount(count);
        } catch {
          /* best effort */
        }
      } catch (err: any) {
        if (!cancelled)
          setError(err?.message || 'Failed to load location');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleDelete = async () => {
    if (!location) return;
    if (!confirm(`Delete "${location.name}"? This cannot be undone.`)) return;
    try {
      await locationService.remove(location.id, location.businessUnitId);
      toast.success('Location deleted');
      router.push('/admin/locations');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete location');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <AlertCircle className="w-12 h-12 text-danger-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {error || 'Location not found'}
        </h2>
        <Link
          href="/admin/locations"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg focus-ring"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Locations
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <Link
        href="/admin/locations"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus-ring rounded"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Locations
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-brand-500" />
            {location.name}
          </h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {location.isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
                <Star className="w-3 h-3" />
                Default
              </span>
            )}
            {location.isActive ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300">
                <CheckCircle className="w-3 h-3" />
                Active
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                Inactive
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/locations/${location.id}/edit`}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1 text-sm focus-ring"
          >
            <Edit className="w-4 h-4" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            className="px-3 py-2 border border-danger-300 dark:border-danger-600 text-danger-600 dark:text-danger-400 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 flex items-center gap-1 text-sm focus-ring"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-brand p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
            {location.type?.replace(/_/g, ' ').toLowerCase() || 'Other'}
          </p>
        </div>
        <div className="card-brand p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Code</p>
          <p className="text-lg font-mono text-gray-900 dark:text-white">
            {location.code || '—'}
          </p>
        </div>
        <div className="card-brand p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Inventory Items</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-1 tabular-nums">
            <Package className="w-4 h-4 text-gray-400" />
            {inventoryCount}
          </p>
        </div>
      </div>

      <div className="card-brand p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Details
        </h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {location.description && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500 dark:text-gray-400">Description</dt>
              <dd className="text-gray-900 dark:text-white">
                {location.description}
              </dd>
            </div>
          )}
          {location.address && (
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Address</dt>
              <dd className="text-gray-900 dark:text-white">
                {location.address}
              </dd>
            </div>
          )}
          {location.phone && (
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Phone</dt>
              <dd className="text-gray-900 dark:text-white">{location.phone}</dd>
            </div>
          )}
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Business Unit</dt>
            <dd className="text-gray-900 dark:text-white flex items-center gap-1">
              <Building2 className="w-4 h-4 text-gray-400" />
              {location.businessUnitId}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
