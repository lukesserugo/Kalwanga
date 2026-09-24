// D:\Projects\Kalwanga\packages\backend\src\services\barcodeService.ts

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

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

/**
 * Normalized result of a read-only scan (`scanBarcode`).
 * Consumers (POS, checkout, inventory lookup) read from here.
 */
interface ScanResult {
  matchType: 'PRODUCT' | 'VARIANT';
  barcode: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unitPrice: number;
    barcode: string | null;
    businessUnitId: string;
    categoryId: string | null;
  };
  variant: {
    id: string;
    name: string;
    sku: string;
    price: number;
    barcode: string | null;
    attributes: unknown;
  } | null;
  inventory: {
    id: string;
    quantity: number;
    reserved: number;
    available: number;
    reorderPoint: number;
  } | null;
  images: {
    barcodeUrl: string;
    qrCodeUrl: string;
  };
}

/**
 * Input for the write-path scan (`recordScan`). This is what a POS
 * calls when a physical scanner fires during a sale — it decrements
 * inventory and writes an audit transaction atomically.
 */
interface RecordScanInput {
  barcode: string;
  businessUnitId: string;
  userId: string;
  /** Optional: when the scan belongs to a specific sale. */
  saleId?: string;
  /** How many units the operator scanned. Defaults to 1. */
  quantity?: number;
  /** Free-form note for the audit trail (only used when no idempotency key). */
  note?: string;
  /**
   * Caller-supplied idempotency key.
   *
   * When two transports (e.g. USB HID + BLE) fire the same physical
   * scan and drift past the dispatcher's 250 ms debounce, the two
   * requests would both hit the backend. With the key set, the second
   * request short-circuits with 409 instead of double-decrementing
   * stock.
   *
   * The backend writes the key into `InventoryTransaction.notes` as
   * `scan:<key>` and checks for an existing row before the
   * transaction begins.
   */
  scanIdempotencyKey?: string;
}

// ============================================
// BARCODE SERVICE
// ============================================

export class BarcodeService {
  private readonly appUrl: string;
  private readonly barcodeApiUrl: string;
  private readonly qrApiUrl: string;

  constructor() {
    this.appUrl = process.env.APP_URL || 'http://localhost:3000';
    this.barcodeApiUrl =
      process.env.BARCODE_API_URL ||
      'https://barcode.tec-it.com/barcode.ashx';
    this.qrApiUrl =
      process.env.QR_API_URL ||
      'https://api.qrserver.com/v1/create-qr-code';
  }

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================

  /**
   * Build the external barcode-image URL for a code. Single point of
   * truth so all endpoints emit an identical format — this is what
   * scanners re-read, so the parameters must not drift.
   */
  private buildBarcodeUrl(code: string, format = 'EAN13'): string {
    return `${this.barcodeApiUrl}?data=${encodeURIComponent(
      code,
    )}&code=${format}&dpi=96&datatype=Content`;
  }

  /**
   * Build the external QR-image URL for a payload object. Payload is
   * JSON-stringified then URL-encoded. The scanner parses the JSON on
   * read, so this shape must match what consumers expect.
   */
  private buildQrUrl(payload: Record<string, unknown>): string {
    return `${this.qrApiUrl}?size=300x300&data=${encodeURIComponent(
      JSON.stringify(payload),
    )}`;
  }

  /**
   * Normalize a raw scanned string. Strips whitespace, control
   * characters, and the artifacts USB HID scanners emit
   * (`\r`, `\n`, `\t`). Single sanitization point before any DB
   * lookup.
   */
  private normalizeScannedCode(raw: string): string {
    return raw
      .replace(/[\r\n\t]/g, '')
      .replace(/\s+/g, '')
      .trim();
  }

  // ==========================================
  // CORE: GET / GENERATE PRODUCT BARCODE
  // ==========================================

  async getProductBarcode(
    productId: string,
  ): Promise<{ barcode: string; productId: string; generatedAt: Date }> {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          barcode: true,
          sku: true,
          name: true,
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

  async generateUniqueBarcode(
    options?: GenerateBarcodeOptions,
  ): Promise<{ barcode: string }> {
    try {
      const prefix = String(options?.prefix ?? 'PRD').toUpperCase();
      const desiredLength = Number.isFinite(options?.length)
        ? Math.max(8, Math.min(20, Number(options?.length)))
        : 12;

      const digitsOnly = /^\d+$/.test(prefix);

      let barcode = '';
      let attempts = 0;
      const maxAttempts = 100;

      do {
        if (digitsOnly) {
          const bodyLength = Math.max(
            2,
            desiredLength - 1 - prefix.length,
          );
          const randomPart = Math.floor(
            Math.random() * Math.pow(10, bodyLength),
          )
            .toString()
            .padStart(bodyLength, '0');

          const base = prefix + randomPart;
          let sum = 0;
          for (let i = 0; i < base.length; i++) {
            const digit = Number(base[i]);
            if (!Number.isFinite(digit)) {
              throw new AppError(
                'Internal barcode generation error: non-numeric character in numeric path',
                500,
              );
            }
            sum += digit * (i % 2 === 0 ? 1 : 3);
          }
          const checkDigit = (10 - (sum % 10)) % 10;
          barcode = `${base}${checkDigit}`;
        } else {
          const tsPart = Date.now().toString(36).toUpperCase();
          const randPart = Math.random()
            .toString(36)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
          const body = `${tsPart}${randPart}`.slice(
            0,
            Math.max(4, desiredLength - prefix.length),
          );
          barcode = `${prefix}${body}`;
        }

        if (/nan|undefined|null/i.test(barcode)) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new AppError(
              'Barcode generation produced an invalid value after maximum attempts',
              500,
            );
          }
          continue;
        }

        attempts++;

        const existing = await prisma.product.findFirst({
          where: { barcode },
          select: { id: true },
        });

        if (!existing) {
          break;
        }

        if (attempts >= maxAttempts) {
          throw new AppError(
            'Could not generate unique barcode after maximum attempts',
            500,
          );
        }
      } while (true);

      return { barcode };
    } catch (error) {
      console.error('Generate unique barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate unique barcode', 500);
    }
  }

  async generateBarcodeImage(
    barcode: string,
    format?: 'EAN-13' | 'UPC-A' | 'CODE128',
  ): Promise<{ barcodeUrl: string }> {
    try {
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      const codeFormat = format || 'EAN13';
      return { barcodeUrl: this.buildBarcodeUrl(barcode, codeFormat) };
    } catch (error) {
      console.error('Generate barcode image error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate barcode image', 500);
    }
  }

  async generateQRCode(
    data: QRCodeData,
  ): Promise<{ qrCodeUrl: string; qrData: QRCodeData }> {
    try {
      if (!data) {
        throw new AppError(
          'Data is required for QR code generation',
          400,
        );
      }

      const qrData: QRCodeData = {
        type: 'PRODUCT',
        ...data,
        timestamp: new Date().toISOString(),
      };

      return {
        qrCodeUrl: this.buildQrUrl(qrData),
        qrData,
      };
    } catch (error) {
      console.error('Generate QR code error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate QR code', 500);
    }
  }

  // ==========================================
  // CORE: VALIDATE
  // ==========================================

  async validateBarcode(
    barcode: string,
    excludeProductId?: string,
  ): Promise<{ valid: boolean; message?: string }> {
    try {
      if (!barcode) {
        return { valid: false, message: 'Barcode is required' };
      }

      if (!/^\d{13}$/.test(barcode)) {
        return {
          valid: false,
          message: 'Invalid barcode format. Must be 13 digits.',
        };
      }

      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(barcode[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      if (checkDigit !== parseInt(barcode[12])) {
        return { valid: false, message: 'Invalid barcode checksum' };
      }

      const where: Record<string, unknown> = { barcode };
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
          message: `Barcode is already assigned to product "${existing.name}"`,
        };
      }

      return { valid: true, message: 'Barcode is available' };
    } catch (error) {
      console.error('Validate barcode error:', error);
      return { valid: false, message: 'Failed to validate barcode' };
    }
  }

  // ==========================================
  // CORE: ASSOCIATE
  // ==========================================

  async associateBarcode(
    productId: string,
    barcode: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!productId) {
        throw new AppError('Product ID is required', 400);
      }
      if (!barcode) {
        throw new AppError('Barcode is required', 400);
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true },
      });

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const existing = await prisma.product.findFirst({
        where: {
          barcode,
          id: { not: productId },
        },
        select: { id: true, name: true },
      });

      if (existing) {
        throw new AppError(
          `Barcode is already assigned to product "${existing.name}"`,
          409,
        );
      }

      await prisma.product.update({
        where: { id: productId },
        data: { barcode },
      });

      return {
        success: true,
        message: `Barcode "${barcode}" associated with product "${product.name}"`,
      };
    } catch (error) {
      console.error('Associate barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to associate barcode', 500);
    }
  }

  // ==========================================
  // CORE: QR GENERATION FOR PRODUCT / RECEIPT
  // ==========================================

  async generateProductQRCode(productId: string): Promise<{
    qrCodeUrl: string;
    qrData: Record<string, unknown>;
    generatedAt: Date;
  }> {
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
        barcode,
        description: product.description || '',
        timestamp: new Date().toISOString(),
      };

      return {
        qrCodeUrl: this.buildQrUrl(qrData),
        qrData,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Generate product QR code error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate QR code', 500);
    }
  }

  async generateReceiptQRCode(receiptNumber: string): Promise<{
    qrCodeUrl: string;
    qrData: Record<string, unknown>;
    generatedAt: Date;
  }> {
    try {
      const receipt = await prisma.receipt.findUnique({
        where: { receiptNumber },
        select: {
          id: true,
          receiptNumber: true,
          createdAt: true,
          saleId: true,
        },
      });

      if (!receipt) {
        throw new AppError('Receipt not found', 404);
      }

      // Receipt has no `total` column in the schema — pull it from
      // the linked Sale instead.
      let total = 0;
      if (receipt.saleId) {
        const sale = await prisma.sale.findUnique({
          where: { id: receipt.saleId },
          select: { total: true },
        });
        total = sale?.total ?? 0;
      }

      const qrData = {
        type: 'RECEIPT',
        receiptNumber: receipt.receiptNumber,
        receiptId: receipt.id,
        saleId: receipt.saleId,
        total,
        timestamp: receipt.createdAt ?? new Date(),
        verificationUrl: `${this.appUrl}/verify/${receipt.receiptNumber}`,
      };

      return {
        qrCodeUrl: this.buildQrUrl(qrData),
        qrData,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error('Generate receipt QR code error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate receipt QR code', 500);
    }
  }

  // ==========================================
  // CORE: GENERATE (SIMPLE)
  // ==========================================

  async generateBarcode(
    productId: string,
    _type: string = 'EAN13',
  ): Promise<{ barcode: string; productId: string }> {
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

      return { barcode, productId: product.id };
    } catch (error) {
      console.error('Generate barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate barcode', 500);
    }
  }

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

  private renderSVGBarcode(barcode: string): string {
    const bars: string[] = [];
    const barWidth = 2;
    const barHeight = 100;
    let x = 0;

    for (const char of barcode) {
      const code = char.charCodeAt(0);
      for (let i = 0; i < 7; i++) {
        const isBar = (code >> i) & 1;
        if (isBar) {
          bars.push(
            `<rect x="${x}" y="0" width="${barWidth}" height="${barHeight}" fill="black"/>`,
          );
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

  // ==========================================
  // CORE: EAN-13 PRIMITIVES
  // ==========================================

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

  // ==========================================
  // CORE: LOOKUP BY BARCODE
  // ==========================================

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
          variants: { where: { isActive: true } },
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

  // ==========================================
  // CORE: PRODUCT BARCODE INFO
  // ==========================================

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

      const barcodeUrl = this.buildBarcodeUrl(barcode, 'EAN13');
      const qrData = {
        type: 'PRODUCT',
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.unitPrice,
        barcode,
        timestamp: new Date().toISOString(),
      };
      const qrCodeUrl = this.buildQrUrl(qrData);

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

  // ==========================================
  // CORE: VARIANT BARCODE
  // ==========================================

  async generateVariantBarcode(
    variantId: string,
  ): Promise<{ barcode: string; variantId: string }> {
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

      return { barcode, variantId: variant.id };
    } catch (error) {
      console.error('Generate variant barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate variant barcode', 500);
    }
  }

  // ==========================================
  // CORE: BULK GENERATION
  // ==========================================

  async bulkGenerateBarcodes(): Promise<{
    generated: number;
    failed: number;
  }> {
    try {
      const productsWithoutBarcodes = await prisma.product.findMany({
        where: {
          OR: [{ barcode: null }, { barcode: '' }],
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
          console.error(
            `Failed to generate barcode for product ${product.id}:`,
            error,
          );
          failed++;
        }
      }

      return { generated, failed };
    } catch (error) {
      console.error('Bulk generate barcodes error:', error);
      throw new AppError('Failed to bulk generate barcodes', 500);
    }
  }

  // ==========================================
  // CORE: SCAN (READ-ONLY LOOKUP)
  //
  // Resolves a scanned code to product/variant + inventory, and
  // bumps the scan counters on any matching BarcodeImageRecord /
  // QRCodeRecord. Does NOT mutate inventory — that's `recordScan`.
  // ==========================================

  async scanBarcode(
    rawBarcode: string,
    businessUnitId?: string,
  ): Promise<ScanResult> {
    try {
      if (!rawBarcode) {
        throw new AppError('Barcode is required', 400);
      }

      const barcode = this.normalizeScannedCode(rawBarcode);
      if (!barcode) {
        throw new AppError(
          'Barcode is empty after normalization',
          400,
        );
      }

      // ── 1. Try Product.barcode ───────────────────────────────
      let product = await prisma.product.findFirst({
        where: {
          barcode,
          ...(businessUnitId ? { businessUnitId } : {}),
          deletedAt: null,
        },
        include: {
          inventory: true,
          category: true,
          businessUnit: true,
          images: { orderBy: { order: 'asc' }, take: 1 },
        },
      });

      let variant: ScanResult['variant'] = null;

      // ── 2. Fall back to ProductVariant.barcode ───────────────
      if (!product) {
        const variantRow = await prisma.productVariant.findFirst({
          where: {
            barcode,
            ...(businessUnitId
              ? { product: { businessUnitId } }
              : {}),
            deletedAt: null,
          },
          include: {
            product: {
              include: {
                inventory: true,
                category: true,
                businessUnit: true,
                images: { orderBy: { order: 'asc' }, take: 1 },
              },
            },
          },
        });

        if (variantRow) {
          variant = {
            id: variantRow.id,
            name: variantRow.name,
            sku: variantRow.sku,
            price: variantRow.price,
            barcode: variantRow.barcode,
            attributes: variantRow.attributes,
          };
          product = variantRow.product as typeof product;
        }
      }

      if (!product) {
        throw new AppError('Product not found for this barcode', 404);
      }

      // ── 3. Resolve inventory (variant-first if a variant) ───
      let inventoryRow: {
        id: string;
        quantity: number;
        reserved: number;
        reorderPoint: number;
      } | null = null;

      if (variant) {
        const vInv = await prisma.productVariant.findUnique({
          where: { id: variant.id },
          select: {
            inventory: {
              select: {
                id: true,
                quantity: true,
                reserved: true,
                reorderPoint: true,
              },
            },
          },
        });
        inventoryRow = vInv?.inventory ?? null;
      }

      if (!inventoryRow && product.inventory) {
        inventoryRow = {
          id: product.inventory.id,
          quantity: product.inventory.quantity,
          reserved: product.inventory.reserved,
          reorderPoint: product.inventory.reorderPoint,
        };
      }

      if (!inventoryRow) {
        const fallback = await prisma.inventory.findFirst({
          where: {
            productId: product.id,
            ...(businessUnitId ? { businessUnitId } : {}),
          },
          select: {
            id: true,
            quantity: true,
            reserved: true,
            reorderPoint: true,
          },
        });
        inventoryRow = fallback ?? null;
      }

      // ── 4. Increment scan counters (fire-and-forget) ────────
      void this.incrementScanCounters(barcode);

      // ── 5. Build the response ───────────────────────────────
      const qrPayload = {
        type: 'PRODUCT',
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.unitPrice,
        barcode,
        timestamp: new Date().toISOString(),
      };

      return {
        matchType: variant ? 'VARIANT' : 'PRODUCT',
        barcode,
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.unitPrice,
          barcode: product.barcode,
          businessUnitId: product.businessUnitId,
          categoryId: product.categoryId,
        },
        variant,
        inventory: inventoryRow
          ? {
              id: inventoryRow.id,
              quantity: inventoryRow.quantity,
              reserved: inventoryRow.reserved,
              available:
                inventoryRow.quantity - inventoryRow.reserved,
              reorderPoint: inventoryRow.reorderPoint,
            }
          : null,
        images: {
          barcodeUrl: this.buildBarcodeUrl(barcode, 'EAN13'),
          qrCodeUrl: this.buildQrUrl(qrPayload),
        },
      };
    } catch (error) {
      console.error('Scan barcode error:', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to scan barcode', 500);
    }
  }

  /**
   * Fire-and-forget scan-counter increments. Never throws — a
   * missing audit row must never block a live scan.
   */
  private async incrementScanCounters(barcode: string): Promise<void> {
    try {
      const now = new Date();

      await prisma.barcodeImageRecord
        .updateMany({
          where: { barcode, isActive: true },
          data: { scans: { increment: 1 }, lastScanned: now },
        })
        .catch((err) => {
          console.warn(
            'BarcodeImageRecord scan increment failed:',
            err,
          );
        });

      await prisma.qRCodeRecord
        .updateMany({
          where: { code: barcode, isActive: true },
          data: { scans: { increment: 1 }, lastScanned: now },
        })
        .catch((err) => {
          console.warn('QRCodeRecord scan increment failed:', err);
        });
    } catch (err) {
      console.warn('incrementScanCounters failed:', err);
    }
  }

  // ==========================================
  // CORE: RECORD SCAN (WRITE — SALE-READY)
  //
  // The endpoint a POS hits when a scanner-driven sale is being
  // rung up. It:
  //   1. Enforces the caller-supplied idempotency key (if any) by
  //      checking InventoryTransaction.notes for `scan:<key>` BEFORE
  //      opening the transaction. A duplicate short-circuits with
  //      409.
  //   2. Resolves the barcode (product-first, then variant).
  //   3. Writes an InventoryTransaction row (SALE, negative qty)
  //      with `notes: scan:<key>` so the next duplicate is caught.
  //   4. Decrements Inventory.quantity and recomputes `available`.
  //   5. Bumps BarcodeImageRecord / QRCodeRecord scan counters.
  //
  // Steps 3–5 happen inside a single Prisma transaction so a
  // failure cannot leave stock and audit trails out of sync.
  // ==========================================

  async recordScan(input: RecordScanInput): Promise<{
    transactionId: string;
    matchType: 'PRODUCT' | 'VARIANT';
    barcode: string;
    productId: string;
    variantId: string | null;
    quantityScanned: number;
    remainingQuantity: number;
  }> {
    const {
      barcode: rawBarcode,
      businessUnitId,
      userId,
      saleId,
      quantity = 1,
      note,
      scanIdempotencyKey,
    } = input;

    if (!rawBarcode) throw new AppError('Barcode is required', 400);
    if (!businessUnitId) {
      throw new AppError('businessUnitId is required', 400);
    }
    if (!userId) throw new AppError('userId is required', 400);
    if (quantity <= 0) {
      throw new AppError('quantity must be greater than zero', 400);
    }

    const barcode = this.normalizeScannedCode(rawBarcode);
    if (!barcode) {
      throw new AppError('Barcode is empty after normalization', 400);
    }

    // ── Idempotency check (pre-transaction) ────────────────────
    //
    // Two transports (HID + BLE) can fire the same physical scan
    // and drift past the dispatcher's 250 ms debounce. The caller
    // supplies a key; we look for `scan:<key>` in the notes of an
    // existing InventoryTransaction. If it exists, the scan has
    // already been counted — reject with 409 so the client can
    // ignore it silently.
    if (scanIdempotencyKey) {
      const existing = await prisma.inventoryTransaction.findFirst({
        where: {
          businessUnitId,
          notes: `scan:${scanIdempotencyKey}`,
        },
        select: { id: true },
      });

      if (existing) {
        throw new AppError('Duplicate scan ignored', 409);
      }
    }

    const txNote = scanIdempotencyKey
      ? `scan:${scanIdempotencyKey}`
      : note ?? `Scanned via barcode ${barcode}`;

    return prisma.$transaction(async (tx) => {
      // ── 1. Resolve product / variant ────────────────────────
      let product = await tx.product.findFirst({
        where: {
          barcode,
          businessUnitId,
          deletedAt: null,
        },
      });

      let variant: { id: string; productId: string } | null = null;

      if (!product) {
        const v = await tx.productVariant.findFirst({
          where: {
            barcode,
            product: { businessUnitId },
            deletedAt: null,
          },
          select: { id: true, productId: true },
        });
        if (v) {
          variant = v;
          product = await tx.product.findUnique({
            where: { id: v.productId },
          });
        }
      }

      if (!product) {
        throw new AppError('Product not found for this barcode', 404);
      }

      // ── 2. Resolve inventory row ────────────────────────────
      let inventory: {
        id: string;
        quantity: number;
        reserved: number;
      } | null = null;

      if (variant) {
        const vFull = await tx.productVariant.findUnique({
          where: { id: variant.id },
          select: {
            inventory: {
              select: { id: true, quantity: true, reserved: true },
            },
          },
        });
        inventory = vFull?.inventory ?? null;
      }

      if (!inventory && product.inventoryId) {
        const i = await tx.inventory.findUnique({
          where: { id: product.inventoryId },
          select: { id: true, quantity: true, reserved: true },
        });
        inventory = i ?? null;
      }

      if (!inventory) {
        const i = await tx.inventory.findFirst({
          where: { productId: product.id, businessUnitId },
          select: { id: true, quantity: true, reserved: true },
        });
        inventory = i ?? null;
      }

      if (!inventory) {
        throw new AppError(
          'No inventory record found for this product in this business unit',
          409,
        );
      }

      if (inventory.quantity < quantity) {
        throw new AppError(
          `Insufficient stock: ${inventory.quantity} available, ${quantity} requested`,
          409,
        );
      }

      // ── 3. InventoryTransaction ─────────────────────────────
      const invTx = await tx.inventoryTransaction.create({
        data: {
          transactionType: 'SALE',
          quantity: -Math.abs(quantity),
          notes: txNote,
          reference: barcode,
          productId: product.id,
          variantId: variant?.id ?? null,
          inventoryId: inventory.id,
          businessUnitId,
          userId,
          saleId: saleId ?? null,
        },
      });

      // ── 4. Decrement inventory ──────────────────────────────
      const newQuantity = inventory.quantity - quantity;
      const available = newQuantity - inventory.reserved;

      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newQuantity, available },
      });

      // ── 5. Bump scan counters ───────────────────────────────
      const now = new Date();
      await tx.barcodeImageRecord
        .updateMany({
          where: { barcode, isActive: true },
          data: { scans: { increment: 1 }, lastScanned: now },
        })
        .catch(() => undefined);
      await tx.qRCodeRecord
        .updateMany({
          where: { code: barcode, isActive: true },
          data: { scans: { increment: 1 }, lastScanned: now },
        })
        .catch(() => undefined);

      return {
        transactionId: invTx.id,
        matchType: variant
          ? ('VARIANT' as const)
          : ('PRODUCT' as const),
        barcode,
        productId: product.id,
        variantId: variant?.id ?? null,
        quantityScanned: quantity,
        remainingQuantity: newQuantity,
      };
    });
  }

  // ==========================================
  // CORE: IMAGE FOR PRODUCT (LEGACY)
  // ==========================================

  async generateBarcodeImageForProduct(productId: string): Promise<{
    barcodeUrl: string;
    barcode: string;
    generatedAt: Date;
  }> {
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
        barcodeUrl: this.buildBarcodeUrl(barcode, 'EAN13'),
        barcode,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error(
        'Generate barcode image for product error:',
        error,
      );
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to generate barcode image', 500);
    }
  }
}

export const barcodeService = new BarcodeService();
