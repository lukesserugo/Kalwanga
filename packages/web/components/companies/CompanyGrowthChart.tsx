// D:\Projects\Kalwanga\packages\web\components\companies\CompanyGrowthChart.tsx

'use client';

interface Props {
  data: Array<{ month: string; count: number }>;
}

export default function CompanyGrowthChart({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <div className="flex items-end gap-1.5 h-40">
        {data.map((point) => {
          const heightPct = (point.count / max) * 100;
          return (
            <div
              key={point.month}
              className="flex-1 flex flex-col items-center gap-1 group"
              title={`${point.month}: ${point.count}`}
            >
              <div className="relative w-full h-full flex items-end">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-blue-500 to-blue-400 dark:from-blue-600 dark:to-blue-500 group-hover:from-blue-600 group-hover:to-blue-500 transition-all"
                  style={{ height: `${Math.max(heightPct, 3)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-3 text-[10px] text-gray-500 dark:text-gray-400">
        <span>{data[0]?.month}</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">
          {total} new {total === 1 ? 'company' : 'companies'}
        </span>
        <span>{data[data.length - 1]?.month}</span>
      </div>
    </div>
  );
}
