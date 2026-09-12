// D:\Projects\Kalwanga\packages\web\app\(dashboard)\admin\shifts\page.tsx
import { Metadata } from 'next';
import { ShiftsDashboard } from '../../../../components/shifts/ShiftsDashboard';

export const metadata: Metadata = {
  title: 'Shift Management | Admin',
  description: 'Manage cash registers, shifts, and transactions',
};

export default function AdminShiftsPage() {
  return <ShiftsDashboard />;
}
