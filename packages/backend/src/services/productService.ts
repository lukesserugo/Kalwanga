// src/services/productService.ts
// PART 1 of 7

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';

// ============================================
// INTERFACES
// ============================================

export interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  productId?: string;
  productName?: string;
  sku?: string;
  price?: number;
  format?: 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR';
  generatedAt?: string;
}

export interface GenerateBarcodeOptions {
  prefix?: string;
  length?: number;
  productName?: string;
  sku?: string;
  format?: 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR';
  includeQR?: boolean;
}

export interface ProductCreateData {
  name: string;
  sku?: string;
  description?: string;
  unitPrice?: number;
  costPrice?: number;
  barcode?: string;
  categoryId?: string;
  category?: string | { id: string };
  businessUnitId: string;
  isActive?: boolean;
  featured?: boolean;
  isDigital?: boolean;
  taxRate?: number;
  weight?: number;
  minStock?: number;
  maxStock?: number;
  tags?: string[];
  images?: string[];
  stock?: number;
  initialStock?: number;
  location?: string;
  supplier?: string;
  supplierId?: string;
  notes?: string;
  attributes?: Record<string, any>;
  seo?: Record<string, any>;
  dimensions?: string;
  variants?: Array<{
    name: string;
    sku?: string;
    price: number;
    costPrice?: number;
    stock: number;
    images?: string[];
    attributes: Record<string, any>;
    isActive?: boolean;
    barcode?: string;
    location?: string;
  }>;
}

export interface ProductUpdateData {
  name?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  unitPrice?: number;
  costPrice?: number;
  taxRate?: number;
  minStock?: number;
  maxStock?: number;
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
  weight?: number;
  dimensions?: string;
  images?: string[];
  attributes?: Record<string, any>;
  notes?: string;
  tags?: string[];
  seo?: Record<string, any>;
  categoryId?: string;
  category?: string | { id: string };
  supplierId?: string;
  supplier?: string;
  location?: string;
  variants?: Array<{
    id?: string;
    name: string;
    sku?: string;
    price: number;
    costPrice?: number;
    stock: number;
    images?: string[];
    attributes: Record<string, any>;
    isActive?: boolean;
    barcode?: string;
  }>;
}

export interface VariantCreateData {
  name: string;
  sku?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  images?: string[];
  attributes?: Record<string, any>;
  location?: string;
  isActive?: boolean;
  barcode?: string;
}

export interface VariantUpdateData {
  name?: string;
  sku?: string;
  price?: number;
  costPrice?: number;
  stock?: number;
  images?: string[];
  attributes?: Record<string, any>;
  isActive?: boolean;
}

// ============================================
// PRODUCT SERVICE
// ============================================

export class ProductService extends BaseService {
  // ============================================
  // STATIC CONSTANTS
  // ============================================
  private static readonly MAX_IMAGE_SIZE = 50 * 1024;
  private static readonly MAX_IMAGES = 3;
  private static readonly MAX_VARIANTS = 5;
  private static readonly PLACEHOLDER_IMAGE =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private safeEmitProductUpdate(product: any, businessUnitId: string): void {
    try {
      console.log(
        `📦 Product updated: ${product?.name || product?.id} - ${businessUnitId}`
      );
    } catch (error) {
      console.warn('Failed to emit product update:', error);
    }
  }

  private safeEmitInventoryUpdate(inventory: any, businessUnitId: string): void {
    try {
      console.log(`📦 Inventory updated: ${inventory?.id} - ${businessUnitId}`);
    } catch (error) {
      console.warn('Failed to emit inventory update:', error);
    }
  }

  private validateImage(img: any): string | null {
    if (typeof img !== 'string') return null;
    if (!img || img.length === 0) return null;

    if (img.startsWith('http://') || img.startsWith('https://')) {
      return img;
    }

    if (!img.startsWith('data:image/')) return null;

    try {
      const parts = img.split(',');
      if (parts.length !== 2) return null;
      if (!parts[1] || parts[1].length < 10) return null;

      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(parts[1])) return null;

      const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
      if (img.length > MAX_IMAGE_SIZE) {
        console.warn(
          `⚠️ Image too large (${Math.round(
            img.length / 1024 / 1024
          )}MB), skipping`
        );
        return null;
      }

      return img;
    } catch {
      return null;
    }
  }

  private cleanImages(images: any[]): string[] {
    if (!Array.isArray(images) || images.length === 0) {
      return [];
    }

    const cleaned: string[] = [];
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const MAX_IMAGES = 10;
    let validCount = 0;

    for (const img of images) {
      if (validCount >= MAX_IMAGES) break;
      if (typeof img !== 'string') continue;

      if (img.length > MAX_IMAGE_SIZE) {
        console.warn(
          `⚠️ Image too large (${Math.round(
            img.length / 1024 / 1024
          )}MB), skipping`
        );
        continue;
      }

      if (
        !img.startsWith('data:image/') &&
        !img.startsWith('http://') &&
        !img.startsWith('https://')
      ) {
        try {
          const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
          if (base64Regex.test(img.substring(0, 100))) {
            cleaned.push(`data:image/jpeg;base64,${img}`);
            validCount++;
            continue;
          }
        } catch {
          /* not base64 */
        }
        console.warn(
          `⚠️ Skipping invalid image format: ${img.substring(0, 50)}...`
        );
        continue;
      }

      cleaned.push(img);
      validCount++;
    }

    console.log(
      `📸 cleanImages: ${validCount} valid images out of ${images.length}`
    );
    return cleaned;
  }

  private extractCategoryId(
    categoryInput: string | { id: string } | undefined | null
  ): string | null {
    if (!categoryInput) return null;

    if (typeof categoryInput === 'string') {
      const trimmed = categoryInput.trim();
      if (
        !trimmed ||
        trimmed === 'null' ||
        trimmed === 'undefined' ||
        trimmed === ''
      ) {
        return null;
      }
      return trimmed;
    }

    if (
      typeof categoryInput === 'object' &&
      categoryInput !== null &&
      'id' in categoryInput
    ) {
      const id = categoryInput.id;
      if (id && typeof id === 'string') {
        const trimmed = id.trim();
        if (
          !trimmed ||
          trimmed === 'null' ||
          trimmed === 'undefined' ||
          trimmed === ''
        ) {
          return null;
        }
        return trimmed;
      }
    }

    return null;
  }

  private prepareCreateData(data: ProductCreateData, userId: string): any {
    const categoryId = this.extractCategoryId(data.categoryId || data.category);

    const unitPrice = data.unitPrice ?? 0;
    const costPrice = data.costPrice ?? unitPrice;
    const stock = data.stock ?? data.initialStock ?? 0;

    const images = this.cleanImages(data.images || []);

    let tags: string[] = [];
    if (Array.isArray(data.tags)) {
      tags = data.tags.filter(
        (t: any) => typeof t === 'string' && t.trim().length > 0
      );
    } else if (typeof data.tags === 'string') {
      tags = (data.tags as string)
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);
    } else if (data.tags) {
      try {
        const tagsString = String(data.tags);
        if (tagsString) {
          tags = tagsString
            .split(',')
            .map((t: string) => t.trim())
            .filter(Boolean);
        }
      } catch {
        tags = [];
      }
    }

    return {
      name: data.name?.trim(),
      description: data.description?.trim() || null,
      sku: this.generateSkuIfNeeded(data),
      barcode: data.barcode || undefined,
      unitPrice: Number(unitPrice),
      costPrice: Number(costPrice),
      taxRate: data.taxRate ? Number(data.taxRate) : 0,
      minStock: data.minStock ? Number(data.minStock) : 5,
      maxStock: data.maxStock ? Number(data.maxStock) : null,
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDigital: data.isDigital || false,
      featured: data.featured || false,
      weight: data.weight ? Number(data.weight) : null,
      dimensions: data.dimensions || null,
      images: images,
      attributes: data.attributes || null,
      notes: data.notes?.trim() || null,
      tags: tags,
      seo: data.seo || null,
      rating: 0,
      reviewCount: 0,
      status: 'ACTIVE',
      type: 'SIMPLE',
      taxType: 'EXCLUSIVE',
      categoryId: categoryId,
      supplierId: data.supplierId || null,
      businessUnitId: data.businessUnitId,
      createdBy: userId,
      updatedBy: userId,
      stock: Number(stock),
      location: data.location || 'Warehouse',
    };
  }

  private async validateCategory(
    categoryId: string | null | undefined,
    businessUnitId: string
  ): Promise<string | null> {
    if (!categoryId) return null;

    try {
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        console.warn(`⚠️ Category with ID "${categoryId}" not found`);
        return null;
      }

      if (category.businessUnitId !== businessUnitId) {
        console.warn(
          `⚠️ Category "${categoryId}" belongs to different business unit`
        );
        return null;
      }

      return categoryId;
    } catch (error) {
      console.warn(`⚠️ Error validating category:`, error);
      return null;
    }
  }

  private async validateSupplier(
    supplierId: string | null | undefined
  ): Promise<string | null> {
    if (!supplierId) return null;

    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        console.warn(`⚠️ Supplier with ID "${supplierId}" not found`);
        return null;
      }

      return supplierId;
    } catch (error) {
      console.warn(`⚠️ Error validating supplier:`, error);
      return null;
    }
  }

  private async generateUniqueBarcodeInternal(
    prefix: string = 'PRD',
    length: number = 12
  ): Promise<string> {
    let barcode: string;
    let counter = 0;

    do {
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      barcode = `${prefix}${timestamp}${random}`.slice(0, length);
      counter++;

      if (counter > 100) {
        throw new AppError(
          'Failed to generate unique barcode after 100 attempts',
          500
        );
      }
    } while (await this.prisma.product.findFirst({ where: { barcode } }));

    return barcode;
  }

  private generateBarcodeImageUrl(barcode: string, format?: string): string {
    const formatParam = format || 'EAN-13';
    return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(
      barcode
    )}&code=${formatParam}&dpi=96`;
  }

  private generateQRCodeUrl(
    name: string,
    sku: string,
    barcode: string
  ): string {
    const data = {
      product: name,
      sku: sku,
      barcode: barcode,
    };
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
      JSON.stringify(data)
    )}&size=150x150`;
  }

  private handleServiceError(error: any, methodName: string): never {
    console.error(`❌ Error in ${methodName}:`, error);
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new AppError(
          `Duplicate entry: ${error.meta?.target || 'field'} already exists`,
          400
        );
      }
      if (error.code === 'P2003') {
        throw new AppError('Foreign key constraint failed', 400);
      }
      if (error.code === 'P2025') {
        throw new AppError('Record not found', 404);
      }
    }
    throw new AppError(
      `Failed to ${methodName.replace('ProductService.', '')}: ${
        error.message || 'Unknown error'
      }`,
      500
    );
  }

  // ============================================
  // SKU METHODS
  // ============================================

  async checkSKUExists(
    sku: string,
    businessUnitId?: string,
    excludeProductId?: string
  ): Promise<boolean> {
    try {
      const where: any = {
        sku: { equals: sku.toUpperCase(), mode: 'insensitive' },
      };

      if (businessUnitId) {
        where.businessUnitId = businessUnitId;
      }

      if (excludeProductId) {
        where.id = { not: excludeProductId };
      }

      const existing = await this.prisma.product.findFirst({ where });
      return !!existing;
    } catch (error) {
      console.error('Error checking SKU:', error);
      return false;
    }
  }

  async ensureUniqueSKU(
    baseSKU: string,
    businessUnitId?: string,
    excludeProductId?: string
  ): Promise<string> {
    let sku = baseSKU.toUpperCase();
    let attempts = 0;
    const maxAttempts = 10;

    while (
      (await this.checkSKUExists(sku, businessUnitId, excludeProductId)) &&
      attempts < maxAttempts
    ) {
      const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
      sku = `${baseSKU.toUpperCase()}-${suffix}`;
      attempts++;
    }

    return sku;
  }

  generateProductSKU(productName?: string): string {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const prefix =
      (productName || 'PRD')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRD';
    return `${prefix}-${timestamp}-${random}`;
  }

  generateVariantSKU(productName?: string, variantName?: string): string {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    const basePrefix =
      (productName || 'PRD')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'PRD';
    const variantPrefix =
      (variantName || 'VAR')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'VAR';
    return `${basePrefix}-${variantPrefix}-${timestamp}-${random}`;
  }

  private generateSkuIfNeeded(data: ProductCreateData): string {
    if (data.sku && data.sku !== 'SKU' && data.sku.trim() !== '') {
      return data.sku.toUpperCase().trim();
    }
    return this.generateProductSKU(data.name);
  }

  // ===== END PART 1 of 7 =====

  // src/services/productService.ts
// PART 2 of 7

  // ============================================
  // GET PRODUCTS — ✅ accepts string | string[]
  // ============================================

  async getAllProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    businessUnitId?: string | string[];
    isActive?: boolean | string;
    minPrice?: number;
    maxPrice?: number;
    featured?: boolean | string;
    inStock?: boolean | string;
    minRating?: number;
    hasVariants?: boolean | string;
    hasBarcode?: boolean | string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isPublic?: boolean;
  }) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        categoryId,
        businessUnitId,
        isActive,
        minPrice,
        maxPrice,
        featured,
        inStock,
        minRating,
        hasVariants,
        hasBarcode,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        isPublic = false,
      } = params;

      const validatedPage = Math.max(1, Number(page) || 1);
      const validatedLimit = Math.min(200, Math.max(1, Number(limit) || 10));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = {};

      // ✅ FIX: support a single business unit ID OR an array of IDs
      if (businessUnitId) {
        if (Array.isArray(businessUnitId)) {
          if (businessUnitId.length > 0) {
            where.businessUnitId = { in: businessUnitId };
          }
        } else {
          where.businessUnitId = businessUnitId;
        }
      }

      if (isPublic) {
        where.isActive = true;
        where.deletedAt = null;
      } else if (isActive !== undefined) {
        where.isActive =
          typeof isActive === 'string' ? isActive === 'true' : isActive;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (categoryId) where.categoryId = categoryId;

      if (featured !== undefined) {
        where.featured =
          typeof featured === 'string' ? featured === 'true' : featured;
      }

      if (hasBarcode !== undefined) {
        const hasBarcodeBool =
          typeof hasBarcode === 'string' ? hasBarcode === 'true' : hasBarcode;
        if (hasBarcodeBool) {
          where.barcode = { not: null };
        } else {
          where.barcode = null;
        }
      }

      if (minRating !== undefined && !isNaN(Number(minRating))) {
        where.rating = { gte: Number(minRating) };
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        where.unitPrice = {};
        if (minPrice !== undefined && !isNaN(Number(minPrice))) {
          where.unitPrice.gte = Number(minPrice);
        }
        if (maxPrice !== undefined && !isNaN(Number(maxPrice))) {
          where.unitPrice.lte = Number(maxPrice);
        }
      }

      if (hasVariants !== undefined) {
        const hasVariantsBool =
          typeof hasVariants === 'string'
            ? hasVariants === 'true'
            : hasVariants;
        if (hasVariantsBool) {
          where.variants = { some: { isActive: true } };
        } else {
          where.variants = { none: {} };
        }
      }

      const orderBy: any = {};
      const validSortFields = [
        'name',
        'sku',
        'unitPrice',
        'createdAt',
        'updatedAt',
        'rating',
      ];
      if (validSortFields.includes(sortBy)) {
        orderBy[sortBy] = sortOrder;
      } else {
        orderBy.createdAt = 'desc';
      }

      let [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy,
          include: {
            category: true,
            inventory: true,
            variants: {
              where: { isActive: true },
              include: { inventory: true },
            },
            supplier: true,
            _count: {
              select: {
                saleItems: true,
                orderItems: true,
                reviews: true,
              },
            },
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      if (isPublic) {
        products = products.filter((product: any) => {
          const productInventory = product.inventory;
          const productAvailable = productInventory
            ? productInventory.quantity - (productInventory.reserved || 0)
            : 0;

          let hasVariantStock = false;
          if (product.variants && product.variants.length > 0) {
            hasVariantStock = product.variants.some((v: any) => {
              const variantInventory = v.inventory;
              if (!variantInventory) return false;
              return (
                variantInventory.quantity - (variantInventory.reserved || 0) > 0
              );
            });
          }

          const totalAvailable = productAvailable + (hasVariantStock ? 1 : 0);
          return totalAvailable > 0;
        });
        total = products.length;
      }

      if (inStock !== undefined) {
        const inStockBool =
          typeof inStock === 'string' ? inStock === 'true' : inStock;
        products = products.filter((product: any) => {
          const productInventory = product.inventory;
          const productAvailable = productInventory
            ? productInventory.quantity - (productInventory.reserved || 0)
            : 0;

          let hasVariantStock = false;
          if (product.variants && product.variants.length > 0) {
            hasVariantStock = product.variants.some((v: any) => {
              const variantInventory = v.inventory;
              if (!variantInventory) return false;
              return (
                variantInventory.quantity - (variantInventory.reserved || 0) > 0
              );
            });
          }

          const totalAvailable = productAvailable + (hasVariantStock ? 1 : 0);
          return inStockBool ? totalAvailable > 0 : totalAvailable === 0;
        });
        total = products.length;
      }

      const totalPages = Math.max(1, Math.ceil(total / validatedLimit));

      return {
        products,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages,
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getAllProducts');
    }
  }

  // ============================================
  // GET PRODUCT BY ID — ✅ guards undefined variants
  // ============================================

  async getProductById(id: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          inventory: true,
          variants: {
            where: { isActive: true },
            include: { inventory: true },
          },
          supplier: true,
          creator: {
            select: { id: true, firstName: true, lastName: true },
          },
          updater: {
            select: { id: true, firstName: true, lastName: true },
          },
          reviews: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              saleItems: true,
              orderItems: true,
              reviews: true,
            },
          },
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const productInventory = product.inventory;
      const productQuantity = productInventory?.quantity || 0;
      const productReserved = productInventory?.reserved || 0;
      const productAvailable = productQuantity - productReserved;

      let variantTotalStock = 0;
      let variantAvailable = 0;
      let variantReserved = 0;

      // ✅ FIX: guard against undefined variants
      const variantsArray = Array.isArray(product.variants)
        ? product.variants
        : [];

      for (const variant of variantsArray) {
        const variantInventory = variant.inventory;
        if (variantInventory) {
          const vQuantity = variantInventory.quantity || 0;
          const vReserved = variantInventory.reserved || 0;
          variantTotalStock += vQuantity;
          variantReserved += vReserved;
          variantAvailable += vQuantity - vReserved;
        } else {
          const vStock = variant.stock || 0;
          variantTotalStock += vStock;
          variantAvailable += vStock;
        }
      }

      const totalStock = productQuantity + variantTotalStock;
      const totalReserved = productReserved + variantReserved;
      const totalAvailable = productAvailable + variantAvailable;

      let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
      if (totalAvailable <= 0) {
        stockStatus = 'out_of_stock';
      } else if (totalAvailable <= (product.minStock || 5)) {
        stockStatus = 'low_stock';
      }

      return {
        ...product,
        totalStock,
        totalReserved,
        totalAvailable,
        productStock: productQuantity,
        productReserved,
        productAvailable,
        variantStock: variantTotalStock,
        variantReserved,
        variantAvailable,
        stockStatus,
        isLowStock: stockStatus === 'low_stock',
        isOutOfStock: stockStatus === 'out_of_stock',
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductById');
    }
  }

  async getProductBySku(sku: string, businessUnitId?: string) {
    try {
      const where: any = { sku: { equals: sku, mode: 'insensitive' } };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const product = await this.prisma.product.findFirst({
        where,
        include: {
          category: true,
          inventory: true,
          variants: {
            where: { isActive: true },
            include: { inventory: true },
          },
          supplier: true,
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      return product;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductBySku');
    }
  }

  async getProductByBarcode(barcode: string, businessUnitId?: string) {
    try {
      console.log(`🔍 Looking for product with barcode: "${barcode}"`);

      const where: any = { barcode };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const product = await this.prisma.product.findFirst({
        where,
        include: {
          category: true,
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
          variants: {
            where: { isActive: true },
            include: {
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
            },
          },
          supplier: true,
        },
      });

      if (!product) {
        console.warn(`❌ Product with barcode "${barcode}" not found`);
        throw new AppError(`Product with barcode "${barcode}" not found`, 404);
      }

      console.log(`✅ Found product: ${product.name} (${product.id})`);
      return product;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductByBarcode');
    }
  }

  // ===== END PART 2 of 7 =====

  // src/services/productService.ts
// PART 3 of 7

  // ============================================
  // CREATE PRODUCT — ✅ global SKU uniqueness
  // ============================================

  async createProduct(data: ProductCreateData, userId: string) {
    try {
      console.log('📝 Creating product with data:', {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        categoryId: data.categoryId || data.category,
        businessUnitId: data.businessUnitId,
        imagesCount: data.images?.length || 0,
        variantsCount: data.variants?.length || 0,
      });

      if (!data.name) {
        throw new AppError('Product name is required', 400);
      }

      if (!data.businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }

      // Resolve valid user ID
      let validUserId: string;
      try {
        let user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          user = await this.prisma.user.findUnique({ where: { clerkId: userId } });
        }
        if (user) {
          validUserId = user.id;
        } else {
          const uniqueId = `system_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 8)}`;
          const newSystemUser = await this.prisma.user.create({
            data: {
              clerkId: uniqueId,
              email: `system+${uniqueId}@example.com`,
              firstName: 'System',
              lastName: 'User',
              role: 'SUPER_ADMIN',
              isActive: true,
            },
          });
          validUserId = newSystemUser.id;
        }
      } catch (userError) {
        const anyUser = await this.prisma.user.findFirst();
        if (anyUser) {
          validUserId = anyUser.id;
        } else {
          const uniqueId = `fallback_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 6)}`;
          const newUser = await this.prisma.user.create({
            data: {
              clerkId: uniqueId,
              email: `fallback+${uniqueId}@example.com`,
              firstName: 'Fallback',
              lastName: 'User',
              role: 'SUPER_ADMIN',
              isActive: true,
            },
          });
          validUserId = newUser.id;
        }
      }

      // Prepare and validate data
      const preparedData = this.prepareCreateData(data, validUserId);

      // Ensure SKU
      if (!preparedData.sku || preparedData.sku === 'SKU') {
        preparedData.sku = this.generateProductSKU(data.name);
      }

      // ✅ FIX: Product.sku is @unique globally in Prisma — check globally
      const existingSku = await this.prisma.product.findFirst({
        where: {
          sku: { equals: preparedData.sku, mode: 'insensitive' },
        },
      });

      if (existingSku) {
        preparedData.sku = await this.ensureUniqueSKU(preparedData.sku);
      }

      // Generate barcode if needed
      if (!preparedData.barcode) {
        preparedData.barcode = await this.generateUniqueBarcodeInternal('PRD', 12);
      }

      if (preparedData.barcode) {
        const existingBarcode = await this.prisma.product.findFirst({
          where: { barcode: preparedData.barcode },
        });
        if (existingBarcode) {
          throw new AppError(
            `Product with barcode "${preparedData.barcode}" already exists`,
            400
          );
        }
      }

      // Validate category and supplier
      const validatedCategoryId = await this.validateCategory(
        preparedData.categoryId,
        data.businessUnitId
      );
      preparedData.categoryId = validatedCategoryId;

      const validatedSupplierId = await this.validateSupplier(
        preparedData.supplierId
      );
      preparedData.supplierId = validatedSupplierId;

      // Process variants
      let variantsToCreate: any[] = [];
      if (
        data.variants &&
        Array.isArray(data.variants) &&
        data.variants.length > 0
      ) {
        let variantData = data.variants;
        const MAX_VARIANTS = 10;
        if (variantData.length > MAX_VARIANTS) {
          variantData = variantData.slice(0, MAX_VARIANTS);
        }

        variantsToCreate = variantData.map((variant, index) => {
          let variantImages = variant.images || [];
          if (Array.isArray(variantImages)) {
            variantImages = variantImages.filter((img: string) => {
              if (typeof img !== 'string') return false;
              const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
              if (img.length > MAX_IMAGE_SIZE) {
                console.warn(
                  `⚠️ Variant image too large (${Math.round(
                    img.length / 1024 / 1024
                  )}MB), skipping`
                );
                return false;
              }
              return true;
            });
          }

          let variantSku = variant.sku;
          if (!variantSku || variantSku === 'SKU' || variantSku.trim() === '') {
            variantSku = this.generateVariantSKU(
              data.name,
              variant.name || `VAR${index + 1}`
            );
          }

          return {
            ...variant,
            sku: variantSku.toUpperCase().trim(),
            images: variantImages,
            price: variant.price || data.unitPrice || 0,
            costPrice: variant.costPrice || data.costPrice || 0,
            stock: variant.stock || 0,
            attributes: variant.attributes || {},
            isActive: variant.isActive !== undefined ? variant.isActive : true,
          };
        });
      }

      // Create product in transaction
      const product = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const inventory = await tx.inventory.create({
            data: {
              businessUnitId: preparedData.businessUnitId,
              quantity: preparedData.stock,
              reserved: 0,
              available: preparedData.stock,
              reorderPoint: preparedData.minStock,
              reorderQuantity: 10,
              location: preparedData.location || 'Warehouse',
              supplier: preparedData.supplier || null,
              notes: preparedData.notes || null,
              status: 'ACTIVE',
            },
          });

          const createdProduct = await tx.product.create({
            data: {
              name: preparedData.name,
              description: preparedData.description,
              sku: preparedData.sku,
              barcode: preparedData.barcode,
              unitPrice: preparedData.unitPrice,
              costPrice: preparedData.costPrice,
              taxRate: preparedData.taxRate,
              minStock: preparedData.minStock,
              maxStock: preparedData.maxStock,
              isActive: preparedData.isActive,
              isDigital: preparedData.isDigital,
              featured: preparedData.featured,
              weight: preparedData.weight,
              dimensions: preparedData.dimensions,
              images: preparedData.images,
              attributes: preparedData.attributes,
              notes: preparedData.notes,
              tags: preparedData.tags,
              seo: preparedData.seo,
              rating: 0,
              reviewCount: 0,
              status: preparedData.status,
              type: preparedData.type,
              taxType: preparedData.taxType,
              categoryId: preparedData.categoryId,
              supplierId: preparedData.supplierId,
              businessUnitId: preparedData.businessUnitId,
              createdBy: validUserId,
              updatedBy: validUserId,
              inventoryId: inventory.id,
            },
          });

          console.log(
            `📸 Product created with ${createdProduct.images?.length || 0} images`
          );

          if (preparedData.stock > 0) {
            await tx.inventoryTransaction.create({
              data: {
                transactionType: 'INITIAL',
                quantity: preparedData.stock,
                notes: `Initial stock for product ${createdProduct.name}`,
                productId: createdProduct.id,
                inventoryId: inventory.id,
                businessUnitId: preparedData.businessUnitId,
                userId: validUserId,
              },
            });
          }

          if (variantsToCreate.length > 0) {
            for (const variantData of variantsToCreate) {
              try {
                const existingVariantSku = await tx.productVariant.findFirst({
                  where: { sku: variantData.sku },
                });

                let finalSku = variantData.sku;
                if (existingVariantSku) {
                  finalSku = this.generateVariantSKU(
                    data.name,
                    variantData.name
                  );
                }

                const variant = await tx.productVariant.create({
                  data: {
                    productId: createdProduct.id,
                    name: variantData.name,
                    sku: finalSku,
                    price: variantData.price,
                    costPrice: variantData.costPrice || 0,
                    stock: variantData.stock || 0,
                    images: variantData.images || [],
                    attributes: variantData.attributes || {},
                    isActive:
                      variantData.isActive !== undefined
                        ? variantData.isActive
                        : true,
                    barcode: variantData.barcode || null,
                  },
                });

                const variantInventory = await tx.inventory.create({
                  data: {
                    businessUnitId: preparedData.businessUnitId,
                    quantity: variantData.stock || 0,
                    reserved: 0,
                    available: variantData.stock || 0,
                    reorderPoint: 5,
                    reorderQuantity: 10,
                    location: variantData.location || 'Warehouse',
                    status: 'ACTIVE',
                  },
                });

                await tx.productVariant.update({
                  where: { id: variant.id },
                  data: { inventoryId: variantInventory.id },
                });

                if ((variantData.stock || 0) > 0) {
                  await tx.inventoryTransaction.create({
                    data: {
                      transactionType: 'INITIAL',
                      quantity: variantData.stock,
                      notes: `Initial stock for variant ${variantData.name}`,
                      productId: createdProduct.id,
                      variantId: variant.id,
                      inventoryId: variantInventory.id,
                      businessUnitId: preparedData.businessUnitId,
                      userId: validUserId,
                    },
                  });
                }
              } catch (variantError) {
                console.error(
                  `❌ Failed to create variant ${variantData.name}:`,
                  variantError
                );
              }
            }

            const createdVariants = await tx.productVariant.count({
              where: { productId: createdProduct.id },
            });

            if (createdVariants > 0) {
              await tx.product.update({
                where: { id: createdProduct.id },
                data: { type: 'VARIABLE' },
              });
            }
          }

          try {
            await tx.auditLog.create({
              data: {
                action: 'CREATE',
                entityType: 'PRODUCT',
                entityId: createdProduct.id,
                userId: validUserId,
                entityName: createdProduct.name,
                changes: {
                  name: createdProduct.name,
                  sku: createdProduct.sku,
                  price: createdProduct.unitPrice,
                  barcode: createdProduct.barcode,
                  inventoryId: inventory.id,
                  variantCount: variantsToCreate.length,
                  categoryId: createdProduct.categoryId,
                  imagesCount: createdProduct.images?.length || 0,
                },
                severity: 'INFO',
                businessUnitId: preparedData.businessUnitId,
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation failed:', auditError);
          }

          this.safeEmitProductUpdate(createdProduct, preparedData.businessUnitId);
          this.safeEmitInventoryUpdate(inventory, preparedData.businessUnitId);

          return await tx.product.findUnique({
            where: { id: createdProduct.id },
            include: {
              category: true,
              inventory: true,
              variants: {
                include: { inventory: true },
              },
              supplier: true,
              creator: {
                select: { id: true, firstName: true, lastName: true },
              },
              updater: {
                select: { id: true, firstName: true, lastName: true },
              },
              reviews: {
                take: 5,
                orderBy: { createdAt: 'desc' },
                include: {
                  user: {
                    select: { id: true, firstName: true, lastName: true },
                  },
                },
              },
              _count: {
                select: {
                  saleItems: true,
                  orderItems: true,
                  reviews: true,
                },
              },
            },
          });
        }
      );

      if (!product) {
        throw new AppError('Failed to create product', 500);
      }

      if (!product.id) {
        console.error('❌ Product created but no ID returned:', product);
        throw new AppError('Product created but ID not returned', 500);
      }

      console.log('✅ Product created successfully:', product.id);
      console.log('📊 Product details:', {
        id: product.id,
        name: product.name,
        sku: product.sku,
        categoryId: product.categoryId,
        inventoryId: product.inventory?.id,
        variantsCount: product.variants?.length || 0,
        imagesCount: product.images?.length || 0,
      });

      return product;
    } catch (error: any) {
      console.error('❌ Error in createProduct:', error);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('🔴 Prisma error code:', error.code);
        console.error('🔴 Prisma error meta:', error.meta);
        console.error('🔴 Prisma error message:', error.message);

        if (error.code === 'P2002') {
          const target = error.meta?.target || 'field';
          throw new AppError(`Duplicate entry: ${target} already exists`, 400);
        }
        if (error.code === 'P2003') {
          throw new AppError(
            'Foreign key constraint failed. Please check category, supplier, or business unit IDs.',
            400
          );
        }
        if (error.code === 'P2025') {
          throw new AppError('Related record not found', 404);
        }
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to create product: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }

  // ===== END PART 3 of 7 =====

  // src/services/productService.ts
// PART 4 of 7

  // ============================================
  // UPDATE PRODUCT
  // ============================================

  async updateProduct(id: string, data: ProductUpdateData, userId: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          supplier: true,
          inventory: true,
          variants: {
            include: { inventory: true },
          },
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      let validUserId: string;
      try {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        validUserId = user ? user.id : userId;
      } catch {
        validUserId = userId;
      }

      const updateData: any = {
        updatedBy: validUserId,
        updatedAt: new Date(),
      };

      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.description !== undefined)
        updateData.description = data.description?.trim() || null;
      if (data.sku !== undefined) {
        const sku = data.sku.toUpperCase().trim();
        const existing = await this.prisma.product.findFirst({
          where: {
            sku: { equals: sku, mode: 'insensitive' },
            id: { not: id },
          },
        });
        if (existing) {
          throw new AppError('Product SKU already exists', 400);
        }
        updateData.sku = sku;
      }
      if (data.barcode !== undefined) {
        const barcode = data.barcode?.trim() || null;
        if (barcode) {
          const existing = await this.prisma.product.findFirst({
            where: {
              barcode: barcode,
              id: { not: id },
            },
          });
          if (existing) {
            throw new AppError('Barcode already exists', 400);
          }
        }
        updateData.barcode = barcode;
      }
      if (data.unitPrice !== undefined)
        updateData.unitPrice = Number(data.unitPrice);
      if (data.costPrice !== undefined)
        updateData.costPrice = Number(data.costPrice);
      if (data.taxRate !== undefined) updateData.taxRate = Number(data.taxRate);
      if (data.minStock !== undefined)
        updateData.minStock = Number(data.minStock);
      if (data.maxStock !== undefined)
        updateData.maxStock = data.maxStock ? Number(data.maxStock) : null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isDigital !== undefined) updateData.isDigital = data.isDigital;
      if (data.featured !== undefined) updateData.featured = data.featured;
      if (data.weight !== undefined)
        updateData.weight = data.weight ? Number(data.weight) : null;
      if (data.dimensions !== undefined)
        updateData.dimensions = data.dimensions || null;
      if (data.images !== undefined) {
        updateData.images = this.cleanImages(data.images);
      }
      if (data.attributes !== undefined)
        updateData.attributes = data.attributes || null;
      if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;
      if (data.tags !== undefined) {
        updateData.tags = Array.isArray(data.tags)
          ? data.tags.filter(
              (t: any) => typeof t === 'string' && t.trim().length > 0
            )
          : [];
      }
      if (data.seo !== undefined) updateData.seo = data.seo || null;

      if (data.categoryId !== undefined) {
        updateData.categoryId = data.categoryId || null;
      } else if (data.category !== undefined) {
        const categoryId = this.extractCategoryId(data.category);
        if (categoryId) {
          updateData.categoryId = categoryId;
        } else if (typeof data.category === 'string') {
          const categories = await this.prisma.category.findMany({
            where: {
              businessUnitId: product.businessUnitId,
              name: { equals: data.category, mode: 'insensitive' },
            },
          });
          updateData.categoryId =
            categories.length > 0 ? categories[0].id : null;
        } else {
          updateData.categoryId = null;
        }
      }

      if (data.supplierId !== undefined) {
        updateData.supplierId = data.supplierId || null;
      }

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updatedProduct = await tx.product.update({
            where: { id },
            data: updateData,
            include: {
              category: true,
              inventory: true,
              variants: {
                include: { inventory: true },
              },
              supplier: true,
            },
          });

          if (product.inventory && data.minStock !== undefined) {
            await tx.inventory.update({
              where: { id: product.inventory.id },
              data: {
                reorderPoint: updatedProduct.minStock || 5,
                reorderQuantity: updatedProduct.maxStock || 10,
                notes: data.notes || product.inventory.notes,
              },
            });
          }

          if (data.variants && Array.isArray(data.variants)) {
            for (const variantData of data.variants) {
              if (
                variantData &&
                typeof variantData === 'object' &&
                'id' in variantData &&
                variantData.id
              ) {
                const existingVariant = await tx.productVariant.findUnique({
                  where: { id: variantData.id as string },
                  include: { inventory: true },
                });

                if (existingVariant) {
                  await tx.productVariant.update({
                    where: { id: variantData.id as string },
                    data: {
                      name: variantData.name,
                      sku: variantData.sku?.toUpperCase(),
                      price: variantData.price,
                      costPrice: variantData.costPrice,
                      stock: variantData.stock,
                      images: this.cleanImages(variantData.images || []),
                      attributes: variantData.attributes || {},
                      isActive: variantData.isActive,
                      barcode: variantData.barcode || null,
                    },
                  });
                }
              } else if (
                variantData &&
                typeof variantData === 'object' &&
                'name' in variantData &&
                variantData.name
              ) {
                try {
                  await this.addVariant(id, {
                    name: variantData.name,
                    sku: variantData.sku,
                    price: variantData.price || 0,
                    costPrice: variantData.costPrice || 0,
                    stock: variantData.stock || 0,
                    images: variantData.images || [],
                    attributes: variantData.attributes || {},
                    isActive:
                      variantData.isActive !== undefined
                        ? variantData.isActive
                        : true,
                    barcode: variantData.barcode || undefined,
                    location: data.location || 'Warehouse',
                  });
                } catch (addError) {
                  console.warn('Failed to add variant:', addError);
                }
              }
            }
          }

          try {
            await tx.auditLog.create({
              data: {
                action: 'UPDATE',
                entityType: 'PRODUCT',
                entityId: updatedProduct.id,
                userId: validUserId,
                entityName: updatedProduct.name,
                changes: { updatedFields: Object.keys(data) },
                severity: 'INFO',
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation skipped:', auditError);
          }

          this.safeEmitProductUpdate(updatedProduct, product.businessUnitId);
          if (updatedProduct.inventory) {
            this.safeEmitInventoryUpdate(
              updatedProduct.inventory,
              product.businessUnitId
            );
          }

          return updatedProduct;
        }
      );
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.updateProduct');
    }
  }

  // ============================================
  // DELETE PRODUCT
  // ============================================

  async deleteProduct(id: string, force: boolean = false) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          inventory: true,
          variants: {
            include: {
              inventory: true,
              saleItems: true,
              orderItems: true,
            },
          },
          orderItems: true,
          saleItems: true,
          reviews: true,
          category: true,
          supplier: true,
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const hasSalesOrOrders =
        product.orderItems.length > 0 ||
        product.saleItems.length > 0 ||
        product.variants.some(
          (v) => v.saleItems.length > 0 || v.orderItems.length > 0
        );

      if (force) {
        console.log(
          `⚠️ FORCE DELETE: Removing product ${id} with all associated records`
        );

        const hasInventory =
          !!product.inventoryId || product.variants.some((v) => v.inventoryId);

        if (hasInventory) {
          console.log(
            `⚠️ Product has inventory, will be deleted with force option`
          );
        }

        return await this.prisma.$transaction(
          async (tx: Prisma.TransactionClient) => {
            for (const variant of product.variants) {
              if (variant.saleItems.length > 0) {
                await tx.saleItem.deleteMany({
                  where: { variantId: variant.id },
                });
              }
              if (variant.orderItems.length > 0) {
                await tx.orderItem.deleteMany({
                  where: { variantId: variant.id },
                });
              }
            }

            if (product.saleItems.length > 0) {
              await tx.saleItem.deleteMany({
                where: { productId: id },
              });
            }

            if (product.orderItems.length > 0) {
              await tx.orderItem.deleteMany({
                where: { productId: id },
              });
            }

            if (product.reviews.length > 0) {
              await tx.productReview.deleteMany({
                where: { productId: id },
              });
            }

            for (const variant of product.variants) {
              if (variant.inventoryId) {
                await tx.inventory.delete({
                  where: { id: variant.inventoryId },
                });
              }
            }

            await tx.productVariant.deleteMany({
              where: { productId: id },
            });

            if (product.inventoryId) {
              await tx.inventory.delete({
                where: { id: product.inventoryId },
              });
            }

            await tx.product.delete({
              where: { id },
            });

            try {
              await tx.auditLog.create({
                data: {
                  action: 'DELETE',
                  entityType: 'PRODUCT',
                  entityId: product.id,
                  userId: 'system',
                  entityName: product.name,
                  changes: {
                    forceDelete: true,
                    deletedAt: new Date().toISOString(),
                    hadSales: hasSalesOrOrders,
                    deletedFields: [
                      ...(product.saleItems.length > 0 ? ['saleItems'] : []),
                      ...(product.orderItems.length > 0 ? ['orderItems'] : []),
                      ...(product.variants.length > 0 ? ['variants'] : []),
                      ...(product.inventoryId ? ['inventory'] : []),
                    ],
                  },
                  severity: 'HIGH',
                  businessUnitId: product.businessUnitId,
                },
              });
            } catch (auditError) {
              console.warn('Audit log creation skipped:', auditError);
            }

            return {
              message: 'Product permanently deleted with all associated records',
              softDeleted: false,
              forceDeleted: true,
            };
          }
        );
      }

      if (hasSalesOrOrders) {
        console.log(`📌 Soft deleting product ${id} (has sales/orders)`);

        const deletedProduct = await this.prisma.product.update({
          where: { id },
          data: {
            isActive: false,
            deletedAt: new Date(),
            deletedBy: 'system',
          },
          include: {
            category: true,
            supplier: true,
          },
        });

        for (const variant of product.variants) {
          await this.prisma.productVariant.update({
            where: { id: variant.id },
            data: {
              isActive: false,
              deletedAt: new Date(),
            },
          });
        }

        try {
          await this.prisma.auditLog.create({
            data: {
              action: 'DELETE',
              entityType: 'PRODUCT',
              entityId: product.id,
              userId: 'system',
              entityName: product.name,
              changes: {
                softDelete: true,
                deletedAt: new Date().toISOString(),
                reason: 'Has associated sales or orders',
                saleItemsCount: product.saleItems.length,
                orderItemsCount: product.orderItems.length,
                variantSaleItemsCount: product.variants.reduce(
                  (acc, v) => acc + v.saleItems.length,
                  0
                ),
                variantOrderItemsCount: product.variants.reduce(
                  (acc, v) => acc + v.orderItems.length,
                  0
                ),
              },
              severity: 'MEDIUM',
              businessUnitId: product.businessUnitId,
            },
          });
        } catch (auditError) {
          console.warn('Audit log creation skipped:', auditError);
        }

        return {
          message:
            'Product marked as inactive (has associated sales/orders). Use force=true to permanently delete.',
          softDeleted: true,
          data: deletedProduct,
          stats: {
            saleItems: product.saleItems.length,
            orderItems: product.orderItems.length,
            variants: product.variants.length,
            variantSaleItems: product.variants.reduce(
              (acc, v) => acc + v.saleItems.length,
              0
            ),
            variantOrderItems: product.variants.reduce(
              (acc, v) => acc + v.orderItems.length,
              0
            ),
          },
        };
      }

      console.log(`🗑️ Hard deleting product ${id} (no associated sales/orders)`);

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          for (const variant of product.variants) {
            if (variant.inventoryId) {
              await tx.inventory.delete({
                where: { id: variant.inventoryId },
              });
            }
          }

          if (product.inventoryId) {
            await tx.inventory.delete({
              where: { id: product.inventoryId },
            });
          }

          await tx.productVariant.deleteMany({
            where: { productId: id },
          });

          await tx.productReview.deleteMany({
            where: { productId: id },
          });

          await tx.product.delete({
            where: { id },
          });

          try {
            await tx.auditLog.create({
              data: {
                action: 'DELETE',
                entityType: 'PRODUCT',
                entityId: product.id,
                userId: 'system',
                entityName: product.name,
                changes: {
                  hardDelete: true,
                  deletedAt: new Date().toISOString(),
                },
                severity: 'INFO',
                businessUnitId: product.businessUnitId,
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation skipped:', auditError);
          }

          return {
            message: 'Product permanently deleted successfully',
            softDeleted: false,
            forceDeleted: false,
          };
        }
      );
    } catch (error: any) {
      console.error('❌ Error in deleteProduct:', error);

      if (error instanceof AppError) {
        throw error;
      }

      if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as { code: string; message?: string };
        if (prismaError.code === 'P2003') {
          throw new AppError(
            'Cannot delete product due to foreign key constraints. Please remove all associated records first.',
            400
          );
        }
        if (prismaError.code === 'P2025') {
          throw new AppError('Product not found', 404);
        }
      }

      const errorMessage =
        error && typeof error === 'object' && 'message' in error
          ? (error as { message: string }).message
          : 'Unknown error';

      throw new AppError(`Failed to delete product: ${errorMessage}`, 500);
    }
  }

  // ===== END PART 4 of 7 =====

  // src/services/productService.ts
// PART 5 of 7

  // ============================================
  // UPDATE INVENTORY STOCK
  // ============================================

  async updateInventoryStock(
    inventoryId: string,
    quantity: number,
    userId: string,
    note?: string,
    transactionType: string = 'ADJUSTMENT'
  ) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: inventoryId },
        include: {
          product: true,
          variant: true,
        },
      });

      if (!inventory) {
        throw new AppError('Inventory not found', 404);
      }

      if (quantity < 0) {
        throw new AppError('Stock quantity cannot be negative', 400);
      }

      const previousQuantity = inventory.quantity;
      const difference = quantity - previousQuantity;

      const updatedInventory = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updated = await tx.inventory.update({
            where: { id: inventoryId },
            data: {
              quantity: quantity,
              available: quantity - (inventory.reserved || 0),
            },
          });

          const productId = inventory.product?.id;
          const variantId = inventory.variant?.id;

          if (!productId) {
            throw new AppError('Inventory is not linked to a product', 400);
          }

          await tx.inventoryTransaction.create({
            data: {
              transactionType: transactionType as any,
              quantity: Math.abs(difference),
              notes:
                note ||
                `Stock ${transactionType.toLowerCase()} from ${previousQuantity} to ${quantity}`,
              reference: `Inventory update`,
              productId: productId,
              variantId: variantId || null,
              inventoryId: inventory.id,
              businessUnitId: inventory.businessUnitId,
              userId: userId,
            },
          });

          return updated;
        }
      );

      this.safeEmitInventoryUpdate(updatedInventory, inventory.businessUnitId);

      if (inventory.product?.id) {
        const product = await this.prisma.product.findUnique({
          where: { id: inventory.product.id },
        });
        if (product) {
          this.safeEmitProductUpdate(product, inventory.businessUnitId);
        }
      }

      return updatedInventory;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateInventoryStock'
      );
    }
  }

  // ============================================
  // SYNC PRODUCT WITH INVENTORY
  // ============================================

  async syncProductInventory(productId: string, userId: string): Promise<any> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          inventory: true,
          variants: {
            include: { inventory: true },
          },
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      let totalStock = 0;
      let totalReserved = 0;

      if (product.inventory) {
        totalStock += product.inventory.quantity || 0;
        totalReserved += product.inventory.reserved || 0;
      }

      for (const variant of product.variants) {
        if (variant.inventory) {
          totalStock += variant.inventory.quantity || 0;
          totalReserved += variant.inventory.reserved || 0;
        } else {
          totalStock += variant.stock || 0;
        }
      }

      const totalAvailable = totalStock - totalReserved;

      const updatedProduct = await this.prisma.product.update({
        where: { id: productId },
        data: {},
        include: {
          inventory: true,
          variants: {
            include: { inventory: true },
          },
        },
      });

      this.safeEmitProductUpdate(updatedProduct, product.businessUnitId);

      return {
        product: updatedProduct,
        totalStock,
        totalReserved,
        totalAvailable,
        syncedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.syncProductInventory'
      );
    }
  }

  // ============================================
  // CREATE PRODUCT FROM INVENTORY
  // ============================================

  async createProductFromInventory(
    inventoryId: string,
    productData: any,
    userId: string
  ) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: inventoryId },
      });

      if (!inventory) {
        throw new AppError('Inventory item not found', 404);
      }

      const existingProduct = await this.prisma.product.findFirst({
        where: { inventoryId: inventory.id },
      });

      if (existingProduct) {
        throw new AppError(
          'This inventory item is already linked to a product',
          400
        );
      }

      let sku = productData.sku;
      if (!sku || sku === 'SKU' || sku.trim() === '') {
        sku = this.generateProductSKU(productData.name);
      } else {
        sku = sku.toUpperCase();
      }

      sku = await this.ensureUniqueSKU(sku, inventory.businessUnitId);

      const categoryId = this.extractCategoryId(
        productData.categoryId || productData.category
      );

      const product = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const newProduct = await tx.product.create({
            data: {
              name: productData.name || 'Unnamed Product',
              sku: sku,
              description: productData.description || null,
              unitPrice: productData.unitPrice || 0,
              costPrice: productData.costPrice || 0,
              barcode: productData.barcode || null,
              categoryId: categoryId,
              supplierId: productData.supplierId || null,
              businessUnitId: inventory.businessUnitId,
              isActive:
                productData.isActive !== undefined ? productData.isActive : true,
              featured: productData.featured || false,
              isDigital: productData.isDigital || false,
              taxRate: productData.taxRate || 0,
              weight: productData.weight || null,
              minStock: inventory.reorderPoint || 5,
              maxStock: inventory.reorderQuantity || null,
              tags: productData.tags || [],
              images: this.cleanImages(productData.images || []),
              notes: productData.notes || inventory.notes || null,
              attributes: productData.attributes || {},
              seo: productData.seo || {},
              createdBy: userId,
              updatedBy: userId,
              inventoryId: inventory.id,
            },
            include: {
              inventory: true,
              category: true,
              supplier: true,
            },
          });

          if (!newProduct.id) {
            throw new AppError('Product created but ID not returned', 500);
          }

          if (productData.variants && Array.isArray(productData.variants)) {
            for (const variantData of productData.variants) {
              const variantSku =
                variantData.sku && variantData.sku !== 'SKU'
                  ? variantData.sku.toUpperCase()
                  : this.generateVariantSKU(newProduct.sku, variantData.name);

              const variant = await tx.productVariant.create({
                data: {
                  productId: newProduct.id,
                  name: variantData.name,
                  sku: variantSku,
                  price: variantData.price || newProduct.unitPrice,
                  costPrice: variantData.costPrice || newProduct.costPrice || 0,
                  stock: variantData.stock || 0,
                  images: this.cleanImages(variantData.images || []),
                  attributes: variantData.attributes || {},
                  isActive: true,
                  barcode: variantData.barcode || null,
                },
              });

              const variantInventory = await tx.inventory.create({
                data: {
                  businessUnitId: inventory.businessUnitId,
                  quantity: variantData.stock || 0,
                  reserved: 0,
                  available: variantData.stock || 0,
                  reorderPoint: 5,
                  reorderQuantity: 10,
                  location: 'Warehouse',
                  status: 'ACTIVE',
                },
              });

              await tx.productVariant.update({
                where: { id: variant.id },
                data: { inventoryId: variantInventory.id },
              });
            }

            await tx.product.update({
              where: { id: newProduct.id },
              data: { type: 'VARIABLE' },
            });
          }

          try {
            await tx.auditLog.create({
              data: {
                action: 'CREATE',
                entityType: 'PRODUCT',
                entityId: newProduct.id,
                userId: userId,
                entityName: newProduct.name,
                changes: {
                  fromInventory: inventory.id,
                  name: newProduct.name,
                  sku: newProduct.sku,
                  variantCount: productData.variants?.length || 0,
                },
                severity: 'INFO',
                businessUnitId: inventory.businessUnitId,
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation failed:', auditError);
          }

          this.safeEmitProductUpdate(newProduct, inventory.businessUnitId);
          this.safeEmitInventoryUpdate(inventory, inventory.businessUnitId);

          return newProduct;
        }
      );

      return product;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.createProductFromInventory'
      );
    }
  }

  // ============================================
  // UPDATE PRODUCT FROM INVENTORY
  // ============================================

  async updateProductFromInventory(
    inventoryId: string,
    productData: any,
    userId: string
  ) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id: inventoryId },
      });

      if (!inventory) {
        throw new AppError('Inventory item not found', 404);
      }

      const product = await this.prisma.product.findFirst({
        where: { inventoryId: inventory.id },
      });

      if (!product) {
        return this.createProductFromInventory(
          inventoryId,
          productData,
          userId
        );
      }

      const categoryId = this.extractCategoryId(
        productData.categoryId || productData.category
      );

      const updatedProduct = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updated = await tx.product.update({
            where: { id: product.id },
            data: {
              name: productData.name !== undefined ? productData.name : undefined,
              description:
                productData.description !== undefined
                  ? productData.description
                  : undefined,
              sku:
                productData.sku !== undefined
                  ? productData.sku.toUpperCase()
                  : undefined,
              barcode:
                productData.barcode !== undefined ? productData.barcode : undefined,
              unitPrice:
                productData.unitPrice !== undefined
                  ? Number(productData.unitPrice)
                  : undefined,
              costPrice:
                productData.costPrice !== undefined
                  ? Number(productData.costPrice)
                  : undefined,
              taxRate:
                productData.taxRate !== undefined
                  ? Number(productData.taxRate)
                  : undefined,
              minStock:
                productData.minStock !== undefined
                  ? Number(productData.minStock)
                  : inventory.reorderPoint,
              maxStock:
                productData.maxStock !== undefined
                  ? Number(productData.maxStock)
                  : inventory.reorderQuantity,
              isActive:
                productData.isActive !== undefined
                  ? productData.isActive
                  : undefined,
              isDigital:
                productData.isDigital !== undefined
                  ? productData.isDigital
                  : undefined,
              featured:
                productData.featured !== undefined
                  ? productData.featured
                  : undefined,
              weight:
                productData.weight !== undefined
                  ? Number(productData.weight)
                  : undefined,
              images:
                productData.images !== undefined
                  ? this.cleanImages(productData.images)
                  : undefined,
              attributes:
                productData.attributes !== undefined
                  ? productData.attributes
                  : undefined,
              notes:
                productData.notes !== undefined ? productData.notes : undefined,
              tags: productData.tags !== undefined ? productData.tags : undefined,
              seo: productData.seo !== undefined ? productData.seo : undefined,
              categoryId: categoryId !== undefined ? categoryId : undefined,
              supplierId:
                productData.supplierId !== undefined
                  ? productData.supplierId
                  : undefined,
              updatedBy: userId,
            },
            include: {
              inventory: true,
              category: true,
              supplier: true,
            },
          });

          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              reorderPoint: updated.minStock || 5,
              reorderQuantity: updated.maxStock || 10,
              supplier: productData.supplier || inventory.supplier,
              notes: productData.notes || inventory.notes,
            },
          });

          try {
            await tx.auditLog.create({
              data: {
                action: 'UPDATE',
                entityType: 'PRODUCT',
                entityId: updated.id,
                userId: userId,
                entityName: updated.name,
                changes: { updatedFields: Object.keys(productData) },
                severity: 'INFO',
                businessUnitId: inventory.businessUnitId,
              },
            });
          } catch (auditError) {
            console.warn('Audit log creation skipped:', auditError);
          }

          this.safeEmitProductUpdate(updated, inventory.businessUnitId);
          this.safeEmitInventoryUpdate(inventory, inventory.businessUnitId);

          return updated;
        }
      );

      return updatedProduct;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateProductFromInventory'
      );
    }
  }

  // ============================================
  // DELETE PRODUCT FROM INVENTORY
  // ============================================

  async deleteProductFromInventory(
    productId: string,
    keepInventory: boolean = true
  ) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          inventory: true,
          variants: {
            include: { inventory: true },
          },
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          for (const variant of product.variants) {
            if (variant.inventory) {
              await tx.productVariant.update({
                where: { id: variant.id },
                data: { inventoryId: null },
              });
            }
          }

          if (product.inventory) {
            await tx.product.update({
              where: { id: product.id },
              data: { inventoryId: null },
            });
          }

          if (!keepInventory && product.inventory) {
            await tx.inventory.delete({
              where: { id: product.inventory.id },
            });
          }

          const deletedProduct = await tx.product.update({
            where: { id: productId },
            data: {
              isActive: false,
              deletedAt: new Date(),
              inventoryId: null,
            },
          });

          return {
            message: keepInventory
              ? 'Product unlinked from inventory'
              : 'Product and inventory deleted',
            softDeleted: true,
            data: deletedProduct,
          };
        }
      );
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.deleteProductFromInventory'
      );
    }
  }

  // ===== END PART 5 of 7 =====

  // src/services/productService.ts
// PART 6 of 7

  // ============================================
  // VARIANT METHODS
  // ============================================

  async addVariant(productId: string, data: VariantCreateData) {
    try {
      console.log(`📝 Adding variant to product ${productId}:`, data);

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: { inventory: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      if (!data.name) {
        throw new AppError('Variant name is required', 400);
      }

      let images = this.cleanImages(data.images || []);
      let sku = data.sku;

      if (!sku || sku === 'SKU' || sku.trim() === '') {
        sku = this.generateVariantSKU(product.sku, data.name);
      } else {
        sku = sku.toUpperCase().trim();
      }

      let existingSku = await this.prisma.productVariant.findFirst({
        where: { sku: { equals: sku, mode: 'insensitive' } },
      });

      let skuAttempts = 0;
      while (existingSku && skuAttempts < 5) {
        sku = this.generateVariantSKU(product.sku, data.name);
        existingSku = await this.prisma.productVariant.findFirst({
          where: { sku: { equals: sku, mode: 'insensitive' } },
        });
        skuAttempts++;
      }

      if (existingSku) {
        throw new AppError('Unable to generate unique SKU for variant', 400);
      }

      const price = data.price ?? product.unitPrice;
      const costPrice = data.costPrice ?? product.costPrice ?? price;

      const variant = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const createdVariant = await tx.productVariant.create({
            data: {
              productId,
              name: data.name,
              sku: sku,
              price: Number(price),
              costPrice: Number(costPrice),
              stock: data.stock || 0,
              images: images,
              attributes: data.attributes || {},
              isActive: data.isActive !== undefined ? data.isActive : true,
              barcode: data.barcode || null,
            },
          });

          const inventory = await tx.inventory.create({
            data: {
              businessUnitId: product.businessUnitId,
              quantity: data.stock || 0,
              reserved: 0,
              available: data.stock || 0,
              reorderPoint: 5,
              reorderQuantity: 10,
              location: data.location || 'Warehouse',
              status: 'ACTIVE',
            },
          });

          await tx.productVariant.update({
            where: { id: createdVariant.id },
            data: { inventoryId: inventory.id },
          });

          if (data.stock && data.stock > 0) {
            await tx.inventoryTransaction.create({
              data: {
                transactionType: 'INITIAL',
                quantity: data.stock,
                notes: `Initial stock for variant ${createdVariant.name}`,
                productId: productId,
                variantId: createdVariant.id,
                inventoryId: inventory.id,
                businessUnitId: product.businessUnitId,
                userId: 'system',
              },
            });
          }

          if (product.type === 'SIMPLE') {
            await tx.product.update({
              where: { id: productId },
              data: { type: 'VARIABLE' },
            });
          }

          this.safeEmitInventoryUpdate(inventory, product.businessUnitId);

          return createdVariant;
        }
      );

      const variantWithInventory = await this.prisma.productVariant.findUnique({
        where: { id: variant.id },
        include: { inventory: true },
      });

      console.log(`✅ Variant created successfully: ${variant.id}`);
      return variantWithInventory;
    } catch (error) {
      console.error('❌ Error in addVariant:', error);
      return this.handleServiceError(error, 'ProductService.addVariant');
    }
  }

  async updateVariant(variantId: string, data: VariantUpdateData) {
    try {
      console.log(`📝 Updating variant ${variantId}:`, data);

      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: { include: { inventory: true } },
          inventory: true,
        },
      });

      if (!variant) {
        throw new AppError('Variant not found', 404);
      }

      if (data.sku && data.sku.toLowerCase() !== variant.sku.toLowerCase()) {
        const existing = await this.prisma.productVariant.findFirst({
          where: {
            sku: { equals: data.sku, mode: 'insensitive' },
            id: { not: variantId },
          },
        });
        if (existing) {
          throw new AppError('Variant SKU already exists', 400);
        }
      }

      const updatedVariant = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updateData: any = {};
          if (data.name !== undefined) updateData.name = data.name;
          if (data.sku !== undefined)
            updateData.sku = data.sku.toUpperCase().trim();
          if (data.price !== undefined) updateData.price = Number(data.price);
          if (data.costPrice !== undefined)
            updateData.costPrice = Number(data.costPrice);
          if (data.stock !== undefined) updateData.stock = Number(data.stock);
          if (data.images !== undefined) {
            updateData.images = this.cleanImages(data.images);
          }
          if (data.attributes !== undefined)
            updateData.attributes = data.attributes;
          if (data.isActive !== undefined) updateData.isActive = data.isActive;

          const updated = await tx.productVariant.update({
            where: { id: variantId },
            data: updateData,
            include: { inventory: true },
          });

          if (data.stock !== undefined) {
            const inventory = variant.inventory;
            if (inventory) {
              await tx.inventory.update({
                where: { id: inventory.id },
                data: {
                  quantity: Number(data.stock),
                  available: Number(data.stock) - (inventory.reserved || 0),
                },
              });
            }
          }

          return updated;
        }
      );

      console.log(`✅ Variant updated successfully: ${updatedVariant.id}`);
      return updatedVariant;
    } catch (error) {
      console.error('❌ Error in updateVariant:', error);
      return this.handleServiceError(error, 'ProductService.updateVariant');
    }
  }

  async deleteVariant(variantId: string) {
    try {
      console.log(`🗑️ Deleting variant ${variantId}`);

      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          saleItems: true,
          orderItems: true,
          inventory: true,
          product: true,
        },
      });

      if (!variant) {
        throw new AppError('Variant not found', 404);
      }

      const hasSalesOrOrders =
        variant.saleItems.length > 0 || variant.orderItems.length > 0;

      if (hasSalesOrOrders) {
        const updatedVariant = await this.prisma.productVariant.update({
          where: { id: variantId },
          data: { isActive: false },
        });

        return {
          message: 'Variant deactivated (has associated sales/orders)',
          softDeleted: true,
          data: updatedVariant,
        };
      }

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          if (variant.inventoryId) {
            await tx.inventory.delete({
              where: { id: variant.inventoryId },
            });
          }

          await tx.productVariant.delete({
            where: { id: variantId },
          });

          const remainingVariants = await tx.productVariant.findMany({
            where: {
              productId: variant.productId,
              isActive: true,
            },
          });

          if (remainingVariants.length === 0) {
            await tx.product.update({
              where: { id: variant.productId },
              data: { type: 'SIMPLE' },
            });
          }

          return {
            message: 'Variant deleted successfully',
            softDeleted: false,
          };
        }
      );
    } catch (error) {
      console.error('❌ Error in deleteVariant:', error);
      return this.handleServiceError(error, 'ProductService.deleteVariant');
    }
  }

  async getProductVariants(productId: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      return await this.prisma.productVariant.findMany({
        where: { productId },
        include: { inventory: true },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductVariants'
      );
    }
  }

  async getVariantById(variantId: string) {
    try {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
              inventory: true,
            },
          },
          inventory: true,
          saleItems: {
            take: 5,
            orderBy: { sale: { saleDate: 'desc' } },
          },
        },
      });

      if (!variant) {
        throw new AppError('Variant not found', 404);
      }

      return variant;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getVariantById');
    }
  }

  async getVariantBySku(sku: string, businessUnitId?: string) {
    try {
      const where: any = { sku: { equals: sku, mode: 'insensitive' } };

      const variant = await this.prisma.productVariant.findFirst({
        where,
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
            },
          },
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
        },
      });

      if (!variant) {
        throw new AppError('Variant not found', 404);
      }

      return variant;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getVariantBySku');
    }
  }

  async getVariantByBarcode(barcode: string, businessUnitId?: string) {
    try {
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      console.log(`🔍 Looking for variant with barcode/SKU: "${barcode}"`);

      const product = await this.prisma.product.findFirst({
        where: {
          barcode,
          ...(businessUnitId ? { businessUnitId } : {}),
        },
        include: {
          category: true,
          supplier: true,
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
          variants: {
            where: { isActive: true },
            include: {
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
            },
          },
        },
      });

      if (product) {
        if (product.variants && product.variants.length === 1) {
          const singleVariant = product.variants[0];
          return {
            ...singleVariant,
            product: {
              ...product,
              variants: undefined,
            },
          };
        }
        return product;
      }

      const variant = await this.prisma.productVariant.findFirst({
        where: {
          sku: { equals: barcode, mode: 'insensitive' },
          ...(businessUnitId ? { product: { businessUnitId } } : {}),
        },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
            },
          },
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
        },
      });

      if (!variant) {
        throw new AppError(
          `No product or variant found for barcode/SKU "${barcode}"`,
          404
        );
      }

      return variant;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getVariantByBarcode'
      );
    }
  }

  // ============================================
  // BULK VARIANT OPERATIONS
  // ============================================

  async bulkCreateVariants(
    productId: string,
    variants: VariantCreateData[]
  ) {
    try {
      console.log(
        `📦 Bulk creating ${variants.length} variants for product ${productId}`
      );

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const results: any[] = [];
      const errors: Array<{ variant: any; message: string }> = [];

      for (const variantData of variants) {
        try {
          variantData.images = this.cleanImages(variantData.images || []);
          const variant = await this.addVariant(productId, variantData);
          results.push(variant);
        } catch (error) {
          errors.push({
            variant: variantData,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      console.log(
        `✅ Bulk create complete: ${results.length} created, ${errors.length} failed`
      );
      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkCreateVariants'
      );
    }
  }

  async bulkDeleteVariants(variantIds: string[]) {
    try {
      console.log(`🗑️ Bulk deleting ${variantIds.length} variants`);

      const results: any[] = [];
      const errors: Array<{ id: string; message: string }> = [];

      for (const id of variantIds) {
        try {
          const result = await this.deleteVariant(id);
          results.push(result);
        } catch (error) {
          errors.push({
            id,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      console.log(
        `✅ Bulk delete complete: ${results.length} deleted, ${errors.length} failed`
      );
      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkDeleteVariants'
      );
    }
  }

  async updateVariantStock(
    variantId: string,
    quantity: number,
    userId: string,
    note?: string
  ) {
    try {
      console.log(`📦 Updating variant ${variantId} stock to ${quantity}`);

      const variant = await this.prisma.productVariant.findUnique({
        where: { id: variantId },
        include: {
          product: true,
          inventory: true,
        },
      });

      if (!variant) {
        throw new AppError('Variant not found', 404);
      }

      if (quantity < 0) {
        throw new AppError('Stock quantity cannot be negative', 400);
      }

      const updatedVariant = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updated = await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: quantity },
          });

          const inventory = variant.inventory;
          if (inventory) {
            await tx.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: quantity,
                available: quantity - (inventory.reserved || 0),
              },
            });

            const previousStock = variant.stock || 0;
            const difference = quantity - previousStock;

            await tx.inventoryTransaction.create({
              data: {
                transactionType: difference >= 0 ? 'RESTOCK' : 'ADJUSTMENT',
                quantity: Math.abs(difference),
                notes:
                  note || `Stock updated from ${previousStock} to ${quantity}`,
                reference: `Variant stock update`,
                productId: variant.productId,
                variantId: variantId,
                inventoryId: inventory.id,
                businessUnitId: variant.product.businessUnitId,
                userId: userId,
              },
            });
          }

          return updated;
        }
      );

      console.log(`✅ Variant stock updated: ${variantId} -> ${quantity}`);
      return updatedVariant;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateVariantStock'
      );
    }
  }

  // ============================================
  // BARCODE METHODS
  // ============================================

  async generateUniqueBarcode(
    options?: GenerateBarcodeOptions
  ): Promise<{ barcode: string }> {
    try {
      const prefix = options?.prefix || 'PRD';
      const length = options?.length || 12;
      const barcode = await this.generateUniqueBarcodeInternal(prefix, length);
      return { barcode };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.generateUniqueBarcode'
      );
    }
  }

  async generateBarcode(
    productId: string,
    options?: GenerateBarcodeOptions
  ): Promise<BarcodeInfo> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const barcode = await this.generateUniqueBarcodeInternal(
        options?.prefix || 'PRD',
        options?.length || 12
      );

      await this.prisma.product.update({
        where: { id: productId },
        data: { barcode },
      });

      const barcodeUrl = this.generateBarcodeImageUrl(barcode, options?.format);
      const qrCodeUrl = this.generateQRCodeUrl(
        product.name,
        product.sku,
        barcode
      );

      return {
        barcode,
        barcodeUrl,
        qrCodeUrl,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        price: product.unitPrice,
        format:
          (options?.format as 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR') ||
          'EAN-13',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.generateBarcode');
    }
  }

  async getProductBarcode(productId: string): Promise<BarcodeInfo> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unitPrice: true,
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      if (!product.barcode) {
        throw new AppError('Product does not have a barcode', 404);
      }

      const barcodeUrl = this.generateBarcodeImageUrl(product.barcode);
      const qrCodeUrl = this.generateQRCodeUrl(
        product.name,
        product.sku,
        product.barcode
      );

      return {
        barcode: product.barcode,
        barcodeUrl,
        qrCodeUrl,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        price: product.unitPrice,
        format: 'EAN-13',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductBarcode');
    }
  }

  async getBarcodeImage(productId: string): Promise<{ barcodeUrl: string }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { barcode: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      if (!product.barcode) {
        throw new AppError('Product does not have a barcode', 404);
      }

      const barcodeUrl = this.generateBarcodeImageUrl(product.barcode);
      return { barcodeUrl };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getBarcodeImage');
    }
  }

  async getProductQRCode(productId: string): Promise<{ qrCodeUrl: string }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          unitPrice: true,
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      if (!product.barcode) {
        throw new AppError('Product does not have a barcode', 404);
      }

      const qrCodeUrl = this.generateQRCodeUrl(
        product.name,
        product.sku,
        product.barcode
      );
      return { qrCodeUrl };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getProductQRCode');
    }
  }

  async generateBarcodeImage(
    barcode: string,
    format?: string
  ): Promise<{ barcodeUrl: string }> {
    try {
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }
      const barcodeUrl = this.generateBarcodeImageUrl(barcode, format);
      return { barcodeUrl };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.generateBarcodeImage'
      );
    }
  }

  async generateQRCode(data: any): Promise<{ qrCodeUrl: string }> {
    try {
      if (!data) {
        throw new AppError('QR code data is required', 400);
      }
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
        JSON.stringify(data)
      )}&size=200x200`;
      return { qrCodeUrl };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.generateQRCode');
    }
  }

  async associateBarcode(
    productId: string,
    barcode: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const existing = await this.prisma.product.findFirst({
        where: {
          barcode,
          id: { not: productId },
        },
      });

      if (existing) {
        throw new AppError('Barcode is already assigned to another product', 409);
      }

      await this.prisma.product.update({
        where: { id: productId },
        data: { barcode },
      });

      return { success: true, message: 'Barcode associated successfully' };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.associateBarcode');
    }
  }

  async validateBarcode(
    barcode: string,
    excludeProductId?: string
  ): Promise<{ valid: boolean; message?: string }> {
    try {
      if (!barcode) {
        return { valid: false, message: 'Barcode is required' };
      }

      const where: any = { barcode };
      if (excludeProductId) {
        where.id = { not: excludeProductId };
      }

      const existing = await this.prisma.product.findFirst({ where });

      if (existing) {
        return { valid: false, message: 'Barcode is already in use' };
      }

      return { valid: true };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.validateBarcode');
    }
  }

  async getProductsWithoutBarcode(params: {
    businessUnitId: string;
    page?: number;
    limit?: number;
  }) {
    try {
      const { businessUnitId, page = 1, limit = 20 } = params;
      const skip = (Number(page) - 1) * Number(limit);

      const where = {
        businessUnitId,
        barcode: null,
        isActive: true,
      };

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: Number(limit),
          include: {
            category: true,
            inventory: true,
            variants: {
              where: { isActive: true },
              include: { inventory: true },
            },
            supplier: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.product.count({ where }),
      ]);

      return {
        products,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductsWithoutBarcode'
      );
    }
  }

  async bulkGenerateBarcodes(
    productIds: string[],
    options?: GenerateBarcodeOptions
  ): Promise<{ results: any[]; errors: any[] }> {
    try {
      const results: any[] = [];
      const errors: Array<{ id: string; message: string }> = [];

      for (const id of productIds) {
        try {
          const result = await this.generateBarcode(id, options);
          results.push(result);
        } catch (error) {
          errors.push({
            id,
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkGenerateBarcodes'
      );
    }
  }

  async scanBarcode(
    barcode: string,
    businessUnitId: string
  ): Promise<{
    product: any;
    inventory?: { quantity: number; reserved: number; available: number };
    barcodeInfo: BarcodeInfo;
    variant?: any;
  }> {
    try {
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      let product = await this.prisma.product.findFirst({
        where: {
          barcode: barcode,
          businessUnitId: businessUnitId,
        },
        include: {
          category: true,
          inventory: {
            where: { businessUnitId: businessUnitId },
          },
          variants: {
            where: { isActive: true },
            include: {
              inventory: {
                where: { businessUnitId: businessUnitId },
              },
            },
          },
          supplier: true,
        },
      });

      let variant = null;

      if (!product) {
        const variantResult = await this.prisma.productVariant.findFirst({
          where: {
            sku: { equals: barcode, mode: 'insensitive' },
            product: { businessUnitId: businessUnitId },
          },
          include: {
            product: {
              include: {
                category: true,
                supplier: true,
                inventory: {
                  where: { businessUnitId: businessUnitId },
                },
                variants: {
                  where: { isActive: true },
                  include: {
                    inventory: {
                      where: { businessUnitId: businessUnitId },
                    },
                  },
                },
              },
            },
            inventory: {
              where: { businessUnitId: businessUnitId },
            },
          },
        });

        if (variantResult) {
          variant = variantResult;
          product = variantResult.product;
        }
      }

      if (!product) {
        throw new AppError(
          `Product not found for barcode/SKU "${barcode}"`,
          404
        );
      }

      const productInventory = product.inventory;
      const available = productInventory
        ? productInventory.quantity - (productInventory.reserved || 0)
        : 0;

      let barcodeInfo: BarcodeInfo;
      try {
        const barcodeResult = await this.getProductBarcode(product.id);
        barcodeInfo = {
          barcode: barcodeResult.barcode,
          barcodeUrl: barcodeResult.barcodeUrl,
          qrCodeUrl: barcodeResult.qrCodeUrl,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          price: product.unitPrice,
          format: barcodeResult.format || 'EAN-13',
          generatedAt: barcodeResult.generatedAt || new Date().toISOString(),
        };
      } catch {
        barcodeInfo = {
          barcode: product.barcode || barcode,
          barcodeUrl: this.generateBarcodeImageUrl(product.barcode || barcode),
          qrCodeUrl: this.generateQRCodeUrl(
            product.name,
            product.sku,
            product.barcode || barcode
          ),
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          price: product.unitPrice,
          format: 'EAN-13',
          generatedAt: new Date().toISOString(),
        };
      }

      return {
        product: product,
        variant: variant,
        inventory: productInventory
          ? {
              quantity: productInventory.quantity,
              reserved: productInventory.reserved || 0,
              available: available,
            }
          : undefined,
        barcodeInfo: barcodeInfo,
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.scanBarcode');
    }
  }

  // ===== END PART 6 of 7 =====

  // src/services/productService.ts
// PART 7 of 7 (FINAL)

  // ============================================
  // FEATURED & POPULAR PRODUCTS
  // ============================================

  async getFeaturedProducts(limit: number = 10, businessUnitId?: string) {
    try {
      const where: any = { isActive: true };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      return await this.prisma.product.findMany({
        where,
        take: Math.min(Number(limit) || 10, 50),
        orderBy: { rating: 'desc' },
        include: {
          category: true,
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
          variants: {
            where: { isActive: true },
            include: {
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
            },
          },
          supplier: true,
        },
      });
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getFeaturedProducts'
      );
    }
  }

  async getPopularProducts(limit: number = 10, businessUnitId?: string) {
    try {
      const where: any = { isActive: true };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const orderBy: any = {};
      try {
        orderBy.saleItems = { _count: 'desc' };
      } catch {
        orderBy.rating = 'desc';
      }

      return await this.prisma.product.findMany({
        where,
        take: Math.min(Number(limit) || 10, 50),
        orderBy,
        include: {
          category: true,
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
          variants: {
            where: { isActive: true },
            include: {
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
            },
          },
          supplier: true,
        },
      });
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getPopularProducts'
      );
    }
  }

  async getNewArrivals(limit: number = 10, businessUnitId?: string) {
    try {
      const where: any = { isActive: true };
      if (businessUnitId) where.businessUnitId = businessUnitId;

      return await this.prisma.product.findMany({
        where,
        take: Math.min(Number(limit) || 10, 50),
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          inventory: {
            where: { businessUnitId: businessUnitId || undefined },
          },
          variants: {
            where: { isActive: true },
            include: {
              inventory: {
                where: { businessUnitId: businessUnitId || undefined },
              },
            },
          },
          supplier: true,
        },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getNewArrivals');
    }
  }

  async getRelatedProducts(productId: string, limit: number = 4) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          categoryId: true,
          tags: true,
          businessUnitId: true,
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const where: any = {
        id: { not: productId },
        isActive: true,
        businessUnitId: product.businessUnitId,
      };

      const orConditions: any[] = [];
      if (product.categoryId) {
        orConditions.push({ categoryId: product.categoryId });
      }
      if (product.tags && product.tags.length > 0) {
        orConditions.push({ tags: { hasSome: product.tags } });
      }

      if (orConditions.length > 0) {
        where.OR = orConditions;
      }

      const relatedProducts = await this.prisma.product.findMany({
        where,
        take: Math.min(Number(limit) || 4, 20),
        orderBy: { rating: 'desc' },
        include: {
          category: true,
          inventory: true,
          variants: {
            where: { isActive: true },
            include: { inventory: true },
          },
          supplier: true,
        },
      });

      if (relatedProducts.length === 0) {
        return await this.prisma.product.findMany({
          where: {
            id: { not: productId },
            isActive: true,
            businessUnitId: product.businessUnitId,
          },
          take: Math.min(Number(limit) || 4, 20),
          orderBy: { createdAt: 'desc' },
          include: {
            category: true,
            inventory: true,
            variants: {
              where: { isActive: true },
              include: { inventory: true },
            },
            supplier: true,
          },
        });
      }

      return relatedProducts;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getRelatedProducts');
    }
  }

  async getProductStatistics(businessUnitId?: string) {
    try {
      const where: any = {};
      if (businessUnitId) where.businessUnitId = businessUnitId;

      const productsWithInventory = await this.prisma.product.findMany({
        where: {
          ...where,
          isActive: true,
        },
        include: {
          inventory: true,
          variants: {
            include: { inventory: true },
          },
        },
      });

      let lowStockCount = 0;
      let outOfStockCount = 0;
      let totalStockValue = 0;
      let totalStockCost = 0;
      let withBarcode = 0;
      let withoutBarcode = 0;
      let variantCount = 0;
      let totalVariantStock = 0;

      for (const product of productsWithInventory) {
        if (product.barcode) {
          withBarcode++;
        } else {
          withoutBarcode++;
        }

        if (product.inventory) {
          const quantity = product.inventory.quantity || 0;
          const minStock = product.minStock || 5;

          if (quantity === 0) {
            outOfStockCount++;
          } else if (quantity <= minStock) {
            lowStockCount++;
          }

          totalStockValue += quantity * (product.unitPrice || 0);
          totalStockCost += quantity * (product.costPrice || 0);
        }

        if (product.variants && product.variants.length > 0) {
          variantCount += product.variants.length;
          for (const variant of product.variants) {
            if (variant.inventory) {
              const inv = variant.inventory;
              totalVariantStock += inv.quantity || 0;
              totalStockValue += (inv.quantity || 0) * (variant.price || 0);
              totalStockCost += (inv.quantity || 0) * (variant.costPrice || 0);
            }
          }
        }
      }

      const [total, active, inactive, withVariants] = await Promise.all([
        this.prisma.product.count({ where }),
        this.prisma.product.count({ where: { ...where, isActive: true } }),
        this.prisma.product.count({ where: { ...where, isActive: false } }),
        this.prisma.product.count({
          where: {
            ...where,
            isActive: true,
            variants: { some: { isActive: true } },
          },
        }),
      ]);

      const totalProductsWithVariants = await this.prisma.product.count({
        where: {
          ...where,
          isActive: true,
          variants: { some: {} },
        },
      });

      return {
        total,
        active,
        inactive,
        withVariants,
        totalProductsWithVariants,
        variantCount,
        totalVariantStock,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
        totalStockValue,
        totalStockCost,
        potentialProfit: totalStockValue - totalStockCost,
        withBarcode,
        withoutBarcode,
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductStatistics'
      );
    }
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  async bulkCreateProducts(
    products: any[],
    businessUnitId: string,
    userId: string
  ) {
    try {
      const results: any[] = [];
      const errors: Array<{ product: any; error: string }> = [];

      for (const productData of products) {
        try {
          if (
            !productData.sku ||
            productData.sku === 'SKU' ||
            productData.sku.trim() === ''
          ) {
            productData.sku = this.generateProductSKU(productData.name);
          }

          const product = await this.createProduct(
            {
              ...productData,
              businessUnitId,
            },
            userId
          );
          results.push(product);
        } catch (error) {
          errors.push({
            product: productData,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkCreateProducts'
      );
    }
  }

  async bulkUpdatePrices(updates: Array<{ id: string; price: number }>) {
    try {
      const results: any[] = [];
      const errors: Array<{ id: string; message: string }> = [];

      for (const update of updates) {
        try {
          if (!update.id || update.price === undefined || update.price < 0) {
            throw new Error('Invalid update data');
          }

          const product = await this.prisma.product.update({
            where: { id: update.id },
            data: { unitPrice: update.price },
            include: { category: true, variants: true },
          });
          results.push(product);
        } catch (error) {
          errors.push({
            id: update.id || 'unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.bulkUpdatePrices');
    }
  }

  async bulkUpdateStock(updates: Array<{ id: string; stock: number }>) {
    try {
      const results: any[] = [];
      const errors: Array<{ id: string; message: string }> = [];

      for (const update of updates) {
        try {
          if (!update.id || update.stock === undefined || update.stock < 0) {
            throw new Error('Invalid update data');
          }

          const product = await this.prisma.product.findUnique({
            where: { id: update.id },
            include: { inventory: true },
          });

          if (!product) {
            throw new Error('Product not found');
          }

          if (product.inventory) {
            await this.prisma.inventory.update({
              where: { id: product.inventory.id },
              data: {
                quantity: update.stock,
                available: update.stock - (product.inventory.reserved || 0),
              },
            });
          } else {
            const inventory = await this.prisma.inventory.create({
              data: {
                businessUnitId: product.businessUnitId,
                quantity: update.stock,
                reserved: 0,
                available: update.stock,
                reorderPoint: product.minStock || 5,
                reorderQuantity: 10,
                location: 'Warehouse',
                status: 'ACTIVE',
              },
            });
            await this.prisma.product.update({
              where: { id: update.id },
              data: { inventoryId: inventory.id },
            });
          }

          const updatedProduct = await this.prisma.product.findUnique({
            where: { id: update.id },
            include: { inventory: true, category: true },
          });

          results.push(updatedProduct);
        } catch (error) {
          errors.push({
            id: update.id || 'unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.bulkUpdateStock');
    }
  }

  async bulkDeleteProducts(productIds: string[], businessUnitId: string) {
    try {
      const results: any[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of productIds) {
        try {
          const result = await this.deleteProduct(id);
          results.push(result);
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkDeleteProducts'
      );
    }
  }

  async bulkActivateProducts(productIds: string[]) {
    try {
      const results: any[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of productIds) {
        try {
          const product = await this.prisma.product.update({
            where: { id },
            data: {
              isActive: true,
              updatedAt: new Date(),
            },
          });
          results.push(product);
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkActivateProducts'
      );
    }
  }

  async bulkDeactivateProducts(productIds: string[]) {
    try {
      const results: any[] = [];
      const errors: Array<{ id: string; error: string }> = [];

      for (const id of productIds) {
        try {
          const product = await this.prisma.product.update({
            where: { id },
            data: {
              isActive: false,
              updatedAt: new Date(),
            },
          });
          results.push(product);
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.bulkDeactivateProducts'
      );
    }
  }

  // ============================================
  // CATEGORY METHODS
  // ============================================

  async getCategories(businessUnitId: string) {
    try {
      const categories = await this.prisma.category.findMany({
        where: { businessUnitId },
        include: {
          _count: {
            select: {
              products: true,
              children: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
      return categories || [];
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getCategories');
    }
  }

  async getCategoryById(id: string, businessUnitId: string) {
    try {
      const category = await this.prisma.category.findFirst({
        where: { id, businessUnitId },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitPrice: true,
              images: true,
            },
          },
          _count: {
            select: { products: true },
          },
        },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      return category;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getCategoryById');
    }
  }

  async getCategoryTree(businessUnitId: string) {
    try {
      const categories = await this.prisma.category.findMany({
        where: { businessUnitId },
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      const buildTree = (
        items: any[],
        parentId: string | null = null
      ): any[] => {
        return items
          .filter((item: any) => item.parentId === parentId)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            parentId: item.parentId,
            isActive: item.isActive,
            productCount: item._count?.products || 0,
            children: buildTree(items, item.id),
          }));
      };

      return buildTree(categories);
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getCategoryTree');
    }
  }

  async getCategoryProducts(
    categoryId: string,
    params?: { page?: number; limit?: number }
  ) {
    try {
      const { page = 1, limit = 10 } = params || {};
      const skip = (Number(page) - 1) * Number(limit);

      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            categoryId,
            isActive: true,
          },
          skip,
          take: Number(limit),
          orderBy: { name: 'asc' },
          include: {
            inventory: true,
            variants: {
              where: { isActive: true },
              include: { inventory: true },
            },
            supplier: true,
          },
        }),
        this.prisma.product.count({
          where: {
            categoryId,
            isActive: true,
          },
        }),
      ]);

      return {
        products,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getCategoryProducts'
      );
    }
  }

  async createCategory(data: {
    name: string;
    description?: string;
    parentId?: string;
    businessUnitId: string;
    userId: string;
    featured?: boolean;
    isActive?: boolean;
  }) {
    try {
      const existing = await this.prisma.category.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          businessUnitId: data.businessUnitId,
        },
      });

      if (existing) {
        throw new AppError('Category with this name already exists', 400);
      }

      if (data.parentId) {
        const parent = await this.prisma.category.findUnique({
          where: { id: data.parentId },
        });
        if (!parent) {
          throw new AppError('Parent category not found', 404);
        }
        if (parent.businessUnitId !== data.businessUnitId) {
          throw new AppError(
            'Parent category must be in the same business unit',
            400
          );
        }
      }

      const category = await this.prisma.category.create({
        data: {
          name: data.name,
          description: data.description,
          parentId: data.parentId || null,
          businessUnitId: data.businessUnitId,
          isActive: data.isActive !== undefined ? data.isActive : true,
          featured: data.featured || false,
        },
      });

      return category;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.createCategory');
    }
  }

  async updateCategory(
    id: string,
    data: {
      name?: string;
      description?: string;
      parentId?: string;
      featured?: boolean;
      isActive?: boolean;
    }
  ) {
    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      if (
        data.name &&
        data.name.toLowerCase() !== category.name.toLowerCase()
      ) {
        const existing = await this.prisma.category.findFirst({
          where: {
            name: { equals: data.name, mode: 'insensitive' },
            businessUnitId: category.businessUnitId,
            id: { not: id },
          },
        });
        if (existing) {
          throw new AppError('Category with this name already exists', 400);
        }
      }

      if (data.parentId) {
        if (data.parentId === id) {
          throw new AppError('Category cannot be its own parent', 400);
        }

        const parent = await this.prisma.category.findUnique({
          where: { id: data.parentId },
        });
        if (!parent) {
          throw new AppError('Parent category not found', 404);
        }
        if (parent.businessUnitId !== category.businessUnitId) {
          throw new AppError(
            'Parent category must be in the same business unit',
            400
          );
        }
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.parentId !== undefined)
        updateData.parentId = data.parentId || null;
      if (data.featured !== undefined) updateData.featured = data.featured;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      return await this.prisma.category.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.updateCategory');
    }
  }

  async deleteCategory(id: string, businessUnitId: string) {
    try {
      const category = await this.prisma.category.findFirst({
        where: { id, businessUnitId },
        include: {
          products: true,
          children: true,
        },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      if (category.products.length > 0) {
        throw new AppError(
          'Cannot delete category with associated products',
          400
        );
      }

      if (category.children.length > 0) {
        throw new AppError('Cannot delete category with child categories', 400);
      }

      return await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.deleteCategory');
    }
  }

  // ============================================
  // SUPPLIER METHODS
  // ============================================

  async getSuppliers(companyId: string) {
    try {
      return await this.prisma.supplier.findMany({
        where: { companyId },
        include: {
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getSuppliers');
    }
  }

  async getSupplierById(id: string, companyId: string) {
    try {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id, companyId },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitPrice: true,
            },
          },
          purchaseOrders: {
            select: {
              id: true,
              orderNumber: true,
              total: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          _count: {
            select: { products: true, purchaseOrders: true },
          },
        },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      return supplier;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getSupplierById');
    }
  }

  async getSupplierProducts(
    supplierId: string,
    params?: { page?: number; limit?: number }
  ) {
    try {
      const { page = 1, limit = 10 } = params || {};
      const skip = (Number(page) - 1) * Number(limit);

      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            supplierId,
            isActive: true,
          },
          skip,
          take: Number(limit),
          orderBy: { name: 'asc' },
          include: {
            category: true,
            inventory: true,
            variants: {
              where: { isActive: true },
              include: { inventory: true },
            },
          },
        }),
        this.prisma.product.count({
          where: {
            supplierId,
            isActive: true,
          },
        }),
      ]);

      return {
        products,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getSupplierProducts'
      );
    }
  }

  async createSupplier(data: {
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address?: string;
    taxId?: string;
    notes?: string;
    isActive?: boolean;
    companyId: string;
    userId: string;
  }) {
    try {
      const existing = await this.prisma.supplier.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          companyId: data.companyId,
        },
      });

      if (existing) {
        throw new AppError('Supplier with this name already exists', 400);
      }

      const supplier = await this.prisma.supplier.create({
        data: {
          name: data.name,
          contactPerson: data.contactPerson,
          email: data.email,
          phone: data.phone,
          address: data.address || null,
          taxId: data.taxId || null,
          notes: data.notes || null,
          isActive: data.isActive !== undefined ? data.isActive : true,
          companyId: data.companyId,
        },
      });

      return supplier;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.createSupplier');
    }
  }

  async updateSupplier(id: string, data: any) {
    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      if (
        data.name &&
        data.name.toLowerCase() !== supplier.name.toLowerCase()
      ) {
        const existing = await this.prisma.supplier.findFirst({
          where: {
            name: { equals: data.name, mode: 'insensitive' },
            companyId: supplier.companyId,
            id: { not: id },
          },
        });
        if (existing) {
          throw new AppError('Supplier with this name already exists', 400);
        }
      }

      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.contactPerson !== undefined)
        updateData.contactPerson = data.contactPerson;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.phone !== undefined) updateData.phone = data.phone;
      if (data.address !== undefined) updateData.address = data.address || null;
      if (data.taxId !== undefined) updateData.taxId = data.taxId || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      return await this.prisma.supplier.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.updateSupplier');
    }
  }

  async deleteSupplier(id: string, companyId: string) {
    try {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id, companyId },
        include: {
          products: true,
          purchaseOrders: true,
        },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      if (supplier.products.length > 0) {
        throw new AppError(
          'Cannot delete supplier with associated products',
          400
        );
      }

      if (supplier.purchaseOrders.length > 0) {
        throw new AppError(
          'Cannot delete supplier with associated purchase orders',
          400
        );
      }

      return await this.prisma.supplier.delete({
        where: { id },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.deleteSupplier');
    }
  }

  // ============================================
  // REVIEW METHODS
  // ============================================

  async getProductReviews(
    productId: string,
    params?: { page?: number; limit?: number }
  ) {
    try {
      const { page = 1, limit = 10 } = params || {};
      const skip = (Number(page) - 1) * Number(limit);

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const [reviews, total] = await Promise.all([
        this.prisma.productReview.findMany({
          where: { productId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          skip,
          take: Number(limit),
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.productReview.count({ where: { productId } }),
      ]);

      const stats = await this.getReviewStats(productId);

      return {
        reviews,
        stats,
        pagination: {
          total,
          page: Number(page),
          totalPages: Math.ceil(total / Number(limit)) || 1,
          limit: Number(limit),
        },
      };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getProductReviews'
      );
    }
  }

  async getReviewStats(productId: string) {
    try {
      const result = await this.prisma.productReview.groupBy({
        by: ['rating'],
        where: { productId },
        _count: true,
      });

      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let total = 0;
      let sum = 0;

      for (const item of result) {
        distribution[item.rating as keyof typeof distribution] = item._count;
        total += item._count;
        sum += item.rating * item._count;
      }

      return {
        average: total > 0 ? sum / total : 0,
        total,
        distribution,
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getReviewStats');
    }
  }

  async createProductReview(data: {
    productId: string;
    userId: string;
    rating: number;
    title?: string;
    comment?: string;
    images?: string[];
  }) {
    try {
      if (data.rating < 1 || data.rating > 5) {
        throw new AppError('Rating must be between 1 and 5', 400);
      }

      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const existing = await this.prisma.productReview.findFirst({
        where: {
          productId: data.productId,
          userId: data.userId,
        },
      });

      if (existing) {
        throw new AppError('You have already reviewed this product', 400);
      }

      const hasPurchased = await this.prisma.saleItem.findFirst({
        where: {
          productId: data.productId,
          sale: {
            userId: data.userId,
            status: 'COMPLETED',
          },
        },
      });

      const review = await this.prisma.productReview.create({
        data: {
          productId: data.productId,
          userId: data.userId,
          rating: data.rating,
          title: data.title || null,
          comment: data.comment || null,
          images: data.images || [],
          isVerified: !!hasPurchased,
          helpfulCount: 0,
          status: 'PENDING',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      await this.updateProductRating(data.productId);

      return review;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.createProductReview'
      );
    }
  }

  async updateProductReview(reviewId: string, data: any, userId: string) {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
        include: { product: true },
      });

      if (!review) {
        throw new AppError('Review not found', 404);
      }

      if (review.userId !== userId) {
        throw new AppError(
          'You are not authorized to update this review',
          403
        );
      }

      const updateData: any = {};
      if (data.rating !== undefined) updateData.rating = data.rating;
      if (data.title !== undefined) updateData.title = data.title || null;
      if (data.comment !== undefined) updateData.comment = data.comment || null;
      if (data.images !== undefined) updateData.images = data.images;

      const updatedReview = await this.prisma.productReview.update({
        where: { id: reviewId },
        data: updateData,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (data.rating && data.rating !== review.rating) {
        await this.updateProductRating(review.productId);
      }

      return updatedReview;
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateProductReview'
      );
    }
  }

  async deleteProductReview(reviewId: string, userId?: string) {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
        include: { product: true },
      });

      if (!review) {
        throw new AppError('Review not found', 404);
      }

      if (userId && review.userId !== userId) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user || user.role !== 'SUPER_ADMIN') {
          throw new AppError(
            'You are not authorized to delete this review',
            403
          );
        }
      }

      const productId = review.productId;

      await this.prisma.productReview.delete({
        where: { id: reviewId },
      });

      await this.updateProductRating(productId);

      return { message: 'Review deleted successfully' };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.deleteProductReview'
      );
    }
  }

  async verifyReview(reviewId: string) {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new AppError('Review not found', 404);
      }

      const updatedReview = await this.prisma.productReview.update({
        where: { id: reviewId },
        data: { isVerified: true },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      return updatedReview;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.verifyReview');
    }
  }

  async markReviewHelpful(reviewId: string, userId: string) {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new AppError('Review not found', 404);
      }

      const updatedReview = await this.prisma.productReview.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
      });

      return { helpful: true, helpfulCount: updatedReview.helpfulCount };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.markReviewHelpful'
      );
    }
  }

  async reportReview(reviewId: string, reason: string, userId: string) {
    try {
      const review = await this.prisma.productReview.findUnique({
        where: { id: reviewId },
      });

      if (!review) {
        throw new AppError('Review not found', 404);
      }

      return { message: 'Review reported successfully' };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.reportReview');
    }
  }

  async updateProductRating(productId: string) {
    try {
      const result = await this.prisma.productReview.aggregate({
        where: { productId },
        _avg: { rating: true },
        _count: true,
      });

      await this.prisma.product.update({
        where: { id: productId },
        data: {
          rating: result._avg.rating || 0,
          reviewCount: result._count || 0,
        },
      });
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.updateProductRating'
      );
    }
  }

  // ============================================
  // SEARCH & TAGS
  // ============================================

  async searchProducts(params: {
    query: string;
    category?: string;
    businessUnitId?: string;
  }) {
    try {
      const where: any = {
        isActive: true,
        OR: [
          { name: { contains: params.query, mode: 'insensitive' } },
          { sku: { contains: params.query, mode: 'insensitive' } },
          { barcode: { contains: params.query, mode: 'insensitive' } },
        ],
      };

      if (params.category) {
        where.categoryId = params.category;
      }
      if (params.businessUnitId) {
        where.businessUnitId = params.businessUnitId;
      }

      return await this.prisma.product.findMany({
        where,
        take: 20,
        include: {
          category: true,
          inventory: {
            where: { businessUnitId: params.businessUnitId || undefined },
          },
          variants: {
            where: { isActive: true },
            include: {
              inventory: {
                where: { businessUnitId: params.businessUnitId || undefined },
              },
            },
          },
          supplier: true,
        },
        orderBy: { name: 'asc' },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.searchProducts');
    }
  }

  // ============================================
  // WISHLIST METHODS
  // ============================================

  async toggleWishlist(userId: string, productId: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const existing = await this.prisma.wishlist.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });

      if (existing) {
        await this.prisma.wishlist.delete({
          where: {
            userId_productId: {
              userId,
              productId,
            },
          },
        });
        return { added: false, message: 'Removed from wishlist' };
      }

      await this.prisma.wishlist.create({
        data: {
          userId,
          productId,
          status: 'ACTIVE',
        },
      });

      return { added: true, message: 'Added to wishlist' };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.toggleWishlist');
    }
  }

  async getWishlist(
    userId: string,
    params?: { page?: number; limit?: number }
  ) {
    try {
      const { page = 1, limit = 20 } = params || {};
      const skip = (Number(page) - 1) * Number(limit);

      const [wishlistItems, total] = await Promise.all([
        this.prisma.wishlist.findMany({
          where: { userId, status: 'ACTIVE' },
          skip,
          take: Number(limit),
          include: {
            product: {
              include: {
                category: true,
                inventory: true,
                variants: {
                  where: { isActive: true },
                  include: { inventory: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.wishlist.count({
          where: { userId, status: 'ACTIVE' },
        }),
      ]);

      const products = wishlistItems.map((item) => ({
        ...item.product,
        wishlistId: item.id,
        addedAt: item.createdAt,
      }));

      return {
        products,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)) || 1,
        limit: Number(limit),
      };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getWishlist');
    }
  }

  async checkWishlist(userId: string, productId: string) {
    try {
      const item = await this.prisma.wishlist.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });
      return !!item;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.checkWishlist');
    }
  }

  async getWishlistCount(userId: string) {
    try {
      return await this.prisma.wishlist.count({
        where: { userId, status: 'ACTIVE' },
      });
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.getWishlistCount');
    }
  }

  async getWishlistProductIds(userId: string) {
    try {
      const items = await this.prisma.wishlist.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { productId: true },
      });
      return items.map((item) => item.productId);
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getWishlistProductIds'
      );
    }
  }

  async clearWishlist(userId: string) {
    try {
      await this.prisma.wishlist.deleteMany({
        where: { userId },
      });
      return { message: 'Wishlist cleared' };
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.clearWishlist');
    }
  }

  // ============================================
  // RECENTLY VIEWED METHODS
  // ============================================

  async addRecentlyViewed(userId: string, productId: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      await this.prisma.recentlyViewed.upsert({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
        update: {
          viewedAt: new Date(),
        },
        create: {
          userId,
          productId,
          viewedAt: new Date(),
        },
      });

      return { message: 'Added to recently viewed' };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.addRecentlyViewed'
      );
    }
  }

  async getRecentlyViewed(userId: string, limit: number = 10) {
    try {
      const items = await this.prisma.recentlyViewed.findMany({
        where: { userId },
        take: Math.min(Number(limit) || 10, 50),
        orderBy: { viewedAt: 'desc' },
        include: {
          product: {
            include: {
              category: true,
              inventory: true,
              variants: {
                where: { isActive: true },
                include: { inventory: true },
              },
            },
          },
        },
      });

      return items.map((item) => item.product);
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.getRecentlyViewed'
      );
    }
  }

  async clearRecentlyViewed(userId: string) {
    try {
      await this.prisma.recentlyViewed.deleteMany({
        where: { userId },
      });
      return { message: 'Recently viewed cleared' };
    } catch (error) {
      return this.handleServiceError(
        error,
        'ProductService.clearRecentlyViewed'
      );
    }
  }

  // ============================================
  // COMPARE METHODS
  // ============================================

  async compareProducts(productIds: string[]) {
    try {
      if (!productIds || productIds.length < 2) {
        throw new AppError(
          'At least 2 products are required for comparison',
          400
        );
      }

      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
        include: {
          category: true,
          inventory: true,
          variants: {
            where: { isActive: true },
            include: { inventory: true },
          },
          supplier: true,
          reviews: {
            select: {
              rating: true,
              comment: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });

      if (products.length !== productIds.length) {
        throw new AppError('Some products not found', 404);
      }

      return products;
    } catch (error) {
      return this.handleServiceError(error, 'ProductService.compareProducts');
    }
  }
}

export const productService = new ProductService();

// ===== END PART 7 of 7 — FILE COMPLETE =====
