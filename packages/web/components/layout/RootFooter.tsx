// D:\Projects\Kalwanga\packages\web\components\layout\RootFooter.tsx

'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ShoppingBag,
  Mail,
  Phone,
  MapPin,
  Send,
  Loader2,
  CheckCircle2,
  Shield,
  CreditCard,
  Truck,
  RotateCcw,
  Headphones,
  ArrowUp,
  Globe,
  Lock
} from 'lucide-react';
import { useThemeStore } from '../../app/stores/themeStore';
import { toast } from '../../utils/toast-manager';

// ============================================
// SOCIAL ICONS — INLINE SVG FALLBACK
// ============================================
//
// lucide-react does not export brand logos (Facebook, Twitter, etc.)
// because of trademark restrictions. Rather than depending on a
// separate package, we render the brand marks as inline SVG. This
// keeps the footer self-contained and avoids another dependency.
//
// The generic `Facebook`, `Twitter`, etc. exports that older versions
// of lucide-react shipped have been removed — importing them causes
// the "Attempted import error" you saw.

interface IconProps {
  className?: string;
}

function FacebookIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function TwitterIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

function YoutubeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function LinkedinIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

// ============================================
// LINK GROUPS
// ============================================

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

interface FooterGroup {
  title: string;
  links: FooterLink[];
}

const FOOTER_GROUPS: FooterGroup[] = [
  {
    title: 'Shop',
    links: [
      { href: '/shop', label: 'All Products' },
      { href: '/categories', label: 'Categories' },
      { href: '/sale', label: 'Sale Items' },
      { href: '/new', label: 'New Arrivals' },
      { href: '/wishlist', label: 'Wishlist' },
      { href: '/compare', label: 'Compare' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: '/help', label: 'Help Center' },
      { href: '/contact', label: 'Contact Us' },
      { href: '/returns', label: 'Returns Policy' },
      { href: '/shipping', label: 'Shipping Info' },
      { href: '/faq', label: 'FAQ' },
      { href: '/status', label: 'System Status' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/features', label: 'Features' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/careers', label: 'Careers' },
      { href: '/blog', label: 'Blog' },
      { href: '/partners', label: 'Partners' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of Service' },
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/cookies', label: 'Cookie Policy' },
      { href: '/accessibility', label: 'Accessibility' },
      { href: '/gdpr', label: 'GDPR' },
      { href: '/licenses', label: 'Licenses' },
    ],
  },
];

// ============================================
// SOCIAL LINKS
// ============================================

interface SocialLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SOCIAL_LINKS: SocialLink[] = [
  { href: 'https://facebook.com', label: 'Facebook', icon: FacebookIcon },
  { href: 'https://twitter.com', label: 'Twitter', icon: TwitterIcon },
  { href: 'https://instagram.com', label: 'Instagram', icon: InstagramIcon },
  { href: 'https://youtube.com', label: 'YouTube', icon: YoutubeIcon },
  { href: 'https://linkedin.com', label: 'LinkedIn', icon: LinkedinIcon },
];

// ============================================
// TRUST BADGES
// ============================================

interface TrustBadge {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel?: string;
}

const TRUST_BADGES: TrustBadge[] = [
  { icon: Truck, label: 'Free Shipping', sublabel: 'On orders over $50' },
  { icon: RotateCcw, label: '30-Day Returns', sublabel: 'No questions asked' },
  { icon: Shield, label: 'Secure Payment', sublabel: '256-bit encryption' },
  { icon: Headphones, label: '24/7 Support', sublabel: 'We are here to help' },
];

// ============================================
// MAIN COMPONENT
// ============================================

export function RootFooter() {
  const { isDark } = useThemeStore();
  const [email, setEmail] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  // ------------------------------------------------
  // NEWSLETTER SUBSCRIBE
  // ------------------------------------------------

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      toast.error('Please enter your email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setSubscribing(true);

      // Simulated network delay — replace with real API call.
      await new Promise((resolve) => setTimeout(resolve, 800));

      setSubscribed(true);
      setEmail('');
      toast.success('Subscribed! Check your inbox to confirm.');
    } catch (err) {
      console.error('Subscription failed:', err);
      toast.error('Subscription failed. Please try again.');
    } finally {
      setSubscribing(false);
    }
  };

  const handleBackToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer
      className={`relative mt-auto border-t ${
        isDark ? 'bg-gray-950 border-gray-800' : 'bg-gray-900 border-gray-800'
      } text-gray-300`}
    >
      {/* ============================================
          TOP — TRUST BADGES STRIP
          ============================================ */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {TRUST_BADGES.map((badge) => {
              const Icon = badge.icon;
              return (
                <div key={badge.label} className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shrink-0 shadow-sm">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {badge.label}
                    </p>
                    {badge.sublabel && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {badge.sublabel}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================
          MAIN — BRAND + LINKS + NEWSLETTER
          ============================================ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* ---------- BRAND COLUMN ---------- */}
          <div className="lg:col-span-4 space-y-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2"
              aria-label="POS Store home"
            >
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-md">
                <ShoppingBag className="w-5 h-5" />
              </span>
              <span className="text-lg font-bold text-white">POS Store</span>
            </Link>

            <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
              Your one-stop platform for retail operations. Sell, track
              inventory, manage customers, and grow your business — all from
              one place.
            </p>

            <div className="space-y-2.5">
              <a
                href="mailto:support@pos-system.com"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors"
              >
                <Mail className="w-4 h-4 text-orange-500 shrink-0" />
                support@pos-system.com
              </a>
              <a
                href="tel:+18005550199"
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-orange-400 transition-colors"
              >
                <Phone className="w-4 h-4 text-orange-500 shrink-0" />
                +1 (800) 555-0199
              </a>
              <span className="flex items-start gap-2 text-sm text-gray-400">
                <MapPin className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <span>
                  123 Main Street, Suite 400
                  <br />
                  San Francisco, CA 94105
                </span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {SOCIAL_LINKS.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-gray-800 text-gray-400 hover:bg-orange-500 hover:text-white transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* ---------- LINK COLUMNS ---------- */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-2 gap-8">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-4">
                  {group.title}
                </h3>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        target={link.external ? '_blank' : undefined}
                        rel={link.external ? 'noopener noreferrer' : undefined}
                        className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* ---------- NEWSLETTER COLUMN ---------- */}
          <div className="lg:col-span-3 space-y-4">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                Stay in the loop
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Get product updates, feature announcements, and exclusive
                offers. No spam, unsubscribe anytime.
              </p>
            </div>

            {subscribed ? (
              <div className="flex items-start gap-2 p-3 rounded-xl border bg-emerald-950/30 border-emerald-900/50">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">
                    You are subscribed!
                  </p>
                  <p className="text-xs text-emerald-400/80 mt-0.5">
                    Check your inbox to confirm your email.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={subscribing}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm outline-none transition-colors border bg-gray-800 text-white placeholder-gray-500 border-gray-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 disabled:opacity-60"
                  />
                </div>
                <button
                  type="submit"
                  disabled={subscribing}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl text-sm font-medium shadow-md transition-all disabled:opacity-60"
                >
                  {subscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Subscribing…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Subscribe
                    </>
                  )}
                </button>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  By subscribing you agree to our{' '}
                  <Link
                    href="/privacy"
                    className="text-orange-500 hover:text-orange-400 underline-offset-2 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ============================================
          BOTTOM — PAYMENTS + LEGAL + COPYRIGHT
          ============================================ */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-orange-500" />
                We accept
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { label: 'Visa', color: 'from-blue-600 to-blue-800' },
                  {
                    label: 'Mastercard',
                    color: 'from-red-500 to-orange-500',
                  },
                  { label: 'Amex', color: 'from-sky-500 to-blue-700' },
                  { label: 'PayPal', color: 'from-sky-700 to-blue-900' },
                  {
                    label: 'Stripe',
                    color: 'from-indigo-500 to-violet-700',
                  },
                  {
                    label: 'Mobile',
                    color: 'from-emerald-500 to-green-700',
                  },
                ].map((pm) => (
                  <span
                    key={pm.label}
                    className={`inline-flex items-center justify-center h-6 px-2 rounded text-[10px] font-semibold text-white bg-gradient-to-br ${pm.color} shadow-sm`}
                  >
                    {pm.label}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleBackToTop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-gray-400 hover:text-white hover:bg-gray-800 ml-auto md:ml-0"
              aria-label="Back to top"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              Back to top
            </button>
          </div>

          <div className="my-5 border-t border-gray-800/60" />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-gray-500">
            <p className="flex flex-wrap items-center gap-2">
              <span>
                © {new Date().getFullYear()} POS Store. All rights reserved.
              </span>
              <span className="hidden md:inline text-gray-700">·</span>
              <span className="inline-flex items-center gap-1">
                <Globe className="w-3 h-3 text-orange-500" />
                Made for retailers worldwide
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                GDPR compliant
              </span>
              <span className="hidden md:inline text-gray-700">·</span>
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3 h-3 text-orange-500" />
                PCI-DSS aligned
              </span>
              <span className="hidden md:inline text-gray-700">·</span>
              <Link
                href="/cookies"
                className="hover:text-orange-400 transition-colors"
              >
                Cookies
              </Link>
              <span className="hidden md:inline text-gray-700">·</span>
              <Link
                href="/accessibility"
                className="hover:text-orange-400 transition-colors"
              >
                Accessibility
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent" />
    </footer>
  );
}

export default RootFooter;
