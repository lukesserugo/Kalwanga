import { z } from "zod";

// ============================================
// ID VALIDATION HELPERS - Supports CUID, UUID, and Clerk IDs
// ============================================

export const isCUID = (val: string): boolean => {
  const cuidRegex = /^c[a-z0-9]{20,25}$/i;
  return cuidRegex.test(val);
};

export const isUUID = (val: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(val);
};

export const isClerkId = (val: string): boolean => {
  const clerkRegex = /^user_[a-zA-Z0-9]+$/;
  return clerkRegex.test(val);
};

export const isValidId = (val: string): boolean => {
  if (/^c[a-z0-9]{20,25}$/i.test(val)) return true;
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      val,
    )
  )
    return true;
  if (/^user_[a-zA-Z0-9]+$/.test(val)) return true;
  if (/^[0-9]+$/.test(val)) return true;
  if (/^[a-zA-Z0-9_-]+$/.test(val)) return true;
  return false;
};

export const idSchema = (typeName: string) => {
  return z
    .string()
    .min(1, `${typeName} ID is required`)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      `${typeName} ID must contain only letters, numbers, hyphens, and underscores`,
    );
};

// ============================================
// SKU VALIDATION SCHEMA
// ============================================

export const skuSchema = z
  .string()
  .min(1, 'SKU is required')
  .max(50, 'SKU must be less than 50 characters')
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9-_]*$/,
    'SKU must contain only letters, numbers, hyphens, and underscores',
  );

// ============================================
// CANONICAL PAYMENT METHODS
// ============================================

export const CANONICAL_PAYMENT_METHODS = [
  'CASH',
  'CARD',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'MOBILE_MONEY',
  'MOBILE',
  'MPESA',
  'BANK_TRANSFER',
  'BANK',
  'GIFT_CARD',
  'GIFT',
  'LOYALTY_POINTS',
  'LOYALTY',
  'WALLET',
  'SPLIT',
  'MIXED',
  'OTHER',
  'PAYPAL',
  'FLUTTERWAVE',
  'PAYSTACK',
  'SQUARE',
  'CHECK',
] as const;

export type CanonicalPaymentMethod =
  (typeof CANONICAL_PAYMENT_METHODS)[number];

export const CANONICAL_PAYMENT_METHODS_SET = new Set<string>(
  CANONICAL_PAYMENT_METHODS,
);

export const paymentMethodSchema = z
  .string()
  .min(1, 'Payment method is required')
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => CANONICAL_PAYMENT_METHODS_SET.has(v), {
    message: `Unsupported payment method. Accepted: ${CANONICAL_PAYMENT_METHODS.join(
      ', ',
    )}`,
  });

// ============================================
// ID SCHEMAS
// ============================================

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const optionalUuidSchema = z
  .string()
  .uuid('Invalid UUID format')
  .optional();
export const nullableUuidSchema = z
  .string()
  .uuid('Invalid UUID format')
  .nullable()
  .optional();

export const businessUnitIdSchema = z
  .string()
  .min(1, 'Business unit ID is required')
  .refine(
    (val) => {
      if (val === 'default' || val === 'default-business-unit') return true;
      return isCUID(val) || isUUID(val);
    },
    { message: 'Invalid business unit ID format.' },
  );

export const companyIdSchema = z
  .string()
  .min(1, 'Company ID is required')
  .refine(
    (val) => {
      if (
        val === 'default' ||
        val === 'default-company-id' ||
        val === 'default-company'
      )
        return true;
      return isCUID(val) || isUUID(val);
    },
    { message: 'Invalid company ID format.' },
  );

export const userIdSchema = z
  .string()
  .min(1, 'User ID is required')
  .refine(
    (val) => isValidId(val) || val === 'default' || val === 'default-user-id',
    { message: 'Invalid user ID format.' },
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
export const locationIdSchema = idSchema('Location');

// ============================================
// SLUG HELPER (used by categories)
// ============================================

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============================================
// ENUM-LIKE CONSTANTS
// ============================================

export const LOCATION_TYPES = [
  'WAREHOUSE',
  'STORE',
  'BACKROOM',
  'DISTRIBUTION_CENTER',
  'STORE_FRONT',
  'IN_TRANSIT',
  'SUPPLIER',
  'OTHER',
] as const;

export type LocationTypeInput = (typeof LOCATION_TYPES)[number];

export const CANONICAL_NOTIFICATION_TYPES = [
  'SALE',
  'INVENTORY',
  'ORDER',
  'PAYMENT',
  'CUSTOMER',
  'SYSTEM',
  'ALERT',
  'SUCCESS',
  'INFO',
  'WARNING',
  'ERROR',
  'PROMOTION',
  'REMINDER',
  'LOW_STOCK',
  'PURCHASE_ORDER',
  'SHIFT',
  'RECEIPT',
] as const;

export type CanonicalNotificationType =
  (typeof CANONICAL_NOTIFICATION_TYPES)[number];

export const CANONICAL_NOTIFICATION_TYPES_SET = new Set<string>(
  CANONICAL_NOTIFICATION_TYPES,
);

export const CANONICAL_NOTIFICATION_PRIORITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
] as const;

export type CanonicalNotificationPriority =
  (typeof CANONICAL_NOTIFICATION_PRIORITIES)[number];

export const CANONICAL_NOTIFICATION_PRIORITIES_SET = new Set<string>(
  CANONICAL_NOTIFICATION_PRIORITIES,
);
