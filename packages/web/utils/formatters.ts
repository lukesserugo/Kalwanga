// D:\Projects\Kalwanga\packages\web\utils\formatters.ts

export const formatters = {
  /**
   * Format a number as currency
   */
  currency: (amount: number, currency: string = 'USD', locale: string = 'en-US'): string => {
    if (amount === undefined || amount === null) return '$0.00';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Format a date to a readable string
   */
  date: (date: string | Date): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  },

  /**
   * Format a date to a full date-time string
   */
  dateTime: (date: string | Date): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(d);
  },

  /**
   * Format a date to a time string
   */
  time: (date: string | Date): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  },

  /**
   * Format a date to a short date string (e.g., "Jan 1, 2024")
   */
  shortDate: (date: string | Date): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  },

  /**
   * Format a date to ISO string (YYYY-MM-DD)
   */
  isoDate: (date: string | Date): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().split('T')[0];
  },

  /**
   * Get relative time (e.g., "2 hours ago")
   * 🔥 Alias: formatTimeAgo, formatRelativeTime
   */
  relativeTime: (date: string | Date): string => {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(diff / 604800000);
    const months = Math.floor(diff / 2592000000);
    const years = Math.floor(diff / 31536000000);

    if (diff < 0) {
      const futureDiff = Math.abs(diff);
      const futureMinutes = Math.floor(futureDiff / 60000);
      const futureHours = Math.floor(futureDiff / 3600000);
      const futureDays = Math.floor(futureDiff / 86400000);
      if (futureMinutes < 1) return 'Just now';
      if (futureMinutes < 60) return `in ${futureMinutes}m`;
      if (futureHours < 24) return `in ${futureHours}h`;
      if (futureDays < 7) return `in ${futureDays}d`;
      return formatters.date(d);
    }

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
  },

  /**
   * 🔥 Alias for relativeTime - for compatibility with ProductReviews
   */
  timeAgo: (date: string | Date): string => {
    return formatters.relativeTime(date);
  },

  /**
   * Format a number with commas and decimals
   */
  number: (num: number, decimals: number = 2): string => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  },

  /**
   * Format a number as a percentage
   */
  percent: (num: number, decimals: number = 1): string => {
    if (num === undefined || num === null) return '0%';
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num / 100);
  },

  /**
   * Format a number as a compact string (K, M, B)
   */
  compactNumber: (num: number): string => {
    if (num === undefined || num === null) return '0';
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(num);
  },

  /**
   * Format a number with ordinal suffix (1st, 2nd, 3rd, 4th)
   */
  ordinal: (num: number): string => {
    if (num === undefined || num === null) return '0th';
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const value = num % 100;
    return num + (suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0]);
  },

  /**
   * Truncate text to a specified length
   */
  truncate: (str: string, length: number = 50): string => {
    if (!str) return '';
    if (str.length <= length) return str;
    return str.slice(0, length - 3) + '...';
  },

  /**
   * Capitalize the first letter of a string
   */
  capitalize: (str: string): string => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Capitalize the first letter of each word
   */
  capitalizeWords: (str: string): string => {
    if (!str) return '';
    return str.split(' ').map(word => formatters.capitalize(word)).join(' ');
  },

  /**
   * Convert a string to title case
   */
  titleCase: (str: string): string => {
    if (!str) return '';
    return str
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  },

  /**
   * Convert a string to sentence case
   */
  sentenceCase: (str: string): string => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Format a phone number
   */
  phone: (phone: string): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  },

  /**
   * Format file size in bytes to a human-readable string
   */
  fileSize: (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  /**
   * Format seconds to a human-readable duration
   */
  duration: (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ${minutes % 60}m`;
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  },

  /**
   * Format a URL for display (remove protocol)
   */
  urlDisplay: (url: string): string => {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '');
  },

  /**
   * Get plural form of a word based on count
   */
  pluralize: (word: string, count: number): string => {
    if (count === 1) return word;
    return word + 's';
  },

  /**
   * Format a list of items with commas and 'and'
   */
  formatList: (items: string[]): string => {
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return items.join(' and ');
    return items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1];
  },

  /**
   * Format a date range
   */
  dateRange: (startDate: string | Date, endDate: string | Date): string => {
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    return `${formatters.shortDate(start)} - ${formatters.shortDate(end)}`;
  },

  /**
   * Format an address
   */
  address: (address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  }): string => {
    const parts = [address.street, address.city, address.state, address.zip, address.country].filter(Boolean);
    return parts.join(', ');
  },

  /**
   * Format a number with leading zeros
   */
  padZero: (num: number, length: number = 2): string => {
    return num.toString().padStart(length, '0');
  },

  /**
   * Format a status with color
   */
  statusWithColor: (status: string, colorMap: Record<string, string>): string => {
    const color = colorMap[status] || 'gray';
    return `<span class="status-badge status-${color}">${status}</span>`;
  },

  /**
   * Format a payment method with icon
   */
  paymentMethodWithIcon: (method: string, iconMap: Record<string, string>): string => {
    const icon = iconMap[method] || '💳';
    return `<span class="payment-method">${icon} ${method}</span>`;
  },

  // ============================================
  // SALES-SPECIFIC FORMATTERS
  // ============================================

  /**
   * Format a receipt number with prefix
   */
  receiptNumber: (number: string | number, prefix: string = 'RCP'): string => {
    const num = typeof number === 'number' ? number.toString().padStart(6, '0') : number;
    return `${prefix}-${num}`;
  },

  /**
   * Format an invoice number with prefix
   */
  invoiceNumber: (number: string | number, prefix: string = 'INV'): string => {
    const num = typeof number === 'number' ? number.toString().padStart(6, '0') : number;
    return `${prefix}-${num}`;
  },

  /**
   * Format a return number with prefix
   */
  returnNumber: (number: string | number, prefix: string = 'RET'): string => {
    const num = typeof number === 'number' ? number.toString().padStart(6, '0') : number;
    return `${prefix}-${num}`;
  },

  /**
   * Format a refund number with prefix
   */
  refundNumber: (number: string | number, prefix: string = 'REF'): string => {
    const num = typeof number === 'number' ? number.toString().padStart(6, '0') : number;
    return `${prefix}-${num}`;
  },

  /**
   * Format a status label (convert to readable format)
   */
  statusLabel: (status: string): string => {
    if (!status) return '';
    return status
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  },

  /**
   * Format a payment method label (convert to readable format)
   */
  paymentMethodLabel: (method: string): string => {
    if (!method) return '';
    return method
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  },

  /**
   * Format a quantity with unit
   */
  quantity: (qty: number, unit: string = ''): string => {
    if (unit) {
      return `${formatters.number(qty, 0)} ${unit}`;
    }
    return formatters.number(qty, 0);
  },

  /**
   * Format a discount amount
   */
  discount: (amount: number, isPercentage: boolean = false): string => {
    if (isPercentage) {
      return `${amount}%`;
    }
    return formatters.currency(amount);
  },

  /**
   * Format tax amount
   */
  tax: (amount: number, rate: number = 0.08): string => {
    const taxAmount = amount * rate;
    return formatters.currency(taxAmount);
  },

  /**
   * Format a subtotal
   */
  subtotal: (items: Array<{ quantity: number; unitPrice: number }>): string => {
    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    return formatters.currency(total);
  },

  /**
   * Format change amount
   */
  change: (paid: number, total: number): string => {
    const changeAmount = paid - total;
    if (changeAmount < 0) return formatters.currency(0);
    return formatters.currency(changeAmount);
  },

  /**
   * Format a sale summary
   */
  saleSummary: (sale: {
    total: number;
    tax: number;
    discount: number;
    subtotal: number;
  }): string => {
    return `Subtotal: ${formatters.currency(sale.subtotal)} | Tax: ${formatters.currency(sale.tax)} | Discount: ${formatters.currency(sale.discount)} | Total: ${formatters.currency(sale.total)}`;
  },

  /**
   * Format a time range
   */
  timeRange: (start: string | Date, end: string | Date): string => {
    const startTime = formatters.time(start);
    const endTime = formatters.time(end);
    return `${startTime} - ${endTime}`;
  },

  /**
   * Format a percentage change
   */
  percentageChange: (current: number, previous: number): string => {
    if (previous === 0) return '∞';
    const change = ((current - previous) / previous) * 100;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  },
};

// ============================================
// EXPORT INDIVIDUAL FUNCTIONS FOR CONVENIENCE
// ============================================

export const formatCurrency = formatters.currency;
export const formatDate = formatters.date;
export const formatDateTime = formatters.dateTime;
export const formatTime = formatters.time;
export const formatShortDate = formatters.shortDate;
export const formatISODate = formatters.isoDate;
export const formatRelativeTime = formatters.relativeTime;
export const formatNumber = formatters.number;
export const formatPercent = formatters.percent;
export const formatCompactNumber = formatters.compactNumber;
export const formatOrdinal = formatters.ordinal;
export const truncateString = formatters.truncate;
export const capitalizeString = formatters.capitalize;
export const capitalizeWords = formatters.capitalizeWords;
export const toTitleCase = formatters.titleCase;
export const toSentenceCase = formatters.sentenceCase;
export const formatPhoneNumber = formatters.phone;
export const formatFileSize = formatters.fileSize;
export const formatDuration = formatters.duration;
export const formatUrlForDisplay = formatters.urlDisplay;
export const pluralize = formatters.pluralize;
export const formatList = formatters.formatList;
export const formatDateRange = formatters.dateRange;
export const formatAddress = formatters.address;
export const padZero = formatters.padZero;
export const statusWithColor = formatters.statusWithColor;
export const paymentMethodWithIcon = formatters.paymentMethodWithIcon;

// ============================================
// EXPORT SALES-SPECIFIC FORMATTERS
// ============================================

export const formatReceiptNumber = formatters.receiptNumber;
export const formatInvoiceNumber = formatters.invoiceNumber;
export const formatReturnNumber = formatters.returnNumber;
export const formatRefundNumber = formatters.refundNumber;
export const formatStatusLabel = formatters.statusLabel;
export const formatPaymentMethodLabel = formatters.paymentMethodLabel;
export const formatQuantity = formatters.quantity;
export const formatDiscount = formatters.discount;
export const formatTax = formatters.tax;
export const formatSubtotal = formatters.subtotal;
export const formatChange = formatters.change;
export const formatSaleSummary = formatters.saleSummary;
export const formatTimeRange = formatters.timeRange;
export const formatPercentageChange = formatters.percentageChange;

// ============================================
// 🔥 FIXED: EXPORT formatTimeAgo AS ALIAS FOR COMPATIBILITY
// ============================================

/**
 * 🔥 Alias for formatRelativeTime
 * Used by ProductReviews component and other components
 */
export const formatTimeAgo = formatters.relativeTime;

// ============================================
// DEFAULT EXPORT
// ============================================

export default formatters;
