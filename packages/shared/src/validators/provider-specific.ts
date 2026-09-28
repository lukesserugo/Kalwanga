// packages/shared/src/validators/provider-specific.ts

import {
  flutterwaveVirtualAccountSchema,
  payPalCaptureSchema,
  squareCustomerSchema,
  squarePaymentSchema,
  type FlutterwaveVirtualAccountInput,
  type PayPalCaptureInput,
  type SquareCustomerInput,
  type SquarePaymentInput,
} from "../schemas/provider-specific.js";

export class PayPalValidation {
  static validateCapture(data: unknown): PayPalCaptureInput {
    return payPalCaptureSchema.parse(data);
  }
}

export class FlutterwaveValidation {
  static validateVirtualAccount(
    data: unknown,
  ): FlutterwaveVirtualAccountInput {
    return flutterwaveVirtualAccountSchema.parse(data);
  }
}

export class SquareValidation {
  static validatePayment(data: unknown): SquarePaymentInput {
    return squarePaymentSchema.parse(data);
  }
  static validateCustomer(data: unknown): SquareCustomerInput {
    return squareCustomerSchema.parse(data);
  }
}
