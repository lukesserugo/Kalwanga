// packages/backend/src/services/categoryService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { generateSlug } from '../utils/validators.js';

// ============================================
// TYPES
// ============================================

interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  color?: string | null;
  parentId?: string | null;
  businessUnitId: string;
  isActive?: boolean;
  featured?: boolean;
  sortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  color?: string | null;
  parentId?: string | null;
  isActive?: boolean;
  featured?: boolean;
  sortOrder?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  businessUnitId?: string;
  parentId?: string | null;
  isActive?: boolean;
  featured?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface GetCategoryWithProductsParams {
  productLimit?: number;
  includeInactive?: boolean;
}

// ============================================
// SELECT SHAPES
// ============================================

const CATEGORY_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  image: true,
  icon: true,
  color: true,
  parentId: true,
  businessUnitId: true,
  isActive: true,
  featured: true,
  sortOrder: true,
  metaTitle: true,
  metaDescription: true,
  createdAt: true,
  updatedAt: true,
  parent: {
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      icon: true,
      color: true,
    },
  },
  _count: {
    select: {
      products: { where: { isActive: true } },
      children: { where: { isActive: true } },
    },
  },
} satisfies Prisma.CategorySelect;

const CATEGORY_DETAIL_SELECT = {
  ...CATEGORY_LIST_SELECT,
  children: {
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      icon: true,
      color: true,
      parentId: true,
      isActive: true,
      featured: true,
      sortOrder: true,
      _count: {
        select: {
          products: { where: { isActive: true } },
          children: { where: { isActive: true } },
        },
      },
    },
  },
} satisfies Prisma.CategorySelect;

// ============================================
// SERVICE
// ============================================

export class CategoryService extends BaseService {
  // ------------------------------------------
  // BUSINESS UNIT RESOLUTION
  // ------------------------------------------

  private isValidID(id: string): boolean {
    if (!id || id === 'default') return false;
    const cuidRegex = /^c[a-z0-9]{24}$/i;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
    return cuidRegex.test(id) || uuidRegex.test(id) || simpleIdRegex.test(id);
  }

  private async ensureBusinessUnit(
    businessUnitId?: string,
  ): Promise<{ id: string; name: string }> {
    if (
      businessUnitId &&
      businessUnitId !== 'default' &&
      this.isValidID(businessUnitId)
    ) {
      const existing = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        select: { id: true, name: true },
      });
      if (existing) return existing;
    }

    const first = await this.prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });
    if (first) return first;

    let company = await this.prisma.company.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!company) {
      company = await this.prisma.company.create({
        data: {
          name: 'Default Company',
          email: 'default@company.com',
          phone: '+0000000000',
          isActive: true,
        },
      });
    }
    return this.prisma.businessUnit.create({
      data: {
        name: 'Default Business Unit',
        code: `BU-${Date.now().toString().slice(-6)}`,
        isActive: true,
        companyId: company.id,
        type: 'STORE',
      },
      select: { id: true, name: true },
    });
  }

  private async resolveBusinessUnitId(businessUnitId?: string): Promise<string> {
    const { id } = await this.ensureBusinessUnit(businessUnitId);
    return id;
  }

  // ------------------------------------------
  // HELPERS
  // ------------------------------------------

  private handleServiceError(error: any, method: string): never {
    console.error(`❌ ${method}:`, error);
    if (error instanceof AppError) throw error;
    throw new AppError(
      `Failed to ${method}: ${error?.message ?? 'Unknown error'}`,
      500,
    );
  }

  /**
   * Normalize a Prisma category record:
   *   _count.products  → productCount
   *   _count.children  → childCount
   * Removes the raw `_count` field and returns a flat object.
   */
  private normalizeCategory(cat: any) {
    if (!cat) return cat;

    const productCount = cat._count?.products ?? cat.productCount ?? 0;
    const childCount = cat._count?.children ?? cat.childCount ?? 0;

    const normalizedChildren = Array.isArray(cat.children)
      ? cat.children.map((c: any) => this.normalizeCategory(c))
      : cat.children;

    const { _count, children, ...rest } = cat;
    return {
      ...rest,
      ...(children !== undefined ? { children: normalizedChildren } : {}),
      productCount,
      childCount,
    };
  }

  private async ensureUniqueSlug(
    baseSlug: string,
    businessUnitId: string,
    excludeId?: string,
  ): Promise<string> {
    const clean = baseSlug || 'category';
    let candidate = clean;
    let counter = 2;
    for (let i = 0; i < 100; i++) {
      const existing = await this.prisma.category.findFirst({
        where: {
          slug: candidate,
          businessUnitId,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });
      if (!existing) return candidate;
      candidate = `${clean}-${counter++}`;
    }
    return `${clean}-${Date.now()}`;
  }

  /**
   * Roll up inventory stats across a set of products. Each product's
   * `inventory` field is `Inventory | null` (singular relation).
   */
  private computeProductRollup(
    products: Array<{
      unitPrice: number;
      inventory?: { quantity: number; reserved: number; available: number } | null;
    }>,
  ) {
    let totalStock = 0;
    let inStockCount = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;

    for (const p of products) {
      const inv = p.inventory;
      const available = inv
        ? Math.max(0, (inv.quantity ?? 0) - (inv.reserved ?? 0))
        : 0;

      totalStock += inv?.quantity ?? 0;
      totalInventoryValue += (inv?.quantity ?? 0) * (p.unitPrice ?? 0);

      if (available > 0) inStockCount += 1;
      else outOfStockCount += 1;
    }

    return { totalStock, totalInventoryValue, inStockCount, outOfStockCount };
  }

  // ------------------------------------------
  // PUBLIC READ METHODS (no auth)
  // ------------------------------------------

  async getPublicCategories(
    params: {
      businessUnitId?: string;
      limit?: number;
      search?: string;
      featuredOnly?: boolean;
    } = {},
  ) {
    try {
      const { businessUnitId, limit = 100, search, featuredOnly } = params;
      const businessUnit = await this.ensureBusinessUnit(businessUnitId);

      const where: Prisma.CategoryWhereInput = {
        businessUnitId: businessUnit.id,
        isActive: true,
      };

      if (featuredOnly) where.featured = true;

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const categories = await this.prisma.category.findMany({
        where,
        take: Math.min(200, Math.max(1, limit)),
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: CATEGORY_LIST_SELECT,
      });

      return categories.map((c) => this.normalizeCategory(c));
    } catch (error) {
      console.error('getPublicCategories failed:', error);
      return [];
    }
  }

  async getPublicCategoryTree(businessUnitId?: string) {
    try {
      const businessUnit = await this.ensureBusinessUnit(businessUnitId);

      const flat = await this.prisma.category.findMany({
        where: { businessUnitId: businessUnit.id, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: CATEGORY_LIST_SELECT,
      });

      const normalized = flat.map((c) => this.normalizeCategory(c));

      const buildTree = (items: any[], parentId: string | null = null): any[] =>
        items
          .filter((item) => item.parentId === parentId)
          .map((item) => ({
            ...item,
            children: buildTree(items, item.id),
          }));

      return buildTree(normalized);
    } catch (error) {
      console.error('getPublicCategoryTree failed:', error);
      return [];
    }
  }

  /**
   * Public version of getCategoryWithProducts — no auth required.
   * Falls back to an empty shell if the category doesn't exist or
   * isn't active.
   */
  async getPublicCategoryWithProducts(
    id: string,
    params: GetCategoryWithProductsParams = {},
  ) {
    try {
      if (!id) throw new AppError('Category ID is required', 400);

      const category = await this.prisma.category.findUnique({
        where: { id },
        select: { id: true, isActive: true },
      });

      if (!category || !category.isActive) return null;

      return await this.getCategoryWithProductsInternal(id, params, true);
    } catch (error) {
      console.error('getPublicCategoryWithProducts failed:', error);
      return null;
    }
  }

  // ------------------------------------------
  // AUTHENTICATED READ METHODS
  // ------------------------------------------

  async getAllCategories(params: ListParams) {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        businessUnitId,
        parentId,
        isActive,
        featured,
        sortBy = 'sortOrder',
        sortOrder = 'asc',
      } = params;

      const take = Math.min(200, Math.max(1, Number(limit) || 20));
      const currentPage = Math.max(1, Number(page) || 1);
      const skip = (currentPage - 1) * take;

      const where: Prisma.CategoryWhereInput = {};

      if (businessUnitId && businessUnitId !== 'default') {
        const bu = await this.ensureBusinessUnit(businessUnitId);
        where.businessUnitId = bu.id;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (parentId !== undefined) where.parentId = parentId;
      if (isActive !== undefined) where.isActive = isActive;
      if (featured !== undefined) where.featured = featured;

      const validSortFields = [
        'name',
        'createdAt',
        'updatedAt',
        'sortOrder',
        'productCount',
      ] as const;
      const safeSortBy = (validSortFields as readonly string[]).includes(sortBy)
        ? sortBy
        : 'sortOrder';

      const orderBy: Prisma.CategoryOrderByWithRelationInput[] =
        safeSortBy === 'productCount'
          ? [{ products: { _count: sortOrder } }]
          : [{ [safeSortBy]: sortOrder }, { name: 'asc' }];

      const [categories, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          skip,
          take,
          orderBy,
          select: CATEGORY_LIST_SELECT,
        }),
        this.prisma.category.count({ where }),
      ]);

      return {
        categories: categories.map((c) => this.normalizeCategory(c)),
        total,
        page: currentPage,
        totalPages: Math.ceil(total / take),
        limit: take,
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getAllCategories');
    }
  }

  async getCategoryById(id: string) {
    try {
      if (!id) throw new AppError('Category ID is required', 400);

      const category = await this.prisma.category.findUnique({
        where: { id },
        select: CATEGORY_DETAIL_SELECT,
      });

      if (!category) throw new AppError('Category not found', 404);

      const normalized = this.normalizeCategory(category);

      const products = await this.prisma.product.findMany({
        where: { categoryId: id, isActive: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          sku: true,
          unitPrice: true,
          images: { take: 1, orderBy: { order: 'asc' }, select: { url: true } },
        },
      });

      return {
        ...normalized,
        recentProducts: products.map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          unitPrice: p.unitPrice,
          image: p.images?.[0]?.url ?? null,
        })),
      };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryById');
    }
  }

  async getCategoryBySlug(slug: string, businessUnitId?: string) {
    try {
      if (!slug) throw new AppError('Category slug is required', 400);
      const resolved = businessUnitId
        ? await this.resolveBusinessUnitId(businessUnitId)
        : undefined;

      const category = await this.prisma.category.findFirst({
        where: {
          slug,
          ...(resolved ? { businessUnitId: resolved } : {}),
        },
        select: CATEGORY_DETAIL_SELECT,
      });

      if (!category) throw new AppError('Category not found', 404);
      return this.normalizeCategory(category);
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryBySlug');
    }
  }

  async getCategoryByName(name: string, businessUnitId?: string) {
    try {
      if (!name) throw new AppError('Category name is required', 400);
      const resolved = businessUnitId
        ? await this.resolveBusinessUnitId(businessUnitId)
        : undefined;

      const category = await this.prisma.category.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          ...(resolved ? { businessUnitId: resolved } : {}),
        },
        select: CATEGORY_DETAIL_SELECT,
      });

      if (!category) throw new AppError('Category not found', 404);
      return this.normalizeCategory(category);
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryByName');
    }
  }

  async getSubcategories(parentId: string) {
    try {
      if (!parentId) throw new AppError('Parent category ID is required', 400);

      const parent = await this.prisma.category.findUnique({
        where: { id: parentId },
        select: { id: true },
      });
      if (!parent) throw new AppError('Parent category not found', 404);

      const subs = await this.prisma.category.findMany({
        where: { parentId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: CATEGORY_LIST_SELECT,
      });

      return subs.map((s) => this.normalizeCategory(s));
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getSubcategories');
    }
  }

  async getCategoryTree(businessUnitId: string) {
    try {
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);
      return this.getPublicCategoryTree(businessUnitId);
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.getCategoryTree');
    }
  }

  async getCategoryProducts(
    id: string,
    params?: { page?: number; limit?: number },
  ) {
    try {
      if (!id) throw new AppError('Category ID is required', 400);
      const { page = 1, limit = 12 } = params || {};
      const take = Math.max(1, Math.min(100, limit));
      const skip = (Math.max(1, page) - 1) * take;

      const category = await this.prisma.category.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!category) throw new AppError('Category not found', 404);

      const where: Prisma.ProductWhereInput = {
        categoryId: id,
        isActive: true,
      };

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: {
            images: { orderBy: { order: 'asc' } },
            category: { select: { id: true, name: true, slug: true } },
            inventory: true,
            variants: { where: { isActive: true } },
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      return {
        products,
        total,
        page,
        totalPages: Math.ceil(total / take),
        limit: take,
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'CategoryService.getCategoryProducts',
      );
    }
  }

  // ------------------------------------------
  // getCategoryWithProducts — PUBLIC ENTRY
  // ------------------------------------------

  /**
   * Get a category with its full product list, children, and rollups.
   *
   * Returns:
   *   - All category fields (image, icon, color, slug, etc.)
   *   - `children` — active subcategories (each with productCount)
   *   - `products` — full product previews with primary image + stock
   *   - `productCount` — active product count
   *   - `childCount` — active child count
   *   - `totalInventoryValue` — SUM(inventory.quantity * product.unitPrice)
   *   - `totalStock` — SUM(inventory.quantity)
   *   - `inStockCount` / `outOfStockCount` — products by availability
   */
  async getCategoryWithProducts(
    id: string,
    params: GetCategoryWithProductsParams = {},
  ) {
    try {
      if (!id) throw new AppError('Category ID is required', 400);
      return await this.getCategoryWithProductsInternal(id, params, false);
    } catch (error) {
      return this.handleServiceError(
        error,
        'CategoryService.getCategoryWithProducts',
      );
    }
  }

  /**
   * Shared implementation for authenticated and public variants.
   * `publicOnly` restricts the product query to active products.
   */
  private async getCategoryWithProductsInternal(
    id: string,
    params: GetCategoryWithProductsParams,
    publicOnly: boolean,
  ) {
    const { productLimit = 50, includeInactive = false } = params;

    const category = await this.prisma.category.findUnique({
      where: { id },
      select: {
        ...CATEGORY_DETAIL_SELECT,
        businessUnit: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!category) throw new AppError('Category not found', 404);

    const includeInactiveProducts = publicOnly ? false : includeInactive;

    const productWhere: Prisma.ProductWhereInput = {
      categoryId: id,
      ...(includeInactiveProducts ? {} : { isActive: true }),
    };

    const [products, totalProductCount, inStockAgg] = await Promise.all([
      this.prisma.product.findMany({
        where: productWhere,
        take: Math.min(200, Math.max(1, productLimit)),
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          name: true,
          sku: true,
          unitPrice: true,
          costPrice: true,
          isActive: true,
          featured: true,
          categoryId: true,
          images: {
            orderBy: [{ isPrimary: 'desc' }, { order: 'asc' }],
            take: 1,
            select: { url: true, alt: true },
          },
          inventory: {
            select: {
              quantity: true,
              reserved: true,
              available: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where: productWhere }),
      this.prisma.product.findMany({
        where: productWhere,
        select: {
          unitPrice: true,
          inventory: {
            select: { quantity: true, reserved: true, available: true },
          },
        },
      }),
    ]);

    const rollup = this.computeProductRollup(inStockAgg);

    const normalizedCategory = this.normalizeCategory(category);

    return {
      ...normalizedCategory,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        unitPrice: p.unitPrice,
        costPrice: p.costPrice,
        isActive: p.isActive,
        categoryId: p.categoryId,
        image: p.images?.[0]?.url ?? null,
        images: p.images?.map((i) => ({ url: i.url, alt: i.alt })) ?? [],
      })),
      productCount: totalProductCount,
      childCount: (normalizedCategory as any).childCount ?? 0,
      totalInventoryValue: rollup.totalInventoryValue,
      totalStock: rollup.totalStock,
      inStockCount: rollup.inStockCount,
      outOfStockCount: rollup.outOfStockCount,
    };
  }

  // ------------------------------------------
  // STATISTICS
  // ------------------------------------------

  async getCategoryStatistics(businessUnitId?: string) {
    try {
      const resolved = await this.resolveBusinessUnitId(businessUnitId);

      const [
        total,
        active,
        inactive,
        featured,
        withImages,
        withProducts,
        totalProducts,
      ] = await Promise.all([
        this.prisma.category.count({ where: { businessUnitId: resolved } }),
        this.prisma.category.count({
          where: { businessUnitId: resolved, isActive: true },
        }),
        this.prisma.category.count({
          where: { businessUnitId: resolved, isActive: false },
        }),
        this.prisma.category.count({
          where: { businessUnitId: resolved, featured: true },
        }),
        this.prisma.category.count({
          where: { businessUnitId: resolved, image: { not: null } },
        }),
        this.prisma.category.count({
          where: {
            businessUnitId: resolved,
            products: { some: { isActive: true } },
          },
        }),
        this.prisma.product.count({
          where: {
            businessUnitId: resolved,
            isActive: true,
            categoryId: { not: null },
          },
        }),
      ]);

      return {
        total,
        active,
        inactive,
        featured,
        withImages,
        withProducts,
        withoutProducts: total - withProducts,
        totalProducts,
        averageProductsPerCategory:
          withProducts > 0 ? totalProducts / withProducts : 0,
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'CategoryService.getCategoryStatistics',
      );
    }
  }

  // ------------------------------------------
  // WRITE METHODS
  // ------------------------------------------

  async createCategory(data: CreateCategoryData) {
    try {
      if (!data.name) throw new AppError('Category name is required', 400);

      const businessUnit = await this.ensureBusinessUnit(data.businessUnitId);

      if (data.parentId) {
        const parent = await this.prisma.category.findUnique({
          where: { id: data.parentId },
          select: { id: true, businessUnitId: true },
        });
        if (!parent) throw new AppError('Parent category not found', 404);
        if (parent.businessUnitId !== businessUnit.id) {
          throw new AppError(
            'Parent category must belong to the same business unit',
            400,
          );
        }
      }

      const baseSlug = data.slug?.trim() || generateSlug(data.name);
      const slug = await this.ensureUniqueSlug(baseSlug, businessUnit.id);

      const dup = await this.prisma.category.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          businessUnitId: businessUnit.id,
          parentId: data.parentId ?? null,
        },
        select: { id: true },
      });
      if (dup) {
        throw new AppError(
          `Category "${data.name}" already exists in this location`,
          409,
        );
      }

      const created = await this.prisma.category.create({
        data: {
          name: data.name,
          slug,
          description: data.description ?? null,
          image: data.image ?? null,
          icon: data.icon ?? null,
          color: data.color ?? null,
          parentId: data.parentId ?? null,
          businessUnitId: businessUnit.id,
          isActive: data.isActive ?? true,
          featured: data.featured ?? false,
          sortOrder: data.sortOrder ?? 0,
          metaTitle: data.metaTitle ?? null,
          metaDescription: data.metaDescription ?? null,
        },
        select: CATEGORY_DETAIL_SELECT,
      });

      return this.normalizeCategory(created);
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.createCategory');
    }
  }

  async updateCategory(id: string, data: UpdateCategoryData) {
    try {
      if (!id) throw new AppError('Category ID is required', 400);

      const existing = await this.prisma.category.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          businessUnitId: true,
          parentId: true,
        },
      });
      if (!existing) throw new AppError('Category not found', 404);

      const update: Prisma.CategoryUpdateInput = {};

      if (data.name !== undefined) update.name = data.name;

      if (data.slug !== undefined) {
        update.slug = await this.ensureUniqueSlug(
          data.slug,
          existing.businessUnitId,
          id,
        );
      } else if (data.name !== undefined && data.name !== existing.name) {
        update.slug = await this.ensureUniqueSlug(
          generateSlug(data.name),
          existing.businessUnitId,
          id,
        );
      }

      if (data.description !== undefined)
        update.description = data.description ?? null;
      if (data.image !== undefined) update.image = data.image ?? null;
      if (data.icon !== undefined) update.icon = data.icon ?? null;
      if (data.color !== undefined) update.color = data.color ?? null;
      if (data.isActive !== undefined) update.isActive = data.isActive;
      if (data.featured !== undefined) update.featured = data.featured;
      if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder;
      if (data.metaTitle !== undefined)
        update.metaTitle = data.metaTitle ?? null;
      if (data.metaDescription !== undefined)
        update.metaDescription = data.metaDescription ?? null;

      if (data.parentId !== undefined) {
        if (data.parentId === id) {
          throw new AppError('Category cannot be its own parent', 400);
        }
        if (data.parentId) {
          const parent = await this.prisma.category.findUnique({
            where: { id: data.parentId },
            select: { id: true, businessUnitId: true },
          });
          if (!parent) throw new AppError('Parent category not found', 404);
          if (parent.businessUnitId !== existing.businessUnitId) {
            throw new AppError(
              'Parent category must belong to the same business unit',
              400,
            );
          }

          const visited = new Set<string>();
          let cursor: string | null = parent.id;
          while (cursor) {
            if (visited.has(cursor) || cursor === id) {
              throw new AppError(
                'Circular reference detected in category hierarchy',
                400,
              );
            }
            visited.add(cursor);
            const next: { parentId: string | null } | null =
              await this.prisma.category.findUnique({
                where: { id: cursor },
                select: { parentId: true },
              });
            cursor = next?.parentId ?? null;
          }
        }
        update.parent = data.parentId
          ? { connect: { id: data.parentId } }
          : { disconnect: true };
      }

      const updated = await this.prisma.category.update({
        where: { id },
        data: update,
        select: CATEGORY_DETAIL_SELECT,
      });

      return this.normalizeCategory(updated);
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.updateCategory');
    }
  }

  async toggleCategoryStatus(id: string, isActive: boolean) {
    try {
      if (!id) throw new AppError('Category ID is required', 400);

      const existing = await this.prisma.category.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) throw new AppError('Category not found', 404);

      const updated = await this.prisma.category.update({
        where: { id },
        data: { isActive },
        select: CATEGORY_DETAIL_SELECT,
      });

      if (!isActive) {
        await this.prisma.category.updateMany({
          where: { parentId: id },
          data: { isActive: false },
        });
      }

      return this.normalizeCategory(updated);
    } catch (error) {
      return this.handleServiceError(
        error,
        'CategoryService.toggleCategoryStatus',
      );
    }
  }

  async deleteCategory(id: string) {
    try {
      if (!id) throw new AppError('Category ID is required', 400);

      const category = await this.prisma.category.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              children: true,
              products: { where: { isActive: true } },
            },
          },
        },
      });
      if (!category) throw new AppError('Category not found', 404);

      if (category._count.children > 0) {
        throw new AppError(
          'Cannot delete a category with child categories. Reassign or delete children first.',
          400,
        );
      }

      if (category._count.products > 0) {
        await this.prisma.category.update({
          where: { id },
          data: { isActive: false },
        });
        return {
          message: 'Category archived (soft deleted) due to existing products',
          softDeleted: true,
        };
      }

      await this.prisma.category.delete({ where: { id } });
      return { message: 'Category deleted successfully', softDeleted: false };
    } catch (error) {
      return this.handleServiceError(error, 'CategoryService.deleteCategory');
    }
  }

  async bulkDeleteCategories(ids: string[]) {
    try {
      if (!ids?.length) throw new AppError('No category IDs provided', 400);

      const categories = await this.prisma.category.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              children: true,
              products: { where: { isActive: true } },
            },
          },
        },
      });

      const errors: string[] = [];
      const hardDelete: string[] = [];
      const softDelete: string[] = [];

      for (const c of categories) {
        if (c._count.children > 0) {
          errors.push(
            `"${c.name}" has ${c._count.children} child categories and was skipped`,
          );
        } else if (c._count.products > 0) {
          softDelete.push(c.id);
        } else {
          hardDelete.push(c.id);
        }
      }

      let deletedCount = 0;

      if (hardDelete.length) {
        const r = await this.prisma.category.deleteMany({
          where: { id: { in: hardDelete } },
        });
        deletedCount += r.count;
      }
      if (softDelete.length) {
        const r = await this.prisma.category.updateMany({
          where: { id: { in: softDelete } },
          data: { isActive: false },
        });
        deletedCount += r.count;
      }

      return {
        deletedCount,
        errors,
        message: `${deletedCount} categories processed successfully`,
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'CategoryService.bulkDeleteCategories',
      );
    }
  }
}

export default CategoryService;
