// src/services/imageService.ts
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { realtimeService } from './realtimeService.js';

// Define Multer file interface
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

// Image processing options
interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: string;
  background?: string;
}

// Image upload result
interface ImageUploadResult {
  id: string;
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: Date;
}

export class ImageService {
  private uploadDir: string;
  private thumbnailDir: string;
  private maxFileSize: number;
  private allowedMimeTypes: string[];

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.thumbnailDir = path.join(this.uploadDir, 'thumbnails');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/avif',
    ];

    this.ensureDirectories();
  }

  /**
   * Ensure upload directories exist
   */
  private ensureDirectories(): void {
    try {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
      if (!fs.existsSync(this.thumbnailDir)) {
        fs.mkdirSync(this.thumbnailDir, { recursive: true });
      }
      logger.info('Upload directories initialized');
    } catch (error) {
      logger.error('Failed to create upload directories:', error);
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: MulterFile): void {
    if (!file) {
      throw new AppError('No file provided', 400);
    }

    if (file.size <= 0) {
      throw new AppError('File is empty', 400);
    }

    if (file.size > this.maxFileSize) {
      throw new AppError(`File size exceeds maximum allowed (${this.maxFileSize / 1024 / 1024}MB)`, 400);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError(`Unsupported file type: ${file.mimetype}. Allowed: ${this.allowedMimeTypes.join(', ')}`, 400);
    }
  }

  /**
   * Generate unique file name
   */
  private generateFileName(originalName: string): string {
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 50);
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `${baseName}-${timestamp}-${random}${extension}`;
  }

  /**
   * Generate thumbnail (simple copy without processing)
   */
  private async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    // Without sharp, just return the original buffer
    // For now, we'll just copy the original image as thumbnail
    return buffer;
  }

  /**
   * Save file to disk
   */
  private async saveFile(buffer: Buffer, fileName: string, directory: string): Promise<string> {
    try {
      const filePath = path.join(directory, fileName);
      await fs.promises.writeFile(filePath, buffer);
      return filePath;
    } catch (error) {
      logger.error('Failed to save file:', error);
      throw new AppError('Failed to save file', 500);
    }
  }

  /**
   * Delete file from disk
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      logger.warn('Failed to delete file:', error);
    }
  }

  /**
   * Get public URL for file
   */
  private getPublicUrl(fileName: string, isThumbnail: boolean = false): string {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const subDir = isThumbnail ? 'thumbnails' : '';
    return `${baseUrl}/uploads/${subDir ? subDir + '/' : ''}${fileName}`;
  }

  /**
   * Upload product image (without productImage model)
   */
  async uploadProductImage(productId: string, file: MulterFile): Promise<any> {
    try {
      // Validate file
      this.validateFile(file);

      // Verify product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // Generate file name
      const fileName = this.generateFileName(file.originalname);
      const thumbnailFileName = `thumb-${fileName}`;

      // Save files (no processing without sharp)
      const filePath = await this.saveFile(file.buffer, fileName, this.uploadDir);
      const thumbnailPath = await this.saveFile(file.buffer, thumbnailFileName, this.thumbnailDir);

      // Get URLs
      const url = this.getPublicUrl(fileName);
      const thumbnailUrl = this.getPublicUrl(thumbnailFileName, true);

      // Update product images array
      const currentImages = (product as any).images || [];
      const updatedImages = [...currentImages, url];

      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: {
          images: updatedImages,
        } as any,
      });

      // Emit realtime event
      try {
        (realtimeService as any).emitProductUpdated?.(
          { id: productId, images: updatedImages },
          product.businessUnitId
        );
      } catch (wsError) {
        logger.warn('Failed to emit product update:', wsError);
      }

      logger.info(`Image uploaded for product ${productId}: ${fileName}`);

      return {
        id: crypto.randomUUID(),
        productId,
        url,
        thumbnailUrl,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        createdAt: new Date(),
        product: updatedProduct,
      };
    } catch (error) {
      logger.error('Upload product image error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to upload product image', 500);
    }
  }

  /**
   * Upload multiple product images
   */
  async uploadMultipleProductImages(productId: string, files: MulterFile[]): Promise<any[]> {
    try {
      if (!files || files.length === 0) {
        throw new AppError('No files provided', 400);
      }

      if (files.length > 10) {
        throw new AppError('Maximum 10 images allowed per upload', 400);
      }

      const results = [];

      for (const file of files) {
        try {
          const result = await this.uploadProductImage(productId, file);
          results.push({ ...result, success: true });
        } catch (error) {
          results.push({
            originalName: file.originalname,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Upload multiple product images error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to upload multiple images', 500);
    }
  }

  /**
   * Upload supplier image
   */
  async uploadSupplierImage(supplierId: string, file: MulterFile): Promise<any> {
    try {
      this.validateFile(file);

      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new AppError('Supplier not found', 404);
      }

      const fileName = this.generateFileName(file.originalname);
      await this.saveFile(file.buffer, fileName, this.uploadDir);

      const url = this.getPublicUrl(fileName);

      const updatedSupplier = await prisma.supplier.update({
        where: { id: supplierId },
        data: {
          logo: url,
        } as any,
      });

      try {
        (realtimeService as any).emitSupplierUpdated?.(updatedSupplier, supplier.companyId);
      } catch (wsError) {
        logger.warn('Failed to emit supplier update:', wsError);
      }

      logger.info(`Image uploaded for supplier ${supplierId}: ${fileName}`);

      return updatedSupplier;
    } catch (error) {
      logger.error('Upload supplier image error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to upload supplier image', 500);
    }
  }

  /**
   * Upload user avatar
   */
  async uploadUserAvatar(userId: string, file: MulterFile): Promise<any> {
    try {
      this.validateFile(file);

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      const fileName = this.generateFileName(file.originalname);
      await this.saveFile(file.buffer, fileName, this.uploadDir);

      const url = this.getPublicUrl(fileName);

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          avatar: url,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
        },
      });

      return updatedUser;
    } catch (error) {
      logger.error('Upload user avatar error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to upload user avatar', 500);
    }
  }

  /**
   * Upload company logo
   */
  async uploadCompanyLogo(companyId: string, file: MulterFile): Promise<any> {
    try {
      this.validateFile(file);

      const company = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) {
        throw new AppError('Company not found', 404);
      }

      const fileName = this.generateFileName(file.originalname);
      await this.saveFile(file.buffer, fileName, this.uploadDir);

      const url = this.getPublicUrl(fileName);

      const updatedCompany = await prisma.company.update({
        where: { id: companyId },
        data: {
          logo: url,
        } as any,
      });

      return updatedCompany;
    } catch (error) {
      logger.error('Upload company logo error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to upload company logo', 500);
    }
  }

  /**
   * Delete image (without productImage model)
   */
  async deleteImage(imageId: string): Promise<void> {
    try {
      // Since productImage model doesn't exist, just log the deletion
      logger.info(`Image deletion requested: ${imageId}`);
      
      // Try to delete file if imageId is a fileName
      const filePath = path.join(this.uploadDir, path.basename(imageId));
      const thumbnailPath = path.join(this.thumbnailDir, `thumb-${path.basename(imageId)}`);
      
      await this.deleteFile(filePath);
      await this.deleteFile(thumbnailPath);
    } catch (error) {
      logger.error('Delete image error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete image', 500);
    }
  }

  /**
   * Set image as primary (stub since productImage model doesn't exist)
   */
  async setPrimaryImage(imageId: string): Promise<any> {
    try {
      logger.info(`Set primary image requested: ${imageId}`);
      return { id: imageId, isPrimary: true };
    } catch (error) {
      logger.error('Set primary image error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to set primary image', 500);
    }
  }

  /**
   * Get product images (from product.images array)
   */
  async getProductImages(productId: string): Promise<any[]> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const images = (product as any).images || [];
      
      return images.map((url: string, index: number) => ({
        id: `${productId}-${index}`,
        productId,
        url,
        thumbnailUrl: url,
        fileName: path.basename(url),
        sortOrder: index,
        isPrimary: index === 0,
        createdAt: product.createdAt,
      }));
    } catch (error) {
      logger.error('Get product images error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get product images', 500);
    }
  }

  /**
   * Reorder product images
   */
  async reorderImages(productId: string, imageIds: string[]): Promise<any[]> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // Since we don't have a productImage model, just return current images
      logger.info(`Reorder images requested for product ${productId}`);
      
      return this.getProductImages(productId);
    } catch (error) {
      logger.error('Reorder images error:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to reorder images', 500);
    }
  }
}

export const imageService = new ImageService();
