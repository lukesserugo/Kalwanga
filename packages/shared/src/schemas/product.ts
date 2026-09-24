import { z } from "zod";
import {
  categoryIdSchema,
  inventoryIdSchema,
  productIdSchema,
  skuSchema,
  supplierIdSchema,
} from "../helpers";

export const createProductSchema = z
  .object({
    name: z.string().min(1, 'Product name is required').max(255),
    description: z.string().optional().nullable(),
    sku: skuSchema.optional(),
    barcode: z.string().max(50).optional().nullable(),
    price: z.coerce.number().positive().optional(),
    unitPrice: z.coerce.number().min(0).optional(),
    costPrice: z.coerce.number().min(0).optional(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    minStock: z.coerce.number().int().min(0).default(5),
    maxStock: z.coerce.number().int().min(0).optional().nullable(),
    stock: z.coerce.number().int().min(0).default(0),
    reorderPoint: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().default(true),
    isDigital: z.boolean().default(false),
    featured: z.boolean().default(false),
    weight: z.coerce.number().positive().optional().nullable(),
    dimensions: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    businessUnitId: z.string().optional(),
    supplier: z.string().optional().nullable(),
    supplierId: z.string().optional().nullable(),
    location: z.string().optional().default('Warehouse'),
    images: z
      .array(z.string().max(5000000, 'Image too large (max 5MB)'))
      .max(10, 'Maximum 10 images allowed')
      .default([])
      .optional(),
    attributes: z.record(z.any()).optional().nullable(),
    notes: z.string().optional().nullable(),
    tags: z.array(z.string().max(50)).default([]).optional(),
    seo: z.record(z.any()).optional().nullable(),
    expiryDate: z.string().optional().nullable(),
    batchNumber: z.string().optional().nullable(),
    inventoryId: z.string().optional().nullable(),
    createdBy: z.string().optional().nullable(),
    variants: z
      .array(
        z.object({
          name: z.string().min(1),
          sku: skuSchema.optional(),
          price: z.number().min(0).optional(),
          costPrice: z.number().min(0).optional(),
          stock: z.number().int().min(0).optional().default(0),
          images: z
            .array(
              z
                .string()
                .max(5000000, 'Variant image too large (max 5MB)'),
            )
            .max(10, 'Maximum 10 images per variant allowed')
            .default([])
            .optional(),
          attributes: z.record(z.any()).default({}).optional(),
          isActive: z.boolean().optional().default(true),
          barcode: z.string().optional(),
        }),
      )
      .optional(),
  })
  .refine((data) => data.price !== undefined || data.unitPrice !== undefined, {
    message: 'Either price or unitPrice must be provided',
    path: ['price'],
  });

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  sku: skuSchema.optional(),
  barcode: z.string().optional(),
  price: z.number().positive().optional(),
  unitPrice: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  taxRate: z.number().min(0).max(100).optional(),
  minStock: z.number().int().min(0).optional(),
  maxStock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  featured: z.boolean().optional(),
  weight: z.number().positive().optional(),
  dimensions: z.string().optional(),
  category: z.string().optional(),
  categoryId: categoryIdSchema.optional(),
  supplier: z.string().optional(),
  supplierId: supplierIdSchema.optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  images: z
    .array(z.string().max(5000000, 'Image too large (max 5MB)'))
    .max(10, 'Maximum 10 images allowed')
    .default([])
    .optional(),
  attributes: z.record(z.any()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]).optional(),
  seo: z.record(z.any()).optional(),
  inventoryId: inventoryIdSchema.optional(),
  keepInventory: z.boolean().optional().default(true),
  variants: z
    .array(
      z.object({
        name: z.string().min(1).optional(),
        sku: skuSchema.optional(),
        price: z.number().min(0).optional(),
        costPrice: z.number().min(0).optional(),
        stock: z.number().int().min(0).optional(),
        images: z
          .array(
            z.string().max(5000000, 'Variant image too large (max 5MB)'),
          )
          .max(10, 'Maximum 10 images per variant allowed')
          .default([])
          .optional(),
        attributes: z.record(z.any()).optional(),
        isActive: z.boolean().optional(),
        barcode: z.string().optional(),
      }),
    )
    .optional(),
});

// Variant schemas
export const createVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  sku: skuSchema.optional(),
  price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional().default(0),
  images: z
    .array(z.string().max(5000000, 'Variant image too large (max 5MB)'))
    .max(10, 'Maximum 10 images allowed')
    .default([])
    .optional(),
  attributes: z.record(z.any()).default({}).optional(),
  location: z.string().optional().default('Warehouse'),
  isActive: z.boolean().optional().default(true),
  barcode: z.string().optional(),
  inventoryId: z.string().optional().nullable(),
});

export const updateVariantSchema = z.object({
  name: z.string().min(1).optional(),
  sku: skuSchema.optional(),
  price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  images: z
    .array(z.string().max(5000000, 'Variant image too large (max 5MB)'))
    .max(10, 'Maximum 10 images allowed')
    .default([])
    .optional(),
  attributes: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
  barcode: z.string().optional(),
  inventoryId: z.string().optional().nullable(),
});

export const bulkCreateVariantsSchema = z.object({
  variants: z
    .array(createVariantSchema)
    .min(1, 'At least one variant is required'),
});

export const updateVariantStockSchema = z.object({
  quantity: z.number().int().min(0, 'Stock quantity must be non-negative'),
  note: z.string().optional(),
});

export const variantQuerySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  productId: productIdSchema.optional(),
  businessUnitId: z.string().optional(),
});

export const checkSkuSchema = z.object({
  sku: skuSchema,
  businessUnitId: z.string().optional(),
  excludeProductId: productIdSchema.optional(),
});

// Review schemas
export const createProductReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
  isVerified: z.boolean().default(false),
  images: z.array(z.string()).default([]).optional(),
});

export const updateProductReviewSchema = createProductReviewSchema.partial();

// Bulk product schemas
export const bulkCreateProductsSchema = z.object({
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        sku: skuSchema.optional(),
        description: z.string().optional(),
        unitPrice: z.number().min(0),
        costPrice: z.number().min(0).optional(),
        taxRate: z.number().min(0).max(100).optional(),
        minStock: z.number().int().min(0).default(5),
        maxStock: z.number().int().min(0).optional(),
        isActive: z.boolean().default(true),
        isDigital: z.boolean().default(false),
        weight: z.number().positive().optional(),
        categoryId: categoryIdSchema.optional(),
        supplierId: supplierIdSchema.optional(),
        images: z
          .array(z.string().max(5000000, 'Image too large (max 5MB)'))
          .max(10, 'Maximum 10 images allowed')
          .default([])
          .optional(),
        attributes: z.record(z.any()).optional(),
        notes: z.string().optional(),
        barcode: z.string().optional(),
        inventoryId: inventoryIdSchema.optional(),
        variants: z.array(createVariantSchema).optional(),
      }),
    )
    .min(1, 'At least one product is required'),
});

export const bulkDeleteProductsSchema = z.object({
  productIds: z.array(productIdSchema).min(1),
});

export const bulkActivateProductsSchema = z.object({
  productIds: z.array(productIdSchema).min(1),
});

export const bulkDeactivateProductsSchema = z.object({
  productIds: z.array(productIdSchema).min(1),
});

export const bulkUpdatePricesSchema = z.object({
  updates: z
    .array(
      z.object({
        id: productIdSchema,
        price: z.number().min(0),
      }),
    )
    .min(1),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type BulkCreateVariantsInput = z.infer<typeof bulkCreateVariantsSchema>;
export type UpdateVariantStockInput = z.infer<typeof updateVariantStockSchema>;
export type VariantQueryInput = z.infer<typeof variantQuerySchema>;
export type CheckSkuInput = z.infer<typeof checkSkuSchema>;
