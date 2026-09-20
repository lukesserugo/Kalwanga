// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\notifications\templates\[id]\page.tsx

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Save,
  Loader2,
  AlertCircle,
  Code2,
  Eye,
  Plus,
  X,
  Wand2,
} from 'lucide-react';

import { notificationService } from '../../../../../../services/notificationService';
import type {
  NotificationTemplate,
  NotificationType,
} from '../../../../../../types/notification';
import { NOTIFICATION_TYPES } from '../../../../../../types/notification';
import { toast } from '../../../../../../utils/toast-manager';

const EMPTY_TEMPLATE: Omit<
  NotificationTemplate,
  'id' | 'createdAt' | 'updatedAt'
> = {
  name: '',
  subject: '',
  body: '',
  type: 'INFO',
  variables: [],
  isActive: true,
};

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = params.id === 'new';

  const [template, setTemplate] = useState(EMPTY_TEMPLATE);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newVariable, setNewVariable] = useState('');
  const [previewValues, setPreviewValues] = useState<
    Record<string, string>
  >({});
  const [showPreview, setShowPreview] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (isNew) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await notificationService.getTemplateById(params.id);
      if (!isMountedRef.current) return;
      setTemplate({
        name: data.name,
        subject: data.subject,
        body: data.body,
        type: data.type,
        variables: data.variables ?? [],
        isActive: data.isActive,
      });
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError(err?.response?.data?.message || 'Failed to load template');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [isNew, params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const detectedVariables = useMemo(() => {
    const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const found = new Set<string>();
    let match: RegExpExecArray | null;
    const text = `${template.subject}\n${template.body}`;
    while ((match = regex.exec(text)) !== null) {
      found.add(match[1]);
    }
    return Array.from(found).sort();
  }, [template.subject, template.body]);

  const renderedPreview = useMemo(() => {
    let subject = template.subject;
    let body = template.body;
    for (const [k, v] of Object.entries(previewValues)) {
      const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
      subject = subject.replace(re, v || `{{${k}}}`);
      body = body.replace(re, v || `{{${k}}}`);
    }
    return { subject, body };
  }, [template.subject, template.body, previewValues]);

  const handleSave = useCallback(async () => {
    if (!template.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!template.subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!template.body.trim()) {
      toast.error('Body is required');
      return;
    }

    try {
      setSaving(true);
      // Sync `variables` with detected ones.
      const payload = { ...template, variables: detectedVariables };

      if (isNew) {
        const created = await notificationService.createTemplate(payload);
        toast.success('Template created');
        router.push(`/admin/notifications/templates/${created.id}`);
      } else {
        await notificationService.updateTemplate(params.id, payload);
        toast.success('Template saved');
      }
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to save template',
      );
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [template, detectedVariables, isNew, params.id, router]);

  const addVariable = useCallback(() => {
    const v = newVariable.trim();
    if (!v || template.variables.includes(v)) return;
    setTemplate((prev) => ({
      ...prev,
      variables: [...prev.variables, v],
    }));
    setNewVariable('');
  }, [newVariable, template.variables]);

  const removeVariable = useCallback((v: string) => {
    setTemplate((prev) => ({
      ...prev,
      variables: prev.variables.filter((x) => x !== v),
    }));
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Could not load template
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {error}
          </p>
          <Link
            href="/admin/notifications/templates"
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Back to templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/admin/notifications/templates"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors mb-3"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to templates
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md">
              <Code2 className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isNew ? 'New Template' : 'Edit Template'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Use {'{{variableName}}'} placeholders in subject and body
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Eye className="w-4 h-4" />
              {showPreview ? 'Hide preview' : 'Show preview'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className={`grid gap-5 ${showPreview ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
        <div className="space-y-5">
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Basics
            </h2>
            <div className="space-y-4">
              <Field label="Name" required>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) =>
                    setTemplate((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Low stock alert"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none"
                />
              </Field>

              <Field label="Type" required>
                <select
                  value={template.type}
                  onChange={(e) =>
                    setTemplate((p) => ({
                      ...p,
                      type: e.target.value as NotificationType,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none"
                >
                  {NOTIFICATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={template.isActive}
                  onChange={(e) =>
                    setTemplate((p) => ({
                      ...p,
                      isActive: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded text-orange-500 border-gray-300 dark:border-gray-600 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Active
                </span>
              </label>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Content
            </h2>
            <div className="space-y-4">
              <Field label="Subject" required>
                <input
                  type="text"
                  value={template.subject}
                  onChange={(e) =>
                    setTemplate((p) => ({ ...p, subject: e.target.value }))
                  }
                  placeholder="e.g. Low stock alert: {{productName}}"
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none font-mono"
                />
              </Field>

              <Field label="Body" required>
                <textarea
                  value={template.body}
                  onChange={(e) =>
                    setTemplate((p) => ({ ...p, body: e.target.value }))
                  }
                  placeholder="Product {{productName}} is running low. Current stock: {{currentStock}}"
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none font-mono resize-y"
                />
              </Field>
            </div>
          </section>

          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Variables
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Auto-detected from subject and body, or add manually.
            </p>

            {detectedVariables.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                  Detected
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {detectedVariables.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-orange-50 dark:bg-orange-950/30 text-[11px] font-mono text-orange-700 dark:text-orange-300"
                    >
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {template.variables.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                  Registered
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {template.variables.map((v) => (
                    <span
                      key={v}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-[11px] font-mono text-gray-700 dark:text-gray-300"
                    >
                      {v}
                      <button
                        type="button"
                        onClick={() => removeVariable(v)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newVariable}
                onChange={(e) => setNewVariable(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addVariable();
                  }
                }}
                placeholder="variableName"
                className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-900 dark:text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none"
              />
              <button
                type="button"
                onClick={addVariable}
                disabled={!newVariable.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </section>
        </div>

        {showPreview && (
          <motion.aside
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4 lg:sticky lg:top-4 self-start"
          >
            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wand2 className="w-4 h-4 text-orange-500" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Preview values
                </h2>
              </div>

              {detectedVariables.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Add a {'{{variable}}'} to the subject or body to see preview
                  options.
                </p>
              ) : (
                <div className="space-y-3">
                  {detectedVariables.map((v) => (
                    <Field key={v} label={v}>
                      <input
                        type="text"
                        value={previewValues[v] ?? ''}
                        onChange={(e) =>
                          setPreviewValues((p) => ({
                            ...p,
                            [v]: e.target.value,
                          }))
                        }
                        placeholder={`Sample ${v}`}
                        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none"
                      />
                    </Field>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Rendered preview
              </h2>
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-950">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  {renderedPreview.subject || (
                    <span className="text-gray-400 italic">
                      No subject
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {renderedPreview.body || (
                    <span className="text-gray-400 italic">No body</span>
                  )}
                </p>
              </div>
            </section>
          </motion.aside>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
