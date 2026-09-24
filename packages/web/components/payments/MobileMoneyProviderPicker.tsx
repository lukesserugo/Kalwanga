'use client';

// ============================================
// MOBILE MONEY PROVIDER PICKER
// ============================================
//
// Lets the user pick between MTN, Airtel, and M-Pesa. The parent
// `PaymentSection` renders this when the selected method is
// `MOBILE_MONEY`. Each provider knows its required phone format
// and its backend routing hint.

import { useCallback } from 'react';
import Image from 'next/image';
import { Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';

export type MobileProvider = 'MTN' | 'AIRTEL' | 'MPESA';

export interface MobileProviderSpec {
  id: MobileProvider;
  name: string;
  description: string;
  /** Flaticon asset path — full URL is composed at render. */
  iconUrl: string;
  /** Placeholder phone number for this provider's country. */
  phonePlaceholder: string;
  /** Digits (national, without country code) used for length check. */
  nationalDigits: number;
  /** Country calling code, no `+`. */
  countryCode: string;
}

export const MOBILE_PROVIDERS: MobileProviderSpec[] = [
  {
    id: 'MPESA',
    name: 'M-Pesa',
    description: 'Safaricom STK push',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
    phonePlaceholder: '+254 712 345 678',
    nationalDigits: 9,
    countryCode: '254',
  },
  {
    id: 'MTN',
    name: 'MTN Mobile Money',
    description: 'MTN MoMo prompt',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
    phonePlaceholder: '+256 770 000 000',
    nationalDigits: 9,
    countryCode: '256',
  },
  {
    id: 'AIRTEL',
    name: 'Airtel Money',
    description: 'Airtel Money prompt',
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/825/825507.png',
    phonePlaceholder: '+256 700 000 000',
    nationalDigits: 9,
    countryCode: '256',
  },
];

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

export function validatePhoneForProvider(
  phone: string,
  provider: MobileProvider,
): string | null {
  const spec = MOBILE_PROVIDERS.find((p) => p.id === provider);
  if (!spec) return 'Unknown mobile money provider';

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 0) {
    return `Phone number is required for ${spec.name}`;
  }

  // Allow either a full international number or a national number.
  const national = digits.startsWith(spec.countryCode)
    ? digits.slice(spec.countryCode.length)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits;

  if (national.length < spec.nationalDigits) {
    return `Enter a valid ${spec.name} number (at least ${spec.nationalDigits} digits)`;
  }

  if (digits.length > 15) {
    return 'Phone number is too long';
  }

  return null;
}

export default MobileMoneyProviderPicker;
