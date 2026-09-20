// D:\Projects\Kalwanga\packages\web\types\user.ts

// ============================================
// CANONICAL IMPORTS
// ============================================
//
// Ownership map (do not deviate):
//   User, Company, BusinessUnitMembership, Invitation, UserGroup → THIS FILE
//   BusinessUnit → ./businessUnit   (this file only re-exports it)
//
// ⚠️ Do NOT import Company from './user'. This file IS './user'.
//    Importing from itself produces the circular-alias error.
//
// The BusinessUnit import is type-only so the cycle
//   user ↔ businessUnit
// is erased at compile time.

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
