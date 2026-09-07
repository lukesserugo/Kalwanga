// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\companies\[id]\edit\page.tsx

'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { CompanyForm } from '../../components/CompanyForm';

export default function EditCompanyPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <CompanyForm id={id} />
    </div>
  );
}
