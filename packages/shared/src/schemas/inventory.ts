import { z } from "zod";
import {
  categoryIdSchema,
  inventoryIdSchema,
  productIdSchema,
  skuSchema,
  supplierIdSchema,
} from "../helpers";

export const createItemSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().max(50).default(''),
  quantity: z.number().min(0).default(0),
  unit: z.string().default('each'),
  sku: skuSchema.optional(),
  categoryId: categoryIdSchema.optional(),
  minStock: z.number().min(0).optional(),
  maxStock: z.number().min(0).optional(),
  location: z.string().optional(),
  supplier: z.string().max(100).optional(),
  supplierId: supplierIdSchema.optional(),
  unitPrice: z.number().min(0).optional(),
  purchaseDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
  barcode: z.string().max(50).optional(),
  weight: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).default([]).optional(),
  images: z
    .array(z.string().max(5000000, 'Image too large (max 5MB)'))
    .max(10, 'Maximum 10 images allowed')
    .default([])
    .optional(),
  isActive: z.boolean().optional(),
  isDigital: z.boolean().optional(),
  featured: z.boolean().optional(),
});

export const updateItemSchema = createItemSchema.partial();

export const issueItemSchema = z.object({
  issuedTo: z.string().min(1),
  quantity: z.number().min(1),
  purpose: z.string().optional(),
  remarks: z.string().optional(),
  expectedReturnDate: z.string().optional(),
});

export const returnItemSchema = z.object({
  quantity: z.number().min(1).optional(),
  returnDate: z.string().optional(),
  remarks: z.string().optional(),
});

export const restockItemSchema = z.object({
  quantity: z.number().min(1),
  supplier: z.string().optional(),
  unitPrice: z.number().min(0).optional(),
  purchaseDate: z.string().optional(),
  notes: z.string().optional(),
  invoiceNumber: z.string().optional(),
});

export const listItemsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10)),
  search: z.string().optional(),
  lowStock: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  productId: productIdSchema.optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  businessUnitId: z.string().optional(),
});

export const listIssuesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 10)),
  productId: productIdSchema.optional(),
  issuedTo: z.string().optional(),
  status: z.string().optional(),
});

export const bulkCreateItemsSchema = z.object({
  items: z.array(createItemSchema).min(1),
});

export const bulkUpdateStockSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().min(0),
        notes: z.string().optional(),
        transactionType: z
          .enum([
            'PURCHASE',
            'SALE',
            'RETURN',
            'ADJUSTMENT',
            'INITIAL',
            'ADJUSTMENT_IN',
            'ADJUSTMENT_OUT',
          ])
          .optional(),
        variantId: z.string().optional(),
      }),
    )
    .min(1),
});

// Legacy schemas (preserved)
export const createInventorySchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().positive(),
  costPrice: z.number().nonnegative().optional(),
  stock: z.number().nonnegative().default(0),
  reorderPoint: z.number().nonnegative().default(5),
  category: z.string().optional(),
  location: z.string().optional(),
  barcode: z.string().optional(),
  businessUnitId: z.string().optional(),
  description: z.string().optional(),
});

export const updateInventorySchema = z.object({
  stock: z.number().nonnegative(),
  quantity: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  variantId: z.string().optional(),
  transactionType: z
    .enum(['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'INITIAL'])
    .default('ADJUSTMENT'),
});

export const updateStockSchema = z.object({
  quantity: z.number().min(0),
  stock: z.number().min(0).optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  variantId: z.string().optional(),
  transactionType: z
    .enum([
      'ADJUSTMENT',
      'SALE',
      'RETURN',
      'PURCHASE',
      'INITIAL',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
    ])
    .optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const legacyBulkUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().nonnegative().default(0),
        notes: z.string().optional(),
        transactionType: z
          .enum([
            'PURCHASE',
            'SALE',
            'RETURN',
            'ADJUSTMENT',
            'INITIAL',
            'ADJUSTMENT_IN',
            'ADJUSTMENT_OUT',
          ])
          .optional(),
        variantId: z.string().optional(),
      }),
    )
    .min(1),
});

export const bulkUpdateSchema = legacyBulkUpdateSchema;

export const searchProductsSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().nonnegative().optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
});

export const reserveStockSchema = z.object({
  quantity: z.number().int().positive(),
  variantId: z.string().optional(),
  productId: productIdSchema.optional(),
});

export type CreateItemDto = z.infer<typeof createItemSchema>;
export type UpdateItemDto = z.infer<typeof updateItemSchema>;
export type IssueItemDto = z.infer<typeof issueItemSchema>;
export type ReturnItemDto = z.infer<typeof returnItemSchema>;
export type RestockItemDto = z.infer<typeof restockItemSchema>;
export type ListItemsQueryDto = z.infer<typeof listItemsQuerySchema>;
export type ListIssuesQueryDto = z.infer<typeof listIssuesQuerySchema>;
export type BulkCreateItemsDto = z.infer<typeof bulkCreateItemsSchema>;
export type BulkUpdateStockDto = z.infer<typeof bulkUpdateStockSchema>;

// Legacy type aliases preserved
export { inventoryIdSchema };
