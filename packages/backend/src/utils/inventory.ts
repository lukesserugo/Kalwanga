// D:\Projects\Kalwanga\packages\backend\src\utils\inventory.ts

/**
 * Shared inventory-delta helper.
 *
 * Called by `checkoutService.processCheckout` when a sale is created
 * (negative delta) and by the void/refund path when stock is returned
 * (positive delta). Runs inside the caller's Prisma transaction so it
 * can never open a nested one.
 *
 * The two call sites are the only contract:
 *
 *   await applyInventoryDelta(tx, {
 *     productId, variantId, businessUnitId,
 *     delta: -item.quantity,       // negative = deduct, positive = restock
 *     reason: 'SALE',              // 'RESTOCK' for the reverse path
 *     referenceId: sale.id,
 *     notes: `Sale ${receiptNumber}`,
 *     userId,
 *   });
 *
 * Responsibilities:
 *   1. Resolve the inventory row for (businessUnitId, productId, variantId).
 *   2. Reject negative results (never let stock go below zero on a sale).
 *   3. Update `quantity` and recompute `available = quantity - reserved`.
 *   4. Write an `InventoryTransaction` row so every stock mutation is
 *      auditable — matching the pattern used everywhere else in the
 *      codebase.
 *
 * Deliberately NOT responsible for:
 *   - Creating a missing inventory row. A sale against a product with no
 *     inventory record is a data-integrity bug and should surface as an
 *     error, not be silently fixed here.
 *   - Low-stock notifications. Those live in the sale path in
 *     `saleService` / `inventoryService`, and firing them from inside a
 *     util would couple this file to `notificationService`.
 */

import { Prisma } from '../generated/prisma/index.js';
import { AppError } from '../middleware/errorHandler.js';

// ============================================
// TYPES
// ============================================

/**
 * The `InventoryTransaction.transactionType` enum values this helper
 * is allowed to emit. Narrowed to what the two call sites actually
 * pass, so a typo at the call site becomes a compile error.
 */
export type InventoryDeltaReason =
  | 'SALE'
  | 'RESTOCK'
  | 'RETURN'
  | 'REFUND'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ISSUE'
  | 'PURCHASE';

export interface ApplyInventoryDeltaInput {
  /** Product this delta applies to. Required. */
  productId: string;

  /**
   * Variant, when the sale line was for a specific variant.
   * `undefined` and `null` are both treated as "no variant".
   */
  variantId?: string | null;

  /** Business unit whose inventory row should be adjusted. Required. */
  businessUnitId: string;

  /**
   * Signed change to on-hand quantity.
   *   - Negative → deduct (a sale).
   *   - Positive → add back (a restock, void, refund, return).
   * Never zero: a no-op delta is a caller bug.
   */
  delta: number;

  /** Why the stock is moving. Stored on the transaction row. */
  reason: InventoryDeltaReason;

  /** Sale id, refund id, transfer id, etc. Stored as the FK when applicable. */
  referenceId?: string | null;

  /** Free-form note for the audit trail. */
  notes?: string | null;

  /** User whose action caused the delta. */
  userId: string;
}

export interface ApplyInventoryDeltaResult {
  /** Inventory row id that was updated. */
  inventoryId: string;
  /** Quantity after the delta. */
  quantity: number;
  /** Reserved units (unchanged by this helper). */
  reserved: number;
  /** `quantity - reserved`, floored at zero. */
  available: number;
  /** The transaction row that was written. */
  transactionId: string;
}

// ============================================
// TYPE ALIASES FOR THE TX ARGUMENT
// ============================================

/**
 * The subset of the Prisma transaction client this helper needs.
 *
 * Using `Prisma.TransactionClient` directly would force every caller
 * to widen its own `tx` type. A structural alias keeps the helper
 * usable from inside `this.prisma.$transaction(async (tx) => { ... })`
 * without friction.
 */
type TxClient = Prisma.TransactionClient;

// ============================================
// MAIN HELPER
// ============================================

export async function applyInventoryDelta(
  tx: TxClient,
  input: ApplyInventoryDeltaInput,
): Promise<ApplyInventoryDeltaResult> {
  const {
    productId,
    variantId,
    businessUnitId,
    delta,
    reason,
    referenceId,
    notes,
    userId,
  } = input;

  // ── Validate inputs ──────────────────────────────────────────
  if (!tx) {
    throw new AppError('applyInventoryDelta requires a transaction client', 500);
  }
  if (!productId) {
    throw new AppError('applyInventoryDelta: productId is required', 400);
  }
  if (!businessUnitId) {
    throw new AppError('applyInventoryDelta: businessUnitId is required', 400);
  }
  if (!userId) {
    throw new AppError('applyInventoryDelta: userId is required', 400);
  }
  if (!Number.isFinite(delta) || delta === 0) {
    throw new AppError(
      'applyInventoryDelta: delta must be a non-zero finite number',
      400,
    );
  }

  // Normalize variantId: `undefined` and `null` are equivalent.
  const normalizedVariantId = variantId ?? null;

  // ── Resolve the inventory row ────────────────────────────────
  //
  // Mirrors the resolution strategy used elsewhere in the codebase:
  // scope by business unit, then by (productId, variantId). Prisma's
  // generated `findFirst` accepts a compound object here.
  const inventory = await tx.inventory.findFirst({
    where: {
      businessUnitId,
      productId,
      variantId: normalizedVariantId,
    },
  });

  if (!inventory) {
    throw new AppError(
      `applyInventoryDelta: no inventory row for product ${productId}` +
        (normalizedVariantId ? ` variant ${normalizedVariantId}` : '') +
        ` in business unit ${businessUnitId}`,
      404,
    );
  }

  // ── Compute the new state ────────────────────────────────────
  const currentQuantity = inventory.quantity ?? 0;
  const currentReserved = inventory.reserved ?? 0;

  const newQuantity = currentQuantity + delta;

  // Selling below zero is always a bug — the stock check upstream
  // should have caught it, but we guard here so the invariant is
  // enforced at the single point where stock actually changes.
  if (newQuantity < 0) {
    throw new AppError(
      `applyInventoryDelta: insufficient stock for product ${productId}. ` +
        `Current: ${currentQuantity}, requested: ${Math.abs(delta)}`,
      400,
    );
  }

  const newAvailable = Math.max(0, newQuantity - currentReserved);

  // ── Persist ─────────────────────────────────────────────────
  const updated = await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      quantity: newQuantity,
      available: newAvailable,
      updatedAt: new Date(),
    },
  });

  const transaction = await tx.inventoryTransaction.create({
    data: {
      transactionType: reason as any,
      quantity: delta,
      notes: notes ?? null,
      reference: referenceId ?? null,
      productId,
      variantId: normalizedVariantId,
      inventoryId: inventory.id,
      businessUnitId,
      userId,
      saleId: reason === 'SALE' || reason === 'RESTOCK' ? referenceId ?? null : null,
    },
  });

  return {
    inventoryId: updated.id,
    quantity: updated.quantity,
    reserved: updated.reserved ?? 0,
    available: updated.available ?? newAvailable,
    transactionId: transaction.id,
  };
}

export default applyInventoryDelta;
