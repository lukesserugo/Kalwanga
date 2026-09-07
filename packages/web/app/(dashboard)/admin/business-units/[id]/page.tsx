// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\business-units\[id]\page.tsx

'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { BusinessUnitDetail } from '../../../../../components/business-units/BusinessUnitDetail';

export default function BusinessUnitDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <BusinessUnitDetail id={id} />
    </div>
  );
}
