export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  return /^\+?[\d\s-]{10,}$/.test(phone);
}

export function validateRequired(value: any): boolean {
  return value !== null && value !== undefined && value !== "";
}

export function validateMinLength(value: string, min: number): boolean {
  return value.length >= min;
}

export function validateMaxLength(value: string, max: number): boolean {
  return value.length <= max;
}

export function validateNumber(value: any): boolean {
  return !isNaN(Number(value));
}

export function validatePositiveNumber(value: any): boolean {
  return validateNumber(value) && Number(value) > 0;
}

export function validateInteger(value: any): boolean {
  return validateNumber(value) && Number.isInteger(Number(value));
}

export function validatePositiveInteger(value: any): boolean {
  return validateInteger(value) && Number(value) > 0;
}

export function validateZipCode(value: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(value);
}

export function validateURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function validatePassword(value: string): boolean {
  return value.length >= 8;
}
