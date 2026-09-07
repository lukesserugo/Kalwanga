'use client';

import { useState } from 'react';
import { useToast } from '../../../hooks/useToast';

export default function ReportsPage() {
  const { showToast } = useToast();
  const [dateRange, setDateRange] = useState('week');

  const reportTypes = [
    { id: 'sales', name: 'Sales Report', description: 'View sales data and trends', icon: '📊' },
    { id: 'inventory', name: 'Inventory Report', description: 'Track stock levels and movement', icon: '📦' },
    { id: 'customers', name: 'Customer Report', description: 'Analyze customer data and behavior', icon: '👥' },
    { id: 'products', name: 'Product Report', description: 'Top products and performance', icon: '🏷️' },
    { id: 'employees', name: 'Employee Report', description: 'Staff performance and sales', icon: '👤' },
    { id: 'payments', name: 'Payment Report', description: 'Payment methods and transactions', icon: '💳' },
  ];

  const handleGenerateReport = (reportId: string) => {
    showToast(`Generating ${reportId} report...`, 'success');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Generate and view business reports.</p>
        </div>
        <div className="flex gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-4xl mb-4">{report.icon}</div>
            <h3 className="text-lg font-semibold text-gray-900">{report.name}</h3>
            <p className="text-sm text-gray-600 mt-2">{report.description}</p>
            <button
              onClick={() => handleGenerateReport(report.id)}
              className="mt-4 text-blue-600 hover:text-blue-800 font-medium text-sm inline-flex items-center"
            >
              Generate Report
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Recent Reports */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reports</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <p className="font-medium text-gray-900">Sales Report - This Week</p>
              <p className="text-sm text-gray-500">Generated 2 hours ago</p>
            </div>
            <button className="text-blue-600 hover:text-blue-800 text-sm">
              Download
            </button>
          </div>
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <p className="font-medium text-gray-900">Inventory Report</p>
              <p className="text-sm text-gray-500">Generated yesterday</p>
            </div>
            <button className="text-blue-600 hover:text-blue-800 text-sm">
              Download
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Customer Report - Last Month</p>
              <p className="text-sm text-gray-500">Generated 3 days ago</p>
            </div>
            <button className="text-blue-600 hover:text-blue-800 text-sm">
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
