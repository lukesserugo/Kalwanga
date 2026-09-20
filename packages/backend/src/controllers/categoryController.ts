// packages/backend/src/controllers/categoryController.ts

import { Request, Response, NextFunction } from 'express';
import { CategoryService } from '../services/categoryService.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  createCategorySchema,
  updateCategorySchema,
  bulkDeleteSchema,
  categoryQuerySchema,
  categoryWithProductsQuerySchema,
} from '../utils/validators.js';
import { z } from 'zod';

const categoryService = new CategoryService();

// ============================================
// ERROR HANDLING
// ============================================

function handleZodError(error: z.ZodError, res: Response) {
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    })),
  });
}

function handleGeneralError(error: any, res: Response) {
  console.error('❌ Category controller error:', error);

  if (error instanceof AppError) {
    const status = (error as any).status ?? (error as any).statusCode ?? 500;
    return res.status(status).json({
      success: false,
      message: error.message,
    });
  }
  if (error instanceof z.ZodError) return handleZodError(error, res);

  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any;
    if (prismaError.code === 'P2025')
      return res
        .status(404)
        .json({ success: false, message: 'Record not found' });
    if (prismaError.code === 'P2002')
      return res.status(409).json({
        success: false,
        message: 'A record with this value already exists',
      });
    if (prismaError.code === 'P2003')
      return res
        .status(400)
        .json({ success: false, message: 'Foreign key constraint failed' });
  }

  if (error instanceof Error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }

  return res
    .status(500)
    .json({ success: false, message: 'Internal server error' });
}

// ============================================
// CONTROLLER
// ============================================

export const categoryController = {
  // ------------------------------------------
  // PUBLIC
  // ------------------------------------------

  /**
   * GET /categories/public
   * No auth. Resolves business unit transparently.
   */
  async getPublicCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId, limit, search, featured } = req.query;

      const data = await categoryService.getPublicCategories({
        businessUnitId: businessUnitId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : 100,
        search: search as string | undefined,
        featuredOnly: featured === 'true',
      });

      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * GET /categories/public/tree/:businessUnitId
   */
  async getPublicCategoryTree(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.params;
      const data = await categoryService.getPublicCategoryTree(businessUnitId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * GET /categories/public/:id/with-products
   * No auth. Returns 404 if the category isn't public.
   */
  async getPublicCategoryWithProducts(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Category ID is required', 400);

      const params = categoryWithProductsQuerySchema.parse(req.query);

      const data = await categoryService.getPublicCategoryWithProducts(
        id,
        params,
      );

      if (!data) {
        return res
          .status(404)
          .json({ success: false, message: 'Category not found' });
      }

      return res.status(200).json({ success: true, data });
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(error, res);
      return handleGeneralError(error, res);
    }
  },

  // ------------------------------------------
  // AUTHENTICATED READ
  // ------------------------------------------

  async getAllCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = categoryQuerySchema.parse(req.query);
      const result = await categoryService.getAllCategories({
        ...parsed,
        parentId:
          parsed.parentId === 'null' || parsed.parentId === ''
            ? null
            : parsed.parentId,
      });

      return res.status(200).json({
        success: true,
        data: result.categories,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(error, res);
      return handleGeneralError(error, res);
    }
  },

  async getCategoryById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Category ID is required', 400);
      const data = await categoryService.getCategoryById(id);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getCategoryBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug } = req.params;
      const { businessUnitId } = req.query;
      if (!slug) throw new AppError('Category slug is required', 400);
      const data = await categoryService.getCategoryBySlug(
        slug,
        businessUnitId as string | undefined,
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getCategoryByName(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, businessUnitId } = req.query;
      if (!name) throw new AppError('Category name is required', 400);
      const data = await categoryService.getCategoryByName(
        name as string,
        businessUnitId as string | undefined,
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getSubcategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { parentId } = req.params;
      if (!parentId) throw new AppError('Parent category ID is required', 400);
      const data = await categoryService.getSubcategories(parentId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getCategoryTree(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.params;
      if (!businessUnitId)
        throw new AppError('Business unit ID is required', 400);
      const data = await categoryService.getCategoryTree(businessUnitId);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getCategoryStatistics(req: Request, res: Response, next: NextFunction) {
    try {
      const { businessUnitId } = req.params;
      const data = await categoryService.getCategoryStatistics(
        businessUnitId || undefined,
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async getCategoryProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;
      if (!id) throw new AppError('Category ID is required', 400);
      const result = await categoryService.getCategoryProducts(id, {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });
      return res.status(200).json({
        success: true,
        data: result.products,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: result.limit,
        },
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  /**
   * GET /categories/:id/with-products
   *
   * Full category + product list + inventory rollups.
   * Query params:
   *   productLimit    (default 50, max 200)
   *   includeInactive (default false)
   */
  async getCategoryWithProducts(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Category ID is required', 400);

      const params = categoryWithProductsQuerySchema.parse(req.query);

      const data = await categoryService.getCategoryWithProducts(id, params);

      return res.status(200).json({
        success: true,
        data,
        meta: {
          productCount: data.productCount,
          childCount: data.childCount,
          totalStock: data.totalStock,
          totalInventoryValue: data.totalInventoryValue,
          inStockCount: data.inStockCount,
          outOfStockCount: data.outOfStockCount,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(error, res);
      return handleGeneralError(error, res);
    }
  },

  // ------------------------------------------
  // WRITE
  // ------------------------------------------

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = createCategorySchema.parse(req.body);
      const category = await categoryService.createCategory(data);
      return res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(error, res);
      return handleGeneralError(error, res);
    }
  },

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Category ID is required', 400);
      const data = updateCategorySchema.parse(req.body);
      const category = await categoryService.updateCategory(id, data);
      return res.status(200).json({
        success: true,
        data: category,
        message: 'Category updated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(error, res);
      return handleGeneralError(error, res);
    }
  },

  async toggleCategoryStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      if (!id) throw new AppError('Category ID is required', 400);
      if (typeof isActive !== 'boolean')
        throw new AppError('isActive (boolean) is required', 400);

      const category = await categoryService.toggleCategoryStatus(id, isActive);
      return res.status(200).json({
        success: true,
        data: category,
        message: `Category ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) throw new AppError('Category ID is required', 400);
      const result = await categoryService.deleteCategory(id);
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      return handleGeneralError(error, res);
    }
  },

  async bulkDeleteCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const { ids } = bulkDeleteSchema.parse(req.body);
      const result = await categoryService.bulkDeleteCategories(ids);
      return res.status(200).json({
        success: true,
        data: result,
        message: `${result.deletedCount} categories deleted successfully`,
        errors: result.errors,
      });
    } catch (error) {
      if (error instanceof z.ZodError) return handleZodError(error, res);
      return handleGeneralError(error, res);
    }
  },
};

export default categoryController;
