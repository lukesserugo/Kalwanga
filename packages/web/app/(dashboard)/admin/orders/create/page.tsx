// packages/web/app/(dashboard)/admin/orders/create/page.tsx
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { OrderForm } from '../../../../../components/orders/OrderForm';

export default function CreateOrderPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin/orders"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Create Order
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Build a new order — pick a customer, add items, choose payment
            </p>
          </div>
        </div>

        <OrderForm mode="order" />
      </div>
    </div>
  );
}
