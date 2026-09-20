// D:\Projects\Kalwanga\packages\web\app\terms\page.tsx

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText,
  Calendar,
  Mail,
  Scale,
  Shield,
  Lock,
  CreditCard,
  Users,
  Building2,
  Globe,
  Package,
  ShoppingCart,
  RefreshCw,
  AlertTriangle,
  Ban,
  Gavel,
  BookOpen,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Phone,
  MapPin,
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

// ============================================
// TABLE OF CONTENTS
// ============================================
//
// Mirrors the sections below. Each entry has an `id` matching the
// section's anchor and a short label. Keeping this as data (not markup)
// makes it trivial to add/remove sections without touching JSX.

interface Section {
  id: string;
  number: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: Section[] = [
  { id: 'acceptance', number: 1, title: 'Acceptance of Terms', icon: CheckCircle2 },
  { id: 'definitions', number: 2, title: 'Definitions', icon: BookOpen },
  { id: 'eligibility', number: 3, title: 'Eligibility', icon: Users },
  { id: 'account', number: 4, title: 'Account Registration & Security', icon: Lock },
  { id: 'service', number: 5, title: 'Description of Service', icon: Package },
  { id: 'acceptable-use', number: 6, title: 'Acceptable Use Policy', icon: Shield },
  { id: 'prohibited', number: 7, title: 'Prohibited Conduct', icon: Ban },
  { id: 'payment', number: 8, title: 'Payments, Fees & Subscriptions', icon: CreditCard },
  { id: 'taxes', number: 9, title: 'Taxes', icon: FileText },
  { id: 'refunds', number: 10, title: 'Refund Policy', icon: RefreshCw },
  { id: 'customer-data', number: 11, title: 'Your Data & Customer Data', icon: Users },
  { id: 'ip', number: 12, title: 'Intellectual Property', icon: Building2 },
  { id: 'third-party', number: 13, title: 'Third-Party Services', icon: Globe },
  { id: 'availability', number: 14, title: 'Service Availability & Support', icon: ShoppingCart },
  { id: 'termination', number: 15, title: 'Termination', icon: AlertTriangle },
  { id: 'warranties', number: 16, title: 'Disclaimer of Warranties', icon: Shield },
  { id: 'liability', number: 17, title: 'Limitation of Liability', icon: Scale },
  { id: 'indemnification', number: 18, title: 'Indemnification', icon: Shield },
  { id: 'governing-law', number: 19, title: 'Governing Law & Disputes', icon: Gavel },
  { id: 'changes', number: 20, title: 'Changes to These Terms', icon: RefreshCw },
  { id: 'contact', number: 21, title: 'Contact Information', icon: Mail },
];

// ============================================
// PAGE
// ============================================

export default function TermsPage() {
  const { isDark } = useThemeStore();
  const lastUpdated = 'January 15, 2024';

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

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm text-white border border-white/30 mb-6">
              <FileText className="w-4 h-4 text-yellow-200" />
              <span>Legal</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              Terms of Service
            </h1>

            <p className="mt-4 text-lg text-orange-100 max-w-2xl">
              The rules that govern your use of POS System. Please read them
              carefully — by using our platform, you agree to them.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-orange-100">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-yellow-200" />
                Last updated: {lastUpdated}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-yellow-200" />
                {SECTIONS.length} sections
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================
          BODY
          ============================================ */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* ---------- TABLE OF CONTENTS (sidebar) ---------- */}
          <aside className="lg:col-span-1">
            <div
              className={`lg:sticky lg:top-24 rounded-2xl border p-4 ${
                isDark
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-white border-orange-100'
              }`}
            >
              <h2
                className={`text-sm font-bold mb-3 flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                <BookOpen className="w-4 h-4 text-orange-500" />
                Contents
              </h2>
              <nav className="space-y-0.5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
                {SECTIONS.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                      isDark
                        ? 'text-gray-400 hover:text-white hover:bg-gray-800'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-orange-50'
                    }`}
                  >
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-semibold ${
                        isDark
                          ? 'bg-gray-800 text-orange-400'
                          : 'bg-orange-100 text-orange-600'
                      }`}
                    >
                      {section.number}
                    </span>
                    <span className="flex-1 leading-snug">
                      {section.title}
                    </span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* ---------- SECTIONS ---------- */}
          <main className="lg:col-span-3">
            <div
              className={`rounded-2xl border p-6 sm:p-8 ${
                isDark
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-white border-orange-100'
              }`}
            >
              {/* Intro */}
              <div
                className={`p-4 rounded-xl border mb-8 ${
                  isDark
                    ? 'bg-orange-950/20 border-orange-900/50'
                    : 'bg-orange-50 border-orange-200'
                }`}
              >
                <p
                  className={`text-sm leading-relaxed ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  Welcome to POS System. These Terms of Service ("Terms")
                  govern your access to and use of our website, mobile
                  applications, APIs, and related services (collectively,
                  the "Service"). By creating an account, accessing, or
                  using the Service, you agree to be bound by these Terms.
                  If you do not agree, do not use the Service.
                </p>
              </div>

              {/* 1. Acceptance of Terms */}
              <TermsSection
                id="acceptance"
                number={1}
                title="Acceptance of Terms"
                icon={CheckCircle2}
                isDark={isDark}
              >
                <p>
                  By accessing, browsing, or using the Service, you
                  acknowledge that you have read, understood, and agree to
                  be bound by these Terms and our{' '}
                  <Link
                    href="/privacy"
                    className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>
                  . These Terms apply to all visitors, users, and others who
                  access or use the Service.
                </p>
                <p>
                  If you are entering into these Terms on behalf of a
                  company or other legal entity, you represent that you have
                  the authority to bind that entity, and "you" refers to
                  that entity.
                </p>
              </TermsSection>

              {/* 2. Definitions */}
              <TermsSection
                id="definitions"
                number={2}
                title="Definitions"
                icon={BookOpen}
                isDark={isDark}
              >
                <ul className="space-y-2 list-none pl-0">
                  {[
                    {
                      term: '"Account"',
                      def: 'the individual user account you create to access the Service.',
                    },
                    {
                      term: '"Business Unit"',
                      def: 'a store, warehouse, branch, or other operating location you register.',
                    },
                    {
                      term: '"Customer Data"',
                      def: "personal information about your customers that you enter into the Service.",
                    },
                    {
                      term: '"Content"',
                      def: 'text, images, product data, and other materials you upload or create.',
                    },
                    {
                      term: '"Subscription"',
                      def: 'a paid plan that grants access to premium features.',
                    },
                    {
                      term: '"We," "us," "our"',
                      def: 'POS System and its affiliates.',
                    },
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-orange-500 shrink-0">•</span>
                      <span>
                        <strong className="font-semibold">
                          {item.term}
                        </strong>{' '}
                        {item.def}
                      </span>
                    </li>
                  ))}
                </ul>
              </TermsSection>

              {/* 3. Eligibility */}
              <TermsSection
                id="eligibility"
                number={3}
                title="Eligibility"
                icon={Users}
                isDark={isDark}
              >
                <p>
                  You must be at least 18 years old and capable of forming a
                  binding contract to use the Service. By using the Service,
                  you represent and warrant that you meet these
                  requirements.
                </p>
                <p>
                  We reserve the right to refuse service, terminate
                  accounts, or cancel orders at our sole discretion,
                  including if we believe you have violated these Terms.
                </p>
              </TermsSection>

              {/* 4. Account Registration & Security */}
              <TermsSection
                id="account"
                number={4}
                title="Account Registration & Security"
                icon={Lock}
                isDark={isDark}
              >
                <p>
                  To access most features, you must register for an Account.
                  You agree to provide accurate, current, and complete
                  information during registration and to keep it updated.
                </p>
                <p>You are responsible for:</p>
                <ul className="space-y-1.5 list-none pl-0">
                  {[
                    'Maintaining the confidentiality of your login credentials.',
                    'All activities that occur under your Account.',
                    'Notifying us immediately of any unauthorized use or security breach.',
                    'Ensuring that all users you invite comply with these Terms.',
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  We are not liable for any loss or damage arising from your
                  failure to safeguard your credentials.
                </p>
              </TermsSection>

              {/* 5. Description of Service */}
              <TermsSection
                id="service"
                number={5}
                title="Description of Service"
                icon={Package}
                isDark={isDark}
              >
                <p>
                  POS System provides a cloud-based Point of Sale platform
                  that includes, but is not limited to:
                </p>
                <ul className="space-y-1.5 list-none pl-0">
                  {[
                    'Sales processing and receipt generation.',
                    'Inventory tracking across multiple business units.',
                    'Customer management, loyalty programs, and gift cards.',
                    'Payment processing and reconciliation.',
                    'Reporting, analytics, and business intelligence.',
                    'User management, roles, and permissions.',
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  We may modify, suspend, or discontinue any part of the
                  Service at any time, with or without notice. We are not
                  liable for any modification, suspension, or discontinuance.
                </p>
              </TermsSection>

              {/* 6. Acceptable Use Policy */}
              <TermsSection
                id="acceptable-use"
                number={6}
                title="Acceptable Use Policy"
                icon={Shield}
                isDark={isDark}
              >
                <p>You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree not to:</p>
                <ul className="space-y-1.5 list-none pl-0">
                  {[
                    'Violate any applicable laws or regulations.',
                    'Infringe the rights of others, including intellectual property rights.',
                    'Upload malicious code, viruses, or harmful content.',
                    'Attempt to gain unauthorized access to the Service or its systems.',
                    'Interfere with or disrupt the integrity or performance of the Service.',
                    'Use the Service to send spam or unsolicited communications.',
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <Ban className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </TermsSection>

              {/* 7. Prohibited Conduct */}
              <TermsSection
                id="prohibited"
                number={7}
                title="Prohibited Conduct"
                icon={Ban}
                isDark={isDark}
              >
                <p>
                  The following activities are strictly prohibited and may
                  result in immediate termination of your Account:
                </p>
                <ul className="space-y-1.5 list-none pl-0">
                  {[
                    'Using the Service to sell illegal goods or services.',
                    'Processing fraudulent transactions or engaging in money laundering.',
                    'Impersonating another person or entity.',
                    'Reverse engineering, decompiling, or attempting to extract source code.',
                    'Reselling or sublicensing the Service without written permission.',
                    'Circumventing usage limits, security features, or access controls.',
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <Ban className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </TermsSection>

              {/* 8. Payments, Fees & Subscriptions */}
              <TermsSection
                id="payment"
                number={8}
                title="Payments, Fees & Subscriptions"
                icon={CreditCard}
                isDark={isDark}
              >
                <p>
                  Certain features of the Service require payment. You agree
                  to pay all fees associated with your chosen Subscription
                  in accordance with the pricing in effect at the time of
                  purchase.
                </p>
                <p>
                  Subscriptions renew automatically at the end of each
                  billing period unless cancelled. You may cancel at any
                  time from your account settings. Cancellation takes effect
                  at the end of the current billing period — no partial
                  refunds are issued for unused time.
                </p>
                <p>
                  We reserve the right to change our fees. We will provide
                  advance notice of any fee changes, and continued use of
                  the Service after the change constitutes acceptance.
                </p>
              </TermsSection>

              {/* 9. Taxes */}
              <TermsSection
                id="taxes"
                number={9}
                title="Taxes"
                icon={FileText}
                isDark={isDark}
              >
                <p>
                  All fees are exclusive of applicable taxes, which are your
                  responsibility. You agree to pay any sales, use, value-added,
                  or similar taxes imposed on your use of the Service,
                  excluding taxes on our net income.
                </p>
                <p>
                  If we are required to collect taxes, we will add them to
                  your invoice. You are responsible for providing accurate
                  tax identification information.
                </p>
              </TermsSection>

              {/* 10. Refund Policy */}
              <TermsSection
                id="refunds"
                number={10}
                title="Refund Policy"
                icon={RefreshCw}
                isDark={isDark}
              >
                <p>
                  Except as required by law or expressly stated otherwise,
                  all fees are non-refundable. This includes, but is not
                  limited to, fees for partial months, unused features, or
                  accounts terminated for violations of these Terms.
                </p>
                <p>
                  If you believe you have been charged in error, contact us
                  within 30 days of the charge and we will investigate.
                </p>
              </TermsSection>

              {/* 11. Your Data & Customer Data */}
              <TermsSection
                id="customer-data"
                number={11}
                title="Your Data & Customer Data"
                icon={Users}
                isDark={isDark}
              >
                <p>
                  You retain ownership of all data you enter into the Service,
                  including product catalogs, sales records, and Customer
                  Data. You grant us a limited license to process that data
                  solely to provide the Service.
                </p>
                <p>
                  You are responsible for complying with all applicable data
                  protection laws, including obtaining any necessary consents
                  from your customers before entering their information.
                </p>
                <p>
                  We will handle Customer Data in accordance with our{' '}
                  <Link
                    href="/privacy"
                    className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>
                  . You may export your data at any time. Upon termination,
                  we will retain your data for a reasonable period to allow
                  export, after which it will be deleted.
                </p>
              </TermsSection>

              {/* 12. Intellectual Property */}
              <TermsSection
                id="ip"
                number={12}
                title="Intellectual Property"
                icon={Building2}
                isDark={isDark}
              >
                <p>
                  The Service, including all software, text, graphics, logos,
                  and other content provided by us, is owned by POS System
                  and is protected by copyright, trademark, and other
                  intellectual property laws.
                </p>
                <p>
                  You may not copy, modify, distribute, sell, or lease any
                  part of the Service, nor may you reverse engineer or
                  attempt to extract the source code, unless expressly
                  permitted in writing.
                </p>
              </TermsSection>

              {/* 13. Third-Party Services */}
              <TermsSection
                id="third-party"
                number={13}
                title="Third-Party Services"
                icon={Globe}
                isDark={isDark}
              >
                <p>
                  The Service integrates with third-party providers such as
                  payment gateways (Stripe, PayPal, Flutterwave, Paystack,
                  Square), authentication providers, and cloud
                  infrastructure. Your use of those services is subject to
                  their own terms and privacy policies.
                </p>
                <p>
                  We are not responsible for the availability, accuracy, or
                  conduct of any third-party service, and we disclaim all
                  liability arising from your use of them.
                </p>
              </TermsSection>

              {/* 14. Service Availability & Support */}
              <TermsSection
                id="availability"
                number={14}
                title="Service Availability & Support"
                icon={ShoppingCart}
                isDark={isDark}
              >
                <p>
                  We strive to keep the Service available 24/7, but we do
                  not guarantee uninterrupted access. The Service may be
                  temporarily unavailable due to maintenance, updates, or
                  circumstances beyond our control.
                </p>
                <p>
                  Support is available by email and, on eligible plans,
                  phone. Response times vary by plan. We do not provide a
                  service-level guarantee unless expressly stated in a
                  separate written agreement.
                </p>
              </TermsSection>

              {/* 15. Termination */}
              <TermsSection
                id="termination"
                number={15}
                title="Termination"
                icon={AlertTriangle}
                isDark={isDark}
              >
                <p>
                  We may suspend or terminate your Account at any time,
                  with or without notice, if we believe you have violated
                  these Terms or engaged in conduct that harms the Service,
                  our users, or third parties.
                </p>
                <p>
                  You may terminate your Account at any time from your
                  account settings. Upon termination, your right to use the
                  Service ceases immediately. Sections that by their nature
                  should survive termination (including IP, liability,
                  indemnification, and governing law) will survive.
                </p>
              </TermsSection>

              {/* 16. Disclaimer of Warranties */}
              <TermsSection
                id="warranties"
                number={16}
                title="Disclaimer of Warranties"
                icon={Shield}
                isDark={isDark}
              >
                <p className="uppercase text-xs tracking-wide font-semibold">
                  The Service is provided "as is" and "as available,"
                  without warranties of any kind, whether express, implied,
                  or statutory.
                </p>
                <p>
                  To the fullest extent permitted by law, we disclaim all
                  warranties, including implied warranties of
                  merchantability, fitness for a particular purpose, and
                  non-infringement. We do not warrant that the Service will
                  be uninterrupted, error-free, or free of harmful
                  components.
                </p>
              </TermsSection>

              {/* 17. Limitation of Liability */}
              <TermsSection
                id="liability"
                number={17}
                title="Limitation of Liability"
                icon={Scale}
                isDark={isDark}
              >
                <p className="uppercase text-xs tracking-wide font-semibold">
                  To the maximum extent permitted by law, POS System shall
                  not be liable for any indirect, incidental, special,
                  consequential, or punitive damages, including lost
                  profits, lost revenue, lost data, or business
                  interruption.
                </p>
                <p>
                  Our total aggregate liability arising out of or relating
                  to these Terms or the Service will not exceed the greater
                  of (a) the amount you paid us in the twelve months
                  preceding the claim, or (b) one hundred US dollars (USD
                  $100).
                </p>
              </TermsSection>

              {/* 18. Indemnification */}
              <TermsSection
                id="indemnification"
                number={18}
                title="Indemnification"
                icon={Shield}
                isDark={isDark}
              >
                <p>
                  You agree to indemnify, defend, and hold harmless POS
                  System, its officers, directors, employees, and agents
                  from any claims, damages, losses, liabilities, and
                  expenses (including reasonable legal fees) arising out of
                  or relating to:
                </p>
                <ul className="space-y-1.5 list-none pl-0">
                  {[
                    'Your use of the Service.',
                    'Your violation of these Terms.',
                    'Your violation of any third-party right.',
                    'Content or Customer Data you submit to the Service.',
                  ].map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-orange-500 shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </TermsSection>

              {/* 19. Governing Law & Disputes */}
              <TermsSection
                id="governing-law"
                number={19}
                title="Governing Law & Disputes"
                icon={Gavel}
                isDark={isDark}
              >
                <p>
                  These Terms are governed by the laws of the jurisdiction
                  in which POS System is registered, without regard to its
                  conflict-of-law principles.
                </p>
                <p>
                  Any dispute arising out of or relating to these Terms will
                  be resolved through good-faith negotiation first. If
                  negotiation fails, the dispute will be resolved by binding
                  arbitration in accordance with the rules of the applicable
                  arbitration body, or in a court of competent jurisdiction.
                </p>
              </TermsSection>

              {/* 20. Changes to These Terms */}
              <TermsSection
                id="changes"
                number={20}
                title="Changes to These Terms"
                icon={RefreshCw}
                isDark={isDark}
              >
                <p>
                  We may update these Terms from time to time. When we do,
                  we will revise the "Last Updated" date at the top of this
                  page and, for material changes, notify you by email or
                  through the Service.
                </p>
                <p>
                  Your continued use of the Service after the changes take
                  effect constitutes acceptance of the updated Terms. If you
                  do not agree, you must stop using the Service.
                </p>
              </TermsSection>

              {/* 21. Contact Information */}
              <TermsSection
                id="contact"
                number={21}
                title="Contact Information"
                icon={Mail}
                isDark={isDark}
                isLast
              >
                <p>
                  Questions about these Terms? Contact our legal team:
                </p>
                <div className="not-prose grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <ContactCard
                    icon={Mail}
                    label="Legal"
                    value="legal@pos-system.com"
                    href="mailto:legal@pos-system.com"
                    isDark={isDark}
                  />
                  <ContactCard
                    icon={Mail}
                    label="Support"
                    value="support@pos-system.com"
                    href="mailto:support@pos-system.com"
                    isDark={isDark}
                  />
                  <ContactCard
                    icon={Phone}
                    label="Phone"
                    value="+1 (800) 555-0199"
                    href="tel:+18005550199"
                    isDark={isDark}
                  />
                  <ContactCard
                    icon={MapPin}
                    label="Postal"
                    value="123 Main Street, Suite 400"
                    isDark={isDark}
                  />
                </div>
              </TermsSection>
            </div>

            {/* ============================================
                RELATED LINKS
                ============================================ */}
            <div
              className={`mt-6 rounded-2xl border p-6 ${
                isDark
                  ? 'bg-gray-900 border-gray-800'
                  : 'bg-white border-orange-100'
              }`}
            >
              <h3
                className={`text-sm font-bold mb-4 flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4 text-orange-500" />
                Related Documents
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    href: '/privacy',
                    label: 'Privacy Policy',
                    icon: Shield,
                  },
                  {
                    href: '/cookies',
                    label: 'Cookie Policy',
                    icon: FileText,
                  },
                  {
                    href: '/help',
                    label: 'Help Center',
                    icon: BookOpen,
                  },
                ].map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                        isDark
                          ? 'border-gray-800 hover:bg-gray-800'
                          : 'border-orange-100 hover:bg-orange-50'
                      }`}
                    >
                      <span
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${
                          isDark
                            ? 'bg-gray-800 text-orange-400'
                            : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </span>
                      <span
                        className={`flex-1 text-sm font-medium ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}
                      >
                        {link.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* ============================================
                ACCEPTANCE FOOTNOTE
                ============================================ */}
            <div
              className={`mt-6 p-4 rounded-xl border text-center ${
                isDark
                  ? 'bg-orange-950/20 border-orange-900/50'
                  : 'bg-orange-50 border-orange-200'
              }`}
            >
              <p
                className={`text-sm ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                By continuing to use POS System, you acknowledge that you
                have read and agree to these Terms of Service.
              </p>
              <Link
                href="/"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 transition-colors"
              >
                Return to home
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </main>
        </div>
      </div>

      {/* Custom Scrollbar Styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #fbbf24;
          border-radius: 3px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #b45309;
        }
      `}</style>
    </div>
  );
}

// ============================================
// SECTION COMPONENT
// ============================================

interface TermsSectionProps {
  id: string;
  number: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isDark: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}

function TermsSection({
  id,
  number,
  title,
  icon: Icon,
  isDark,
  isLast,
  children,
}: TermsSectionProps) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 ${
        isLast
          ? ''
          : 'mb-8 pb-8 border-b border-gray-100 dark:border-gray-800'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <span
          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-sm font-bold ${
            isDark
              ? 'bg-orange-950/40 text-orange-400'
              : 'bg-orange-100 text-orange-600'
          }`}
        >
          {number}
        </span>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon className="w-4 h-4 text-orange-500 shrink-0" />
          <h2
            className={`text-lg font-bold ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {title}
          </h2>
        </div>
      </div>
      <div
        className={`space-y-3 text-sm leading-relaxed pl-0 sm:pl-11 ${
          isDark ? 'text-gray-400' : 'text-gray-600'
        }`}
      >
        {children}
      </div>
    </section>
  );
}

// ============================================
// CONTACT CARD COMPONENT
// ============================================

interface ContactCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
  isDark: boolean;
}

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
  isDark,
}: ContactCardProps) {
  const inner = (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
        isDark
          ? 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
          : 'bg-orange-50/50 border-orange-100 hover:bg-orange-50'
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
          isDark
            ? 'bg-gray-800 text-orange-400'
            : 'bg-white text-orange-600'
        }`}
      >
        <Icon className="w-4 h-4" />
      </span>
      <div className="min-w-0">
        <p
          className={`text-[10px] font-medium uppercase tracking-wider ${
            isDark ? 'text-gray-500' : 'text-gray-500'
          }`}
        >
          {label}
        </p>
        <p
          className={`text-xs font-medium truncate ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );

  if (href) {
    return <a href={href}>{inner}</a>;
  }
  return inner;
}
