// D:\Projects\Kalwanga\packages\backend\src\services\inventoryService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { realtimeService } from './realtimeService.js';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// INTERFACES
// ============================================

interface CreateProductData {
  name: string;
  sku: string;
  price?: number;
  unitPrice?: number;
  costPrice?: number;
  stock: number;
  reorderPoint?: number;
  category?: string;
  categoryId?: string;
  location?: string;
  barcode?: string;
  businessUnitId: string;
  userId: string;
  description?: string;
  images?: string[];
  supplier?: string;
  supplierId?: string;
  expiryDate?: Date;
  batchNumber?: string;
}

interface UpdateProductData {
  name?: string;
  sku?: string;
  price?: number;
  unitPrice?: number;
  costPrice?: number;
  category?: string;
  categoryId?: string;
  location?: string;
  status?: string;
  businessUnitId: string;
  description?: string;
  images?: string[];
  supplier?: string;
  supplierId?: string;
}

interface UpdateStockData {
  productId: string;
  quantity: number;
  transactionType: string;
  userId: string;
  businessUnitId: string;
  notes?: string;
  reference?: string;
  variantId?: string;
  inventoryId?: string;
  batchNumber?: string;
  expiryDate?: Date;
}

interface TransferStockData {
  productId: string;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  notes?: string;
  businessUnitId: string;
  userId: string;
  variantId?: string;
}

interface CreateItemData {
  name: string;
  category: string;
  categoryId?: string;
  quantity: number;
  unit: string;
  minStock?: number;
  maxStock?: number;
  location?: string;
  supplier?: string;
  supplierId?: string;
  unitPrice?: number;
  purchaseDate?: string;
  expiryDate?: string;
  notes?: string;
  businessUnitId: string;
  userId: string;
  description?: string;
  barcode?: string;
  sku?: string;
  weight?: number;
  taxRate?: number;
  tags?: string[];
  images?: string[];
  isActive?: boolean;
  isDigital?: boolean;
  featured?: boolean;
}

interface IssueItemData {
  inventoryId: string;
  issuedTo: string;
  quantity: number;
  purpose?: string;
  remarks?: string;
  expectedReturnDate?: string;
  businessUnitId: string;
  userId: string;
}

interface ReturnItemData {
  inventoryId: string;
  quantity?: number;
  returnDate?: string;
  remarks?: string;
  businessUnitId: string;
  userId: string;
}

interface RestockItemData {
  inventoryId: string;
  quantity: number;
  unitPrice?: number;
  supplier?: string;
  purchaseDate?: string;
  businessUnitId: string;
  userId: string;
  notes?: string;
  invoiceNumber?: string;
}

interface InventoryReport {
  totalItems: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  lowStockItems: number;
  outOfStockItems: number;
  byCategory: Array<{ category: string; count: number; value: number }>;
  byLocation: Array<{ location: string; count: number; value: number }>;
  topMovers: Array<{ productId: string; name: string; movements: number }>;
}

interface InventoryStats {
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalValue: number;
  totalCost: number;
  potentialProfit: number;
  profitMargin: number;
  totalUnits: number;
  totalReserved: number;
  availableUnits: number;
  byCategory: Array<{ category: string; count: number; value: number }>;
}

interface CategoryOption {
  id: string;
  name: string;
  productCount?: number;
}

// ============================================
// ✅ FIX: NORMALIZATION HELPERS
// ============================================

/**
 * Normalize inventory item to ensure product ID is available at top level
 * This ensures that when inventory items are returned to the frontend,
 * the product ID is accessible at the top level for ProductCard.
 */
function normalizeInventoryItem(item: any): any {
  if (!item) return item;
  
  // If item has a product object with an id, ensure top-level id exists
  if (item.product && item.product.id) {
    // If top-level id is missing or different, use product.id
    if (!item.id || item.id !== item.product.id) {
      return {
        ...item,
        id: item.product.id,
        // Also ensure other product fields are available at top level
        name: item.name || item.product.name,
        unitPrice: item.unitPrice || item.product.unitPrice,
        images: item.images || item.product.images || [],
        isActive: item.isActive !== undefined ? item.isActive : item.product?.isActive,
        sku: item.sku || item.product.sku,
        description: item.description || item.product.description,
        category: item.category || item.product.category,
        categoryId: item.categoryId || item.product.categoryId,
        supplier: item.supplier || item.product.supplier,
        supplierId: item.supplierId || item.product.supplierId,
        minStock: item.minStock || item.product.minStock,
        maxStock: item.maxStock || item.product.maxStock,
        featured: item.featured || item.product.featured,
        isDigital: item.isDigital || item.product.isDigital,
        tags: item.tags || item.product.tags || [],
        attributes: item.attributes || item.product.attributes || {},
        notes: item.notes || item.product.notes,
        taxRate: item.taxRate || item.product.taxRate,
        weight: item.weight || item.product.weight,
        costPrice: item.costPrice || item.product.costPrice,
        // Keep the original product reference for backward compatibility
        _product: item.product,
        // Ensure productId is set
        productId: item.product.id,
        // Ensure inventory array exists for stock status
        inventory: item.inventory || [{
          quantity: item.quantity || item.product?.stock || 0,
          reserved: item.reserved || 0,
        }],
        // Ensure stock field exists for compatibility
        stock: item.quantity || item.stock || 0,
        // Ensure price field exists
        price: item.price || item.unitPrice || item.product?.unitPrice || 0,
      };
    }
  }
  
  // If item has an inventoryId but no top-level id
  if (!item.id && item.inventoryId) {
    return {
      ...item,
      id: item.inventoryId,
    };
  }
  
  // If item has a productId but no top-level id
  if (!item.id && item.productId) {
    return {
      ...item,
      id: item.productId,
    };
  }
  
  // Ensure inventory array exists
  if (item && !item.inventory) {
    return {
      ...item,
      inventory: [{
        quantity: item.quantity || item.stock || 0,
        reserved: item.reserved || 0,
      }],
    };
  }
  
  // Ensure stock field exists
  if (item && item.quantity !== undefined && item.stock === undefined) {
    return {
      ...item,
      stock: item.quantity,
    };
  }
  
  return item;
}

/**
 * Normalize an array of inventory items
 */
function normalizeInventoryItems(items: any[]): any[] {
  if (!items || !Array.isArray(items)) return [];
  return items.map(normalizeInventoryItem);
}

// ============================================
// INVENTORY SERVICE
// ============================================

export class InventoryService extends BaseService {
  /**
   * Check if a string is a valid ID (CUID or UUID)
   */
  private isValidID(id: string): boolean {
    if (!id || id === 'default') return false;
    const cuidRegex = /^c[a-z0-9]{24}$/i;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const simpleIdRegex = /^[a-zA-Z0-9_-]{10,50}$/;
    return cuidRegex.test(id) || uuidRegex.test(id) || simpleIdRegex.test(id);
  }

  /**
   * Get all active business units from database
   */
  private async getAllBusinessUnits(): Promise<Array<{ id: string; name: string }>> {
    try {
      const businessUnits = await this.prisma.businessUnit.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
        },
      });

      console.log(`📊 Found ${businessUnits.length} active business units in database`);
      return businessUnits;
    } catch (error) {
      console.error('❌ Failed to fetch business units:', error);
      return [];
    }
  }

  /**
   * Get a specific business unit by ID, or return all if no ID provided
   */
  private async getBusinessUnits(businessUnitId?: string): Promise<Array<{ id: string; name: string }>> {
    if (businessUnitId && businessUnitId !== 'default' && businessUnitId !== 'default-business-unit') {
      const existing = await this.prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        select: { id: true, name: true, isActive: true },
      });

      if (existing && existing.isActive) {
        console.log(`✅ Found business unit: ${existing.id} (${existing.name})`);
        return [{ id: existing.id, name: existing.name }];
      }

      if (existing && !existing.isActive) {
        console.warn(`⚠️ Business unit ${businessUnitId} is inactive, returning all active units`);
        return this.getAllBusinessUnits();
      }

      console.warn(`⚠️ Business unit ${businessUnitId} not found, returning all active units`);
      return this.getAllBusinessUnits();
    }

    console.log('📤 No specific business unit ID provided, returning all active business units');
    return this.getAllBusinessUnits();
  }

  /**
   * Ensure business unit exists and return it
   */
  private async ensureBusinessUnit(businessUnitId?: string): Promise<{ id: string; name: string }> {
    console.log('🔍 Ensuring business unit for ID:', businessUnitId);
    
    if (!businessUnitId || businessUnitId === 'default' || businessUnitId === 'default-business-unit') {
      const allUnits = await this.getAllBusinessUnits();
      
      if (allUnits.length > 0) {
        console.log(`✅ Using first active business unit: ${allUnits[0].id} (${allUnits[0].name})`);
        return allUnits[0];
      }

      console.log('⚠️ No active business units found, creating default');
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
        console.log('✅ Created default company:', company.id);
      }

      const newBusinessUnit = await this.prisma.businessUnit.create({
        data: {
          name: 'Default Business Unit',
          code: `BU-${Date.now().toString().slice(-6)}`,
          isActive: true,
          companyId: company.id,
          type: 'STORE',
        },
      });

      console.log('✅ Created default business unit:', newBusinessUnit.id, newBusinessUnit.name);
      return { id: newBusinessUnit.id, name: newBusinessUnit.name };
    }

    const existing = await this.prisma.businessUnit.findUnique({
      where: { id: businessUnitId },
      select: { id: true, name: true, isActive: true },
    });

    if (existing && existing.isActive) {
      console.log('✅ Found existing business unit:', existing.id, existing.name);
      return { id: existing.id, name: existing.name };
    }

    console.warn(`⚠️ Business unit ${businessUnitId} not found or inactive, falling back to first active`);
    const fallback = await this.prisma.businessUnit.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });

    if (fallback) {
      console.log('✅ Using fallback business unit:', fallback.id, fallback.name);
      return fallback;
    }

    return this.ensureBusinessUnit('default');
  }

  /**
   * Safely emit inventory update (internal method)
   */
  private safeEmitInventoryUpdate(data: any, businessUnitId: string): void {
    try {
      (realtimeService as any).emitInventoryUpdated?.(data, businessUnitId);
    } catch (error) {
      console.warn('Failed to emit inventory update:', error);
    }
  }

  /**
   * Safely emit low stock alert (internal method)
   */
  private safeEmitLowStockAlert(data: any, businessUnitId: string): void {
    try {
      (realtimeService as any).emitLowStockAlert?.(data, businessUnitId);
    } catch (error) {
      console.warn('Failed to emit low stock alert:', error);
    }
  }

  /**
   * Generate unique barcode
   */
  private async generateUniqueBarcode(tx: any): Promise<string> {
    let barcode: string;
    let counter = 0;
    do {
      barcode = `2${Date.now().toString().slice(-11)}${counter}`.slice(0, 13);
      counter++;
      if (counter > 100) {
        throw new AppError('Failed to generate unique barcode', 500);
      }
    } while (await tx.product.findFirst({ where: { barcode } }));
    return barcode;
  }

  /**
   * Calculate comprehensive inventory statistics
   */
  private async calculateInventoryStats(businessUnitId: string): Promise<InventoryStats> {
    try {
      const [totalProducts, lowStockCount, outOfStockCount, inventoryItems] = await Promise.all([
        this.prisma.inventory.count({ where: { businessUnitId } }),
        this.prisma.inventory.count({
          where: { businessUnitId, quantity: { lte: 10, gt: 0 } },
        }),
        this.prisma.inventory.count({ where: { businessUnitId, quantity: 0 } }),
        this.prisma.inventory.findMany({
          where: { businessUnitId },
          include: {
            product: {
              select: { costPrice: true, unitPrice: true, category: { select: { name: true, id: true } } },
            },
          },
        }),
      ]);

      const totalValueAmount = inventoryItems.reduce((sum: number, item: any) => sum + (item.quantity * (item.product?.unitPrice || 0)), 0);
      const totalCostAmount = inventoryItems.reduce((sum: number, item: any) => sum + (item.quantity * (item.product?.costPrice || 0)), 0);
      const totalUnits = inventoryItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
      const totalReserved = inventoryItems.reduce((sum: number, item: any) => sum + (item.reserved || 0), 0);

      const categoryStats = new Map<string, { count: number; value: number; id?: string }>();
      inventoryItems.forEach((item: any) => {
        const categoryName = item.product?.category?.name || 'Uncategorized';
        const categoryId = item.product?.category?.id || null;
        const current = categoryStats.get(categoryName) || { count: 0, value: 0, id: categoryId };
        current.count += item.quantity;
        current.value += item.quantity * (item.product?.unitPrice || 0);
        categoryStats.set(categoryName, current);
      });

      return {
        totalProducts,
        lowStockCount,
        outOfStockCount,
        totalValue: totalValueAmount,
        totalCost: totalCostAmount,
        potentialProfit: totalValueAmount - totalCostAmount,
        profitMargin: totalCostAmount > 0 ? ((totalValueAmount - totalCostAmount) / totalCostAmount) * 100 : 0,
        totalUnits,
        totalReserved,
        availableUnits: totalUnits - totalReserved,
        byCategory: Array.from(categoryStats.entries()).map(([category, data]) => ({ category, ...data })),
      };
    } catch (error) {
      console.warn('Failed to calculate inventory stats:', error);
      return {
        totalProducts: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        totalValue: 0,
        totalCost: 0,
        potentialProfit: 0,
        profitMargin: 0,
        totalUnits: 0,
        totalReserved: 0,
        availableUnits: 0,
        byCategory: [],
      };
    }
  }

  /**
   * Format inventory item for consistent response
   * ✅ FIXED: Returns normalized item with product ID at top level
   */
    private formatInventoryItem(item: any): any {
      if (!item) return null;
      
      // First normalize the item
      const normalized = normalizeInventoryItem(item);
      
      const availableStock = normalized.available !== undefined && normalized.available !== null
        ? normalized.available
        : Math.max(0, (normalized.quantity || 0) - (normalized.reserved || 0));
      
      const status = normalized.quantity === 0 
        ? 'out_of_stock' 
        : normalized.quantity <= (normalized.reorderPoint || 5) 
          ? 'low_stock' 
          : normalized.status === 'INACTIVE' 
            ? 'inactive' 
            : 'active';

      // Get product info from the relation
      const product = normalized.product;
      const variant = normalized.variant;

      // ✅ FIX: Return object with no duplicate properties
      return {
        id: normalized.id || item.id,
        productId: product?.id || normalized.productId || null,
        product: product || null,
        variantId: variant?.id || normalized.variantId || null,
        variant: variant || null,
        name: product?.name || variant?.name || normalized.name || 'Unknown Product',
        description: product?.description || normalized.description || null,
        sku: product?.sku || variant?.sku || normalized.sku || 'N/A',
        barcode: product?.barcode || normalized.barcode || null,
        quantity: normalized.quantity || 0,
        stock: normalized.quantity || 0,
        reserved: normalized.reserved || 0,
        available: availableStock,
        price: product?.unitPrice || variant?.price || normalized.unitPrice || 0,
        unitPrice: product?.unitPrice || variant?.price || normalized.unitPrice || 0,
        costPrice: product?.costPrice || normalized.costPrice || 0,
        reorderPoint: normalized.reorderPoint || 5,
        reorderQuantity: normalized.reorderQuantity || 10,
        category: product?.category?.name || normalized.category || 'Uncategorized',
        categoryId: product?.category?.id || normalized.categoryId || null,
        location: normalized.location || 'Warehouse',
        shelfNumber: normalized.shelfNumber || null,
        supplier: normalized.supplier || product?.supplier?.name || null,
        supplierId: product?.supplierId || normalized.supplierId || null,
        notes: normalized.notes || null,
        lastUpdated: normalized.updatedAt || item.updatedAt,
        createdAt: normalized.createdAt || item.createdAt,
        updatedAt: normalized.updatedAt || item.updatedAt,
        status,
        isActive: product?.isActive ?? normalized.isActive ?? true,
        images: product?.images || normalized.images || [],
        tags: product?.tags || normalized.tags || [],
        weight: product?.weight || normalized.weight || 0,
        taxRate: product?.taxRate || normalized.taxRate || 0,
        isDigital: product?.isDigital || normalized.isDigital || false,
        featured: product?.featured || normalized.featured || false,
        inventory: normalized.inventory || [{
          quantity: normalized.quantity || 0,
          reserved: normalized.reserved || 0,
        }],
        businessUnitId: normalized.businessUnitId || item.businessUnitId,
      };
    }

  // ============================================
  // FIXED: getCategories()
  // ============================================

  async getCategories(businessUnitId?: string): Promise<CategoryOption[]> {
    try {
      console.log(`📤 getCategories called with businessUnitId: ${businessUnitId || 'undefined'}`);
      
      let actualBusinessUnitId: string | undefined;
      
      if (businessUnitId && businessUnitId !== 'default' && businessUnitId !== 'default-business-unit') {
        const existing = await this.prisma.businessUnit.findUnique({
          where: { id: businessUnitId },
          select: { id: true, isActive: true }
        });
        
        if (existing && existing.isActive) {
          actualBusinessUnitId = existing.id;
          console.log(`✅ Using provided business unit: ${actualBusinessUnitId}`);
        } else {
          console.warn(`⚠️ Business unit ${businessUnitId} not found or inactive`);
        }
      }
      
      if (!actualBusinessUnitId) {
        const firstBU = await this.prisma.businessUnit.findFirst({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { createdAt: 'asc' }
        });
        
        if (firstBU) {
          actualBusinessUnitId = firstBU.id;
          console.log(`✅ Using first active business unit: ${actualBusinessUnitId}`);
        } else {
          console.warn('⚠️ No active business unit found - returning empty categories');
          return [];
        }
      }

      const whereClause: any = {
        isActive: true
      };
      
      if (actualBusinessUnitId) {
        whereClause.businessUnitId = actualBusinessUnitId;
      }
      
      console.log(`📊 Querying categories with where:`, JSON.stringify(whereClause, null, 2));
      
      const categories = await this.prisma.category.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              products: { 
                where: { isActive: true }
              },
            },
          },
          children: {
            where: { isActive: true },
            select: { id: true, name: true }
          }
        },
        orderBy: { name: 'asc' },
      });

      console.log(`✅ Found ${categories.length} categories for business unit ${actualBusinessUnitId}`);

      const result = categories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        productCount: cat._count?.products || 0,
        childrenCount: cat.children?.length || 0,
        hasChildren: (cat.children?.length || 0) > 0,
      }));

      return result;
      
    } catch (error) {
      console.error('❌ Failed to fetch categories:', error);
      return [];
    }
  }

  async getSuppliers(businessUnitId?: string): Promise<Array<{ id: string; name: string; email?: string | null; phone?: string | null }>> {
    try {
      console.log('📤 Fetching suppliers');
      
      const suppliers = await this.prisma.supplier.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
        orderBy: { name: 'asc' },
      });

      console.log(`✅ Found ${suppliers.length} suppliers`);
      return suppliers;
    } catch (error) {
      console.error('❌ Failed to fetch suppliers:', error);
      return [];
    }
  }

  async getCategorySummary(businessUnitId: string): Promise<Array<{ id: string; name: string; categoryId?: string; count: number; value: number }>> {
    try {
      console.log('📤 Fetching category summary for businessUnitId:', businessUnitId);
      
      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      console.log('✅ Resolved business unit:', resolvedBU.id, resolvedBU.name);
      
      const categories = await this.prisma.category.findMany({
        where: {
          businessUnitId: resolvedBU.id,
          isActive: true,
        },
        include: {
          products: {
            where: { 
              isActive: true,
              inventory: {
                some: {
                  businessUnitId: resolvedBU.id
                }
              }
            },
            select: {
              id: true,
              name: true,
              unitPrice: true,
              inventory: {
                where: { businessUnitId: resolvedBU.id },
                select: { 
                  quantity: true,
                  available: true,
                  reserved: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      console.log(`✅ Found ${categories.length} categories in database`);

      const result = categories.map((cat: any) => {
        let totalCount = 0;
        let totalValue = 0;
        
        cat.products.forEach((product: any) => {
          const inventory = product.inventory?.[0];
          if (inventory) {
            const quantity = inventory.quantity || 0;
            const price = product.unitPrice || 0;
            totalCount += quantity;
            totalValue += quantity * price;
          }
        });

        return {
          id: cat.id,
          name: cat.name,
          categoryId: cat.id,
          count: totalCount,
          value: totalValue,
        };
      });

      console.log('✅ Category summary prepared:', result.length);
      return result;
    } catch (error) {
      console.error('❌ Failed to fetch category summary:', error);
      return [];
    }
  }

  // ============================================
  // GET ENDPOINTS
  // ============================================

  async getInventory(params: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    lowStock?: boolean;
    productId?: string;
    category?: string;
    location?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeInactive?: boolean;
    hasBarcode?: boolean;
    minPrice?: number;
    maxPrice?: number;
    supplier?: string;
    inStock?: boolean;
  }) {
    try {
      console.log('🔍 InventoryService.getInventory called with params:', JSON.stringify(params, null, 2));
      
      const { 
        page = 1, 
        limit = 10, 
        search, 
        businessUnitId, 
        lowStock, 
        productId, 
        category,
        location,
        status,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
        includeInactive = false,
        hasBarcode,
        minPrice,
        maxPrice,
        supplier,
        inStock,
      } = params;
      
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(200, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      // Valid sort fields on Inventory model
      const validSortFields = [
        'id', 'quantity', 'reserved', 'available', 'reorderPoint', 
        'reorderQuantity', 'location', 'shelfNumber', 'supplier', 
        'notes', 'status', 'createdAt', 'updatedAt'
      ];
      
      const sortFieldMap: Record<string, string> = {
        'name': 'productName',
        'productName': 'productName',
        'product.name': 'productName',
        'sku': 'productSku',
        'productSku': 'productSku',
        'product.sku': 'productSku',
        'unitPrice': 'productUnitPrice',
        'productUnitPrice': 'productUnitPrice',
        'product.unitPrice': 'productUnitPrice',
        'price': 'productUnitPrice',
        'costPrice': 'productCostPrice',
        'productCostPrice': 'productCostPrice',
        'product.costPrice': 'productCostPrice',
        'category': 'productCategory',
        'productCategory': 'productCategory',
        'product.category': 'productCategory',
        'supplierName': 'productSupplier',
        'productSupplier': 'productSupplier',
        'product.supplier': 'productSupplier',
      };

      let actualSortField = sortBy;
      let isNestedSort = false;
      let nestedSortPath: string[] = [];

      if (sortFieldMap[sortBy]) {
        const mappedField = sortFieldMap[sortBy];
        if (mappedField.startsWith('product')) {
          isNestedSort = true;
          if (mappedField === 'productName') {
            nestedSortPath = ['product', 'name'];
          } else if (mappedField === 'productSku') {
            nestedSortPath = ['product', 'sku'];
          } else if (mappedField === 'productUnitPrice') {
            nestedSortPath = ['product', 'unitPrice'];
          } else if (mappedField === 'productCostPrice') {
            nestedSortPath = ['product', 'costPrice'];
          } else if (mappedField === 'productCategory') {
            nestedSortPath = ['product', 'category', 'name'];
          } else if (mappedField === 'productSupplier') {
            nestedSortPath = ['product', 'supplier', 'name'];
          }
        } else {
          actualSortField = mappedField;
        }
      }

      const isValidDirectField = validSortFields.includes(actualSortField);
      const isValidNestedField = isNestedSort && nestedSortPath.length > 0;

      let orderBy: any = {};

      if (isValidNestedField) {
        let current = orderBy;
        for (let i = 0; i < nestedSortPath.length - 1; i++) {
          current[nestedSortPath[i]] = {};
          current = current[nestedSortPath[i]];
        }
        const lastKey = nestedSortPath[nestedSortPath.length - 1];
        current[lastKey] = sortOrder;
        console.log(`📊 Using nested sorting: ${nestedSortPath.join('.')} ${sortOrder}`);
      } else if (isValidDirectField) {
        orderBy = { [actualSortField]: sortOrder };
        console.log(`📊 Using direct sorting: ${actualSortField} ${sortOrder}`);
      } else {
        orderBy = { createdAt: sortOrder };
        console.log(`📊 Falling back to createdAt sorting: ${sortOrder}`);
      }

      if (!businessUnitId || businessUnitId === 'default' || businessUnitId === 'default-business-unit') {
        console.log('📤 No specific business unit, fetching inventory across ALL business units');
        
        const where: any = {};

        if (location) where.location = { contains: location, mode: 'insensitive' as const };
        if (status === 'inactive') where.status = 'INACTIVE';
        if (lowStock) where.quantity = { lte: 10, gt: 0 };
        
        if (inStock === true) where.quantity = { gt: 0 };
        else if (inStock === false) where.quantity = { equals: 0 };
        
        if (search) {
          where.OR = [
            { product: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
            { product: { is: { sku: { contains: search, mode: 'insensitive' as const } } } },
            { product: { is: { barcode: { contains: search, mode: 'insensitive' as const } } } },
          ];
        }

        if (category) {
          where.product = {
            is: {
              category: {
                is: {
                  name: { contains: category, mode: 'insensitive' as const }
                }
              }
            }
          };
        }

        console.log('📊 Where clause (all business units):', JSON.stringify(where, null, 2));
        console.log(`📊 Pagination: page=${validatedPage}, limit=${validatedLimit}, skip=${skip}`);

        const [inventory, total] = await Promise.all([
          this.prisma.inventory.findMany({
            where,
            skip,
            take: validatedLimit,
            orderBy: orderBy,
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  barcode: true,
                  unitPrice: true,
                  costPrice: true,
                  category: { select: { id: true, name: true } },
                  supplier: { select: { id: true, name: true } },
                  images: true,
                  isActive: true,
                  description: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  price: true,
                  attributes: true,
                  isActive: true,
                },
              },
              businessUnit: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          }),
          this.prisma.inventory.count({ where }),
        ]);

        console.log(`📊 Found ${inventory.length} inventory items across all business units, total: ${total}`);

        const formattedInventory = inventory.map((item: any) => this.formatInventoryItem(item));
        
        const totalUnits = formattedInventory.reduce((sum: number, item: any) => sum + (item.stock || 0), 0);
        const totalReserved = formattedInventory.reduce((sum: number, item: any) => sum + (item.reserved || 0), 0);

        const allBusinessUnits = await this.getAllBusinessUnits();
        let combinedStats: InventoryStats = {
          totalProducts: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          totalValue: 0,
          totalCost: 0,
          potentialProfit: 0,
          profitMargin: 0,
          totalUnits: 0,
          totalReserved: 0,
          availableUnits: 0,
          byCategory: [],
        };

        for (const bu of allBusinessUnits) {
          const stats = await this.calculateInventoryStats(bu.id);
          combinedStats.totalProducts += stats.totalProducts;
          combinedStats.lowStockCount += stats.lowStockCount;
          combinedStats.outOfStockCount += stats.outOfStockCount;
          combinedStats.totalValue += stats.totalValue;
          combinedStats.totalCost += stats.totalCost;
          combinedStats.potentialProfit += stats.potentialProfit;
          combinedStats.totalUnits += stats.totalUnits;
          combinedStats.totalReserved += stats.totalReserved;
          combinedStats.availableUnits += stats.availableUnits;
          combinedStats.byCategory = [...combinedStats.byCategory, ...stats.byCategory];
        }

        return {
          inventory: formattedInventory,
          total,
          page: validatedPage,
          limit: validatedLimit,
          totalPages: Math.ceil(total / validatedLimit),
          stats: {
            ...combinedStats,
            totalUnits,
            totalReserved,
            availableUnits: totalUnits - totalReserved,
          },
          appliedFilters: {
            search: search || null,
            category: category || null,
            location: location || null,
            status: status || null,
            lowStock: lowStock || false,
          },
        };
      }

      // Specific business unit
      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      console.log('✅ Resolved business unit for getInventory:', resolvedBU.id, resolvedBU.name);

      const where: any = {
        businessUnitId: resolvedBU.id,
      };

      if (location) where.location = { contains: location, mode: 'insensitive' as const };
      if (status === 'inactive') where.status = 'INACTIVE';
      if (lowStock) where.quantity = { lte: 10, gt: 0 };
      
      if (inStock === true) where.quantity = { gt: 0 };
      else if (inStock === false) where.quantity = { equals: 0 };
      
      if (search) {
        where.OR = [
          { product: { is: { name: { contains: search, mode: 'insensitive' as const } } } },
          { product: { is: { sku: { contains: search, mode: 'insensitive' as const } } } },
          { product: { is: { barcode: { contains: search, mode: 'insensitive' as const } } } },
        ];
      }

      if (category) {
        where.product = {
          is: {
            category: {
              is: {
                name: { contains: category, mode: 'insensitive' as const }
              }
            }
          }
        };
      }

      console.log('📊 Where clause:', JSON.stringify(where, null, 2));
      console.log(`📊 Pagination: page=${validatedPage}, limit=${validatedLimit}, skip=${skip}`);
      console.log(`📊 OrderBy:`, JSON.stringify(orderBy, null, 2));

      const [inventory, total, stats] = await Promise.all([
        this.prisma.inventory.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy: orderBy,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                unitPrice: true,
                costPrice: true,
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                images: true,
                isActive: true,
                description: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                attributes: true,
                isActive: true,
              },
            },
          },
        }),
        this.prisma.inventory.count({ where }),
        this.calculateInventoryStats(resolvedBU.id),
      ]);

      console.log(`📊 Found ${inventory.length} inventory items, total: ${total}`);

      let formattedInventory = inventory.map((item: any) => this.formatInventoryItem(item));

      // Apply in-memory sorting for nested fields
      const isNestedSortBy = ['name', 'productName', 'sku', 'productSku', 'unitPrice', 'productUnitPrice', 'costPrice', 'productCostPrice', 'category', 'productCategory', 'supplier', 'productSupplier'].includes(sortBy);
      
      if (isNestedSortBy) {
        console.log(`📊 Applying in-memory sorting for nested field: ${sortBy}`);
        
        if (sortBy === 'name' || sortBy === 'productName') {
          formattedInventory.sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
          });
        } else if (sortBy === 'sku' || sortBy === 'productSku') {
          formattedInventory.sort((a, b) => {
            const skuA = a.sku || '';
            const skuB = b.sku || '';
            return sortOrder === 'asc' ? skuA.localeCompare(skuB) : skuB.localeCompare(skuA);
          });
        } else if (sortBy === 'unitPrice' || sortBy === 'productUnitPrice' || sortBy === 'price') {
          formattedInventory.sort((a, b) => {
            const priceA = a.price || 0;
            const priceB = b.price || 0;
            return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
          });
        } else if (sortBy === 'costPrice' || sortBy === 'productCostPrice') {
          formattedInventory.sort((a, b) => {
            const costA = a.costPrice || 0;
            const costB = b.costPrice || 0;
            return sortOrder === 'asc' ? costA - costB : costB - costA;
          });
        } else if (sortBy === 'category' || sortBy === 'productCategory') {
          formattedInventory.sort((a, b) => {
            const catA = a.category || '';
            const catB = b.category || '';
            return sortOrder === 'asc' ? catA.localeCompare(catB) : catB.localeCompare(catA);
          });
        } else if (sortBy === 'supplier' || sortBy === 'productSupplier') {
          formattedInventory.sort((a, b) => {
            const supA = a.supplier || '';
            const supB = b.supplier || '';
            return sortOrder === 'asc' ? supA.localeCompare(supB) : supB.localeCompare(supA);
          });
        }
      }

      const totalUnits = formattedInventory.reduce((sum: number, item: any) => sum + (item.stock || 0), 0);
      const totalReservedVal = formattedInventory.reduce((sum: number, item: any) => sum + (item.reserved || 0), 0);

      return {
        inventory: formattedInventory,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
        stats: {
          ...stats,
          totalUnits,
          totalReserved: totalReservedVal,
          availableUnits: totalUnits - totalReservedVal,
        },
        appliedFilters: {
          search: search || null,
          category: category || null,
          location: location || null,
          status: status || null,
          lowStock: lowStock || false,
        },
      };
    } catch (error) {
      console.error('❌ Error in InventoryService.getInventory:', error);
      throw error;
    }
  }

  async getAllInventory(businessUnitId: string): Promise<{ items: any[]; stats: InventoryStats }> {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitPrice: true,
              costPrice: true,
              barcode: true,
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              images: true,
              isActive: true,
              description: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          variant: {
            select: { id: true, name: true, sku: true, price: true, attributes: true, isActive: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // ✅ FIX: Format items properly with normalization
      const formattedItems = items.map((item: any) => {
        const product = item.product;
        const variant = item.variant;
        
        const baseItem = {
          id: item.id,
          productId: product?.id || null,
          product: product || null,
          variantId: variant?.id || null,
          variant: variant || null,
          name: product?.name || variant?.name || 'Unknown Product',
          sku: product?.sku || variant?.sku || 'N/A',
          barcode: product?.barcode || null,
          quantity: item.quantity,
          stock: item.quantity,
          reserved: item.reserved || 0,
          available: item.quantity - (item.reserved || 0),
          unitPrice: product?.unitPrice || variant?.price || 0,
          price: product?.unitPrice || variant?.price || 0,
          costPrice: product?.costPrice || 0,
          category: product?.category?.name || 'Uncategorized',
          categoryId: product?.category?.id || null,
          supplier: item.supplier || product?.supplier?.name || null,
          supplierId: product?.supplierId || null,
          reorderPoint: item.reorderPoint || 5,
          location: item.location || 'Warehouse',
          notes: item.notes || null,
          hasProduct: !!product,
          isActive: product?.isActive ?? true,
          images: product?.images || [],
          description: product?.description || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          status: item.status || 'ACTIVE',
          businessUnitId: item.businessUnitId,
        };
        
        // ✅ Apply normalization to ensure product ID is at top level
        return normalizeInventoryItem(baseItem);
      });

      const stats = await this.calculateInventoryStats(resolvedBU.id);

      return { items: formattedItems, stats };
    } catch (error) {
      this.handleError(error, 'InventoryService.getAllInventory');
      throw error;
    }
  }

  async getInventoryByProduct(productId: string, businessUnitId: string) {
    try {
      if (!productId || !businessUnitId) {
        throw new AppError('Product ID and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        include: {
          inventory: {
            include: {
              product: {
                include: {
                  category: { select: { id: true, name: true } },
                  supplier: { select: { id: true, name: true } },
                  variants: { where: { isActive: true } },
                },
              },
              variant: true,
              transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
          },
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          variants: { where: { isActive: true } },
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      if (!product.inventory) {
        throw new AppError('Product not found in inventory', 404);
      }

      // ✅ Apply normalization
      return normalizeInventoryItem(this.formatInventoryItem(product.inventory));
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryByProduct');
    }
  }

  async getInventoryByProductLegacy(productId: string, businessUnitId: string) {
    return this.getInventoryByProduct(productId, businessUnitId);
  }

  async getInventoryItemById(id: string, businessUnitId?: string) {
    try {
      if (!id) {
        throw new AppError('Inventory ID is required', 400);
      }

      let item = await this.prisma.inventory.findUnique({
        where: { id },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              creator: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          variant: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { user: { select: { id: true, firstName: true, lastName: true } } },
          },
          issues: { where: { status: 'ISSUED' }, orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      if (!item && businessUnitId) {
        const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
        item = await this.prisma.inventory.findFirst({
          where: { id, businessUnitId: resolvedBU.id },
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                creator: { select: { id: true, firstName: true, lastName: true } },
              },
            },
            variant: true,
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 50,
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
            issues: { where: { status: 'ISSUED' }, orderBy: { createdAt: 'desc' }, take: 10 },
          },
        });
      }

      if (!item) {
        throw new AppError('Inventory item not found', 404);
      }

      // ✅ Apply normalization
      return normalizeInventoryItem(this.formatInventoryItem(item));
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryItemById');
    }
  }

  async getInventoryItem(id: string) {
    try {
      const inventory = await this.prisma.inventory.findUnique({
        where: { id },
        include: {
          product: {
            include: {
              category: { select: { id: true, name: true } },
              supplier: { select: { id: true, name: true } },
              variants: {
                where: { isActive: true },
              },
            },
          },
          variant: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!inventory) {
        throw new AppError('Inventory item not found', 404);
      }

      // ✅ Apply normalization
      return normalizeInventoryItem(this.formatInventoryItem(inventory));
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryItem');
    }
  }

  async getLowStockItems(businessUnitId: string) {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id, quantity: { lte: 10, gt: 0 } },
        include: {
          product: { select: { id: true, name: true, sku: true, unitPrice: true, category: { select: { name: true } } } },
          variant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { quantity: 'asc' },
      });

      // ✅ Apply normalization
      return normalizeInventoryItems(items);
    } catch (error) {
      this.handleError(error, 'InventoryService.getLowStockItems');
    }
  }

  async getOutOfStockItems(businessUnitId: string) {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id, quantity: 0 },
        include: {
          product: { select: { id: true, name: true, sku: true, unitPrice: true } },
          variant: { select: { id: true, name: true, sku: true } },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // ✅ Apply normalization
      return normalizeInventoryItems(items);
    } catch (error) {
      this.handleError(error, 'InventoryService.getOutOfStockItems');
    }
  }

  async getInventoryValue(businessUnitId: string) {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id },
        include: { product: { select: { costPrice: true, unitPrice: true } } },
      });

      const totalCost = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.product?.costPrice || 0)), 0);
      const totalValue = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.product?.unitPrice || 0)), 0);

      return {
        totalCost,
        totalValue,
        profitMargin: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        itemCount: items.length,
        totalUnits: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      };
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryValue');
    }
  }

  async getInventoryTransactions(params: {
    page?: number;
    limit?: number;
    productId?: string;
    businessUnitId?: string;
    transactionType?: string;
    startDate?: Date;
    endDate?: Date;
    variantId?: string;
  }) {
    try {
      const { page = 1, limit = 20, productId, businessUnitId, transactionType, startDate, endDate, variantId } = params;

      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(100, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = { businessUnitId: resolvedBU.id };
      if (productId) where.productId = productId;
      if (variantId) where.variantId = variantId;
      if (transactionType) where.transactionType = transactionType;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      const [transactions, total] = await Promise.all([
        this.prisma.inventoryTransaction.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy: { createdAt: 'desc' },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true } },
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        this.prisma.inventoryTransaction.count({ where }),
      ]);

      const totalIn = transactions.filter((t: any) => t.quantity > 0).reduce((sum: number, t: any) => sum + t.quantity, 0);
      const totalOut = transactions.filter((t: any) => t.quantity < 0).reduce((sum: number, t: any) => sum + Math.abs(t.quantity), 0);

      return { 
        transactions, 
        total, 
        page: validatedPage, 
        limit: validatedLimit, 
        totalPages: Math.ceil(total / validatedLimit), 
        summary: { totalIn, totalOut, netChange: totalIn - totalOut } 
      };
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryTransactions');
    }
  }

  async getInventoryByLocation(location: string, businessUnitId: string) {
    try {
      if (!location || !businessUnitId) throw new AppError('Location and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id, location: { contains: location, mode: 'insensitive' } },
        include: {
          product: { select: { id: true, name: true, sku: true, unitPrice: true, category: { select: { name: true } } } },
        },
      });

      // ✅ Apply normalization
      return normalizeInventoryItems(items);
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryByLocation');
    }
  }

  async getInventoryByCategory(category: string, businessUnitId: string) {
    try {
      if (!category || !businessUnitId) throw new AppError('Category and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: {
          businessUnitId: resolvedBU.id,
          product: { is: { category: { is: { name: { contains: category, mode: 'insensitive' } } } } },
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unitPrice: true, category: { select: { name: true } } } },
        },
      });

      // ✅ Apply normalization
      return normalizeInventoryItems(items);
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryByCategory');
    }
  }

  async searchProducts(params: {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    status?: string;
    businessUnitId: string;
  }) {
    try {
      const { query, category, minPrice, maxPrice, status, businessUnitId } = params;

      if (!query || !businessUnitId) throw new AppError('Query and business unit ID are required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const where: any = {
        businessUnitId: resolvedBU.id,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (category) where.category = { is: { name: { contains: category, mode: 'insensitive' } } };
      if (minPrice !== undefined || maxPrice !== undefined) {
        where.unitPrice = {};
        if (minPrice !== undefined) where.unitPrice.gte = minPrice;
        if (maxPrice !== undefined) where.unitPrice.lte = maxPrice;
      }

      const products = await this.prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          inventory: { where: { businessUnitId: resolvedBU.id }, select: { id: true, quantity: true, reserved: true, reorderPoint: true, location: true } },
          variants: { where: { isActive: true } },
        },
        orderBy: { name: 'asc' },
        take: 50,
      });

      // ✅ Apply normalization to inventory items
      return products.map((product: any) => ({
        ...product,
        inventory: product.inventory ? normalizeInventoryItem(product.inventory[0]) : null,
      }));
    } catch (error) {
      this.handleError(error, 'InventoryService.searchProducts');
    }
  }

  async getTotalItems(businessUnitId: string) {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);
      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      return await this.prisma.inventory.count({ where: { businessUnitId: resolvedBU.id } });
    } catch (error) {
      this.handleError(error, 'InventoryService.getTotalItems');
    }
  }

  async getStockMovements(params: {
    productId?: string;
    variantId?: string;
    businessUnitId: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    try {
      const { productId, variantId, businessUnitId, startDate, endDate, limit = 100 } = params;

      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const where: any = { businessUnitId: resolvedBU.id };
      if (productId) where.productId = productId;
      if (variantId) where.variantId = variantId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = startDate;
        if (endDate) where.createdAt.lte = endDate;
      }

      return await this.prisma.inventoryTransaction.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, sku: true } },
          user: { select: { firstName: true, lastName: true } },
        },
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.getStockMovements');
    }
  }

  async getInventoryStats(businessUnitId: string) {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const [totalItems, lowStockItems, outOfStockItems, totalValue, categories, stats] = await Promise.all([
        this.getTotalItems(resolvedBU.id),
        this.getLowStockItems(resolvedBU.id),
        this.getOutOfStockItems(resolvedBU.id),
        this.getInventoryValue(resolvedBU.id),
        this.getCategorySummary(resolvedBU.id),
        this.calculateInventoryStats(resolvedBU.id),
      ]);

      return {
        ...stats,
        totalItems,
        lowStockItems: lowStockItems.length,
        outOfStockItems: outOfStockItems.length,
        totalValue: totalValue.totalValue,
        totalCost: totalValue.totalCost,
        profitMargin: totalValue.profitMargin,
        categories,
        timestamp: new Date(),
      };
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryStats');
    }
  }

  async getInventoryReport(businessUnitId: string, params?: {
    includeInactive?: boolean;
    categoryId?: string;
    location?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<InventoryReport> {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const where: any = { businessUnitId: resolvedBU.id };

      if (params?.location) {
        where.location = params.location;
      }

      const [items, transactions] = await Promise.all([
        this.prisma.inventory.findMany({
          where,
          include: { product: { include: { category: true, supplier: true } } },
        }),
        this.prisma.inventoryTransaction.findMany({
          where: {
            businessUnitId: resolvedBU.id,
            ...(params?.dateRange && { createdAt: { gte: params.dateRange.start, lte: params.dateRange.end } }),
          },
          include: { product: { select: { id: true, name: true } } },
        }),
      ]);

      const totalValue = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.product?.unitPrice || 0)), 0);
      const totalCost = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.product?.costPrice || 0)), 0);
      const lowStock = items.filter((i: any) => i.quantity <= (i.reorderPoint || 5) && i.quantity > 0).length;
      const outOfStock = items.filter((i: any) => i.quantity === 0).length;

      const categoryMap = new Map<string, { count: number; value: number }>();
      items.forEach((item: any) => {
        const name = item.product?.category?.name || 'Uncategorized';
        const current = categoryMap.get(name) || { count: 0, value: 0 };
        current.count += item.quantity;
        current.value += item.quantity * (item.product?.unitPrice || 0);
        categoryMap.set(name, current);
      });

      const locationMap = new Map<string, { count: number; value: number }>();
      items.forEach((item: any) => {
        const location = item.location || 'Warehouse';
        const current = locationMap.get(location) || { count: 0, value: 0 };
        current.count += item.quantity;
        current.value += item.quantity * (item.product?.unitPrice || 0);
        locationMap.set(location, current);
      });

      const movementMap = new Map<string, { productId: string; name: string; movements: number }>();
      transactions.forEach((tx: any) => {
        const productId = tx.productId;
        const current = movementMap.get(productId) || { 
          productId: productId, 
          name: tx.product?.name || 'Unknown', 
          movements: 0 
        };
        current.movements += Math.abs(tx.quantity);
        movementMap.set(productId, current);
      });

      const topMovers = Array.from(movementMap.values()).sort((a, b) => b.movements - a.movements).slice(0, 10);

      return {
        totalItems: items.length,
        totalValue,
        totalCost,
        potentialProfit: totalValue - totalCost,
        lowStockItems: lowStock,
        outOfStockItems: outOfStock,
        byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({ category, ...data })),
        byLocation: Array.from(locationMap.entries()).map(([location, data]) => ({ location, ...data })),
        topMovers,
      };
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryReport');
    }
  }

  // ============================================
  // CREATE ENDPOINTS
  // ============================================

  async createItem(data: CreateItemData): Promise<{ product: any; inventory: any }> {
    try {
      console.log('📦 Service: Creating item with data:', data);
      
      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);
      const businessUnitId = resolvedBU.id;
      console.log('✅ Using business unit:', businessUnitId, resolvedBU.name);

      const sku = data.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      let categoryId = data.categoryId;
      if (data.category && !categoryId) {
        const existingCategory = await this.prisma.category.findFirst({
          where: {
            name: { equals: data.category, mode: 'insensitive' },
            businessUnitId: businessUnitId,
          },
        });
        
        if (existingCategory) {
          categoryId = existingCategory.id;
        } else {
          const newCategory = await this.prisma.category.create({
            data: {
              name: data.category,
              businessUnitId: businessUnitId,
              isActive: true,
            },
          });
          categoryId = newCategory.id;
        }
      }

      let supplierId = data.supplierId;
      if (data.supplier && !supplierId) {
        const existingSupplier = await this.prisma.supplier.findFirst({
          where: {
            name: { equals: data.supplier, mode: 'insensitive' },
          },
        });
        
        if (existingSupplier) {
          supplierId = existingSupplier.id;
        } else {
          const company = await this.prisma.company.findFirst();
          if (company) {
            const newSupplier = await this.prisma.supplier.create({
              data: {
                name: data.supplier,
                email: `${data.supplier.toLowerCase().replace(/\s+/g, '.')}@supplier.com`,
                phone: '+0000000000',
                companyId: company.id,
                isActive: true,
              },
            });
            supplierId = newSupplier.id;
          }
        }
      }

      return await this.prisma.$transaction(async (tx: any) => {
        // 1. Create the product
        const product = await tx.product.create({
          data: {
            name: data.name,
            sku: sku.toUpperCase(),
            description: data.description || '',
            unitPrice: data.unitPrice || 0,
            costPrice: data.unitPrice || 0,
            minStock: data.minStock || 5,
            maxStock: data.maxStock || 100,
            barcode: data.barcode || null,
            taxRate: data.taxRate || null,
            weight: data.weight || null,
            tags: data.tags || [],
            images: data.images || [],
            categoryId: categoryId || null,
            supplierId: supplierId || null,
            businessUnitId: businessUnitId,
            createdBy: data.userId,
            updatedBy: data.userId,
            isActive: data.isActive !== undefined ? data.isActive : true,
            isDigital: data.isDigital || false,
            featured: data.featured || false,
            rating: 0,
            reviewCount: 0,
            inventoryId: null,
          },
          include: {
            category: { select: { id: true, name: true } },
            supplier: { select: { id: true, name: true } },
          },
        });

        // 2. Create the inventory linked to the product
        const inventory = await tx.inventory.create({
          data: {
            businessUnitId: businessUnitId,
            quantity: data.quantity || 0,
            reserved: 0,
            available: data.quantity || 0,
            reorderPoint: data.minStock || 5,
            reorderQuantity: data.maxStock || 100,
            location: data.location || 'Warehouse',
            supplier: data.supplier || null,
            notes: data.notes || null,
            status: 'ACTIVE',
          },
        });

        // 3. Update product with inventoryId
        const updatedProduct = await tx.product.update({
          where: { id: product.id },
          data: { inventoryId: inventory.id },
          include: {
            category: true,
            supplier: true,
          },
        });

        // 4. Create initial inventory transaction
        if (data.quantity && data.quantity > 0) {
          await tx.inventoryTransaction.create({
            data: {
              transactionType: 'INITIAL',
              quantity: data.quantity,
              notes: 'Initial stock entry',
              productId: product.id,
              inventoryId: inventory.id,
              businessUnitId: businessUnitId,
              userId: data.userId,
            },
          });
        }

        console.log('✅ Service: Item created successfully:', { productId: product.id, inventoryId: inventory.id });

        // ✅ Return normalized item
        const result = {
          id: inventory.id,
          productId: product.id,
          product: updatedProduct,
          inventory: inventory,
          name: product.name,
          sku: product.sku,
          quantity: inventory.quantity,
          unitPrice: product.unitPrice,
          costPrice: product.costPrice || 0,
          stock: inventory.quantity,
          available: inventory.quantity,
          reserved: 0,
          reorderPoint: inventory.reorderPoint,
          reorderQuantity: inventory.reorderQuantity,
          location: inventory.location,
          supplier: inventory.supplier,
          notes: inventory.notes,
          status: inventory.status,
          category: updatedProduct.category?.name || null,
          categoryId: updatedProduct.categoryId || null,
          supplierId: updatedProduct.supplierId || null,
          description: updatedProduct.description,
          barcode: updatedProduct.barcode,
          images: updatedProduct.images || [],
          tags: updatedProduct.tags || [],
          weight: updatedProduct.weight || 0,
          taxRate: updatedProduct.taxRate || 0,
          isActive: updatedProduct.isActive,
          isDigital: updatedProduct.isDigital,
          featured: updatedProduct.featured,
          createdAt: inventory.createdAt,
          updatedAt: inventory.updatedAt,
          businessUnitId: inventory.businessUnitId,
        };

        return normalizeInventoryItem(result);
      });
    } catch (error: any) {
      console.error('❌ Error in createItem service:', error);
      console.error('❌ Error details:', {
        message: error?.message || 'Unknown error',
        code: error?.code || null,
        meta: error?.meta || null,
      });
      throw error;
    }
  }

  async createInventory(data: {
    name: string;
    sku?: string;
    description?: string;
    categoryId?: string;
    category?: string;
    supplierId?: string;
    supplier?: string;
    quantity?: number;
    minStock?: number;
    maxStock?: number;
    unitPrice?: number;
    costPrice?: number;
    location?: string;
    barcode?: string;
    notes?: string;
    businessUnitId: string;
    userId: string;
    weight?: number;
    taxRate?: number;
    tags?: string[];
    images?: string[];
    isActive?: boolean;
    isDigital?: boolean;
    featured?: boolean;
  }) {
    try {
      console.log('📦 Creating inventory item:', data);
      
      const result = await this.createItem({
        name: data.name,
        sku: data.sku,
        category: data.category || '',
        categoryId: data.categoryId,
        quantity: data.quantity || 0,
        unit: 'each',
        minStock: data.minStock,
        maxStock: data.maxStock,
        location: data.location,
        supplier: data.supplier,
        supplierId: data.supplierId,
        unitPrice: data.unitPrice,
        notes: data.notes,
        businessUnitId: data.businessUnitId,
        userId: data.userId,
        description: data.description,
        barcode: data.barcode,
        weight: data.weight,
        taxRate: data.taxRate,
        tags: data.tags,
        images: data.images,
        isActive: data.isActive,
        isDigital: data.isDigital,
        featured: data.featured,
      });
      
      return result;
    } catch (error) {
      this.handleError(error, 'InventoryService.createInventory');
    }
  }

  async createProductWithInventory(data: CreateProductData) {
    try {
      if (!data.name || !data.sku || !data.businessUnitId || !data.userId) {
        throw new AppError('Name, SKU, business unit ID, and user ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx: any) => {
        const existingProduct = await tx.product.findFirst({
          where: { sku: data.sku.toUpperCase(), businessUnitId: resolvedBU.id },
        });

        if (existingProduct) {
          throw new AppError('Product with this SKU already exists', 400);
        }

        const inventory = await tx.inventory.create({
          data: {
            businessUnitId: resolvedBU.id,
            quantity: data.stock || 0,
            reserved: 0,
            available: data.stock || 0,
            reorderPoint: data.reorderPoint || 5,
            reorderQuantity: Math.max(data.reorderPoint || 5, 10),
            location: data.location || 'Warehouse',
            supplier: data.supplier || null,
            status: 'ACTIVE',
          },
        });

        const product = await tx.product.create({
          data: {
            name: data.name,
            sku: data.sku.toUpperCase(),
            unitPrice: data.price || data.unitPrice || 0,
            costPrice: data.costPrice || 0,
            barcode: data.barcode || await this.generateUniqueBarcode(tx),
            description: data.description,
            images: data.images || [],
            businessUnitId: resolvedBU.id,
            createdBy: data.userId,
            isActive: true,
            categoryId: data.categoryId,
            supplierId: data.supplierId,
            inventoryId: inventory.id,
            minStock: data.reorderPoint || 5,
            maxStock: Math.max(data.reorderPoint || 5, 10),
          },
          include: {
            inventory: true,
            category: true,
            supplier: true,
          },
        });

        if (data.stock > 0) {
          await tx.inventoryTransaction.create({
            data: {
              transactionType: 'INITIAL' as any,
              quantity: data.stock,
              notes: `Initial stock setup: ${data.stock} units`,
              productId: product.id,
              inventoryId: inventory.id,
              businessUnitId: resolvedBU.id,
              userId: data.userId,
            },
          });
        }

        this.safeEmitInventoryUpdate({ productId: product.id, quantity: data.stock || 0 }, resolvedBU.id);

        // ✅ Return normalized item
        const result = { 
          product, 
          inventory: { ...inventory, product },
          formattedItem: normalizeInventoryItem(this.formatInventoryItem({ ...inventory, product })),
        };
        
        return result;
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.createProductWithInventory');
    }
  }

  // ============================================
  // UPDATE ENDPOINTS
  // ============================================

  async updateItem(id: string, data: any) {
    try {
      if (!id || !data.businessUnitId) {
        throw new AppError('Inventory ID and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx: any) => {
        const inventoryItem = await tx.inventory.findFirst({
          where: { id, businessUnitId: resolvedBU.id },
          include: { product: true },
        });

        if (!inventoryItem) throw new AppError('Inventory item not found', 404);

        const productUpdateData: any = {};
        if (data.name !== undefined) productUpdateData.name = data.name;
        if (data.unitPrice !== undefined) { 
          productUpdateData.unitPrice = data.unitPrice; 
          productUpdateData.costPrice = data.unitPrice; 
        }
        if (data.description !== undefined) productUpdateData.description = data.description;
        if (data.notes !== undefined) productUpdateData.notes = data.notes;
        if (data.barcode !== undefined) productUpdateData.barcode = data.barcode;

        let product = inventoryItem.product;
        if (Object.keys(productUpdateData).length > 0 && product) {
          product = await tx.product.update({ 
            where: { id: product.id }, 
            data: productUpdateData 
          });
        }

        const inventoryUpdateData: any = {};
        if (data.location !== undefined) inventoryUpdateData.location = data.location;
        if (data.minStock !== undefined) inventoryUpdateData.reorderPoint = data.minStock;
        if (data.supplier !== undefined) inventoryUpdateData.supplier = data.supplier;
        if (data.notes !== undefined) inventoryUpdateData.notes = data.notes;

        let inventory: any = inventoryItem;
        if (Object.keys(inventoryUpdateData).length > 0) {
          inventory = await tx.inventory.update({ 
            where: { id }, 
            data: inventoryUpdateData 
          });
        }

        if (data.quantity !== undefined && data.quantity !== inventoryItem.quantity) {
          await this.updateStock({
            productId: product?.id || inventoryItem.product?.id || '',
            quantity: Math.abs(data.quantity - inventoryItem.quantity),
            transactionType: data.quantity > inventoryItem.quantity ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            userId: 'system',
            businessUnitId: resolvedBU.id,
            notes: `Quantity adjusted from ${inventoryItem.quantity} to ${data.quantity}`,
            inventoryId: id,
          });
          const refreshedInventory = await tx.inventory.findUnique({ where: { id } });
          if (refreshedInventory) {
            inventory = refreshedInventory;
          }
        }

        const inventoryWithProduct = { ...inventory, product };

        // ✅ Return normalized item
        const result = { 
          product, 
          inventory: inventoryWithProduct,
          formattedItem: normalizeInventoryItem(this.formatInventoryItem(inventoryWithProduct)),
        };
        
        return result;
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.updateItem');
    }
  }

  async updateProduct(id: string, data: UpdateProductData) {
    try {
      if (!id || !data.businessUnitId) {
        throw new AppError('Inventory ID and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx: any) => {
        const inventoryItem = await tx.inventory.findFirst({
          where: { id, businessUnitId: resolvedBU.id },
          include: { product: true },
        });

        if (!inventoryItem) throw new AppError('Inventory item not found', 404);

        const productUpdateData: any = {};
        if (data.name !== undefined) productUpdateData.name = data.name;
        if (data.sku !== undefined) productUpdateData.sku = data.sku.toUpperCase();
        if (data.price !== undefined || data.unitPrice !== undefined) productUpdateData.unitPrice = data.price || data.unitPrice;
        if (data.costPrice !== undefined) productUpdateData.costPrice = data.costPrice;
        if (data.description !== undefined) productUpdateData.description = data.description;
        if (data.images !== undefined) productUpdateData.images = data.images;

        let product = inventoryItem.product;
        if (Object.keys(productUpdateData).length > 0 && product) {
          product = await tx.product.update({ 
            where: { id: product.id }, 
            data: productUpdateData 
          });
        }

        const inventoryUpdateData: any = {};
        if (data.location !== undefined) inventoryUpdateData.location = data.location;
        if (data.status !== undefined) inventoryUpdateData.status = data.status;

        let inventory: any = inventoryItem;
        if (Object.keys(inventoryUpdateData).length > 0) {
          inventory = await tx.inventory.update({ where: { id }, data: inventoryUpdateData });
        }

        // ✅ Return normalized item
        const result = { 
          product, 
          inventory: { ...inventory, product },
          formattedItem: normalizeInventoryItem(this.formatInventoryItem({ ...inventory, product })),
        };
        
        return result;
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.updateProduct');
    }
  }

  async updateInventory(id: string, data: {
    name?: string;
    sku?: string;
    description?: string;
    categoryId?: string;
    supplierId?: string;
    quantity?: number;
    minStock?: number;
    maxStock?: number;
    unitPrice?: number;
    costPrice?: number;
    location?: string;
    barcode?: string;
    notes?: string;
    isActive?: boolean;
  }) {
    try {
      console.log('📦 Updating inventory item:', id, data);

      const inventory = await this.prisma.inventory.findUnique({
        where: { id },
        include: { product: true },
      });

      if (!inventory) {
        throw new AppError('Inventory item not found', 404);
      }

      if (!inventory.product) {
        throw new AppError('Associated product not found for this inventory item', 404);
      }

      const productData: any = {};
      if (data.name !== undefined) productData.name = data.name;
      if (data.sku !== undefined) productData.sku = data.sku.toUpperCase();
      if (data.description !== undefined) productData.description = data.description;
      if (data.unitPrice !== undefined) productData.unitPrice = data.unitPrice;
      if (data.costPrice !== undefined) productData.costPrice = data.costPrice;
      if (data.minStock !== undefined) productData.minStock = data.minStock;
      if (data.maxStock !== undefined) productData.maxStock = data.maxStock;
      if (data.barcode !== undefined) productData.barcode = data.barcode;
      if (data.categoryId !== undefined) productData.categoryId = data.categoryId;
      if (data.supplierId !== undefined) productData.supplierId = data.supplierId;
      if (data.isActive !== undefined) productData.isActive = data.isActive;

      const updatedProduct = await this.prisma.product.update({
        where: { id: inventory.product.id },
        data: productData,
      });

      const inventoryData: any = {};
      if (data.quantity !== undefined) inventoryData.quantity = data.quantity;
      if (data.minStock !== undefined) inventoryData.reorderPoint = data.minStock;
      if (data.maxStock !== undefined) inventoryData.reorderQuantity = data.maxStock;
      if (data.location !== undefined) inventoryData.location = data.location;
      if (data.notes !== undefined) inventoryData.notes = data.notes;

      const updatedInventory = await this.prisma.inventory.update({
        where: { id },
        data: inventoryData,
        include: {
          product: true,
        },
      });

      // ✅ Return normalized item
      const result = {
        product: updatedProduct,
        inventory: updatedInventory,
        formattedItem: normalizeInventoryItem(this.formatInventoryItem(updatedInventory)),
      };
      
      return result;
    } catch (error) {
      this.handleError(error, 'InventoryService.updateInventory');
    }
  }

  // ============================================
  // DELETE ENDPOINTS
  // ============================================

  async deleteProduct(id: string, businessUnitId: string, userId: string) {
    try {
      if (!id || !businessUnitId || !userId) {
        throw new AppError('Inventory ID, business unit ID, and user ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      return await this.prisma.$transaction(async (tx: any) => {
        const inventoryItem = await tx.inventory.findFirst({
          where: { id, businessUnitId: resolvedBU.id },
          include: {
            product: {
              include: { _count: { select: { saleItems: true, orderItems: true } } },
            },
          },
        });

        if (!inventoryItem) throw new AppError('Inventory item not found', 404);

        const product = inventoryItem.product;
        const hasSales = product?._count?.saleItems > 0 || false;
        const hasOrders = product?._count?.orderItems > 0 || false;

        if (hasSales || hasOrders) {
          if (product) {
            await tx.product.update({ 
              where: { id: product.id }, 
              data: { isActive: false, deletedAt: new Date(), deletedBy: userId } 
            });
          }
          await tx.inventory.update({ where: { id }, data: { status: 'INACTIVE' } });
          return { message: 'Product marked as inactive due to existing sales or orders', softDeleted: true };
        }

        await tx.inventoryTransaction.deleteMany({ where: { inventoryId: id } });
        await tx.inventoryIssue.deleteMany({ where: { inventoryId: id } });
        
        await tx.inventory.delete({ where: { id } });
        
        if (product) {
          await tx.product.delete({ where: { id: product.id } });
        }

        return { message: 'Product deleted successfully', softDeleted: false };
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.deleteProduct');
    }
  }

  // ============================================
  // STOCK OPERATIONS
  // ============================================

  async updateStock(data: UpdateStockData) {
    try {
      const { productId, quantity, transactionType, userId, businessUnitId, notes, reference, variantId, inventoryId } = data;

      if (!productId || !businessUnitId || !userId) {
        throw new AppError('Product ID, business unit ID, and user ID are required', 400);
      }

      if (quantity <= 0) {
        throw new AppError('Quantity must be positive', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      let inventory = await this.prisma.inventory.findFirst({
        where: {
          businessUnitId: resolvedBU.id,
          product: { id: productId },
        },
      });

      if (!inventory) {
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new AppError('Product not found', 404);

        inventory = await this.prisma.inventory.create({
          data: {
            businessUnitId: resolvedBU.id,
            quantity: 0,
            reserved: 0,
            available: 0,
            reorderPoint: product.minStock || 5,
            reorderQuantity: 10,
            location: 'Warehouse',
            status: 'ACTIVE',
          },
        });

        await this.prisma.product.update({
          where: { id: productId },
          data: { inventoryId: inventory.id },
        });
      }

      const decreasingTypes = ['SALE', 'ISSUE', 'ADJUSTMENT_OUT', 'TRANSFER_OUT'];
      const increasingTypes = ['PURCHASE', 'RESTOCK', 'RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'INITIAL'];

      const isDecrease = decreasingTypes.includes(transactionType);
      const isIncrease = increasingTypes.includes(transactionType);

      let newQuantity: number;
      if (isDecrease) {
        const availableStock = inventory.available !== undefined && inventory.available !== null
          ? inventory.available
          : inventory.quantity - inventory.reserved;
        if (availableStock < quantity) throw new AppError(`Insufficient stock. Available: ${availableStock}`, 400);
        newQuantity = inventory.quantity - quantity;
      } else if (isIncrease) {
        newQuantity = inventory.quantity + quantity;
      } else {
        newQuantity = quantity;
      }

      if (newQuantity < 0) throw new AppError('Insufficient stock', 400);

      const newAvailable = Math.max(0, newQuantity - (inventory.reserved || 0));

      const updatedInventory = await this.prisma.inventory.update({
        where: { id: inventory.id },
        data: { 
          quantity: newQuantity,
          available: newAvailable,
        },
      });

      await this.prisma.inventoryTransaction.create({
        data: {
          transactionType: transactionType as any,
          quantity: isDecrease ? -quantity : quantity,
          notes: notes || null,
          reference: reference || null,
          productId: productId,
          variantId: variantId || null,
          inventoryId: inventory.id,
          businessUnitId: resolvedBU.id,
          userId,
        },
      });

      if (newQuantity <= (updatedInventory.reorderPoint || 5)) {
        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        await this.prisma.notification.create({
          data: {
            title: 'Low Stock Alert',
            message: `Product ${product?.name || productId} is below reorder point. Current stock: ${newQuantity}`,
            type: 'WARNING',
            userId,
            businessUnitId: resolvedBU.id,
            isRead: false,
          },
        });
      }

      // ✅ Return normalized item
      return normalizeInventoryItem(updatedInventory);
    } catch (error) {
      this.handleError(error, 'InventoryService.updateStock');
    }
  }

  async reserveStock(productId: string, quantity: number, businessUnitId: string, variantId?: string) {
    try {
      if (!productId || !businessUnitId) throw new AppError('Product ID and business unit ID are required', 400);
      if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: {
          businessUnitId: resolvedBU.id,
          product: { id: productId },
        },
      });

      if (!inventory) throw new AppError('Product not found in inventory', 404);

      const availableStock = inventory.available !== undefined && inventory.available !== null
        ? inventory.available
        : inventory.quantity - inventory.reserved;
      if (availableStock < quantity) throw new AppError('Insufficient available stock', 400);

      const newReserved = (inventory.reserved || 0) + quantity;
      const newAvailable = Math.max(0, inventory.quantity - newReserved);

      const result = await this.prisma.inventory.update({
        where: { id: inventory.id },
        data: { 
          reserved: newReserved,
          available: newAvailable,
        },
      });

      // ✅ Return normalized item
      return normalizeInventoryItem(result);
    } catch (error) {
      this.handleError(error, 'InventoryService.reserveStock');
    }
  }

  async releaseReservedStock(productId: string, quantity: number, businessUnitId: string, variantId?: string) {
    try {
      if (!productId || !businessUnitId) throw new AppError('Product ID and business unit ID are required', 400);
      if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: {
          businessUnitId: resolvedBU.id,
          product: { id: productId },
        },
      });

      if (!inventory) throw new AppError('Product not found in inventory', 404);
      if ((inventory.reserved || 0) < quantity) throw new AppError('Cannot release more reserved stock than reserved', 400);

      const newReserved = (inventory.reserved || 0) - quantity;
      const newAvailable = Math.max(0, inventory.quantity - newReserved);

      const result = await this.prisma.inventory.update({
        where: { id: inventory.id },
        data: { 
          reserved: newReserved,
          available: newAvailable,
        },
      });

      // ✅ Return normalized item
      return normalizeInventoryItem(result);
    } catch (error) {
      this.handleError(error, 'InventoryService.releaseReservedStock');
    }
  }

  async transferStock(data: TransferStockData) {
    try {
      const { productId, fromLocation, toLocation, quantity, notes, businessUnitId, userId, variantId } = data;

      if (!productId || !fromLocation || !toLocation || !businessUnitId || !userId) {
        throw new AppError('Product ID, locations, business unit ID, and user ID are required', 400);
      }

      if (quantity <= 0) throw new AppError('Quantity must be positive', 400);
      if (fromLocation === toLocation) throw new AppError('Source and destination locations must be different', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      return await this.prisma.$transaction(async (tx: any) => {
        const sourceInventory = await tx.inventory.findFirst({
          where: { 
            businessUnitId: resolvedBU.id,
            product: { id: productId },
            location: fromLocation,
          },
        });

        if (!sourceInventory) throw new AppError(`Product not found in source location: ${fromLocation}`, 404);

        const availableStock = sourceInventory.available !== undefined && sourceInventory.available !== null
          ? sourceInventory.available
          : sourceInventory.quantity - sourceInventory.reserved;
        if (availableStock < quantity) throw new AppError(`Insufficient stock in ${fromLocation}. Available: ${availableStock}`, 400);

        let destInventory = await tx.inventory.findFirst({
          where: { 
            businessUnitId: resolvedBU.id,
            product: { id: productId },
            location: toLocation,
          },
        });

        if (!destInventory) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new AppError('Product not found', 404);

          destInventory = await tx.inventory.create({
            data: {
              businessUnitId: resolvedBU.id,
              location: toLocation,
              quantity: 0,
              reserved: 0,
              available: 0,
              reorderPoint: product.minStock || 5,
              reorderQuantity: 10,
              status: 'ACTIVE',
            },
          });
        }

        const transferReference = `TRANSFER_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const newSourceQuantity = sourceInventory.quantity - quantity;
        const newSourceAvailable = Math.max(0, newSourceQuantity - (sourceInventory.reserved || 0));
        await tx.inventory.update({ 
          where: { id: sourceInventory.id }, 
          data: { 
            quantity: newSourceQuantity,
            available: newSourceAvailable,
          } 
        });

        const newDestQuantity = destInventory.quantity + quantity;
        const newDestAvailable = Math.max(0, newDestQuantity - (destInventory.reserved || 0));
        await tx.inventory.update({ 
          where: { id: destInventory.id }, 
          data: { 
            quantity: newDestQuantity,
            available: newDestAvailable,
          } 
        });

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'TRANSFER_OUT' as any,
            quantity: -quantity,
            notes: notes || `Transfer from ${fromLocation} to ${toLocation}`,
            reference: transferReference,
            productId,
            variantId: variantId || null,
            inventoryId: sourceInventory.id,
            businessUnitId: resolvedBU.id,
            userId,
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'TRANSFER_IN' as any,
            quantity: quantity,
            notes: notes || `Transfer from ${fromLocation} to ${toLocation}`,
            reference: transferReference,
            productId,
            variantId: variantId || null,
            inventoryId: destInventory.id,
            businessUnitId: resolvedBU.id,
            userId,
          },
        });

        return { transferred: quantity, fromLocation, toLocation, reference: transferReference };
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.transferStock');
    }
  }

  // ============================================
  // ISSUE / RETURN / RESTOCK OPERATIONS
  // ============================================

  async issueItem(data: IssueItemData) {
    try {
      if (!data.inventoryId || !data.issuedTo || !data.businessUnitId || !data.userId) {
        throw new AppError('Inventory ID, issuedTo, business unit ID, and user ID are required', 400);
      }

      if (data.quantity <= 0) {
        throw new AppError('Quantity must be positive', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx: any) => {
        const inventory = await tx.inventory.findFirst({
          where: { id: data.inventoryId, businessUnitId: resolvedBU.id },
        });

        if (!inventory) throw new AppError('Inventory item not found', 404);

        const availableStock = inventory.available !== undefined && inventory.available !== null
          ? inventory.available
          : inventory.quantity - inventory.reserved;
        if (availableStock < data.quantity) {
          throw new AppError(`Insufficient stock. Available: ${availableStock}`, 400);
        }

        const newQuantity = inventory.quantity - data.quantity;
        const newAvailable = Math.max(0, newQuantity - (inventory.reserved || 0));

        const updatedInventory = await tx.inventory.update({
          where: { id: data.inventoryId },
          data: { 
            quantity: newQuantity,
            available: newAvailable,
          },
        });

        const product = await tx.product.findFirst({
          where: { inventoryId: data.inventoryId },
          select: { id: true },
        });

        const productId = product?.id || '';

        const issue = await tx.inventoryIssue.create({
          data: {
            inventoryId: data.inventoryId,
            productId: productId,
            issuedTo: data.issuedTo,
            quantity: data.quantity,
            purpose: data.purpose || null,
            remarks: data.remarks || null,
            expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
            businessUnitId: resolvedBU.id,
            userId: data.userId,
            status: 'ISSUED',
          },
        });

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'ISSUE' as any,
            quantity: -data.quantity,
            notes: `Issued to ${data.issuedTo}: ${data.purpose || 'No purpose specified'}`,
            productId: productId,
            inventoryId: inventory.id,
            businessUnitId: resolvedBU.id,
            userId: data.userId,
            reference: `ISSUE_${issue.id}`,
          },
        });

        if (newQuantity <= (updatedInventory.reorderPoint || 5)) {
          const productName = await tx.product.findUnique({ where: { id: productId }, select: { name: true } });
          await tx.notification.create({
            data: {
              title: 'Low Stock Alert',
              message: `Product ${productName?.name || inventory.id} is below reorder point. Current stock: ${newQuantity}`,
              type: 'WARNING',
              userId: data.userId,
              businessUnitId: resolvedBU.id,
              isRead: false,
            },
          });
          this.safeEmitLowStockAlert({ productId: productId, quantity: newQuantity }, resolvedBU.id);
        }

        this.safeEmitInventoryUpdate({ productId: productId, quantity: newQuantity }, resolvedBU.id);

        // ✅ Return normalized item
        const result = { 
          issue, 
          inventory: normalizeInventoryItem(updatedInventory),
        };
        
        return result;
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.issueItem');
    }
  }

  async returnItem(data: ReturnItemData) {
    try {
      if (!data.inventoryId || !data.businessUnitId || !data.userId) {
        throw new AppError('Inventory ID, business unit ID, and user ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx: any) => {
        const issue = await tx.inventoryIssue.findFirst({
          where: { inventoryId: data.inventoryId, status: 'ISSUED' },
          orderBy: { createdAt: 'desc' },
        });

        if (!issue) throw new AppError('No active issue record found for this item', 404);

        const quantityToReturn = data.quantity || issue.quantity;

        if (quantityToReturn <= 0) {
          throw new AppError('Return quantity must be positive', 400);
        }

        if (quantityToReturn > issue.quantity) {
          throw new AppError(`Cannot return more than issued quantity. Issued: ${issue.quantity}`, 400);
        }

        const currentInventory = await tx.inventory.findUnique({ where: { id: data.inventoryId } });
        const newQuantity = (currentInventory?.quantity || 0) + quantityToReturn;
        const newAvailable = Math.max(0, newQuantity - (currentInventory?.reserved || 0));

        const inventory = await tx.inventory.update({
          where: { id: data.inventoryId },
          data: { 
            quantity: newQuantity,
            available: newAvailable,
          },
        });

        const updatedIssue = await tx.inventoryIssue.update({
          where: { id: issue.id },
          data: {
            status: quantityToReturn === issue.quantity ? 'RETURNED' : 'ISSUED',
            returnDate: data.returnDate ? new Date(data.returnDate) : new Date(),
            remarks: data.remarks || issue.remarks,
          },
        });

        const product = await tx.product.findFirst({
          where: { inventoryId: data.inventoryId },
          select: { id: true },
        });

        const productId = product?.id || '';

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'RETURN' as any,
            quantity: quantityToReturn,
            notes: `Returned from ${issue.issuedTo}: ${data.remarks || 'Returned'}`,
            productId: productId,
            inventoryId: data.inventoryId,
            businessUnitId: resolvedBU.id,
            userId: data.userId,
            reference: `RETURN_${updatedIssue.id}`,
          },
        });

        this.safeEmitInventoryUpdate({ productId: productId, quantity: newQuantity }, resolvedBU.id);

        // ✅ Return normalized item
        const result = { 
          issue: updatedIssue, 
          inventory: normalizeInventoryItem(inventory), 
          returnedQuantity: quantityToReturn 
        };
        
        return result;
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.returnItem');
    }
  }

  async restockItem(data: RestockItemData) {
    try {
      if (!data.inventoryId || !data.businessUnitId || !data.userId) {
        throw new AppError('Inventory ID, business unit ID, and user ID are required', 400);
      }

      if (data.quantity <= 0) {
        throw new AppError('Restock quantity must be positive', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(data.businessUnitId);

      return await this.prisma.$transaction(async (tx: any) => {
        const inventory = await tx.inventory.findFirst({
          where: { id: data.inventoryId, businessUnitId: resolvedBU.id },
        });

        if (!inventory) throw new AppError('Inventory item not found', 404);

        const newQuantity = inventory.quantity + data.quantity;
        const newAvailable = Math.max(0, newQuantity - (inventory.reserved || 0));

        const updatedInventory = await tx.inventory.update({
          where: { id: data.inventoryId },
          data: {
            quantity: newQuantity,
            available: newAvailable,
            supplier: data.supplier || inventory.supplier,
          },
        });

        const product = await tx.product.findFirst({
          where: { inventoryId: data.inventoryId },
          select: { id: true },
        });

        const productId = product?.id || '';

        if (data.unitPrice && data.unitPrice > 0 && productId) {
          await tx.product.update({
            where: { id: productId },
            data: { unitPrice: data.unitPrice, costPrice: data.unitPrice },
          });
        }

        await tx.inventoryTransaction.create({
          data: {
            transactionType: 'PURCHASE' as any,
            quantity: data.quantity,
            notes: `Restocked ${data.quantity} units from ${data.supplier || 'Unknown supplier'}`,
            productId: productId,
            inventoryId: inventory.id,
            businessUnitId: resolvedBU.id,
            userId: data.userId,
            reference: data.invoiceNumber || `RESTOCK_${Date.now()}`,
          },
        });

        this.safeEmitInventoryUpdate({ productId: productId, quantity: newQuantity }, resolvedBU.id);

        // ✅ Return normalized item
        const result = { 
          inventory: normalizeInventoryItem(updatedInventory), 
          message: 'Item restocked successfully' 
        };
        
        return result;
      });
    } catch (error) {
      this.handleError(error, 'InventoryService.restockItem');
    }
  }

  // ============================================
  // EXPORT / REPORT METHODS
  // ============================================

  async exportInventory(businessUnitId: string, format: string = 'json') {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const items = await this.prisma.inventory.findMany({
        where: { businessUnitId: resolvedBU.id },
        include: {
          product: { select: { name: true, sku: true, barcode: true, unitPrice: true, costPrice: true, category: { select: { name: true } } } },
          variant: true,
        },
      });

      const exportData = items.map((item: any) => ({
        name: item.product?.name || 'N/A',
        sku: item.product?.sku || item.variant?.sku || 'N/A',
        barcode: item.product?.barcode || 'N/A',
        category: item.product?.category?.name || 'Uncategorized',
        stock: item.quantity,
        reserved: item.reserved || 0,
        available: item.quantity - (item.reserved || 0),
        reorderPoint: item.reorderPoint || 5,
        location: item.location || 'Warehouse',
        price: item.product?.unitPrice || 0,
        costPrice: item.product?.costPrice || 0,
        lastUpdated: item.updatedAt.toISOString(),
      }));

      return { data: exportData, format, total: exportData.length, exportedAt: new Date().toISOString() };
    } catch (error) {
      this.handleError(error, 'InventoryService.exportInventory');
    }
  }

  async exportInventoryToFile(businessUnitId: string, format: 'csv' | 'excel' | 'json' = 'json') {
    try {
      if (!businessUnitId) throw new AppError('Business unit ID is required', 400);

      const result = await this.exportInventory(businessUnitId, format);
      const exportDir = path.join(process.cwd(), 'exports', 'inventory');

      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `inventory_${timestamp}.${format === 'excel' ? 'xlsx' : format}`;
      const filePath = path.join(exportDir, fileName);

      if (format === 'csv') {
        const headers = Object.keys(result.data[0] || {}).join(',');
        const rows = result.data.map((row: any) => Object.values(row).join(','));
        fs.writeFileSync(filePath, [headers, ...rows].join('\n'));
      } else {
        fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2));
      }

      return { filePath, fileName, format, totalRecords: result.total };
    } catch (error) {
      this.handleError(error, 'InventoryService.exportInventoryToFile');
    }
  }

  // ============================================
  // BARCODE / QR CODE METHODS
  // ============================================

  async getInventoryByBarcode(barcode: string, businessUnitId: string): Promise<any> {
    try {
      if (!barcode || !businessUnitId) {
        throw new AppError('Barcode and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      let inventory = await this.prisma.inventory.findFirst({
        where: {
          businessUnitId: resolvedBU.id,
          product: {
            is: { barcode: barcode }
          }
        },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
              variants: { where: { isActive: true } },
            }
          },
          variant: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!inventory) {
        inventory = await this.prisma.inventory.findFirst({
          where: {
            businessUnitId: resolvedBU.id,
            product: {
              is: { sku: { equals: barcode, mode: 'insensitive' } }
            }
          },
          include: {
            product: {
              include: {
                category: true,
                supplier: true,
                variants: { where: { isActive: true } },
              }
            },
            variant: true,
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        });
      }

      if (!inventory) {
        return null;
      }

      // ✅ Apply normalization
      return normalizeInventoryItem(this.formatInventoryItem(inventory));
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryByBarcode');
    }
  }

  async getInventoryBySku(sku: string, businessUnitId: string): Promise<any> {
    try {
      if (!sku || !businessUnitId) {
        throw new AppError('SKU and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: {
          businessUnitId: resolvedBU.id,
          product: {
            is: { sku: { equals: sku, mode: 'insensitive' } }
          }
        },
        include: {
          product: {
            include: {
              category: true,
              supplier: true,
              variants: { where: { isActive: true } },
            }
          },
          variant: true,
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!inventory) {
        return null;
      }

      // ✅ Apply normalization
      return normalizeInventoryItem(this.formatInventoryItem(inventory));
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryBySku');
    }
  }

  async generateInventoryBarcode(inventoryId: string, businessUnitId: string): Promise<{ barcode: string; barcodeUrl: string; qrCodeUrl: string }> {
    try {
      if (!inventoryId || !businessUnitId) {
        throw new AppError('Inventory ID and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: { id: inventoryId, businessUnitId: resolvedBU.id },
        include: { product: true },
      });

      if (!inventory) {
        throw new AppError('Inventory item not found', 404);
      }

      const barcode = await this.generateUniqueBarcode(this.prisma);

      if (inventory.product) {
        await this.prisma.product.update({
          where: { id: inventory.product.id },
          data: { barcode },
        });
      }

      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=EAN-13&dpi=96`;
      
      const qrData = {
        type: 'INVENTORY_ITEM',
        id: inventory.id,
        productId: inventory.product?.id || '',
        name: inventory.product?.name || 'Unknown',
        sku: inventory.product?.sku || 'N/A',
        barcode: barcode,
        location: inventory.location || 'Warehouse',
        quantity: inventory.quantity,
        timestamp: new Date().toISOString(),
      };
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      return {
        barcode,
        barcodeUrl,
        qrCodeUrl,
      };
    } catch (error) {
      this.handleError(error, 'InventoryService.generateInventoryBarcode');
    }
  }

  async generateInventoryQRCode(inventoryId: string, businessUnitId: string): Promise<{ qrCodeUrl: string; qrData: any }> {
    try {
      if (!inventoryId || !businessUnitId) {
        throw new AppError('Inventory ID and business unit ID are required', 400);
      }

      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);

      const inventory = await this.prisma.inventory.findFirst({
        where: { id: inventoryId, businessUnitId: resolvedBU.id },
        include: { product: true },
      });

      if (!inventory) {
        throw new AppError('Inventory item not found', 404);
      }

      const barcode = inventory.product?.barcode || await this.generateUniqueBarcode(this.prisma);

      const qrData = {
        type: 'INVENTORY_ITEM',
        id: inventory.id,
        productId: inventory.product?.id || '',
        name: inventory.product?.name || 'Unknown',
        sku: inventory.product?.sku || 'N/A',
        barcode: barcode,
        location: inventory.location || 'Warehouse',
        quantity: inventory.quantity,
        minStock: inventory.reorderPoint || 5,
        timestamp: new Date().toISOString(),
      };

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      return {
        qrCodeUrl,
        qrData,
      };
    } catch (error) {
      this.handleError(error, 'InventoryService.generateInventoryQRCode');
    }
  }

  async bulkGenerateInventoryBarcodes(inventoryIds: string[], businessUnitId: string): Promise<{ results: any[]; errors: any[] }> {
    try {
      if (!inventoryIds || inventoryIds.length === 0 || !businessUnitId) {
        throw new AppError('Inventory IDs and business unit ID are required', 400);
      }

      const results: any[] = [];
      const errors: any[] = [];

      for (const id of inventoryIds) {
        try {
          const result = await this.generateInventoryBarcode(id, businessUnitId);
          results.push({ id, ...result });
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return { results, errors };
    } catch (error) {
      this.handleError(error, 'InventoryService.bulkGenerateInventoryBarcodes');
    }
  }

  private async syncInventoryFromProduct(productId: string, businessUnitId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        minStock: true,
        maxStock: true,
        supplierId: true,
        supplier: { select: { name: true } },
        categoryId: true,
        category: { select: { name: true } },
      },
    });

    if (!product) return;

    await this.prisma.inventory.updateMany({
      where: { businessUnitId },
      data: {
        reorderPoint: product.minStock || 5,
        reorderQuantity: product.maxStock || 100,
        supplier: product.supplier?.name || null,
      },
    });
  }

  private async syncProductFromInventory(inventoryId: string): Promise<void> {
    const inventory = await this.prisma.inventory.findUnique({
      where: { id: inventoryId },
      select: {
        product: {
          select: { id: true }
        },
        reorderPoint: true,
        reorderQuantity: true,
        location: true,
      },
    });

    if (!inventory || !inventory.product) return;

    await this.prisma.product.update({
      where: { id: inventory.product.id },
      data: {
        minStock: inventory.reorderPoint,
        maxStock: inventory.reorderQuantity,
      },
    });
  }

  // ============================================
  // GET INVENTORY ITEMS (for web service)
  // ============================================

  /**
   * Get inventory items with optional filtering
   * ✅ FIXED: Returns normalized items with product ID at top level
   */
  async getInventoryItems(params: {
    page?: number;
    limit?: number;
    search?: string;
    businessUnitId?: string;
    withoutProduct?: boolean;
  }) {
    try {
      const { page = 1, limit = 20, search, businessUnitId, withoutProduct } = params;
      
      const resolvedBU = await this.ensureBusinessUnit(businessUnitId);
      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(200, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = {
        businessUnitId: resolvedBU.id,
        status: 'ACTIVE',
      };

      if (withoutProduct) {
        where.product = { is: null };
      }

      if (search) {
        where.OR = [
          { product: { is: { name: { contains: search, mode: 'insensitive' } } } },
          { product: { is: { sku: { contains: search, mode: 'insensitive' } } } },
          { product: { is: { barcode: { contains: search, mode: 'insensitive' } } } },
        ];
      }

      const [items, total] = await Promise.all([
        this.prisma.inventory.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy: { updatedAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
                unitPrice: true,
                costPrice: true,
                category: { select: { id: true, name: true } },
                supplier: { select: { id: true, name: true } },
                images: true,
                isActive: true,
              },
            },
            variant: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                attributes: true,
                isActive: true,
              },
            },
          },
        }),
        this.prisma.inventory.count({ where }),
      ]);

      // ✅ Format and normalize items
      const formattedItems = items.map((item: any) => {
        const baseItem = {
          id: item.id,
          productId: item.product?.id || null,
          product: item.product,
          variantId: item.variant?.id || null,
          variant: item.variant,
          name: item.product?.name || item.variant?.name || 'Unknown',
          sku: item.product?.sku || item.variant?.sku || 'N/A',
          barcode: item.product?.barcode || null,
          quantity: item.quantity,
          reserved: item.reserved || 0,
          available: item.quantity - (item.reserved || 0),
          unitPrice: item.product?.unitPrice || item.variant?.price || 0,
          costPrice: item.product?.costPrice || 0,
          category: item.product?.category?.name || 'Uncategorized',
          categoryId: item.product?.category?.id || null,
          supplier: item.product?.supplier?.name || null,
          supplierId: item.product?.supplier?.id || null,
          reorderPoint: item.reorderPoint || 5,
          location: item.location || 'Warehouse',
          notes: item.notes || null,
          hasProduct: !!item.product,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          stock: item.quantity,
          price: item.product?.unitPrice || item.variant?.price || 0,
          images: item.product?.images || [],
          isActive: item.product?.isActive ?? true,
        };
        
        // ✅ Apply normalization
        return normalizeInventoryItem(baseItem);
      });

      return {
        items: formattedItems,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
      };
    } catch (error) {
      this.handleError(error, 'InventoryService.getInventoryItems');
    }
  }
}

export default InventoryService;
