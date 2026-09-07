// src/controllers/customerController.ts
import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customerService.js';
import { AppError } from '../middleware/errorHandler.js';
import { createCustomerSchema } from '../utils/validators.js';
import { z } from 'zod';

const customerService = new CustomerService();

// Validation schemas
const updateCustomerSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  phoneNumber: z.string().optional(),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

const loyaltyPointsSchema = z.object({
  points: z.number().int().positive('Points must be positive'),
  reason: z.string().optional(),
});

export const customerController = {
  /**
   * Get all customers
   * GET /customers
   */
  async getAllCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        page, 
        limit, 
        search, 
        companyId, 
        isActive,
        sortBy,
        sortOrder,
      } = req.query;

      const result = await customerService.getAllCustomers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        companyId: companyId as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result.customers,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get customer by ID
   * GET /customers/:id
   */
  async getCustomerById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await customerService.getCustomerById(id);
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create customer
   * POST /customers
   */
  async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCustomerSchema.parse(req.body);
      const customer = await customerService.createCustomer(data);
      res.status(201).json({ 
        success: true, 
        data: customer,
        message: 'Customer created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Update customer
   * PUT /customers/:id
   */
  async updateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = updateCustomerSchema.parse(req.body);
      const customer = await customerService.updateCustomer(id, data);
      res.json({ 
        success: true, 
        data: customer,
        message: 'Customer updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Delete customer
   * DELETE /customers/:id
   */
  async deleteCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await customerService.deleteCustomer(id);
      res.json({ 
        success: true, 
        message: 'Customer deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Add loyalty points
   * POST /customers/:id/loyalty-points/add
   */
  async addLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { points, reason } = loyaltyPointsSchema.parse(req.body);
      const customer = await customerService.addLoyaltyPoints(id, points, reason);
      res.json({ 
        success: true, 
        data: customer,
        message: `${points} loyalty points added`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Redeem loyalty points
   * POST /customers/:id/loyalty-points/redeem
   */
  async redeemLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { points, reason } = loyaltyPointsSchema.parse(req.body);
      const customer = await customerService.redeemLoyaltyPoints(id, points, reason);
      res.json({ 
        success: true, 
        data: customer,
        message: `${points} loyalty points redeemed`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get customer stats
   * GET /customers/:id/stats
   */
  async getCustomerStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const stats = await customerService.getCustomerStats(id);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get customer purchase history
   * GET /customers/:id/purchases
   */
  async getCustomerPurchaseHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;
      
      const result = await customerService.getCustomerPurchaseHistory(id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      
      res.json({ 
        success: true, 
        data: result.sales,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Search customers
   * GET /customers/search
   */
  async searchCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const { q, companyId } = req.query;
      
      if (!q) {
        throw new AppError('Search term is required', 400);
      }
      
      const customers = await customerService.searchCustomers(
        q as string,
        companyId as string
      );
      
      res.json({ 
        success: true, 
        data: customers,
        count: customers.length,
      });
    } catch (error) {
      next(error);
    }
  },
};
