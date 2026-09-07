// D:\Projects\Kalwanga\packages\web\utils\helpers.ts

/**
 * Generate a random ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
};

/**
 * Generate a receipt number
 */
export const generateReceiptNumber = (prefix: string = 'RCP'): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Generate an invoice number
 */
export const generateInvoiceNumber = (prefix: string = 'INV'): string => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${timestamp}-${random}`;
};

/**
 * Format currency
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount || 0);
  } catch (error) {
    // Fallback for invalid currency codes
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  }
};

/**
 * Format currency without symbol
 */
export const formatCurrencyAmount = (amount: number, currency: string = 'USD'): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch (error) {
    return (amount || 0).toFixed(2);
  }
};

/**
 * Format date
 */
export const formatDate = (
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Format date with time
 */
export const formatDateTime = (
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Format time only
 */
export const formatTime = (
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }
): string => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'N/A';
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Format date to relative time (e.g., "2 hours ago", "3 days ago")
 */
export const formatRelativeTime = (date: Date | string | null | undefined): string => {
  if (!date) return 'N/A';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'N/A';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  } catch (error) {
    return 'N/A';
  }
};

/**
 * Calculate total from items
 */
export const calculateTotal = (items: Array<{ quantity: number; unitPrice: number }>): number => {
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
};

/**
 * Calculate tax
 */
export const calculateTax = (subtotal: number, taxRate: number = 0.08): number => {
  return subtotal * taxRate;
};

/**
 * Calculate discount
 */
export const calculateDiscount = (subtotal: number, discountRate: number): number => {
  return subtotal * (discountRate / 100);
};

/**
 * Format phone number
 */
export const formatPhoneNumberHelper = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

/**
 * Format phone number (alias)
 */
export const formatPhoneNumber = formatPhoneNumberHelper;

/**
 * Truncate text
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Get status color for display
 */
export const getStatusColorHelper = (status: string): string => {
  const colors: Record<string, string> = {
    // Sale statuses
    PENDING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    PROCESSING: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    REFUNDED: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    ON_HOLD: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    VOID: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    DELETED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    // Return statuses
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    approved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    rejected: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    processed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    // Invoice statuses
    draft: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    sent: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    paid: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    void: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
    // Receipt statuses
    issued: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    printed: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    // Order statuses
    PARTIALLY_PAID: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  };
  return colors[status] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

/**
 * Get status color (alias)
 */
export const getStatusColor = getStatusColorHelper;

/**
 * Get payment method color
 */
export const getPaymentMethodColorHelper = (method: string): string => {
  const colors: Record<string, string> = {
    CASH: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    CREDIT_CARD: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    DEBIT_CARD: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
    MOBILE_MONEY: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
    BANK_TRANSFER: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
    GIFT_CARD: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
    LOYALTY_POINTS: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    CRYPTO: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
    CHECK: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400',
  };
  return colors[method] || 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-400';
};

/**
 * Get payment method color (alias)
 */
export const getPaymentMethodColor = getPaymentMethodColorHelper;

/**
 * Calculate percentage
 */
export const calculatePercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return (value / total) * 100;
};

/**
 * Format percentage
 */
export const formatPercentageHelper = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Format percentage (alias)
 */
export const formatPercentage = formatPercentageHelper;

/**
 * Check if value is empty
 */
export const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};

/**
 * Deep clone an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Get initials from name
 */
export const getInitials = (name: string): string => {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Generate random color
 */
export const getRandomColor = (seed?: string): string => {
  const colors = [
    'blue', 'green', 'purple', 'orange', 'red', 'pink', 'indigo', 'teal', 'cyan', 'rose'
  ];
  if (seed) {
    const index = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  }
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Format file size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Slugify string
 */
export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

/**
 * Capitalize first letter
 */
export const capitalize = (text: string): string => {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Export all helpers as an object
 */
export const helpers = {
  generateId,
  generateReceiptNumber,
  generateInvoiceNumber,
  formatCurrency,
  formatCurrencyAmount,
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  calculateTotal,
  calculateTax,
  calculateDiscount,
  formatPhoneNumber: formatPhoneNumberHelper,
  truncateText,
  debounce,
  throttle,
  getStatusColor: getStatusColorHelper,
  getPaymentMethodColor: getPaymentMethodColorHelper,
  calculatePercentage,
  formatPercentage: formatPercentageHelper,
  isEmpty,
  deepClone,
  getInitials,
  getRandomColor,
  formatFileSize,
  slugify,
  capitalize,
};

export default helpers;
