// packages/backend/src/controllers/customerController.ts
import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/customerService.js';
import { AppError } from '../middleware/errorHandler.js';
import { createCustomerSchema } from '../utils/validators.js';
import { z } from 'zod';

const customerService = new CustomerService();

// ─────────────────────────────────────────────────────────────
// Validation schemas
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Helper: resolve the effective companyId for this request.
//
//   1. Explicit query param (admin override) wins
//   2. Otherwise use the authenticated user's companyId
//   3. Filter out the literal string 'default' (frontend placeholder)
//      so it can never reach Prisma as a filter value
// ─────────────────────────────────────────────────────────────
function resolveCompanyId(req: Request): string | undefined {
  const fromQuery =
    typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
  const fromAuth = (req as any).user?.companyId as string | undefined;

  const resolved = fromQuery || fromAuth;

  if (
    !resolved ||
    resolved === 'default' ||
    resolved === 'undefined' ||
    resolved === 'null'
  ) {
    return undefined;
  }
  return resolved;
}

export const customerController = {
  // ─────────────────────────────────────────────────────────
  // GET /customers
  // ─────────────────────────────────────────────────────────
  async getAllCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, isActive, sortBy, sortOrder } = req.query;

      const companyId = resolveCompanyId(req);

      const result = await customerService.getAllCustomers({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        companyId,
        isActive:
          isActive === 'true' ? true : isActive === 'false' ? false : undefined,
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

  // ─────────────────────────────────────────────────────────
  // GET /customers/:id
  // ─────────────────────────────────────────────────────────
  async getCustomerById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await customerService.getCustomerById(id);
      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  },

  // ─────────────────────────────────────────────────────────
  // POST /customers
  // ─────────────────────────────────────────────────────────
  async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const body = { ...req.body };

      // Inject companyId from the auth middleware if the client
      // didn't (or couldn't) send it.
      if (!body.companyId || body.companyId === 'default') {
        const fromAuth =
          (req as any).user?.companyId ||
          (req as any).companyId ||
          (req.headers['x-company-id'] as string | undefined);

        if (fromAuth && fromAuth !== 'default') {
          body.companyId = fromAuth;
        } else {
          delete body.companyId;
        }
      }

      // If we still have no valid companyId, fail fast with a clear
      // message instead of a generic Zod error.
      if (!body.companyId) {
        return res.status(400).json({
          success: false,
          message:
            'No company associated with your account. Please contact an administrator.',
          errors: [{ field: 'companyId', message: 'Required' }],
        });
      }

      const data = createCustomerSchema.parse(body);
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
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  // ─────────────────────────────────────────────────────────
  // PUT /customers/:id
  // ─────────────────────────────────────────────────────────
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
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  // ─────────────────────────────────────────────────────────
  // DELETE /customers/:id
  // ─────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────
  // POST /customers/:id/loyalty-points/add
  // ─────────────────────────────────────────────────────────
  async addLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { points, reason } = loyaltyPointsSchema.parse(req.body);

      const customer = await customerService.addLoyaltyPoints(
        id,
        points,
        reason
      );

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
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  // ─────────────────────────────────────────────────────────
  // POST /customers/:id/loyalty-points/redeem
  // ─────────────────────────────────────────────────────────
  async redeemLoyaltyPoints(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { points, reason } = loyaltyPointsSchema.parse(req.body);

      const customer = await customerService.redeemLoyaltyPoints(
        id,
        points,
        reason
      );

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
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  // ─────────────────────────────────────────────────────────
  // GET /customers/:id/stats
  // ─────────────────────────────────────────────────────────
  async getCustomerStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const stats = await customerService.getCustomerStats(id);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  },

  // ─────────────────────────────────────────────────────────
  // GET /customers/:id/purchases
  // ─────────────────────────────────────────────────────────
  async getCustomerPurchaseHistory(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
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

  // ─────────────────────────────────────────────────────────
  // GET /customers/search
  // ─────────────────────────────────────────────────────────
  async searchCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const { q } = req.query;
      if (!q) throw new AppError('Search term is required', 400);

      // Same company scoping as the list endpoint.
      const companyId = resolveCompanyId(req);

      const customers = await customerService.searchCustomers(
        q as string,
        companyId
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
