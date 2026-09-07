// D:\Projects\Kalwanga\packages\backend\src\services\supplierService.ts

import { BaseService } from './BaseService.js';
import { AppError } from '../middleware/errorHandler.js';
import { Prisma } from '../generated/prisma/index.js';
import { logger } from '../lib/logger.js';

// ============================================
// INTERFACES
// ============================================

interface CreateSupplierData {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  companyId: string;
  userId: string;
  isActive?: boolean;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  website?: string | null;
  rating?: number | null;
  creditLimit?: number | null;
}

interface UpdateSupplierData {
  name?: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  taxId?: string | null;
  notes?: string | null;
  isActive?: boolean;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  website?: string | null;
  rating?: number | null;
  creditLimit?: number | null;
}

// ============================================
// SUPPLIER SERVICE
// ============================================

export class SupplierService extends BaseService {
  /**
   * Handle errors properly
   */
  private handleServiceError(error: any, methodName: string): never {
    console.error(`❌ Error in ${methodName}:`, error);
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new AppError(`Duplicate entry: ${error.meta?.target || 'field'} already exists`, 400);
      }
      if (error.code === 'P2003') {
        throw new AppError('Foreign key constraint failed', 400);
      }
      if (error.code === 'P2025') {
        throw new AppError('Record not found', 404);
      }
    }
    throw new AppError(`Failed to ${methodName.replace('SupplierService.', '')}: ${error.message || 'Unknown error'}`, 500);
  }

  /**
   * Get all suppliers with pagination and filtering
   * GET /suppliers
   */
  async getAllSuppliers(params: {
    page?: number;
    limit?: number;
    search?: string;
    companyId?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    try {
      const {
        page = 1,
        limit = 50,
        search,
        companyId,
        isActive,
        sortBy = 'name',
        sortOrder = 'asc',
      } = params;

      const validatedPage = Math.max(1, page);
      const validatedLimit = Math.min(200, Math.max(1, limit));
      const skip = (validatedPage - 1) * validatedLimit;

      const where: any = {};
      
      if (companyId) where.companyId = companyId;
      if (isActive !== undefined) where.isActive = isActive;
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { taxId: { contains: search, mode: 'insensitive' } },
        ];
      }

      const validSortFields = ['name', 'createdAt', 'updatedAt', 'email', 'phone'];
      const orderBy: any = validSortFields.includes(sortBy)
        ? { [sortBy]: sortOrder }
        : { name: 'asc' };

      const [suppliers, total] = await Promise.all([
        this.prisma.supplier.findMany({
          where,
          skip,
          take: validatedLimit,
          orderBy,
          include: {
            products: {
              select: {
                id: true,
                name: true,
                sku: true,
                unitPrice: true,
              },
              take: 5,
            },
            purchaseOrders: {
              select: {
                id: true,
                orderNumber: true,
                total: true,
                status: true,
              },
              take: 5,
            },
            _count: {
              select: {
                products: true,
                purchaseOrders: true,
              },
            },
          },
        }),
        this.prisma.supplier.count({ where }),
      ]);

      const enhancedSuppliers = suppliers.map((supplier: any) => ({
        ...supplier,
        productCount: supplier._count?.products || 0,
        purchaseOrderCount: supplier._count?.purchaseOrders || 0,
        totalPurchases: supplier.purchaseOrders?.reduce((sum: number, po: any) => sum + po.total, 0) || 0,
      }));

      return {
        data: enhancedSuppliers,
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit) || 1,
      };
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.getAllSuppliers');
    }
  }

  /**
   * Get supplier by ID
   * GET /suppliers/:id
   */
  async getSupplierById(id: string, companyId?: string) {
    try {
      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          products: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              unitPrice: true,
              costPrice: true,
              images: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { name: 'asc' },
          },
          purchaseOrders: {
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
            },
          },
        },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      if (companyId && supplier.companyId !== companyId) {
        throw new AppError('Supplier does not belong to this company', 403);
      }

      const totalPurchases = supplier.purchaseOrders?.reduce((sum: number, po: any) => sum + po.total, 0) || 0;
      const completedOrders = supplier.purchaseOrders?.filter((po: any) => po.status === 'RECEIVED').length || 0;
      const pendingOrders = supplier.purchaseOrders?.filter((po: any) => po.status === 'PENDING').length || 0;

      return {
        ...supplier,
        productCount: supplier._count?.products || 0,
        purchaseOrderCount: supplier._count?.purchaseOrders || 0,
        totalPurchases,
        completedOrders,
        pendingOrders,
        averageOrderValue: supplier.purchaseOrders?.length > 0 
          ? totalPurchases / supplier.purchaseOrders.length 
          : 0,
      };
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.getSupplierById');
    }
  }

  /**
   * Create a new supplier - FIXED
   * POST /suppliers
   */
  async createSupplier(data: CreateSupplierData) {
    try {
      console.log('📦 Creating supplier with data:', data);
      
      // Required fields validation
      if (!data.name?.trim()) {
        throw new AppError('Supplier name is required', 400);
      }
      if (!data.companyId) {
        throw new AppError('Company ID is required', 400);
      }
      if (!data.userId) {
        throw new AppError('User ID is required', 400);
      }

      // Build the data object - ONLY include fields that have values
      const createData: any = {
        name: data.name.trim(),
        companyId: data.companyId,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };

      // Only add fields if they have values (not null, not undefined, not empty)
      if (data.contactPerson && data.contactPerson.trim()) {
        createData.contactPerson = data.contactPerson.trim();
      }
      if (data.email && data.email.trim()) {
        createData.email = data.email.trim();
      }
      if (data.phone && data.phone.trim()) {
        createData.phone = data.phone.trim();
      }
      if (data.address && data.address.trim()) {
        createData.address = data.address.trim();
      }
      if (data.taxId && data.taxId.trim()) {
        createData.taxId = data.taxId.trim();
      }
      if (data.notes && data.notes.trim()) {
        createData.notes = data.notes.trim();
      }
      if (data.paymentTerms && data.paymentTerms.trim()) {
        createData.paymentTerms = data.paymentTerms.trim();
      }
      if (data.deliveryTerms && data.deliveryTerms.trim()) {
        createData.deliveryTerms = data.deliveryTerms.trim();
      }
      if (data.website && data.website.trim()) {
        createData.website = data.website.trim();
      }
      if (data.rating !== undefined && data.rating !== null) {
        createData.rating = data.rating;
      }
      if (data.creditLimit !== undefined && data.creditLimit !== null) {
        createData.creditLimit = data.creditLimit;
      }

      console.log('🧹 Final createData:', createData);

      // Check for existing supplier
      const existing = await this.prisma.supplier.findFirst({
        where: {
          name: { equals: createData.name, mode: 'insensitive' },
          companyId: createData.companyId,
        },
      });

      if (existing) {
        throw new AppError('Supplier with this name already exists', 400);
      }

      // Create the supplier
      const supplier = await this.prisma.supplier.create({
        data: createData,
      });

      console.log('✅ Supplier created:', supplier.id);
      return supplier;
    } catch (error) {
      console.error('❌ Service error:', error);
      return this.handleServiceError(error, 'SupplierService.createSupplier');
    }
  }

  /**
   * Update supplier - FIXED
   * PUT /suppliers/:id
   */
  async updateSupplier(id: string, data: UpdateSupplierData) {
    try {
      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      // Build update data - only include fields that have values
      const updateData: any = {};

      if (data.name !== undefined) {
        if (data.name.trim()) {
          updateData.name = data.name.trim();
        } else {
          throw new AppError('Supplier name cannot be empty', 400);
        }
      }

      if (data.contactPerson !== undefined) {
        updateData.contactPerson = data.contactPerson?.trim() || null;
      }
      if (data.email !== undefined) {
        updateData.email = data.email?.trim() || null;
      }
      if (data.phone !== undefined) {
        updateData.phone = data.phone?.trim() || null;
      }
      if (data.address !== undefined) {
        updateData.address = data.address?.trim() || null;
      }
      if (data.taxId !== undefined) {
        updateData.taxId = data.taxId?.trim() || null;
      }
      if (data.notes !== undefined) {
        updateData.notes = data.notes?.trim() || null;
      }
      if (data.paymentTerms !== undefined) {
        updateData.paymentTerms = data.paymentTerms?.trim() || null;
      }
      if (data.deliveryTerms !== undefined) {
        updateData.deliveryTerms = data.deliveryTerms?.trim() || null;
      }
      if (data.website !== undefined) {
        updateData.website = data.website?.trim() || null;
      }
      if (data.rating !== undefined) {
        updateData.rating = data.rating;
      }
      if (data.creditLimit !== undefined) {
        updateData.creditLimit = data.creditLimit;
      }
      if (data.isActive !== undefined) {
        updateData.isActive = data.isActive;
      }

      // Check name uniqueness
      if (updateData.name && updateData.name.toLowerCase() !== supplier.name.toLowerCase()) {
        const existing = await this.prisma.supplier.findFirst({
          where: {
            name: { equals: updateData.name, mode: 'insensitive' },
            companyId: supplier.companyId,
            id: { not: id },
          },
        });

        if (existing) {
          throw new AppError('Supplier with this name already exists', 400);
        }
      }

      // Check email uniqueness (only if email is provided and different)
      if (updateData.email && updateData.email.toLowerCase() !== (supplier.email || '').toLowerCase()) {
        const existingEmail = await this.prisma.supplier.findFirst({
          where: {
            email: { equals: updateData.email, mode: 'insensitive' },
            companyId: supplier.companyId,
            id: { not: id },
          },
        });

        if (existingEmail) {
          throw new AppError('Supplier with this email already exists', 400);
        }
      }

      updateData.updatedAt = new Date();

      const updatedSupplier = await this.prisma.supplier.update({
        where: { id },
        data: updateData,
      });

      return updatedSupplier;
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.updateSupplier');
    }
  }

  /**
   * Delete supplier (soft delete if has associations)
   * DELETE /suppliers/:id
   */
  async deleteSupplier(id: string, companyId?: string) {
    try {
      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
        include: {
          products: true,
          purchaseOrders: true,
        },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      if (companyId && supplier.companyId !== companyId) {
        throw new AppError('Supplier does not belong to this company', 403);
      }

      // Soft delete if has associations
      if (supplier.products.length > 0 || supplier.purchaseOrders.length > 0) {
        const archivedSupplier = await this.prisma.supplier.update({
          where: { id },
          data: {
            isActive: false,
          },
        });

        return {
          message: 'Supplier deactivated due to existing associations',
          softDeleted: true,
          supplier: archivedSupplier,
        };
      }

      // Hard delete
      await this.prisma.supplier.delete({
        where: { id },
      });

      return {
        message: 'Supplier deleted successfully',
        softDeleted: false,
      };
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.deleteSupplier');
    }
  }

  /**
   * Toggle supplier status
   * PATCH /suppliers/:id/status
   */
  async toggleSupplierStatus(id: string, isActive: boolean) {
    try {
      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      const updatedSupplier = await this.prisma.supplier.update({
        where: { id },
        data: {
          isActive,
          updatedAt: new Date(),
        },
      });

      return updatedSupplier;
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.toggleSupplierStatus');
    }
  }

  /**
   * Search suppliers
   * GET /suppliers/search
   */
  async searchSuppliers(query: string, companyId?: string, limit: number = 10) {
    try {
      if (!query || query.trim().length === 0) {
        throw new AppError('Search query is required', 400);
      }

      const where: any = {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { contactPerson: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
          { taxId: { contains: query, mode: 'insensitive' } },
        ],
      };

      if (companyId) where.companyId = companyId;

      const suppliers = await this.prisma.supplier.findMany({
        where,
        take: limit,
        include: {
          products: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
            take: 5,
          },
          _count: {
            select: {
              products: true,
              purchaseOrders: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      return suppliers;
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.searchSuppliers');
    }
  }

  /**
   * Bulk delete suppliers
   * POST /suppliers/bulk/delete
   */
  async bulkDeleteSuppliers(ids: string[], companyId?: string) {
    try {
      if (!ids || ids.length === 0) {
        throw new AppError('Supplier IDs array is required', 400);
      }

      const results = [];
      const errors = [];
      let deletedCount = 0;

      for (const id of ids) {
        try {
          const result = await this.deleteSupplier(id, companyId);
          deletedCount++;
          results.push({ id, success: true, ...result });
        } catch (error) {
          errors.push({
            id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        deletedCount,
        results,
        errors,
      };
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.bulkDeleteSuppliers');
    }
  }

  /**
   * Get supplier products
   * GET /suppliers/:id/products
   */
  async getSupplierProducts(supplierId: string, params?: { page?: number; limit?: number }) {
    try {
      if (!supplierId) {
        throw new AppError('Supplier ID is required', 400);
      }

      const { page = 1, limit = 10 } = params || {};
      const skip = (page - 1) * limit;

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
          take: limit,
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            inventory: {
              select: {
                id: true,
                quantity: true,
                reserved: true,
              },
            },
            variants: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
              },
            },
          },
          orderBy: { name: 'asc' },
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
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
      };
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.getSupplierProducts');
    }
  }

  /**
   * Get supplier purchase orders
   * GET /suppliers/:id/purchase-orders
   */
  async getSupplierPurchaseOrders(supplierId: string, params?: { page?: number; limit?: number }) {
    try {
      if (!supplierId) {
        throw new AppError('Supplier ID is required', 400);
      }

      const { page = 1, limit = 10 } = params || {};
      const skip = (page - 1) * limit;

      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      const [purchaseOrders, total] = await Promise.all([
        this.prisma.purchaseOrder.findMany({
          where: { supplierId },
          skip,
          take: limit,
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                  },
                },
              },
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.purchaseOrder.count({
          where: { supplierId },
        }),
      ]);

      return {
        purchaseOrders: purchaseOrders.map((po: any) => ({
          ...po,
          itemsCount: po.items?.length || 0,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
      };
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.getSupplierPurchaseOrders');
    }
  }

  /**
   * Get supplier order history
   * GET /suppliers/:id/orders
   */
  async getSupplierOrderHistory(supplierId: string, params?: { page?: number; limit?: number }) {
    try {
      if (!supplierId) {
        throw new AppError('Supplier ID is required', 400);
      }

      const { page = 1, limit = 10 } = params || {};
      const skip = (page - 1) * limit;

      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      const [orders, total] = await Promise.all([
        this.prisma.purchaseOrder.findMany({
          where: { supplierId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.purchaseOrder.count({
          where: { supplierId },
        }),
      ]);

      return {
        orders: orders.map((order: any) => ({
          ...order,
          itemsCount: order.items?.length || 0,
        })),
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
      };
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.getSupplierOrderHistory');
    }
  }

  /**
   * Get supplier statistics
   * GET /suppliers/:id/statistics
   */
  async getSupplierStatistics(supplierId: string) {
    try {
      if (!supplierId) {
        throw new AppError('Supplier ID is required', 400);
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
        include: {
          products: {
            select: {
              id: true,
              unitPrice: true,
              costPrice: true,
            },
          },
          purchaseOrders: {
            select: {
              total: true,
              status: true,
            },
          },
        },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      const totalProducts = supplier.products.length;
      const totalProductsValue = supplier.products.reduce((sum: number, p: any) => sum + (p.unitPrice || 0), 0);
      const totalCost = supplier.products.reduce((sum: number, p: any) => sum + (p.costPrice || 0), 0);
      
      const totalPurchaseOrders = supplier.purchaseOrders.length;
      const totalPurchaseValue = supplier.purchaseOrders.reduce((sum: number, po: any) => sum + po.total, 0);
      const completedOrders = supplier.purchaseOrders.filter((po: any) => po.status === 'RECEIVED').length;
      const pendingOrders = supplier.purchaseOrders.filter((po: any) => po.status === 'PENDING').length;

      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        totalProducts,
        totalProductsValue,
        totalCost,
        totalPurchaseOrders,
        totalPurchaseValue,
        completedOrders,
        pendingOrders,
        averageOrderValue: totalPurchaseOrders > 0 ? totalPurchaseValue / totalPurchaseOrders : 0,
        completionRate: totalPurchaseOrders > 0 ? (completedOrders / totalPurchaseOrders) * 100 : 0,
      };
    } catch (error) {
      return this.handleServiceError(error, 'SupplierService.getSupplierStatistics');
    }
  }
}

export const supplierService = new SupplierService();
