import { z } from "zod";
import {
  businessUnitIdSchema,
  CANONICAL_NOTIFICATION_PRIORITIES_SET,
  CANONICAL_NOTIFICATION_TYPES_SET,
  companyIdSchema,
  notificationIdSchema,
  userIdSchema,
} from "../helpers";

export const notificationTypeSchema = z
  .string()
  .min(1, 'Notification type is required')
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => CANONICAL_NOTIFICATION_TYPES_SET.has(v), {
    message: `Unsupported notification type. Accepted: ${Array.from(
      CANONICAL_NOTIFICATION_TYPES_SET,
    ).join(', ')}`,
  });

export const notificationPrioritySchema = z
  .string()
  .min(1, 'Notification priority is required')
  .transform((v) => v.trim().toUpperCase())
  .refine((v) => CANONICAL_NOTIFICATION_PRIORITIES_SET.has(v), {
    message: `Unsupported notification priority. Accepted: ${Array.from(
      CANONICAL_NOTIFICATION_PRIORITIES_SET,
    ).join(', ')}`,
  });

export const createNotificationSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long'),
  type: notificationTypeSchema,
  priority: notificationPrioritySchema.optional(),
  link: z.string().url('Invalid URL format').optional().nullable(),
  data: z.record(z.any()).optional().nullable(),
  userId: userIdSchema.optional(),
  businessUnitId: businessUnitIdSchema.optional(),
  companyId: companyIdSchema.optional(),
});

export const updateNotificationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(2000).optional(),
  type: notificationTypeSchema.optional(),
  priority: notificationPrioritySchema.optional(),
  isRead: z.boolean().optional(),
});

export const bulkCreateNotificationsSchema = z.object({
  notifications: z
    .array(createNotificationSchema)
    .min(1, 'At least one notification is required'),
});

export const markReadSchema = z.object({
  ids: z.array(notificationIdSchema).min(1, 'At least one ID is required'),
});

export const markUnreadSchema = z.object({
  ids: z.array(notificationIdSchema).min(1, 'At least one ID is required'),
});

export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  lowStockAlerts: z.boolean().optional(),
  saleAlerts: z.boolean().optional(),
  purchaseOrderAlerts: z.boolean().optional(),
  shiftAlerts: z.boolean().optional(),
  systemAlerts: z.boolean().optional(),
  promotionalAlerts: z.boolean().optional(),
  reminderAlerts: z.boolean().optional(),
  receiptAlerts: z.boolean().optional(),
  emailFrequency: z
    .enum(['immediate', 'daily', 'weekly', 'never'])
    .optional(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format')
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Must be HH:MM format')
    .optional(),
});

export const updatePreferencesSchema = notificationPreferencesSchema;

export const notificationQuerySchema = z.object({
  page: z.string().transform(Number).optional(),
  limit: z.string().transform(Number).optional(),
  unreadOnly: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  type: notificationTypeSchema.optional(),
  priority: notificationPrioritySchema.optional(),
  search: z.string().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationSchema>;
export type BulkCreateNotificationsInput = z.infer<
  typeof bulkCreateNotificationsSchema
>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
export type MarkUnreadInput = z.infer<typeof markUnreadSchema>;
export type NotificationPreferencesInput = z.infer<
  typeof notificationPreferencesSchema
>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>;
