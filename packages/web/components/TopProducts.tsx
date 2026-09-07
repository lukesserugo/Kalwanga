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
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Products</h3>
      <div className="space-y-4">
        {displayProducts.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No product data available</p>
        ) : (
          displayProducts.map((product, index) => (
            <div key={product.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-gray-400">#{index + 1}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{product.name}</p>
                  <p className="text-xs text-gray-500">SKU: {product.sku}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{product.totalSales} sold</p>
                <p className="text-xs text-green-600">${product.revenue.toFixed(2)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
