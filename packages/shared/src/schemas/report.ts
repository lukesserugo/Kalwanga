import { z } from "zod";
import {
  businessUnitIdSchema,
  companyIdSchema,
  userIdSchema,
} from "../helpers";

export const searchParamsSchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  search: z.string().optional(),
  query: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const reportParamsSchema = z.object({
  businessUnitId: businessUnitIdSchema.optional(),
  startDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  endDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional(),
  userId: userIdSchema.optional(),
  includeVariants: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  lowStockOnly: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  companyId: companyIdSchema.optional(),
  minSpent: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
});
