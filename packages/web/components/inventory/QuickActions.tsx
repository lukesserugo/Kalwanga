'use client';

import React from 'react';
import { Plus, Truck, Upload, Download, Scan, BarChart3, Bell } from 'lucide-react';

interface QuickActionsProps {
  onAction: (action: string) => void;
  permissions: {
    canCreate: boolean;
    canTransfer: boolean;
    canAdjust: boolean;
    canExport: boolean;
  };
}

export function QuickActions({ onAction, permissions }: QuickActionsProps) {
  const actions = [
    { id: 'add', label: 'Add Item', icon: Plus, show: permissions.canCreate },
    { id: 'transfer', label: 'Transfer', icon: Truck, show: permissions.canTransfer },
    { id: 'import', label: 'Import', icon: Upload, show: permissions.canCreate },
    { id: 'export', label: 'Export', icon: Download, show: permissions.canExport },
    { id: 'low-stock', label: 'Low Stock', icon: Bell, show: true },
    { id: 'reports', label: 'Reports', icon: BarChart3, show: true },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.filter(a => a.show).map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 transition-colors"
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
