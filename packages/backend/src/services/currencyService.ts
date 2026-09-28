// packages/backend/src/services/currencyService.ts

import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_CURRENCY_CODE,
  findCurrency,
  findCurrencyByCountry,
  findCurrencyByPhonePrefix,
  phonePrefixFor,
  type CurrencyMeta,
  type SupportedProvider,
} from '../lib/currencies.js';

/**
 * Currency resolution and validation helpers.
 *
 * This service is intentionally stateless — the registry in
 * `lib/currencies.ts` is the source of truth, and everything here
 * is a pure function of it plus whatever caller-supplied hint is
 * in play.
 *
 * Consumer-facing API (unchanged from the ad-hoc helpers it
 * replaces):
 *
 *   getCurrency(code)                    → CurrencyMeta
 *   resolveForBusiness(buCurrency?)      → string
 *   resolveForCountry(country)           → string
 *   resolveForPhone(phone)               → string
 *   assertProviderAccepts(provider,code) → void (throws AppError on mismatch)
 *   toMinorUnits(amount, code)           → number
 *   fromMinorUnits(amount, code)         → number
 *   assertValidAmount(amount, code)      → void (throws AppError on bad shape)
 */

export const currencyService = {
  /** List of all known currency codes. */
  allCodes(): readonly string[] {
    return CURRENCY_CODES;
  },

  /** Full metadata for a currency. Throws 400 on unknown codes. */
  getCurrency(code: string | null | undefined): CurrencyMeta {
    const meta = findCurrency(code);
    if (!meta) {
      throw new AppError(
        `Unsupported currency: ${code ?? '(missing)'}. ` +
          `Supported: ${CURRENCY_CODES.join(', ')}.`,
        400,
      );
    }
    return meta;
  },

  /** Same as `getCurrency` but returns `undefined` instead of throwing. */
  tryGetCurrency(code: string | null | undefined): CurrencyMeta | undefined {
    return findCurrency(code);
  },

  /**
   * Resolve the currency for a business unit. Precedence:
   *   1. businessUnit.currency (from DB)
   *   2. DEFAULT_CURRENCY env var
   *   3. registry default (UGX)
   *
   * Unknown codes are logged and skipped rather than throwing —
   * a mis-seeded business unit shouldn't bring checkout down.
   */
  resolveForBusiness(businessUnitCurrency?: string | null): string {
    if (businessUnitCurrency && findCurrency(businessUnitCurrency)) {
      return businessUnitCurrency.toUpperCase();
    }
    if (businessUnitCurrency) {
      logger.warn(
        `[currency] Business unit has unknown currency "${businessUnitCurrency}" — falling back to platform default.`,
      );
    }
    const envDefault = process.env.DEFAULT_CURRENCY;
    if (envDefault && findCurrency(envDefault)) {
      return envDefault.toUpperCase();
    }
    return DEFAULT_CURRENCY_CODE;
  },

  /** Resolve from an ISO country code (UG → UGX, KE → KES, …). */
  resolveForCountry(countryCode: string | null | undefined): string {
    const meta = findCurrencyByCountry(countryCode);
    if (!meta) {
      throw new AppError(
        `Unsupported country: ${countryCode ?? '(missing)'}.`,
        400,
      );
    }
    return meta.code;
  },

  /**
   * Resolve from a phone number's country prefix. E.164-ish input:
   * `+256762676506` → UGX. Falls through to `DEFAULT_CURRENCY_CODE`
   * when no prefix matches — callers that *must* have a specific
   * currency should use `resolveForBusiness` or `getCurrency`.
   */
  resolveForPhone(phone: string | null | undefined): string {
    const meta = findCurrencyByPhonePrefix(phone);
    return meta?.code ?? DEFAULT_CURRENCY_CODE;
  },

  /**
   * Fetch the phone prefix associated with a currency. Used by
   * mobile-money services that need to build an MSISDN.
   */
  phonePrefix(currencyCode: string): string | undefined {
    return phonePrefixFor(currencyCode);
  },

  /**
   * Check whether a provider (Stripe, MTN, …) accepts a currency.
   * Throws a descriptive 400 when it doesn't.
   */
  assertProviderAccepts(
    provider: SupportedProvider,
    currencyCode: string,
  ): void {
    const meta = this.getCurrency(currencyCode);
    if (!meta.providers.includes(provider)) {
      throw new AppError(
        `${provider} does not support ${meta.code}. ` +
          `Supported currencies for ${provider}: ` +
          Object.values(CURRENCIES)
            .filter((c) => c.providers.includes(provider))
            .map((c) => c.code)
            .join(', ') +
          '.',
        400,
      );
    }
  },

  /** Non-throwing variant of `assertProviderAccepts`. */
  providerAccepts(
    provider: SupportedProvider,
    currencyCode: string,
  ): boolean {
    const meta = findCurrency(currencyCode);
    return !!meta && meta.providers.includes(provider);
  },

  /**
   * Convert a major-unit amount (what the customer sees) to
   * minor units (what the provider expects). Stripe, Square, and
   * most gateways want minor units; MTN/Airtel/MPesa want major
   * units as integers for zero-decimal currencies.
   *
   *   toMinorUnits(41.5, 'USD')  → 4150
   *   toMinorUnits(41500, 'UGX') → 41500   (decimals = 0)
   */
  toMinorUnits(amount: number, currencyCode: string): number {
    const { decimals } = this.getCurrency(currencyCode);
    return Math.round(amount * Math.pow(10, decimals));
  },

  /** Inverse of `toMinorUnits`. */
  fromMinorUnits(amountInMinor: number, currencyCode: string): number {
    const { decimals } = this.getCurrency(currencyCode);
    return amountInMinor / Math.pow(10, decimals);
  },

  /**
   * Validate an amount for a currency. Enforces:
   *   • finite, positive
   *   • integer when `decimals === 0` (UGX, RWF, TZS)
   *
   * Replaces the old local `assertValidAmount` in
   * `mobileMoneyService.ts` — the behaviour is identical, it's
   * just driven by the registry now.
   */
  assertValidAmount(amount: number, currencyCode: string): void {
    const meta = this.getCurrency(currencyCode);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Amount must be a positive number', 400);
    }

    if (meta.decimals === 0 && !Number.isInteger(amount)) {
      throw new AppError(
        `Amount for ${meta.code} must be an integer (no decimals in ${meta.name}).`,
        400,
      );
    }
  },

  /**
   * Suggest the currency for a request that provides only a phone
   * number. Used by mobile-money services to reject a caller-
   * supplied currency that disagrees with the phone number's
   * country.
   *
   * Returns `undefined` when the phone prefix isn't recognised.
   */
  suggestFromPhone(phone: string | null | undefined): string | undefined {
    return findCurrencyByPhonePrefix(phone)?.code;
  },
};

export default currencyService;
