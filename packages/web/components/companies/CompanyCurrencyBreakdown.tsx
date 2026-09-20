'use client';

interface Props {
  data: Array<{ currency: string; count: number }>;
}

const COLORS = [
  'bg-brand-500',
  'bg-secondary-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-brand-accent-500',
  'bg-secondary-500',
];

export default function CompanyCurrencyBreakdown({ data }: Props) {
  const total = data.reduce((s, d) => s + d.count, 0);

  if (data.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
        No data in range
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="flex h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        {data.map((row, i) => (
          <div
            key={row.currency}
            className={COLORS[i % COLORS.length]}
            style={{ width: `${(row.count / total) * 100}%` }}
            title={`${row.currency}: ${row.count}`}
          />
        ))}
      </div>

      {/* Legend */}
      <ul className="space-y-1.5">
        {data.map((row, i) => (
          <li
            key={row.currency}
            className="flex items-center justify-between text-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  COLORS[i % COLORS.length]
                }`}
              />
              <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                {row.currency}
              </span>
            </span>
            <span className="text-gray-900 dark:text-white font-medium tabular-nums">
              {row.count}
              <span className="text-gray-400 dark:text-gray-500 ml-1 text-xs tabular-nums">
                ({Math.round((row.count / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CompanyCurrencyBreakdown;
