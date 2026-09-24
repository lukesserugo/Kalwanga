import {
  bulkCreateNotificationsSchema,
  createNotificationSchema,
  markReadSchema,
  markUnreadSchema,
  notificationPreferencesSchema,
  notificationPrioritySchema,
  notificationQuerySchema,
  notificationTypeSchema,
  updateNotificationSchema,
  updatePreferencesSchema,
  type BulkCreateNotificationsInput,
  type CreateNotificationInput,
  type MarkReadInput,
  type MarkUnreadInput,
  type NotificationPreferencesInput,
  type NotificationQueryInput,
  type UpdateNotificationInput,
  type UpdatePreferencesInput,
} from "../schemas/notification";

export class NotificationValidation {
  static validateCreateNotification(data: unknown): CreateNotificationInput {
    return createNotificationSchema.parse(data);
  }
  static validateUpdateNotification(data: unknown): UpdateNotificationInput {
    return updateNotificationSchema.parse(data);
  }
  static validateBulkCreateNotifications(
    data: unknown,
  ): BulkCreateNotificationsInput {
    return bulkCreateNotificationsSchema.parse(data);
  }
  static validateMarkRead(data: unknown): MarkReadInput {
    return markReadSchema.parse(data);
  }
  static validateMarkUnread(data: unknown): MarkUnreadInput {
    return markUnreadSchema.parse(data);
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
  static validateNotificationType(data: unknown) {
    return notificationTypeSchema.parse(data);
  }
  static validateNotificationPriority(data: unknown) {
    return notificationPrioritySchema.parse(data);
  }
}
