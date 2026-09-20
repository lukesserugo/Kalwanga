// packages/web/types/category.ts

import type { BusinessUnit } from './businessUnit';
import type { Product } from './product';

// ============================================
// PAGINATION
// ============================================
//
// The service imports this from `types/category`. Re-exporting it here
// keeps a single import surface for anything category-related.

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// ============================================
// CATEGORY (canonical model)
// ============================================

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;

  // ── Media / visual identity ─────────────────────────────
  // The avatar fallback chain is: image → icon → initials(color).
  image?: string | null;
  icon?: string | null;
  color?: string | null;

  parentId?: string | null;
  parent?: Category | null;
  children?: Category[];

  isActive: boolean;
  featured?: boolean;

  // ── Ordering / SEO ──────────────────────────────────────
  sortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;

  businessUnitId: string;
  businessUnit?: BusinessUnit;

  products?: Product[];

  metadata?: {
    createdBy?: string;
    updatedBy?: string;
    lastUpdated?: string;
  } | null;

  createdAt: string;
  updatedAt: string;

  // ── Denormalised counts some list endpoints attach ──────
  productCount?: number;
  childCount?: number;

  // ── Recent products attached by getCategoryById ─────────
  recentProducts?: CategoryProductPreview[];

  // ── Raw Prisma _count (kept for backward compat) ────────
  // Prefer productCount / childCount. Normalizers on the
  // backend flatten `_count` into those two fields, but legacy
  // consumers may still read `_count` directly.
  _count?: {
    products?: number;
    children?: number;
  };
}

// ============================================
// PRODUCT PREVIEW (attached to categories)
// ============================================
//
// Lightweight projection of a Product that the category endpoints
// embed (recentProducts, with-products). The full Product type is
// owned by ./product — we don't duplicate it here.

export interface CategoryProductPreview {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  costPrice?: number | null;
  image?: string | null;
  images?: Array<{ url: string; alt?: string | null }>;
  categoryId?: string | null;
  isActive?: boolean;
}

// ============================================
// CATEGORY WITH PRODUCTS (getCategoryWithProducts)
// ============================================
//
// Returned by:
//   GET /categories/:id/with-products
//   GET /categories/public/:id/with-products
//
// Uses Omit<Category, 'products'> instead of `extends Category`
// because `products` is narrowed from `Product[]` to
// `CategoryProductPreview[]`. TypeScript will not let an interface
// extension narrow a property's type, so we redeclare it here.
//
// Rollup math (computed server-side):
//   totalInventoryValue = Σ(inventory.quantity × product.unitPrice)
//   totalStock          = Σ(inventory.quantity)
//   inStockCount        = count where (quantity − reserved) > 0
//   outOfStockCount     = productCount − inStockCount

export interface CategoryWithProducts extends Omit<Category, 'products'> {
  products: CategoryProductPreview[];
  productCount: number;
  childCount: number;
  totalInventoryValue: number;
  totalStock: number;
  inStockCount: number;
  outOfStockCount: number;
}

// ============================================
// DTOs
// ============================================

export interface CategoryFormData {
  name: string;
  slug?: string;
  description: string;
  parentId: string;
  isActive: boolean;
  featured?: boolean;
  businessUnitId: string;
  image?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface CategoryFilter {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  parentId?: string | null;
  businessUnitId?: string;
  isFeatured?: boolean;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'productCount' | 'sortOrder';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  businessUnitId?: string;
  isActive?: boolean;
  featured?: boolean;
  image?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  featured?: boolean;
  image?: string | null;
  icon?: string | null;
  color?: string | null;
  sortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

// ============================================
// STATISTICS
// ============================================
//
// The backend's getCategoryStatistics returns this shape. `root` and
// `withChildren` are kept as optional aliases so legacy consumers
// that read them keep compiling; new code should prefer `active` and
// compute `root` from a list query if needed.

export interface CategoryStats {
  // ── Modern fields (always present in the API response) ──
  total: number;
  active: number;
  inactive: number;
  featured: number;
  withImages: number;
  withProducts: number;
  withoutProducts: number;
  totalProducts: number;
  averageProductsPerCategory: number;

  // ── Legacy aliases (optional — may be absent) ───────────
  root?: number;
  withChildren?: number;
}

// ============================================
// TREE HELPERS
// ============================================

/**
 * A Category node with its children resolved. Use this when building
 * a tree view; the API returns a flat list and the caller nests it.
 */
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  depth: number;
}

// ============================================
// COUNT CONTRACT
// ============================================
//
// The minimal shape every count helper needs. Both `Category` and
// `CategoryWithProducts` satisfy it structurally, so helpers can
// accept either without an explicit `Category` annotation.

export interface CategoryCountLike {
  productCount?: number;
  childCount?: number;
  _count?: {
    products?: number;
    children?: number;
  };
}

// ============================================
// HELPERS
// ============================================

export function getCategoryDisplayName(category: Category): string {
  return category.name || 'Unnamed Category';
}

export function hasChildren(category: Category): boolean {
  return !!(category.children && category.children.length > 0);
}

export function isRootCategory(category: Category): boolean {
  return !category.parentId;
}

/**
 * Return the product count for a category, preferring the normalised
 * `productCount` and falling back to the raw Prisma `_count`.
 *
 * Accepts anything that satisfies `CategoryCountLike` — a `Category`,
 * a `CategoryWithProducts`, or a hand-rolled partial.
 */
export function getCategoryProductCount(
  category: CategoryCountLike | null | undefined,
): number {
  if (!category) return 0;
  return category.productCount ?? category._count?.products ?? 0;
}

/**
 * Return the child count for a category, preferring the normalised
 * `childCount` and falling back to the raw Prisma `_count`.
 */
export function getCategoryChildCount(
  category: CategoryCountLike | null | undefined,
): number {
  if (!category) return 0;
  return category.childCount ?? category._count?.children ?? 0;
}

/**
 * Convenience aliases used by the UI components. Kept as separate
 * exports so both naming styles coexist without churn.
 */
export const productCountOf = getCategoryProductCount;
export const childCountOf = getCategoryChildCount;

/**
 * Turn a flat list of categories into a nested tree.
 *
 * The API returns `Category[]` with `parentId` references. This
 * function rebuilds the parent/child structure in memory so a tree
 * view can render it without additional requests.
 *
 * Cycles are broken defensively: if a category references a parent
 * that is itself, or forms a loop, it is promoted to a root node
 * rather than causing infinite recursion.
 */
export function buildCategoryTree(flat: Category[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const cat of flat) {
    byId.set(cat.id, { ...cat, children: [], depth: 0 });
  }

  for (const cat of flat) {
    const node = byId.get(cat.id)!;

    // Self-reference or missing parent → root.
    if (!cat.parentId || cat.parentId === cat.id || !byId.has(cat.parentId)) {
      roots.push(node);
      continue;
    }

    const parent = byId.get(cat.parentId)!;
    parent.children.push(node);
  }

  // Propagate depth after the full parent/child graph is built.
  const setDepths = (nodes: CategoryTreeNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      setDepths(node.children, depth + 1);
    }
  };
  setDepths(roots, 0);

  return roots;
}
