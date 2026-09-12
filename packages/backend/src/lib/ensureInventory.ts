// src/lib/ensureInventory.ts
//
// Guarantees that a Product (or ProductVariant) has a linked Inventory row
// in a given business unit. Idempotent: safe to call multiple times.
//
// Why this exists:
//   The Prisma schema puts the FK on Product.inventoryId → Inventory.id
//   (and ProductVariant.inventoryId → Inventory.id). Nothing in the
//   backend currently creates those rows at product-create time, so
//   freshly-created products fail at checkout with
//   "No inventory found for <product> in this location".
//
//   Rather than patch every downstream service (cart, order, checkout,
//   sale, return, refund, ...) we guarantee the invariant at the source.
//
import { Prisma } from '../generated/prisma/index.js';

type Tx = Prisma.TransactionClient;

export interface EnsureInventoryOptions {
  /** Initial quantity. Defaults to 0. */
  quantity?: number;
  /** Initial reserved count. Defaults to 0. */
  reserved?: number;
  /** Initial reorder point. Defaults to 5. */
  reorderPoint?: number;
  /** Initial reorder quantity. Defaults to 10. */
  reorderQuantity?: number;
  /** Location label. Defaults to "Warehouse". */
  location?: string;
}

/**
 * Ensure a Product has an Inventory row in the given business unit.
 * Returns the inventory id (existing or newly created).
 */
export async function ensureProductInventory(
  tx: Tx,
  productId: string,
  businessUnitId: string,
  options: EnsureInventoryOptions = {}
): Promise<string> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      images: true,
      taxRate: true,
      weight: true,
      tags: true,
      description: true,
      inventoryId: true,
    },
  });

  if (!product) {
    throw new Error(`ensureProductInventory: product ${productId} not found`);
  }

  // Fast path: inventoryId set and pointing at a valid Inventory row in
  // this business unit.
  if (product.inventoryId) {
    const existing = await tx.inventory.findUnique({
      where: { id: product.inventoryId },
      select: { id: true, businessUnitId: true },
    });
    if (existing && existing.businessUnitId === businessUnitId) {
      return existing.id;
    }
    // inventoryId points elsewhere; fall through and re-link.
  }

  // Look for an existing Inventory row already tied to this product in
  // this business unit. Uses relation filter because `Inventory` has no
  // scalar `productId` column in the current schema.
  const existing = await tx.inventory.findFirst({
    where: {
      product: { id: productId },
      businessUnitId,
    },
    select: { id: true },
  });

  if (existing) {
    if (product.inventoryId !== existing.id) {
      await tx.product.update({
        where: { id: productId },
        data: { inventoryId: existing.id },
      });
    }
    return existing.id;
  }

  // Create a fresh Inventory row, then link it from Product.
  const qty = options.quantity ?? 0;
  const inventory = await tx.inventory.create({
    data: {
      businessUnitId,
      quantity: qty,
      reserved: options.reserved ?? 0,
      available: Math.max(0, qty - (options.reserved ?? 0)),
      reorderPoint: options.reorderPoint ?? 5,
      reorderQuantity: options.reorderQuantity ?? 10,
      location: options.location ?? 'Warehouse',
      status: 'ACTIVE',
      images: product.images ?? [],
      description: product.description ?? null,
      weight: product.weight ?? null,
      taxRate: product.taxRate ?? null,
      tags: product.tags ?? [],
    },
  });

  await tx.product.update({
    where: { id: productId },
    data: { inventoryId: inventory.id },
  });

  console.log(
    `✅ ensureProductInventory: created inventory ${inventory.id} for product ${productId} in BU ${businessUnitId}`
  );

  return inventory.id;
}

/**
 * Ensure a ProductVariant has an Inventory row in the given business unit.
 * Returns the inventory id (existing or newly created).
 */
export async function ensureVariantInventory(
  tx: Tx,
  variantId: string,
  businessUnitId: string,
  options: EnsureInventoryOptions = {}
): Promise<string> {
  const variant = await tx.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      name: true,
      productId: true,
      images: true,
      inventoryId: true,
    },
  });

  if (!variant) {
    throw new Error(`ensureVariantInventory: variant ${variantId} not found`);
  }

  if (variant.inventoryId) {
    const existing = await tx.inventory.findUnique({
      where: { id: variant.inventoryId },
      select: { id: true, businessUnitId: true },
    });
    if (existing && existing.businessUnitId === businessUnitId) {
      return existing.id;
    }
  }

  const existing = await tx.inventory.findFirst({
    where: {
      variant: { id: variantId },
      businessUnitId,
    },
    select: { id: true },
  });

  if (existing) {
    if (variant.inventoryId !== existing.id) {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { inventoryId: existing.id },
      });
    }
    return existing.id;
  }

  const qty = options.quantity ?? 0;
  const inventory = await tx.inventory.create({
    data: {
      businessUnitId,
      quantity: qty,
      reserved: options.reserved ?? 0,
      available: Math.max(0, qty - (options.reserved ?? 0)),
      reorderPoint: options.reorderPoint ?? 5,
      reorderQuantity: options.reorderQuantity ?? 10,
      location: options.location ?? 'Warehouse',
      status: 'ACTIVE',
      images: variant.images ?? [],
    },
  });

  await tx.productVariant.update({
    where: { id: variantId },
    data: { inventoryId: inventory.id },
  });

  console.log(
    `✅ ensureVariantInventory: created inventory ${inventory.id} for variant ${variantId} in BU ${businessUnitId}`
  );

  return inventory.id;
}

/**
 * Backfill: ensure every product and variant in a business unit has a
 * linked Inventory row. Safe to run repeatedly.
 */
export async function backfillInventoryForBusinessUnit(
  tx: Tx,
  businessUnitId: string
): Promise<{ products: number; variants: number }> {
  const products = await tx.product.findMany({
    where: { businessUnitId },
    select: { id: true },
  });

  let productCount = 0;
  for (const p of products) {
    try {
      await ensureProductInventory(tx, p.id, businessUnitId);
      productCount++;
    } catch (err) {
      console.warn(`backfill: product ${p.id} failed:`, err);
    }
  }

  const variants = await tx.productVariant.findMany({
    where: { product: { businessUnitId } },
    select: { id: true },
  });

  let variantCount = 0;
  for (const v of variants) {
    try {
      await ensureVariantInventory(tx, v.id, businessUnitId);
      variantCount++;
    } catch (err) {
      console.warn(`backfill: variant ${v.id} failed:`, err);
    }
  }

  return { products: productCount, variants: variantCount };
}
