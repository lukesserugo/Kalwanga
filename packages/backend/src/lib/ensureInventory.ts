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
    },
  });

  if (!product) {
    throw new Error(`ensureProductInventory: product ${productId} not found`);
  }

  // Look for an existing Inventory row for this product in this BU.
  // The schema now has `Inventory.productId` directly, so the filter
  // is a plain scalar equality.
  const existing = await tx.inventory.findFirst({
    where: { productId, businessUnitId },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  // Resolve (or create) the Location row, then create Inventory.
  const locationName = options.location ?? 'Warehouse';
  const locationId =
    options.locationId ?? (await resolveLocationId(tx, businessUnitId, locationName));

  const qty = options.quantity ?? 0;
  const reserved = options.reserved ?? 0;

  const inventory = await tx.inventory.create({
    data: {
      businessUnitId,
      productId,
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

  console.log(
    `✅ ensureProductInventory: created inventory ${inventory.id} for product ${productId} in BU ${businessUnitId}`
  );

  return inventory.id;
}

// ============================================
// VARIANT INVENTORY
// ============================================

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
    },
  });

  if (!variant) {
    throw new Error(`ensureVariantInventory: variant ${variantId} not found`);
  }

  const existing = await tx.inventory.findFirst({
    where: { variantId, businessUnitId },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const locationName = options.location ?? 'Warehouse';
  const locationId =
    options.locationId ?? (await resolveLocationId(tx, businessUnitId, locationName));

  const qty = options.quantity ?? 0;
  const reserved = options.reserved ?? 0;

  const inventory = await tx.inventory.create({
    data: {
      businessUnitId,
      variantId,
      productId: variant.productId, // useful for reads that filter by productId
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

  console.log(
    `✅ ensureVariantInventory: created inventory ${inventory.id} for variant ${variantId} in BU ${businessUnitId}`
  );

  return inventory.id;
}

// ============================================
// BACKFILL
// ============================================

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
