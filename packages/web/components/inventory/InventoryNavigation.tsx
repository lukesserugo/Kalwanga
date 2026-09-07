'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package, Plus, Truck, History, Building, ClipboardList,
  Settings, BarChart3, AlertTriangle, Upload, Tag, Shield,
  DollarSign, FolderTree
} from 'lucide-react';
import { ROUTES } from '../../utils/routeMapping';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
}

export function InventoryNavigation() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: ROUTES.INVENTORY.DASHBOARD, icon: <Package className="w-4 h-4" /> },
    { label: 'Add Item', path: ROUTES.INVENTORY.ADD, icon: <Plus className="w-4 h-4" />, permission: 'inventory:create' },
    { label: 'Transfer', path: ROUTES.INVENTORY.TRANSFER, icon: <Truck className="w-4 h-4" />, permission: 'inventory:transfer' },
    { label: 'Transactions', path: ROUTES.INVENTORY.TRANSACTIONS, icon: <History className="w-4 h-4" />, permission: 'inventory:view_audit' },
    { label: 'Suppliers', path: ROUTES.INVENTORY.SUPPLIERS, icon: <Building className="w-4 h-4" />, permission: 'inventory:manage_suppliers' },
    { label: 'Stock Count', path: ROUTES.INVENTORY.STOCK_COUNT, icon: <ClipboardList className="w-4 h-4" />, permission: 'inventory:adjust' },
    { label: 'Settings', path: ROUTES.INVENTORY.SETTINGS, icon: <Settings className="w-4 h-4" />, permission: 'inventory:manage_settings' },
    { label: 'Reports', path: ROUTES.INVENTORY.REPORTS, icon: <BarChart3 className="w-4 h-4" />, permission: 'inventory:view_reports' },
    { label: 'Low Stock', path: ROUTES.INVENTORY.LOW_STOCK, icon: <AlertTriangle className="w-4 h-4" />, permission: 'inventory:view_low_stock' },
    { label: 'Import', path: ROUTES.INVENTORY.IMPORT, icon: <Upload className="w-4 h-4" />, permission: 'inventory:import' },
    { label: 'Categories', path: ROUTES.INVENTORY.CATEGORIES, icon: <FolderTree className="w-4 h-4" />, permission: 'inventory:manage_categories' },
    { label: 'Audit', path: ROUTES.INVENTORY.AUDIT, icon: <Shield className="w-4 h-4" />, permission: 'inventory:view_audit' },
    { label: 'Valuation', path: ROUTES.INVENTORY.VALUATION, icon: <DollarSign className="w-4 h-4" />, permission: 'inventory:view_reports' },
  ];

  const isActive = (path: string) => {
    return pathname === path || pathname?.startsWith(`${path}/`);
  };

  return (
    <nav className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
      {navItems.map((item) => (
        <Link
          key={item.path}
          href={item.path}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            isActive(item.path)
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {item.icon}
          <span className="hidden sm:inline">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
