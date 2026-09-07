// src/utils/validators.ts

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  value?: any;
}

/**
 * Validation rule type
 */
export type ValidationRule = (value: any) => boolean | ValidationResult;

/**
 * Validation schema type
 */
export interface ValidationSchema {
  [key: string]: ValidationRule[];
}

// ============================================
// EMAIL VALIDATION
// ============================================

/**
 * Email validation
 * @param email - Email address to validate
 * @returns True if valid email format
 */
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Email validation with detailed result
 * @param email - Email address to validate
 * @returns ValidationResult with errors
 */
export function validateEmailDetailed(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email) {
    errors.push('Email is required');
    return { valid: false, errors };
  }
  
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please enter a valid email address (e.g., name@domain.com)');
  }
  
  if (email.length > 255) {
    errors.push('Email cannot exceed 255 characters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// PHONE VALIDATION
// ============================================

/**
 * Phone validation
 * @param phone - Phone number to validate
 * @returns True if valid phone format
 */
export function validatePhone(phone: string): boolean {
  return /^\+?[\d\s-]{10,}$/.test(phone);
}

/**
 * Phone validation with detailed result
 * @param phone - Phone number to validate
 * @returns ValidationResult with errors
 */
export function validatePhoneDetailed(phone: string): ValidationResult {
  const errors: string[] = [];
  
  if (!phone) {
    errors.push('Phone number is required');
    return { valid: false, errors };
  }
  
  const cleaned = phone.replace(/[\s-()]/g, '');
  if (!/^\+?\d{10,}$/.test(cleaned)) {
    errors.push('Please enter a valid phone number (minimum 10 digits)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// REQUIRED FIELD VALIDATION
// ============================================

/**
 * Required field validation
 * @param value - Value to check
 * @returns True if value is not empty
 */
export function validateRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

/**
 * Required field validation with detailed result
 * @param value - Value to check
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateRequiredDetailed(value: any, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!validateRequired(value)) {
    errors.push(`${fieldName} is required`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// LENGTH VALIDATION
// ============================================

/**
 * Min length validation
 * @param value - String to validate
 * @param min - Minimum length
 * @returns True if string meets minimum length
 */
export function validateMinLength(value: string, min: number): boolean {
  return value.length >= min;
}

/**
 * Min length validation with detailed result
 * @param value - String to validate
 * @param min - Minimum length
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateMinLengthDetailed(value: string, min: number, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push(`${fieldName} is required`);
  } else if (value.length < min) {
    errors.push(`${fieldName} must be at least ${min} characters`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Max length validation
 * @param value - String to validate
 * @param max - Maximum length
 * @returns True if string does not exceed maximum length
 */
export function validateMaxLength(value: string, max: number): boolean {
  return value.length <= max;
}

/**
 * Max length validation with detailed result
 * @param value - String to validate
 * @param max - Maximum length
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateMaxLengthDetailed(value: string, max: number, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (value && value.length > max) {
    errors.push(`${fieldName} cannot exceed ${max} characters`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// NUMBER VALIDATION
// ============================================

/**
 * Number validation
 * @param value - Value to check
 * @returns True if value is a valid number
 */
export function validateNumber(value: any): boolean {
  if (value === null || value === undefined || value === '') return false;
  return !isNaN(Number(value));
}

/**
 * Number validation with detailed result
 * @param value - Value to check
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateNumberDetailed(value: any, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!validateNumber(value)) {
    errors.push(`${fieldName} must be a valid number`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Positive number validation
 * @param value - Number to validate
 * @returns True if value is a positive number
 */
export function validatePositiveNumber(value: any): boolean {
  return validateNumber(value) && Number(value) > 0;
}

/**
 * Positive number validation with detailed result
 * @param value - Number to validate
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validatePositiveNumberDetailed(value: any, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!validateNumber(value)) {
    errors.push(`${fieldName} must be a valid number`);
  } else if (Number(value) <= 0) {
    errors.push(`${fieldName} must be greater than 0`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Non-negative number validation
 * @param value - Number to validate
 * @returns True if value is a non-negative number
 */
export function validateNonNegativeNumber(value: any): boolean {
  return validateNumber(value) && Number(value) >= 0;
}

/**
 * Non-negative number validation with detailed result
 * @param value - Number to validate
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateNonNegativeNumberDetailed(value: any, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!validateNumber(value)) {
    errors.push(`${fieldName} must be a valid number`);
  } else if (Number(value) < 0) {
    errors.push(`${fieldName} cannot be negative`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// ZIP CODE VALIDATION
// ============================================

/**
 * Zip code validation (US format)
 * @param value - Zip code to validate
 * @returns True if valid zip code format
 */
export function validateZipCode(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value);
}

/**
 * Zip code validation with detailed result
 * @param value - Zip code to validate
 * @returns ValidationResult with errors
 */
export function validateZipCodeDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('Zip code is required');
    return { valid: false, errors };
  }
  
  if (!/^\d{5}(-\d{4})?$/.test(value)) {
    errors.push('Please enter a valid zip code (e.g., 12345 or 12345-6789)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// URL VALIDATION
// ============================================

/**
 * URL validation
 * @param value - URL to validate
 * @returns True if valid URL format
 */
export function validateURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * URL validation with detailed result
 * @param value - URL to validate
 * @returns ValidationResult with errors
 */
export function validateURLDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('URL is required');
    return { valid: false, errors };
  }
  
  if (!validateURL(value)) {
    errors.push('Please enter a valid URL (e.g., https://example.com)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// PASSWORD VALIDATION
// ============================================

/**
 * Password strength validation
 * @param password - Password to validate
 * @returns True if password meets minimum strength requirements
 */
export function validatePassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Password strength validation with detailed result
 * @param password - Password to validate
 * @returns ValidationResult with errors
 */
export function validatePasswordDetailed(password: string): ValidationResult {
  const errors: string[] = [];
  
  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Password confirmation validation
 * @param password - Original password
 * @param confirmPassword - Password to confirm
 * @returns True if passwords match
 */
export function validatePasswordMatch(password: string, confirmPassword: string): boolean {
  return password === confirmPassword;
}

/**
 * Password confirmation validation with detailed result
 * @param password - Original password
 * @param confirmPassword - Password to confirm
 * @returns ValidationResult with errors
 */
export function validatePasswordMatchDetailed(password: string, confirmPassword: string): ValidationResult {
  const errors: string[] = [];
  
  if (!password || !confirmPassword) {
    errors.push('Both passwords are required');
  } else if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// SKU / BARCODE VALIDATION
// ============================================

/**
 * SKU validation
 * @param value - SKU to validate
 * @returns True if valid SKU format
 */
export function validateSKU(value: string): boolean {
  return /^[A-Z0-9\-_]+$/.test(value);
}

/**
 * SKU validation with detailed result
 * @param value - SKU to validate
 * @returns ValidationResult with errors
 */
export function validateSKUDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('SKU is required');
    return { valid: false, errors };
  }
  
  if (!/^[A-Z0-9\-_]+$/.test(value)) {
    errors.push('SKU can only contain uppercase letters, numbers, hyphens, and underscores');
  }
  
  if (value.length > 50) {
    errors.push('SKU cannot exceed 50 characters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Barcode validation
 * @param value - Barcode to validate
 * @returns True if valid barcode format
 */
export function validateBarcode(value: string): boolean {
  return /^[A-Z0-9\-]+$/.test(value);
}

/**
 * Barcode validation with detailed result
 * @param value - Barcode to validate
 * @returns ValidationResult with errors
 */
export function validateBarcodeDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('Barcode is required');
    return { valid: false, errors };
  }
  
  if (!/^[A-Z0-9\-]+$/.test(value)) {
    errors.push('Barcode can only contain uppercase letters, numbers, and hyphens');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// DATE VALIDATION
// ============================================

/**
 * Date validation
 * @param value - Date string to validate
 * @returns True if valid date format
 */
export function validateDate(value: string): boolean {
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Date validation with detailed result
 * @param value - Date string to validate
 * @returns ValidationResult with errors
 */
export function validateDateDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('Date is required');
    return { valid: false, errors };
  }
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    errors.push('Please enter a valid date');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Future date validation
 * @param value - Date string to validate
 * @returns True if date is in the future
 */
export function validateFutureDate(value: string): boolean {
  const date = new Date(value);
  return date > new Date();
}

/**
 * Future date validation with detailed result
 * @param value - Date string to validate
 * @returns ValidationResult with errors
 */
export function validateFutureDateDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  const dateResult = validateDateDetailed(value);
  if (!dateResult.valid) {
    return dateResult;
  }
  
  const date = new Date(value);
  if (date <= new Date()) {
    errors.push('Date must be in the future');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Past date validation
 * @param value - Date string to validate
 * @returns True if date is in the past
 */
export function validatePastDate(value: string): boolean {
  const date = new Date(value);
  return date < new Date();
}

/**
 * Past date validation with detailed result
 * @param value - Date string to validate
 * @returns ValidationResult with errors
 */
export function validatePastDateDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  const dateResult = validateDateDetailed(value);
  if (!dateResult.valid) {
    return dateResult;
  }
  
  const date = new Date(value);
  if (date >= new Date()) {
    errors.push('Date must be in the past');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// RANGE VALIDATION
// ============================================

/**
 * Range validation for numbers
 * @param value - Number to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns True if number is within range
 */
export function validateRange(value: number, min: number, max: number): boolean {
  return validateNumber(value) && Number(value) >= min && Number(value) <= max;
}

/**
 * Range validation with detailed result
 * @param value - Number to validate
 * @param min - Minimum value
 * @param max - Maximum value
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateRangeDetailed(value: any, min: number, max: number, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!validateNumber(value)) {
    errors.push(`${fieldName} must be a valid number`);
  } else if (Number(value) < min || Number(value) > max) {
    errors.push(`${fieldName} must be between ${min} and ${max}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// ARRAY VALIDATION
// ============================================

/**
 * Array length validation
 * @param value - Array to validate
 * @param min - Minimum length
 * @param max - Maximum length (optional)
 * @returns True if array length is valid
 */
export function validateArrayLength(value: any[], min: number, max?: number): boolean {
  if (!Array.isArray(value)) return false;
  if (value.length < min) return false;
  if (max !== undefined && value.length > max) return false;
  return true;
}

/**
 * Array length validation with detailed result
 * @param value - Array to validate
 * @param min - Minimum length
 * @param max - Maximum length (optional)
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateArrayLengthDetailed(value: any[], min: number, max?: number, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!Array.isArray(value)) {
    errors.push(`${fieldName} must be an array`);
  } else if (value.length < min) {
    errors.push(`${fieldName} must have at least ${min} items`);
  } else if (max !== undefined && value.length > max) {
    errors.push(`${fieldName} cannot have more than ${max} items`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// OBJECT VALIDATION
// ============================================

/**
 * Object validation (not empty)
 * @param value - Object to validate
 * @returns True if object is not empty
 */
export function validateObject(value: any): boolean {
  return value !== null && typeof value === 'object' && Object.keys(value).length > 0;
}

/**
 * Object validation with detailed result
 * @param value - Object to validate
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateObjectDetailed(value: any, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (value === null || value === undefined) {
    errors.push(`${fieldName} is required`);
  } else if (typeof value !== 'object') {
    errors.push(`${fieldName} must be an object`);
  } else if (Object.keys(value).length === 0) {
    errors.push(`${fieldName} cannot be empty`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// BOOLEAN VALIDATION
// ============================================

/**
 * Boolean validation
 * @param value - Value to validate
 * @returns True if value is a boolean
 */
export function validateBoolean(value: any): boolean {
  return typeof value === 'boolean';
}

/**
 * Boolean validation with detailed result
 * @param value - Value to validate
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateBooleanDetailed(value: any, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (typeof value !== 'boolean') {
    errors.push(`${fieldName} must be true or false`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// CURRENCY VALIDATION
// ============================================

/**
 * Currency validation (positive number with up to 2 decimal places)
 * @param value - Currency amount to validate
 * @returns True if valid currency format
 */
export function validateCurrency(value: any): boolean {
  if (!validateNumber(value)) return false;
  const num = Number(value);
  return num >= 0 && !/\.\d{3,}/.test(String(num));
}

/**
 * Currency validation with detailed result
 * @param value - Currency amount to validate
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateCurrencyDetailed(value: any, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!validateNumber(value)) {
    errors.push(`${fieldName} must be a valid number`);
  } else {
    const num = Number(value);
    if (num < 0) {
      errors.push(`${fieldName} cannot be negative`);
    }
    if (/\.\d{3,}/.test(String(num))) {
      errors.push(`${fieldName} cannot have more than 2 decimal places`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// PERCENTAGE VALIDATION
// ============================================

/**
 * Percentage validation (0-100)
 * @param value - Percentage to validate
 * @returns True if valid percentage
 */
export function validatePercentage(value: any): boolean {
  return validateRange(Number(value), 0, 100);
}

/**
 * Percentage validation with detailed result
 * @param value - Percentage to validate
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validatePercentageDetailed(value: any, fieldName: string = 'This field'): ValidationResult {
  const errors: string[] = [];
  
  if (!validateNumber(value)) {
    errors.push(`${fieldName} must be a valid number`);
  } else {
    const num = Number(value);
    if (num < 0) {
      errors.push(`${fieldName} cannot be negative`);
    }
    if (num > 100) {
      errors.push(`${fieldName} cannot exceed 100`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// CREDIT CARD VALIDATION
// ============================================

/**
 * Credit card validation (Luhn algorithm)
 * @param value - Credit card number to validate
 * @returns True if valid credit card number
 */
export function validateCreditCard(value: string): boolean {
  const cleaned = value.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(cleaned)) return false;
  
  // Luhn algorithm
  let sum = 0;
  let alternate = false;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let n = parseInt(cleaned[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * Credit card validation with detailed result
 * @param value - Credit card number to validate
 * @returns ValidationResult with errors
 */
export function validateCreditCardDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('Credit card number is required');
    return { valid: false, errors };
  }
  
  const cleaned = value.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(cleaned)) {
    errors.push('Please enter a valid credit card number (13-19 digits)');
    return { valid: false, errors };
  }
  
  if (!validateCreditCard(value)) {
    errors.push('Please enter a valid credit card number');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Expiry date validation
 * @param month - Expiry month (1-12)
 * @param year - Expiry year (YYYY)
 * @returns True if valid expiry date
 */
export function validateExpiryDate(month: number, year: number): boolean {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  if (month < 1 || month > 12) return false;
  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  
  return true;
}

/**
 * Expiry date validation with detailed result
 * @param month - Expiry month (1-12)
 * @param year - Expiry year (YYYY)
 * @returns ValidationResult with errors
 */
export function validateExpiryDateDetailed(month: number, year: number): ValidationResult {
  const errors: string[] = [];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  
  if (month < 1 || month > 12) {
    errors.push('Please enter a valid month (1-12)');
  }
  
  if (year < 1000 || year > 9999) {
    errors.push('Please enter a valid year');
  }
  
  if (year < currentYear) {
    errors.push('Card has expired');
  }
  
  if (year === currentYear && month < currentMonth) {
    errors.push('Card has expired');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// SALES-SPECIFIC VALIDATIONS
// ============================================

/**
 * Receipt number validation
 * @param value - Receipt number to validate
 * @returns True if valid receipt number format
 */
export function validateReceiptNumber(value: string): boolean {
  return /^[A-Z]{3,4}-\d{4,8}$/.test(value);
}

/**
 * Receipt number validation with detailed result
 * @param value - Receipt number to validate
 * @returns ValidationResult with errors
 */
export function validateReceiptNumberDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('Receipt number is required');
    return { valid: false, errors };
  }
  
  if (!/^[A-Z]{3,4}-\d{4,8}$/.test(value)) {
    errors.push('Please enter a valid receipt number (e.g., RCP-123456)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Invoice number validation
 * @param value - Invoice number to validate
 * @returns True if valid invoice number format
 */
export function validateInvoiceNumber(value: string): boolean {
  return /^[A-Z]{3,4}-\d{4,8}$/.test(value);
}

/**
 * Invoice number validation with detailed result
 * @param value - Invoice number to validate
 * @returns ValidationResult with errors
 */
export function validateInvoiceNumberDetailed(value: string): ValidationResult {
  const errors: string[] = [];
  
  if (!value) {
    errors.push('Invoice number is required');
    return { valid: false, errors };
  }
  
  if (!/^[A-Z]{3,4}-\d{4,8}$/.test(value)) {
    errors.push('Please enter a valid invoice number (e.g., INV-123456)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Payment amount validation (must be positive and not exceed total)
 * @param amount - Payment amount
 * @param total - Total amount
 * @returns True if payment is valid
 */
export function validatePaymentAmount(amount: number, total: number): boolean {
  return validatePositiveNumber(amount) && amount <= total;
}

/**
 * Payment amount validation with detailed result
 * @param amount - Payment amount
 * @param total - Total amount
 * @returns ValidationResult with errors
 */
export function validatePaymentAmountDetailed(amount: number, total: number): ValidationResult {
  const errors: string[] = [];
  
  if (!validatePositiveNumber(amount)) {
    errors.push('Payment amount must be greater than 0');
  } else if (amount > total) {
    errors.push(`Payment amount cannot exceed total of ${total.toFixed(2)}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Discount validation (must be between 0 and max discount)
 * @param discount - Discount amount
 * @param maxDiscount - Maximum allowed discount
 * @returns True if discount is valid
 */
export function validateDiscount(discount: number, maxDiscount: number): boolean {
  return validateNonNegativeNumber(discount) && discount <= maxDiscount;
}

/**
 * Discount validation with detailed result
 * @param discount - Discount amount
 * @param maxDiscount - Maximum allowed discount
 * @param isPercentage - Whether discount is a percentage
 * @returns ValidationResult with errors
 */
export function validateDiscountDetailed(discount: number, maxDiscount: number, isPercentage: boolean = false): ValidationResult {
  const errors: string[] = [];
  const unit = isPercentage ? '%' : '';
  
  if (!validateNonNegativeNumber(discount)) {
    errors.push(`Discount${unit} cannot be negative`);
  } else if (discount > maxDiscount) {
    errors.push(`Discount${unit} cannot exceed ${maxDiscount}${unit}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Quantity validation (must be positive integer)
 * @param quantity - Quantity to validate
 * @param maxQuantity - Maximum allowed quantity (optional)
 * @returns True if quantity is valid
 */
export function validateQuantity(quantity: number, maxQuantity?: number): boolean {
  if (!validatePositiveNumber(quantity)) return false;
  if (!Number.isInteger(quantity)) return false;
  if (maxQuantity !== undefined && quantity > maxQuantity) return false;
  return true;
}

/**
 * Quantity validation with detailed result
 * @param quantity - Quantity to validate
 * @param maxQuantity - Maximum allowed quantity (optional)
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateQuantityDetailed(quantity: number, maxQuantity?: number, fieldName: string = 'Quantity'): ValidationResult {
  const errors: string[] = [];
  
  if (!validatePositiveNumber(quantity)) {
    errors.push(`${fieldName} must be greater than 0`);
  } else if (!Number.isInteger(quantity)) {
    errors.push(`${fieldName} must be a whole number`);
  } else if (maxQuantity !== undefined && quantity > maxQuantity) {
    errors.push(`${fieldName} cannot exceed ${maxQuantity}`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Tax rate validation (must be between 0 and 100)
 * @param rate - Tax rate
 * @returns True if tax rate is valid
 */
export function validateTaxRate(rate: number): boolean {
  return validateRange(rate, 0, 100);
}

/**
 * Tax rate validation with detailed result
 * @param rate - Tax rate
 * @param fieldName - Name of the field for error message
 * @returns ValidationResult with errors
 */
export function validateTaxRateDetailed(rate: number, fieldName: string = 'Tax rate'): ValidationResult {
  const errors: string[] = [];
  
  if (!validateNumber(rate)) {
    errors.push(`${fieldName} must be a valid number`);
  } else if (rate < 0) {
    errors.push(`${fieldName} cannot be negative`);
  } else if (rate > 100) {
    errors.push(`${fieldName} cannot exceed 100%`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Return reason validation (must not be empty)
 * @param reason - Return reason
 * @returns True if reason is valid
 */
export function validateReturnReason(reason: string): boolean {
  return validateRequired(reason) && reason.length >= 3;
}

/**
 * Return reason validation with detailed result
 * @param reason - Return reason
 * @returns ValidationResult with errors
 */
export function validateReturnReasonDetailed(reason: string): ValidationResult {
  const errors: string[] = [];
  
  if (!validateRequired(reason)) {
    errors.push('Return reason is required');
  } else if (reason.length < 3) {
    errors.push('Return reason must be at least 3 characters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================
// COMPOSITE VALIDATION FUNCTIONS
// ============================================

/**
 * Validate a value against multiple rules
 * @param value - Value to validate
 * @param rules - Array of validation rules
 * @returns ValidationResult with combined errors
 */
export function validateAgainstRules(value: any, rules: ValidationRule[]): ValidationResult {
  const allErrors: string[] = [];
  
  for (const rule of rules) {
    const result = rule(value);
    if (typeof result === 'boolean') {
      if (!result) {
        allErrors.push('Validation failed');
      }
    } else if (typeof result === 'object' && 'errors' in result) {
      if (!result.valid) {
        allErrors.push(...result.errors);
      }
    }
  }
  
  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * Create a validation schema for form validation
 * @param schema - Object mapping field names to validation rules
 * @returns Validation function that validates all fields
 */
export function createValidator(schema: ValidationSchema) {
  return (data: Record<string, any>): Record<string, string[]> => {
    const errors: Record<string, string[]> = {};
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const result = validateAgainstRules(value, rules);
      if (!result.valid) {
        errors[field] = result.errors;
      }
    }
    
    return errors;
  };
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 * @param value - Value to check
 * @returns True if value is empty
 */
export function isEmpty(value: any): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Get field validation status
 * @param errors - Errors object from validation
 * @param field - Field name to check
 * @returns Validation status
 */
export function getFieldStatus(errors: Record<string, string[]>, field: string): 'valid' | 'invalid' | 'untouched' {
  if (!errors[field]) return 'untouched';
  return errors[field].length === 0 ? 'valid' : 'invalid';
}

/**
 * Get field error messages
 * @param errors - Errors object from validation
 * @param field - Field name to get errors for
 * @returns Array of error messages
 */
export function getFieldErrors(errors: Record<string, string[]>, field: string): string[] {
  return errors[field] || [];
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  // Email validation
  validateEmail,
  validateEmailDetailed,
  
  // Phone validation
  validatePhone,
  validatePhoneDetailed,
  
  // Required validation
  validateRequired,
  validateRequiredDetailed,
  
  // Length validation
  validateMinLength,
  validateMinLengthDetailed,
  validateMaxLength,
  validateMaxLengthDetailed,
  
  // Number validation
  validateNumber,
  validateNumberDetailed,
  validatePositiveNumber,
  validatePositiveNumberDetailed,
  validateNonNegativeNumber,
  validateNonNegativeNumberDetailed,
  
  // Zip code validation
  validateZipCode,
  validateZipCodeDetailed,
  
  // URL validation
  validateURL,
  validateURLDetailed,
  
  // Password validation
  validatePassword,
  validatePasswordDetailed,
  validatePasswordMatch,
  validatePasswordMatchDetailed,
  
  // SKU/Barcode validation
  validateSKU,
  validateSKUDetailed,
  validateBarcode,
  validateBarcodeDetailed,
  
  // Date validation
  validateDate,
  validateDateDetailed,
  validateFutureDate,
  validateFutureDateDetailed,
  validatePastDate,
  validatePastDateDetailed,
  
  // Range validation
  validateRange,
  validateRangeDetailed,
  
  // Array/Object validation
  validateArrayLength,
  validateArrayLengthDetailed,
  validateObject,
  validateObjectDetailed,
  validateBoolean,
  validateBooleanDetailed,
  
  // Currency/Percentage validation
  validateCurrency,
  validateCurrencyDetailed,
  validatePercentage,
  validatePercentageDetailed,
  
  // Credit card validation
  validateCreditCard,
  validateCreditCardDetailed,
  validateExpiryDate,
  validateExpiryDateDetailed,
  
  // Sales-specific validation
  validateReceiptNumber,
  validateReceiptNumberDetailed,
  validateInvoiceNumber,
  validateInvoiceNumberDetailed,
  validatePaymentAmount,
  validatePaymentAmountDetailed,
  validateDiscount,
  validateDiscountDetailed,
  validateQuantity,
  validateQuantityDetailed,
  validateTaxRate,
  validateTaxRateDetailed,
  validateReturnReason,
  validateReturnReasonDetailed,
  
  // Composite validation
  validateAgainstRules,
  createValidator,
  isEmpty,
  getFieldStatus,
  getFieldErrors,
};
