// D:\Projects\Kalwanga\packages\web\types\notification.ts

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
  data?: Record<string, any>;
  userId?: string;
  businessUnitId?: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  type: string;
  enabled: boolean;
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationGroup {
  id: string;
  name: string;
  description?: string;
  notifications: Notification[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  byType: Record<string, number>;
  byDate: Array<{ date: string; count: number }>;
}
