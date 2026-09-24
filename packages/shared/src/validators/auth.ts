import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verify2FASchema,
  verifyEmailSchema,
  type LoginInput,
  type RegisterInput,
} from "../schemas/auth";

export class AuthValidation {
  static validateRegister(data: unknown): RegisterInput {
    return registerSchema.parse(data);
  }
  static validateLogin(data: unknown): LoginInput {
    return loginSchema.parse(data);
  }
  static validateForgotPassword(data: unknown) {
    return forgotPasswordSchema.parse(data);
  }
  static validateResetPassword(data: unknown) {
    return resetPasswordSchema.parse(data);
  }
  static validateVerifyEmail(data: unknown) {
    return verifyEmailSchema.parse(data);
  }
  static validateResendVerification(data: unknown) {
    return resendVerificationSchema.parse(data);
  }
  static validateVerify2FA(data: unknown) {
    return verify2FASchema.parse(data);
  }
}
