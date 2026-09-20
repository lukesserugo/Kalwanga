// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\notifications\settings\page.tsx

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Monitor,
  ChevronLeft,
  RotateCcw,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Settings as SettingsIcon,
  ShoppingCart,
  Package,
  ClipboardList,
  Clock,
  Sparkles,
  Receipt,
  Moon,
  Sun,
} from 'lucide-react';

import { notificationService } from '../../../../../services/notificationService';
import type {
  NotificationPreferences,
  NotificationPreferencesUpdate,
  EmailFrequency,
} from '../../../../../types/notification';
import { ALERT_TYPE_METADATA } from '../../../../../types/notification';
import { toast } from '../../../../../utils/toast-manager';

const ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  'shopping-cart': ShoppingCart,
  package: Package,
  'clipboard-list': ClipboardList,
  clock: Clock,
  settings: SettingsIcon,
  sparkles: Sparkles,
  bell: Bell,
  receipt: Receipt,
};

const EMAIL_FREQUENCY_OPTIONS: Array<{
  value: EmailFrequency;
  label: string;
  description: string;
}> = [
  {
    value: 'immediate',
    label: 'Immediate',
    description: 'Send emails as soon as events happen',
  },
  {
    value: 'daily',
    label: 'Daily Digest',
    description: 'One summary email per day',
  },
  {
    value: 'weekly',
    label: 'Weekly Digest',
    description: 'One summary email per week',
  },
  {
    value: 'never',
    label: 'Never',
    description: 'Do not send email notifications',
  },
];

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  smsEnabled: false,
  pushEnabled: true,
  inAppEnabled: true,
  lowStockAlerts: true,
  saleAlerts: true,
  purchaseOrderAlerts: true,
  shiftAlerts: true,
  systemAlerts: true,
  promotionalAlerts: false,
  reminderAlerts: true,
  receiptAlerts: true,
  emailFrequency: 'immediate',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
};

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [original, setOriginal] =
    useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await notificationService.getPreferences();
      if (!isMountedRef.current) return;
      const normalized = { ...DEFAULT_PREFERENCES, ...data };
      setPreferences(normalized);
      setOriginal(normalized);
    } catch (err: any) {
      if (!isMountedRef.current) return;
      const message =
        err?.response?.data?.message || 'Failed to load preferences';
      setError(message);
      toast.error(message);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const hasChanges = useMemo(() => {
    if (!preferences || !original) return false;
    return JSON.stringify(preferences) !== JSON.stringify(original);
  }, [preferences, original]);

  const quietHoursEnabled = Boolean(
    preferences?.quietHoursStart && preferences?.quietHoursEnd,
  );

  const update = useCallback(
    <K extends keyof NotificationPreferences>(
      key: K,
      value: NotificationPreferences[K],
    ) => {
      setPreferences((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const handleToggleQuietHours = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        update('quietHoursStart', '22:00');
        update('quietHoursEnd', '07:00');
      } else {
        update('quietHoursStart', null);
        update('quietHoursEnd', null);
      }
    },
    [update],
  );

  const handleSave = useCallback(async () => {
    if (!preferences) return;
    if (!hasChanges) return;

    try {
      setSaving(true);
      const diff: NotificationPreferencesUpdate = {};
      if (original) {
        (
          Object.keys(preferences) as Array<keyof NotificationPreferences>
        ).forEach((key) => {
          if (preferences[key] !== original[key]) {
            (diff as Record<string, unknown>)[key] = preferences[key];
          }
        });
      } else {
        Object.assign(diff, preferences);
      }

      const updated = await notificationService.updatePreferences(diff);
      if (!isMountedRef.current) return;
      const normalized = { ...DEFAULT_PREFERENCES, ...updated };
      setPreferences(normalized);
      setOriginal(normalized);
      toast.success('Preferences saved');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to save preferences',
      );
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  }, [preferences, original, hasChanges]);

  const handleReset = useCallback(async () => {
    if (
      !window.confirm(
        'Reset all notification preferences to defaults? This cannot be undone.',
      )
    ) {
      return;
    }

    try {
      setResetting(true);
      const data = await notificationService.resetPreferences();
      if (!isMountedRef.current) return;
      const normalized = { ...DEFAULT_PREFERENCES, ...data };
      setPreferences(normalized);
      setOriginal(normalized);
      toast.success('Preferences reset to defaults');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to reset preferences',
      );
    } finally {
      if (isMountedRef.current) setResetting(false);
    }
  }, []);

  const handleDiscard = useCallback(() => {
    if (!original) return;
    setPreferences(original);
    toast.info('Changes discarded');
  }, [original]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
          <div className="h-32 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !preferences) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Could not load notification settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {error || 'Unknown error'}
          </p>
          <button
            type="button"
            onClick={loadPreferences}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
      <div className="mb-8">
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
              <SettingsIcon className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Notification Settings
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Control how and when you receive alerts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || saving}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {resetting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            Reset to defaults
          </button>
        </div>
      </div>

      <Section
        title="Delivery Channels"
        description="Choose where notifications can reach you"
      >
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <ChannelRow
            icon={Monitor}
            label="In-App"
            description="Show notifications inside Kalwanga"
            enabled={preferences.inAppEnabled}
            onChange={(v) => update('inAppEnabled', v)}
            locked
          />
          <ChannelRow
            icon={Mail}
            label="Email"
            description="Send alerts to your registered email address"
            enabled={preferences.emailEnabled}
            onChange={(v) => update('emailEnabled', v)}
          />
          <ChannelRow
            icon={MessageSquare}
            label="SMS"
            description="Text message alerts to your phone number"
            enabled={preferences.smsEnabled}
            onChange={(v) => update('smsEnabled', v)}
          />
          <ChannelRow
            icon={Smartphone}
            label="Push"
            description="Browser and mobile push notifications"
            enabled={preferences.pushEnabled}
            onChange={(v) => update('pushEnabled', v)}
          />
        </div>
      </Section>

      <Section
        title="Alert Types"
        description="Fine-tune which alerts you get on each channel"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pb-3 pr-4">
                  Alert type
                </th>
                <th className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pb-3 px-3 w-20">
                  In-App
                </th>
                <th className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pb-3 px-3 w-20">
                  Email
                </th>
                <th className="text-center text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 pb-3 pl-3 w-20">
                  Push
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {ALERT_TYPE_METADATA.map((meta) => {
                const Icon = ICON_MAP[meta.iconKey] ?? Bell;
                const enabledInApp = Boolean(preferences[meta.key]);
                const enabledEmail =
                  Boolean(preferences[meta.key]) &&
                  preferences.emailEnabled;
                const enabledPush =
                  Boolean(preferences[meta.key]) && preferences.pushEnabled;

                return (
                  <tr key={meta.key} className="group">
                    <td className="py-3 pr-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shrink-0">
                          <Icon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {meta.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center px-3">
                      <Toggle
                        checked={enabledInApp}
                        onChange={(v) => update(meta.key, v as never)}
                        aria-label={`${meta.label} in-app notifications`}
                      />
                    </td>
                    <td className="text-center px-3">
                      <Toggle
                        checked={enabledEmail}
                        disabled={!preferences.emailEnabled}
                        onChange={(v) => update(meta.key, v as never)}
                        aria-label={`${meta.label} email notifications`}
                      />
                    </td>
                    <td className="text-center pl-3">
                      <Toggle
                        checked={enabledPush}
                        disabled={!preferences.pushEnabled}
                        onChange={(v) => update(meta.key, v as never)}
                        aria-label={`${meta.label} push notifications`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!preferences.emailEnabled && (
          <InfoBanner
            tone="warning"
            message="Email notifications are disabled globally. Enable the Email channel above to use per-type email toggles."
          />
        )}
        {!preferences.pushEnabled && (
          <InfoBanner
            tone="warning"
            message="Push notifications are disabled globally. Enable the Push channel above to use per-type push toggles."
          />
        )}
      </Section>

      <Section
        title="Email Frequency"
        description="How often we bundle email notifications"
      >
        <div
          className={`space-y-2 transition-opacity ${
            preferences.emailEnabled ? '' : 'opacity-50 pointer-events-none'
          }`}
        >
          {EMAIL_FREQUENCY_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                preferences.emailFrequency === option.value
                  ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-500/50'
                  : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <input
                type="radio"
                name="emailFrequency"
                value={option.value}
                checked={preferences.emailFrequency === option.value}
                onChange={() => update('emailFrequency', option.value)}
                className="mt-0.5 w-4 h-4 text-orange-500 border-gray-300 dark:border-gray-600 focus:ring-orange-500 bg-white dark:bg-gray-800"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="Quiet Hours"
        description="Suppress non-urgent notifications during these hours"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Moon className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Enable quiet hours
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Alerts will be queued until the window ends
                </p>
              </div>
            </div>
            <Toggle
              checked={quietHoursEnabled}
              onChange={handleToggleQuietHours}
              aria-label="Enable quiet hours"
            />
          </div>

          {quietHoursEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2"
            >
              <TimeField
                label="Start"
                icon={Moon}
                value={preferences.quietHoursStart ?? '22:00'}
                onChange={(v) => update('quietHoursStart', v)}
              />
              <TimeField
                label="End"
                icon={Sun}
                value={preferences.quietHoursEnd ?? '07:00'}
                onChange={(v) => update('quietHoursEnd', v)}
              />
            </motion.div>
          )}
        </div>
      </Section>

      {hasChanges && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl"
        >
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-900 dark:bg-gray-800 text-white shadow-2xl border border-gray-800 dark:border-gray-700">
            <Info className="w-4 h-4 text-orange-400 shrink-0" />
            <span className="text-sm flex-1">You have unsaved changes</span>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 text-xs font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 mb-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

function ChannelRow({
  icon: Icon,
  label,
  description,
  enabled,
  onChange,
  locked = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3 min-w-0 pr-3">
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {label}
            </p>
            {locked && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                Always on
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
        </div>
      </div>
      <Toggle
        checked={enabled}
        disabled={locked}
        onChange={onChange}
        aria-label={`${label} notifications`}
      />
    </div>
  );
}

function Toggle({
  checked,
  disabled = false,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:ring-offset-1 dark:focus:ring-offset-gray-900 ${
        checked
          ? 'bg-gradient-to-r from-orange-500 to-red-500'
          : 'bg-gray-200 dark:bg-gray-700'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function TimeField({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-500/30 outline-none transition-all"
      />
    </label>
  );
}

function InfoBanner({
  tone,
  message,
}: {
  tone: 'warning' | 'info' | 'success';
  message: string;
}) {
  const styles = {
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50',
      text: 'text-amber-800 dark:text-amber-300',
      icon: AlertCircle,
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50',
      text: 'text-blue-800 dark:text-blue-300',
      icon: Info,
    },
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50',
      text: 'text-emerald-800 dark:text-emerald-300',
      icon: CheckCircle2,
    },
  }[tone];

  const Icon = styles.icon;

  return (
    <div
      className={`flex items-start gap-2 mt-4 p-3 rounded-lg border ${styles.bg}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${styles.text}`} />
      <p className={`text-xs ${styles.text}`}>{message}</p>
    </div>
  );
}
