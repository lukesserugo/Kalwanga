// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\business-units\[id]\edit\page.tsx

'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { BusinessUnitForm } from '../../../../../../components/business-units/BusinessUnitForm';

export default function EditBusinessUnitPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <BusinessUnitForm id={id} />
    </div>
  );
}
