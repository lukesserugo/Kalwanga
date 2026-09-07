// D:\Projects\Kalwanga\packages\web\app\payment\cancel\page.tsx

'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  XCircle, ShoppingBag, Home, Mail, Phone,
  ArrowRight, HelpCircle, RefreshCw, AlertCircle
} from 'lucide-react';
import { useThemeStore } from '../../../app/stores/themeStore';
import PublicNavigation from '../../../components/PublicNavigation';

export default function PaymentCancelPage() {
  const { isDark } = useThemeStore();

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-950' : 'bg-gray-50'} transition-colors`}>
      <PublicNavigation />
      
      <div className="max-w-2xl mx-auto px-4 py-12 mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className={`rounded-2xl p-8 text-center ${
            isDark ? 'bg-gray-800' : 'bg-white'
          } shadow-sm border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}
        >
          <div className="w-20 h-20 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-10 h-10 text-yellow-600 dark:text-yellow-400" />
          </div>
          
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Payment Cancelled
          </h2>
          <p className={`mt-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Your payment was cancelled. No charges have been made to your account.
          </p>

          <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-gray-700/30' : 'bg-gray-50'}`}>
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              <AlertCircle className="w-4 h-4 inline mr-2 text-yellow-500" />
              If you encountered any issues, please contact our support team.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Link
              href="/cart"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Link>
            <Link
              href="/shop"
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <ShoppingBag className="w-4 h-4" />
              Continue Shopping
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Need help?
            </p>
            <div className="mt-2 flex flex-wrap gap-3 justify-center">
              <Link
                href="/support"
                className={`inline-flex items-center gap-1 text-sm ${
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <Mail className="w-4 h-4" />
                Contact Support
              </Link>
              <Link
                href="/faq"
                className={`inline-flex items-center gap-1 text-sm ${
                  isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                FAQ
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
