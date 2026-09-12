// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\orders\page.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { OrderList } from '../../../../components/orders/OrderList';

export default function AdminOrdersPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <OrderList />
    </div>
  );
}
