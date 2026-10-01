// packages/backend/src/lib/currencies.ts

export type SupportedGateway =
  | 'STRIPE'
  | 'PAYPAL'
  | 'FLUTTERWAVE'
  | 'SQUARE';

export type SupportedMobileMoneyProvider =
  | 'MTN'
  | 'AIRTEL'
  | 'MPESA'
  | 'VODAFONE'
  | 'TIGO';

/**
 * Metadata for a single currency.
 *
 * ⚠ Every field is required. There are no optional fields. This is
 *   deliberate: the registry is the single source of truth, and an
 *   optional field is a field that can be omitted and then guessed at
 *   by a downstream consumer. Explicit is better.
 */
export interface CurrencyMeta {
  /** ISO 4217 three-letter code, uppercase. E.g. 'UGX'. */
  readonly code: string;

  /** Human-readable name. E.g. 'Ugandan Shilling'. */
  readonly name: string;

  /**
   * Display symbol. E.g. 'USh', '$', '€', '₦'.
   *
   * ⚠ For currencies with no widely-recognized symbol, use the ISO
   *   code itself (e.g. 'KMF' for Comorian Franc). Do NOT invent a
   *   symbol. Payer confusion is worse than a slightly longer label.
   */
  readonly symbol: string;

  /**
   * Number of decimal places per ISO 4217.
   *
   * 0 — UGX, JPY, KRW, VND, XAF, XOF, RWF, KMF, DJF, GNF, etc.
   * 2 — most currencies (USD, EUR, GBP, KES, TZS, NGN, GHS, …).
   * 3 — BHD, IQD, JOD, KWD, LYD, OMR, TND.
   * 4 — CLF, UYW.
   *
   * ⚠ Getting this wrong means rounding errors on every transaction.
   *   Verify against the ISO 4217 standard when adding a currency.
   */
  readonly decimals: 0 | 2 | 3 | 4;

  /** ISO 3166-1 alpha-2 country code of the primary issuing country. */
  readonly country: string;

  /** International phone prefix. E.g. '+256' for Uganda. */
  readonly phonePrefix: string;

  /**
   * Mobile-money providers serving this currency's country.
   *
   * Empty array for countries without mobile money in the platform's
   * provider set. When non-empty, this is the exhaustive list the
   * payer sees at checkout — no BU-level configuration overrides it.
   */
  readonly mobileMoneyProviders: readonly SupportedMobileMoneyProvider[];

  /**
   * Can this currency be used as a business unit's LEDGER currency?
   *
   * True only for currencies that:
   *   (a) have a functioning FX market, and
   *   (b) have at least one gateway in `gateways`.
   *
   * ⚠ A currency with `settlementAllowed: false` cannot be selected
   *   in the admin's "settlement currency" dropdown, and a PATCH to
   *   set it as a BU's currency will be rejected with a 400.
   */
  readonly settlementAllowed: boolean;

  /**
   * Can a payer choose this currency to display prices in?
   *
   * True for all currencies where the platform can obtain an FX rate
   * (which is all of them, given the USD pivot). Display is a
   * presentation-layer transform that does not affect the ledger.
   */
  readonly displayAllowed: boolean;

  /**
   * Can a gateway charge a payer in this currency?
   *
   * True if `gateways.length > 0`. Preserved as a separate flag
   * rather than computed so a currency can be temporarily disabled
   * without removing its gateway list.
   */
  readonly paymentAllowed: boolean;

  /**
   * Gateways that accept charges in this currency.
   *
   * ⚠ Empty array means this is a display-only currency. The payer
   *   can see prices in it, but the actual charge will occur in a
   *   different currency (the gateway's settlement currency for the
   *   BU). This is a normal, correct state — many currencies are
   *   display-only because no gateway you use charges in them.
   */
  readonly gateways: readonly SupportedGateway[];

  /**
   * Minimum amount (in major units of this currency) that a gateway
   * will accept for a single charge.
   *
   * ⚠ Stripe requires at least USD 0.50, EUR 0.50, GBP 0.30, etc.
   *   Enforcing per-currency minimums at the API boundary prevents
   *   gateway rejections and gives the payer a clear error message
   *   before the charge is attempted.
   */
  readonly minCharge: number;

  /**
   * Maximum amount that a gateway will accept for a single charge.
   *
   * Some currencies have low gateway ceilings (mobile money wallets
   * typically cap at a few hundred USD equivalent per transaction).
   * Enforcing this at the API boundary avoids a wasted round trip.
   */
  readonly maxCharge: number;
}

// ============================================
// THE REGISTRY
// ============================================
//
// ⚠ Order is alphabetical by ISO 4217 code, ascending. Additions
//   must maintain that order — a `validate-currencies.ts` script
//   asserts it, and out-of-order entries fail the pre-commit hook.

export const CURRENCIES: Readonly<Record<string, CurrencyMeta>> = Object.freeze({
  // ────────────────────────────────────────────────────────────
  // A
  // ────────────────────────────────────────────────────────────
  AED: { code: 'AED', name: 'United Arab Emirates Dirham', symbol: 'د.إ', decimals: 2, country: 'AE', phonePrefix: '+971', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 2, maxCharge: 100000 },
  AFN: { code: 'AFN', name: 'Afghan Afghani', symbol: '؋', decimals: 2, country: 'AF', phonePrefix: '+93', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  ALL: { code: 'ALL', name: 'Albanian Lek', symbol: 'L', decimals: 2, country: 'AL', phonePrefix: '+355', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  AMD: { code: 'AMD', name: 'Armenian Dram', symbol: '֏', decimals: 2, country: 'AM', phonePrefix: '+374', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  ANG: { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', decimals: 2, country: 'CW', phonePrefix: '+599', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  AOA: { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', decimals: 2, country: 'AO', phonePrefix: '+244', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  ARS: { code: 'ARS', name: 'Argentine Peso', symbol: '$', decimals: 2, country: 'AR', phonePrefix: '+54', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, country: 'AU', phonePrefix: '+61', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'SQUARE'], minCharge: 1, maxCharge: 100000 },
  AWG: { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ', decimals: 2, country: 'AW', phonePrefix: '+297', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  AZN: { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', decimals: 2, country: 'AZ', phonePrefix: '+994', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // B
  // ────────────────────────────────────────────────────────────
  BAM: { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark', symbol: 'KM', decimals: 2, country: 'BA', phonePrefix: '+387', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BBD: { code: 'BBD', name: 'Barbadian Dollar', symbol: 'Bds$', decimals: 2, country: 'BB', phonePrefix: '+1246', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BDT: { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2, country: 'BD', phonePrefix: '+880', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BGN: { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', decimals: 2, country: 'BG', phonePrefix: '+359', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BHD: { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', decimals: 3, country: 'BH', phonePrefix: '+973', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE'], minCharge: 0.2, maxCharge: 20000 },
  BIF: { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu', decimals: 0, country: 'BI', phonePrefix: '+257', mobileMoneyProviders: ['AIRTEL'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BMD: { code: 'BMD', name: 'Bermudan Dollar', symbol: 'BD$', decimals: 2, country: 'BM', phonePrefix: '+1441', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BND: { code: 'BND', name: 'Brunei Dollar', symbol: 'B$', decimals: 2, country: 'BN', phonePrefix: '+673', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BOB: { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs.', decimals: 2, country: 'BO', phonePrefix: '+591', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2, country: 'BR', phonePrefix: '+55', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 2, maxCharge: 100000 },
  BSD: { code: 'BSD', name: 'Bahamian Dollar', symbol: 'B$', decimals: 2, country: 'BS', phonePrefix: '+1242', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BTN: { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu.', decimals: 2, country: 'BT', phonePrefix: '+975', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BWP: { code: 'BWP', name: 'Botswanan Pula', symbol: 'P', decimals: 2, country: 'BW', phonePrefix: '+267', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BYN: { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', decimals: 2, country: 'BY', phonePrefix: '+375', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  BZD: { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$', decimals: 2, country: 'BZ', phonePrefix: '+501', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // C
  // ────────────────────────────────────────────────────────────
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimals: 2, country: 'CA', phonePrefix: '+1', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'SQUARE'], minCharge: 1, maxCharge: 100000 },
  CDF: { code: 'CDF', name: 'Congolese Franc', symbol: 'FC', decimals: 2, country: 'CD', phonePrefix: '+243', mobileMoneyProviders: ['AIRTEL', 'VODAFONE'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2, country: 'CH', phonePrefix: '+41', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'SQUARE'], minCharge: 1, maxCharge: 100000 },
  CLP: { code: 'CLP', name: 'Chilean Peso', symbol: 'CLP$', decimals: 0, country: 'CL', phonePrefix: '+56', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimals: 2, country: 'CN', phonePrefix: '+86', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 5, maxCharge: 500000 },
  COP: { code: 'COP', name: 'Colombian Peso', symbol: 'COL$', decimals: 2, country: 'CO', phonePrefix: '+57', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  CRC: { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', decimals: 2, country: 'CR', phonePrefix: '+506', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  CUP: { code: 'CUP', name: 'Cuban Peso', symbol: '$MN', decimals: 2, country: 'CU', phonePrefix: '+53', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  CVE: { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$', decimals: 2, country: 'CV', phonePrefix: '+238', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  CZK: { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', decimals: 2, country: 'CZ', phonePrefix: '+420', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 20, maxCharge: 2000000 },

  // ────────────────────────────────────────────────────────────
  // D
  // ────────────────────────────────────────────────────────────
  DJF: { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj', decimals: 0, country: 'DJ', phonePrefix: '+253', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  DKK: { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2, country: 'DK', phonePrefix: '+45', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 3, maxCharge: 700000 },
  DOP: { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', decimals: 2, country: 'DO', phonePrefix: '+1809', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  DZD: { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج', decimals: 2, country: 'DZ', phonePrefix: '+213', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // E
  // ────────────────────────────────────────────────────────────
  EGP: { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimals: 2, country: 'EG', phonePrefix: '+20', mobileMoneyProviders: ['VODAFONE'], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'FLUTTERWAVE'], minCharge: 10, maxCharge: 1000000 },
  ERN: { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk', decimals: 2, country: 'ER', phonePrefix: '+291', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  ETB: { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', decimals: 2, country: 'ET', phonePrefix: '+251', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, country: 'EU', phonePrefix: '+', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'SQUARE', 'FLUTTERWAVE'], minCharge: 1, maxCharge: 100000 },

  // ────────────────────────────────────────────────────────────
  // F
  // ────────────────────────────────────────────────────────────
  FJD: { code: 'FJD', name: 'Fijian Dollar', symbol: 'FJ$', decimals: 2, country: 'FJ', phonePrefix: '+679', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  FKP: { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£', decimals: 2, country: 'FK', phonePrefix: '+500', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // G
  // ────────────────────────────────────────────────────────────
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, country: 'GB', phonePrefix: '+44', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'SQUARE', 'FLUTTERWAVE'], minCharge: 0.3, maxCharge: 100000 },
  GEL: { code: 'GEL', name: 'Georgian Lari', symbol: '₾', decimals: 2, country: 'GE', phonePrefix: '+995', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  GHS: { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', decimals: 2, country: 'GH', phonePrefix: '+233', mobileMoneyProviders: ['MTN', 'VODAFONE', 'AIRTEL', 'TIGO'], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['FLUTTERWAVE'], minCharge: 1, maxCharge: 50000 },
  GIP: { code: 'GIP', name: 'Gibraltar Pound', symbol: '£', decimals: 2, country: 'GI', phonePrefix: '+350', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  GMD: { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D', decimals: 2, country: 'GM', phonePrefix: '+220', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  GNF: { code: 'GNF', name: 'Guinean Franc', symbol: 'FG', decimals: 0, country: 'GN', phonePrefix: '+224', mobileMoneyProviders: ['MTN', 'AIRTEL'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  GTQ: { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', decimals: 2, country: 'GT', phonePrefix: '+502', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  GYD: { code: 'GYD', name: 'Guyanaese Dollar', symbol: 'G$', decimals: 2, country: 'GY', phonePrefix: '+592', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // H
  // ────────────────────────────────────────────────────────────
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2, country: 'HK', phonePrefix: '+852', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 4, maxCharge: 800000 },
  HNL: { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', decimals: 2, country: 'HN', phonePrefix: '+504', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  HRK: { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', decimals: 2, country: 'HR', phonePrefix: '+385', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  HTG: { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', decimals: 2, country: 'HT', phonePrefix: '+509', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  HUF: { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', decimals: 2, country: 'HU', phonePrefix: '+36', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 200, maxCharge: 30000000 },

  // ────────────────────────────────────────────────────────────
  // I
  // ────────────────────────────────────────────────────────────
  IDR: { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 2, country: 'ID', phonePrefix: '+62', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'FLUTTERWAVE'], minCharge: 5000, maxCharge: 1000000000 },
  ILS: { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', decimals: 2, country: 'IL', phonePrefix: '+972', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 2, maxCharge: 400000 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2, country: 'IN', phonePrefix: '+91', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'FLUTTERWAVE'], minCharge: 40, maxCharge: 8000000 },
  IQD: { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د', decimals: 3, country: 'IQ', phonePrefix: '+964', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  IRR: { code: 'IRR', name: 'Iranian Rial', symbol: '﷼', decimals: 2, country: 'IR', phonePrefix: '+98', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  ISK: { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', decimals: 0, country: 'IS', phonePrefix: '+354', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // J
  // ────────────────────────────────────────────────────────────
  JMD: { code: 'JMD', name: 'Jamaican Dollar', symbol: 'J$', decimals: 2, country: 'JM', phonePrefix: '+1876', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  JOD: { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JD', decimals: 3, country: 'JO', phonePrefix: '+962', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, country: 'JP', phonePrefix: '+81', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 50, maxCharge: 10000000 },

  // ────────────────────────────────────────────────────────────
  // K
  // ────────────────────────────────────────────────────────────
  KES: { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2, country: 'KE', phonePrefix: '+254', mobileMoneyProviders: ['MPESA', 'AIRTEL'], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['FLUTTERWAVE'], minCharge: 10, maxCharge: 500000 },
  KGS: { code: 'KGS', name: 'Kyrgystani Som', symbol: 'som', decimals: 2, country: 'KG', phonePrefix: '+996', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  KHR: { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', decimals: 2, country: 'KH', phonePrefix: '+855', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  KMF: { code: 'KMF', name: 'Comorian Franc', symbol: 'CF', decimals: 0, country: 'KM', phonePrefix: '+269', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  KPW: { code: 'KPW', name: 'North Korean Won', symbol: '₩', decimals: 2, country: 'KP', phonePrefix: '+850', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0, country: 'KR', phonePrefix: '+82', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 500, maxCharge: 100000000 },
  KWD: { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', decimals: 3, country: 'KW', phonePrefix: '+965', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE'], minCharge: 0.2, maxCharge: 30000 },
  KYD: { code: 'KYD', name: 'Cayman Islands Dollar', symbol: 'CI$', decimals: 2, country: 'KY', phonePrefix: '+1345', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  KZT: { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', decimals: 2, country: 'KZ', phonePrefix: '+7', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // L
  // ────────────────────────────────────────────────────────────
  LAK: { code: 'LAK', name: 'Laotian Kip', symbol: '₭', decimals: 2, country: 'LA', phonePrefix: '+856', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  LBP: { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', decimals: 2, country: 'LB', phonePrefix: '+961', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  LKR: { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', decimals: 2, country: 'LK', phonePrefix: '+94', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  LRD: { code: 'LRD', name: 'Liberian Dollar', symbol: 'L$', decimals: 2, country: 'LR', phonePrefix: '+231', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  LSL: { code: 'LSL', name: 'Lesotho Loti', symbol: 'L', decimals: 2, country: 'LS', phonePrefix: '+266', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  LYD: { code: 'LYD', name: 'Libyan Dinar', symbol: 'LD', decimals: 3, country: 'LY', phonePrefix: '+218', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // M
  // ────────────────────────────────────────────────────────────
  MAD: { code: 'MAD', name: 'Moroccan Dirham', symbol: 'DH', decimals: 2, country: 'MA', phonePrefix: '+212', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'FLUTTERWAVE'], minCharge: 10, maxCharge: 500000 },
  MDL: { code: 'MDL', name: 'Moldovan Leu', symbol: 'L', decimals: 2, country: 'MD', phonePrefix: '+373', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MGA: { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar', decimals: 2, country: 'MG', phonePrefix: '+261', mobileMoneyProviders: ['AIRTEL'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MKD: { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', decimals: 2, country: 'MK', phonePrefix: '+389', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MMK: { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', decimals: 2, country: 'MM', phonePrefix: '+95', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MNT: { code: 'MNT', name: 'Mongolian Tugrik', symbol: '₮', decimals: 2, country: 'MN', phonePrefix: '+976', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MOP: { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$', decimals: 2, country: 'MO', phonePrefix: '+853', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MRU: { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM', decimals: 2, country: 'MR', phonePrefix: '+222', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MUR: { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨', decimals: 2, country: 'MU', phonePrefix: '+230', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MVR: { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf', decimals: 2, country: 'MV', phonePrefix: '+960', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MWK: { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', decimals: 2, country: 'MW', phonePrefix: '+265', mobileMoneyProviders: ['AIRTEL'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: 'Mex$', decimals: 2, country: 'MX', phonePrefix: '+52', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 10, maxCharge: 2000000 },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2, country: 'MY', phonePrefix: '+60', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE'], minCharge: 2, maxCharge: 500000 },
  MZN: { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', decimals: 2, country: 'MZ', phonePrefix: '+258', mobileMoneyProviders: ['VODAFONE'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // N
  // ────────────────────────────────────────────────────────────
  NAD: { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', decimals: 2, country: 'NA', phonePrefix: '+264', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2, country: 'NG', phonePrefix: '+234', mobileMoneyProviders: ['MTN', 'AIRTEL'], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['FLUTTERWAVE'], minCharge: 100, maxCharge: 5000000 },
  NIO: { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', decimals: 2, country: 'NI', phonePrefix: '+505', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  NOK: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2, country: 'NO', phonePrefix: '+47', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 3, maxCharge: 1000000 },
  NPR: { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', decimals: 2, country: 'NP', phonePrefix: '+977', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  NZD: { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2, country: 'NZ', phonePrefix: '+64', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'SQUARE'], minCharge: 1, maxCharge: 100000 },

  // ────────────────────────────────────────────────────────────
  // O
  // ────────────────────────────────────────────────────────────
  OMR: { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', decimals: 3, country: 'OM', phonePrefix: '+968', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE'], minCharge: 0.2, maxCharge: 40000 },

  // ────────────────────────────────────────────────────────────
  // P
  // ────────────────────────────────────────────────────────────
  PAB: { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', decimals: 2, country: 'PA', phonePrefix: '+507', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  PEN: { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', decimals: 2, country: 'PE', phonePrefix: '+51', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  PGK: { code: 'PGK', name: 'Papua New Guinean Kina', symbol: 'K', decimals: 2, country: 'PG', phonePrefix: '+675', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  PHP: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2, country: 'PH', phonePrefix: '+63', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 30, maxCharge: 4000000 },
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', decimals: 2, country: 'PK', phonePrefix: '+92', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  PLN: { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', decimals: 2, country: 'PL', phonePrefix: '+48', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 3, maxCharge: 500000 },
  PYG: { code: 'PYG', name: 'Paraguayan Guarani', symbol: '₲', decimals: 0, country: 'PY', phonePrefix: '+595', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // Q
  // ────────────────────────────────────────────────────────────
  QAR: { code: 'QAR', name: 'Qatari Rial', symbol: 'ر.ق', decimals: 2, country: 'QA', phonePrefix: '+974', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 2, maxCharge: 400000 },

  // ────────────────────────────────────────────────────────────
  // R
  // ────────────────────────────────────────────────────────────
  RON: { code: 'RON', name: 'Romanian Leu', symbol: 'L', decimals: 2, country: 'RO', phonePrefix: '+40', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 3, maxCharge: 500000 },
  RSD: { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин.', decimals: 2, country: 'RS', phonePrefix: '+381', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  RUB: { code: 'RUB', name: 'Russian Ruble', symbol: '₽', decimals: 2, country: 'RU', phonePrefix: '+7', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  RWF: { code: 'RWF', name: 'Rwandan Franc', symbol: 'FRw', decimals: 0, country: 'RW', phonePrefix: '+250', mobileMoneyProviders: ['MTN', 'AIRTEL'], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['FLUTTERWAVE'], minCharge: 500, maxCharge: 50000000 },

  // ────────────────────────────────────────────────────────────
  // S
  // ────────────────────────────────────────────────────────────
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimals: 2, country: 'SA', phonePrefix: '+966', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 2, maxCharge: 400000 },
  SBD: { code: 'SBD', name: 'Solomon Islands Dollar', symbol: 'SI$', decimals: 2, country: 'SB', phonePrefix: '+677', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SCR: { code: 'SCR', name: 'Seychellois Rupee', symbol: '₨', decimals: 2, country: 'SC', phonePrefix: '+248', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SDG: { code: 'SDG', name: 'Sudanese Pound', symbol: 'ج.س.', decimals: 2, country: 'SD', phonePrefix: '+249', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SEK: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2, country: 'SE', phonePrefix: '+46', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 3, maxCharge: 1000000 },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, country: 'SG', phonePrefix: '+65', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 1, maxCharge: 150000 },
  SHP: { code: 'SHP', name: 'Saint Helena Pound', symbol: '£', decimals: 2, country: 'SH', phonePrefix: '+290', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SLL: { code: 'SLL', name: 'Sierra Leonean Leone', symbol: 'Le', decimals: 2, country: 'SL', phonePrefix: '+232', mobileMoneyProviders: ['AIRTEL'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SOS: { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh', decimals: 2, country: 'SO', phonePrefix: '+252', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SRD: { code: 'SRD', name: 'Surinamese Dollar', symbol: 'Sr$', decimals: 2, country: 'SR', phonePrefix: '+597', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SSP: { code: 'SSP', name: 'South Sudanese Pound', symbol: 'SSP', decimals: 2, country: 'SS', phonePrefix: '+211', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  STN: { code: 'STN', name: 'São Tomé and Príncipe Dobra', symbol: 'Db', decimals: 2, country: 'ST', phonePrefix: '+239', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SVC: { code: 'SVC', name: 'Salvadoran Colón', symbol: '₡', decimals: 2, country: 'SV', phonePrefix: '+503', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SYP: { code: 'SYP', name: 'Syrian Pound', symbol: '£S', decimals: 2, country: 'SY', phonePrefix: '+963', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  SZL: { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'E', decimals: 2, country: 'SZ', phonePrefix: '+268', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // T
  // ────────────────────────────────────────────────────────────
  THB: { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2, country: 'TH', phonePrefix: '+66', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 20, maxCharge: 3000000 },
  TJS: { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'ЅМ', decimals: 2, country: 'TJ', phonePrefix: '+992', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  TMT: { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'T', decimals: 2, country: 'TM', phonePrefix: '+993', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  TND: { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', decimals: 3, country: 'TN', phonePrefix: '+216', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'FLUTTERWAVE'], minCharge: 1, maxCharge: 100000 },
  TOP: { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$', decimals: 2, country: 'TO', phonePrefix: '+676', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  TRY: { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2, country: 'TR', phonePrefix: '+90', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL'], minCharge: 10, maxCharge: 1000000 },
  TTD: { code: 'TTD', name: 'Trinidad and Tobago Dollar', symbol: 'TT$', decimals: 2, country: 'TT', phonePrefix: '+1868', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  TWD: { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', decimals: 2, country: 'TW', phonePrefix: '+886', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE'], minCharge: 30, maxCharge: 3000000 },
  TZS: { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 2, country: 'TZ', phonePrefix: '+255', mobileMoneyProviders: ['MPESA', 'AIRTEL', 'TIGO', 'VODAFONE'], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['FLUTTERWAVE'], minCharge: 500, maxCharge: 50000000 },

  // ────────────────────────────────────────────────────────────
  // U
  // ────────────────────────────────────────────────────────────
  UAH: { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', decimals: 2, country: 'UA', phonePrefix: '+380', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  UGX: { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 0, country: 'UG', phonePrefix: '+256', mobileMoneyProviders: ['MTN', 'AIRTEL'], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['FLUTTERWAVE'], minCharge: 500, maxCharge: 50000000 },
  USD: { code: 'USD', name: 'United States Dollar', symbol: '$', decimals: 2, country: 'US', phonePrefix: '+1', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'SQUARE', 'FLUTTERWAVE'], minCharge: 0.5, maxCharge: 1000000 },
  UYU: { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', decimals: 2, country: 'UY', phonePrefix: '+598', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  UZS: { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm', decimals: 2, country: 'UZ', phonePrefix: '+998', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // V
  // ────────────────────────────────────────────────────────────
  VES: { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.', decimals: 2, country: 'VE', phonePrefix: '+58', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  VND: { code: 'VND', name: 'Vietnamese Đồng', symbol: '₫', decimals: 0, country: 'VN', phonePrefix: '+84', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'FLUTTERWAVE'], minCharge: 10000, maxCharge: 500000000 },
  VUV: { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', decimals: 0, country: 'VU', phonePrefix: '+678', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // W
  // ────────────────────────────────────────────────────────────
  WST: { code: 'WST', name: 'Samoan Tala', symbol: 'WS$', decimals: 2, country: 'WS', phonePrefix: '+685', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // X
  // ────────────────────────────────────────────────────────────
  XAF: { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', decimals: 0, country: 'CM', phonePrefix: '+237', mobileMoneyProviders: ['MTN', 'AIRTEL'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  XCD: { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$', decimals: 2, country: 'AG', phonePrefix: '+1268', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  XOF: { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', decimals: 0, country: 'SN', phonePrefix: '+221', mobileMoneyProviders: ['MTN'], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
  XPF: { code: 'XPF', name: 'CFP Franc', symbol: '₣', decimals: 0, country: 'PF', phonePrefix: '+689', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // Y
  // ────────────────────────────────────────────────────────────
  YER: { code: 'YER', name: 'Yemeni Rial', symbol: '﷼', decimals: 2, country: 'YE', phonePrefix: '+967', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },

  // ────────────────────────────────────────────────────────────
  // Z
  // ────────────────────────────────────────────────────────────
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2, country: 'ZA', phonePrefix: '+27', mobileMoneyProviders: [], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['STRIPE', 'PAYPAL', 'FLUTTERWAVE'], minCharge: 5, maxCharge: 1000000 },
  ZMW: { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', decimals: 2, country: 'ZM', phonePrefix: '+260', mobileMoneyProviders: ['MTN', 'AIRTEL'], settlementAllowed: true, displayAllowed: true, paymentAllowed: true, gateways: ['FLUTTERWAVE'], minCharge: 20, maxCharge: 500000 },
  ZWL: { code: 'ZWL', name: 'Zimbabwean Dollar', symbol: 'Z$', decimals: 2, country: 'ZW', phonePrefix: '+263', mobileMoneyProviders: [], settlementAllowed: false, displayAllowed: true, paymentAllowed: false, gateways: [], minCharge: 0, maxCharge: 0 },
});

// ============================================
// DERIVED LOOKUPS
// ============================================

/**
 * All currency codes, sorted alphabetically.
 *
 * ⚠ This is computed once at module load. Mutating `CURRENCIES` after
 *   this file is imported will not update this array. The registry is
 *   frozen and immutable — do not attempt to add currencies at runtime.
 */
export const CURRENCY_CODES: readonly string[] = Object.freeze(
  Object.keys(CURRENCIES).sort(),
);

/**
 * The platform's default currency code.
 *
 * Used when:
 *   - A business unit has no currency set (should never happen after
 *     migration, but the resolver must not throw).
 *   - `process.env.DEFAULT_CURRENCY` is not set.
 *   - A bootstrap creates a new BU in a fresh database.
 *
 * ⚠ Change this ONLY when the platform's primary deployment region
 *   changes. It is a build-time constant, not a runtime setting.
 *   For per-deployment overrides, use `process.env.DEFAULT_CURRENCY`.
 */
export const DEFAULT_CURRENCY_CODE = 'UGX';

/**
 * Currency codes that a business unit may use as its ledger currency.
 *
 * Precomputed at module load. Populated from `settlementAllowed: true`
 * entries only.
 */
export const SETTLEMENT_CURRENCY_CODES: readonly string[] = Object.freeze(
  CURRENCY_CODES.filter((c) => CURRENCIES[c].settlementAllowed),
);

/**
 * Currency codes a payer may select for display.
 *
 * Precomputed at module load. Populated from `displayAllowed: true`
 * entries only. This is intentionally broad — display is a cheap
 * presentation-layer transform.
 */
export const DISPLAY_CURRENCY_CODES: readonly string[] = Object.freeze(
  CURRENCY_CODES.filter((c) => CURRENCIES[c].displayAllowed),
);

/**
 * Currency codes a gateway can charge in.
 *
 * Precomputed at module load. Populated from `paymentAllowed: true`
 * entries only. Narrower than display — not every currency a payer
 * can see is one a gateway can charge in.
 */
export const PAYMENT_CURRENCY_CODES: readonly string[] = Object.freeze(
  CURRENCY_CODES.filter((c) => CURRENCIES[c].paymentAllowed),
);

// ============================================
// PHONE-PREFIX INDEX
// ============================================
//
// `findCurrencyByPhonePrefix` is called during payer checkout on
// every MSISDN entry. Building the sorted prefix list on every call
// was wasteful — the registry is frozen, so the ordering is fixed
// for the lifetime of the process. This index computes it once.
//
// Longest prefixes come first so `+256` (Uganda) wins over a
// shorter `+2` if such a prefix existed. In the current registry no
// two prefixes are prefix-of-each-other, but the ordering is
// defensive against future additions.

interface PhonePrefixEntry {
  readonly digits: string;
  readonly currency: CurrencyMeta;
}

const PHONE_PREFIX_INDEX: readonly PhonePrefixEntry[] = Object.freeze(
  CURRENCY_CODES.map((code) => CURRENCIES[code])
    .filter((c) => c.phonePrefix !== '+')
    .map((c) => ({
      digits: c.phonePrefix.replace(/\D/g, ''),
      currency: c,
    }))
    .filter((e) => e.digits.length > 0)
    .sort((a, b) => b.digits.length - a.digits.length),
);

// ============================================
// LOOKUP HELPERS
// ============================================

/**
 * Case-insensitive currency lookup. Returns `undefined` for unknown
 * codes rather than throwing — callers decide whether an unknown
 * currency is fatal (settlement) or tolerable (display fallback).
 *
 * ⚠ Do NOT use this in a hot loop. `CURRENCIES` is a plain object;
 *   lookups are O(1) but building a `Set` once is faster if you need
 *   to check membership of many codes.
 */
export function findCurrency(
  code: string | null | undefined,
): CurrencyMeta | undefined {
  if (!code) return undefined;
  return CURRENCIES[code.toUpperCase()];
}

/**
 * Find a currency by its primary country's ISO 3166-1 alpha-2 code.
 * E.g. `findCurrencyByCountry('UG')` → `CurrencyMeta` for UGX.
 *
 * ⚠ Several countries share a currency (the euro area, the CFA
 *   franc zones). This returns the FIRST match. For a currency that
 *   spans multiple countries, the registry lists one canonical
 *   country — usually the one issuing it or the largest economy.
 */
export function findCurrencyByCountry(
  countryCode: string | null | undefined,
): CurrencyMeta | undefined {
  if (!countryCode) return undefined;
  const upper = countryCode.toUpperCase();
  return CURRENCY_CODES.map((code) => CURRENCIES[code]).find(
    (c) => c.country === upper,
  );
}

/**
 * Find a currency by a phone number's international prefix.
 * E.g. `findCurrencyByPhonePrefix('+256762676506')` → UGX.
 *
 * ⚠ Multiple currencies may share a prefix (e.g. `+1` covers US,
 *   Canada, and much of the Caribbean). This returns the FIRST
 *   match, which is the canonical issuing currency for the prefix.
 *   For disambiguation when multiple currencies share a prefix, the
 *   caller should look at the full number and use a more specific
 *   heuristic (e.g. `+1 8xx` → Caribbean, `+1 2xx` → Canada).
 */
export function findCurrencyByPhonePrefix(
  phone: string | null | undefined,
): CurrencyMeta | undefined {
  if (!phone) return undefined;
  const normalized = phone.replace(/\D/g, '');
  if (!normalized) return undefined;

  for (const entry of PHONE_PREFIX_INDEX) {
    if (normalized.startsWith(entry.digits)) {
      return entry.currency;
    }
  }

  return undefined;
}

/**
 * Return the phone prefix for a currency code, or `undefined` if the
 * currency is unknown.
 *
 * ⚠ `EUR` has no single phone prefix (`'+'` in the registry). Callers
 *   that use this for MSISDN construction must handle the euro-area
 *   case separately — e.g. by asking the payer for their country.
 */
export function phonePrefixFor(
  currencyCode: string,
): string | undefined {
  return findCurrency(currencyCode)?.phonePrefix;
}
