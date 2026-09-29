// D:\Projects\Kalwanga\packages\web\types\user.ts


import type { BusinessUnit } from './businessUnit';

// Re-export the canonical BusinessUnit so files that previously
// imported it from './user' keep working. The declaration lives in
// ./businessUnit — this file must not declare its own.
export type { BusinessUnit };

// ============================================
// USER
// ============================================

export interface User {
  id: string;
  clerkId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string | null;
  avatar?: string | null;
  role: string;
  isActive: boolean;

  /**
   * Resolved permission strings for this user. Contains the wildcard
   * `'*'` when the user is SUPER_ADMIN. Everyone else gets the role
   * defaults or a custom override from the backend.
   *
   * ⚠️ Never narrow this to a union of known permission strings — the
   *    wildcard `'*'` is not a member of any such union, and narrowing
   *    it would break the `can('*')` check.
   */
  permissions: string[];

  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  companyId?: string | null;
  company?: Company | null;
  businessUnits?: BusinessUnitMembership[];
}

// ============================================
// CREATE USER — REQUEST SHAPE
// ============================================

/**
 * Body accepted by `POST /users`.
 *
 * Mirrors the backend controller's `createUserSchema`. Only `email`,
 * `firstName`, `lastName`, `role`, and `password` are required by the
 * schema; `password` is listed as required because the controller
 * hashes it before writing and the transaction rejects a null.
 *
 * `permissions` is optional — when omitted the backend derives the
 * role's default set via `getDefaultPermissionsForRole`. When
 * supplied it *replaces* the default rather than merging with it.
 */
export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: string;
  password: string;
  isActive?: boolean;
  companyId?: string;
  businessUnitId?: string;
  clerkId?: string;
  permissions?: string[];
  avatar?: string;
}

// ============================================
// BULK ACTION — RESPONSE SHAPE
// ============================================

/**
 * Response returned by the bulk user endpoints:
 *   POST /users/bulk/activate
 *   POST /users/bulk/deactivate
 *   POST /users/bulk/delete
 *
 * The backend controllers in `userController.ts` return
 * `{ success: true, message, count }`. `count` is the number of rows
 * the underlying `updateMany` / `deleteMany` touched — not the number
 * of IDs the caller supplied. Ids that didn't match a row are
 * silently excluded from the count.
 */
export interface BulkActionResponse {
  success: boolean;
  message: string;
  count: number;
}

// ============================================
// COMPANY
// ============================================

export interface Company {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  currency?: string;
  timezone?: string;
  logo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  businessUnits?: BusinessUnit[];
  users?: User[];
}

// ============================================
// BUSINESS UNIT MEMBERSHIP
// ============================================
//
// The shape returned when a user's `businessUnits` array is
// populated. It is NOT the same as BusinessUnitUser in
// types/businessUnit.ts — this one carries the inline `businessUnit`
// relation the API includes on the user object.

export interface BusinessUnitMembership {
  id: string;
  userId: string;
  businessUnitId: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  businessUnit?: BusinessUnit;
  user?: User;
}

// ============================================
// INVITATION
// ============================================

export interface Invitation {
  id: string;
  email: string;
  role: string;
  businessUnitId?: string | null;
  message?: string | null;
  expiresIn: number;
  status: string;
  sentAt?: string | null;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  cancelledAt?: string | null;
  invitationToken: string;
  invitedBy: string;
  invitedById?: string | null;
  reminderSent: boolean;
  reminderSentAt?: string | null;
  reminderCount: number;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// USER GROUP
// ============================================

export interface UserGroup {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  permissions: string[];
  isActive: boolean;
  createdBy: string;
  createdById?: string | null;
  parentGroupId?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// USER ACTIVITY
// ============================================

export interface UserActivity {
  id: string;
  userId: string;
  action: string;
  description: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  status: 'success' | 'failed' | 'pending';
  severity: 'info' | 'warning' | 'error' | 'critical';
  resource?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

export interface ActivityFilter {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  status?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  device?: string;
  location?: string;
  ipAddress?: string;
  resource?: string;
  resourceId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ActivityStats {
  total: number;
  groupedBy?: string;
  groupedStats?: Record<string, number>;
  byAction?: Record<string, number>;
  byStatus?: Record<string, number>;
  bySeverity?: Record<string, number>;
  byDevice?: Record<string, number>;
  byLocation?: Record<string, number>;
  recentActivities?: UserActivity[];
}
