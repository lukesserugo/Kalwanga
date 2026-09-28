// packages/backend/src/lib/currencies.ts
//
// Single source of truth for currency metadata, country mapping,
// and provider capability. Every other module reads from here.
//
// The list is intentionally broader than the current deployment
// needs — adding a currency here is a one-line change, and the
// service layer picks it up automatically.

export interface CurrencyMeta {
  /** ISO 4217 code, uppercase. */
  code: string;
  /** Human-readable name. */
  name: string;
  /** Display symbol. */
  symbol: string;
  /**
   * Number of minor units per major unit. 2 for USD/EUR/GBP,
   * 0 for UGX/UGX-like (no cents), 3 for a few Middle-East
   * currencies. Used by `toMinorUnits` / `fromMinorUnits`.
   */
  decimals: number;
  /**
   * Countries where this currency is the legal tender and where
   * our providers can actually transact. Used to derive the
   * `country` on a payment.
   */
  countries: readonly string[];
  /**
   * Phone country codes that go with the above countries, for
   * mobile-money numbers. Derived from `countries` when not set.
   */
  phonePrefixes?: readonly string[];
  /**
   * Payment providers that accept this currency. Anything not
   * listed here will be refused by `isProviderSupportedFor`.
   */
  providers: readonly SupportedProvider[];
}

export type SupportedProvider =
  | 'STRIPE'
  | 'PAYPAL'
  | 'FLUTTERWAVE'
  | 'SQUARE'
  | 'MPESA'
  | 'MTN'
  | 'AIRTEL';

/**
 * Currency registry. Extend this list to add a currency; the
 * service layer picks it up automatically.
 *
 * ⚠ The `providers` array must reflect what each provider
 *   *actually accepts in production*. Stripe supports ~135
 *   currencies, but the ones we've tested for this deployment
 *   are the ones listed. Adding a currency Stripe supports but
 *   we haven't tested is fine — Stripe will reject it at the
 *   network boundary, and the error will be legible.
 */
export const CURRENCIES: Readonly<Record<string, CurrencyMeta>> = {
  UGX: {
    code: 'UGX',
    name: 'Ugandan Shilling',
    symbol: 'USh',
    decimals: 0,
    countries: ['UG'],
    phonePrefixes: ['256'],
    providers: ['MTN', 'AIRTEL', 'FLUTTERWAVE'],
  },
  KES: {
    code: 'KES',
    name: 'Kenyan Shilling',
    symbol: 'KSh',
    decimals: 2,
    countries: ['KE'],
    phonePrefixes: ['254'],
    providers: ['MPESA', 'FLUTTERWAVE', 'STRIPE'],
  },
  TZS: {
    code: 'TZS',
    name: 'Tanzanian Shilling',
    symbol: 'TSh',
    decimals: 0,
    countries: ['TZ'],
    phonePrefixes: ['255'],
    providers: ['AIRTEL', 'FLUTTERWAVE'],
  },
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    decimals: 2,
    countries: ['NG'],
    phonePrefixes: ['234'],
    providers: ['FLUTTERWAVE', 'STRIPE'],
  },
  GHS: {
    code: 'GHS',
    name: 'Ghanaian Cedi',
    symbol: '₵',
    decimals: 2,
    countries: ['GH'],
    phonePrefixes: ['233'],
    providers: ['MTN', 'AIRTEL', 'FLUTTERWAVE', 'STRIPE'],
  },
  ZMW: {
    code: 'ZMW',
    name: 'Zambian Kwacha',
    symbol: 'ZK',
    decimals: 2,
    countries: ['ZM'],
    phonePrefixes: ['260'],
    providers: ['MTN', 'AIRTEL', 'FLUTTERWAVE'],
  },
  RWF: {
    code: 'RWF',
    name: 'Rwandan Franc',
    symbol: 'FRw',
    decimals: 0,
    countries: ['RW'],
    phonePrefixes: ['250'],
    providers: ['MTN', 'AIRTEL', 'FLUTTERWAVE'],
  },
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimals: 2,
    countries: ['US'],
    phonePrefixes: ['1'],
    providers: ['STRIPE', 'PAYPAL', 'FLUTTERWAVE', 'SQUARE'],
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    decimals: 2,
    countries: [
      'AT', 'BE', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT',
      'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
    ],
    providers: ['STRIPE', 'PAYPAL', 'SQUARE'],
  },
  GBP: {
    code: 'GBP',
    name: 'Pound Sterling',
    symbol: '£',
    decimals: 2,
    countries: ['GB'],
    phonePrefixes: ['44'],
    providers: ['STRIPE', 'PAYPAL', 'SQUARE'],
  },
  ZAR: {
    code: 'ZAR',
    name: 'South African Rand',
    symbol: 'R',
    decimals: 2,
    countries: ['ZA'],
    phonePrefixes: ['27'],
    providers: ['STRIPE', 'PAYPAL', 'FLUTTERWAVE'],
  },
} as const;

/** Ordered list of currency codes, useful for Zod enums and UIs. */
export const CURRENCY_CODES = Object.keys(CURRENCIES) as readonly string[];

/**
 * Fallback when nothing else resolves. Should match the schema
 * default on `BusinessUnit.currency`.
 */
export const DEFAULT_CURRENCY_CODE = 'UGX';

/**
 * A currency meta by code, case-insensitive. Returns `undefined`
 * for unknown codes rather than throwing — callers decide whether
 * that's an error.
 */
export function findCurrency(code: string | null | undefined): CurrencyMeta | undefined {
  if (!code) return undefined;
  return CURRENCIES[code.toUpperCase()];
}

/**
 * Reverse-lookup: given an ISO country code, find the currency
 * that country transacts in. Returns the first match (most
 * countries have exactly one primary currency).
 */
export function findCurrencyByCountry(
  countryCode: string | null | undefined,
): CurrencyMeta | undefined {
  if (!countryCode) return undefined;
  const upper = countryCode.toUpperCase();
  return Object.values(CURRENCIES).find((c) => c.countries.includes(upper));
}

/**
 * Reverse-lookup: given a phone prefix, find the currency whose
 * country uses it. Useful for mobile-money routing where the
 * caller supplies a phone number but no explicit country.
 */
export function findCurrencyByPhonePrefix(
  phone: string | null | undefined,
): CurrencyMeta | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return Object.values(CURRENCIES).find((c) =>
    (c.phonePrefixes ?? []).some((prefix) => digits.startsWith(prefix)),
  );
}

/**
 * Phone country code for a currency. `UGX` → `256`. Returns the
 * first prefix if multiple countries share a currency (rare for
 * our set — none in the current registry).
 */
export function phonePrefixFor(currencyCode: string): string | undefined {
  return findCurrency(currencyCode)?.phonePrefixes?.[0];
}
