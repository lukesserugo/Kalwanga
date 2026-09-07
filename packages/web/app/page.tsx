// D:\Projects\Kalwanga\packages\web\app\page.tsx

'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense, useCallback } from 'react';
import PublicNavigation from '../components/PublicNavigation';
import { productService } from '../services/productService';
import { cartService } from '../services/cartService';
import { formatCurrency } from '../utils/helpers';
import { CategoryShowcase } from '../components/categories/CategoryShowcase';
import { ProductCard } from '../components/products/ProductCard';
import { useThemeStore } from './stores/themeStore';
import { toast } from '../utils/toast-manager';
import { AddToCartButton } from '../components/cart/AddToCartButton';
import { 
  ArrowRight, 
  ShoppingBag, 
  Truck, 
  RotateCcw, 
  Shield, 
  Headphones,
  Star,
  TrendingUp,
  ShoppingCart,
  Loader2
} from 'lucide-react';

// Types
interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images?: string[];
  description?: string;
  isActive: boolean;
  featured?: boolean;
  inventory?: Array<{ quantity: number; reserved: number; available?: number }>;
  variants?: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
    isActive: boolean;
    images?: string[];
    attributes?: Record<string, any>;
    barcode?: string | null;
    inventoryId?: string | null;
  }>;
  inventoryId?: string | null;
  category?: { id: string; name: string };
  rating?: number;
  reviewCount?: number;
  tags?: string[];
  isDigital?: boolean;
  minStock?: number;
  costPrice?: number;
  createdAt: string;
  updatedAt: string;
}

// Components
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-pulse">
          <div className="aspect-square bg-gray-200 dark:bg-gray-700"></div>
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ✅ Enhanced: Add to cart handler with better error handling and event dispatching
function useAddToCart() {
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  const handleAddToCart = useCallback(async (productId: string, variantId?: string, quantity: number = 1) => {
    if (!productId) {
      console.error('❌ Product ID is required');
      toast.error('Product ID is required');
      return;
    }

    setAddingToCart(productId);
    try {
      console.log(`🛒 Adding to cart: Product ${productId}, Variant ${variantId || 'none'}, Quantity ${quantity}`);
      await cartService.addItem({ productId, variantId, quantity });
      toast.success('Item added to cart!');
      // Dispatch cart update event for all components
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (error: any) {
      console.error('Failed to add to cart:', error);
      toast.error(error?.response?.data?.message || 'Failed to add to cart');
    } finally {
      setAddingToCart(null);
    }
  }, []);

  return { handleAddToCart, addingToCart };
}

// Main Landing Page Component
export default function LandingPage() {
  const { isDark } = useThemeStore();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const { handleAddToCart, addingToCart } = useAddToCart();

  // ✅ Fetch cart count for display
  const fetchCartCount = useCallback(async () => {
    try {
      const response = await cartService.getCartCount();
      setCartCount(response.count || 0);
    } catch (error) {
      // Silently fail - cart count is not critical
    }
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch featured and all products in parallel
        const [featuredResult, allResult] = await Promise.all([
          productService.getAllProducts({ limit: 8, isActive: true }),
          productService.getAllProducts({ limit: 12, isActive: true })
        ]);

        // Map service products to our Product type with proper inventory structure
        const mapProducts = (products: any[]): Product[] => {
          return (products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            unitPrice: p.unitPrice,
            costPrice: p.costPrice,
            images: p.images || [],
            description: p.description,
            isActive: p.isActive,
            featured: p.featured || false,
            category: p.category,
            inventoryId: p.inventoryId || null,
            variants: p.variants?.map((v: any) => ({
              id: v.id,
              name: v.name,
              sku: v.sku,
              price: v.price || 0,
              stock: v.stock || 0,
              isActive: v.isActive !== undefined ? v.isActive : true,
              images: v.images || [],
              attributes: v.attributes || {},
              barcode: v.barcode || null,
              inventoryId: v.inventoryId || null,
            })) || [],
            inventory: p.inventory?.map((inv: any) => ({
              quantity: inv.quantity || 0,
              reserved: inv.reserved || 0,
              available: (inv.quantity || 0) - (inv.reserved || 0),
            })) || [],
            rating: p.rating,
            reviewCount: p.reviewCount || 0,
            tags: p.tags || [],
            isDigital: p.isDigital || false,
            minStock: p.minStock || 5,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          }));
        };

        setFeaturedProducts(mapProducts(featuredResult.data || []));
        setAllProducts(mapProducts(allResult.data || []));
        
        // Fetch cart count
        await fetchCartCount();
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();

    // ✅ Listen for cart updates
    const handleCartUpdate = () => {
      fetchCartCount();
    };
    window.addEventListener('cart:updated', handleCartUpdate);
    return () => window.removeEventListener('cart:updated', handleCartUpdate);
  }, [fetchCartCount]);

  const heroFeatures = [
    { icon: Truck, title: 'Free Shipping', description: 'On orders over $50' },
    { icon: RotateCcw, title: 'Easy Returns', description: '30-day guarantee' },
    { icon: Shield, title: 'Secure Payment', description: '100% protected' },
    { icon: Headphones, title: '24/7 Support', description: 'Our team is here to help' },
  ];

  const shopBenefits = [
    { icon: '🚚', title: 'Free Delivery', desc: 'Free shipping on all orders over $50' },
    { icon: '🔄', title: 'Easy Returns', desc: '30-day return policy on all items' },
    { icon: '🔒', title: 'Secure Checkout', desc: 'Your payment is 100% secure' },
    { icon: '💬', title: '24/7 Support', desc: 'Our team is here to help you' },
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <PublicNavigation />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32 lg:py-40">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-blue-100">Trusted by 50K+ customers</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Discover Amazing <br />
                <span className="text-blue-200">Products</span> at Great Prices
              </h1>
              <p className="text-lg text-blue-100 max-w-lg">
                Shop our curated collection of high-quality products. From electronics to fashion, find everything you need.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/shop"
                  className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg flex items-center gap-2"
                >
                  Shop Now
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/categories"
                  className="bg-blue-500/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-500/40 transition-all backdrop-blur-sm hover:scale-105 flex items-center gap-2"
                >
                  Browse Categories
                </Link>
                <Link
                  href="/admin/dashboard"
                  className="bg-green-500/30 text-white px-8 py-3 rounded-xl font-semibold hover:bg-green-500/40 transition-all backdrop-blur-sm hover:scale-105 flex items-center gap-2"
                >
                  Go to Admin Dashboard
                </Link>
                {/* ✅ Cart count display in hero */}
                <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-white">
                  <ShoppingCart className="w-4 h-4" />
                  {cartCount} in Cart
                </span>
              </div>
              <div className="flex items-center gap-8 text-sm">
                <div>
                  <span className="text-2xl font-bold">50K+</span>
                  <p className="text-blue-200">Happy Customers</p>
                </div>
                <div>
                  <span className="text-2xl font-bold">10K+</span>
                  <p className="text-blue-200">Products</p>
                </div>
                <div>
                  <span className="text-2xl font-bold">4.8★</span>
                  <p className="text-blue-200">Average Rating</p>
                </div>
              </div>
            </div>
            
            {/* Hero Features Grid */}
            <div className="hidden lg:grid grid-cols-2 gap-4">
              {heroFeatures.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={idx}
                    className={`bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center hover:bg-white/20 transition-all hover:scale-105 ${
                      idx % 2 === 1 ? 'mt-8' : ''
                    }`}
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-6 h-6" />
                    </div>
                    <p className="font-semibold">{feature.title}</p>
                    <p className="text-sm text-blue-200">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Category Showcase */}
      <CategoryShowcase 
        title="Shop by Category"
        subtitle="Find exactly what you're looking for"
        limit={6}
      />

      {/* Featured Products */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Featured Products</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Handpicked just for you</p>
            </div>
            <Link
              href="/shop"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No featured products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  showAddToCart={true}
                  showWishlist={true}
                  showQuickView={true}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Deals Banner */}
      <section className="py-12 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="space-y-4">
            <span className="inline-block px-4 py-1 bg-white/20 rounded-full text-sm font-medium text-white">
              🔥 Limited Time Offer
            </span>
            <h2 className="text-3xl font-bold text-white">Flash Sale!</h2>
            <p className="text-white/90 text-lg">Get up to 50% off on selected items</p>
            <p className="text-white/80 text-sm">Hurry up! Offer ends in 24 hours</p>
            <Link
              href="/sale"
              className="inline-block bg-white text-orange-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg"
            >
              Shop the Sale
            </Link>
          </div>
        </div>
      </section>

      {/* All Products */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">All Products</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Browse our complete collection</p>
            </div>
            <select className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option>Sort by: Featured</option>
              <option>Price: Low to High</option>
              <option>Price: High to Low</option>
              <option>Newest First</option>
              <option>Most Popular</option>
            </select>
          </div>
          {loading ? (
            <LoadingSkeleton />
          ) : allProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">No products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {allProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={handleAddToCart}
                  showAddToCart={true}
                  showWishlist={true}
                  showQuickView={true}
                />
              ))}
            </div>
          )}
          <div className="text-center mt-12">
            <Link
              href="/shop"
              className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all hover:scale-105 shadow-lg"
            >
              Load More Products
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Why Shop With Us
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {shopBenefits.map((feature, index) => (
              <div key={index} className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all hover:scale-105">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white">Subscribe to Our Newsletter</h2>
            <p className="text-blue-100">Get the latest updates on new products and special offers</p>
            <form className="mt-6 flex flex-col sm:flex-row gap-4 max-w-md mx-auto" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-xl focus:ring-2 focus:ring-white focus:outline-none bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white"
                required
              />
              <button className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:scale-105">
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4">POS Store</h3>
              <p className="text-gray-400 text-sm">Your one-stop shop for quality products at affordable prices.</p>
              <div className="flex gap-4 mt-4">
                <Link href="#" className="text-gray-400 hover:text-white transition-colors text-xl">📱</Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors text-xl">🐦</Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors text-xl">📸</Link>
                <Link href="#" className="text-gray-400 hover:text-white transition-colors text-xl">▶️</Link>
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Shop</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/shop" className="hover:text-white transition-colors">All Products</Link></li>
                <li><Link href="/categories" className="hover:text-white transition-colors">Categories</Link></li>
                <li><Link href="/sale" className="hover:text-white transition-colors">Sale Items</Link></li>
                <li><Link href="/new" className="hover:text-white transition-colors">New Arrivals</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link href="/returns" className="hover:text-white transition-colors">Returns Policy</Link></li>
                <li><Link href="/shipping" className="hover:text-white transition-colors">Shipping Info</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
                <li><Link href="/accessibility" className="hover:text-white transition-colors">Accessibility</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            © {new Date().getFullYear()} POS Store. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
