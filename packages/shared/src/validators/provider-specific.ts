import {
  flutterwaveVirtualAccountSchema,
  payPalCaptureSchema,
  paystackVerifySchema,
  squareCustomerSchema,
  squarePaymentSchema,
  type FlutterwaveVirtualAccountInput,
  type PayPalCaptureInput,
  type PaystackVerifyInput,
  type SquareCustomerInput,
  type SquarePaymentInput,
} from "../schemas/provider-specific";

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

export class PaystackValidation {
  static validateVerify(data: unknown): PaystackVerifyInput {
    return paystackVerifySchema.parse(data);
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
