// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\payments\settings\page.tsx

'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Save,
  RefreshCw,
  Loader2,
  Lock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Settings as SettingsIcon,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { usePermission } from '../../../../../hooks/usePermission';
import { PermissionResource } from '../../../../../types/enums';
import {
  paymentService,
  type PaymentProviderStatus,
} from '../../../../../services/paymentService';
import { toast } from '../../../../../utils/toast-manager';
import { useThemeStore } from '../../../../stores/themeStore';

// ============================================
// TYPES
// ============================================

interface PaymentSettings {
  // General
  allowPartialPayment: boolean;
  requireCustomer: boolean;
  requireSignature: boolean;
  maxDiscount: number;
  taxInclusive: boolean;
  defaultPaymentMethod: string;

  // Methods
  allowCash: boolean;
  allowCard: boolean;
  allowMobileMoney: boolean;
  allowBankTransfer: boolean;
  allowGiftCards: boolean;
  allowLoyaltyPoints: boolean;
  allowPayPal: boolean;
  allowFlutterwave: boolean;
  allowSquare: boolean;

  // Loyalty
  loyaltyPointsEnabled: boolean;
  pointsPerDollar: number;

  // Notifications
  notifyOnPayment: boolean;
  notifyOnRefund: boolean;
  notifyOnFailed: boolean;
  notifyOnLargePayment: boolean;
  largePaymentThreshold: number;

  // Security
  require2FAForRefund: boolean;
  requireApprovalForRefund: boolean;
  maxRefundAmount: number;

  // Currency
  /**
   * ISO 4217 settlement currency code for the deployment.
   *
   * ⚠ This is the AUTHORITATIVE code for every amount the page
   *   renders as a currency figure (thresholds, max refund, etc.).
   *   It is read from `NEXT_PUBLIC_DEFAULT_CURRENCY`, NOT stored
   *   in local settings — the backend's `resolveCurrency` is the
   *   only authority for a payment's recorded currency, and this
   *   field is here only so a caller can override the code in a
   *   per-company settings row if that row ever exists.
   */
  currencyCode: string;

  /**
   * @deprecated Currency symbol was removed from the platform
   *   registry contract. `formatCurrency` derives the symbol from
   *   `currencyCode`. Storing both allowed them to drift. This
   *   field is kept as an optional read-only passthrough for
   *   legacy rows; new writes should not populate it.
   */
  currencySymbol?: string;
}

type SettingsTab =
  | 'general'
  | 'methods'
  | 'providers'
  | 'loyalty'
  | 'notifications'
  | 'security';

// ============================================
// CURRENCY RESOLUTION
// ============================================
//
// `formatCurrency` requires a currency code. This page renders a
// handful of currency-labelled figures (thresholds, max refund,
// max discount) — all deployment-wide settings, not per-payment
// amounts. The deployment's settlement currency is the only
// honest code for them.
//
// ⚠ No hardcoded fallback. `NEXT_PUBLIC_DEFAULT_CURRENCY` is the
//   single source of truth. When unset, `formatCurrency` receives
//   an empty string and renders a bare number — never a `$`.

/**
 * Resolve the deployment's settlement currency code.
 *
 * Priority:
 *   1. A per-company override stored in `settings.currencyCode`.
 *   2. `NEXT_PUBLIC_DEFAULT_CURRENCY` — the deployment default.
 *   3. `''` — an empty string, which `formatCurrency` renders as a
 *      bare number (honest about the missing code).
 */
function resolveSettingsCurrency(
  settings: Pick<PaymentSettings, 'currencyCode'> | null | undefined,
): string {
  return (
    settings?.currencyCode ||
    process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ||
    ''
  );
}

/**
 * Format a currency figure for the settings UI. Routes through
 * `formatCurrency` with the resolved deployment code — never with a
 * hardcoded symbol.
 */
function formatSettingsCurrency(
  amount: number,
  settings: Pick<PaymentSettings, 'currencyCode'> | null | undefined,
): string {
  const code = resolveSettingsCurrency(settings);
  // Dynamic import avoided: formatters is a stable local module and
  // this file already depends on it transitively via paymentService.
  // Imported lazily via require-style lookup below.
  return code
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
      }).format(amount)
    : amount.toFixed(2);
}

// ============================================
// CONSTANTS
// ============================================

const SETTINGS_STORAGE_KEY = 'kalwanga.payment-settings.v1';

/**
 * Provider display config. Keys match the backend's
 * `PaymentProviderEnum` values exactly.
 *
 * ⚠ PAYSTACK, TIGO, and VODAFONE are intentionally absent — no
 *   backend handler exists for any of them.
 */
const PROVIDER_CONFIGS: Record<
  string,
  { icon: string; name: string; color: string; bgColor: string }
> = {
  STRIPE: {
    icon: '💳',
    name: 'Stripe',
    color: 'primary',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
  },
  PAYPAL: {
    icon: '💸',
    name: 'PayPal',
    color: 'primary',
    bgColor: 'bg-primary-50 dark:bg-primary-900/20',
  },
  FLUTTERWAVE: {
    icon: '🌊',
    name: 'Flutterwave',
    color: 'cyan',
    bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
  },
  SQUARE: {
    icon: '⬜',
    name: 'Square',
    color: 'gray',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
  },
  CASH: {
    icon: '💰',
    name: 'Cash',
    color: 'success',
    bgColor: 'bg-success-50 dark:bg-success-900/20',
  },
  MOBILE_MONEY: {
    icon: '📱',
    name: 'Mobile Money',
    color: 'brand',
    bgColor: 'bg-brand-50 dark:bg-brand-900/20',
  },
  BANK_TRANSFER: {
    icon: '🏦',
    name: 'Bank Transfer',
    color: 'indigo',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
  },
  GIFT_CARD: {
    icon: '🎁',
    name: 'Gift Card',
    color: 'brand',
    bgColor: 'bg-brand-50 dark:bg-brand-900/20',
  },
  LOYALTY_POINTS: {
    icon: '⭐',
    name: 'Loyalty Points',
    color: 'warning',
    bgColor: 'bg-warning-50 dark:bg-warning-900/20',
  },
  MPESA: {
    icon: '📱',
    name: 'M-Pesa',
    color: 'success',
    bgColor: 'bg-success-50 dark:bg-success-900/20',
  },
  MTN: {
    icon: '📱',
    name: 'MTN Mobile Money',
    color: 'warning',
    bgColor: 'bg-warning-50 dark:bg-warning-900/20',
  },
  AIRTEL: {
    icon: '📱',
    name: 'Airtel Money',
    color: 'danger',
    bgColor: 'bg-danger-50 dark:bg-danger-900/20',
  },
};

/**
 * Local icon paths under `packages/web/public/`. No external CDN
 * dependencies — every request stays on the deployment's own
 * origin. Add one SVG per code to restore the images; until then
 * the `<ProviderLogo>` fallback renders the emoji from
 * `PROVIDER_CONFIGS`.
 */
const PROVIDER_IMAGE_URLS: Record<string, string> = {
  STRIPE: '/icons/payments/stripe.svg',
  PAYPAL: '/icons/payments/paypal.svg',
  FLUTTERWAVE: '/icons/payments/flutterwave.svg',
  SQUARE: '/icons/payments/square.svg',
  MPESA: '/icons/payments/mpesa.svg',
  MTN: '/icons/payments/mtn.svg',
  AIRTEL: '/icons/payments/airtel.svg',
  CASH: '/icons/payments/cash.svg',
  MOBILE_MONEY: '/icons/payments/mobile-money.svg',
  BANK_TRANSFER: '/icons/payments/bank-transfer.svg',
  GIFT_CARD: '/icons/payments/gift-card.svg',
  LOYALTY_POINTS: '/icons/payments/loyalty-points.svg',
};

/**
 * Default payment settings.
 *
 * ⚠ `currencyCode` is resolved from the deployment env at module
 *   load. There is NO hardcoded fallback string — when the env is
 *   missing, `currencyCode` is `''` and `formatSettingsCurrency`
 *   renders bare numbers. That is the correct, honest behaviour:
 *   an operator who forgot to set the deployment currency will see
 *   unlabelled numbers and know to fix the config, rather than
 *   seeing a fabricated symbol.
 *
 * ⚠ The old `'USD'` default and `'$'` symbol were wrong for this
 *   deployment and are gone. `currencySymbol` is no longer
 *   populated — the symbol is derived from the code by
 *   `Intl.NumberFormat`.
 */
const DEFAULT_SETTINGS: PaymentSettings = {
  allowPartialPayment: true,
  requireCustomer: false,
  requireSignature: false,
  maxDiscount: 50,
  taxInclusive: false,
  defaultPaymentMethod: 'CASH',
  allowCash: true,
  allowCard: true,
  allowMobileMoney: true,
  allowBankTransfer: true,
  allowGiftCards: true,
  allowLoyaltyPoints: true,
  allowPayPal: false,
  allowFlutterwave: false,
  allowSquare: false,
  loyaltyPointsEnabled: true,
  pointsPerDollar: 10,
  notifyOnPayment: true,
  notifyOnRefund: true,
  notifyOnFailed: true,
  notifyOnLargePayment: true,
  largePaymentThreshold: 1000,
  require2FAForRefund: false,
  requireApprovalForRefund: true,
  maxRefundAmount: 5000,
  currencyCode: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || '',
};

/**
 * Offline fallback provider list. Used only when the backend
 * `GET /payments/payment-providers` returns an empty list (e.g.
 * first boot before seeding).
 *
 * ⚠ `supportedCurrencies` is intentionally EMPTY on every entry.
 *   The backend's `providerCurrencies()` reads the registry via
 *   `currencyService.listForProvider(...)` and
 *   `currencyService.listAllSettlement()`. This fallback list is
 *   only for the UI's first paint — it must not claim currencies
 *   the registry does not, or an admin will see a currency badge
 *   the backend cannot actually settle in.
 */
const DEFAULT_PROVIDERS: PaymentProviderStatus[] = [
  {
    id: 'default_cash',
    provider: 'CASH',
    name: 'Cash',
    code: 'CASH',
    type: 'OFFLINE',
    isActive: true,
    isHealthy: true,
    configured: true,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'Cash',
      type: 'OFFLINE',
      supportedCurrencies: [],
      supportedMethods: ['CASH'],
      description: 'Pay with cash at the counter',
      icon: '💰',
      feePercentage: 0,
      feeFixed: 0,
    },
  },
  {
    id: 'default_stripe',
    provider: 'STRIPE',
    name: 'Stripe',
    code: 'STRIPE',
    type: 'ONLINE',
    isActive: true,
    isHealthy: true,
    configured: true,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'Stripe',
      type: 'ONLINE',
      supportedCurrencies: [],
      supportedMethods: ['CREDIT_CARD', 'DEBIT_CARD'],
      description: 'Pay with credit card (Visa, Mastercard, Amex)',
      icon: '💳',
      minAmount: 1,
      maxAmount: 100000,
      feePercentage: 2.9,
      feeFixed: 0.3,
    },
  },
  {
    id: 'default_mobile_money',
    provider: 'MOBILE_MONEY',
    name: 'Mobile Money',
    code: 'MOBILE_MONEY',
    type: 'ONLINE',
    isActive: true,
    isHealthy: true,
    configured: true,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'Mobile Money',
      type: 'ONLINE',
      supportedCurrencies: [],
      supportedMethods: ['MOBILE_MONEY'],
      description: 'MTN Mobile Money, Airtel Money',
      icon: '📱',
      minAmount: 1,
      maxAmount: 10000,
      feePercentage: 1.5,
      feeFixed: 0.1,
    },
  },
  {
    id: 'default_bank_transfer',
    provider: 'BANK_TRANSFER',
    name: 'Bank Transfer',
    code: 'BANK_TRANSFER',
    type: 'ONLINE',
    isActive: true,
    isHealthy: true,
    configured: true,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'Bank Transfer',
      type: 'ONLINE',
      supportedCurrencies: [],
      supportedMethods: ['BANK_TRANSFER'],
      description: 'Direct bank transfer',
      icon: '🏦',
      minAmount: 10,
      maxAmount: 1000000,
      feePercentage: 0,
      feeFixed: 0,
    },
  },
  {
    id: 'default_gift_card',
    provider: 'GIFT_CARD',
    name: 'Gift Card',
    code: 'GIFT_CARD',
    type: 'ONLINE',
    isActive: true,
    isHealthy: true,
    configured: true,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'Gift Card',
      type: 'ONLINE',
      supportedCurrencies: [],
      supportedMethods: ['GIFT_CARD'],
      description: 'Redeem your gift card',
      icon: '🎁',
      minAmount: 1,
      maxAmount: 1000,
      feePercentage: 0,
      feeFixed: 0,
    },
  },
  {
    id: 'default_loyalty_points',
    provider: 'LOYALTY_POINTS',
    name: 'Loyalty Points',
    code: 'LOYALTY_POINTS',
    type: 'OFFLINE',
    isActive: true,
    isHealthy: true,
    configured: true,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'Loyalty Points',
      type: 'OFFLINE',
      supportedCurrencies: [],
      supportedMethods: ['LOYALTY_POINTS'],
      description: 'Pay with your loyalty points',
      icon: '⭐',
      minAmount: 1,
      maxAmount: 1000,
      feePercentage: 0,
      feeFixed: 0,
    },
  },
  {
    id: 'default_paypal',
    provider: 'PAYPAL',
    name: 'PayPal',
    code: 'PAYPAL',
    type: 'ONLINE',
    isActive: false,
    isHealthy: true,
    configured: false,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'PayPal',
      type: 'ONLINE',
      supportedCurrencies: [],
      supportedMethods: ['PAYPAL'],
      description: 'Pay with PayPal',
      icon: '💸',
      minAmount: 1,
      maxAmount: 100000,
      feePercentage: 3.5,
      feeFixed: 0.3,
    },
  },
  {
    id: 'default_flutterwave',
    provider: 'FLUTTERWAVE',
    name: 'Flutterwave',
    code: 'FLUTTERWAVE',
    type: 'ONLINE',
    isActive: false,
    isHealthy: true,
    configured: false,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'Flutterwave',
      type: 'ONLINE',
      supportedCurrencies: [],
      supportedMethods: ['FLUTTERWAVE'],
      description:
        'Pay with Flutterwave (Cards, Mobile Money, Bank Transfer)',
      icon: '🌊',
      minAmount: 1,
      maxAmount: 100000,
      feePercentage: 1.9,
      feeFixed: 0.2,
    },
  },
  {
    id: 'default_square',
    provider: 'SQUARE',
    name: 'Square',
    code: 'SQUARE',
    type: 'ONLINE',
    isActive: false,
    isHealthy: true,
    configured: false,
    transactions24h: 0,
    volume24h: 0,
    transactions7d: 0,
    volume7d: 0,
    transactions30d: 0,
    volume30d: 0,
    config: {
      name: 'Square',
      type: 'ONLINE',
      supportedCurrencies: [],
      supportedMethods: ['SQUARE'],
      description: 'Pay with Square (Cards, Digital Wallet)',
      icon: '⬜',
      minAmount: 1,
      maxAmount: 100000,
      feePercentage: 2.6,
      feeFixed: 0.3,
    },
  },
];

// ============================================
// HELPERS
// ============================================

function loadLocalSettings(): PaymentSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;

    // Merge over defaults, but NEVER let a stale local value
    // override the deployment's currency code. The env is the
    // authority; a cached `USD` from a previous version of this
    // page would otherwise persist and mislabel every figure.
    const merged: PaymentSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
    merged.currencyCode = DEFAULT_SETTINGS.currencyCode;
    // Also drop any stale symbol the old schema wrote.
    delete (merged as { currencySymbol?: string }).currencySymbol;
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveLocalSettings(settings: PaymentSettings): void {
  if (typeof window === 'undefined') return;
  try {
    // Strip the deprecated `currencySymbol` before persisting so a
    // stale `$` never survives a save round-trip.
    const { currencySymbol: _drop, ...toStore } = settings;
    void _drop;
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(toStore),
    );
  } catch {
    // Non-fatal. The caller surfaces a toast if it matters.
  }
}

/**
 * Normalise whatever `getPaymentProviders()` returns into a plain
 * array. The web `paymentService` already unwraps to `data`, but
 * different call sites have historically received different shapes.
 */
function extractProviderList(response: unknown): PaymentProviderStatus[] {
  if (Array.isArray(response)) return response as PaymentProviderStatus[];
  if (response && typeof response === 'object') {
    const r = response as { data?: unknown };
    if (Array.isArray(r.data)) return r.data as PaymentProviderStatus[];
  }
  return [];
}

/**
 * Provider logo with a graceful emoji fallback. Kept as a component
 * rather than an `onError` DOM mutation so React owns the tree.
 */
function ProviderLogo({
  provider,
  icon,
}: {
  provider: string;
  icon: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = PROVIDER_IMAGE_URLS[provider];

  if (!url || failed) {
    return <span className="text-2xl">{icon}</span>;
  }

  return (
    <div className="relative w-10 h-10 flex-shrink-0 flex items-center justify-center">
      <Image
        src={url}
        alt=""
        width={40}
        height={40}
        className="rounded-lg object-contain max-w-[40px] max-h-[40px]"
        onError={() => setFailed(true)}
        unoptimized
      />
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminPaymentSettingsPage() {
  const router = useRouter();
  const { canView, canManage, isLoading: permissionLoading } =
    usePermission();
  const { isDark } = useThemeStore();

  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [providers, setProviders] = useState<PaymentProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [showProviderConfig, setShowProviderConfig] = useState<
    string | null
  >(null);
  const [providerConfigData, setProviderConfigData] = useState<
    Record<string, unknown>
  >({});
  const [savingProvider, setSavingProvider] = useState(false);

  const canViewPayments =
    canView(PermissionResource.PAYMENT) ||
    canManage(PermissionResource.PAYMENT);
  const canManagePayments = canManage(PermissionResource.PAYMENT);

  /**
   * The deployment settlement currency. Used as the suffix label on
   * every currency-denominated input on this page. Resolved once per
   * render from the settings object (which itself derives from env).
   */
  const currencyCode = useMemo(
    () => resolveSettingsCurrency(settings),
    [settings],
  );

  // ── Data loaders ─────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setSettings(loadLocalSettings());
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      setLoadingProviders(true);
      const response = await paymentService.getPaymentProviders();
      const list = extractProviderList(response);
      setProviders(list.length > 0 ? list : DEFAULT_PROVIDERS);
    } catch (error) {
      console.error('Failed to load providers:', error);
      setProviders(DEFAULT_PROVIDERS);
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    if (canViewPayments) {
      void loadSettings();
      void loadProviders();
    }
  }, [canViewPayments, loadSettings, loadProviders]);

  // ── Handlers ─────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!settings) return;

    setSaving(true);
    try {
      saveLocalSettings(settings);
      toast.success('Settings saved locally');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const handleToggleProvider = useCallback(
    async (providerId: string, currentStatus: boolean) => {
      try {
        const response = await paymentService.togglePaymentProvider(
          providerId,
          !currentStatus,
        );
        if (response.success) {
          toast.success(
            `Provider ${
              !currentStatus ? 'activated' : 'deactivated'
            } successfully`,
          );
          await loadProviders();
        } else {
          toast.error(response.message || 'Failed to toggle provider');
        }
      } catch (error: any) {
        console.error('Failed to toggle provider:', error);
        toast.error(error?.message || 'Failed to toggle provider');
      }
    },
    [loadProviders],
  );

  const handleConfigureProvider = useCallback(
    async (providerId: string) => {
      if (!providerId) return;

      setSavingProvider(true);
      try {
        const response = await paymentService.configurePaymentProvider(
          providerId,
          {
            config: providerConfigData as Record<string, unknown>,
            settings: {},
          },
        );
        if (response.success) {
          toast.success('Provider configured successfully');
          await loadProviders();
          setShowProviderConfig(null);
          setProviderConfigData({});
        } else {
          toast.error(
            response.message || 'Failed to configure provider',
          );
        }
      } catch (error: any) {
        console.error('Failed to configure provider:', error);
        toast.error(error?.message || 'Failed to configure provider');
      } finally {
        setSavingProvider(false);
      }
    },
    [providerConfigData, loadProviders],
  );

  const updateSetting = useCallback(
    <K extends keyof PaymentSettings>(
      key: K,
      value: PaymentSettings[K],
    ) => {
      setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  // ── Render helpers ───────────────────────────────────────────

  const renderToggle = useCallback(
    (
      label: string,
      key: keyof PaymentSettings,
      description?: string,
    ) => (
      <div className="flex items-start justify-between py-3 border-b border-gray-200 dark:border-gray-700">
        <div>
          <p
            className={`text-sm font-medium ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {label}
          </p>
          {description && (
            <p
              className={`text-xs mt-1 ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() =>
            updateSetting(key, !settings?.[key] as never)
          }
          className={`relative w-12 h-6 rounded-full transition duration-250 flex-shrink-0 focus-ring ${
            settings?.[key]
              ? 'bg-brand-gradient'
              : 'bg-gray-300 dark:bg-gray-600'
          }`}
          aria-label={`Toggle ${label}`}
          aria-pressed={!!settings?.[key]}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition duration-250 ${
              settings?.[key] ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>
    ),
    [isDark, settings, updateSetting],
  );

  /**
   * Number input with a currency-aware suffix label.
   *
   * ⚠ When `suffix === 'currency'`, the label reads the resolved
   *   deployment code (`currencyCode`) instead of a hardcoded
   *   symbol. When `currencyCode` is empty (env not set), no
   *   suffix is rendered — the operator sees a bare number and
   *   knows the deployment's currency is not configured.
   */
  const renderNumberInput = useCallback(
    (
      label: string,
      key: keyof PaymentSettings,
      suffix?: string | 'currency',
      min?: number,
      max?: number,
    ) => {
      const resolvedSuffix =
        suffix === 'currency' ? currencyCode || undefined : suffix;

      return (
        <div className="py-3 border-b border-gray-200 dark:border-gray-700">
          <label
            className={`block text-sm font-medium mb-1 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {label}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={(settings?.[key] as number) || 0}
              onChange={(e) =>
                updateSetting(
                  key,
                  (parseFloat(e.target.value) || 0) as never,
                )
              }
              min={min}
              max={max}
              className={`w-32 px-3 py-2 rounded-lg text-sm tabular-nums ${
                isDark
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-gray-100 text-gray-900 border-gray-300'
              } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
            />
            {resolvedSuffix && (
              <span
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {resolvedSuffix}
              </span>
            )}
          </div>
        </div>
      );
    },
    [isDark, settings, updateSetting, currencyCode],
  );

  const renderSelect = useCallback(
    (
      label: string,
      key: keyof PaymentSettings,
      options: Array<{ value: string; label: string }>,
    ) => (
      <div className="py-3 border-b border-gray-200 dark:border-gray-700">
        <label
          className={`block text-sm font-medium mb-1 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {label}
        </label>
        <select
          value={(settings?.[key] as string) || ''}
          onChange={(e) => updateSetting(key, e.target.value as never)}
          className={`w-full px-3 py-2 rounded-lg text-sm ${
            isDark
              ? 'bg-gray-700 text-white border-gray-600'
              : 'bg-gray-100 text-gray-900 border-gray-300'
          } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    ),
    [isDark, settings, updateSetting],
  );

  // ── Provider configuration form ──────────────────────────────

  const renderProviderConfigForm = useCallback(
    (provider: PaymentProviderStatus) => {
      const config =
        PROVIDER_CONFIGS[provider.provider] || PROVIDER_CONFIGS.STRIPE;
      const existing = (provider.config || {}) as Record<string, unknown>;

      const val = (key: string, fromExisting = false): string => {
        const typed = providerConfigData[key];
        if (typeof typed === 'string') return typed;
        if (fromExisting) {
          const stored = existing[key];
          if (typeof stored === 'string') return stored;
        }
        return '';
      };

      const setField = (key: string, value: string) =>
        setProviderConfigData((prev) => ({ ...prev, [key]: value }));

      const field = (
        label: string,
        key: string,
        opts: {
          type?: string;
          placeholder?: string;
          fromExisting?: boolean;
        } = {},
      ) => (
        <div key={key}>
          <label
            className={`block text-sm font-medium mb-1 ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}
          >
            {label}
          </label>
          <input
            type={opts.type ?? 'text'}
            value={val(key, opts.fromExisting ?? false)}
            onChange={(e) => setField(key, e.target.value)}
            className={`w-full px-3 py-2 rounded-lg text-sm ${
              isDark
                ? 'bg-gray-700 text-white border-gray-600'
                : 'bg-white text-gray-900 border-gray-300'
            } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
            placeholder={opts.placeholder}
            autoComplete="off"
          />
        </div>
      );

      let providerFields: ReactNode = null;

      if (provider.provider === 'STRIPE') {
        providerFields = (
          <div className="space-y-3">
            {field('Secret Key', 'apiKey', {
              type: 'password',
              placeholder: 'sk_test_...',
            })}
            {field('Webhook Secret', 'webhookSecret', {
              type: 'password',
              placeholder: 'whsec_...',
            })}
          </div>
        );
      } else if (provider.provider === 'PAYPAL') {
        providerFields = (
          <div className="space-y-3">
            {field('Client ID', 'clientId', {
              placeholder: 'Enter PayPal Client ID',
              fromExisting: true,
            })}
            {field('Client Secret', 'clientSecret', {
              type: 'password',
              placeholder: 'Enter PayPal Client Secret',
            })}
          </div>
        );
      } else if (provider.provider === 'FLUTTERWAVE') {
        providerFields = (
          <div className="space-y-3">
            {field('API Key', 'apiKey', {
              type: 'password',
              placeholder: 'FLWSECK-...',
            })}
            {field('Public Key', 'publicKey', {
              placeholder: 'FLWPUBK-...',
              fromExisting: true,
            })}
            {field('Encryption Key', 'encryptionKey', {
              type: 'password',
              placeholder: 'FLWSECK-...',
            })}
          </div>
        );
      } else if (provider.provider === 'SQUARE') {
        providerFields = (
          <div className="space-y-3">
            {field('Access Token', 'accessToken', {
              type: 'password',
              placeholder: 'EAAAE...',
            })}
            {field('Location ID', 'locationId', {
              placeholder: 'L...',
              fromExisting: true,
            })}
          </div>
        );
      } else if (
        provider.provider === 'CASH' ||
        provider.provider === 'BANK_TRANSFER' ||
        provider.provider === 'GIFT_CARD' ||
        provider.provider === 'LOYALTY_POINTS'
      ) {
        providerFields = (
          <p
            className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            This provider has no credentials to configure. Toggle it
            active to enable it.
          </p>
        );
      } else {
        providerFields = (
          <p
            className={`text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            No configuration form is available for this provider yet.
          </p>
        );
      }

      return (
        <div
          className={`p-4 mt-4 rounded-xl border animate-slide-down ${
            isDark
              ? 'border-gray-700 bg-gray-700/30'
              : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <ProviderLogo
              provider={provider.provider}
              icon={config.icon}
            />
            <div>
              <h4
                className={`font-medium ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                {provider.name || 'Unknown Provider'}
              </h4>
              <p
                className={`text-xs ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {provider.provider || ''} • {provider.type || 'N/A'}
              </p>
            </div>
            <span
              className={`ml-auto text-2xs px-2 py-0.5 rounded-full ${
                provider.configured
                  ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                  : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
              }`}
            >
              {provider.configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>

          {providerFields}

          <div className="mt-3">
            <label
              className={`block text-sm font-medium mb-1 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              Environment
            </label>
            <select
              value={val('environment', true) || 'sandbox'}
              onChange={(e) => setField('environment', e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm ${
                isDark
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-white text-gray-900 border-gray-300'
              } border focus:outline-none focus:ring-2 focus:ring-brand-500 transition duration-250`}
            >
              <option value="sandbox">Sandbox (Test)</option>
              <option value="production">Production (Live)</option>
            </select>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() =>
                provider.id && handleConfigureProvider(provider.id)
              }
              disabled={savingProvider || !provider.id}
              className="flex-1 btn-brand disabled:opacity-50"
            >
              {savingProvider ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {savingProvider ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowProviderConfig(null);
                setProviderConfigData({});
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      );
    },
    [
      isDark,
      providerConfigData,
      savingProvider,
      handleConfigureProvider,
    ],
  );

  // ── Render gates ─────────────────────────────────────────────

  if (permissionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!canViewPayments) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-12 h-12 text-gray-400 dark:text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          You don&apos;t have permission to manage payment settings.
        </p>
        <button
          onClick={() => router.push('/admin/payments')}
          className="mt-4 btn-brand"
        >
          Back to Payments
        </button>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <AlertCircle className="w-12 h-12 text-warning-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
          Settings Unavailable
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Could not load payment settings.
        </p>
        <button
          onClick={() => void loadSettings()}
          className="mt-4 btn-brand"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <div
      className={`min-h-screen p-6 ${
        isDark ? 'bg-gray-900' : 'bg-gray-50'
      }`}
    >
      <div className="max-w-container mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 animate-fade-in">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/payments')}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
              }`}
              aria-label="Back to payments"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1
                className={`text-2xl font-bold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Payment Settings
              </h1>
              <p
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                Configure your payment preferences, providers, and rules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void loadSettings();
                void loadProviders();
              }}
              className={`p-2 rounded-lg transition duration-250 focus-ring ${
                isDark
                  ? 'bg-gray-800 hover:bg-gray-700 text-white'
                  : 'bg-white hover:bg-gray-100 text-gray-700'
              } border ${
                isDark ? 'border-gray-700' : 'border-gray-300'
              }`}
              aria-label="Refresh settings"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !canManagePayments}
              className="btn-brand disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div
          className={`flex flex-wrap gap-2 mb-6 p-1 rounded-xl ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } shadow-soft`}
        >
          {(
            [
              { id: 'general', label: 'General' },
              { id: 'methods', label: 'Payment Methods' },
              { id: 'providers', label: 'Providers' },
              { id: 'loyalty', label: 'Loyalty' },
              { id: 'notifications', label: 'Notifications' },
              { id: 'security', label: 'Security' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition duration-250 focus-ring ${
                activeTab === tab.id
                  ? 'bg-brand-gradient text-white shadow-brand'
                  : isDark
                    ? 'text-gray-400 hover:bg-gray-700'
                    : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="card-brand shadow-soft">
          {activeTab === 'general' && (
            <div>
              <h2
                className={`text-lg font-semibold mb-4 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                General Settings
              </h2>
              {renderToggle(
                'Allow Partial Payment',
                'allowPartialPayment',
                'Allow customers to pay in installments',
              )}
              {renderToggle(
                'Require Customer Account',
                'requireCustomer',
                'Force users to have an account before payment',
              )}
              {renderToggle(
                'Require Digital Signature',
                'requireSignature',
                'Require customers to sign for their payment',
              )}
              {renderNumberInput(
                'Maximum Discount Amount',
                'maxDiscount',
                'currency',
                0,
                100,
              )}
              {renderToggle(
                'Tax Inclusive Pricing',
                'taxInclusive',
                'Show prices including tax',
              )}
              {renderSelect('Default Payment Method', 'defaultPaymentMethod', [
                { value: 'CASH', label: 'Cash' },
                { value: 'CREDIT_CARD', label: 'Credit Card' },
                { value: 'DEBIT_CARD', label: 'Debit Card' },
                { value: 'MOBILE_MONEY', label: 'Mobile Money' },
                { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
                { value: 'GIFT_CARD', label: 'Gift Card' },
                { value: 'LOYALTY_POINTS', label: 'Loyalty Points' },
                { value: 'PAYPAL', label: 'PayPal' },
                { value: 'FLUTTERWAVE', label: 'Flutterwave' },
                { value: 'SQUARE', label: 'Square' },
              ])}
            </div>
          )}

          {activeTab === 'methods' && (
            <div>
              <h2
                className={`text-lg font-semibold mb-4 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Payment Methods
              </h2>
              {renderToggle('Allow Cash', 'allowCash', 'Enable cash payments')}
              {renderToggle(
                'Allow Credit/Debit Cards',
                'allowCard',
                'Enable card payments via Stripe',
              )}
              {renderToggle(
                'Allow Mobile Money',
                'allowMobileMoney',
                'Enable mobile money payments (MTN, Airtel Money, M-Pesa)',
              )}
              {renderToggle(
                'Allow Bank Transfer',
                'allowBankTransfer',
                'Enable bank transfer payments',
              )}
              {renderToggle(
                'Allow Gift Cards',
                'allowGiftCards',
                'Enable gift card payments',
              )}
              {renderToggle(
                'Allow Loyalty Points',
                'allowLoyaltyPoints',
                'Enable loyalty points payments',
              )}
              {renderToggle(
                'Allow PayPal',
                'allowPayPal',
                'Enable PayPal payments',
              )}
              {renderToggle(
                'Allow Flutterwave',
                'allowFlutterwave',
                'Enable Flutterwave payments (Cards, Mobile Money, Bank Transfer)',
              )}
              {renderToggle(
                'Allow Square',
                'allowSquare',
                'Enable Square payments (Cards, Digital Wallet)',
              )}
            </div>
          )}

          {activeTab === 'providers' && (
            <div>
              <h2
                className={`text-lg font-semibold mb-4 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Payment Providers
              </h2>
              <p
                className={`text-sm mb-4 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Configure and manage your payment providers. Activate
                providers to make them available to customers.
              </p>

              {loadingProviders ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
                </div>
              ) : (
                <div className="space-y-4">
                  {providers.map((provider) => {
                    const config =
                      PROVIDER_CONFIGS[provider.provider] ||
                      PROVIDER_CONFIGS.STRIPE;
                    const isActive =
                      provider.isActive &&
                      provider.isHealthy &&
                      provider.configured;
                    const isEditing =
                      showProviderConfig === provider.id;

                    return (
                      <div
                        key={provider.id ?? provider.provider}
                        className={`p-4 rounded-xl border transition duration-250 ${
                          isActive
                            ? `${config.bgColor} ${
                                isDark
                                  ? 'border-gray-700'
                                  : 'border-gray-200'
                              }`
                            : isDark
                              ? 'bg-gray-700/30 border-gray-700'
                              : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <ProviderLogo
                              provider={provider.provider}
                              icon={config.icon}
                            />
                            <div>
                              <p
                                className={`font-medium ${
                                  isDark
                                    ? 'text-white'
                                    : 'text-gray-900'
                                }`}
                              >
                                {provider.name || 'Unknown Provider'}
                              </p>
                              <p
                                className={`text-xs ${
                                  isDark
                                    ? 'text-gray-400'
                                    : 'text-gray-500'
                                }`}
                              >
                                {provider.provider || ''} •{' '}
                                {provider.type || 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              {provider.isActive ? (
                                <span className="text-2xs text-success-600 dark:text-success-400 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Active
                                </span>
                              ) : (
                                <span className="text-2xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <XCircle className="w-3 h-3" />
                                  Inactive
                                </span>
                              )}
                              {provider.configured ? (
                                <span className="text-2xs text-success-600 dark:text-success-400 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Configured
                                </span>
                              ) : (
                                <span className="text-2xs text-warning-600 dark:text-warning-400 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Not Configured
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (provider.id) {
                                  void handleToggleProvider(
                                    provider.id,
                                    provider.isActive,
                                  );
                                }
                              }}
                              className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                isDark
                                  ? 'hover:bg-gray-600'
                                  : 'hover:bg-gray-200'
                              } disabled:opacity-50`}
                              title={
                                provider.isActive
                                  ? 'Deactivate'
                                  : 'Activate'
                              }
                              aria-label={
                                provider.isActive
                                  ? 'Deactivate provider'
                                  : 'Activate provider'
                              }
                              disabled={!provider.id || !canManagePayments}
                            >
                              {provider.isActive ? (
                                <ToggleRight className="w-5 h-5 text-success-500" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-gray-400" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setShowProviderConfig(null);
                                  setProviderConfigData({});
                                } else {
                                  setShowProviderConfig(
                                    provider.id ?? null,
                                  );
                                  setProviderConfigData({});
                                }
                              }}
                              className={`p-1.5 rounded-lg transition duration-250 focus-ring ${
                                isDark
                                  ? 'hover:bg-gray-600'
                                  : 'hover:bg-gray-200'
                              } disabled:opacity-50`}
                              title={
                                isEditing
                                  ? 'Close configuration'
                                  : 'Configure provider'
                              }
                              aria-label={
                                isEditing
                                  ? 'Close configuration'
                                  : 'Configure provider'
                              }
                              disabled={!provider.id || !canManagePayments}
                            >
                              {isEditing ? (
                                <XCircle className="w-5 h-5 text-danger-500" />
                              ) : (
                                <SettingsIcon className="w-5 h-5 text-brand-500" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {(
                            [
                              ['24h', provider.transactions24h],
                              ['7d', provider.transactions7d],
                              ['30d', provider.transactions30d],
                            ] as const
                          ).map(([label, count]) => (
                            <div key={label} className="text-center">
                              <p
                                className={`text-2xs ${
                                  isDark
                                    ? 'text-gray-400'
                                    : 'text-gray-500'
                                }`}
                              >
                                {label}
                              </p>
                              <p
                                className={`text-sm font-medium tabular-nums ${
                                  isDark
                                    ? 'text-white'
                                    : 'text-gray-900'
                                }`}
                              >
                                {count || 0}
                              </p>
                            </div>
                          ))}
                        </div>

                        {isEditing &&
                          provider.id &&
                          renderProviderConfigForm(provider)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'loyalty' && (
            <div>
              <h2
                className={`text-lg font-semibold mb-4 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Loyalty Points Settings
              </h2>
              {renderToggle(
                'Enable Loyalty Points',
                'loyaltyPointsEnabled',
                'Allow customers to earn and redeem loyalty points',
              )}
              {renderNumberInput(
                'Points per unit spent',
                'pointsPerDollar',
                'points',
                1,
                100,
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <h2
                className={`text-lg font-semibold mb-4 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Notification Settings
              </h2>
              {renderToggle(
                'Notify on Payment Success',
                'notifyOnPayment',
                'Send notification when payment is successful',
              )}
              {renderToggle(
                'Notify on Refund',
                'notifyOnRefund',
                'Send notification when a refund is processed',
              )}
              {renderToggle(
                'Notify on Failed Payment',
                'notifyOnFailed',
                'Send notification when a payment fails',
              )}
              {renderToggle(
                'Notify Admin on Large Payment',
                'notifyOnLargePayment',
                'Notify admin for payments above threshold',
              )}
              {renderNumberInput(
                'Large Payment Threshold',
                'largePaymentThreshold',
                'currency',
                100,
                100000,
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h2
                className={`text-lg font-semibold mb-4 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                Security Settings
              </h2>
              {renderToggle(
                'Require 2FA for Refunds',
                'require2FAForRefund',
                'Require two-factor authentication for refunds',
              )}
              {renderToggle(
                'Require Approval for Refunds',
                'requireApprovalForRefund',
                'Require admin approval for refunds',
              )}
              {renderNumberInput(
                'Maximum Refund Amount',
                'maxRefundAmount',
                'currency',
                0,
                100000,
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
