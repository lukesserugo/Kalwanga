// src/components/dashboard/SalesChart.tsx
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

interface SalesChartProps {
  data: Array<{
    date: string;
    revenue: number;
    orders: number;
  }>;
}

export function SalesChart({ data }: SalesChartProps) {
  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formattedData}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F97316" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16A34A" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-gray-200 dark:stroke-gray-700"
        />
        <XAxis dataKey="date" className="text-2xs tabular-nums" />
        <YAxis yAxisId="left" className="text-2xs tabular-nums" />
        <YAxis
          yAxisId="right"
          orientation="right"
          className="text-2xs tabular-nums"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgb(var(--surface))',
            border: '1px solid rgb(var(--border))',
            borderRadius: '0.75rem',
            boxShadow:
              '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
            color: 'rgb(var(--foreground))',
          }}
          labelStyle={{ color: 'rgb(var(--foreground))' }}
        />
        <Legend />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#F97316"
          strokeWidth={2}
          fill="url(#colorRevenue)"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="orders"
          name="Orders"
          stroke="#16A34A"
          strokeWidth={2}
          fill="url(#colorOrders)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default SalesChart;
