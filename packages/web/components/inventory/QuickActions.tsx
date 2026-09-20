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
  X, Check, Loader2, AlertCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from '../../utils/toast-manager';
import { usePermission } from '../../hooks/usePermission';
import { PermissionResource } from '../../types/enums';

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  color?:
    | 'blue'
    | 'green'
    | 'yellow'
    | 'red'
    | 'purple'
    | 'indigo'
    | 'teal'
    | 'orange'
    | 'pink'
    | 'gray';
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
  onAction: (action: string) => void;
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
  customActions?: QuickAction[];
  compact?: boolean;
  showLabels?: boolean;
  className?: string;
  loading?: boolean;
  title?: string;
}

const DEFAULT_ACTIONS: Omit<QuickAction, 'action' | 'show'>[] = [
  {
    id: 'add',
    label: 'Add Item',
    icon: Plus,
    color: 'blue',
    variant: 'primary',
  },
  {
    id: 'scan',
    label: 'Scan Barcode',
    icon: Scan,
    color: 'indigo',
    variant: 'secondary',
  },
  {
    id: 'transfer',
    label: 'Transfer',
    icon: Truck,
    color: 'orange',
    variant: 'secondary',
  },
  {
    id: 'adjust',
    label: 'Adjust Stock',
    icon: ArrowUpDown,
    color: 'yellow',
    variant: 'secondary',
  },
  {
    id: 'import',
    label: 'Import',
    icon: Upload,
    color: 'purple',
    variant: 'secondary',
  },
  {
    id: 'export',
    label: 'Export',
    icon: Download,
    color: 'green',
    variant: 'secondary',
  },
  {
    id: 'low-stock',
    label: 'Low Stock',
    icon: Bell,
    color: 'red',
    variant: 'outline',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    color: 'teal',
    variant: 'outline',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    color: 'gray',
    variant: 'ghost',
  },
];

const ActionButton: React.FC<{
  action: QuickAction;
  compact?: boolean;
  showLabels?: boolean;
  onClick: () => void;
}> = ({ action, compact = false, showLabels = true, onClick }) => {
  const Icon = action.icon;

  const colorStyles: Record<
    string,
    { bg: string; text: string; hover: string; border: string }
  > = {
    blue: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
      hover: 'hover:bg-brand-100 dark:hover:bg-brand-900/30',
      border: 'border-brand-200 dark:border-brand-800/30',
    },
    green: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
      hover: 'hover:bg-success-100 dark:hover:bg-success-900/30',
      border: 'border-success-200 dark:border-success-800/30',
    },
    yellow: {
      bg: 'bg-warning-50 dark:bg-warning-900/20',
      text: 'text-warning-600 dark:text-warning-400',
      hover: 'hover:bg-warning-100 dark:hover:bg-warning-900/30',
      border: 'border-warning-200 dark:border-warning-800/30',
    },
    red: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      text: 'text-danger-600 dark:text-danger-400',
      hover: 'hover:bg-danger-100 dark:hover:bg-danger-900/30',
      border: 'border-danger-200 dark:border-danger-800/30',
    },
    purple: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
      hover: 'hover:bg-secondary-100 dark:hover:bg-secondary-900/30',
      border: 'border-secondary-200 dark:border-secondary-800/30',
    },
    indigo: {
      bg: 'bg-secondary-50 dark:bg-secondary-900/20',
      text: 'text-secondary-600 dark:text-secondary-400',
      hover: 'hover:bg-secondary-100 dark:hover:bg-secondary-900/30',
      border: 'border-secondary-200 dark:border-secondary-800/30',
    },
    teal: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      text: 'text-success-600 dark:text-success-400',
      hover: 'hover:bg-success-100 dark:hover:bg-success-900/30',
      border: 'border-success-200 dark:border-success-800/30',
    },
    orange: {
      bg: 'bg-brand-50 dark:bg-brand-900/20',
      text: 'text-brand-600 dark:text-brand-400',
      hover: 'hover:bg-brand-100 dark:hover:bg-brand-900/30',
      border: 'border-brand-200 dark:border-brand-800/30',
    },
    pink: {
      bg: 'bg-brand-accent-50 dark:bg-brand-accent-900/20',
      text: 'text-brand-accent-600 dark:text-brand-accent-400',
      hover: 'hover:bg-brand-accent-100 dark:hover:bg-brand-accent-900/30',
      border: 'border-brand-accent-200 dark:border-brand-accent-800/30',
    },
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-800/50',
      text: 'text-gray-600 dark:text-gray-400',
      hover: 'hover:bg-orange-50 dark:hover:bg-gray-700/50',
      border: 'border-gray-200 dark:border-gray-700/50',
    },
  };

  const variantStyles: Record<string, { base: string; active: string }> = {
    primary: {
      base: 'bg-brand-gradient text-white shadow-brand hover:shadow-brand-lg border-brand-500',
      active:
        'ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-gray-900',
    },
    secondary: {
      base: '',
      active: '',
    },
    outline: {
      base: 'bg-transparent border-2 hover:bg-orange-50 dark:hover:bg-gray-700/50',
      active: '',
    },
    ghost: {
      base: 'bg-transparent hover:bg-orange-50 dark:hover:bg-gray-700/50 border-transparent',
      active: '',
    },
  };

  const variant = action.variant || 'secondary';
  const isPrimary = variant === 'primary';
  const colors = colorStyles[action.color || 'blue'] || colorStyles.blue;
  const variantStyle = variantStyles[variant] || variantStyles.secondary;

  const baseClasses = compact
    ? 'p-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring'
    : 'px-3 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium focus-ring';

  const bgClasses = isPrimary
    ? variantStyle.base
    : `${colors.bg} ${colors.text} ${colors.hover} border ${colors.border}`;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={action.disabled}
      className={`${baseClasses} ${bgClasses} ${
        action.disabled ? 'opacity-50 cursor-not-allowed' : ''
      } relative`}
      title={action.description || action.label}
    >
      <Icon
        className={`${compact ? 'w-4 h-4' : 'w-4 h-4'} ${
          isPrimary ? 'text-current' : ''
        }`}
      />
      {!compact && showLabels && (
        <span className="hidden sm:inline">{action.label}</span>
      )}
      {action.badge && (
        <span
          className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-2xs rounded-full bg-danger-500 text-white min-w-[18px] text-center tabular-nums`}
        >
          {action.badge}
        </span>
      )}
      {action.shortcut && !compact && (
        <kbd className="hidden ml-1 text-2xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
          {action.shortcut}
        </kbd>
      )}
    </motion.button>
  );
};

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

  const builtActions = useMemo(() => {
    const actions: QuickAction[] = [];

    if (canCreate || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find((a) => a.id === 'add')!,
        action: 'add',
        show: true,
      });
    }

    if (canScan) {
      actions.push({
        ...DEFAULT_ACTIONS.find((a) => a.id === 'scan')!,
        action: 'scan',
        show: true,
      });
    }

    if (canTransfer || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find((a) => a.id === 'transfer')!,
        action: 'transfer',
        show: true,
      });
    }

    if (canAdjust || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find((a) => a.id === 'adjust')!,
        action: 'adjust',
        show: true,
      });
    }

    if (canImport || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find((a) => a.id === 'import')!,
        action: 'import',
        show: true,
      });
    }

    if (canExport || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find((a) => a.id === 'export')!,
        action: 'export',
        show: true,
      });
    }

    actions.push({
      ...DEFAULT_ACTIONS.find((a) => a.id === 'low-stock')!,
      action: 'low-stock',
      show: true,
    });

    if (canViewReports || canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find((a) => a.id === 'reports')!,
        action: 'reports',
        show: true,
      });
    }

    if (canManage) {
      actions.push({
        ...DEFAULT_ACTIONS.find((a) => a.id === 'settings')!,
        action: 'settings',
        show: true,
        variant: 'ghost',
        color: 'gray',
      });
    }

    customActions.forEach((custom) => {
      actions.push({
        ...custom,
        show: custom.show !== undefined ? custom.show : true,
      });
    });

    return actions.filter((a) => a.show !== false);
  }, [
    canCreate,
    canTransfer,
    canAdjust,
    canExport,
    canImport,
    canScan,
    canViewReports,
    canManage,
    customActions,
  ]);

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
          <div
            key={i}
            className={`${
              compact ? 'w-10 h-10' : 'w-24 h-10'
            } bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse`}
          />
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
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {title}
        </p>
      )}
      <div
        className={`flex flex-wrap items-center gap-2 ${
          compact ? 'gap-1' : ''
        }`}
      >
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

export function FullQuickActions(props: Omit<QuickActionsProps, 'compact'>) {
  return <QuickActions {...props} compact={false} showLabels={true} />;
}

export function CompactQuickActions(
  props: Omit<QuickActionsProps, 'compact'>
) {
  return <QuickActions {...props} compact={true} showLabels={false} />;
}

export function MinimalQuickActions(
  props: Omit<QuickActionsProps, 'customActions'>
) {
  return (
    <QuickActions
      {...props}
      compact={false}
      showLabels={true}
      customActions={[]}
    />
  );
}

export default QuickActions;
