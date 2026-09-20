'use client';

// Try to import date-fns, fallback to native Date if not available
let format: any, formatDistanceToNow: any, parseISO: any;
try {
  const dateFns = require('date-fns');
  format = dateFns.format;
  formatDistanceToNow = dateFns.formatDistanceToNow;
  parseISO = dateFns.parseISO;
} catch (e) {
  // Fallback functions if date-fns is not installed
  format = (date: Date | string, formatStr: string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  formatDistanceToNow = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };
  parseISO = (dateStr: string) => new Date(dateStr);
}

interface Sale {
  id: string;
  receiptNumber: string;
  customerName?: string;
  total: number;
  createdAt: string;
  status: string;
  customer?: { firstName: string; lastName: string };
}

interface RecentSalesProps {
  sales: Sale[];
  onViewAll?: () => void;
  maxItems?: number;
}

export default function RecentSales({ sales, onViewAll, maxItems = 5 }: RecentSalesProps) {
  // Helper functions using native Date as fallback
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffDay > 0) return `${diffDay}d ago`;
      if (diffHour > 0) return `${diffHour}h ago`;
      if (diffMin > 0) return `${diffMin}m ago`;
      return `${diffSec}s ago`;
    } catch {
      return '';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-success-100 text-success-700 dark:bg-success-950/40 dark:text-success-300',
      PENDING: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300',
      CANCELLED: 'bg-danger-100 text-danger-700 dark:bg-danger-950/40 dark:text-danger-300',
      REFUNDED: 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400',
      PROCESSING: 'bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
      ON_HOLD: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      COMPLETED: '✓',
      PENDING: '⏳',
      CANCELLED: '✕',
      REFUNDED: '↺',
      PROCESSING: '⟳',
      ON_HOLD: '⏸',
    };
    return icons[status] || '•';
  };

  // Format sales data
  const formattedSales = sales?.map(s => ({
    id: s.id || '',
    receiptNumber: s.receiptNumber || 'N/A',
    customerName: s.customerName || s.customer?.firstName ?
      `${s.customer?.firstName || ''} ${s.customer?.lastName || ''}`.trim() || 'Guest' :
      'Guest',
    total: s.total || 0,
    createdAt: s.createdAt || new Date().toISOString(),
    status: s.status || 'COMPLETED',
  })) || [];

  const displaySales = formattedSales.slice(0, maxItems);

  if (displaySales.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Sales</h3>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors duration-250 focus-ring rounded"
            >
              View All
            </button>
          )}
        </div>
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">No recent sales</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-soft border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Sales</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Last {displaySales.length} transactions</p>
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors duration-250 focus-ring rounded"
          >
            View All →
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-6 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Receipt
              </th>
              <th className="px-6 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-2xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {displaySales.map((sale) => (
              <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-250">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                    #{sale.receiptNumber}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {sale.customerName || 'Guest'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                      {formatDate(sale.createdAt)}
                    </span>
                    <span className="text-2xs text-gray-400 dark:text-gray-500 tabular-nums">
                      {getRelativeTime(sale.createdAt)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(sale.total)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2.5 py-1 inline-flex items-center gap-1 text-2xs font-medium rounded-full ${getStatusColor(sale.status)}`}>
                    <span>{getStatusIcon(sale.status)}</span>
                    {sale.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {displaySales.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-2xs text-gray-500 dark:text-gray-400 tabular-nums">
            Showing {displaySales.length} of {formattedSales.length} sales
          </p>
        </div>
      )}
    </div>
  );
}
