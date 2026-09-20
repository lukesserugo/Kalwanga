// D:\Projects\Kalwanga\packages\backend\src\utils\money.ts

export interface LineItemInput {
  /** Server-looked-up unit price. Never from the client. */
  unitPrice: number;
  /** Number of units. Must be > 0. */
  quantity: number;
  /** Per-line discount amount (already computed, in currency). */
  lineDiscount?: number;
  /**
   * Tax rate as a percentage — 8 = 8%. Null/undefined means the item
   * is tax-exempt.
   *
   * The database enforces this convention via CHECK constraints on
   * every taxRate column (see the `normalize_tax_rate_convention`
   * migration). Every producer of a LineItemInput must pass a
   * percentage, not a decimal.
   */
  taxRate?: number | null;
}

export interface LineItemResult {
  /** unitPrice × quantity, rounded to 2dp. */
  gross: number;
  /** gross − lineDiscount, floored at 0, rounded to 2dp. */
  net: number;
  /** net × (taxRate / 100), rounded to 2dp. */
  tax: number;
  /** net + tax, rounded to 2dp. */
  total: number;
}

export interface CartTotals {
  /** Sum of net line amounts. */
  subtotal: number;
  /** Sum of tax across all lines. */
  tax: number;
  /** Sum of line discounts plus cart-level discount. */
  discount: number;
  /** subtotal + tax − discount, floored at 0. */
  total: number;
  /** Per-line breakdown, aligned with the input array. */
  lines: LineItemResult[];
}

/** Round to 2 decimal places using banker-safe arithmetic. */
export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  // Adding Number.EPSILON before rounding mitigates
  // 0.1 + 0.2 = 0.30000000000000004 style drift.
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Compute a single line's gross, net, tax, and total.
 *
 * Line discount is applied BEFORE tax, which is the standard POS
 * convention: a $10 discount on a taxed item reduces the taxable
 * amount, not the tax owed on the pre-discount total.
 *
 * Tax rate is a percentage (8 = 8%). The database stores it that way
 * and the CHECK constraints enforce the range [0, 100]. This function
 * converts it to the decimal multiplier that the multiplication needs.
 */
export function computeLine(input: LineItemInput): LineItemResult {
  const quantity = Math.max(0, Math.floor(input.quantity));
  const unitPrice = Math.max(0, input.unitPrice);
  const lineDiscount = Math.max(0, input.lineDiscount ?? 0);

  const gross = round2(unitPrice * quantity);
  const net = round2(Math.max(0, gross - lineDiscount));

  // Tax rate is a percentage (8 = 8%). Convert to a decimal multiplier
  // (0.08) before multiplying. Null/undefined → 0 (tax-exempt).
  const pct = typeof input.taxRate === 'number' ? input.taxRate : 0;
  const rate = pct / 100;

  const tax = round2(net * rate);
  const total = round2(net + tax);

  return { gross, net, tax, total };
}

/**
 * Compute cart-wide totals from line items plus a cart-level discount.
 *
 * Cart-level discount is applied proportionally against the net
 * amounts so that tax is reduced in lockstep with the discount.
 * This is what the previous code got wrong: it subtracted a flat
 * discount from a subtotal that already had tax baked in, which
 * meant the customer paid tax on money they didn't spend.
 */
export function computeCartTotals(
  lines: LineItemInput[],
  cartDiscount: number = 0,
): CartTotals {
  const computedLines = lines.map(computeLine);
  const subtotal = round2(
    computedLines.reduce((s, l) => s + l.net, 0),
  );
  const taxBeforeCartDiscount = round2(
    computedLines.reduce((s, l) => s + l.tax, 0),
  );
  const lineDiscountsTotal = round2(
    computedLines.reduce(
      (s, l, i) => s + Math.max(0, lines[i].lineDiscount ?? 0),
      0,
    ),
  );

  // Cap cart-level discount at the subtotal — cannot discount below zero.
  const safeCartDiscount = round2(
    Math.min(Math.max(0, cartDiscount), subtotal),
  );

  // Proportionally reduce tax by the same ratio the discount reduced
  // the subtotal. If discount is 20% of subtotal, tax reduces 20%.
  const taxReductionRatio =
    subtotal > 0 ? safeCartDiscount / subtotal : 0;
  const taxReduction = round2(taxBeforeCartDiscount * taxReductionRatio);
  const tax = round2(taxBeforeCartDiscount - taxReduction);

  const discount = round2(lineDiscountsTotal + safeCartDiscount);
  const total = round2(Math.max(0, subtotal + tax - safeCartDiscount));

  return {
    subtotal,
    tax,
    discount,
    total,
    lines: computedLines,
  };
}

/**
 * Compute change owed. Zero-floored — if the customer underpaid
 * we return a negative change, which the caller must reject.
 */
export function computeChange(
  paidAmount: number,
  total: number,
): number {
  return round2(paidAmount - total);
}
