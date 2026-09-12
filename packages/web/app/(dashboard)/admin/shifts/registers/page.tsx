// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\shifts\registers\page.tsx
import { Metadata } from 'next';
import { RegisterManagement } from '../../../../../components/shifts/RegisterManagement';

export const metadata: Metadata = {
  title: 'Cash Registers | Admin',
  description: 'Manage cash registers',
};

export default function AdminRegistersPage() {
  return <RegisterManagement />;
}
