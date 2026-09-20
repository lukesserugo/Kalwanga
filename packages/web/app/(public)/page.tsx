// D:\Projects\Kalwanga\packages\web\app\page.tsx

'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { productService } from '../../services/productService';
import { cartService } from '../../services/cartService';
import { CategoryShowcase } from '../../components/categories/CategoryShowcase';
import { ProductCard } from '../../components/products/ProductCard';
import { useThemeStore } from '../stores/themeStore';
import { toast } from '../../utils/toast-manager';
import {
  ArrowRight,
  ShoppingBag,
  Truck,
  RotateCcw,
  Shield,
  Headphones,
  ShoppingCart,
  Sparkles,
  Package,
  Users,
  Store,
  TrendingUp,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  images?: string[];
  description?: string;
  isActive: boolean;
  featured?: boolean;
  inventory?: Array<{
    quantity: number;
    reserved: number;
    available?: number;
  }>;
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

// ============================================
// LOADING SKELETON
// ============================================

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-pulse"
        >
          <div className="aspect-square bg-gray-200 dark:bg-gray-700" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// ADD TO CART HOOK
// ============================================

function useAddToCart() {
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  const handleAddToCart = useCallback(
    async (productId: string, variantId?: string, quantity: number = 1) => {
      if (!productId) {
        console.error('❌ Product ID is required');
        toast.error('Product ID is required');
        return;
      }

      setAddingToCart(productId);
      try {
        await cartService.addItem({ productId, variantId, quantity });
        toast.success('Item added to cart!');
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (error: any) {
        console.error('Failed to add to cart:', error);
        toast.error(
          error?.response?.data?.message || 'Failed to add to cart',
        );
      } finally {
        setAddingToCart(null);
      }
    },
    [],
  );

  return { handleAddToCart, addingToCart };
}

// ============================================
// STATS STRIP
// ============================================

const QUICK_STATS = [
  { icon: Package, label: 'Products tracked', value: '10K+' },
  { icon: Users, label: 'Customers served', value: '50K+' },
  { icon: Store, label: 'Locations', value: '100+' },
  { icon: TrendingUp, label: 'Uptime', value: '99.9%' },
];

// ============================================
// MAIN LANDING PAGE
// ============================================

export default function LandingPage() {
  const { isDark } = useThemeStore();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const { handleAddToCart } = useAddToCart();

  const fetchCartCount = useCallback(async () => {
    try {
      const response = await cartService.getCartCount();
      setCartCount(response.count || 0);
    } catch {
      /* not critical */
    }
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const [featuredResult, allResult] = await Promise.all([
          productService.getAllProducts({ limit: 8, isActive: true }),
          productService.getAllProducts({ limit: 12, isActive: true }),
        ]);

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
            variants:
              p.variants?.map((v: any) => ({
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
            inventory: Array.isArray(p.inventory)
              ? p.inventory.map((inv: any) => ({
                  quantity: inv.quantity || 0,
                  reserved: inv.reserved || 0,
                  available: (inv.quantity || 0) - (inv.reserved || 0),
                }))
              : [],
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

        await fetchCartCount();
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();

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
    {
      icon: Headphones,
      title: '24/7 Support',
      description: 'Our team is here to help',
    },
  ];

  const shopBenefits = [
    {
      icon: '🚚',
      title: 'Free Delivery',
      desc: 'Free shipping on all orders over $50',
    },
    {
      icon: '🔄',
      title: 'Easy Returns',
      desc: '30-day return policy on all items',
    },
    {
      icon: '🔒',
      title: 'Secure Checkout',
      desc: 'Your payment is 100% secure',
    },
    {
      icon: '💬',
      title: '24/7 Support',
      desc: 'Our team is here to help you',
    },
  ];

  return (
    <div
      className={`min-h-screen ${
        isDark ? 'dark bg-gray-950' : 'bg-gray-50'
      }`}
    >
      {/* ============================================
          HERO — warm gradient
          ============================================ */}
      <section className="relative bg-gradient-to-br from-orange-600 via-red-500 to-rose-600 text-white overflow-hidden pt-24 md:pt-28">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-orange-200 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm border border-white/30"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
                <span className="text-orange-50">
                  Trusted by 50K+ customers
                </span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
              >
                Discover Amazing <br />
                <span className="text-yellow-200">Products</span> at Great
                Prices
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="text-lg text-orange-100 max-w-lg"
              >
                Shop our curated collection of high-quality products. From
                electronics to fashion, find everything you need.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="flex flex-wrap items-center gap-3"
              >
                <Link
                  href="/shop"
                  className="bg-white text-orange-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg flex items-center gap-2"
                >
                  Shop Now
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/categories"
                  className="bg-white/20 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-all backdrop-blur-sm hover:scale-105 border border-white/30"
                >
                  Browse Categories
                </Link>
                <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-white border border-white/30">
                  <ShoppingCart className="w-4 h-4 text-yellow-200" />
                  {cartCount} in Cart
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="flex items-center gap-8 text-sm"
              >
                <div>
                  <span className="text-2xl font-bold">50K+</span>
                  <p className="text-orange-100">Happy Customers</p>
                </div>
                <div>
                  <span className="text-2xl font-bold">10K+</span>
                  <p className="text-orange-100">Products</p>
                </div>
                <div>
                  <span className="text-2xl font-bold">4.8★</span>
                  <p className="text-orange-100">Average Rating</p>
                </div>
              </motion.div>
            </div>

            <div className="hidden lg:grid grid-cols-2 gap-4">
              {heroFeatures.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.25 + idx * 0.05 }}
                    className={`bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-center hover:bg-white/20 transition-all hover:scale-105 border border-white/20 ${
                      idx % 2 === 1 ? 'mt-8' : ''
                    }`}
                  >
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-6 h-6 text-yellow-200" />
                    </div>
                    <p className="font-semibold">{feature.title}</p>
                    <p className="text-sm text-orange-100">
                      {feature.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Quick stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {QUICK_STATS.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div
                  key={index}
                  className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center"
                >
                  <Icon className="w-5 h-5 text-yellow-300 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-white/70 mt-0.5">
                    {stat.label}
                  </p>
                </div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ============================================
          CATEGORY SHOWCASE
          ============================================ */}
      <CategoryShowcase
        title="Shop by Category"
        subtitle="Find exactly what you're looking for"
        limit={6}
      />

      {/* ============================================
          FEATURED PRODUCTS
          ============================================ */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                Featured Products
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Handpicked just for you
              </p>
            </div>
            <Link
              href="/shop"
              className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-medium flex items-center gap-1 group"
            >
              View All
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-colors shadow-md"
              >
                Retry
              </button>
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No featured products available
              </p>
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

      {/* ============================================
          DEALS BANNER
          ============================================ */}
      <section className="relative overflow-hidden py-12 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-rose-300 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 px-4 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium text-white border border-white/30">
              <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
              Limited Time Offer
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Flash Sale!
            </h2>
            <p className="text-white/90 text-lg">
              Get up to 50% off on selected items
            </p>
            <p className="text-white/80 text-sm">
              Hurry up! Offer ends in 24 hours
            </p>
            <Link
              href="/sale"
              className="inline-block bg-white text-orange-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg"
            >
              Shop the Sale
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          ALL PRODUCTS
          ============================================ */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                All Products
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Browse our complete collection
              </p>
            </div>
            <select className="border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
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
              <ShoppingBag className="w-16 h-16 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No products available
              </p>
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
              className="inline-block bg-gradient-to-r from-orange-500 to-red-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-orange-600 hover:to-red-600 transition-all hover:scale-105 shadow-lg"
            >
              Load More Products
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          WHY SHOP WITH US
          ============================================ */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Why Shop With Us
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-2xl mx-auto">
              Everything you need for a smooth, secure shopping experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {shopBenefits.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all hover:scale-105 border border-orange-100 dark:border-gray-700"
              >
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
