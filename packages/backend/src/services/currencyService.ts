// packages/backend/src/services/currencyService.ts

import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_CURRENCY_CODE,
  SETTLEMENT_CURRENCY_CODES,
  findCurrency,
  findCurrencyByCountry,
  findCurrencyByPhonePrefix,
  phonePrefixFor,
  type CurrencyMeta,
  type SupportedGateway,
} from '../lib/currencies.js';

/**
 * Local alias for the gateway union exported by `currencies.ts` as
 * `SupportedGateway`. Two callers in this codebase predate that name
 * and import `SupportedProvider` instead. Rather than add a second
 * export to the registry (which would create two names for the same
 * union), we alias it here and re-export it below so those callers
 * can keep their existing import paths.
 *
 * ⚠ If you ever need a genuinely different concept (a provider that
 *   is not a gateway), define a new type with a distinct name. Do
 *   not repurpose this alias.
 */
type SupportedProvider = SupportedGateway;

// Re-export so callers importing from this service don't need to
// know whether the type lives in the registry or here.
export type { SupportedProvider };

/**
 * Currency resolution and validation helpers.
 *
 * This service is intentionally stateless — the registry in
 * `lib/currencies.ts` is the source of truth, and everything here
 * is a pure function of it plus whatever caller-supplied hint is
 * in play.
 *
 * Consumer-facing API:
 *
 *   allCodes()                           → readonly string[]
 *   getCurrency(code)                    → CurrencyMeta (throws)
 *   tryGetCurrency(code)                 → CurrencyMeta | undefined
 *   resolveForBusiness(buCurrency?)      → string
 *   resolveForCountry(country)           → string
 *   resolveForPhone(phone)               → string
 *   phonePrefix(currencyCode)            → string | undefined
 *   assertProviderAccepts(provider,code) → void (throws AppError on mismatch)
 *   providerAccepts(provider,code)       → boolean
 *   toMinorUnits(amount, code)           → number
 *   fromMinorUnits(amount, code)         → number
 *   assertValidAmount(amount, code)      → void (throws AppError on bad shape)
 *   suggestFromPhone(phone)              → string | undefined
 *   listForProvider(provider)            → string[]
 *   listAllSettlement()                  → string[]
 *   getDefault()                         → string
 */
export const currencyService = {
  /** List of all known currency codes, sorted alphabetically. */
  allCodes(): readonly string[] {
    return CURRENCY_CODES;
  },

  /**
   * Full metadata for a currency. Throws 400 on unknown codes.
   *
   * Use this when the currency MUST be known — settlement currency
   * resolution, admin dropdown validation, gateway dispatch. Use
   * `tryGetCurrency` when an unknown code is tolerable (display
   * fallback, cache lookups).
   */
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
   * Unknown codes are logged and skipped rather than throwing — a
   * mis-seeded business unit must not bring checkout down.
   *
   * This is the SAME walk used by `cartService.resolveCartCurrency`,
   * `checkoutService.resolveBusinessUnitCurrency`, and
   * `paymentService.resolveCurrency`. If you change the precedence
   * here, all three change together. That is intentional.
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
   * when no prefix matches — callers that MUST have a specific
   * currency should use `resolveForBusiness` or `getCurrency`.
   */
  resolveForPhone(phone: string | null | undefined): string {
    const meta = findCurrencyByPhonePrefix(phone);
    return meta?.code ?? DEFAULT_CURRENCY_CODE;
  },

  /**
   * Fetch the phone prefix associated with a currency. Used by
   * mobile-money services that need to build an MSISDN.
   *
   * ⚠ `EUR` has no single phone prefix (`'+'` in the registry).
   *   Callers must handle the euro-area case separately.
   */
  phonePrefix(currencyCode: string): string | undefined {
    return phonePrefixFor(currencyCode);
  },

  /**
   * Check whether a provider (STRIPE, PAYPAL, …) accepts a currency.
   * Throws a descriptive 400 when it doesn't.
   *
   * Reads the `gateways` array on the currency's registry entry. An
   * empty `gateways` array means the currency is display-only — no
   * configured gateway can charge in it.
   *
   * ⚠ Mobile-money providers (MTN, AIRTEL, MPESA, …) are NOT in the
   *   `gateways` array. They have their own per-country routing in
   *   `mobileMoneyService` and enforce their own currency
   *   constraints. Do NOT call this method with a mobile-money
   *   provider name — use `mobileMoneyService`'s own validation.
   */
  assertProviderAccepts(
    provider: SupportedProvider,
    currencyCode: string,
  ): void {
    const meta = this.getCurrency(currencyCode);
    if (!meta.gateways.includes(provider)) {
      throw new AppError(
        `${provider} does not support ${meta.code}. ` +
          `Supported currencies for ${provider}: ` +
          CURRENCY_CODES
            .map((code) => CURRENCIES[code])
            .filter((c) => c.gateways.includes(provider))
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
    return !!meta && meta.gateways.includes(provider);
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

  /**
   * Every currency the registry says a given gateway can charge in.
   *
   * Sourced from the `gateways` array on each `CurrencyMeta` entry.
   * Returned sorted for stable output.
   *
   * Used by `paymentService.createDefaultProviders` and
   * `paymentService.getDefaultProviders` to seed
   * `PaymentProviderCurrency` rows — replaces the hardcoded
   * `['USD','EUR','GBP']` arrays that used to live in that file.
   *
   * ⚠ For mobile-money providers (MTN, AIRTEL, MPESA, …) this
   *   returns `[]` because they are not in the `gateways` array.
   *   Use `listAllSettlement()` for ledger-native providers (Cash,
   *   Gift Card, Loyalty Points) and mobile-money providers, or
   *   query `mobileMoneyService.getAvailableProviders()` for the
   *   live provider list.
   */
  listForProvider(provider: SupportedProvider): string[] {
    const upper = provider.toUpperCase();
    return CURRENCY_CODES.filter((code) =>
      CURRENCIES[code].gateways.some(
        (g) => g.toUpperCase() === upper,
      ),
    ).sort();
  },

  /**
   * Every currency a business unit may set as its settlement
   * currency.
   *
   * Cash, gift cards, loyalty points, and mobile-money providers
   * are ledger-native — they accept every settlement currency by
   * definition. This is what those providers'
   * supported-currencies lists become.
   *
   * Returned sorted for stable output.
   */
  listAllSettlement(): string[] {
    return SETTLEMENT_CURRENCY_CODES.slice().sort();
  },

  /**
   * The registry's fallback currency code.
   *
   * Use this instead of a hardcoded `'USD'` anywhere a currency
   * needs a default that isn't BU-specific. On a Ugandan
   * deployment this returns `'UGX'`.
   */
  getDefault(): string {
    return DEFAULT_CURRENCY_CODE;
  },
};

export default currencyService;
