// D:\Projects\Kalwanga\packages\web\components\inventory\QuickActions.tsx

'use client';

import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Truck, Upload, Download, Scan, BarChart3, Bell,
  Package, ShoppingCart, RefreshCw, Settings, Users,
  AlertTriangle, CheckCircle, DollarSign, MapPin,
  Building, Tag, FileText, Printer, QrCode, Barcode,
  ClipboardList, ClipboardCheck, ArrowUpDown, Filter,
  Eye, Edit, Trash2, Copy, Link, ExternalLink,
  HelpCircle, Info, Shield, Lock, Unlock, Star,
  Globe, Archive, Clock, Calendar, Hash, Weight,
  Percent, TrendingUp, TrendingDown, PieChart,
  Grid, List, LayoutGrid, ChevronDown, ChevronUp,
  X, Check, Loader2, AlertCircle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from '../../utils/toast-manager';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

// ============================================
// TYPES
// ============================================

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'indigo' | 'teal' | 'orange' | 'pink' | 'gray';
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  permission?: string;
  action: (() => void) | string;
  description?: string;
  badge?: string | number;
  disabled?: boolean;
  shortcut?: string;
  show?: boolean;
}

export interface QuickActionsProps {
  /** The action to perform when clicked */
  onAction: (action: string) => void;
  /** Permission configuration */
  permissions?: {
    canCreate?: boolean;
    canTransfer?: boolean;
    canAdjust?: boolean;
    canExport?: boolean;
    canImport?: boolean;
    canScan?: boolean;
    canViewReports?: boolean;
    canManage?: boolean;
  };
  /** Additional custom actions */
  customActions?: QuickAction[];
  /** Whether to show as compact */
  compact?: boolean;
  /** Whether to show labels */
  showLabels?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Title for the actions section */
  title?: string;
}

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_ACTIONS: Omit<QuickAction, 'action' | 'show'>[] = [
  { id: 'add', label: 'Add Item', icon: Plus, color: 'blue', variant: 'primary' },
  { id: 'scan', label: 'Scan Barcode', icon: Scan, color: 'indigo', variant: 'secondary' },
  { id: 'transfer', label: 'Transfer', icon: Truck, color: 'orange', variant: 'secondary' },
  { id: 'adjust', label: 'Adjust Stock', icon: ArrowUpDown, color: 'yellow', variant: 'secondary' },
  { id: 'import', label: 'Import', icon: Upload, color: 'purple', variant: 'secondary' },
  { id: 'export', label: 'Export', icon: Download, color: 'green', variant: 'secondary' },
  { id: 'low-stock', label: 'Low Stock', icon: Bell, color: 'red', variant: 'outline' },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: 'teal', variant: 'outline' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'gray', variant: 'ghost' },
];

// ============================================
// SUB-COMPONENTS
// ============================================

const ActionButton: React.FC<{
  action: QuickAction;
  compact?: boolean;
  showLabels?: boolean;
  onClick: () => void;
}> = ({ action, compact = false, showLabels = true, onClick }) => {
  const Icon = action.icon;
  
  const colorStyles: Record<string, { bg: string; text: string; hover: string; border: string }> = {
    blue: { 
      bg: 'bg-blue-50 dark:bg-blue-900/20', 
      text: 'text-blue-600 dark:text-blue-400', 
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
      border: 'border-blue-200 dark:border-blue-800/30'
    },
    green: { 
      bg: 'bg-green-50 dark:bg-green-900/20', 
      text: 'text-green-600 dark:text-green-400', 
      hover: 'hover:bg-green-100 dark:hover:bg-green-900/30',
      border: 'border-green-200 dark:border-green-800/30'
    },
    yellow: { 
      bg: 'bg-yellow-50 dark:bg-yellow-900/20', 
      text: 'text-yellow-600 dark:text-yellow-400', 
      hover: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
      border: 'border-yellow-200 dark:border-yellow-800/30'
    },
    red: { 
      bg: 'bg-red-50 dark:bg-red-900/20', 
      text: 'text-red-600 dark:text-red-400', 
      hover: 'hover:bg-red-100 dark:hover:bg-red-900/30',
      border: 'border-red-200 dark:border-red-800/30'
    },
    purple: { 
      bg: 'bg-purple-50 dark:bg-purple-900/20', 
      text: 'text-purple-600 dark:text-purple-400', 
      hover: 'hover:bg-purple-100 dark:hover:bg-purple-900/30',
      border: 'border-purple-200 dark:border-purple-800/30'
    },
    indigo: { 
      bg: 'bg-indigo-50 dark:bg-indigo-900/20', 
      text: 'text-indigo-600 dark:text-indigo-400', 
      hover: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30',
      border: 'border-indigo-200 dark:border-indigo-800/30'
    },
    teal: { 
      bg: 'bg-teal-50 dark:bg-teal-900/20', 
      text: 'text-teal-600 dark:text-teal-400', 
      hover: 'hover:bg-teal-100 dark:hover:bg-teal-900/30',
      border: 'border-teal-200 dark:border-teal-800/30'
    },
    orange: { 
      bg: 'bg-orange-50 dark:bg-orange-900/20', 
      text: 'text-orange-600 dark:text-orange-400', 
      hover: 'hover:bg-orange-100 dark:hover:bg-orange-900/30',
      border: 'border-orange-200 dark:border-orange-800/30'
    },
    pink: { 
      bg: 'bg-pink-50 dark:bg-pink-900/20', 
      text: 'text-pink-600 dark:text-pink-400', 
      hover: 'hover:bg-pink-100 dark:hover:bg-pink-900/30',
      border: 'border-pink-200 dark:border-pink-800/30'
    },
    gray: { 
      bg: 'bg-gray-50 dark:bg-gray-800/50', 
      text: 'text-gray-600 dark:text-gray-400', 
      hover: 'hover:bg-gray-100 dark:hover:bg-gray-700/50',
      border: 'border-gray-200 dark:border-gray-700/50'
    },
  };

  const variantStyles: Record<string, { base: string; active: string }> = {
    primary: {
      base: 'bg-blue-600 text-white hover:bg-blue-700 border-blue-600',
      active: 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900'
    },
    secondary: {
      base: '',
      active: ''
    },
    outline: {
      base: 'bg-transparent border-2 hover:bg-gray-50 dark:hover:bg-gray-700/50',
      active: ''
    },
    ghost: {
      base: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700/50 border-transparent',
      active: ''
    },
  };

  const variant = action.variant || 'secondary';
  const isPrimary = variant === 'primary';
  const colors = colorStyles[action.color || 'blue'] || colorStyles.blue;
  const variantStyle = variantStyles[variant] || variantStyles.secondary;

  const baseClasses = compact 
    ? 'p-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : 'px-3 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium';

  const bgClasses = isPrimary 
    ? variantStyle.base
    : `${colors.bg} ${colors.text} ${colors.hover} border ${colors.border}`;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={action.disabled}
      className={`${baseClasses} ${bgClasses} ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''} relative`}
      title={action.description || action.label}
    >
      <Icon className={`${compact ? 'w-4 h-4' : 'w-4 h-4'} ${isPrimary ? 'text-current' : ''}`} />
      {!compact && showLabels && (
        <span className="hidden sm:inline">{action.label}</span>
      )}
      {action.badge && (
        <span className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-xs rounded-full bg-red-500 text-white min-w-[18px] text-center`}>
          {action.badge}
        </span>
      )}
      {action.shortcut && !compact && (
        <kbd className="hidden ml-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
          {action.shortcut}
        </kbd>
      )}
    </motion.button>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export function QuickActions({ 
  onAction, 
  permissions = {},
  customActions = [],
  compact = false,
  showLabels = true,
  className = '',
  loading = false,
  title,
}: QuickActionsProps) {
  const router = useRouter();
  const { hasPermission } = usePermission();

  // Default permissions
  const {
    canCreate = false,
    canTransfer = false,
    canAdjust = false,
    canExport = false,
    canImport = false,
    canScan = true,
    canViewReports = true,
    canManage = false,
  } = permissions;

  // Build actions based on permissions
  const builtActions = useMemo(() => {
    const actions: QuickAction[] = [];

    // Add action
    if (canCreate || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find(a => a.id === 'add')!,
        action: 'add',
        show: true,
      });
    }

    // Scan action (always available)
    if (canScan) {
      actions.push({
        ...DEFAULT_ACTIONS.find(a => a.id === 'scan')!,
        action: 'scan',
        show: true,
      });
    }

    // Transfer action
    if (canTransfer || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find(a => a.id === 'transfer')!,
        action: 'transfer',
        show: true,
      });
    }

    // Adjust action
    if (canAdjust || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find(a => a.id === 'adjust')!,
        action: 'adjust',
        show: true,
      });
    }

    // Import action
    if (canImport || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find(a => a.id === 'import')!,
        action: 'import',
        show: true,
      });
    }

    // Export action
    if (canExport || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find(a => a.id === 'export')!,
        action: 'export',
        show: true,
      });
    }

    // Low stock action (always available)
    actions.push({
      ...DEFAULT_ACTIONS.find(a => a.id === 'low-stock')!,
      action: 'low-stock',
      show: true,
    });

    // Reports action
    if (canViewReports || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find(a => a.id === 'reports')!,
        action: 'reports',
        show: true,
      });
    }

    // Settings action
    if (canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find(a => a.id === 'settings')!,
        action: 'settings',
        show: true,
        variant: 'ghost',
        color: 'gray',
      });
    }

    // Add custom actions
    customActions.forEach(custom => {
      actions.push({
        ...custom,
        show: custom.show !== undefined ? custom.show : true,
      });
    });

    return actions.filter(a => a.show !== false);
  }, [canCreate, canTransfer, canAdjust, canExport, canImport, canScan, canViewReports, canManage, customActions]);

  const handleAction = (action: QuickAction) => {
    if (loading) return;
    
    if (typeof action.action === 'function') {
      action.action();
    } else {
      onAction(action.action);
    }
  };

  if (loading) {
    return (
      <div className={`flex flex-wrap gap-2 ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${compact ? 'w-10 h-10' : 'w-24 h-10'} bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse`} />
        ))}
      </div>
    );
  }

  if (builtActions.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {title && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{title}</p>
      )}
      <div className={`flex flex-wrap items-center gap-2 ${compact ? 'gap-1' : ''}`}>
        <AnimatePresence mode="wait">
          {builtActions.map((action, index) => (
            <motion.div
              key={action.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.03 }}
            >
              <ActionButton
                action={action}
                compact={compact}
                showLabels={showLabels}
                onClick={() => handleAction(action)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================
// PRESET COMPONENTS
// ============================================

/**
 * Full action bar with all actions
 */
export function FullQuickActions(props: Omit<QuickActionsProps, 'compact'>) {
  return <QuickActions {...props} compact={false} showLabels={true} />;
}

/**
 * Compact action bar for dashboards
 */
export function CompactQuickActions(props: Omit<QuickActionsProps, 'compact'>) {
  return <QuickActions {...props} compact={true} showLabels={false} />;
}

/**
 * Minimal action bar with only primary actions
 */
export function MinimalQuickActions(props: Omit<QuickActionsProps, 'customActions'>) {
  return (
    <QuickActions 
      {...props} 
      compact={false} 
      showLabels={true}
      customActions={[]}
    />
  );
}

// ============================================
// EXPORT
// ============================================

export default QuickActions;
