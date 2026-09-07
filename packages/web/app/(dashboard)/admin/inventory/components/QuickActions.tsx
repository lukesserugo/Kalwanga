// D:\Projects\Kalwanga\packages\web\app\(dashboard)\inventory\components\QuickActions.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Truck, Upload, Download, Scan,
  BarChart3, Settings, Tag, Users
} from 'lucide-react';

interface QuickActionsProps {
  onAction: (action: string) => void;
  permissions: {
    canCreate: boolean;
    canTransfer: boolean;
    canAdjust: boolean;
    canExport: boolean;
  };
}

const actions = [
  { id: 'add', label: 'Add Item', icon: Plus, color: 'blue', permission: 'canCreate' },
  { id: 'transfer', label: 'Transfer Stock', icon: Truck, color: 'green', permission: 'canTransfer' },
  { id: 'import', label: 'Import', icon: Upload, color: 'purple', permission: 'canCreate' },
  { id: 'export', label: 'Export', icon: Download, color: 'indigo', permission: 'canExport' },
  { id: 'scan', label: 'Scan Barcode', icon: Scan, color: 'orange', permission: null },
  { id: 'reports', label: 'Reports', icon: BarChart3, color: 'pink', permission: null },
];

export function QuickActions({ onAction, permissions }: QuickActionsProps) {
  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; hoverBg: string; text: string }> = {
      blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', hoverBg: 'hover:bg-blue-100 dark:hover:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
      green: { bg: 'bg-green-50 dark:bg-green-900/20', hoverBg: 'hover:bg-green-100 dark:hover:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
      purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', hoverBg: 'hover:bg-purple-100 dark:hover:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
      indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', hoverBg: 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400' },
      orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', hoverBg: 'hover:bg-orange-100 dark:hover:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400' },
      pink: { bg: 'bg-pink-50 dark:bg-pink-900/20', hoverBg: 'hover:bg-pink-100 dark:hover:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400' },
    };
    return colors[color] || colors.blue;
  };

  const filteredActions = actions.filter(action => {
    if (action.permission === null) return true;
    return permissions[action.permission as keyof typeof permissions] !== false;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {filteredActions.map((action, index) => {
        const colors = getColorClasses(action.color);
        const Icon = action.icon;

        return (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onAction(action.id)}
            className={`${colors.bg} ${colors.hoverBg} rounded-xl p-4 text-center transition-all duration-200 hover:shadow-md group`}
          >
            <div className={`flex justify-center ${colors.text}`}>
              <Icon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            </div>
            <p className={`text-xs font-medium mt-2 ${colors.text}`}>{action.label}</p>
          </motion.button>
        );
      })}
    </div>
  );
}
