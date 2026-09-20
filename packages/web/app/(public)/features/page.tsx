// D:\Projects\Kalwanga\packages\web\app\features\page.tsx

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  Package,
  Users,
  BarChart3,
  UserCog,
  CreditCard,
  RefreshCw,
  WifiOff,
  Gift,
  Shield,
  Smartphone,
  Globe,
  Truck,
  Receipt,
  Building2,
  Wallet,
  Barcode,
  FileText,
  Calculator,
  Crown,
  Zap,
  Lock,
  Database,
  Cloud,
  Settings,
  Bell,
  TrendingUp,
  Layers,
  Store,
  Boxes,
  Tags,
  HeartHandshake,
  Scan,
  Printer,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  Percent,
  ArrowRight,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

// ============================================
// FEATURE CATEGORIES
// ============================================
//
// Grouped by what the operator is trying to accomplish, not by
// "module". The hero grid shows the top features; the secondary grid
// shows the full breadth of the system.

interface Feature {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  highlight?: boolean;
}

interface FeatureCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: Feature[];
}

const CATEGORIES: FeatureCategory[] = [
  // ------------------------------------------------
  // 1. Sell
  // ------------------------------------------------
  {
    id: 'sell',
    label: 'Sell Anywhere',
    description: 'Process sales on any device, online or offline',
    icon: ShoppingCart,
    features: [
      {
        title: 'Point of Sale',
        description:
          'Fast, intuitive POS interface with barcode scanning, quick keys, and split payments.',
        icon: ShoppingCart,
        accent: 'from-orange-500 to-red-500',
        highlight: true,
      },
      {
        title: 'Offline Mode',
        description:
          'Keep selling when the internet drops. Sales sync automatically when you reconnect.',
        icon: WifiOff,
        accent: 'from-slate-500 to-gray-600',
      },
      {
        title: 'Multi-Register',
        description:
          'Run multiple cash registers in parallel, each with its own shift and cash drawer.',
        icon: Store,
        accent: 'from-amber-500 to-orange-600',
      },
      {
        title: 'Split & Partial Payments',
        description:
          'Accept cash, card, mobile money, gift card, and loyalty points on a single sale.',
        icon: Wallet,
        accent: 'from-emerald-500 to-green-600',
      },
      {
        title: 'Barcode Scanning',
        description:
          'Scan product barcodes, generate EAN-13/UPC-A codes, and print labels directly.',
        icon: Barcode,
        accent: 'from-blue-500 to-sky-600',
      },
      {
        title: 'Receipts & Invoices',
        description:
          'Print, email, or share digital receipts. Generate tax-compliant invoices in one tap.',
        icon: Receipt,
        accent: 'from-purple-500 to-violet-600',
      },
    ],
  },

  // ------------------------------------------------
  // 2. Manage inventory
  // ------------------------------------------------
  {
    id: 'inventory',
    label: 'Inventory Control',
    description: 'Know exactly what you have, everywhere, always',
    icon: Boxes,
    features: [
      {
        title: 'Real-Time Stock',
        description:
          'Live quantities across every location, with reserved and available counts that update instantly.',
        icon: Package,
        accent: 'from-blue-500 to-sky-600',
        highlight: true,
      },
      {
        title: 'Multi-Location',
        description:
          'Track stock across warehouses, stores, and in-transit. Transfer between locations with a click.',
        icon: Building2,
        accent: 'from-indigo-500 to-blue-600',
      },
      {
        title: 'Low Stock Alerts',
        description:
          'Automatic reorder points and alerts so you never miss a sale because of stockouts.',
        icon: Bell,
        accent: 'from-yellow-500 to-amber-600',
      },
      {
        title: 'Stock Counts',
        description:
          'Guided cycle counts with variance tracking and full audit history.',
        icon: Calculator,
        accent: 'from-teal-500 to-cyan-600',
      },
      {
        title: 'Variants & Bundles',
        description:
          'Size, color, material — model any combination of variants under a single product.',
        icon: Layers,
        accent: 'from-pink-500 to-rose-600',
      },
      {
        title: 'Bulk Import / Export',
        description:
          'Import thousands of SKUs from CSV, export catalog data, and back up in seconds.',
        icon: RefreshCw,
        accent: 'from-cyan-500 to-sky-600',
      },
    ],
  },

  // ------------------------------------------------
  // 3. Customers
  // ------------------------------------------------
  {
    id: 'customers',
    label: 'Customer Relationships',
    description: 'Turn one-time buyers into repeat customers',
    icon: HeartHandshake,
    features: [
      {
        title: 'Customer Profiles',
        description:
          'Complete purchase history, contact details, notes, and preferences for every customer.',
        icon: Users,
        accent: 'from-pink-500 to-rose-600',
        highlight: true,
      },
      {
        title: 'Loyalty Programs',
        description:
          'Points-based rewards, tiered loyalty levels, and automatic discount redemption.',
        icon: Crown,
        accent: 'from-amber-500 to-yellow-600',
      },
      {
        title: 'Gift Cards',
        description:
          'Issue, redeem, and track gift cards with real-time balances and expiry management.',
        icon: Gift,
        accent: 'from-purple-500 to-fuchsia-600',
      },
      {
        title: 'Customer Groups',
        description:
          'Segment customers by spend, loyalty tier, or purchase behavior for targeted offers.',
        icon: Tags,
        accent: 'from-orange-500 to-red-500',
      },
      {
        title: 'Wishlists & Reviews',
        description:
          'Let customers save products, leave reviews, and get notified when items return.',
        icon: HeartHandshake,
        accent: 'from-rose-500 to-pink-600',
      },
      {
        title: 'Promotions Engine',
        description:
          'Percentage discounts, BOGO, bundles, tiered pricing — applied automatically at checkout.',
        icon: Percent,
        accent: 'from-emerald-500 to-green-600',
      },
    ],
  },

  // ------------------------------------------------
  // 4. Operations
  // ------------------------------------------------
  {
    id: 'operations',
    label: 'Daily Operations',
    description: 'Everything your team touches during a shift',
    icon: Settings,
    features: [
      {
        title: 'Shift Management',
        description:
          'Clock in, clock out, cash counts, and discrepancy tracking per shift and register.',
        icon: Clock,
        accent: 'from-blue-500 to-indigo-600',
        highlight: true,
      },
      {
        title: 'Purchase Orders',
        description:
          'Raise POs to suppliers, receive stock against them, and reconcile invoices automatically.',
        icon: Truck,
        accent: 'from-teal-500 to-emerald-600',
      },
      {
        title: 'Suppliers',
        description:
          'Vendor directory with payment terms, delivery history, and performance ratings.',
        icon: Users,
        accent: 'from-orange-500 to-amber-600',
      },
      {
        title: 'Returns & Refunds',
        description:
          'Process full or partial returns, issue refunds to original payment or store credit.',
        icon: RefreshCw,
        accent: 'from-red-500 to-rose-600',
      },
      {
        title: 'Expense Tracking',
        description:
          'Record operating expenses by category, attach receipts, and export to accounting.',
        icon: FileText,
        accent: 'from-violet-500 to-purple-600',
      },
      {
        title: 'Bookkeeping',
        description:
          'Double-entry accounting with chart of accounts, journals, and trial balance.',
        icon: Calculator,
        accent: 'from-slate-500 to-gray-700',
      },
    ],
  },

  // ------------------------------------------------
  // 5. Insights
  // ------------------------------------------------
  {
    id: 'insights',
    label: 'Business Intelligence',
    description: 'Know what is working and what is not',
    icon: BarChart3,
    features: [
      {
        title: 'Sales Analytics',
        description:
          'Revenue, profit margins, best sellers, and hourly heatmaps — updated in real time.',
        icon: TrendingUp,
        accent: 'from-emerald-500 to-green-600',
        highlight: true,
      },
      {
        title: 'Financial Reports',
        description:
          'Balance sheet, income statement, cash flow, and tax summaries in one click.',
        icon: BarChart3,
        accent: 'from-blue-500 to-sky-600',
      },
      {
        title: 'Inventory Reports',
        description:
          'Stock valuation, movement history, dead stock, and reorder recommendations.',
        icon: Package,
        accent: 'from-amber-500 to-orange-600',
      },
      {
        title: 'Customer Reports',
        description:
          'Cohorts, lifetime value, retention, and RFM segmentation out of the box.',
        icon: Users,
        accent: 'from-pink-500 to-rose-600',
      },
      {
        title: 'Tax Reports',
        description:
          'Jurisdiction-aware tax records, filing status, and export-ready summaries.',
        icon: FileText,
        accent: 'from-violet-500 to-purple-600',
      },
      {
        title: 'Audit Trail',
        description:
          'Every action logged. Know who did what, when, from which device.',
        icon: Shield,
        accent: 'from-slate-600 to-gray-800',
      },
    ],
  },

  // ------------------------------------------------
  // 6. Administration
  // ------------------------------------------------
  {
    id: 'admin',
    label: 'Team & Security',
    description: 'Control who can do what, from where',
    icon: Shield,
    features: [
      {
        title: 'Role-Based Access',
        description:
          'Eight built-in roles — Super Admin down to Cashier — each with a sane default permission set.',
        icon: UserCog,
        accent: 'from-red-500 to-rose-600',
        highlight: true,
      },
      {
        title: 'Custom Permissions',
        description:
          'Fine-grained permission strings that override role defaults per user or per group.',
        icon: Lock,
        accent: 'from-orange-500 to-red-500',
      },
      {
        title: 'User Groups',
        description:
          'Organize staff into teams, assign shared permissions, and manage group leads.',
        icon: Users,
        accent: 'from-blue-500 to-indigo-600',
      },
      {
        title: 'Invitations',
        description:
          'Invite staff by email with auto-expiring tokens and role pre-assignment.',
        icon: Mail,
        accent: 'from-teal-500 to-cyan-600',
      },
      {
        title: 'Multi-Business Units',
        description:
          'Head office, branches, warehouses — each with its own settings, staff, and stock.',
        icon: Building2,
        accent: 'from-purple-500 to-violet-600',
      },
      {
        title: 'Activity Logs',
        description:
          'Full user activity history with filtering by action, entity, and date range.',
        icon: FileText,
        accent: 'from-amber-500 to-yellow-600',
      },
    ],
  },

  // ------------------------------------------------
  // 7. Payments
  // ------------------------------------------------
  {
    id: 'payments',
    label: 'Payments & Money',
    description: 'Accept any payment method your customers prefer',
    icon: CreditCard,
    features: [
      {
        title: 'Cash & Card',
        description:
          'Native cash drawer support plus integrated Stripe, Square, and PayPal processing.',
        icon: CreditCard,
        accent: 'from-blue-500 to-indigo-600',
        highlight: true,
      },
      {
        title: 'Mobile Money',
        description:
          'MTN, Airtel, Tigo, and Vodafone integrations for African markets out of the box.',
        icon: Smartphone,
        accent: 'from-yellow-500 to-orange-600',
      },
      {
        title: 'Bank Transfers',
        description:
          'Record incoming bank transfers, match to invoices, and reconcile in seconds.',
        icon: Building2,
        accent: 'from-teal-500 to-cyan-600',
      },
      {
        title: 'Gift & Loyalty',
        description:
          'Redeem gift card balances and loyalty points as tender at checkout.',
        icon: Gift,
        accent: 'from-pink-500 to-rose-600',
      },
      {
        title: 'Multiple Currencies',
        description:
          'Process sales in any currency with automatic conversion and reporting.',
        icon: Globe,
        accent: 'from-emerald-500 to-green-600',
      },
      {
        title: 'Refund Handling',
        description:
          'Full and partial refunds to original payment method, store credit, or gift card.',
        icon: RefreshCw,
        accent: 'from-red-500 to-rose-600',
      },
    ],
  },

  // ------------------------------------------------
  // 8. Platform
  // ------------------------------------------------
  {
    id: 'platform',
    label: 'Platform & Reliability',
    description: 'Built to be fast, secure, and always available',
    icon: Cloud,
    features: [
      {
        title: 'Real-Time Sync',
        description:
          'Every device sees the same data within milliseconds — no manual refresh, no stale reports.',
        icon: RefreshCw,
        accent: 'from-cyan-500 to-blue-600',
        highlight: true,
      },
      {
        title: 'Cloud Database',
        description:
          'PostgreSQL-backed with automatic backups, point-in-time recovery, and audit history.',
        icon: Database,
        accent: 'from-slate-500 to-gray-700',
      },
      {
        title: 'Secure by Default',
        description:
          'Clerk-based authentication, JWT verification, and per-route permission checks.',
        icon: Shield,
        accent: 'from-emerald-500 to-green-600',
      },
      {
        title: 'Responsive UI',
        description:
          'Works beautifully on desktop, tablet, and phone — no separate mobile app required.',
        icon: Smartphone,
        accent: 'from-purple-500 to-fuchsia-600',
      },
      {
        title: 'Webhooks & Integrations',
        description:
          'Stripe, PayPal, Flutterwave, Paystack, Square — plug in and go.',
        icon: Zap,
        accent: 'from-amber-500 to-yellow-600',
      },
      {
        title: 'REST API',
        description:
          'Every screen you see is backed by a documented REST endpoint you can call directly.',
        icon: Globe,
        accent: 'from-blue-500 to-sky-600',
      },
    ],
  },
];

// ============================================
// QUICK STATS (hero strip)
// ============================================

const QUICK_STATS = [
  { icon: Package, label: 'Products tracked', value: '10K+' },
  { icon: Users, label: 'Customers served', value: '50K+' },
  { icon: Store, label: 'Locations', value: '100+' },
  { icon: TrendingUp, label: 'Uptime', value: '99.9%' },
];

// ============================================
// PAGE
// ============================================

export default function FeaturesPage() {
  const { isDark } = useThemeStore();

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? 'dark bg-gray-950'
          : 'bg-gradient-to-b from-orange-50 via-white to-amber-50'
      } transition-colors duration-300`}
    >
      {/* ============================================
          HERO
          ============================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-red-500 to-rose-600 pt-24 md:pt-28">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-200 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-white border border-white/30 mb-6">
              <Sparkles className="w-4 h-4 text-yellow-200" />
              <span>Everything in one platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Run your entire business <br />
              <span className="text-yellow-200">from one system</span>
            </h1>

            <p className="mt-6 text-lg text-orange-100 max-w-2xl mx-auto">
              Sales, inventory, customers, payments, staff, and reporting —
              all in one place. No add-ons, no hidden fees, no integrations
              to maintain.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 bg-white text-orange-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg"
              >
                Start free trial
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-all border border-white/30"
              >
                Sign in
              </Link>
            </div>
          </motion.div>

          {/* Quick stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
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
          HIGHLIGHTED FEATURES (top row)
          ============================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2
            className={`text-3xl sm:text-4xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            The highlights
          </h2>
          <p
            className={`mt-3 text-base max-w-2xl mx-auto ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            The features customers mention most often when they describe why
            they chose us.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATEGORIES.flatMap((cat) =>
            cat.features.filter((f) => f.highlight),
          ).map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`group rounded-2xl border p-6 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800 hover:border-orange-900'
                    : 'bg-white border-orange-100 hover:border-orange-300'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-sm mb-4 group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-6 h-6" />
                </span>
                <h3
                  className={`text-lg font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {feature.title}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============================================
          FULL FEATURE CATEGORIES
          ============================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2
            className={`text-3xl sm:text-4xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Everything you need, in one place
          </h2>
          <p
            className={`mt-3 text-base max-w-2xl mx-auto ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            Eight areas, one platform. Nothing bolted on, nothing left out.
          </p>
        </div>

        <div className="space-y-16">
          {CATEGORIES.map((category, catIndex) => {
            const CatIcon = category.icon;
            return (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: catIndex * 0.03 }}
              >
                {/* Category header */}
                <div className="flex items-center gap-3 mb-6">
                  <span
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${
                      isDark
                        ? 'bg-gray-800 text-orange-400'
                        : 'bg-orange-100 text-orange-600'
                    }`}
                  >
                    <CatIcon className="w-5 h-5" />
                  </span>
                  <div>
                    <h3
                      className={`text-xl font-bold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {category.label}
                    </h3>
                    <p
                      className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {category.description}
                    </p>
                  </div>
                </div>

                {/* Feature grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.features.map((feature, index) => {
                    const Icon = feature.icon;
                    return (
                      <motion.div
                        key={feature.title}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-30px' }}
                        transition={{
                          duration: 0.3,
                          delay: index * 0.03,
                        }}
                        className={`group rounded-xl border p-5 transition-all hover:shadow-md ${
                          isDark
                            ? 'bg-gray-900 border-gray-800 hover:border-orange-900'
                            : 'bg-white border-orange-100 hover:border-orange-300'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br ${feature.accent} text-white shadow-sm shrink-0 group-hover:scale-105 transition-transform`}
                          >
                            <Icon className="w-4 h-4" />
                          </span>
                          <div className="min-w-0">
                            <h4
                              className={`text-sm font-semibold ${
                                isDark ? 'text-white' : 'text-gray-900'
                              }`}
                            >
                              {feature.title}
                            </h4>
                            <p
                              className={`mt-1 text-xs leading-relaxed ${
                                isDark
                                  ? 'text-gray-400'
                                  : 'text-gray-500'
                              }`}
                            >
                              {feature.description}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============================================
          WHY CHOOSE US
          ============================================ */}
      <section
        className={`py-16 ${
          isDark ? 'bg-gray-900/50' : 'bg-white'
        } border-y ${
          isDark ? 'border-gray-800' : 'border-orange-100'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2
              className={`text-3xl sm:text-4xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Why teams choose us
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: 'Fast to set up',
                description:
                  'From sign-up to first sale in under 10 minutes. No consultants, no onboarding calls.',
                accent: 'from-amber-500 to-orange-600',
              },
              {
                icon: Shield,
                title: 'Secure by default',
                description:
                  'Every route, every action, every user is permission-checked. Nothing is trusted by default.',
                accent: 'from-emerald-500 to-green-600',
              },
              {
                icon: DollarSign,
                title: 'One flat price',
                description:
                  'No per-transaction fees, no per-location fees. The price you see is the price you pay.',
                accent: 'from-blue-500 to-indigo-600',
              },
              {
                icon: Cloud,
                title: 'Always up to date',
                description:
                  'We ship improvements weekly. You get them automatically — nothing to install.',
                accent: 'from-purple-500 to-fuchsia-600',
              },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className={`rounded-2xl p-6 border text-center ${
                    isDark
                      ? 'bg-gray-900 border-gray-800'
                      : 'bg-orange-50/50 border-orange-100'
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${item.accent} text-white shadow-sm mb-4`}
                  >
                    <Icon className="w-6 h-6" />
                  </span>
                  <h3
                    className={`text-base font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p
                    className={`mt-2 text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}
                  >
                    {item.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================
          CTA
          ============================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-red-500 to-rose-600">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-yellow-300 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange-200 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Ready to try it?
            </h2>
            <p className="mt-4 text-lg text-orange-100 max-w-2xl mx-auto">
              Start a free trial today. No credit card required, no
              commitment, cancel anytime.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 bg-white text-orange-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                Start free trial
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/30 transition-all border border-white/30"
              >
                Browse the shop
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
