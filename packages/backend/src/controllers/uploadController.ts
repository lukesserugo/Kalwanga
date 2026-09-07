// src/controllers/uploadController.ts
import { Request, Response, NextFunction } from 'express';
import { imageService } from '../services/imageService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { prisma } from '../lib/prisma.js';

// Define Multer file interface
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Type for multer file filter callback
type FileFilterCallback = (error: Error | null, acceptFile: boolean) => void;

// Type for multer file filter function
type FileFilterFunction = (
  req: Request,
  file: MulterFile,
  callback: FileFilterCallback
) => void;

// Configure multer for memory storage
const fileFilter: FileFilterFunction = (
  req: Request,
  file: MulterFile,
  cb: FileFilterCallback
): void => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'image/avif',
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10, // Max 10 files
  },
  fileFilter: fileFilter as any,
});

// Validation schemas
const reorderImagesSchema = z.object({
  imageIds: z.array(z.string().min(1)).min(2, 'At least 2 images required'),
});

// Helper function to get uploaded file
function getUploadedFile(req: Request): MulterFile | undefined {
  return (req as any).file as MulterFile | undefined;
}

// Helper function to get uploaded files
function getUploadedFiles(req: Request): MulterFile[] | undefined {
  return (req as any).files as MulterFile[] | undefined;
}

export const uploadController = {
  /**
   * Upload product image
   * POST /upload/product/:productId
   */
  async uploadProductImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const file = getUploadedFile(req);
      
      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const product = await imageService.uploadProductImage(productId, file);

      res.status(201).json({
        success: true,
        data: product,
        message: 'Product image uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upload multiple product images
   * POST /upload/product/:productId/multiple
   */
  async uploadMultipleProductImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const files = getUploadedFiles(req);
      
      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }
      if (!files || files.length === 0) {
        throw new AppError('No files uploaded', 400);
      }

      const results = await imageService.uploadMultipleProductImages(productId, files);

      const succeeded = results.filter((r: any) => !r.success || r.success === undefined).length;
      const failed = results.filter((r: any) => r.success === false).length;

      res.status(201).json({
        success: failed === 0,
        data: results,
        summary: {
          total: files.length,
          succeeded,
          failed,
        },
        message: `${succeeded} images uploaded successfully${failed > 0 ? `, ${failed} failed` : ''}`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upload supplier image
   * POST /upload/supplier/:supplierId
   */
  async uploadSupplierImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { supplierId } = req.params;
      const file = getUploadedFile(req);
      
      if (!supplierId) {
        throw new AppError('Supplier ID is required', 400);
      }
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const supplier = await imageService.uploadSupplierImage(supplierId, file);

      res.status(201).json({
        success: true,
        data: supplier,
        message: 'Supplier image uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upload user avatar
   * POST /upload/user/:userId/avatar
   */
  async uploadUserAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const file = getUploadedFile(req);
      
      if (!userId) {
        throw new AppError('User ID is required', 400);
      }
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const user = await imageService.uploadUserAvatar(userId, file);

      res.status(201).json({
        success: true,
        data: user,
        message: 'User avatar uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upload company logo
   * POST /upload/company/:companyId/logo
   */
  async uploadCompanyLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { companyId } = req.params;
      const file = getUploadedFile(req);
      
      if (!companyId) {
        throw new AppError('Company ID is required', 400);
      }
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      const company = await imageService.uploadCompanyLogo(companyId, file);

      res.status(201).json({
        success: true,
        data: company,
        message: 'Company logo uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete image
   * DELETE /upload/image/:imageId
   */
  async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { imageId } = req.params;

      if (!imageId) {
        throw new AppError('Image ID is required', 400);
      }

      await imageService.deleteImage(imageId);

      res.status(200).json({
        success: true,
        message: 'Image deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Set image as primary
   * PATCH /upload/image/:imageId/primary
   */
  async setPrimaryImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { imageId } = req.params;

      if (!imageId) {
        throw new AppError('Image ID is required', 400);
      }

      const image = await imageService.setPrimaryImage(imageId);

      res.status(200).json({
        success: true,
        data: image,
        message: 'Primary image set successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get product images
   * GET /upload/product/:productId/images
   */
  async getProductImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;

      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }

      const images = await imageService.getProductImages(productId);

      res.status(200).json({
        success: true,
        data: images,
        count: images.length,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Reorder product images
   * PUT /upload/product/:productId/images/reorder
   */
  async reorderImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.params;
      const { imageIds } = reorderImagesSchema.parse(req.body);

      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }

      const images = await imageService.reorderImages(productId, imageIds);

      res.status(200).json({
        success: true,
        data: images,
        message: 'Images reordered successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }
      next(error);
    }
  },

  /**
   * Upload business unit logo
   * POST /upload/business-unit/:businessUnitId/logo
   */
  async uploadBusinessUnitLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { businessUnitId } = req.params;
      const file = getUploadedFile(req);
      
      if (!businessUnitId) {
        throw new AppError('Business unit ID is required', 400);
      }
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      // Get business unit with company
      const businessUnit = await prisma.businessUnit.findUnique({
        where: { id: businessUnitId },
        include: { company: true },
      });

      if (!businessUnit) {
        throw new AppError('Business unit not found', 404);
      }

      const company = await imageService.uploadCompanyLogo(businessUnit.companyId, file);

      res.status(201).json({
        success: true,
        data: company,
        message: 'Business unit logo uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Upload category image
   * POST /upload/category/:categoryId
   */
  async uploadCategoryImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { categoryId } = req.params;
      const file = getUploadedFile(req);
      
      if (!categoryId) {
        throw new AppError('Category ID is required', 400);
      }
      if (!file) {
        throw new AppError('No file uploaded', 400);
      }

      // Verify category exists
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        throw new AppError('Category not found', 404);
      }

      // Process and save image
      const fileName = `category-${Date.now()}-${path.extname(file.originalname)}`;
      const uploadDir = path.join(process.cwd(), 'uploads');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);
      await fs.promises.writeFile(filePath, file.buffer);

      const url = `${process.env.APP_URL || 'http://localhost:3000'}/uploads/${fileName}`;

      // Update category with image
      const updatedCategory = await prisma.category.update({
        where: { id: categoryId },
        data: {
          image: url,
          imageFileName: fileName,
        } as any,
      });

      res.status(201).json({
        success: true,
        data: updatedCategory,
        message: 'Category image uploaded successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get upload statistics
   * GET /upload/stats
   */
  async getUploadStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const uploadDir = path.join(process.cwd(), 'uploads');
      
      let totalFiles = 0;
      let totalSize = 0;
      
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        totalFiles = files.length;
        
        for (const file of files) {
          const stats = fs.statSync(path.join(uploadDir, file));
          totalSize += stats.size;
        }
      }

      res.status(200).json({
        success: true,
        data: {
          totalFiles,
          totalSize,
          totalSizeMB: Math.round((totalSize / 1024 / 1024) * 100) / 100,
          uploadDir,
          maxFileSize: '10MB',
          allowedTypes: ['JPEG', 'PNG', 'WebP', 'GIF', 'SVG', 'AVIF'],
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
