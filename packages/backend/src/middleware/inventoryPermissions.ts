// packages/backend/src/middleware/inventoryPermissions.ts

import { requirePermission, requireAnyPermission } from './auth.js';
import { PERMISSION_CATALOGUE } from '../lib/permissions.js';

/**
 * Facade over the canonical permission middleware in auth.ts.
 *
 * `routes/inventory.ts` and `routes/products.ts` import
 * `requireInventoryPermission` from this module and call it as a
 * factory: `requireInventoryPermission(PERMISSION_CATALOGUE.INVENTORY_VIEW)`.
 *
 * The actual permission-check logic — SUPER_ADMIN wildcards,
 * custom role overrides — lives in `auth.ts`'s `requirePermission`.
 * This file exists only so route files can name the domain scope
 * without repeating the string.
 */
export const requireInventoryPermission = requirePermission;
export const requireAnyInventoryPermission = requireAnyPermission;

// ------------------------------------------------------------------
// Shorthands — derived from PERMISSION_CATALOGUE, not hand-written.
// ------------------------------------------------------------------
//
// Every named export reads its string from the catalogue. There is
// no string literal anywhere in this file.

export const requireInventoryView = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_VIEW
);
export const requireInventoryCreate = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_CREATE
);
export const requireInventoryEdit = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_EDIT
);
export const requireInventoryDelete = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_DELETE
);
export const requireInventoryExport = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_EXPORT
);
export const requireInventoryImport = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_IMPORT
);
export const requireInventoryAdjust = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_ADJUST
);
export const requireInventoryTransfer = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_TRANSFER
);
export const requireInventoryIssue = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_ISSUE
);
export const requireInventoryRestock = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_RESTOCK
);
export const requireInventoryViewLowStock = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_VIEW_LOW_STOCK
);
export const requireInventoryViewReports = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_VIEW_REPORTS
);
export const requireInventoryViewAudit = requirePermission(
  PERMISSION_CATALOGUE.INVENTORY_VIEW_AUDIT
);
