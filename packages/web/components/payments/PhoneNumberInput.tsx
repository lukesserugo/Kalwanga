'use client';

// ============================================
// PHONE NUMBER INPUT
// ============================================
//
// A phone field wired for mobile-money flows. Auto-focuses when
// `autoFocus` is set, exposes a ref for the parent to focus
// programmatically, and shows an inline validity hint when the
// selected mobile provider expects a specific format.

import { forwardRef, useMemo } from 'react';
import { Smartphone, AlertCircle, Check } from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import {
  MOBILE_PROVIDERS,
  validatePhoneForProvider,
  type MobileProvider,
} from './MobileMoneyProviderPicker';

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  /** When set, the field validates against this provider's format. */
  provider?: MobileProvider;
  /** Shows a red asterisk next to the label. */
  required?: boolean;
  disabled?: boolean;
  /** Autofocus when mounted. */
  autoFocus?: boolean;
  label?: string;
  className?: string;
}

export const PhoneNumberInput = forwardRef<
  HTMLInputElement,
  PhoneNumberInputProps
>(function PhoneNumberInput(
  {
    value,
    onChange,
    provider,
    required,
    disabled,
    autoFocus,
    label = 'Phone Number',
    className = '',
  },
  ref,
) {
  const { isDark } = useThemeStore();

  const providerSpec = useMemo(
    () => MOBILE_PROVIDERS.find((p) => p.id === provider),
    [provider],
  );

  const validationError = useMemo(() => {
    if (!provider) return null;
    if (!value.trim()) return null; // empty is a separate concern
    return validatePhoneForProvider(value, provider);
  }, [value, provider]);

  const isValid = useMemo(() => {
    if (!provider || !value.trim()) return false;
    return validatePhoneForProvider(value, provider) === null;
  }, [value, provider]);

  const placeholder =
    providerSpec?.phonePlaceholder || '+256 700 000 000';

  return (
    <div className={className}>
      <label
        className={`block text-sm font-medium mb-1 ${
          isDark ? 'text-gray-300' : 'text-gray-700'
        }`}
      >
        {label} {required && <span className="text-danger-500">*</span>}
      </label>

      <div className="relative">
        <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          ref={ref}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent transition duration-250 tabular-nums ${
            isDark
              ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          } ${
            validationError
              ? 'border-danger-500'
              : isValid
                ? 'border-success-500'
                : ''
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        />

        {isValid && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-success-500 pointer-events-none" />
        )}
      </div>

      {validationError && (
        <p className="mt-1 text-sm text-danger-500 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {validationError}
        </p>
      )}

      {providerSpec && isValid && (
        <p className="mt-1 text-xs text-success-600 dark:text-success-400 tabular-nums">
          ✓ We will send the {providerSpec.name} prompt to {value}
        </p>
      )}
    </div>
  );
});

export default PhoneNumberInput;
