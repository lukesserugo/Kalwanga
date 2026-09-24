// packages/api-contract/src/schemas/dashboard.ts
import { z } from "zod";

/**
 * ⚠️ TODO — lift from dashboardController.ts
 */

export const DashboardStatsSchema = z.object({
  sales: z.object({
    today: z.object({ total: z.number(), count: z.number(), trend: z.number().optional() }),
    week: z.object({ total: z.number(), count: z.number(), trend: z.number().optional() }),
    month: z.object({ total: z.number(), count: z.number(), trend: z.number().optional() }),
    year: z.object({ total: z.number(), count: z.number(), trend: z.number().optional() }),
  }),
  customers: z.object({
    total: z.number(),
    new: z.number(),
    active: z.number(),
    growth: z.number(),
    trend: z.number().optional(),
  }),
  products: z.object({
    total: z.number(),
    active: z.number(),
    outOfStock: z.number(),
    lowStock: z.number(),
    categories: z.number(),
  }),
  inventory: z.object({
    totalValue: z.number(),
    totalItems: z.number(),
    categories: z.number(),
    turnover: z.number(),
    valueChange: z.number(),
  }),
  orders: z.object({
    total: z.number(),
    pending: z.number(),
    processing: z.number(),
    completed: z.number(),
    cancelled: z.number(),
    refunded: z.number(),
    completionRate: z.number(),
  }),
  revenue: z.object({
    total: z.number(),
    average: z.number(),
    growth: z.number(),
    target: z.number(),
    progress: z.number(),
  }),
  registers: z.object({
    open: z.number(),
    total: z.number(),
    active: z.number(),
    utilization: z.number(),
  }),
  employees: z.object({
    total: z.number(),
    active: z.number(),
    online: z.number(),
    turnover: z.number(),
  }),
  suppliers: z.object({
    total: z.number(),
    active: z.number(),
    new: z.number(),
  }),
  performance: z.object({
    conversionRate: z.number(),
    averageOrderValue: z.number(),
    customerSatisfaction: z.number(),
    retentionRate: z.number(),
  }),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

export const SalesTrendSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  orders: z.number(),
  average: z.number(),
  targets: z.number().optional(),
});

export type SalesTrend = z.infer<typeof SalesTrendSchema>;

export const TopProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string().optional().default(""),
  sales: z.number().default(0),
  revenue: z.number().default(0),
  stock: z.number().default(0),
  category: z.string().optional().default(""),
  growth: z.number().default(0),
});

export type TopProduct = z.infer<typeof TopProductSchema>;

export const RecentActivityItemSchema = z.object({
  id: z.string(),
  type: z.enum([
    "sale",
    "order",
    "customer",
    "inventory",
    "payment",
    "alert",
    "system",
  ]),
  title: z.string(),
  description: z.string(),
  timestamp: z.string().datetime(),
  isRead: z.boolean(),
  priority: z.enum(["low", "medium", "high"]),
  metadata: z.record(z.unknown()).optional(),
});

export type RecentActivityItem = z.infer<typeof RecentActivityItemSchema>;
