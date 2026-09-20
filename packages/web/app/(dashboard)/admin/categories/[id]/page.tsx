// packages/web/app/(dashboard)/admin/categories/[id]/page.tsx

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Package,
  FolderTree,
  Star,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Building2,
  ChevronRight,
  X,
  Layers,
  Image as ImageIcon,
  Smile,
  Palette,
  DollarSign,
  Boxes,
  Search as SearchIcon,
  ExternalLink,
} from 'lucide-react';

import { useAuth } from '../../../../../hooks/useAuth';
import { usePermission } from '../../../../../hooks/usePermission';
import { categoryService } from '../../../../../services/categoryService';
import { toast } from '../../../../../utils/toast-manager';
import { formatCurrency, formatDate } from '../../../../../utils/formatters';
import { PermissionResource } from '../../../../../types/enums';
import { CategoryAvatar } from '../../../../../components/categories/CategoryAvatar';
import type {
  Category,
  CategoryCountLike,
  CategoryWithProducts,
  CategoryProductPreview,
} from '../../../../../types/category';

// ============================================
// HELPERS
// ============================================
//
// These read only count fields. Typing the parameter as
// `CategoryCountLike` lets them accept both `Category` and
// `CategoryWithProducts` — the latter of which is structurally
// incompatible with `Category` because its `products` field is
// narrowed from `Product[]` to `CategoryProductPreview[]`.

function productCountOf(c: CategoryCountLike | null | undefined): number {
  if (!c) return 0;
  return c.productCount ?? c._count?.products ?? 0;
}

function childCountOf(c: CategoryCountLike | null | undefined): number {
  if (!c) return 0;
  return c.childCount ?? c._count?.children ?? 0;
}

function isFeatured(
  c: Category | CategoryWithProducts | null | undefined,
): boolean {
  if (!c) return false;
  return (c as { featured?: boolean }).featured === true;
}

// ============================================
// PAGE
// ============================================

export default function CategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { user } = useAuth();
  const { canEdit, canDelete, canManage, canView } = usePermission();

  // ---- Permissions ----
  const canViewCategory =
    canView?.(`${PermissionResource.CATEGORY}:view`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;
  const canEditCategory =
    canEdit?.(`${PermissionResource.CATEGORY}:edit`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;
  const canDeleteCategory =
    canDelete?.(`${PermissionResource.CATEGORY}:delete`) ||
    canManage?.(`${PermissionResource.CATEGORY}:manage`) ||
    false;

  // ---- State ----
  const [category, setCategory] = useState<CategoryWithProducts | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productSort, setProductSort] = useState<
    'featured' | 'price-asc' | 'price-desc' | 'name'
  >('featured');

  // ---- Data load ----
  const loadCategory = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);

      const [base, withProducts] = await Promise.all([
        categoryService.getCategoryById(id),
        categoryService.getCategoryWithProducts(id, { productLimit: 200 }),
      ]);

      setCategory({
        ...base,
        ...withProducts,
        products: withProducts.products ?? [],
      });
    } catch (error: any) {
      console.error('Failed to load category:', error);
      toast.error(error?.message || 'Failed to load category');
      router.push('/admin/categories');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadCategory();
  }, [loadCategory]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if (typing) return;

      if (e.key === 'Escape') {
        setShowDeleteModal(false);
      } else if (e.key === 'e' && canEditCategory && !showDeleteModal) {
        router.push(`/admin/categories/${id}/edit`);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canEditCategory, id, router, showDeleteModal]);

  // ---- Delete ----
  const handleDelete = async () => {
    if (!category) return;
    setDeleting(true);
    try {
      await categoryService.deleteCategory(category.id);
      toast.success('Category deleted successfully');
      router.push('/admin/categories');
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const handleNavigateBack = () => router.push('/admin/categories');

  // ---- Derived: filtered + sorted products ----
  const visibleProducts = useMemo<CategoryProductPreview[]>(() => {
    if (!category?.products) return [];
    const q = productSearch.trim().toLowerCase();
    const filtered = q
      ? category.products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.sku?.toLowerCase().includes(q) ?? false),
        )
      : category.products;

    const sorted = [...filtered];
    switch (productSort) {
      case 'price-asc':
        sorted.sort((a, b) => a.unitPrice - b.unitPrice);
        break;
      case 'price-desc':
        sorted.sort((a, b) => b.unitPrice - a.unitPrice);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'featured':
      default:
        break;
    }
    return sorted;
  }, [category?.products, productSearch, productSort]);

  // ---- Permission guard ----
  if (!canViewCategory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <FolderTree className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">
            Access Restricted
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            You don't have permission to view categories.
          </p>
          <button
            onClick={handleNavigateBack}
            className="mt-4 px-6 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors focus-ring"
          >
            Back to Categories
          </button>
        </motion.div>
      </div>
    );
  }

  // ---- Loading skeleton ----
  if (loading) {
    return <DetailSkeleton />;
  }

  if (!category) {
    return (
      <div className="text-center py-16 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md mx-auto"
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <FolderTree className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">
            Category not found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            The category you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={handleNavigateBack}
            className="mt-6 px-5 py-2.5 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors focus-ring"
          >
            Back to Categories
          </button>
        </motion.div>
      </div>
    );
  }

  const productCount = category.productCount ?? category.products.length;
  const childCount = childCountOf(category);
  const hasProducts = productCount > 0;
  const hasChildren = childCount > 0;
  const featured = isFeatured(category);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-container mx-auto">
      {/* ---- BREADCRUMB ---- */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <button
          onClick={handleNavigateBack}
          className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring rounded"
        >
          Categories
        </button>
        {category.parent && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <button
              onClick={() =>
                category.parent &&
                router.push(`/admin/categories/${category.parent.id}`)
              }
              className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring rounded"
            >
              {category.parent.name}
            </button>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-700 dark:text-gray-300 font-medium truncate">
          {category.name}
        </span>
      </nav>

      {/* ---- HERO HEADER ---- */}
      <div className="relative overflow-hidden card-brand p-0">
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{
            background:
              category.color ||
              'linear-gradient(to right, #F97316, #EF4444)',
          }}
        />

        <div className="p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
              <CategoryAvatar
                category={category}
                size="xl"
                rounded="xl"
                className="shadow-md ring-4 ring-white dark:ring-gray-800 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">
                    {category.name}
                  </h1>
                  {featured && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300 text-xs font-medium">
                      <Star className="w-3 h-3 fill-current" />
                      Featured
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      category.isActive
                        ? 'bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        category.isActive ? 'bg-success-500' : 'bg-gray-400'
                      }`}
                    />
                    {category.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(category.slug);
                    toast.success('Slug copied');
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 font-mono hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-ring rounded"
                  title="Copy slug"
                >
                  /{category.slug}
                </button>

                {category.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3 max-w-2xl">
                    {category.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              {canEditCategory && (
                <button
                  onClick={() =>
                    router.push(`/admin/categories/${category.id}/edit`)
                  }
                  className="px-4 py-2 bg-brand-gradient text-white rounded-xl hover:bg-brand-gradient-hover flex items-center gap-2 transition-all text-sm font-medium shadow-sm hover:shadow-brand focus-ring"
                  title="Edit (E)"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              {canDeleteCategory && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 border border-danger-200 dark:border-danger-900/40 rounded-xl hover:bg-danger-100 dark:hover:bg-danger-900/30 flex items-center gap-2 transition-all text-sm font-medium focus-ring"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- INVENTORY ROLLUP ---- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <RollupCard
          icon={<Package className="w-4 h-4" />}
          label="Products"
          value={productCount}
          sub={`${category.inStockCount} in stock`}
          tone="brand"
        />
        <RollupCard
          icon={<Boxes className="w-4 h-4" />}
          label="Total stock"
          value={category.totalStock.toLocaleString()}
          sub="across all products"
          tone="success"
        />
        <RollupCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Inventory value"
          value={formatCurrency(category.totalInventoryValue)}
          sub="unitPrice × stock"
          tone="brand-accent"
        />
        <RollupCard
          icon={
            category.outOfStockCount > 0 ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )
          }
          label="Availability"
          value={`${category.inStockCount} / ${productCount}`}
          sub={
            category.outOfStockCount > 0
              ? `${category.outOfStockCount} out of stock`
              : 'All in stock'
          }
          tone={category.outOfStockCount > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* ---- MAIN GRID ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* DETAILS */}
          <DetailCard
            icon={<FolderTree className="w-4 h-4" />}
            title="Details"
            tone="brand"
          >
            <DetailRow label="Name" value={category.name} />

            <DetailRow
              label="Slug"
              value={<span className="font-mono text-xs">/{category.slug}</span>}
            />

            <DetailRow
              label="Status"
              value={
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    category.isActive
                      ? 'text-success-600 dark:text-success-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {category.isActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5" />
                  )}
                  {category.isActive ? 'Active' : 'Inactive'}
                </span>
              }
            />

            <DetailRow
              label="Featured"
              value={
                featured ? (
                  <Star className="w-4 h-4 text-warning-500 fill-warning-500" />
                ) : (
                  <span className="text-xs text-gray-400">No</span>
                )
              }
            />

            <DetailRow
              label="Sort order"
              value={
                <span className="font-mono text-xs tabular-nums">
                  #{category.sortOrder ?? 0}
                </span>
              }
            />

            <DetailRow
              label="Created"
              value={
                <span className="inline-flex items-center gap-1 text-xs">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  {formatDate(category.createdAt)}
                </span>
              }
            />

            <DetailRow
              label="Updated"
              value={
                <span className="inline-flex items-center gap-1 text-xs">
                  <Clock className="w-3 h-3 text-gray-400" />
                  {formatDate(category.updatedAt)}
                </span>
              }
            />

            <DetailRow
              label="Business Unit"
              value={
                <span className="inline-flex items-center gap-1 text-xs font-mono">
                  <Building2 className="w-3 h-3 text-gray-400" />
                  {category.businessUnitId.slice(0, 12)}…
                </span>
              }
            />
          </DetailCard>

          {/* VISUAL IDENTITY */}
          <DetailCard
            icon={<Palette className="w-4 h-4" />}
            title="Visual identity"
            tone="secondary"
          >
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 mb-3">
              <CategoryAvatar
                category={category}
                size="md"
                rounded="lg"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Avatar preview
                </p>
                <p className="text-3xs text-gray-500 dark:text-gray-400">
                  {category.image
                    ? 'Using image'
                    : category.icon
                      ? 'Using icon'
                      : 'Using initials'}
                </p>
              </div>
            </div>

            <DetailRow
              label={
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" /> Image
                </span>
              }
              value={
                category.image ? (
                  <a
                    href={category.image}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 truncate max-w-[180px]"
                  >
                    {category.image.split('/').pop()}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )
              }
            />

            <DetailRow
              label={
                <span className="inline-flex items-center gap-1">
                  <Smile className="w-3.5 h-3.5" /> Icon
                </span>
              }
              value={
                category.icon ? (
                  <span className="text-lg">{category.icon}</span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )
              }
            />

            <DetailRow
              label={
                <span className="inline-flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5" /> Color
                </span>
              }
              value={
                category.color ? (
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-mono text-xs">
                      {category.color}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">—</span>
                )
              }
            />
          </DetailCard>

          {/* SEO */}
          {(category.metaTitle || category.metaDescription) && (
            <DetailCard
              icon={<SearchIcon className="w-4 h-4" />}
              title="SEO"
              tone="warning"
            >
              {category.metaTitle && (
                <DetailRow label="Meta title" value={category.metaTitle} />
              )}
              {category.metaDescription && (
                <DetailRow
                  label="Meta description"
                  value={category.metaDescription}
                />
              )}
            </DetailCard>
          )}

          {/* SUBCATEGORIES */}
          {hasChildren && category.children && (
            <DetailCard
              icon={<Layers className="w-4 h-4" />}
              title={`Subcategories (${childCount})`}
              tone="secondary"
            >
              <div className="space-y-1.5">
                {category.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() =>
                      router.push(`/admin/categories/${child.id}`)
                    }
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group focus-ring"
                  >
                    <CategoryAvatar
                      category={child}
                      size="sm"
                      rounded="lg"
                    />
                    <span className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {child.name}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                      {productCountOf(child)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </DetailCard>
          )}
        </div>

        {/* RIGHT: Products */}
        <div className="lg:col-span-2">
          <div className="card-brand p-0 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-brand-500" />
                  Products
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 tabular-nums">
                    ({productCount})
                  </span>
                </h2>

                {productCount > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search…"
                        className="pl-8 pr-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-40"
                      />
                    </div>

                    <select
                      value={productSort}
                      onChange={(e) =>
                        setProductSort(e.target.value as typeof productSort)
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="featured">Featured first</option>
                      <option value="price-asc">Price: low → high</option>
                      <option value="price-desc">Price: high → low</option>
                      <option value="name">Name A–Z</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {!hasProducts ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  No products yet
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  This category doesn't have any products.
                </p>
                <button
                  onClick={() =>
                    router.push(
                      `/admin/catalog/add?categoryId=${category.id}`,
                    )
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-xl hover:bg-brand-600 transition-colors text-sm font-medium focus-ring"
                >
                  <Package className="w-4 h-4" />
                  Add product
                </button>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No products match "{productSearch}"
                </p>
                <button
                  onClick={() => setProductSearch('')}
                  className="mt-3 text-sm text-brand-600 dark:text-brand-400 hover:underline focus-ring rounded"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[800px] overflow-y-auto sidebar-scroll">
                {visibleProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={index}
                    onClick={() =>
                      router.push(`/admin/catalog/${product.id}`)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- DELETE MODAL ---- */}
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteModal
            category={category}
            productCount={productCount}
            childCount={childCount}
            deleting={deleting}
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface RollupCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  tone: 'brand' | 'brand-accent' | 'success' | 'warning';
}

const ROLLUP_TONES: Record<
  RollupCardProps['tone'],
  { bg: string; text: string; iconBg: string }
> = {
  brand: {
    bg: 'bg-brand-50 dark:bg-brand-900/20',
    text: 'text-brand-700 dark:text-brand-300',
    iconBg: 'bg-brand-100 dark:bg-brand-900/40',
  },
  'brand-accent': {
    bg: 'bg-brand-accent-50 dark:bg-brand-accent-900/20',
    text: 'text-brand-accent-700 dark:text-brand-accent-300',
    iconBg: 'bg-brand-accent-100 dark:bg-brand-accent-900/40',
  },
  success: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    text: 'text-success-700 dark:text-success-300',
    iconBg: 'bg-success-100 dark:bg-success-900/40',
  },
  warning: {
    bg: 'bg-warning-50 dark:bg-warning-900/20',
    text: 'text-warning-700 dark:text-warning-300',
    iconBg: 'bg-warning-100 dark:bg-warning-900/40',
  },
};

function RollupCard({ icon, label, value, sub, tone }: RollupCardProps) {
  const t = ROLLUP_TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${t.bg} rounded-2xl p-4 border border-transparent`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${t.iconBg} ${t.text}`}
        >
          {icon}
        </span>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${t.text} tabular-nums truncate`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
        {sub}
      </p>
    </motion.div>
  );
}

interface DetailCardProps {
  icon: React.ReactNode;
  title: string;
  tone: 'brand' | 'secondary' | 'warning';
  children: React.ReactNode;
}

const DETAIL_TONES: Record<
  DetailCardProps['tone'],
  { header: string; iconBg: string }
> = {
  brand: {
    header: 'text-brand-600 dark:text-brand-400',
    iconBg: 'bg-brand-100 dark:bg-brand-900/40',
  },
  secondary: {
    header: 'text-secondary-600 dark:text-secondary-400',
    iconBg: 'bg-secondary-100 dark:bg-secondary-900/40',
  },
  warning: {
    header: 'text-warning-600 dark:text-warning-400',
    iconBg: 'bg-warning-100 dark:bg-warning-900/40',
  },
};

function DetailCard({ icon, title, tone, children }: DetailCardProps) {
  const t = DETAIL_TONES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-brand p-0 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${t.iconBg} ${t.header}`}
        >
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </motion.div>
  );
}

interface DetailRowProps {
  label: React.ReactNode;
  value: React.ReactNode;
}

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-900 dark:text-white text-right min-w-0 break-words">
        {value}
      </span>
    </div>
  );
}

interface ProductCardProps {
  product: CategoryProductPreview;
  index: number;
  onClick: () => void;
}

function ProductCard({ product, index, onClick }: ProductCardProps) {
  const imageUrl = product.image || product.images?.[0]?.url || null;
  const initials =
    product.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-all text-left group focus-ring"
    >
      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-xs font-semibold text-gray-400">
            {initials}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {product.name}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
          {product.sku}
        </p>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
          {formatCurrency(product.unitPrice)}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 group-hover:text-brand-500 transition-colors" />
    </motion.button>
  );
}

// ============================================
// SKELETON
// ============================================

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-container mx-auto animate-pulse">
      <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-t-2xl" />
        <div className="p-6 flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-3">
            <div className="h-7 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-full max-w-lg bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-64 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700"
            />
          ))}
        </div>
        <div className="lg:col-span-2">
          <div className="h-96 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// DELETE MODAL
// ============================================

interface DeleteModalProps {
  /**
   * Narrowed to the fields the modal actually reads. This makes
   * `CategoryWithProducts` and `Category` both assignable — the
   * modal never touches `products`.
   */
  category: Pick<Category, 'id' | 'name' | 'image' | 'icon' | 'color'>;
  productCount: number;
  childCount: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteModal({
  category,
  productCount,
  childCount,
  deleting,
  onCancel,
  onConfirm,
}: DeleteModalProps) {
  const hasChildren = childCount > 0;
  const hasProducts = productCount > 0;
  const willArchive = !hasChildren && hasProducts;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <CategoryAvatar
            category={category}
            size="lg"
            rounded="xl"
            className="shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Delete category
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Are you sure you want to delete{' '}
            <strong className="text-gray-900 dark:text-white">
              "{category.name}"
            </strong>
            ?
          </p>
        </div>

        {hasChildren && (
          <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-danger-600 dark:text-danger-400 shrink-0 mt-0.5" />
            <div className="text-sm text-danger-700 dark:text-danger-300">
              <strong>Cannot delete.</strong> This category has {childCount}{' '}
              subcategor{childCount === 1 ? 'y' : 'ies'}. Move or delete them
              first.
            </div>
          </div>
        )}

        {willArchive && (
          <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 shrink-0 mt-0.5" />
            <div className="text-sm text-warning-700 dark:text-warning-300">
              This category has {productCount} product
              {productCount === 1 ? '' : 's'}. It will be{' '}
              <strong>archived (soft-deleted)</strong> instead of removed.
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 focus-ring"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting || hasChildren}
            className="px-4 py-2 bg-danger-600 text-white rounded-lg text-sm font-medium hover:bg-danger-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-ring"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {willArchive ? 'Archive' : 'Delete'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
