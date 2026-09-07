// D:\Projects\Kalwanga\packages\web\types\audit.ts
import { User, Company, BusinessUnit } from './user';

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  userId: string;
  user?: User;
  companyId?: string;
  company?: Company;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
  readAt?: string;
  userId: string;
  user?: User;
  companyId?: string;
  company?: Company;
  businessUnitId?: string;
  businessUnit?: BusinessUnit;
}

export interface Report {
  id: string;
  name: string;
  type: string;
  format: string;
  data: any;
  period: string;
  startDate?: string;
  endDate?: string;
  generatedAt: string;
  companyId: string;
  company?: Company;
  userId: string;
  user?: User;
}
