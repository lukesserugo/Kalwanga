// packages/web/components/payments/MobileMoneyProviderPicker.tsx

'use client';

// ============================================
// MOBILE MONEY PROVIDER PICKER
// ============================================
//
// Lets the user pick between MTN, Airtel, and M-Pesa. The parent
// `PaymentSection` renders this when the selected method is
// `MOBILE_MONEY`. Each provider knows its required phone format
// and its backend routing hint.
//
// ⚠ The icon paths below are served from `packages/web/public/`.
//   If the files don't exist yet, the `<Image>` onError handler
//   hides the broken image and the picker falls back to a
//   label-only layout. Add the SVGs to
//   `packages/web/public/icons/payments/` to restore the icons.

import { useCallback } from 'react';
import Image from 'next/image';
import { Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';

/**
 * The three mobile-money sub-providers the backend routes via
 * `paymentMethod: 'MOBILE_MONEY'` + `metadata.provider`. Matches
 * `MobileMoneyProvider` in `services/checkoutService.ts` and the
 * backend's `MOBILE_MONEY_NETWORKS` constant.
 */
export type MobileProvider = 'MTN' | 'AIRTEL' | 'MPESA';

export interface MobileProviderSpec {
  id: MobileProvider;
  name: string;
  description: string;
  /**
   * Local asset path under `public/`. Served by Next.js; no
   * external CDN dependency and no third-party request from the
   * user's browser.
   */
  iconUrl: string;
  /** Placeholder phone number for this provider's country. */
  phonePlaceholder: string;
  /** Digits (national, without country code) used for length check. */
  nationalDigits: number;
  /** Country calling code, no `+`. */
  countryCode: string;
}

/**
 * Read-only so a consumer can't mutate the shared array. The
 * picker iterates this; a caller that needs a filtered list should
 * build a new array rather than mutating this one.
 */
export const MOBILE_PROVIDERS: readonly MobileProviderSpec[] = [
  {
    id: 'MPESA',
    name: 'M-Pesa',
    description: 'Safaricom STK push',
    iconUrl: '/icons/payments/mpesa.svg',
    phonePlaceholder: '+254 712 345 678',
    nationalDigits: 9,
    countryCode: '254',
  },
  {
    id: 'MTN',
    name: 'MTN Mobile Money',
    description: 'MTN MoMo prompt',
    iconUrl: '/icons/payments/mtn.svg',
    phonePlaceholder: '+256 770 000 000',
    nationalDigits: 9,
    countryCode: '256',
  },
  {
    id: 'AIRTEL',
    name: 'Airtel Money',
    description: 'Airtel Money prompt',
    iconUrl: '/icons/payments/airtel.svg',
    phonePlaceholder: '+256 700 000 000',
    nationalDigits: 9,
    countryCode: '256',
  },
] as const;

interface MobileMoneyProviderPickerProps {
  selected: MobileProvider;
  onSelect: (provider: MobileProvider) => void;
  disabled?: boolean;
  className?: string;
}

export function MobileMoneyProviderPicker({
  selected,
  onSelect,
  disabled,
  className = '',
}: MobileMoneyProviderPickerProps) {
  const { isDark } = useThemeStore();

  const handleSelect = useCallback(
    (id: MobileProvider) => {
      if (disabled) return;
      onSelect(id);
    },
    [disabled, onSelect],
  );

  return (
    <div className={className}>
      <p
        className={`text-sm font-medium mb-2 ${
          isDark ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        Choose your mobile money provider
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {MOBILE_PROVIDERS.map((provider) => {
          const isActive = selected === provider.id;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleSelect(provider.id)}
              disabled={disabled}
              className={`relative p-3 border-2 rounded-xl text-left transition duration-250 focus-ring disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-soft'
                  : 'border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-500'
              }`}
              aria-pressed={isActive}
              aria-label={`Pay with ${provider.name}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isActive
                      ? 'bg-brand-100 dark:bg-brand-900/30'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  <Image
                    src={provider.iconUrl}
                    alt={provider.name}
                    width={24}
                    height={24}
                    priority={false}
                    loading="lazy"
                    className="rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium truncate ${
                      isActive
                        ? 'text-brand-600 dark:text-brand-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {provider.name}
                  </p>
                  <p
                    className={`text-2xs truncate ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {provider.description}
                  </p>
                </div>
                {isActive && (
                  <CheckCircle className="w-4 h-4 text-brand-500 flex-shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// PHONE VALIDATION HELPER
// ============================================
//
// Accepts a phone string and a provider spec. Returns `null` when
// valid, or a human-readable error message.
//
// The rule is deliberately permissive: strip non-digits, require at
// least the provider's national digit count, and cap at 15 total
// digits (E.164 max).
//
// ── Country-code handling ─────────────────────────────────
//
// The country code is only stripped when the number actually looks
// international:
//
//   • A leading `+` (so the user explicitly typed the country
//     code), OR
//   • A digit count strictly greater than
//     `countryCode.length + nationalDigits` (so the country code
//     is present without a `+`).
//
// Stripping the country code based on `startsWith` alone produced
// false negatives for national numbers that happened to begin with
// the same digits as the country code (e.g. a Ugandan national
// number starting `256…` under an MTN spec whose countryCode is
// `'256'`). The stricter gate closes that gap.

export function validatePhoneForProvider(
  phone: string,
  provider: MobileProvider,
): string | null {
  const spec = MOBILE_PROVIDERS.find((p) => p.id === provider);
  if (!spec) return 'Unknown mobile money provider';

  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (digits.length === 0) {
    return `Phone number is required for ${spec.name}`;
  }

  if (digits.length > 15) {
    return 'Phone number is too long';
  }

  const hasExplicitPlus = trimmed.startsWith('+');
  const looksInternationalWithoutPlus =
    digits.length > spec.countryCode.length + spec.nationalDigits;

  const national =
    (hasExplicitPlus || looksInternationalWithoutPlus) &&
    digits.startsWith(spec.countryCode)
      ? digits.slice(spec.countryCode.length)
      : digits.startsWith('0')
        ? digits.slice(1)
        : digits;

  if (national.length < spec.nationalDigits) {
    return `Enter a valid ${spec.name} number (at least ${spec.nationalDigits} digits)`;
  }

  return null;
}

export default MobileMoneyProviderPicker;
