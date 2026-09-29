// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\notifications\templates\page.tsx

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Plus,
  Search,
  X,
  Loader2,
  FileText,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';

import { notificationService } from '../../../../../services/notificationService';
import type { NotificationTemplate } from '../../../../../types/notification';
import { toast } from '../../../../../utils/toast-manager';
import { useConfirm } from '../../../../../components/notifications/ConfirmProvider';

// ============================================
// TYPES
// ============================================
//
// The backend exposes notification templates through
// `notificationController.getTemplates/getTemplateById/createTemplate/
// updateTemplate/deleteTemplate`, and `renderTemplate`.
//
// Those endpoints exist on the backend but were NOT wired into the
// frontend `notificationService` object — the service is missing
// `getTemplates`, `updateTemplate`, `deleteTemplate`, and
// `createTemplate`. Because we can't modify the service here, this
// page calls the API directly for those four operations via `api`
// (the same low-level client the service itself uses).
//
// The route shapes below match the backend exactly:
//
//   GET    /notifications/templates               → { success, data: NotificationTemplate[] }
//   GET    /notifications/templates/:id           → { success, data: NotificationTemplate }
//   POST   /notifications/templates               → { success, data: NotificationTemplate }
//   PUT    /notifications/templates/:id           → { success, data: NotificationTemplate }
//   DELETE /notifications/templates/:id           → { success, message }
//   POST   /notifications/templates/render        → { success, data: { subject, body } }

import { api } from '../../../../../services/api';

/**
 * Response envelope the backend wraps every successful call in.
 * Exported by neither the service nor the types module — declared
 * locally so we can unwrap consistently.
 */
interface BackendSingle<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface BackendList<T> {
  success: boolean;
  data: T[];
  count?: number;
}

// ============================================
// LOCAL TEMPLATE CALLS
// ============================================
//
// These mirror the four backend endpoints the service is missing.
// They're kept local (not exported) so we don't accidentally shadow
// the service's API surface.

async function fetchTemplates(): Promise<NotificationTemplate[]> {
  const response = await api.get<BackendList<NotificationTemplate>>(
    '/notifications/templates',
  );
  const payload =
    response && typeof response === 'object' && 'data' in response
      ? (response as any).data
      : response;

  if (Array.isArray(payload)) return payload as NotificationTemplate[];
  if (payload && Array.isArray((payload as any).data)) {
    return (payload as any).data as NotificationTemplate[];
  }
  return [];
}

async function updateTemplateRemote(
  id: string,
  data: Partial<NotificationTemplate>,
): Promise<NotificationTemplate> {
  const response = await api.put<BackendSingle<NotificationTemplate>>(
    `/notifications/templates/${id}`,
    data,
  );
  const payload =
    response && typeof response === 'object' && 'data' in response
      ? (response as any).data
      : response;

  if (payload && typeof payload === 'object' && 'id' in payload) {
    return payload as NotificationTemplate;
  }
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as any).data as NotificationTemplate;
  }
  throw new Error('Template update returned an invalid response');
}

async function deleteTemplateRemote(id: string): Promise<void> {
  await api.delete(`/notifications/templates/${id}`);
}

// ============================================
// PAGE
// ============================================

export default function TemplatesPage() {
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [workingId, setWorkingId] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadTemplates = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const data = await fetchTemplates();
      if (!isMountedRef.current) return;
      setTemplates(data);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to load templates',
      );
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((t) => {
      if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q)
      );
    });
  }, [templates, searchQuery, typeFilter]);

  const uniqueTypes = useMemo(
    () => Array.from(new Set(templates.map((t) => t.type))).sort(),
    [templates],
  );

  const handleToggleActive = useCallback(async (t: NotificationTemplate) => {
    try {
      setWorkingId(t.id);
      const updated = await updateTemplateRemote(t.id, {
        isActive: !t.isActive,
      });
      setTemplates((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, ...updated } : x)),
      );
      toast.success(
        updated.isActive ? 'Template activated' : 'Template deactivated',
      );
    } catch {
      toast.error('Failed to update template');
    } finally {
      if (isMountedRef.current) setWorkingId(null);
    }
  }, []);

  const handleDelete = useCallback(
    async (t: NotificationTemplate) => {
      const ok = await confirm({
        title: `Delete template "${t.name}"?`,
        description: 'This action cannot be undone.',
        tone: 'danger',
        confirmLabel: 'Delete',
      });
      if (!ok) return;

      try {
        setWorkingId(t.id);
        await deleteTemplateRemote(t.id);
        setTemplates((prev) => prev.filter((x) => x.id !== t.id));
        toast.success('Template deleted');
      } catch {
        toast.error('Failed to delete template');
      } finally {
        if (isMountedRef.current) setWorkingId(null);
      }
    },
    [confirm],
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-12 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/admin/notifications"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to notifications
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Notification Templates
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Customize the content of your alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadTemplates(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <Link
              href="/admin/notifications/templates/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              New template
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mb-5 p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search templates…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none text-xs text-gray-700 dark:text-gray-300"
        >
          <option value="ALL">All types</option>
          {uniqueTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/40 mb-4">
            <FileText className="w-8 h-8 text-orange-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {templates.length === 0
              ? 'No templates yet'
              : 'No templates match your search'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            {templates.length === 0
              ? 'Create your first template to customize alert content.'
              : 'Try adjusting the filters.'}
          </p>
          {templates.length === 0 && (
            <Link
              href="/admin/notifications/templates/new"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="w-4 h-4" />
              Create template
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                      {t.name}
                    </h3>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300">
                      {t.type}
                    </span>
                    {!t.isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        <EyeOff className="w-2.5 h-2.5" />
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium truncate">
                    {t.subject}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                    {t.body}
                  </p>
                  {t.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.variables.slice(0, 6).map((v: string) => (
                        <span
                          key={v}
                          className="inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-mono text-gray-600 dark:text-gray-400"
                        >
                          {`{{${v}}}`}
                        </span>
                      ))}
                      {t.variables.length > 6 && (
                        <span className="text-[10px] text-gray-400">
                          +{t.variables.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(t)}
                    disabled={workingId === t.id}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                      t.isActive
                        ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title={t.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {workingId === t.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : t.isActive ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <Link
                    href={`/admin/notifications/templates/${t.id}`}
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    title="Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    disabled={workingId === t.id}
                    className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
