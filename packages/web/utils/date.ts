// utils/formatters.ts

/**
 * Format a date to a readable string
 */
export const formatDate = (
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(d);
};

/**
 * Format a date to a short string
 */
export const formatShortDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d);
};

/**
 * Format a date to a time string
 */
export const formatTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

/**
 * Format a date to a full date-time string
 */
export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
};

/**
 * Format a date to ISO string (YYYY-MM-DD)
 */
export const formatISODate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
};

/**
 * Format a date to a month name
 */
export const formatMonth = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(d);
};

/**
 * Format a date to a year
 */
export const formatYear = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getFullYear().toString();
};

/**
 * Get relative time (e.g., "2 hours ago")
 */
export const getRelativeTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return formatDate(d);
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHour > 0) return `${diffHour}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return `${diffSec}s ago`;
};

/**
 * Check if a date is today
 */
export const isToday = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

/**
 * Check if a date is in the past
 */
export const isPast = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
};

/**
 * Check if a date is in the future
 */
export const isFuture = (date: string | Date): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() > Date.now();
};

/**
 * Check if a date is within a range
 */
export const isWithinRange = (
  date: string | Date,
  startDate: string | Date,
  endDate: string | Date
): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
};

/**
 * Format a date range
 */
export const formatDateRange = (
  startDate: string | Date,
  endDate: string | Date
): string => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
};

/**
 * Get start and end of day
 */
export const getDayRange = (date: string | Date): { start: Date; end: Date } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Get start and end of week
 */
export const getWeekRange = (date: string | Date): { start: Date; end: Date } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = new Date(d);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Get start and end of month
 */
export const getMonthRange = (date: string | Date): { start: Date; end: Date } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Get start and end of quarter
 */
export const getQuarterRange = (date: string | Date): { start: Date; end: Date } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const quarter = Math.floor(d.getMonth() / 3);
  const start = new Date(d.getFullYear(), quarter * 3, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d.getFullYear(), quarter * 3 + 3, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/**
 * Get start and end of year
 */
export const getYearRange = (date: string | Date): { start: Date; end: Date } => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = new Date(d.getFullYear(), 0, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(d.getFullYear(), 11, 31);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// ============================================
// NUMBER & CURRENCY FORMATTERS
// ============================================

/**
 * Format a number as currency
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string => {
  if (amount === undefined || amount === null) return '$0.00';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format a number with commas
 */
export const formatNumber = (num: number): string => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Format a number with commas and decimals
 */
export const formatNumberWithDecimals = (num: number, decimals: number = 2): string => {
  if (num === undefined || num === null) return '0.00';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

/**
 * Format a number as a percentage
 */
export const formatPercentage = (value: number): string => {
  if (value === undefined || value === null) return '0%';
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
};

/**
 * Format a number as a compact string (K, M, B)
 */
export const formatCompactNumber = (num: number): string => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(num);
};

/**
 * Format a number with ordinal suffix (1st, 2nd, 3rd, 4th)
 */
export const formatOrdinal = (num: number): string => {
  if (num === undefined || num === null) return '0th';
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const value = num % 100;
  return num + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
};

// ============================================
// TEXT FORMATTERS
// ============================================

/**
 * Truncate text to a specified length
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Capitalize the first letter of a string
 */
export const capitalize = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Capitalize the first letter of each word
 */
export const capitalizeWords = (str: string): string => {
  if (!str) return '';
  return str.split(' ').map(capitalize).join(' ');
};

/**
 * Convert a string to title case
 */
export const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Convert a string to sentence case
 */
export const toSentenceCase = (str: string): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Convert a string to kebab case (e.g., "hello-world")
 */
export const toKebabCase = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

/**
 * Convert a string to snake case (e.g., "hello_world")
 */
export const toSnakeCase = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
};

/**
 * Convert a string to camel case (e.g., "helloWorld")
 */
export const toCamelCase = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/([-_\s]+[a-z])/g, (match) => match.toUpperCase())
    .replace(/[-_\s]/g, '')
    .replace(/^[A-Z]/, (match) => match.toLowerCase());
};

/**
 * Convert a string to Pascal case (e.g., "HelloWorld")
 */
export const toPascalCase = (str: string): string => {
  if (!str) return '';
  const camel = toCamelCase(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

// ============================================
// PHONE & ADDRESS FORMATTERS
// ============================================

/**
 * Format a phone number
 */
export const formatPhoneNumber = (phone: string): string => {
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
 * Format an address
 */
export const formatAddress = (address: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): string => {
  const parts = [address.street, address.city, address.state, address.zip, address.country].filter(Boolean);
  return parts.join(', ');
};

// ============================================
// FILE SIZE FORMATTERS
// ============================================

/**
 * Format file size in bytes to a human-readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ============================================
// DURATION FORMATTERS
// ============================================

/**
 * Format seconds to a human-readable duration
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

// ============================================
// URL FORMATTERS
// ============================================

/**
 * Format a URL for display (remove protocol)
 */
export const formatUrlForDisplay = (url: string): string => {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '');
};

/**
 * Truncate a URL for display
 */
export const truncateUrl = (url: string, maxLength: number = 30): string => {
  if (!url) return '';
  const display = formatUrlForDisplay(url);
  return truncateText(display, maxLength);
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the plural form of a word based on count
 */
export const pluralize = (word: string, count: number): string => {
  if (count === 1) return word;
  return word + 's';
};

/**
 * Format a list of items with commas and 'and'
 */
export const formatList = (items: string[]): string => {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(' and ');
  return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
};

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  formatDate,
  formatShortDate,
  formatTime,
  formatDateTime,
  formatISODate,
  formatMonth,
  formatYear,
  getRelativeTime,
  isToday,
  isPast,
  isFuture,
  isWithinRange,
  formatDateRange,
  getDayRange,
  getWeekRange,
  getMonthRange,
  getQuarterRange,
  getYearRange,
  formatCurrency,
  formatNumber,
  formatNumberWithDecimals,
  formatPercentage,
  formatCompactNumber,
  formatOrdinal,
  truncateText,
  capitalize,
  capitalizeWords,
  toTitleCase,
  toSentenceCase,
  toKebabCase,
  toSnakeCase,
  toCamelCase,
  toPascalCase,
  formatPhoneNumber,
  formatAddress,
  formatFileSize,
  formatDuration,
  formatUrlForDisplay,
  truncateUrl,
  pluralize,
  formatList,
};
