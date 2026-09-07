// D:\Projects\Kalwanga\packages\web\components\suppliers\SupplierGrid.tsx

'use client';

import React from 'react';
import { Supplier } from '../../types/supplier';
import { SupplierCard } from './SupplierCard';

interface SupplierGridProps {
  suppliers: Supplier[];
  onEdit?: (supplier: Supplier) => void;
  onDelete?: (supplier: Supplier) => void;
  onView?: (supplier: Supplier) => void;
  isLoading?: boolean;
  className?: string;
  emptyMessage?: string;
  emptySubMessage?: string;
  columns?: 2 | 3 | 4;
}

export function SupplierGrid({
  suppliers,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  className = '',
  emptyMessage = 'No suppliers found',
  emptySubMessage = 'Start by adding your first supplier',
  columns = 3
}: SupplierGridProps) {
  const columnClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  if (isLoading) {
    return (
      <div className={`grid ${columnClasses[columns]} gap-4 ${className}`}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-gray-100 dark:bg-gray-700 rounded-xl h-48 animate-pulse" />
        ))}
      </div>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🚚</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{emptyMessage}</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{emptySubMessage}</p>
      </div>
    );
  }

  return (
    <div className={`grid ${columnClasses[columns]} gap-4 ${className}`}>
      {suppliers.map((supplier) => (
        <SupplierCard
          key={supplier.id}
          supplier={supplier}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          showActions={true}
          variant="default"
        />
      ))}
    </div>
  );
}
