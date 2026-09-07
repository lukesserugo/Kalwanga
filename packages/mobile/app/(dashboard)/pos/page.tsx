'use client';

import { useState, useEffect } from 'react';
import { useToast } from '../../../hooks/useToast';
import { apiService } from '../../../services/api';
import { formatCurrency } from '../../../utils/helpers';
import { Product, CartItem, Customer } from '@pos/shared/types';

export default function POSPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          apiService.get('/products', { params: { businessUnitId: 'default', limit: 50 } }),
          apiService.get('/categories'),
        ]);
        setProducts(productsRes.data);
        setCategories(categoriesRes.data);
      } catch (error) {
        console.error('Error loading POS data:', error);
        showToast('Failed to load products', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? product.categoryId === selectedCategory : true;
    return matchesSearch && matchesCategory && product.isActive;
  });

  const addToCart = (product: Product) => {
    const currentStock = product.stock || 0;
    if (currentStock === 0) {
      showToast('Product out of stock', 'warning');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= (product.stock || 0)) {
          showToast('Not enough stock available', 'warning');
          return prev;
        }
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          product,
          quantity: 1,
          unitPrice: product.unitPrice,
          total: product.unitPrice,
        },
      ];
    });
    showToast(`Added ${product.name} to cart`, 'success');
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(prev => prev.filter(item => item.productId !== productId));
      return;
    }

    const product = products.find(p => p.id === productId);
    if (product && quantity > (product.stock || 0)) {
      showToast('Not enough stock available', 'warning');
      return;
    }

    setCart(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, quantity, total: quantity * item.unitPrice }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    if (confirm('Are you sure you want to clear the cart?')) {
      setCart([]);
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.1;
  const total = subtotal + tax;

  const handleCheckout = () => {
    if (cart.length === 0) {
      showToast('Cart is empty', 'warning');
      return;
    }
    showToast('Checkout coming soon!', 'info');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Point of Sale</h1>
      <p className="text-gray-600">Process sales and transactions quickly.</p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products */}
        <div className="lg:col-span-2">
          {/* Search & Categories */}
          <div className="bg-white rounded-lg shadow p-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-3 flex-wrap">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedCategory === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    selectedCategory === category.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {filteredProducts.map((product) => {
              const currentStock = product.stock || 0;
              return (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow cursor-pointer ${
                    currentStock === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <div className="h-24 bg-gray-100 rounded mb-2 flex items-center justify-center">
                    <span className="text-4xl">📦</span>
                  </div>
                  <h4 className="font-medium text-gray-900 truncate">{product.name}</h4>
                  <p className="text-lg font-bold text-blue-600">{formatCurrency(product.unitPrice)}</p>
                  <span className={`text-xs ${currentStock > 10 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {currentStock > 0 ? `${currentStock} in stock` : 'Out of Stock'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <div className="bg-white rounded-lg shadow p-4 h-fit sticky top-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Cart ({cart.length})</h3>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear
              </button>
            )}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No items in cart</p>
            ) : (
              cart.map((item) => (
                <div key={item.productId} className="flex items-center justify-between border-b pb-2">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{item.product.name}</p>
                    <p className="text-sm text-gray-500">{formatCurrency(item.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                    >
                      +
                    </button>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tax (10%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-blue-600">{formatCurrency(total)}</span>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
