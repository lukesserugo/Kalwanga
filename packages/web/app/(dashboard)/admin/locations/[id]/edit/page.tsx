'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import {
  locationService,
  type Location,
  type UpdateLocationInput,
} from '../../../../../../services/locationService';
import { LocationForm } from '../../../../../../components/locations/LocationForm';
import { toast } from '../../../../../../utils/toast-manager';

export default function EditLocationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const buId =
          typeof window !== 'undefined'
            ? localStorage.getItem('selectedBusinessUnitId') ||
              localStorage.getItem('businessUnitId') ||
              undefined
            : undefined;
        const list = await locationService.list(buId);
        const found = list.find((l) => l.id === id) || null;
        setLocation(found);
        if (!found) setError('Location not found');
      } catch (err: any) {
        setError(err?.message || 'Failed to load location');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async (data: UpdateLocationInput) => {
    if (!location) return;
    setSaving(true);
    setError(null);
    try {
      await locationService.update(location.id, data, location.businessUnitId);
      toast.success('Location updated');
      router.push(`/admin/locations/${location.id}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to update';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!location) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          {error || 'Location not found'}
        </p>
        <Link
          href="/admin/locations"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <Link
        href={`/admin/locations/${location.id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Location
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Edit Location
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <LocationForm
          mode="edit"
          saving={saving}
          error={error}
          onCancel={() => router.push(`/admin/locations/${location.id}`)}
          onSubmit={handleSubmit}
          initialValues={{
            name: location.name,
            code: location.code || '',
            type: location.type,
            description: location.description || '',
            address: location.address || '',
            phone: location.phone || '',
            isDefault: location.isDefault,
          }}
        />
      </div>
    </div>
  );
}
