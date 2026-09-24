import { z } from "zod";
import { businessUnitIdSchema, productIdSchema } from "../helpers";

export const generateBarcodeSchema = z.object({
  prefix: z.string().optional().default('PRD'),
  length: z.number().int().min(8).max(20).optional().default(12),
  format: z
    .enum(['EAN-13', 'UPC-A', 'CODE128', 'QR'])
    .optional()
    .default('EAN-13'),
  includeQR: z.boolean().optional().default(true),
  productName: z.string().optional(),
  sku: z.string().optional(),
});

export const associateBarcodeSchema = z.object({
  barcode: z.string().min(4).max(50),
});

export const validateBarcodeSchema = z.object({
  barcode: z.string().min(4).max(50),
  excludeProductId: productIdSchema.optional(),
});

export const scanBarcodeSchema = z.object({
  barcode: z.string().min(1),
  businessUnitId: businessUnitIdSchema.optional(),
});

export const bulkGenerateBarcodesSchema = z.object({
  productIds: z.array(productIdSchema).min(1),
  options: generateBarcodeSchema.optional(),
});

export const generateBarcodeImageSchema = z.object({
  barcode: z.string().min(1),
  format: z.enum(['EAN-13', 'UPC-A', 'CODE128']).optional().default('EAN-13'),
});

export const generateQRCodeSchema = z.object({
  data: z.any().refine((val) => val !== null && val !== undefined),
});

export type GenerateBarcodeInput = z.infer<typeof generateBarcodeSchema>;
export type AssociateBarcodeInput = z.infer<typeof associateBarcodeSchema>;
export type ValidateBarcodeInput = z.infer<typeof validateBarcodeSchema>;
export type ScanBarcodeInput = z.infer<typeof scanBarcodeSchema>;
export type BulkGenerateBarcodesInput = z.infer<typeof bulkGenerateBarcodesSchema>;
export type GenerateBarcodeImageInput = z.infer<typeof generateBarcodeImageSchema>;
