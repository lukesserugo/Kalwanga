import { z } from "zod";

export const DateRangeQuerySchema = z.object({
  range: z
    .enum(["today", "week", "month", "year", "custom"])
    .default("week"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;

export const BusinessUnitQuerySchema = z.object({
  businessUnitId: z.string().optional(),
});

export const SearchQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
});

export const IdParamSchema = z.object({
  id: z.string().min(1),
});

export type IdParam = z.infer<typeof IdParamSchema>;

export const DashboardQuerySchema = DateRangeQuerySchema.merge(
  BusinessUnitQuerySchema
).merge(SearchQuerySchema);

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
