'use client';

interface Product {
  id: string;
  name: string;
  sku: string;
  totalSales: number;
  revenue: number;
}

interface TopProductsProps {
  products: Product[];
  limit?: number;
}

export default function TopProducts({ products, limit = 5 }: TopProductsProps) {
  const displayProducts = products.slice(0, limit);

  return (
    <div className="card-brand shadow-soft">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Top Products
      </h3>
      <div className="space-y-4">
        {displayProducts.length === 0 ? (
          <p className="text-2xs text-gray-500 dark:text-gray-400 text-center py-4">
            No product data available
          </p>
        ) : (
          displayProducts.map((product, index) => (
            <div
              key={product.id}
              className="flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-400 dark:text-gray-500 tabular-nums">
                  #{index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {product.name}
                  </p>
                  <p className="text-2xs font-mono text-gray-500 dark:text-gray-400 tabular-nums">
                    SKU: {product.sku}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 dark:text-white tabular-nums">
                  {product.totalSales} sold
                </p>
                <p className="text-2xs text-success-600 dark:text-success-400 tabular-nums">
                  ${product.revenue.toFixed(2)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
