// packages/api-contract/src/validators/barcode.ts
import {
  associateBarcodeSchema,
  bulkGenerateBarcodesSchema,
  generateBarcodeImageSchema,
  generateBarcodeSchema,
  generateQRCodeSchema,
  scanBarcodeSchema,
  validateBarcodeSchema,
  type AssociateBarcodeInput,
  type BulkGenerateBarcodesInput,
  type GenerateBarcodeImageInput,
  type GenerateBarcodeInput,
  type ScanBarcodeInput,
  type ValidateBarcodeInput,
} from "../schemas/barcode";

export class BarcodeValidation {
  static validateGenerateBarcode(data: unknown): GenerateBarcodeInput {
    return generateBarcodeSchema.parse(data);
  }
  static validateAssociateBarcode(data: unknown): AssociateBarcodeInput {
    return associateBarcodeSchema.parse(data);
  }
  static validateValidateBarcode(data: unknown): ValidateBarcodeInput {
    return validateBarcodeSchema.parse(data);
  }
  static validateScanBarcode(data: unknown): ScanBarcodeInput {
    return scanBarcodeSchema.parse(data);
  }
  static validateBulkGenerateBarcodes(
    data: unknown,
  ): BulkGenerateBarcodesInput {
    return bulkGenerateBarcodesSchema.parse(data);
  }
  static validateGenerateBarcodeImage(
    data: unknown,
  ): GenerateBarcodeImageInput {
    return generateBarcodeImageSchema.parse(data);
  }
  static validateGenerateQRCode(data: unknown) {
    return generateQRCodeSchema.parse(data);
  }
}
