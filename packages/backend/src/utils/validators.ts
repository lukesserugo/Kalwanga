// D:\Projects\Kalwanga\packages\backend\src\utils\validators.ts

import { z } from 'zod';

// ============================================
// ID VALIDATION HELPERS - Supports CUID, UUID, and Clerk IDs
// ============================================

const isCUID = (val: string): boolean => {
  // CUIDs can be 20-25 characters, starting with 'c'
  const cuidRegex = /^c[a-z0-9]{20,25}$/i;
  return cuidRegex.test(val);
};

const isUUID = (val: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val);
};

const isClerkId = (val: string): boolean => {
  const clerkRegex = /^user_[a-zA-Z0-9]+$/;
  return clerkRegex.test(val);
};

const isValidId = (val: string): boolean => {
  // Check if it's a valid CUID (20-25 chars starting with c)
  if (/^c[a-z0-9]{20,25}$/i.test(val)) return true;
  // Check if it's a valid UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return true;
  // Check if it's a Clerk ID (user_xxx)
  if (/^user_[a-zA-Z0-9]+$/.test(val)) return true;
  // Check if it's a numeric ID
  if (/^[0-9]+$/.test(val)) return true;
  // For development, allow any alphanumeric with hyphens/underscores
  if (/^[a-zA-Z0-9_-]+$/.test(val)) return true;
  return false;
};

const idSchema = (typeName: string) => {
  return z.string()
    .min(1, `${typeName} ID is required`)
    .refine(
      (val) => {
        // Try each validation method
        if (isCUID(val)) return true;
        if (isUUID(val)) return true;
        if (isClerkId(val)) return true;
        // Allow any alphanumeric with hyphens/underscores (lenient fallback)
        if (/^[a-zA-Z0-9_-]+$/.test(val)) return true;
        return false;
      },
      { message: `Invalid ${typeName} ID format. Must be a valid CUID, UUID, or Clerk ID.` }
    );
};

// ============================================
// SKU VALIDATION SCHEMA
// ============================================

const skuSchema = z.string()
  .min(1, 'SKU is required')
  .max(50, 'SKU must be less than 50 characters')
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9-_]*$/,
    'SKU must contain only letters, numbers, hyphens, and underscores'
  );

// ============================================
// ID SCHEMAS
// ============================================

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const optionalUuidSchema = z.string().uuid('Invalid UUID format').optional();
export const nullableUuidSchema = z.string().uuid('Invalid UUID format').nullable().optional();

export const businessUnitIdSchema = z.string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      if (val === 'default' || val === 'default-business-unit') return true;
      return isCUID(val) || isUUID(val);
    },
    { message: 'Invalid business unit ID format.' }
  );

export const companyIdSchema = z.string()
  .min(1, 'Company ID is required')
  .refine(
    (val) => {
      if (val === 'default' || val === 'default-company-id' || val === 'default-company') return true;
      return isCUID(val) || isUUID(val);
    },
    { message: 'Invalid company ID format.' }
  );

export const userIdSchema = z.string()
  .min(1, 'User ID is required')
  .refine(
    (val) => isValidId(val) || val === 'default' || val === 'default-user-id',
    { message: 'Invalid user ID format.' }
  );

export const categoryIdSchema = idSchema('Category');
export const productIdSchema = idSchema('Product');
export const inventoryIdSchema = idSchema('Inventory');
export const notificationIdSchema = idSchema('Notification');
export const orderIdSchema = idSchema('Order');
export const cartIdSchema = idSchema('Cart');
export const customerIdSchema = idSchema('Customer');
export const supplierIdSchema = idSchema('Supplier');
export const providerIdSchema = idSchema('PaymentProvider');

// ============================================
// PAYMENT PROVIDER SCHEMAS - ✅ COMPLETE
// ============================================

export const createPaymentProviderSchema = z.object({
  provider: z.enum(['STRIPE', 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'LOYALTY_POINTS', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE']),
  name: z.string().min(1, 'Provider name is required'),
  code: z.string().min(1, 'Provider code is required').max(50),
  type: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']),
  isActive: z.boolean().default(true),
  isHealthy: z.boolean().default(true),
  configured: z.boolean().default(false),
  config: z.record(z.any()).optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  currencies: z.array(z.string().min(1)).default([]),
  settings: z.record(z.any()).optional(),
  order: z.number().int().min(0).default(0),
  paymentMethods: z.array(
    z.object({
      name: z.string().min(1),
      code: z.string().min(1).max(50),
      description: z.string().optional(),
      icon: z.string().optional(),
      isActive: z.boolean().default(true),
      requiresRedirect: z.boolean().default(false),
      isInstant: z.boolean().default(true),
      minAmount: z.number().min(0).optional(),
      maxAmount: z.number().min(0).optional(),
      feePercentage: z.number().min(0).max(100).optional(),
      feeFixed: z.number().min(0).optional(),
      order: z.number().int().min(0).default(0),
    })
  ).default([]),
});

export const updatePaymentProviderSchema = createPaymentProviderSchema.partial();

export const getPaymentProvidersQuerySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  search: z.string().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  isActive: z.boolean().optional(),
  type: z.enum(['ONLINE', 'OFFLINE', 'HYBRID']).optional(),
});

export const toggleProviderSchema = z.object({
  isActive: z.boolean(),
});

export const configureProviderSchema = z.object({
  config: z.record(z.any()),
  settings: z.record(z.any()).optional(),
});

export const updateProviderHealthSchema = z.object({
  isHealthy: z.boolean(),
});

export const createProviderCurrencySchema = z.object({
  currency: z.string().min(1),
  isActive: z.boolean().default(true),
  conversionRate: z.number().min(0).optional(),
});

export const createPaymentMethodConfigSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
  requiresRedirect: z.boolean().default(false),
  isInstant: z.boolean().default(true),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  feePercentage: z.number().min(0).max(100).optional(),
  feeFixed: z.number().min(0).optional(),
  order: z.number().int().min(0).default(0),
  businessUnitId: businessUnitIdSchema.optional(),
  providerId: providerIdSchema,
});

export const updatePaymentMethodConfigSchema = createPaymentMethodConfigSchema.partial();

// ============================================
// PAYMENT PROVIDER TYPE EXPORTS
// ============================================

export type CreatePaymentProviderInput = z.infer<typeof createPaymentProviderSchema>;
export type UpdatePaymentProviderInput = z.infer<typeof updatePaymentProviderSchema>;
export type GetPaymentProvidersQueryInput = z.infer<typeof getPaymentProvidersQuerySchema>;
export type ToggleProviderInput = z.infer<typeof toggleProviderSchema>;
export type ConfigureProviderInput = z.infer<typeof configureProviderSchema>;
export type UpdateProviderHealthInput = z.infer<typeof updateProviderHealthSchema>;
export type CreateProviderCurrencyInput = z.infer<typeof createProviderCurrencySchema>;
export type CreatePaymentMethodConfigInput = z.infer<typeof createPaymentMethodConfigSchema>;
export type UpdatePaymentMethodConfigInput = z.infer<typeof updatePaymentMethodConfigSchema>;

// ============================================
// PAYMENT PROVIDER VALIDATION CLASS
// ============================================

export class PaymentProviderValidation {
  static validateCreatePaymentProvider(data: unknown): CreatePaymentProviderInput {
    return createPaymentProviderSchema.parse(data);
  }
  
  static validateUpdatePaymentProvider(data: unknown): UpdatePaymentProviderInput {
    return updatePaymentProviderSchema.parse(data);
  }
  
  static validateGetPaymentProviders(data: unknown): GetPaymentProvidersQueryInput {
    return getPaymentProvidersQuerySchema.parse(data);
  }
  
  static validateToggleProvider(data: unknown): ToggleProviderInput {
    return toggleProviderSchema.parse(data);
  }
  
  static validateConfigureProvider(data: unknown): ConfigureProviderInput {
    return configureProviderSchema.parse(data);
  }
  
  static validateUpdateProviderHealth(data: unknown): UpdateProviderHealthInput {
    return updateProviderHealthSchema.parse(data);
  }
  
  static validateCreateProviderCurrency(data: unknown): CreateProviderCurrencyInput {
    return createProviderCurrencySchema.parse(data);
  }
  
  static validateCreatePaymentMethodConfig(data: unknown): CreatePaymentMethodConfigInput {
    return createPaymentMethodConfigSchema.parse(data);
  }
  
  static validateUpdatePaymentMethodConfig(data: unknown): UpdatePaymentMethodConfigInput {
    return updatePaymentMethodConfigSchema.parse(data);
  }
}

// ============================================
// AUTH SCHEMAS
// ============================================

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const verify2FASchema = z.object({
  code: z.string().min(6, '2FA code must be at least 6 characters'),
});

// ============================================
// SEARCH PARAMS
// ============================================

export const searchParamsSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  search: z.string().optional(),
  query: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

// ============================================
// USER SCHEMAS
// ============================================

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phoneNumber: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessUnitId: nullableUuidSchema,
  clerkId: z.string().optional(),
  companyId: companyIdSchema.optional(),
  permissions: z.array(z.string()).optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  businessUnitId: nullableUuidSchema,
  permissions: z.array(z.string()).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']),
});

export const updatePermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export const bulkActionSchema = z.object({
  ids: z.array(uuidSchema).min(1, 'At least one ID is required'),
});

export const userSearchSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  search: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'EDITOR', 'VIEWER', 'EMPLOYEE', 'CASHIER', 'USER']).optional(),
  isActive: z.boolean().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  companyId: companyIdSchema.optional(),
});

// ============================================
// PRODUCT SCHEMAS
// ============================================

export const createProductSchema = z.object({
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
  images: z.array(z.string().max(5000000, 'Image too large (max 5MB)')).max(10, 'Maximum 10 images allowed').default([]).optional(),
  attributes: z.record(z.any()).optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string().max(50)).default([]).optional(),
  seo: z.record(z.any()).optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  inventoryId: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  variants: z.array(
    z.object({
      name: z.string().min(1),
      sku: skuSchema.optional(),
      price: z.number().min(0).optional(),
      costPrice: z.number().min(0).optional(),
      stock: z.number().int().min(0).optional().default(0),
      images: z.array(z.string().max(5000000, 'Variant image too large (max 5MB)')).max(10, 'Maximum 10 images per variant allowed').default([]).optional(),
      attributes: z.record(z.any()).default({}).optional(),
      isActive: z.boolean().optional().default(true),
      barcode: z.string().optional(),
    })
  ).optional(),
}).refine(
  (data) => data.price !== undefined || data.unitPrice !== undefined,
  { message: 'Either price or unitPrice must be provided', path: ['price'] }
);

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
  images: z.array(z.string().max(5000000, 'Image too large (max 5MB)')).max(10, 'Maximum 10 images allowed').default([]).optional(),
  attributes: z.record(z.any()).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]).optional(),
  seo: z.record(z.any()).optional(),
  inventoryId: inventoryIdSchema.optional(),
  keepInventory: z.boolean().optional().default(true),
  variants: z.array(
    z.object({
      name: z.string().min(1).optional(),
      sku: skuSchema.optional(),
      price: z.number().min(0).optional(),
      costPrice: z.number().min(0).optional(),
      stock: z.number().int().min(0).optional(),
      images: z.array(z.string().max(5000000, 'Variant image too large (max 5MB)')).max(10, 'Maximum 10 images per variant allowed').default([]).optional(),
      attributes: z.record(z.any()).optional(),
      isActive: z.boolean().optional(),
      barcode: z.string().optional(),
    })
  ).optional(),
});

// ============================================
// VARIANT SCHEMAS
// ============================================

export const createVariantSchema = z.object({
  name: z.string().min(1, 'Variant name is required'),
  sku: skuSchema.optional(),
  price: z.number().min(0).optional(),
  costPrice: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional().default(0),
  images: z.array(z.string().max(5000000, 'Variant image too large (max 5MB)')).max(10, 'Maximum 10 images allowed').default([]).optional(),
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
  images: z.array(z.string().max(5000000, 'Variant image too large (max 5MB)')).max(10, 'Maximum 10 images allowed').default([]).optional(),
  attributes: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
  barcode: z.string().optional(),
  inventoryId: z.string().optional().nullable(),
});

export const bulkCreateVariantsSchema = z.object({
  variants: z.array(createVariantSchema).min(1, 'At least one variant is required'),
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
  businessUnitId: businessUnitIdSchema.optional(),
});

// ============================================
// SKU CHECK SCHEMA
// ============================================

export const checkSkuSchema = z.object({
  sku: skuSchema,
  businessUnitId: businessUnitIdSchema.optional(),
  excludeProductId: productIdSchema.optional(),
});

// ============================================
// PRODUCT REVIEW SCHEMAS
// ============================================

export const createProductReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
  isVerified: z.boolean().default(false),
  images: z.array(z.string()).default([]).optional(),
});

export const updateProductReviewSchema = createProductReviewSchema.partial();

// ============================================
// PRODUCT BULK SCHEMAS
// ============================================

export const bulkCreateProductsSchema = z.object({
  products: z.array(
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
      images: z.array(z.string().max(5000000, 'Image too large (max 5MB)')).max(10, 'Maximum 10 images allowed').default([]).optional(),
      attributes: z.record(z.any()).optional(),
      notes: z.string().optional(),
      barcode: z.string().optional(),
      inventoryId: inventoryIdSchema.optional(),
      variants: z.array(createVariantSchema).optional(),
    })
  ).min(1, 'At least one product is required'),
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
  updates: z.array(
    z.object({
      id: productIdSchema,
      price: z.number().min(0),
    })
  ).min(1),
});

// ============================================
// BARCODE SCHEMAS
// ============================================

export const generateBarcodeSchema = z.object({
  prefix: z.string().optional().default('PRD'),
  length: z.number().int().min(8).max(20).optional().default(12),
  format: z.enum(['EAN-13', 'UPC-A', 'CODE128', 'QR']).optional().default('EAN-13'),
  includeQR: z.boolean().optional().default(true),
  productName: z.string().optional(),
  sku: z.string().optional(),
});

export const associateBarcodeSchema = z.object({
  barcode: z.string().min(4).max(50),
});

export const validateBarcodeSchema = z.object({
  barcode: z.string().min(4).max(50),
  excludeProductId: productIdSchema.optional(),
});

export const scanBarcodeSchema = z.object({
  barcode: z.string().min(1),
  businessUnitId: businessUnitIdSchema.optional(),
});

export const bulkGenerateBarcodesSchema = z.object({
  productIds: z.array(productIdSchema).min(1),
  options: generateBarcodeSchema.optional(),
});

export const generateBarcodeImageSchema = z.object({
  barcode: z.string().min(1),
  format: z.enum(['EAN-13', 'UPC-A', 'CODE128']).optional().default('EAN-13'),
});

export const generateQRCodeSchema = z.object({
  data: z.any().refine((val) => val !== null && val !== undefined),
});

// ============================================
// CATEGORY SCHEMAS
// ============================================

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional().nullable(),
  parentId: categoryIdSchema.nullable().optional(),
  businessUnitId: businessUnitIdSchema,
  isActive: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
});

export const updateCategorySchema = createCategorySchema.partial();

// ============================================
// SUPPLIER SCHEMAS
// ============================================

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  contactPerson: z.string().optional().nullable(),
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  website: z.string().url('Invalid URL format').optional().nullable(),
  notes: z.string().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  isActive: z.boolean().default(true),
  companyId: z.string().min(1, 'Company ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  paymentTerms: z.string().optional().nullable(),
  deliveryTerms: z.string().optional().nullable(),
  creditLimit: z.number().min(0).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

// ============================================
// INVENTORY SCHEMAS
// ============================================

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
  images: z.array(z.string().max(5000000, 'Image too large (max 5MB)')).max(10, 'Maximum 10 images allowed').default([]).optional(),
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
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  search: z.string().optional(),
  lowStock: z.string().optional().transform(val => val === 'true'),
  productId: productIdSchema.optional(),
  category: z.string().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  businessUnitId: z.string().optional(),
});

export const listIssuesQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 10),
  productId: productIdSchema.optional(),
  issuedTo: z.string().optional(),
  status: z.string().optional(),
});

export const bulkCreateItemsSchema = z.object({
  items: z.array(createItemSchema).min(1),
});

export const bulkUpdateStockSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().min(1),
      quantity: z.number().min(0),
      notes: z.string().optional(),
      transactionType: z.enum(['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'INITIAL', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']).optional(),
      variantId: z.string().optional(),
    })
  ).min(1),
});

// ============================================
// SALE SCHEMAS
// ============================================

export const createSaleSchema = z.object({
  items: z.array(z.object({
    productId: productIdSchema,
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    notes: z.string().optional(),
  })),
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'CHECK', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE']),
  paidAmount: z.number().positive(),
  discount: z.number().min(0).default(0),
  taxRate: z.number().min(0).optional(),
  notes: z.string().optional(),
  businessUnitId: businessUnitIdSchema,
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
});

// ============================================
// CHECKOUT SCHEMAS
// ============================================

export const createCheckoutSchema = z.object({
  cartId: z.string().min(1, 'Cart ID is required'),
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'LOYALTY_POINTS', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE']),
  paidAmount: z.number().positive('Paid amount must be positive'),
  discount: z.number().min(0, 'Discount cannot be negative').optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  applyLoyaltyPoints: z.boolean().default(false),
  businessUnitId: z.string().optional(),
  customerEmail: z.string().email('Invalid email format').optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  cardNonce: z.string().optional(), // For Square
});

export const getCheckoutsSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional().default('saleDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const getCheckoutHistorySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  status: z.string().optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export const updateCheckoutSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'VOIDED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL']).optional(),
  notes: z.string().optional(),
});

export const processPaymentSchema = z.object({
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'LOYALTY_POINTS', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE']),
  amount: z.number().positive('Amount must be positive'),
  paymentDetails: z.record(z.string(), z.any()).optional(),
});

export const cancelCheckoutSchema = z.object({
  reason: z.string().optional(),
});

export const voidCheckoutSchema = z.object({
  reason: z.string().optional(),
});

export const addCheckoutItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPrice: z.number().positive('Unit price must be positive'),
});

export const updateCheckoutItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be positive'),
});

export const applyDiscountSchema = z.object({
  code: z.string().min(1, 'Discount code is required'),
});

export const emailReceiptSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
});

export const exportCheckoutsSchema = z.object({
  format: z.enum(['csv', 'json', 'excel', 'pdf']).optional().default('csv'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  businessUnitId: z.string().optional(),
  status: z.string().optional(),
});

export const getCheckoutStatsSchema = z.object({
  range: z.enum(['today', 'week', 'month', 'quarter', 'year', 'custom']).optional().default('month'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  businessUnitId: z.string().optional(),
});

export const updateCheckoutSettingsSchema = z.object({
  allowPartialPayment: z.boolean().optional(),
  requireCustomer: z.boolean().optional(),
  requireSignature: z.boolean().optional(),
  maxDiscount: z.number().min(0).optional(),
  taxInclusive: z.boolean().optional(),
  defaultPaymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'LOYALTY_POINTS', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE']).optional(),
  receiptFooter: z.string().optional(),
  loyaltyPointsEnabled: z.boolean().optional(),
  pointsPerDollar: z.number().min(0).optional(),
  allowGuestCheckout: z.boolean().optional(),
  maxCartItems: z.number().int().min(1).optional(),
  cartExpiryHours: z.number().int().min(1).optional(),
  discountEnabled: z.boolean().optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  autoApplyPromotions: z.boolean().optional(),
  reserveStockOnAdd: z.boolean().optional(),
  reserveStockMinutes: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notifyOnAbandonedCart: z.boolean().optional(),
  abandonedCartHours: z.number().int().min(1).optional(),
  currencyCode: z.string().optional(),
  currencySymbol: z.string().optional(),
  showStockBadge: z.boolean().optional(),
  showVariantImages: z.boolean().optional(),
});

// ============================================
// ORDER SCHEMAS
// ============================================

export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: productIdSchema,
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    notes: z.string().optional(),
  })),
  customerId: z.string().optional(),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).optional(),
  notes: z.string().optional(),
  businessUnitId: businessUnitIdSchema,
  expectedDeliveryDate: z.string().optional(),
  shippingAddress: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentTerms: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ON_HOLD']),
  notes: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  shippingAddress: z.string().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ON_HOLD']),
  notes: z.string().optional(),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(1),
});

export const addOrderItemSchema = z.object({
  productId: productIdSchema,
  variantId: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
});

export const updateOrderItemSchema = z.object({
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  notes: z.string().optional(),
});

export const bulkUpdateOrderStatusSchema = z.object({
  orderIds: z.array(orderIdSchema).min(1),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'ON_HOLD']),
  notes: z.string().optional(),
});

// ============================================
// CART SCHEMAS
// ============================================

export const addCartItemSchema = z.object({
  productId: z.string()
    .min(1, 'Product ID is required')
    .max(255, 'Product ID is too long')
    .refine(
      (val) => {
        const trimmed = val.trim();
        return trimmed.length > 0 && !trimmed.includes(' ');
      },
      { message: 'Invalid product ID format' }
    ),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be positive').default(1),
  notes: z.string().optional(),
});

export const addMultipleCartItemsSchema = z.object({
  items: z.array(addCartItemSchema).min(1),
});

export const updateCartItemQuantitySchema = z.object({
  quantity: z.number().int().min(0),
});

export const updateCartSettingsSchema = z.object({
  allowGuestCheckout: z.boolean().optional(),
  requireCustomerForReturn: z.boolean().optional(),
  maxCartItems: z.number().int().min(1).max(1000).optional(),
  cartExpiryHours: z.number().int().min(1).max(720).optional(),
  discountEnabled: z.boolean().optional(),
  maxDiscountPercentage: z.number().min(0).max(100).optional(),
  maxDiscountAmount: z.number().min(0).optional(),
  autoApplyPromotions: z.boolean().optional(),
  loyaltyPointsEnabled: z.boolean().optional(),
  pointsPerDollar: z.number().int().min(0).max(1000).optional(),
  minPointsForRedeem: z.number().int().min(0).optional(),
  maxPointsPerOrder: z.number().int().min(0).optional(),
  reserveStockOnAdd: z.boolean().optional(),
  reserveStockMinutes: z.number().int().min(0).max(1440).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  defaultPaymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'LOYALTY_POINTS', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE']).optional(),
  allowPartialPayment: z.boolean().optional(),
  requireSignature: z.boolean().optional(),
  taxInclusive: z.boolean().optional(),
  freeShippingThreshold: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  notifyOnAbandonedCart: z.boolean().optional(),
  abandonedCartHours: z.number().int().min(1).max(720).optional(),
  notifyOnLowStock: z.boolean().optional(),
  currencyCode: z.string().optional(),
  currencySymbol: z.string().optional(),
  showStockBadge: z.boolean().optional(),
  showVariantImages: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const applyCartDiscountSchema = z.object({
  discount: z.number().min(0),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().default('FIXED'),
});

export const applyCartPromotionSchema = z.object({
  promotionCode: z.string().min(1),
});

export const applyLoyaltyPointsSchema = z.object({
  customerId: customerIdSchema,
  points: z.number().int().positive(),
});

export const associateCustomerSchema = z.object({
  customerId: customerIdSchema,
});

export const updateCartNotesSchema = z.object({
  notes: z.string().optional(),
});

export const cartCheckoutSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE']),
  paidAmount: z.number().positive(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  notes: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
  cardNonce: z.string().optional(), // For Square
});

export const transferCartSchema = z.object({
  fromUserId: userIdSchema,
  toUserId: userIdSchema,
});

export const splitCartSchema = z.object({
  items: z.array(z.object({
    cartItemId: z.string().min(1),
    quantity: z.number().int().positive(),
    targetUserId: userIdSchema,
  })).min(1),
});

// ============================================
// PAYMENT SCHEMAS
// ============================================

export const createPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'GIFT_CARD', 'CHECK', 'PAYPAL', 'FLUTTERWAVE', 'PAYSTACK', 'SQUARE']),
  saleId: z.string().optional(),
  orderId: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
  cashRegisterId: z.string().optional(),
  cashRegisterSessionId: z.string().optional(),
  gatewayId: z.string().optional(),
  customerId: z.string().optional(),
  source: z.string().optional(),
  currency: z.string().optional(),
  tipAmount: z.number().min(0).optional(),
  description: z.string().optional(),
  cardNonce: z.string().optional(), // For Square
});

// ============================================
// BUSINESS UNIT SCHEMAS
// ============================================

export const createBusinessUnitSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  companyId: z.string().min(1),
  isActive: z.boolean().optional(),
  type: z.enum(['HEADQUARTERS', 'BRANCH', 'WAREHOUSE', 'STORE']).optional(),
});

export const updateBusinessUnitSchema = createBusinessUnitSchema.partial();

// ============================================
// CUSTOMER SCHEMAS
// ============================================

export const createCustomerSchema = z.object({
  email: z.string().email(),
  phoneNumber: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  companyId: companyIdSchema,
});

export const updateCustomerSchema = createCustomerSchema.partial();

// ============================================
// REPORT SCHEMAS
// ============================================

export const reportParamsSchema = z.object({
  businessUnitId: businessUnitIdSchema.optional(),
  startDate: z.string().transform(str => new Date(str)).optional(),
  endDate: z.string().transform(str => new Date(str)).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional(),
  userId: userIdSchema.optional(),
  includeVariants: z.string().transform(val => val === 'true').optional(),
  lowStockOnly: z.string().transform(val => val === 'true').optional(),
  companyId: companyIdSchema.optional(),
  minSpent: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
});

// ============================================
// PURCHASE ORDER SCHEMAS
// ============================================

export const createPurchaseOrderSchema = z.object({
  supplierId: supplierIdSchema,
  items: z.array(z.object({
    productId: productIdSchema,
    variantId: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
  notes: z.string().optional(),
  expectedDelivery: z.string().datetime().optional(),
  businessUnitId: businessUnitIdSchema,
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

export const receivePurchaseOrderSchema = z.object({
  receivedQuantities: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.number().int().positive(),
  })).min(1),
});

// ============================================
// SHIFT SCHEMAS
// ============================================

export const startShiftSchema = z.object({
  cashRegisterId: z.string().min(1),
  startingBalance: z.number().min(0),
  notes: z.string().optional(),
});

export const endShiftSchema = z.object({
  endingBalance: z.number().min(0),
  notes: z.string().optional(),
});

// ============================================
// TAX SCHEMAS
// ============================================

export const taxSummarySchema = z.object({
  businessUnitId: businessUnitIdSchema,
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

// ============================================
// REORDER SCHEMAS
// ============================================

export const createReorderSchema = z.object({
  productId: productIdSchema,
  quantity: z.number().int().positive().optional(),
  supplierId: supplierIdSchema.optional(),
  notes: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
});

// ============================================
// STOCK COUNT SCHEMAS
// ============================================

export const stockCountSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  expectedItems: z.number().min(0).default(0),
});

export const updateStockCountSchema = stockCountSchema.partial();

export const completeStockCountSchema = z.object({
  countedItems: z.record(z.string(), z.number()),
  notes: z.string().optional(),
});

// ============================================
// VALUATION SCHEMAS
// ============================================

export const valuationQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  categoryId: categoryIdSchema.optional(),
  method: z.enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE']).default('WEIGHTED_AVERAGE'),
});

// ============================================
// AUDIT LOG SCHEMAS
// ============================================

export const auditLogQuerySchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? parseInt(val) : 20),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

// ============================================
// EXPORT/IMPORT SCHEMAS
// ============================================

export const exportSalesSchema = z.object({
  businessUnitId: businessUnitIdSchema,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

export const exportInventorySchema = z.object({
  businessUnitId: businessUnitIdSchema,
  format: z.enum(['csv', 'excel', 'json', 'pdf', 'html']).default('csv'),
});

export const importOptionsSchema = z.object({
  businessUnitId: businessUnitIdSchema.optional(),
  companyId: companyIdSchema.optional(),
  skipDuplicates: z.boolean().default(true),
  updateExisting: z.boolean().default(false),
});

// ============================================
// NOTIFICATION SCHEMAS
// ============================================

export const createNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().min(1),
  link: z.string().url('Invalid URL format').optional().nullable(),
  data: z.record(z.any()).optional(),
  userId: userIdSchema.optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  companyId: companyIdSchema.optional(),
});

export const updateNotificationSchema = z.object({
  title: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  type: z.string().optional(),
  isRead: z.boolean().optional(),
});

export const bulkCreateNotificationsSchema = z.object({
  notifications: z.array(createNotificationSchema).min(1),
});

export const markReadSchema = z.object({
  ids: z.array(notificationIdSchema).min(1),
});

export const notificationPreferencesSchema = z.object({
  email: z.boolean().default(true),
  push: z.boolean().default(true),
  inApp: z.boolean().default(true),
  types: z.record(z.boolean()).default({}),
});

export const updatePreferencesSchema = notificationPreferencesSchema.partial();

export const notificationQuerySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  unreadOnly: z.string().transform(val => val === 'true').optional(),
  type: z.string().optional(),
  search: z.string().optional(),
});

// ============================================
// LEGACY SCHEMAS (Backward Compatibility)
// ============================================

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
  businessUnitId: businessUnitIdSchema.optional(),
  description: z.string().optional(),
});

export const updateInventorySchema = z.object({
  stock: z.number().nonnegative(),
  quantity: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  variantId: z.string().optional(),
  transactionType: z.enum(['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER', 'INITIAL']).default('ADJUSTMENT'),
});

export const updateStockSchema = z.object({
  quantity: z.number().min(0),
  stock: z.number().min(0).optional(),
  notes: z.string().optional(),
  reference: z.string().optional(),
  variantId: z.string().optional(),
  transactionType: z.enum(['ADJUSTMENT', 'SALE', 'RETURN', 'PURCHASE', 'INITIAL', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']).optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

export const legacyBulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().min(1),
      quantity: z.number().nonnegative().default(0),
      notes: z.string().optional(),
      transactionType: z.enum(['PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'INITIAL', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']).optional(),
      variantId: z.string().optional(),
    })
  ).min(1),
});

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

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// ============================================

export const bulkUpdateSchema = legacyBulkUpdateSchema;

// ============================================
// AUTH SCHEMAS (for controller)
// ============================================

export const authSchemas = {
  register: registerSchema,
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  verifyEmail: verifyEmailSchema,
  resendVerification: resendVerificationSchema,
  verify2FA: verify2FASchema,
};

// ============================================
// CART EXPORT SCHEMAS
// ============================================

export const exportAnalyticsSchema = z.object({
  format: z.enum(['csv', 'excel', 'json', 'pdf']).default('csv'),
  metrics: z.array(z.string()).default([]),
  dateRange: z.enum(['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'custom']).default('week'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeCharts: z.boolean().default(false),
  includeSummary: z.boolean().default(true),
  includeDetailedData: z.boolean().default(true),
});

export const exportHistorySchema = z.object({
  format: z.enum(['csv', 'excel', 'json', 'pdf']).default('csv'),
  dateRange: z.enum(['today', 'yesterday', 'week', 'month', 'quarter', 'year', 'all']).default('week'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  includeItems: z.boolean().default(true),
});

export const exportAbandonedSchema = z.object({
  format: z.enum(['csv', 'excel', 'json', 'pdf']).default('csv'),
  hours: z.number().int().min(1).max(720).default(24),
  minValue: z.number().min(0).optional(),
  status: z.string().optional(),
  includeCustomerDetails: z.boolean().default(true),
});

// ============================================
// ABANDONED CART SCHEMAS
// ============================================

export const abandonedCartsQuerySchema = z.object({
  hours: z.string().transform(Number).optional().default('24'),
  minValue: z.string().transform(Number).optional(),
  status: z.string().optional(),
  page: z.string().transform(Number).optional().default('1'),
  limit: z.string().transform(Number).optional().default('20'),
  search: z.string().optional(),
  dateRange: z.string().optional(),
});

export const recoverCartSchema = z.object({
  cartId: cartIdSchema,
  notifyUser: z.boolean().default(true),
  message: z.string().optional(),
});

export const sendReminderSchema = z.object({
  cartId: cartIdSchema,
  message: z.string().optional(),
  email: z.string().email().optional(),
});

// ============================================
// NEW PROVIDER-SPECIFIC SCHEMAS
// ============================================

/**
 * PayPal capture schema
 */
export const payPalCaptureSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

/**
 * Flutterwave virtual account schema
 */
export const flutterwaveVirtualAccountSchema = z.object({
  email: z.string().email('Valid email is required'),
  amount: z.number().positive('Amount must be positive').optional(),
  currency: z.string().optional(),
  customerName: z.string().optional(),
});

/**
 * Paystack verification schema
 */
export const paystackVerifySchema = z.object({
  reference: z.string().min(1, 'Reference is required'),
});

/**
 * Square payment schema
 */
export const squarePaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  cardNonce: z.string().min(1, 'Card nonce is required'),
  currency: z.string().optional(),
  customerId: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Square customer schema
 */
export const squareCustomerSchema = z.object({
  email: z.string().email('Valid email is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
});

// ============================================
// EXPORT ALL SCHEMAS - UPDATED WITH PAYMENT PROVIDER SCHEMAS
// ============================================

export const validate = {
  // Auth schemas
  register: registerSchema,
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  verifyEmail: verifyEmailSchema,
  resendVerification: resendVerificationSchema,
  verify2FA: verify2FASchema,
  
  // User schemas
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  updateUserRole: updateUserRoleSchema,
  updatePermissions: updatePermissionsSchema,
  bulkAction: bulkActionSchema,
  userSearch: userSearchSchema,
  
  // Payment Provider schemas
  createPaymentProvider: createPaymentProviderSchema,
  updatePaymentProvider: updatePaymentProviderSchema,
  getPaymentProviders: getPaymentProvidersQuerySchema,
  toggleProvider: toggleProviderSchema,
  configureProvider: configureProviderSchema,
  updateProviderHealth: updateProviderHealthSchema,
  createProviderCurrency: createProviderCurrencySchema,
  createPaymentMethodConfig: createPaymentMethodConfigSchema,
  updatePaymentMethodConfig: updatePaymentMethodConfigSchema,
  
  // Provider-specific schemas
  payPalCapture: payPalCaptureSchema,
  flutterwaveVirtualAccount: flutterwaveVirtualAccountSchema,
  paystackVerify: paystackVerifySchema,
  squarePayment: squarePaymentSchema,
  squareCustomer: squareCustomerSchema,
  
  // Inventory schemas
  createItem: createItemSchema,
  updateItem: updateItemSchema,
  issueItem: issueItemSchema,
  returnItem: returnItemSchema,
  restockItem: restockItemSchema,
  listItems: listItemsQuerySchema,
  listIssues: listIssuesQuerySchema,
  bulkCreateItems: bulkCreateItemsSchema,
  bulkUpdateStock: bulkUpdateStockSchema,
  
  // Product schemas
  createProduct: createProductSchema,
  updateProduct: updateProductSchema,
  createInventory: createInventorySchema,
  updateInventory: updateInventorySchema,
  updateStock: updateStockSchema,
  bulkUpdate: legacyBulkUpdateSchema,
  searchProducts: searchProductsSchema,
  reserveStock: reserveStockSchema,
  
  // Sale schemas
  createSale: createSaleSchema,
  createPayment: createPaymentSchema,
  
  // Checkout schemas
  createCheckout: createCheckoutSchema,
  getCheckouts: getCheckoutsSchema,
  getCheckoutHistory: getCheckoutHistorySchema,
  updateCheckout: updateCheckoutSchema,
  processPayment: processPaymentSchema,
  cancelCheckout: cancelCheckoutSchema,
  voidCheckout: voidCheckoutSchema,
  addCheckoutItem: addCheckoutItemSchema,
  updateCheckoutItem: updateCheckoutItemSchema,
  applyDiscount: applyDiscountSchema,
  emailReceipt: emailReceiptSchema,
  exportCheckouts: exportCheckoutsSchema,
  getCheckoutStats: getCheckoutStatsSchema,
  updateCheckoutSettings: updateCheckoutSettingsSchema,
  
  // Customer schemas
  createCustomer: createCustomerSchema,
  updateCustomer: updateCustomerSchema,
  
  // Category schemas
  createCategory: createCategorySchema,
  updateCategory: updateCategorySchema,
  
  // Order schemas
  createOrder: createOrderSchema,
  updateOrder: updateOrderSchema,
  updateOrderStatus: updateOrderStatusSchema,
  cancelOrder: cancelOrderSchema,
  addOrderItem: addOrderItemSchema,
  updateOrderItem: updateOrderItemSchema,
  bulkUpdateOrderStatus: bulkUpdateOrderStatusSchema,
  
  // Business Unit schemas
  createBusinessUnit: createBusinessUnitSchema,
  updateBusinessUnit: updateBusinessUnitSchema,
  
  // Supplier schemas
  createSupplier: createSupplierSchema,
  updateSupplier: updateSupplierSchema,
  
  // Purchase Order schemas
  createPurchaseOrder: createPurchaseOrderSchema,
  receivePurchaseOrder: receivePurchaseOrderSchema,
  
  // Shift schemas
  startShift: startShiftSchema,
  endShift: endShiftSchema,
  
  // Tax schemas
  taxSummary: taxSummarySchema,
  
  // Product Review schemas
  createProductReview: createProductReviewSchema,
  updateProductReview: updateProductReviewSchema,
  
  // Bulk Product schemas
  bulkCreateProducts: bulkCreateProductsSchema,
  bulkDeleteProducts: bulkDeleteProductsSchema,
  bulkActivateProducts: bulkActivateProductsSchema,
  bulkDeactivateProducts: bulkDeactivateProductsSchema,
  bulkUpdatePrices: bulkUpdatePricesSchema,
  
  // Stock Count schemas
  stockCount: stockCountSchema,
  updateStockCount: updateStockCountSchema,
  completeStockCount: completeStockCountSchema,
  
  // Valuation schemas
  valuationQuery: valuationQuerySchema,
  
  // Audit Log schemas
  auditLogQuery: auditLogQuerySchema,
  
  // Reorder schemas
  createReorder: createReorderSchema,
  
  // Export/Import schemas
  exportSales: exportSalesSchema,
  exportInventory: exportInventorySchema,
  importOptions: importOptionsSchema,
  
  // Variant schemas
  createVariant: createVariantSchema,
  updateVariant: updateVariantSchema,
  bulkCreateVariants: bulkCreateVariantsSchema,
  updateVariantStock: updateVariantStockSchema,
  variantQuery: variantQuerySchema,
  
  // SKU schemas
  checkSku: checkSkuSchema,
  
  // Cart schemas
  addCartItem: addCartItemSchema,
  addMultipleCartItems: addMultipleCartItemsSchema,
  updateCartItemQuantity: updateCartItemQuantitySchema,
  applyCartDiscount: applyCartDiscountSchema,
  applyCartPromotion: applyCartPromotionSchema,
  applyLoyaltyPoints: applyLoyaltyPointsSchema,
  associateCustomer: associateCustomerSchema,
  updateCartNotes: updateCartNotesSchema,
  cartCheckout: cartCheckoutSchema,
  transferCart: transferCartSchema,
  splitCart: splitCartSchema,
  
  // Barcode schemas
  generateBarcode: generateBarcodeSchema,
  associateBarcode: associateBarcodeSchema,
  validateBarcode: validateBarcodeSchema,
  scanBarcode: scanBarcodeSchema,
  bulkGenerateBarcodes: bulkGenerateBarcodesSchema,
  generateBarcodeImage: generateBarcodeImageSchema,
  generateQRCode: generateQRCodeSchema,
  
  // Notification schemas
  createNotification: createNotificationSchema,
  updateNotification: updateNotificationSchema,
  bulkCreateNotifications: bulkCreateNotificationsSchema,
  markRead: markReadSchema,
  notificationPreferences: notificationPreferencesSchema,
  updatePreferences: updatePreferencesSchema,
  notificationQuery: notificationQuerySchema,
  
  // Cart Settings schemas
  updateCartSettings: updateCartSettingsSchema,
  
  // Export schemas
  exportAnalytics: exportAnalyticsSchema,
  exportHistory: exportHistorySchema,
  exportAbandoned: exportAbandonedSchema,
  
  // Abandoned Cart schemas
  abandonedCartsQuery: abandonedCartsQuerySchema,
  recoverCart: recoverCartSchema,
  sendReminder: sendReminderSchema,
  
  // Search schemas
  searchParams: searchParamsSchema,
  reportParams: reportParamsSchema,
};

// ============================================
// SCHEMA ALIAS EXPORTS
// ============================================

export {
  generateBarcodeSchema as barcodeGenerateSchema,
  associateBarcodeSchema as barcodeAssociateSchema,
  validateBarcodeSchema as barcodeValidateSchema,
  scanBarcodeSchema as barcodeScanSchema,
  bulkGenerateBarcodesSchema as barcodeBulkGenerateSchema,
  generateBarcodeImageSchema as barcodeImageSchema,
  generateQRCodeSchema as qrCodeSchema,
};

export {
  createNotificationSchema as notificationCreateSchema,
  updateNotificationSchema as notificationUpdateSchema,
  bulkCreateNotificationsSchema as notificationBulkCreateSchema,
  markReadSchema as notificationMarkReadSchema,
  updatePreferencesSchema as notificationUpdatePreferencesSchema,
};

export {
  createVariantSchema as variantCreateSchema,
  updateVariantSchema as variantUpdateSchema,
  bulkCreateVariantsSchema as variantBulkCreateSchema,
  updateVariantStockSchema as variantUpdateStockSchema,
};

export {
  createOrderSchema as orderCreateSchema,
  updateOrderSchema as orderUpdateSchema,
  updateOrderStatusSchema as orderUpdateStatusSchema,
  cancelOrderSchema as orderCancelSchema,
  addOrderItemSchema as orderAddItemSchema,
  updateOrderItemSchema as orderUpdateItemSchema,
  bulkUpdateOrderStatusSchema as orderBulkUpdateStatusSchema,
};

export {
  addCartItemSchema as cartAddItemSchema,
  addMultipleCartItemsSchema as cartAddMultipleItemsSchema,
  updateCartItemQuantitySchema as cartUpdateItemQuantitySchema,
  applyCartDiscountSchema as cartApplyDiscountSchema,
  applyCartPromotionSchema as cartApplyPromotionSchema,
  applyLoyaltyPointsSchema as cartApplyLoyaltyPointsSchema,
  associateCustomerSchema as cartAssociateCustomerSchema,
  updateCartNotesSchema as cartUpdateNotesSchema,
  transferCartSchema as cartTransferSchema,
  splitCartSchema as cartSplitSchema,
  exportAnalyticsSchema as analyticsExportSchema,
  exportHistorySchema as historyExportSchema,
  exportAbandonedSchema as abandonedExportSchema,
};

// ============================================
// PAYMENT PROVIDER SCHEMA ALIAS EXPORTS
// ============================================

export {
  createPaymentProviderSchema as paymentProviderCreateSchema,
  updatePaymentProviderSchema as paymentProviderUpdateSchema,
  getPaymentProvidersQuerySchema as paymentProviderQuerySchema,
  toggleProviderSchema as paymentProviderToggleSchema,
  configureProviderSchema as paymentProviderConfigureSchema,
  updateProviderHealthSchema as paymentProviderHealthSchema,
  createProviderCurrencySchema as providerCurrencyCreateSchema,
  createPaymentMethodConfigSchema as paymentMethodConfigCreateSchema,
  updatePaymentMethodConfigSchema as paymentMethodConfigUpdateSchema,
};

// ============================================
// PROVIDER-SPECIFIC ALIAS EXPORTS
// ============================================

export {
  payPalCaptureSchema as payPalCapture,
  flutterwaveVirtualAccountSchema as flutterwaveVirtualAccount,
  paystackVerifySchema as paystackVerify,
  squarePaymentSchema as squarePayment,
  squareCustomerSchema as squareCustomer,
};

// ============================================
// CHECKOUT SCHEMA ALIAS EXPORTS
// ============================================

export {
  createCheckoutSchema as checkoutCreateSchema,
  getCheckoutsSchema as checkoutGetSchema,
  getCheckoutHistorySchema as checkoutHistorySchema,
  updateCheckoutSchema as checkoutUpdateSchema,
  processPaymentSchema as checkoutPaymentSchema,
  cancelCheckoutSchema as checkoutCancelSchema,
  voidCheckoutSchema as checkoutVoidSchema,
  addCheckoutItemSchema as checkoutAddItemSchema,
  updateCheckoutItemSchema as checkoutUpdateItemSchema,
  applyDiscountSchema as checkoutApplyDiscountSchema,
  emailReceiptSchema as checkoutEmailReceiptSchema,
  exportCheckoutsSchema as checkoutExportSchema,
  getCheckoutStatsSchema as checkoutStatsSchema,
  updateCheckoutSettingsSchema as checkoutSettingsUpdateSchema,
};

// ============================================
// TYPE EXPORTS
// ============================================

export type CreateItemDto = z.infer<typeof createItemSchema>;
export type UpdateItemDto = z.infer<typeof updateItemSchema>;
export type IssueItemDto = z.infer<typeof issueItemSchema>;
export type ReturnItemDto = z.infer<typeof returnItemSchema>;
export type RestockItemDto = z.infer<typeof restockItemSchema>;
export type ListItemsQueryDto = z.infer<typeof listItemsQuerySchema>;
export type ListIssuesQueryDto = z.infer<typeof listIssuesQuerySchema>;
export type BulkCreateItemsDto = z.infer<typeof bulkCreateItemsSchema>;
export type BulkUpdateStockDto = z.infer<typeof bulkUpdateStockSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type CreateReorderInput = z.infer<typeof createReorderSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdatePermissionsInput = z.infer<typeof updatePermissionsSchema>;

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type BulkCreateVariantsInput = z.infer<typeof bulkCreateVariantsSchema>;
export type UpdateVariantStockInput = z.infer<typeof updateVariantStockSchema>;
export type VariantQueryInput = z.infer<typeof variantQuerySchema>;
export type CheckSkuInput = z.infer<typeof checkSkuSchema>;

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type AddOrderItemInput = z.infer<typeof addOrderItemSchema>;
export type UpdateOrderItemInput = z.infer<typeof updateOrderItemSchema>;
export type BulkUpdateOrderStatusInput = z.infer<typeof bulkUpdateOrderStatusSchema>;

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;
export type AddMultipleCartItemsInput = z.infer<typeof addMultipleCartItemsSchema>;
export type UpdateCartItemQuantityInput = z.infer<typeof updateCartItemQuantitySchema>;
export type ApplyCartDiscountInput = z.infer<typeof applyCartDiscountSchema>;
export type ApplyCartPromotionInput = z.infer<typeof applyCartPromotionSchema>;
export type ApplyLoyaltyPointsInput = z.infer<typeof applyLoyaltyPointsSchema>;
export type AssociateCustomerInput = z.infer<typeof associateCustomerSchema>;
export type UpdateCartNotesInput = z.infer<typeof updateCartNotesSchema>;
export type CartCheckoutInput = z.infer<typeof cartCheckoutSchema>;
export type TransferCartInput = z.infer<typeof transferCartSchema>;
export type SplitCartInput = z.infer<typeof splitCartSchema>;
export type ExportAnalyticsInput = z.infer<typeof exportAnalyticsSchema>;
export type ExportHistoryInput = z.infer<typeof exportHistorySchema>;
export type ExportAbandonedInput = z.infer<typeof exportAbandonedSchema>;
export type AbandonedCartsQueryInput = z.infer<typeof abandonedCartsQuerySchema>;
export type RecoverCartInput = z.infer<typeof recoverCartSchema>;
export type SendReminderInput = z.infer<typeof sendReminderSchema>;

export type GenerateBarcodeInput = z.infer<typeof generateBarcodeSchema>;
export type AssociateBarcodeInput = z.infer<typeof associateBarcodeSchema>;
export type ValidateBarcodeInput = z.infer<typeof validateBarcodeSchema>;
export type ScanBarcodeInput = z.infer<typeof scanBarcodeSchema>;
export type BulkGenerateBarcodesInput = z.infer<typeof bulkGenerateBarcodesSchema>;
export type GenerateBarcodeImageInput = z.infer<typeof generateBarcodeImageSchema>;

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
export type BulkCreateNotificationsInput = z.infer<typeof bulkCreateNotificationsSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ============================================
// PAYMENT PROVIDER TYPE EXPORTS
// ============================================

// Note: These are already exported above. Do not duplicate.

// ============================================
// PROVIDER-SPECIFIC TYPE EXPORTS
// ============================================

export type PayPalCaptureInput = z.infer<typeof payPalCaptureSchema>;
export type FlutterwaveVirtualAccountInput = z.infer<typeof flutterwaveVirtualAccountSchema>;
export type PaystackVerifyInput = z.infer<typeof paystackVerifySchema>;
export type SquarePaymentInput = z.infer<typeof squarePaymentSchema>;
export type SquareCustomerInput = z.infer<typeof squareCustomerSchema>;

// ============================================
// CHECKOUT TYPE EXPORTS
// ============================================

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;
export type GetCheckoutsInput = z.infer<typeof getCheckoutsSchema>;
export type GetCheckoutHistoryInput = z.infer<typeof getCheckoutHistorySchema>;
export type UpdateCheckoutInput = z.infer<typeof updateCheckoutSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type CancelCheckoutInput = z.infer<typeof cancelCheckoutSchema>;
export type VoidCheckoutInput = z.infer<typeof voidCheckoutSchema>;
export type AddCheckoutItemInput = z.infer<typeof addCheckoutItemSchema>;
export type UpdateCheckoutItemInput = z.infer<typeof updateCheckoutItemSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
export type EmailReceiptInput = z.infer<typeof emailReceiptSchema>;
export type ExportCheckoutsInput = z.infer<typeof exportCheckoutsSchema>;
export type GetCheckoutStatsInput = z.infer<typeof getCheckoutStatsSchema>;
export type UpdateCheckoutSettingsInput = z.infer<typeof updateCheckoutSettingsSchema>;

// ============================================
// VALIDATION CLASSES
// ============================================

export class CategoryValidation {
  static validateCreateCategory(data: unknown): CreateCategoryInput {
    return createCategorySchema.parse(data);
  }
  static validateUpdateCategory(data: unknown): UpdateCategoryInput {
    return updateCategorySchema.parse(data);
  }
}

export class InventoryValidation {
  static validateCreateItem(data: unknown): CreateItemDto {
    return createItemSchema.parse(data);
  }
  static validateUpdateItem(data: unknown): UpdateItemDto {
    return updateItemSchema.parse(data);
  }
  static validateIssueItem(data: unknown): IssueItemDto {
    return issueItemSchema.parse(data);
  }
  static validateReturnItem(data: unknown): ReturnItemDto {
    return returnItemSchema.parse(data);
  }
  static validateRestockItem(data: unknown): RestockItemDto {
    return restockItemSchema.parse(data);
  }
  static validateListItems(data: unknown): ListItemsQueryDto {
    return listItemsQuerySchema.parse(data);
  }
  static validateListIssues(data: unknown): ListIssuesQueryDto {
    return listIssuesQuerySchema.parse(data);
  }
  static validateBulkCreateItems(data: unknown): BulkCreateItemsDto {
    return bulkCreateItemsSchema.parse(data);
  }
  static validateBulkUpdateStock(data: unknown): BulkUpdateStockDto {
    return bulkUpdateStockSchema.parse(data);
  }
}

export class AuthValidation {
  static validateRegister(data: unknown): RegisterInput {
    return registerSchema.parse(data);
  }
  static validateLogin(data: unknown): LoginInput {
    return loginSchema.parse(data);
  }
  static validateForgotPassword(data: unknown) {
    return forgotPasswordSchema.parse(data);
  }
  static validateResetPassword(data: unknown) {
    return resetPasswordSchema.parse(data);
  }
  static validateVerifyEmail(data: unknown) {
    return verifyEmailSchema.parse(data);
  }
  static validateResendVerification(data: unknown) {
    return resendVerificationSchema.parse(data);
  }
  static validateVerify2FA(data: unknown) {
    return verify2FASchema.parse(data);
  }
}

export class ProductValidation {
  static validateCreateProduct(data: unknown): CreateProductInput {
    return createProductSchema.parse(data);
  }
  static validateUpdateProduct(data: unknown): UpdateProductInput {
    return updateProductSchema.parse(data);
  }
  static validateBulkCreateProducts(data: unknown) {
    return bulkCreateProductsSchema.parse(data);
  }
  static validateBulkDeleteProducts(data: unknown) {
    return bulkDeleteProductsSchema.parse(data);
  }
}

export class SupplierValidation {
  static validateCreateSupplier(data: unknown): CreateSupplierInput {
    return createSupplierSchema.parse(data);
  }
  static validateUpdateSupplier(data: unknown) {
    return updateSupplierSchema.parse(data);
  }
}

export class ReorderValidation {
  static validateCreateReorder(data: unknown): CreateReorderInput {
    return createReorderSchema.parse(data);
  }
}

export class UserValidation {
  static validateCreateUser(data: unknown): CreateUserInput {
    return createUserSchema.parse(data);
  }
  static validateUpdateUser(data: unknown): UpdateUserInput {
    return updateUserSchema.parse(data);
  }
  static validateUpdateUserRole(data: unknown) {
    return updateUserRoleSchema.parse(data);
  }
  static validateUpdatePermissions(data: unknown): UpdatePermissionsInput {
    return updatePermissionsSchema.parse(data);
  }
  static validateBulkAction(data: unknown) {
    return bulkActionSchema.parse(data);
  }
  static validateUserSearch(data: unknown) {
    return userSearchSchema.parse(data);
  }
}

export class BarcodeValidation {
  static validateGenerateBarcode(data: unknown): GenerateBarcodeInput {
    return generateBarcodeSchema.parse(data);
  }
  static validateAssociateBarcode(data: unknown): AssociateBarcodeInput {
    return associateBarcodeSchema.parse(data);
  }
  static validateValidateBarcode(data: unknown): ValidateBarcodeInput {
    return validateBarcodeSchema.parse(data);
  }
  static validateScanBarcode(data: unknown): ScanBarcodeInput {
    return scanBarcodeSchema.parse(data);
  }
  static validateBulkGenerateBarcodes(data: unknown): BulkGenerateBarcodesInput {
    return bulkGenerateBarcodesSchema.parse(data);
  }
  static validateGenerateBarcodeImage(data: unknown): GenerateBarcodeImageInput {
    return generateBarcodeImageSchema.parse(data);
  }
  static validateGenerateQRCode(data: unknown) {
    return generateQRCodeSchema.parse(data);
  }
}

export class NotificationValidation {
  static validateCreateNotification(data: unknown): CreateNotificationInput {
    return createNotificationSchema.parse(data);
  }
  static validateUpdateNotification(data: unknown): UpdateNotificationInput {
    return updateNotificationSchema.parse(data);
  }
  static validateBulkCreateNotifications(data: unknown): BulkCreateNotificationsInput {
    return bulkCreateNotificationsSchema.parse(data);
  }
  static validateMarkRead(data: unknown): MarkReadInput {
    return markReadSchema.parse(data);
  }
  static validatePreferences(data: unknown): NotificationPreferencesInput {
    return notificationPreferencesSchema.parse(data);
  }
  static validateUpdatePreferences(data: unknown): UpdatePreferencesInput {
    return updatePreferencesSchema.parse(data);
  }
  static validateNotificationQuery(data: unknown): NotificationQueryInput {
    return notificationQuerySchema.parse(data);
  }
}

export class VariantValidation {
  static validateCreateVariant(data: unknown): CreateVariantInput {
    return createVariantSchema.parse(data);
  }
  static validateUpdateVariant(data: unknown): UpdateVariantInput {
    return updateVariantSchema.parse(data);
  }
  static validateBulkCreateVariants(data: unknown): BulkCreateVariantsInput {
    return bulkCreateVariantsSchema.parse(data);
  }
  static validateUpdateVariantStock(data: unknown): UpdateVariantStockInput {
    return updateVariantStockSchema.parse(data);
  }
  static validateVariantQuery(data: unknown): VariantQueryInput {
    return variantQuerySchema.parse(data);
  }
}

export class OrderValidation {
  static validateCreateOrder(data: unknown): CreateOrderInput {
    return createOrderSchema.parse(data);
  }
  static validateUpdateOrder(data: unknown): UpdateOrderInput {
    return updateOrderSchema.parse(data);
  }
  static validateUpdateOrderStatus(data: unknown): UpdateOrderStatusInput {
    return updateOrderStatusSchema.parse(data);
  }
  static validateCancelOrder(data: unknown): CancelOrderInput {
    return cancelOrderSchema.parse(data);
  }
  static validateAddOrderItem(data: unknown): AddOrderItemInput {
    return addOrderItemSchema.parse(data);
  }
  static validateUpdateOrderItem(data: unknown): UpdateOrderItemInput {
    return updateOrderItemSchema.parse(data);
  }
  static validateBulkUpdateOrderStatus(data: unknown): BulkUpdateOrderStatusInput {
    return bulkUpdateOrderStatusSchema.parse(data);
  }
}

export class CartValidation {
  static validateAddItem(data: unknown): AddCartItemInput {
    return addCartItemSchema.parse(data);
  }
  static validateAddMultipleItems(data: unknown): AddMultipleCartItemsInput {
    return addMultipleCartItemsSchema.parse(data);
  }
  static validateUpdateItemQuantity(data: unknown): UpdateCartItemQuantityInput {
    return updateCartItemQuantitySchema.parse(data);
  }
  static validateApplyDiscount(data: unknown): ApplyCartDiscountInput {
    return applyCartDiscountSchema.parse(data);
  }
  static validateApplyPromotion(data: unknown): ApplyCartPromotionInput {
    return applyCartPromotionSchema.parse(data);
  }
  static validateApplyLoyaltyPoints(data: unknown): ApplyLoyaltyPointsInput {
    return applyLoyaltyPointsSchema.parse(data);
  }
  static validateAssociateCustomer(data: unknown): AssociateCustomerInput {
    return associateCustomerSchema.parse(data);
  }
  static validateUpdateCartNotes(data: unknown): UpdateCartNotesInput {
    return updateCartNotesSchema.parse(data);
  }
  static validateCheckout(data: unknown): CartCheckoutInput {
    return cartCheckoutSchema.parse(data);
  }
  static validateTransferCart(data: unknown): TransferCartInput {
    return transferCartSchema.parse(data);
  }
  static validateSplitCart(data: unknown): SplitCartInput {
    return splitCartSchema.parse(data);
  }

  static validateExportAnalytics(data: unknown) {
    return exportAnalyticsSchema.parse(data);
  }
  
  static validateExportHistory(data: unknown) {
    return exportHistorySchema.parse(data);
  }
  
  static validateExportAbandoned(data: unknown) {
    return exportAbandonedSchema.parse(data);
  }
  
  static validateAbandonedCartsQuery(data: unknown) {
    return abandonedCartsQuerySchema.parse(data);
  }
  
  static validateRecoverCart(data: unknown) {
    return recoverCartSchema.parse(data);
  }
  
  static validateSendReminder(data: unknown) {
    return sendReminderSchema.parse(data);
  }
}

// ============================================
// PROVIDER-SPECIFIC VALIDATION CLASSES
// ============================================

export class PayPalValidation {
  static validateCapture(data: unknown): PayPalCaptureInput {
    return payPalCaptureSchema.parse(data);
  }
}

export class FlutterwaveValidation {
  static validateVirtualAccount(data: unknown): FlutterwaveVirtualAccountInput {
    return flutterwaveVirtualAccountSchema.parse(data);
  }
}

export class PaystackValidation {
  static validateVerify(data: unknown): PaystackVerifyInput {
    return paystackVerifySchema.parse(data);
  }
}

export class SquareValidation {
  static validatePayment(data: unknown): SquarePaymentInput {
    return squarePaymentSchema.parse(data);
  }
  static validateCustomer(data: unknown): SquareCustomerInput {
    return squareCustomerSchema.parse(data);
  }
}

// ============================================
// CHECKOUT VALIDATION CLASS
// ============================================

export class CheckoutValidation {
  static validateCreateCheckout(data: unknown): CreateCheckoutInput {
    return createCheckoutSchema.parse(data);
  }
  
  static validateGetCheckouts(data: unknown): GetCheckoutsInput {
    return getCheckoutsSchema.parse(data);
  }
  
  static validateGetCheckoutHistory(data: unknown): GetCheckoutHistoryInput {
    return getCheckoutHistorySchema.parse(data);
  }
  
  static validateUpdateCheckout(data: unknown): UpdateCheckoutInput {
    return updateCheckoutSchema.parse(data);
  }
  
  static validateProcessPayment(data: unknown): ProcessPaymentInput {
    return processPaymentSchema.parse(data);
  }
  
  static validateCancelCheckout(data: unknown): CancelCheckoutInput {
    return cancelCheckoutSchema.parse(data);
  }
  
  static validateVoidCheckout(data: unknown): VoidCheckoutInput {
    return voidCheckoutSchema.parse(data);
  }
  
  static validateAddCheckoutItem(data: unknown): AddCheckoutItemInput {
    return addCheckoutItemSchema.parse(data);
  }
  
  static validateUpdateCheckoutItem(data: unknown): UpdateCheckoutItemInput {
    return updateCheckoutItemSchema.parse(data);
  }
  
  static validateApplyDiscount(data: unknown): ApplyDiscountInput {
    return applyDiscountSchema.parse(data);
  }
  
  static validateEmailReceipt(data: unknown): EmailReceiptInput {
    return emailReceiptSchema.parse(data);
  }
  
  static validateExportCheckouts(data: unknown): ExportCheckoutsInput {
    return exportCheckoutsSchema.parse(data);
  }
  
  static validateGetCheckoutStats(data: unknown): GetCheckoutStatsInput {
    return getCheckoutStatsSchema.parse(data);
  }
  
  static validateUpdateCheckoutSettings(data: unknown): UpdateCheckoutSettingsInput {
    return updateCheckoutSettingsSchema.parse(data);
  }
}

// ============================================
// PAYMENT PROVIDER VALIDATION CLASS
// ============================================

// Note: This class is already defined above. Do not duplicate.

export default {
  // Export all schemas as default
  register: registerSchema,
  login: loginSchema,
  forgotPassword: forgotPasswordSchema,
  resetPassword: resetPasswordSchema,
  verifyEmail: verifyEmailSchema,
  resendVerification: resendVerificationSchema,
  verify2FA: verify2FASchema,
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  updateUserRole: updateUserRoleSchema,
  updatePermissions: updatePermissionsSchema,
  bulkAction: bulkActionSchema,
  userSearch: userSearchSchema,
  createPaymentProvider: createPaymentProviderSchema,
  updatePaymentProvider: updatePaymentProviderSchema,
  getPaymentProviders: getPaymentProvidersQuerySchema,
  toggleProvider: toggleProviderSchema,
  configureProvider: configureProviderSchema,
  updateProviderHealth: updateProviderHealthSchema,
  createProviderCurrency: createProviderCurrencySchema,
  createPaymentMethodConfig: createPaymentMethodConfigSchema,
  updatePaymentMethodConfig: updatePaymentMethodConfigSchema,
  // Provider-specific schemas
  payPalCapture: payPalCaptureSchema,
  flutterwaveVirtualAccount: flutterwaveVirtualAccountSchema,
  paystackVerify: paystackVerifySchema,
  squarePayment: squarePaymentSchema,
  squareCustomer: squareCustomerSchema,
};
