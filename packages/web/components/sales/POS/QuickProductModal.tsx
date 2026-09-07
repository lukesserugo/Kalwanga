'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Loader2,
  Package,
  Plus,
  ShoppingBag,
  AlertCircle,
  Check
} from 'lucide-react';
import { productService } from '../../../services/productService';
import { useToast } from '../../common/Toast';
import { formatCurrency } from '../../../utils/formatters';

// Define Product interface matching the service response
interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images?: string[];
  inventory?: {
    available: number;
    quantity: number;
  };
}

interface QuickProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product & { quantity?: number }) => void;
}

export function QuickProductModal({
  isOpen,
  onClose,
  onSelectProduct,
}: QuickProductModalProps) {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const searchProducts = async () => {
      if (searchQuery.length < 2) {
        setProducts([]);
        return;
      }

      setLoading(true);
      try {
        // Remove 'limit' from the params - it's not supported
        const results = await productService.searchProducts({
          query: searchQuery,
          // Remove: limit: 10,
        });
        
        // Map the results to match our Product interface
        const mappedResults: Product[] = (results || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          unitPrice: p.unitPrice,
          images: p.images,
          inventory: p.inventory?.[0] ? {
            available: p.inventory[0].available || p.inventory[0].quantity || 0,
            quantity: p.inventory[0].quantity || 0,
          } : undefined,
        }));
        
        setProducts(mappedResults);
      } catch (error) {
        console.error('Failed to search products:', error);
        // Mock data for demo
        setProducts(generateMockProducts(searchQuery));
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  const generateMockProducts = (query: string): Product[] => {
    const mockProducts: Product[] = [
      {
        id: '1',
        name: 'Laptop Pro 15"',
        sku: 'LP-15-001',
        unitPrice: 1299.99,
        inventory: { available: 15, quantity: 15 },
      },
      {
        id: '2',
        name: 'Wireless Mouse',
        sku: 'WM-002',
        unitPrice: 29.99,
        inventory: { available: 45, quantity: 45 },
      },
      {
        id: '3',
        name: 'USB-C Hub 7-in-1',
        sku: 'UC7-003',
        unitPrice: 59.99,
        inventory: { available: 22, quantity: 22 },
      },
      {
        id: '4',
        name: 'Monitor Stand',
        sku: 'MS-004',
        unitPrice: 89.99,
        inventory: { available: 8, quantity: 8 },
      },
      {
        id: '5',
        name: 'Mechanical Keyboard',
        sku: 'MK-005',
        unitPrice: 149.99,
        inventory: { available: 12, quantity: 12 },
      },
    ];

    if (!query) return mockProducts;
    const lowerQuery = query.toLowerCase();
    return mockProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerQuery) ||
        p.sku.toLowerCase().includes(lowerQuery)
    );
  };

  const handleAddProduct = () => {
    if (selectedProduct) {
      // Pass the product with quantity to the parent
      const productWithQty = { ...selectedProduct, quantity };
      onSelectProduct(productWithQty);
      setSelectedProduct(null);
      setQuantity(1);
      setSearchQuery('');
      setProducts([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-green-500" />
              Quick Product
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search and add products quickly
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-2 text-gray-500 dark:text-gray-400">Searching...</span>
            </div>
          ) : products.length > 0 ? (
            <div className="space-y-2">
              {products.map((product) => (
                <ProductResultItem
                  key={product.id}
                  product={product}
                  isSelected={selectedProduct?.id === product.id}
                  onSelect={() => {
                    setSelectedProduct(product);
                    setQuantity(1);
                  }}
                />
              ))}
            </div>
          ) : searchQuery.length >= 2 && !loading ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No products found</p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </div>

        {/* Selected Product Actions */}
        {selectedProduct && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {selectedProduct.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(selectedProduct.unitPrice)} · SKU: {selectedProduct.sku}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">Qty:</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg text-center focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={handleAddProduct}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// PRODUCT RESULT ITEM
// ============================================

interface ProductResultItemProps {
  product: Product;
  isSelected: boolean;
  onSelect: () => void;
}

function ProductResultItem({ product, isSelected, onSelect }: ProductResultItemProps) {
  const availableStock = product.inventory?.available || 0;
  const isLowStock = availableStock <= 5;
  const isOutOfStock = availableStock === 0;

  return (
    <div
      onClick={onSelect}
      className={`p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors flex items-center justify-between ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-600' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <Package className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>SKU: {product.sku}</span>
            <span className="text-xs text-gray-400">|</span>
            <span className={isOutOfStock ? 'text-red-500' : isLowStock ? 'text-yellow-500' : 'text-green-500'}>
              {isOutOfStock ? 'Out of Stock' : isLowStock ? `${availableStock} left` : `${availableStock} in stock`}
            </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-gray-900 dark:text-white">
          {formatCurrency(product.unitPrice)}
        </p>
        {isSelected && (
          <span className="text-xs text-blue-600 dark:text-blue-400">Selected</span>
        )}
      </div>
    </div>
  );
}
