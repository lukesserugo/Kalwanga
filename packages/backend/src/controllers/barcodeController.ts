// D:\Projects\Kalwanga\packages\backend\src\controllers\barcodeController.ts

import { Request, Response, NextFunction } from 'express';
import { barcodeService } from '../services/barcodeService.js';
import { AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

// ============================================
// VALIDATION SCHEMAS
// ============================================

const generateBarcodeSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  type: z.enum(['EAN13', 'CODE128', 'QR']).optional().default('EAN13'),
});

const generateUniqueBarcodeSchema = z.object({
  prefix: z.string().optional().default('PRD'),
  length: z.number().min(4).max(20).optional().default(12),
  productName: z.string().optional(),
  sku: z.string().optional(),
  format: z.enum(['EAN-13', 'UPC-A', 'CODE128', 'QR']).optional().default('EAN-13'),
  includeQR: z.boolean().optional().default(false),
});

const validateBarcodeSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
  excludeProductId: z.string().optional(),
});

const associateBarcodeSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  barcode: z.string().min(1, 'Barcode is required'),
});

const generateBarcodeImageSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
  format: z.enum(['EAN-13', 'UPC-A', 'CODE128']).optional(),
});

const generateQRCodeSchema = z.object({
  data: z.record(z.string(), z.any()),
});

const scanBarcodeSchema = z.object({
  barcode: z.string().min(1, 'Barcode is required'),
  businessUnitId: z.string().optional(),
});

// ============================================
// CONTROLLER
// ============================================

export const barcodeController = {
  /**
   * Get product barcode
   * GET /barcodes/product/:productId
   */
  async getProductBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      if (!productId) throw new AppError('Product ID is required', 400);
      
      const result = await barcodeService.getProductBarcode(productId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get product barcode info (full details with images)
   * GET /barcodes/product/:productId/info
   */
  async getProductBarcodeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      if (!productId) throw new AppError('Product ID is required', 400);
      
      const result = await barcodeService.getProductBarcodeInfo(productId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get product QR code
   * GET /barcodes/product/:productId/qr
   */
  async getProductQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      if (!productId) throw new AppError('Product ID is required', 400);
      
      const result = await barcodeService.generateProductQRCode(productId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get barcode image
   * GET /barcodes/product/:productId/image
   */
  async getBarcodeImage(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      if (!productId) throw new AppError('Product ID is required', 400);
      
      const result = await barcodeService.generateBarcodeImage(productId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate barcode image from barcode string
   * POST /barcodes/image
   */
  async generateBarcodeImageFromString(req: Request, res: Response, next: NextFunction) {
    try {
      const data = generateBarcodeImageSchema.parse(req.body);
      
      const result = await barcodeService.generateBarcodeImage(data.barcode, data.format);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Generate QR code from data
   * POST /barcodes/qr
   */
  async generateQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const data = generateQRCodeSchema.parse(req.body);
      
      const result = await barcodeService.generateQRCode(data.data);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Generate unique barcode
   * POST /barcodes/generate-unique
   */
  async generateUniqueBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const options = generateUniqueBarcodeSchema.parse(req.body);
      
      const result = await barcodeService.generateUniqueBarcode(options);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Unique barcode generated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Validate barcode
   * POST /barcodes/validate
   */
  async validateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const data = validateBarcodeSchema.parse(req.body);
      
      const result = await barcodeService.validateBarcode(data.barcode, data.excludeProductId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Validate barcode format (GET version)
   * GET /barcodes/validate/:barcode
   */
  async validateBarcodeFormat(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode } = req.params;
      if (!barcode) throw new AppError('Barcode is required', 400);
      
      const isValid = barcodeService.validateBarcodeFormat(barcode);
      
      res.json({
        success: true,
        data: {
          barcode,
          isValid,
          format: 'EAN-13',
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Associate barcode with product
   * POST /barcodes/associate
   */
  async associateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const data = associateBarcodeSchema.parse(req.body);
      
      const result = await barcodeService.associateBarcode(data.productId, data.barcode);
      
      res.json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get SVG barcode
   * GET /barcodes/product/:productId/svg
   */
  async getSVGBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      if (!productId) throw new AppError('Product ID is required', 400);
      
      const svg = await barcodeService.generateSVGBarcode(productId);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(svg);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get receipt QR code
   * GET /barcodes/receipt/:receiptNumber/qr
   */
  async getReceiptQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { receiptNumber } = req.params;
      if (!receiptNumber) throw new AppError('Receipt number is required', 400);
      
      const result = await barcodeService.generateReceiptQRCode(receiptNumber);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate barcode for product
   * POST /barcodes/generate
   */
  async generateBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const data = generateBarcodeSchema.parse(req.body);
      
      const result = await barcodeService.generateBarcode(data.productId, data.type);
      
      res.status(201).json({
        success: true,
        data: result,
        message: 'Barcode generated successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Get product by barcode
   * GET /barcodes/lookup/:barcode
   */
  async getProductByBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode } = req.params;
      if (!barcode) throw new AppError('Barcode is required', 400);
      
      const product = await barcodeService.getProductByBarcode(barcode);
      
      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Scan barcode
   * POST /barcodes/scan
   */
  async scanBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const data = scanBarcodeSchema.parse(req.body);
      
      const result = await barcodeService.scanBarcode(data.barcode, data.businessUnitId);
      
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors.map((e: z.ZodIssue) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  },

  /**
   * Bulk generate barcodes
   * POST /barcodes/bulk-generate
   */
  async bulkGenerateBarcodes(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await barcodeService.bulkGenerateBarcodes();
      
      res.json({
        success: true,
        data: result,
        message: `Generated ${result.generated} barcodes, ${result.failed} failed`,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Generate barcode for variant
   * POST /barcodes/variant/:variantId
   */
  async generateVariantBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      if (!variantId) throw new AppError('Variant ID is required', 400);
      
      const result = await barcodeService.generateVariantBarcode(variantId);
      
      res.json({
        success: true,
        data: result,
        message: 'Variant barcode generated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get variant barcode info
   * GET /barcodes/variant/:variantId/info
   */
  async getVariantBarcodeInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId } = req.params;
      if (!variantId) throw new AppError('Variant ID is required', 400);
      
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          price: true,
          productId: true,
          product: {
            select: {
              id: true,
              name: true,
              businessUnitId: true,
            },
          },
        },
      });

      if (!variant) {
        throw new AppError('Variant not found', 404);
      }

      let barcode = variant.barcode;
      if (!barcode) {
        const generated = await barcodeService.generateUniqueBarcode({
          productName: variant.name,
          sku: variant.sku,
        });
        barcode = generated.barcode;
        
        await prisma.productVariant.update({
          where: { id: variantId },
          data: { barcode },
        });
      }

      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=EAN13&dpi=96&datatype=Content`;
      const qrData = {
        type: 'VARIANT',
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        price: variant.price,
        barcode: barcode,
        productName: variant.product?.name || '',
        productId: variant.productId,
        timestamp: new Date().toISOString(),
      };
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      // ✅ FIX: Get user ID with proper type handling
      const user = (req as any).user;
      const userId: string | null = user?.id || null;

      // 🔥 FIXED: Use 'CUSTOM' type for variant QR codes since 'VARIANT' is not allowed
      // Also handle the case where QRCodeRecord might not exist in the Prisma schema
      try {
        // Save QR code record to database - use 'CUSTOM' type for variants
        await prisma.qRCodeRecord.create({
          data: {
            code: `QR-${variantId}-${Date.now()}`,
            data: JSON.stringify(qrData),
            type: 'CUSTOM', // 'VARIANT' is not allowed, use 'CUSTOM'
            imageUrl: qrCodeUrl,
            isActive: true,
            variantId: variant.id,
            productId: variant.productId,
            businessUnitId: variant.product?.businessUnitId || undefined,
            createdBy: userId,
          },
        });
      } catch (qrError) {
        // If QRCodeRecord table doesn't exist, just log and continue
        console.warn('Could not save QR code record:', qrError);
      }

      // Save barcode image record
      try {
        await prisma.barcodeImageRecord.create({
          data: {
            code: barcode,
            barcode: barcode,
            format: 'EAN-13',
            data: barcode,
            imageUrl: barcodeUrl,
            isActive: true,
            variantId: variant.id,
            productId: variant.productId,
            businessUnitId: variant.product?.businessUnitId || undefined,
            createdBy: userId,
          },
        });
      } catch (barcodeError) {
        // If BarcodeImageRecord table doesn't exist, just log and continue
        console.warn('Could not save barcode image record:', barcodeError);
      }

      res.json({
        success: true,
        data: {
          barcode,
          barcodeUrl,
          qrCodeUrl,
          variantId: variant.id,
          variantName: variant.name,
          sku: variant.sku || '',
          price: variant.price,
          productName: variant.product?.name || '',
          productId: variant.productId,
          format: 'EAN-13',
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get QR code by code
   * GET /barcodes/qr/:code
   */
  async getQRCodeByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      if (!code) throw new AppError('QR code is required', 400);
      
      const qrCode = await prisma.qRCodeRecord.findUnique({
        where: { code },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unitPrice: true,
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
              price: true,
            },
          },
          sale: {
            select: {
              id: true,
              receiptNumber: true,
              total: true,
            },
          },
          receipt: {
            select: {
              id: true,
              receiptNumber: true,
            },
          },
        },
      });

      if (!qrCode) {
        throw new AppError('QR code not found', 404);
      }

      // Increment scan count
      await prisma.qRCodeRecord.update({
        where: { id: qrCode.id },
        data: {
          scans: { increment: 1 },
          lastScanned: new Date(),
        },
      });

      res.json({
        success: true,
        data: qrCode,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get barcode image by barcode
   * GET /barcodes/image/:barcode
   */
  async getBarcodeImageByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { barcode } = req.params;
      if (!barcode) throw new AppError('Barcode is required', 400);
      
      const barcodeImage = await prisma.barcodeImageRecord.findUnique({
        where: { code: barcode },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          variant: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      });

      if (!barcodeImage) {
        throw new AppError('Barcode image not found', 404);
      }

      // Increment scan count
      await prisma.barcodeImageRecord.update({
        where: { id: barcodeImage.id },
        data: {
          scans: { increment: 1 },
          lastScanned: new Date(),
        },
      });

      res.json({
        success: true,
        data: barcodeImage,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Deactivate QR code
   * PATCH /barcodes/qr/:code/deactivate
   */
  async deactivateQRCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      if (!code) throw new AppError('QR code is required', 400);
      
      const qrCode = await prisma.qRCodeRecord.update({
        where: { code },
        data: { isActive: false },
      });

      res.json({
        success: true,
        data: qrCode,
        message: 'QR code deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all QR codes for a product
   * GET /barcodes/product/:productId/qr-codes
   */
  async getProductQRCodes(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      if (!productId) throw new AppError('Product ID is required', 400);
      
      const qrCodes = await prisma.qRCodeRecord.findMany({
        where: { 
          productId,
          type: 'PRODUCT',
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: qrCodes,
        count: qrCodes.length,
      });
    } catch (error) {
      next(error);
    }
  },
};

export default barcodeController;
