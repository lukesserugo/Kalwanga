// D:\Projects\Kalwanga\packages\web\app\help\page.tsx

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Rocket,
  Package,
  CreditCard,
  BarChart3,
  Users,
  Shield,
  Settings,
  ShoppingCart,
  Truck,
  RotateCcw,
  FileText,
  Gift,
  Crown,
  Barcode,
  Receipt,
  Building2,
  Bell,
  Mail,
  Phone,
  MessageCircle,
  BookOpen,
  Video,
  LifeBuoy,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  HelpCircle,
  Clock,
  Zap,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

// ============================================
// TYPES
// ============================================

interface HelpTopic {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  href: string;
  articleCount: number;
}

interface FAQ {
  id: string;
  category: string;
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// ============================================
// HELP TOPICS
// ============================================

const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Set up your account and make your first sale in minutes',
    icon: Rocket,
    accent: 'from-orange-500 to-red-500',
    href: '/docs/getting-started',
    articleCount: 12,
  },
  {
    id: 'inventory',
    title: 'Inventory Management',
    description: 'Products, stock levels, variants, transfers, and counts',
    icon: Package,
    accent: 'from-blue-500 to-sky-600',
    href: '/docs/inventory',
    articleCount: 24,
  },
  {
    id: 'sales',
    title: 'Sales & Payments',
    description: 'POS, payment methods, receipts, refunds, and returns',
    icon: CreditCard,
    accent: 'from-emerald-500 to-green-600',
    href: '/docs/sales',
    articleCount: 18,
  },
  {
    id: 'reports',
    title: 'Reports & Analytics',
    description: 'Sales, inventory, customer, and financial reporting',
    icon: BarChart3,
    accent: 'from-purple-500 to-violet-600',
    href: '/docs/reports',
    articleCount: 15,
  },
  {
    id: 'customers',
    title: 'Customer Management',
    description: 'Profiles, loyalty programs, gift cards, and promotions',
    icon: Users,
    accent: 'from-pink-500 to-rose-600',
    href: '/docs/customers',
    articleCount: 14,
  },
  {
    id: 'team',
    title: 'Team & Permissions',
    description: 'Users, roles, groups, invitations, and access control',
    icon: Shield,
    accent: 'from-teal-500 to-cyan-600',
    href: '/docs/team',
    articleCount: 16,
  },
  {
    id: 'operations',
    title: 'Daily Operations',
    description: 'Shifts, cash registers, purchase orders, and suppliers',
    icon: Settings,
    accent: 'from-amber-500 to-orange-600',
    href: '/docs/operations',
    articleCount: 20,
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Common issues, error messages, and how to fix them',
    icon: LifeBuoy,
    accent: 'from-slate-500 to-gray-700',
    href: '/docs/troubleshooting',
    articleCount: 22,
  },
];

// ============================================
// FAQ CATEGORIES
// ============================================

const FAQ_CATEGORIES: FAQCategory[] = [
  { id: 'all', label: 'All questions', icon: HelpCircle },
  { id: 'general', label: 'General', icon: Sparkles },
  { id: 'sales', label: 'Sales', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'team', label: 'Team', icon: Shield },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

// ============================================
// FAQ DATA
// ============================================

const FAQS: FAQ[] = [
  // General
  {
    id: 'how-to-start',
    category: 'general',
    question: 'How do I get started with the POS system?',
    answer:
      'Create an account, complete the onboarding wizard (business name, currency, timezone, and first business unit), then add your first products. You can import products from CSV, generate barcodes, and invite staff — all before processing your first sale. The whole setup usually takes under 10 minutes.',
  },
  {
    id: 'offline-mode',
    category: 'general',
    question: 'Does the POS system work offline?',
    answer:
      'Yes. The POS interface caches your catalog locally, so you can continue to sell when the internet drops. Sales queue in the browser and sync automatically to the cloud the moment your connection returns. Conflicts are resolved last-write-wins with a full audit trail.',
  },
  {
    id: 'data-security',
    category: 'general',
    question: 'Is my data secure?',
    answer:
      'Yes. All traffic is encrypted in transit, and the database is encrypted at rest. Authentication is handled by Clerk with JWT verification on every request, and every route is permission-checked. We run automatic backups with point-in-time recovery, and every mutation is recorded in the audit log.',
  },
  {
    id: 'multiple-business-units',
    category: 'general',
    question: 'Can I manage multiple shops or warehouses?',
    answer:
      'Yes. The system supports unlimited business units (headquarters, branches, warehouses, stores), each with its own staff, inventory, and settings. You can transfer stock between units, run reports per unit, and consolidate at the company level.',
  },
  {
    id: 'mobile-access',
    category: 'general',
    question: 'Can I use it on a phone or tablet?',
    answer:
      'Yes. The interface is fully responsive and works on any modern browser. No separate mobile app is required. The POS screen is optimized for both touch and keyboard input.',
  },

  // Sales
  {
    id: 'process-sale',
    category: 'sales',
    question: 'How do I process a sale?',
    answer:
      'Open the POS terminal, scan or search for a product, adjust the quantity if needed, then hit checkout. You can apply discounts, add a customer, choose a payment method, and print or email the receipt — all in one flow.',
  },
  {
    id: 'split-payment',
    category: 'sales',
    question: 'Can a customer pay with multiple methods?',
    answer:
      'Yes. The checkout screen supports split payments — for example, part cash and part card, or part gift card and part cash. The system tracks each payment separately and reconciles them against the sale total.',
  },
  {
    id: 'returns-refunds',
    category: 'sales',
    question: 'How do I handle returns and refunds?',
    answer:
      'Look up the original sale by receipt number, select the items being returned, choose the refund method (original payment, cash, store credit, or bank transfer), and confirm. Inventory is restocked automatically and the refund is recorded against the original payment.',
  },
  {
    id: 'hold-sale',
    category: 'sales',
    question: 'Can I put a sale on hold?',
    answer:
      'Yes. If a customer needs to grab something else or step away, you can park the cart. It will reappear in the "Held Sales" list, and any cashier on the same register can pick it up.',
  },
  {
    id: 'receipt-email',
    category: 'sales',
    question: 'Can I email receipts to customers?',
    answer:
      'Yes. At checkout, enter the customer\'s email and choose "Email receipt." The system sends a PDF receipt with your branding, order details, and a link to view the order online.',
  },

  // Inventory
  {
    id: 'manage-inventory',
    category: 'inventory',
    question: 'How do I manage inventory?',
    answer:
      'Add products from the Catalog page, set a reorder point and reorder quantity, and the system handles the rest. You get low-stock alerts automatically, and purchase orders can be generated in one click when stock falls below the threshold.',
  },
  {
    id: 'variants',
    category: 'inventory',
    question: 'Can I track product variants like size and color?',
    answer:
      'Yes. Any product can have unlimited variants — size, color, material, or any custom attribute. Each variant has its own SKU, barcode, price, cost, and stock level, while rolling up to the parent product for reporting.',
  },
  {
    id: 'multi-location-stock',
    category: 'inventory',
    question: 'Can I track stock at multiple locations?',
    answer:
      'Yes. Each business unit has its own inventory. You can transfer stock between locations, track in-transit quantities, and see a consolidated view across the whole company.',
  },
  {
    id: 'bulk-import',
    category: 'inventory',
    question: 'Can I import my existing product catalog?',
    answer:
      'Yes. The import wizard accepts CSV files with columns for name, SKU, price, cost, category, stock, and more. You can preview the import, fix errors before committing, and roll back if something goes wrong.',
  },
  {
    id: 'barcodes',
    category: 'inventory',
    question: 'Can I generate barcodes for my products?',
    answer:
      'Yes. The barcode generator supports EAN-13, UPC-A, and CODE128 formats, plus QR codes. You can generate codes one at a time or in bulk, print labels directly, and scan them at the POS.',
  },

  // Payments
  {
    id: 'payment-methods',
    category: 'payments',
    question: 'What payment methods are supported?',
    answer:
      'Cash, credit/debit cards (Stripe, Square), bank transfers, mobile money (MTN, Airtel, Tigo, Vodafone), gift cards, loyalty points, checks, and PayPal, Flutterwave, Paystack. You can enable or disable each method per business unit.',
  },
  {
    id: 'payment-gateways',
    category: 'payments',
    question: 'How do I connect a payment gateway?',
    answer:
      'Go to Settings > Payment Providers, choose the provider you want (Stripe, PayPal, Flutterwave, Paystack, or Square), paste your API keys, and save. The provider will appear as an option at checkout immediately.',
  },
  {
    id: 'refund-methods',
    category: 'payments',
    question: 'How are refunds processed?',
    answer:
      'Refunds can be issued to the original payment method (if the gateway supports it), as cash, as store credit, or via bank transfer. The system tracks which refunds have been completed and which are still pending.',
  },
  {
    id: 'gift-cards',
    category: 'payments',
    question: 'Do you support gift cards?',
    answer:
      'Yes. You can issue gift cards with a fixed balance, track their balance over time, and accept them as a payment method at checkout. Gift cards can expire or be permanent, depending on your settings.',
  },

  // Customers
  {
    id: 'customer-loyalty',
    category: 'customers',
    question: 'How does the loyalty program work?',
    answer:
      'Customers earn points on every purchase (you set the points-per-dollar rate). Points accumulate across visits and can be redeemed for discounts, free products, or tier upgrades. You can also create custom reward tiers.',
  },
  {
    id: 'customer-import',
    category: 'customers',
    question: 'Can I import my existing customer list?',
    answer:
      'Yes. The customer import wizard accepts CSV files with name, email, phone, address, and loyalty balance. Duplicates are detected automatically based on email, and you can choose to skip, merge, or update them.',
  },
  {
    id: 'promotions',
    category: 'customers',
    question: 'Can I run promotions and discounts?',
    answer:
      'Yes. The promotions engine supports percentage discounts, fixed-amount discounts, buy-one-get-one, bundles, tiered pricing, and free shipping. Promotions can be limited by date, customer group, or product category.',
  },

  // Team
  {
    id: 'add-staff',
    category: 'team',
    question: 'How do I add staff members?',
    answer:
      'Go to Users > Invite. Enter their email, pick a role (Cashier, Employee, Manager, Admin, etc.), and optionally pre-assign them to a business unit. They\'ll receive an invitation with a sign-up link that expires in 7 days.',
  },
  {
    id: 'roles-permissions',
    category: 'team',
    question: 'What roles are available?',
    answer:
      'Eight built-in roles: Super Admin, Admin, Manager, Editor, Viewer, Employee, Cashier, and User. Each role has a sensible default permission set. You can override the defaults per user or per group if you need finer control.',
  },
  {
    id: 'user-groups',
    category: 'team',
    question: 'Can I organize staff into teams?',
    answer:
      'Yes. User groups let you batch-assign permissions and manage staff by department, location, or shift. Each group has its own permission set, and you can designate group leads who get additional privileges.',
  },
  {
    id: 'activity-log',
    category: 'team',
    question: 'Can I see what my staff have been doing?',
    answer:
      'Yes. Every action is logged in the audit trail — who did what, when, from which device. You can filter by user, action, entity type, and date range, and export the log for compliance or review.',
  },

  // Reports
  {
    id: 'generate-reports',
    category: 'reports',
    question: 'What reports can I generate?',
    answer:
      'Sales reports (by day, week, month, product, category, cashier), inventory reports (stock levels, movement history, valuation, dead stock), customer reports (cohorts, lifetime value, retention), and financial reports (P&L, balance sheet, cash flow, tax summary).',
  },
  {
    id: 'export-data',
    category: 'reports',
    question: 'Can I export my data?',
    answer:
      'Yes. Every list and report can be exported as CSV, Excel, PDF, or JSON. Exports run in the background for large datasets, and you\'ll get a notification when the file is ready to download.',
  },
  {
    id: 'real-time-dashboard',
    category: 'reports',
    question: 'Is there a live dashboard?',
    answer:
      'Yes. The main dashboard shows today\'s sales, top products, recent transactions, low-stock alerts, and pending orders — all updating in real time without a page refresh.',
  },
];

// ============================================
// SUPPORT CHANNELS
// ============================================

const SUPPORT_CHANNELS = [
  {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Step-by-step guides for every feature',
    href: '/docs',
    action: 'Browse docs',
    accent: 'from-orange-500 to-red-500',
  },
  {
    icon: Mail,
    title: 'Email Support',
    description: 'support@posstore.com — replies within 24 hours',
    href: 'mailto:support@posstore.com',
    action: 'Send email',
    accent: 'from-blue-500 to-sky-600',
  },
  {
    icon: MessageCircle,
    title: 'Live Chat',
    description: 'Available Mon–Fri, 9am–6pm in your timezone',
    href: '/contact',
    action: 'Start chat',
    accent: 'from-emerald-500 to-green-600',
  },
  {
    icon: Phone,
    title: 'Phone Support',
    description: 'Pro and Enterprise plans — call us anytime',
    href: 'tel:+1-800-555-0199',
    action: 'Call now',
    accent: 'from-purple-500 to-violet-600',
  },
];

// ============================================
// PAGE
// ============================================

export default function HelpPage() {
  const { isDark } = useThemeStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  // Filter FAQs by search + category
  const filteredFAQs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQS.filter((faq) => {
      const matchesCategory =
        activeCategory === 'all' || faq.category === activeCategory;
      const matchesSearch =
        q === '' ||
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: FAQS.length };
    FAQS.forEach((faq) => {
      counts[faq.category] = (counts[faq.category] || 0) + 1;
    });
    return counts;
  }, []);

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
              <LifeBuoy className="w-4 h-4 text-yellow-200" />
              <span>Help Center</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              How can we <span className="text-yellow-200">help</span>?
            </h1>

            <p className="mt-6 text-lg text-orange-100 max-w-2xl mx-auto">
              Search our knowledge base, browse by topic, or get in touch
              with the support team.
            </p>

            {/* Search bar */}
            <div className="mt-8 relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers…"
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white/95 backdrop-blur-md text-gray-900 placeholder-gray-500 border border-white/30 focus:border-white focus:ring-2 focus:ring-white/40 outline-none text-base shadow-lg"
              />
            </div>

            {/* Quick jump pills */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {['Set up my account', 'Add products', 'Process a sale', 'Refunds'].map(
                (label) => (
                  <button
                    key={label}
                    onClick={() => setSearchQuery(label)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white bg-white/15 backdrop-blur-sm border border-white/25 hover:bg-white/25 transition-all"
                  >
                    {label}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ),
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================
          HELP TOPICS
          ============================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2
            className={`text-2xl sm:text-3xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Browse by topic
          </h2>
          <p
            className={`mt-2 text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {HELP_TOPICS.reduce((sum, t) => sum + t.articleCount, 0)}{' '}
            articles across {HELP_TOPICS.length} topics
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HELP_TOPICS.map((topic, index) => {
            const Icon = topic.icon;
            return (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
              >
                <Link
                  href={topic.href}
                  className={`group block rounded-2xl border p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                    isDark
                      ? 'bg-gray-900 border-gray-800 hover:border-orange-900'
                      : 'bg-white border-orange-100 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${topic.accent} text-white shadow-sm group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-5 h-5" />
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <h3
                    className={`text-sm font-bold ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {topic.title}
                  </h3>
                  <p
                    className={`mt-1 text-xs leading-relaxed ${
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    }`}
                  >
                    {topic.description}
                  </p>
                  <p
                    className={`mt-3 text-[11px] font-medium ${
                      isDark ? 'text-orange-400' : 'text-orange-600'
                    }`}
                  >
                    {topic.articleCount} articles
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ============================================
          FAQ SECTION
          ============================================ */}
      <section
        className={`py-16 border-y ${
          isDark
            ? 'bg-gray-900/50 border-gray-800'
            : 'bg-white border-orange-100'
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2
              className={`text-2xl sm:text-3xl font-bold ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}
            >
              Frequently asked questions
            </h2>
            <p
              className={`mt-2 text-sm ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              The answers most people are looking for
            </p>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {FAQ_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              const count = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md'
                      : isDark
                        ? 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                        : 'bg-orange-50 text-gray-600 hover:text-gray-900 hover:bg-orange-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.label}
                  <span
                    className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums ${
                      isActive
                        ? 'bg-white/25'
                        : isDark
                          ? 'bg-gray-700'
                          : 'bg-white'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* FAQ list */}
          {filteredFAQs.length === 0 ? (
            <div
              className={`rounded-2xl border p-12 text-center ${
                isDark
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-orange-50/50 border-orange-100'
              }`}
            >
              <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-3" />
              <h3
                className={`text-base font-semibold ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                No matching questions
              </h3>
              <p
                className={`mt-1 text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                Try a different search or browse by category.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('all');
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-gray-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFAQs.map((faq, index) => {
                const isExpanded = expandedFAQ === faq.id;
                return (
                  <motion.div
                    key={faq.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    className={`rounded-2xl border overflow-hidden transition-all ${
                      isDark
                        ? 'bg-gray-900 border-gray-800'
                        : 'bg-white border-orange-100'
                    } ${isExpanded ? 'shadow-md' : ''}`}
                  >
                    <button
                      onClick={() =>
                        setExpandedFAQ(isExpanded ? null : faq.id)
                      }
                      className="w-full flex items-start gap-3 p-5 text-left"
                    >
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 mt-0.5 ${
                          isExpanded
                            ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white'
                            : isDark
                              ? 'bg-gray-800 text-gray-400'
                              : 'bg-orange-50 text-orange-500'
                        }`}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </span>
                      <span
                        className={`flex-1 text-sm font-semibold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {faq.question}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 mt-1 text-gray-400 transition-transform duration-200 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="answer"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: 'easeOut' }}
                          className="overflow-hidden"
                        >
                          <div
                            className={`px-5 pb-5 pl-[60px] text-sm leading-relaxed ${
                              isDark ? 'text-gray-400' : 'text-gray-600'
                            }`}
                          >
                            {faq.answer}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============================================
          SUPPORT CHANNELS
          ============================================ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2
            className={`text-2xl sm:text-3xl font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            Still need help?
          </h2>
          <p
            className={`mt-2 text-sm ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            Pick the support channel that works best for you
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUPPORT_CHANNELS.map((channel, index) => {
            const Icon = channel.icon;
            return (
              <motion.a
                key={channel.title}
                href={channel.href}
                target={channel.href.startsWith('http') ? '_blank' : undefined}
                rel={
                  channel.href.startsWith('http')
                    ? 'noopener noreferrer'
                    : undefined
                }
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`group block rounded-2xl border p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                  isDark
                    ? 'bg-gray-900 border-gray-800 hover:border-orange-900'
                    : 'bg-white border-orange-100 hover:border-orange-300'
                }`}
              >
                <span
                  className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br ${channel.accent} text-white shadow-sm mb-4 group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </span>
                <h3
                  className={`text-sm font-bold ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  {channel.title}
                </h3>
                <p
                  className={`mt-1 text-xs leading-relaxed ${
                    isDark ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {channel.description}
                </p>
                <span
                  className={`mt-3 inline-flex items-center gap-1 text-[11px] font-medium ${
                    isDark ? 'text-orange-400' : 'text-orange-600'
                  }`}
                >
                  {channel.action}
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </motion.a>
            );
          })}
        </div>
      </section>

      {/* ============================================
          QUICK LINKS / STATUS
          ============================================ */}
      <section
        className={`py-12 border-t ${
          isDark
            ? 'bg-gray-900/50 border-gray-800'
            : 'bg-white border-orange-100'
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: Clock,
                title: 'System status',
                description: 'All systems operational',
                href: '/status',
                accent: 'text-emerald-500',
              },
              {
                icon: Zap,
                title: 'Quick start guide',
                description: 'From signup to first sale',
                href: '/docs/getting-started',
                accent: 'text-orange-500',
              },
              {
                icon: CheckCircle2,
                title: 'Release notes',
                description: 'What changed recently',
                href: '/changelog',
                accent: 'text-blue-500',
              },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={index}
                  href={item.href}
                  className={`group flex items-start gap-3 p-4 rounded-xl border transition-all ${
                    isDark
                      ? 'border-gray-800 hover:bg-gray-800'
                      : 'border-orange-100 hover:bg-orange-50'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 mt-0.5 ${item.accent}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {item.title}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-1 group-hover:text-orange-500 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
