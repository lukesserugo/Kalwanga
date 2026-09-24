import { z } from "zod";
import { businessUnitIdSchema, categoryIdSchema, generateSlug } from "../helpers";

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export { generateSlug };

const categorySlugField = z
  .string()
  .min(1, 'Slug is required')
  .max(120, 'Slug too long')
  .regex(SLUG_REGEX, 'Slug must be lowercase letters, numbers, and hyphens')
  .optional();

const categoryImageField = z
  .string()
  .url('Image must be a valid URL')
  .max(2048, 'Image URL too long')
  .optional()
  .nullable();

const categoryIconField = z
  .string()
  .max(64, 'Icon must be 64 characters or fewer')
  .optional()
  .nullable();

const categoryColorField = z
  .string()
  .regex(HEX_COLOR_REGEX, 'Color must be a hex value like #F97316')
  .optional()
  .nullable();

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(120, 'Name too long'),
  slug: categorySlugField,
  description: z.string().max(2000).optional().nullable(),
  image: categoryImageField,
  icon: categoryIconField,
  color: categoryColorField,
  parentId: categoryIdSchema.nullable().optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  isActive: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  sortOrder: z.number().int().min(0).optional().default(0),
  metaTitle: z.string().max(160).optional().nullable(),
  metaDescription: z.string().max(320).optional().nullable(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(SLUG_REGEX, 'Slug must be lowercase letters, numbers, and hyphens')
    .optional(),
  description: z.string().max(2000).optional().nullable(),
  image: categoryImageField,
  icon: categoryIconField,
  color: categoryColorField,
  parentId: categoryIdSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  featured: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metaTitle: z.string().max(160).optional().nullable(),
  metaDescription: z.string().max(320).optional().nullable(),
});

export const bulkDeleteSchema = z.object({
  ids: z.array(categoryIdSchema).min(1, 'At least one ID is required').max(200),
});

export const categoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(20),
  search: z.string().optional(),
  businessUnitId: z.string().optional(),
  parentId: z.string().optional().nullable(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
  featured: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'true' : v)),
  sortBy: z
    .enum(['name', 'createdAt', 'updatedAt', 'sortOrder', 'productCount'])
    .optional()
    .default('sortOrder'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const categoryWithProductsQuerySchema = z.object({
  productLimit: z.coerce.number().int().min(1).max(200).optional().default(50),
  includeInactive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .default(false),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;
export type CategoryQueryInput = z.infer<typeof categoryQuerySchema>;
export type CategoryWithProductsQueryInput = z.infer<
  typeof categoryWithProductsQuerySchema
>;
