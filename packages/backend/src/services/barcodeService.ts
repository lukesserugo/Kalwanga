// D:\Projects\Kalwanga\packages\backend\src\services\barcodeService.ts

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import * as crypto from 'crypto';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface GenerateBarcodeOptions {
  prefix?: string;
  length?: number;
  productName?: string;
  sku?: string;
  format?: 'EAN-13' | 'UPC-A' | 'CODE128' | 'QR';
  includeQR?: boolean;
}

interface BarcodeInfo {
  barcode: string;
  barcodeUrl: string;
  qrCodeUrl: string;
  productId?: string;
  productName?: string;
  sku?: string;
  price?: number;
  format?: string;
  generatedAt?: string;
}

interface QRCodeData {
  product?: string;
  sku?: string;
  barcode?: string;
  price?: number;
  [key: string]: any;
}

interface ProductWithRelations {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unitPrice: number;
  description: string | null;
  category: any | null;
  businessUnit: any;
  supplier: any | null;
  inventory: any | null;
  variants: any[];
  [key: string]: any;
}

// ============================================
// BARCODE SERVICE
// ============================================

export class BarcodeService {
  /**
   * Get product barcode - returns existing or generates new
   */
  async getProductBarcode(productId: string): Promise<{ barcode: string; productId: string; generatedAt: Date }> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, barcode: true, sku: true, name: true, unitPrice: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      let barcode = product.barcode;
      
      // Generate barcode if not exists
      if (!barcode) {
        barcode = this.generateEAN13();
        await prisma.product.update({
          where: { id: productId },
          data: { barcode },
        });
      }

      return {
        barcode,
        productId: product.id,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Get product barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get product barcode', 500);
    }
  }

  /**
   * Generate unique barcode with options
   */
  async generateUniqueBarcode(options?: GenerateBarcodeOptions): Promise<{ barcode: string }> {
    try {
      const prefix = options?.prefix || 'PRD';
      const length = options?.length || 12;
      let barcode = '';
      let attempts = 0;
      const maxAttempts = 100;

      do {
        // Generate random numeric barcode
        const randomPart = Math.floor(Math.random() * Math.pow(10, length - prefix.length - 1))
          .toString()
          .padStart(length - prefix.length - 1, '0');
        
        // Add check digit
        const base = prefix + randomPart;
        let sum = 0;
        for (let i = 0; i < base.length; i++) {
          sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        barcode = base + checkDigit;

        attempts++;
        
        // Check if barcode already exists
        const existing = await prisma.product.findFirst({
          where: { barcode },
          select: { id: true },
        });

        if (!existing) {
          break;
        }

        if (attempts >= maxAttempts) {
          throw new AppError('Could not generate unique barcode after maximum attempts', 500);
        }
      } while (true);

      return { barcode };
    } catch (error) {
      console.error('Generate unique barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate unique barcode', 500);
    }
  }

  /**
   * Generate barcode image from barcode string
   */
  async generateBarcodeImage(barcode: string, format?: 'EAN-13' | 'UPC-A' | 'CODE128'): Promise<{ barcodeUrl: string }> {
    try {
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      // Use external barcode API
      const codeFormat = format || 'EAN13';
      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=${codeFormat}&dpi=96&datatype=Content`;
      
      return { barcodeUrl };
    } catch (error) {
      console.error('Generate barcode image error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate barcode image', 500);
    }
  }

  /**
   * Generate QR code from data
   */
  async generateQRCode(data: QRCodeData): Promise<{ qrCodeUrl: string; qrData: QRCodeData }> {
    try {
      if (!data) {
        throw new AppError('Data is required for QR code generation', 400);
      }

      const qrData = {
        type: 'PRODUCT',
        ...data,
        timestamp: new Date().toISOString(),
      };

      // Use external QR code API
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      return {
        qrCodeUrl,
        qrData,
      };
    } catch (error) {
      console.error('Generate QR code error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate QR code', 500);
    }
  }

  /**
   * Validate barcode uniqueness
   */
  async validateBarcode(barcode: string, excludeProductId?: string): Promise<{ valid: boolean; message?: string }> {
    try {
      if (!barcode) {
        return { valid: false, message: 'Barcode is required' };
      }

      // Check format - EAN-13 should be 13 digits
      if (!/^\d{13}$/.test(barcode)) {
        return { valid: false, message: 'Invalid barcode format. Must be 13 digits.' };
      }

      // Validate checksum
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      if (checkDigit !== parseInt(barcode[12])) {
        return { valid: false, message: 'Invalid barcode checksum' };
      }

      // Check if barcode already exists
      const where: any = { barcode };
      if (excludeProductId) {
        where.id = { not: excludeProductId };
      }

      const existing = await prisma.product.findFirst({
        where,
        select: { id: true, name: true },
      });

      if (existing) {
        return { 
          valid: false, 
          message: `Barcode is already assigned to product "${existing.name}"` 
        };
      }

      return { valid: true, message: 'Barcode is available' };
    } catch (error) {
      console.error('Validate barcode error:', error);
      return { valid: false, message: 'Failed to validate barcode' };
    }
  }

  /**
   * Associate barcode with a product
   */
  async associateBarcode(productId: string, barcode: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // Check if barcode is already assigned to another product
      const existing = await prisma.product.findFirst({
        where: {
          barcode,
          id: { not: productId },
        },
        select: { id: true, name: true },
      });

      if (existing) {
        throw new AppError(`Barcode is already assigned to product "${existing.name}"`, 409);
      }

      // Update product with barcode
      await prisma.product.update({
        where: { id: productId },
        data: { barcode },
      });

      return { 
        success: true, 
        message: `Barcode "${barcode}" associated with product "${product.name}"` 
      };
    } catch (error) {
      console.error('Associate barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to associate barcode', 500);
    }
  }

  /**
   * Generate product QR code
   */
  async generateProductQRCode(productId: string): Promise<{ qrCodeUrl: string; qrData: any; generatedAt: Date }> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          sku: true,
          name: true,
          unitPrice: true,
          barcode: true,
          description: true,
        },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      // Get or generate barcode
      let barcode = product.barcode;
      if (!barcode) {
        barcode = this.generateEAN13();
        await prisma.product.update({
          where: { id: productId },
          data: { barcode },
        });
      }

      const qrData = {
        type: 'PRODUCT',
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.unitPrice,
        barcode: barcode,
        description: product.description || '',
        timestamp: new Date().toISOString(),
      };

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      return {
        qrCodeUrl,
        qrData,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Generate product QR code error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate QR code', 500);
    }
  }

  /**
   * Generate receipt QR code
   */
  async generateReceiptQRCode(receiptNumber: string): Promise<{ qrCodeUrl: string; qrData: any; generatedAt: Date }> {
    try {
      const receipt = await prisma.receipt.findUnique({
        where: { receiptNumber },
        select: {
          id: true,
          receiptNumber: true,
          createdAt: true,
          saleId: true,
          total: true,
        },
      });

      if (!receipt) {
        throw new AppError('Receipt not found', 404);
      }

      const qrData = {
        type: 'RECEIPT',
        receiptNumber: receipt.receiptNumber,
        receiptId: receipt.id,
        saleId: receipt.saleId,
        total: receipt.total || 0,
        timestamp: receipt.createdAt || new Date(),
        verificationUrl: `${process.env.APP_URL || 'http://localhost:3000'}/verify/${receipt.receiptNumber}`,
      };

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      return {
        qrCodeUrl,
        qrData,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Generate receipt QR code error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate receipt QR code', 500);
    }
  }

  /**
   * Generate barcode for a product
   */
  async generateBarcode(productId: string, type: string = 'EAN13'): Promise<{ barcode: string; productId: string }> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, barcode: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      let barcode = product.barcode;
      if (!barcode) {
        barcode = this.generateEAN13();
        await prisma.product.update({
          where: { id: productId },
          data: { barcode },
        });
      }

      return {
        barcode,
        productId: product.id,
      };
    } catch (error) {
      console.error('Generate barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate barcode', 500);
    }
  }

  /**
   * Generate SVG barcode
   */
  async generateSVGBarcode(productId: string): Promise<string> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { barcode: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      let barcode = product.barcode;
      if (!barcode) {
        barcode = this.generateEAN13();
        await prisma.product.update({
          where: { id: productId },
          data: { barcode },
        });
      }

      return this.renderSVGBarcode(barcode);
    } catch (error) {
      console.error('Generate SVG barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate SVG barcode', 500);
    }
  }

  /**
   * Render SVG barcode
   */
  private renderSVGBarcode(barcode: string): string {
    const bars: string[] = [];
    const barWidth = 2;
    const barHeight = 100;
    let x = 0;

    // Simple EAN-13 barcode rendering
    for (const char of barcode) {
      const code = char.charCodeAt(0);
      for (let i = 0; i < 7; i++) {
        const isBar = (code >> i) & 1;
        if (isBar) {
          bars.push(`<rect x="${x}" y="0" width="${barWidth}" height="${barHeight}" fill="black"/>`);
        }
        x += barWidth;
      }
      x += barWidth;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${x + 40}" height="${barHeight + 40}" viewBox="-20 -10 ${x + 40} ${barHeight + 50}">
        ${bars.join('')}
        <text x="${x / 2}" y="${barHeight + 25}" text-anchor="middle" font-family="monospace" font-size="14" font-weight="bold">${barcode}</text>
      </svg>
    `;
  }

  /**
   * Generate EAN-13 barcode
   */
  private generateEAN13(): string {
    let barcode = '2';
    for (let i = 0; i < 11; i++) {
      barcode += Math.floor(Math.random() * 10);
    }
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return barcode + checkDigit;
  }

  /**
   * Validate EAN-13 barcode
   */
  validateBarcodeFormat(barcode: string): boolean {
    if (!/^\d{13}$/.test(barcode)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return checkDigit === parseInt(barcode[12]);
  }

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode: string): Promise<any> {
    try {
      if (!this.validateBarcodeFormat(barcode)) {
        throw new AppError('Invalid barcode format', 400);
      }

      const product = await prisma.product.findFirst({
        where: { barcode },
        include: {
          category: true,
          businessUnit: true,
          supplier: true,
          inventory: true,
          variants: {
            where: { isActive: true },
          },
        },
      });

      if (!product) {
        throw new AppError('Product not found for this barcode', 404);
      }

      return product;
    } catch (error) {
      console.error('Get product by barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to retrieve product by barcode', 500);
    }
  }

  /**
   * Get product barcode info (full details)
   */
  async getProductBarcodeInfo(productId: string): Promise<BarcodeInfo> {
    try {
      const product = await prisma.product.findUnique({
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

      let barcode = product.barcode;
      if (!barcode) {
        barcode = this.generateEAN13();
        await prisma.product.update({
          where: { id: productId },
          data: { barcode },
        });
      }

      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=EAN13&dpi=96&datatype=Content`;
      const qrData = {
        type: 'PRODUCT',
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.unitPrice,
        barcode: barcode,
        timestamp: new Date().toISOString(),
      };
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      return {
        barcode,
        barcodeUrl,
        qrCodeUrl,
        productId: product.id,
        productName: product.name,
        sku: product.sku || '',
        price: product.unitPrice,
        format: 'EAN-13',
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Get product barcode info error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get product barcode info', 500);
    }
  }

  /**
   * Generate barcode for variant
   */
  async generateVariantBarcode(variantId: string): Promise<{ barcode: string; variantId: string }> {
    try {
      const variant = await prisma.productVariant.findUnique({
        where: { id: variantId },
        select: { id: true, barcode: true },
      });

      if (!variant) {
        throw new AppError('Variant not found', 404);
      }

      let barcode = variant.barcode;
      if (!barcode) {
        barcode = this.generateEAN13();
        await prisma.productVariant.update({
          where: { id: variantId },
          data: { barcode },
        });
      }

      return {
        barcode,
        variantId: variant.id,
      };
    } catch (error) {
      console.error('Generate variant barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate variant barcode', 500);
    }
  }

  /**
   * Bulk generate barcodes for products without barcodes
   */
  async bulkGenerateBarcodes(): Promise<{ generated: number; failed: number }> {
    try {
      const productsWithoutBarcodes = await prisma.product.findMany({
        where: {
          OR: [
            { barcode: null },
            { barcode: '' },
          ],
        },
        select: { id: true },
      });

      let generated = 0;
      let failed = 0;

      for (const product of productsWithoutBarcodes) {
        try {
          const barcode = this.generateEAN13();
          await prisma.product.update({
            where: { id: product.id },
            data: { barcode },
          });
          generated++;
        } catch (error) {
          console.error(`Failed to generate barcode for product ${product.id}:`, error);
          failed++;
        }
      }

      return { generated, failed };
    } catch (error) {
      console.error('Bulk generate barcodes error:', error);
      throw new AppError('Failed to bulk generate barcodes', 500);
    }
  }

  /**
   * Scan barcode and return product info
   */
  async scanBarcode(barcode: string, businessUnitId?: string): Promise<{
    product: any;
    inventory?: { quantity: number; reserved: number; available: number };
    barcodeInfo: { barcode: string; barcodeUrl: string; qrCodeUrl: string };
    variant?: any;
  }> {
    try {
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      // Try to find product by barcode
      let product = await prisma.product.findFirst({
        where: { 
          barcode,
          ...(businessUnitId ? { businessUnitId } : {}),
        },
        include: {
          inventory: true,
          variants: {
            where: { isActive: true },
          },
          category: true,
          businessUnit: true,
        },
      });

      // If not found, try to find variant by barcode
      let variant = null;
      let productFromVariant = null;

      if (!product) {
        variant = await prisma.productVariant.findFirst({
          where: { 
            barcode,
            ...(businessUnitId ? { product: { businessUnitId } } : {}),
          },
          include: {
            product: {
              include: {
                inventory: true,
                category: true,
                businessUnit: true,
              },
            },
          },
        });

        if (variant) {
          // Use type assertion to handle the variant product
          productFromVariant = variant.product as any;
          product = productFromVariant;
        }
      }

      if (!product) {
        throw new AppError('Product not found for this barcode', 404);
      }

      // Get inventory info using the correct field names
      let inventory = null;
      if (product.inventory) {
        // If product has inventory directly
        inventory = product.inventory;
      } else {
        // Try to find inventory by productId
        inventory = await prisma.inventory.findFirst({
          where: {
            productId: product.id,
            ...(businessUnitId ? { businessUnitId } : {}),
          },
          select: {
            quantity: true,
            reserved: true,
          },
        });
      }

      // Generate barcode image URL
      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=EAN13&dpi=96&datatype=Content`;
      const qrData = {
        type: 'PRODUCT',
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.unitPrice,
        barcode: barcode,
        timestamp: new Date().toISOString(),
      };
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      return {
        product,
        inventory: inventory ? {
          quantity: inventory.quantity || 0,
          reserved: inventory.reserved || 0,
          available: (inventory.quantity || 0) - (inventory.reserved || 0),
        } : undefined,
        barcodeInfo: {
          barcode,
          barcodeUrl,
          qrCodeUrl,
        },
        variant: variant || undefined,
      };
    } catch (error) {
      console.error('Scan barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to scan barcode', 500);
    }
  }

  /**
   * Generate barcode image for product (overload for productId)
   */
  async generateBarcodeImageForProduct(productId: string): Promise<{ barcodeUrl: string; barcode: string; generatedAt: Date }> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, barcode: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      let barcode = product.barcode;
      if (!barcode) {
        barcode = this.generateEAN13();
        await prisma.product.update({
          where: { id: productId },
          data: { barcode },
        });
      }

      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(barcode)}&code=EAN13&dpi=96&datatype=Content`;

      return {
        barcodeUrl,
        barcode,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Generate barcode image for product error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate barcode image', 500);
    }
  }
}

export const barcodeService = new BarcodeService();
