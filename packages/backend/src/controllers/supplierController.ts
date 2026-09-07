// D:\Projects\Kalwanga\packages\backend\src\controllers\supplierController.ts

import { Request, Response, NextFunction } from 'express';
import { supplierService } from '../services/supplierService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { createSupplierSchema, updateSupplierSchema } from '../utils/validators.js';
import { Prisma } from '../generated/prisma/index.js';

export const supplierController = {
  /**
   * Get all suppliers with pagination and filters
   * GET /suppliers
   */
  async getAllSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, companyId, isActive } = req.query;
      
      const result = await supplierService.getAllSuppliers({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
        search: search as string,
        companyId: companyId as string,
        isActive: isActive ? isActive === 'true' : undefined,
      });

      res.json({
        success: true,
        data: result?.data || [],
        pagination: {
          total: result?.total || 0,
          page: result?.page || 1,
          totalPages: result?.totalPages || 1,
          limit: result?.limit || 50,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get supplier by ID
   * GET /suppliers/:id
   */
  async getSupplierById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { companyId } = req.query;
      
      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const supplier = await supplierService.getSupplierById(id, companyId as string);
      
      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      res.json({
        success: true,
        data: supplier,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new supplier - FIXED
   * POST /suppliers
   */
  async createSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      console.log('📝 Creating supplier with body:', req.body);
      
      // Validate with Zod schema
      const validatedData = createSupplierSchema.parse(req.body);
      
      console.log('✅ Validation passed:', validatedData);

      // Build data object - handle null/undefined properly
      const data = {
        name: validatedData.name,
        contactPerson: validatedData.contactPerson || null,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        address: validatedData.address || null,
        taxId: validatedData.taxId || null,
        notes: validatedData.notes || null,
        paymentTerms: validatedData.paymentTerms || null,
        deliveryTerms: validatedData.deliveryTerms || null,
        website: validatedData.website || null,
        rating: validatedData.rating !== undefined ? validatedData.rating : null,
        creditLimit: validatedData.creditLimit !== undefined ? validatedData.creditLimit : null,
        companyId: validatedData.companyId,
        userId: validatedData.userId,
        isActive: validatedData.isActive !== undefined ? validatedData.isActive : true,
      };

      const supplier = await supplierService.createSupplier(data);

      res.status(201).json({
        success: true,
        data: supplier,
        message: 'Supplier created successfully',
      });
    } catch (error) {
      console.error('❌ Error in createSupplier controller:', error);
      next(error);
    }
  },

  /**
   * Update supplier - FIXED
   * PUT /suppliers/:id
   */
  async updateSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      
      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const validatedData = updateSupplierSchema.parse(req.body);

      // Build data object - handle null/undefined properly
      const data: any = {};

      // Only include fields that are provided
      if (validatedData.name !== undefined) data.name = validatedData.name;
      if (validatedData.contactPerson !== undefined) data.contactPerson = validatedData.contactPerson;
      if (validatedData.email !== undefined) data.email = validatedData.email;
      if (validatedData.phone !== undefined) data.phone = validatedData.phone;
      if (validatedData.address !== undefined) data.address = validatedData.address;
      if (validatedData.taxId !== undefined) data.taxId = validatedData.taxId;
      if (validatedData.notes !== undefined) data.notes = validatedData.notes;
      if (validatedData.paymentTerms !== undefined) data.paymentTerms = validatedData.paymentTerms;
      if (validatedData.deliveryTerms !== undefined) data.deliveryTerms = validatedData.deliveryTerms;
      if (validatedData.website !== undefined) data.website = validatedData.website;
      if (validatedData.rating !== undefined) data.rating = validatedData.rating;
      if (validatedData.creditLimit !== undefined) data.creditLimit = validatedData.creditLimit;
      if (validatedData.isActive !== undefined) data.isActive = validatedData.isActive;

      const supplier = await supplierService.updateSupplier(id, data);

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      res.json({
        success: true,
        data: supplier,
        message: 'Supplier updated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete supplier
   * DELETE /suppliers/:id
   */
  async deleteSupplier(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { companyId } = req.query;

      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const result = await supplierService.deleteSupplier(id, companyId as string);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Toggle supplier status
   * PATCH /suppliers/:id/status
   */
  async toggleSupplierStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      if (isActive === undefined) {
        throw new AppError('isActive field is required', 400);
      }

      const supplier = await supplierService.toggleSupplierStatus(id, isActive);

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      res.json({
        success: true,
        data: supplier,
        message: `Supplier ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Search suppliers
   * GET /suppliers/search
   */
  async searchSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, companyId, limit } = req.query;

      if (!query) {
        throw new AppError('Search query is required', 400);
      }

      const suppliers = await supplierService.searchSuppliers(
        query as string,
        companyId as string,
        limit ? Number(limit) : 10
      );

      res.json({
        success: true,
        data: suppliers || [],
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Bulk delete suppliers
   * POST /suppliers/bulk/delete
   */
  async bulkDeleteSuppliers(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids, companyId } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Supplier IDs array is required', 400);
      }

      const result = await supplierService.bulkDeleteSuppliers(ids, companyId);

      res.json({
        success: true,
        data: result,
        message: `${result.deletedCount} suppliers deleted successfully${result.errors.length > 0 ? `, ${result.errors.length} failed` : ''}`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get supplier products
   * GET /suppliers/:id/products
   */
  async getSupplierProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const result = await supplierService.getSupplierProducts(id, {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      });

      res.json({
        success: true,
        data: result || { products: [], total: 0, page: 1, totalPages: 1, limit: 10 },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get supplier purchase orders
   * GET /suppliers/:id/purchase-orders
   */
  async getSupplierPurchaseOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const result = await supplierService.getSupplierPurchaseOrders(id, {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      });

      res.json({
        success: true,
        data: result || { purchaseOrders: [], total: 0, page: 1, totalPages: 1, limit: 10 },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get supplier order history
   * GET /suppliers/:id/orders
   */
  async getSupplierOrderHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;

      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const result = await supplierService.getSupplierOrderHistory(id, {
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      });

      res.json({
        success: true,
        data: result || { orders: [], total: 0, page: 1, totalPages: 1, limit: 10 },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get supplier statistics
   * GET /suppliers/:id/statistics
   */
  async getSupplierStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError('Supplier ID is required', 400);
      }

      const statistics = await supplierService.getSupplierStatistics(id);

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      next(error);
    }
  }
};

export default supplierController;
