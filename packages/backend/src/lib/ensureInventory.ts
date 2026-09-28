// src/lib/ensureInventory.ts

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
  /** Optional FK to a Location row. Resolved by name if omitted. */
  locationId?: string;
}

// ============================================
// IMAGE HELPERS
// ============================================
//
// `Product.images` is `ProductImage[]`. `Inventory.images` is still a
// scalar `String[]` denormalised cache. Flatten before writing.

function toImageUrls(input: unknown): string[] {
  if (!input) return [];
  if (typeof input === 'string') return [input];
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => {
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as any).url === 'string') {
        return (v as any).url as string;
      }
      return null;
    })
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
}

// ============================================
// LOCATION RESOLUTION
// ============================================
//
// Resolve a location name to a Location.id for the BU, creating the
// Location row if it doesn't exist yet. Mirrors the helper in
// `inventoryService.ts`.

async function resolveLocationId(
  tx: Tx,
  businessUnitId: string,
  locationName: string | undefined | null
): Promise<string | null> {
  const name = (locationName || 'Warehouse').trim();
  if (!name) return null;

  let loc = await tx.location.findFirst({
    where: { businessUnitId, name, deletedAt: null },
    select: { id: true },
  });

  if (!loc) {
    loc = await tx.location.create({
      data: {
        name,
        businessUnitId,
        type: 'OTHER',
        isActive: true,
        isDefault: false,
      },
      select: { id: true },
    });
  }

  return loc.id;
}

// ============================================
// PRODUCT INVENTORY
// ============================================
//
// The owning FK lives on `Product.inventoryId` (one-to-one, unique).
// `Inventory` has only the back-relation `product`. So the link MUST be
// written from the Product side — we cannot set it on `Inventory.create`.

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
      images: true, // ProductImage[]
      taxRate: true,
      weight: true,
      tags: true,
      description: true,
      inventoryId: true, // owning FK
    },
  });

  if (!product) {
    throw new Error(`ensureProductInventory: product ${productId} not found`);
  }

  // Already linked → reuse if the linked row is in the same BU.
  if (product.inventoryId) {
    const existing = await tx.inventory.findUnique({
      where: { id: product.inventoryId },
      select: { id: true, businessUnitId: true },
    });
    if (existing && existing.businessUnitId === businessUnitId) {
      return existing.id;
    }
  }

  // Defensive: check for a stale orphan Inventory row in this BU that
  // isn't linked to anything and adopt it, rather than piling up more.
  const orphan = await tx.inventory.findFirst({
    where: {
      businessUnitId,
      product: null,
      variant: null,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (orphan) {
    await tx.product.update({
      where: { id: productId },
      data: { inventoryId: orphan.id },
    });
    return orphan.id;
  }

  // Create a fresh Inventory row and link it to the Product.
  const locationName = options.location ?? 'Warehouse';
  const locationId =
    options.locationId ?? (await resolveLocationId(tx, businessUnitId, locationName));

  const qty = options.quantity ?? 0;
  const reserved = options.reserved ?? 0;

  const inventory = await tx.inventory.create({
    data: {
      businessUnitId,
      locationId,

      quantity: qty,
      reserved,
      available: Math.max(0, qty - reserved),

      reorderPoint: options.reorderPoint ?? 5,
      reorderQuantity: options.reorderQuantity ?? 10,

      location: locationName,
      status: 'ACTIVE',

      // Denormalised cache from product
      images: toImageUrls(product.images),
      description: product.description ?? null,
      weight: product.weight ?? null,
      taxRate: product.taxRate ?? null,
      tags: product.tags ?? [],
    },
    select: { id: true },
  });

  // ✅ Write the owning side of the relation.
  await tx.product.update({
    where: { id: productId },
    data: { inventoryId: inventory.id },
  });

  console.log(
    `✅ ensureProductInventory: created + linked inventory ${inventory.id} for product ${productId} in BU ${businessUnitId}`
  );

  return inventory.id;
}

// ============================================
// VARIANT INVENTORY
// ============================================
//
// Same shape as above: `ProductVariant.inventoryId` is the owner.

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
      images: true, // ProductVariantImage[]
      inventoryId: true, // owning FK
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

  const orphan = await tx.inventory.findFirst({
    where: {
      businessUnitId,
      product: null,
      variant: null,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (orphan) {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { inventoryId: orphan.id },
    });
    return orphan.id;
  }

  const locationName = options.location ?? 'Warehouse';
  const locationId =
    options.locationId ?? (await resolveLocationId(tx, businessUnitId, locationName));

  const qty = options.quantity ?? 0;
  const reserved = options.reserved ?? 0;

  const inventory = await tx.inventory.create({
    data: {
      businessUnitId,
      locationId,

      quantity: qty,
      reserved,
      available: Math.max(0, qty - reserved),

      reorderPoint: options.reorderPoint ?? 5,
      reorderQuantity: options.reorderQuantity ?? 10,

      location: locationName,
      status: 'ACTIVE',

      images: toImageUrls(variant.images),
      description: null,
      weight: null,
      taxRate: null,
      tags: [],
    },
    select: { id: true },
  });

  // ✅ Write the owning side of the relation.
  await tx.productVariant.update({
    where: { id: variantId },
    data: { inventoryId: inventory.id },
  });

  console.log(
    `✅ ensureVariantInventory: created + linked inventory ${inventory.id} for variant ${variantId} in BU ${businessUnitId}`
  );

  return inventory.id;
}

// ============================================
// BACKFILL
// ============================================

/**
 * Backfill: ensure every product and variant in a business unit has a
 * linked Inventory row. Safe to run repeatedly.
 *
 * Also re-points any Inventory rows that are orphaned (no Product and no
 * ProductVariant referencing them) back onto a matching product/variant,
 * so pre-existing data created by the old buggy version gets repaired.
 */
export async function backfillInventoryForBusinessUnit(
  tx: Tx,
  businessUnitId: string
): Promise<{ products: number; variants: number }> {
  const products = await tx.product.findMany({
    where: { businessUnitId, deletedAt: null },
    select: { id: true, inventoryId: true },
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
    where: { product: { businessUnitId }, deletedAt: null },
    select: { id: true, inventoryId: true },
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
