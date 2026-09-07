'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import PublicNavigation from '../../../../components/PublicNavigation';
import { useToast } from '../../../../hooks/useToast';
import { apiService } from '../../../../services/api';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  description: string;
  features: string[];
  popular?: boolean;
  buttonText: string;
  buttonLink: string;
  color?: string;
  icon?: string;
  savings?: number;
}

interface UserSubscription {
  id: string;
  planId: string;
  status: 'active' | 'inactive' | 'pending';
  startDate: string;
  endDate: string;
}

export default function PricingPage() {
  const { user, isLoaded } = useUser();
  const { showToast } = useToast();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [annualSavings, setAnnualSavings] = useState(0);

  // Mock user subscription - in production, fetch from API
  useEffect(() => {
    if (user) {
      // Simulate fetching subscription
      fetchSubscription();
    }
  }, [user]);

  const fetchSubscription = async () => {
    try {
      // Replace with actual API call
      // const response = await apiService.get('/subscription');
      // setCurrentSubscription(response.data);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  };

  const plans: PricingPlan[] = [
    {
      id: 'starter',
      name: 'Starter',
      price: 29,
      interval: 'monthly',
      description: 'Perfect for small businesses just getting started.',
      icon: '🚀',
      color: 'from-blue-400 to-blue-600',
      features: [
        'Up to 50 products',
        'Basic POS features',
        '1 user account',
        'Email support',
        'Inventory management',
        'Sales reports',
        'Customer management',
        '24/7 support',
      ],
      buttonText: 'Get Started',
      buttonLink: '/sign-up',
    },
    {
      id: 'professional',
      name: 'Professional',
      price: 79,
      interval: 'monthly',
      description: 'Ideal for growing businesses with more needs.',
      icon: '💼',
      color: 'from-purple-400 to-blue-600',
      features: [
        'Up to 500 products',
        'Advanced POS features',
        '5 user accounts',
        'Priority support',
        'Inventory management',
        'Sales analytics',
        'Customer management',
        'Gift cards & loyalty',
        'Multi-location support',
        'API access',
        'Custom branding',
      ],
      popular: true,
      buttonText: 'Start Free Trial',
      buttonLink: '/sign-up',
      savings: 20,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 199,
      interval: 'monthly',
      description: 'For large businesses with complex needs.',
      icon: '🏢',
      color: 'from-indigo-400 to-purple-600',
      features: [
        'Unlimited products',
        'Full POS features',
        'Unlimited users',
        'Dedicated support',
        'Advanced analytics',
        'Custom integrations',
        'White-label solution',
        'Multiple locations',
        'Bulk operations',
        'Advanced security',
        'Custom reporting',
        'SLA guarantee',
      ],
      buttonText: 'Contact Sales',
      buttonLink: '/contact',
    },
  ];

  const yearlyPlans = plans.map(plan => ({
    ...plan,
    price: Math.round(plan.price * 12 * 0.8), // 20% discount for yearly
    interval: 'yearly' as const,
    savings: plan.price ? 20 : undefined,
  }));

  const displayPlans = billingInterval === 'monthly' ? plans : yearlyPlans;

  // Calculate savings
  useEffect(() => {
    const monthlyTotal = plans.reduce((sum, plan) => sum + plan.price, 0);
    const yearlyTotal = yearlyPlans.reduce((sum, plan) => sum + plan.price, 0);
    setAnnualSavings(Math.round(((monthlyTotal * 12) - yearlyTotal) / 12));
  }, []);

  const handlePlanSelect = async (planId: string) => {
    if (!user) {
      showToast('Please sign in to select a plan', 'info');
      return;
    }

    setSelectedPlan(planId);
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Replace with actual API call
      // await apiService.post('/subscription', { planId, interval: billingInterval });
      
      showToast(`Successfully selected ${planId} plan!`, 'success');
      setSelectedPlan(null);
    } catch (error) {
      showToast('Failed to select plan. Please try again.', 'error');
    } finally {
      setIsLoading(false);
      setSelectedPlan(null);
    }
  };

  const getPriceDisplay = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const isCurrentPlan = (planId: string) => {
    return currentSubscription?.planId === planId && currentSubscription?.status === 'active';
  };

  const planVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    hover: { 
      scale: 1.02,
      transition: { duration: 0.2 }
    }
  };

  const featureVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: { delay: i * 0.05 }
    })
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <PublicNavigation />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 pt-32 pb-16 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-bold mb-4"
          >
            Simple, Transparent Pricing
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xl text-blue-100 max-w-2xl mx-auto"
          >
            Choose the plan that fits your business needs. All plans include a 14-day free trial.
          </motion.p>

          {/* Billing Toggle with Animation */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="mt-8 inline-flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-full p-1.5"
          >
            <button
              onClick={() => setBillingInterval('monthly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                billingInterval === 'monthly'
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'text-white hover:text-white/80'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('yearly')}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                billingInterval === 'yearly'
                  ? 'bg-white text-blue-600 shadow-lg'
                  : 'text-white hover:text-white/80'
              }`}
            >
              Yearly
              <span className="ml-2 text-xs bg-green-500 text-white px-2.5 py-0.5 rounded-full animate-pulse">
                Save 20%
              </span>
            </button>
          </motion.div>

          {/* Savings Indicator */}
          {billingInterval === 'yearly' && annualSavings > 0 && (
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-4 text-green-300 text-sm font-medium"
            >
              💰 Save up to ${annualSavings} per month with yearly billing
            </motion.p>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <AnimatePresence>
            {displayPlans.map((plan, index) => (
              <motion.div
                key={`${plan.id}-${billingInterval}`}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                variants={planVariants}
                transition={{ delay: index * 0.1 }}
                className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ${
                  plan.popular ? 'ring-2 ring-blue-600 scale-105 z-10' : 'hover:shadow-2xl'
                }`}
                onMouseEnter={() => setHoveredPlan(plan.id)}
                onMouseLeave={() => setHoveredPlan(null)}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1.5 text-sm font-medium rounded-bl-xl shadow-lg">
                    🌟 Most Popular
                  </div>
                )}

                {isCurrentPlan(plan.id) && (
                  <div className="absolute top-4 left-4 bg-green-500 text-white text-xs px-3 py-1 rounded-full font-medium shadow-lg">
                    ✓ Current Plan
                  </div>
                )}

                <div className="p-8">
                  {/* Plan Icon & Name */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{plan.icon}</span>
                    <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  </div>
                  
                  <p className="text-gray-600 mt-2 min-h-[48px]">{plan.description}</p>

                  {/* Price with Animation */}
                  <motion.div 
                    className="mt-6"
                    key={`price-${plan.id}-${billingInterval}`}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <span className="text-5xl font-bold text-gray-900">
                      {getPriceDisplay(plan.price)}
                    </span>
                    <span className="text-gray-600 ml-2">/ {plan.interval}</span>
                  </motion.div>

                  {plan.savings && billingInterval === 'yearly' && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-green-600 text-sm font-medium mt-1"
                    >
                      💰 Save ${plan.savings}% vs monthly
                    </motion.p>
                  )}

                  {/* Features with Animation */}
                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <motion.li
                        key={idx}
                        custom={idx}
                        initial="hidden"
                        animate="visible"
                        variants={featureVariants}
                        className="flex items-start gap-2 text-sm text-gray-600"
                      >
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </motion.li>
                    ))}
                  </ul>

                  {/* Action Button */}
                  <div className="mt-8">
                    {isCurrentPlan(plan.id) ? (
                      <div className="block w-full text-center px-6 py-3 rounded-lg font-medium bg-green-100 text-green-700">
                        ✓ Current Plan
                      </div>
                    ) : (
                      <Link
                        href={plan.buttonLink}
                        onClick={() => handlePlanSelect(plan.id)}
                        className={`block w-full text-center px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                          plan.popular
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg hover:scale-105'
                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200 hover:scale-105'
                        } ${isLoading && selectedPlan === plan.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isLoading && selectedPlan === plan.id ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          plan.buttonText
                        )}
                      </Link>
                    )}
                    {plan.popular && !isCurrentPlan(plan.id) && (
                      <p className="text-xs text-gray-500 text-center mt-2">
                        🎯 14-day free trial. No credit card required.
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Trust Indicators */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto"
        >
          {[
            { icon: '⭐', label: '4.8/5 Rating', desc: 'Based on 2,000+ reviews' },
            { icon: '🛡️', label: 'Secure Payment', desc: '256-bit encryption' },
            { icon: '💳', label: 'No Hidden Fees', desc: 'Transparent pricing' },
            { icon: '🚀', label: '14-Day Trial', desc: 'Try risk-free' },
          ].map((item, index) => (
            <div key={index} className="text-center p-4 bg-white rounded-xl shadow">
              <div className="text-2xl mb-1">{item.icon}</div>
              <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </motion.div>

        {/* Compare Plans Toggle */}
        <div className="mt-12 text-center">
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            {showCompare ? 'Hide Comparison Table ↑' : 'View Full Feature Comparison ↓'}
          </button>
        </div>

        {/* Compare Plans Table with Animation */}
        <AnimatePresence>
          {showCompare && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-6"
            >
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Features</th>
                        {displayPlans.map((plan) => (
                          <th key={plan.id} className="px-6 py-4 text-center text-sm font-semibold">
                            {plan.popular ? (
                              <span className="text-blue-600">{plan.name} ⭐</span>
                            ) : (
                              <span className="text-gray-900">{plan.name}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {[
                        { feature: 'Products', values: ['50', '500', 'Unlimited'] },
                        { feature: 'User Accounts', values: ['1', '5', 'Unlimited'] },
                        { feature: 'Inventory Management', values: ['✓', '✓', '✓'] },
                        { feature: 'Sales Analytics', values: ['Basic', 'Advanced', 'Custom'] },
                        { feature: 'Customer Management', values: ['✓', '✓', '✓'] },
                        { feature: 'Gift Cards & Loyalty', values: ['✗', '✓', '✓'] },
                        { feature: 'Multi-location Support', values: ['✗', '✓', '✓'] },
                        { feature: 'API Access', values: ['✗', '✓', '✓'] },
                        { feature: 'Custom Branding', values: ['✗', '✓', '✓'] },
                        { feature: 'Dedicated Support', values: ['✗', '✗', '✓'] },
                        { feature: 'SLA Guarantee', values: ['✗', '✗', '✓'] },
                      ].map((row, index) => (
                        <motion.tr
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.feature}</td>
                          {row.values.map((value, idx) => (
                            <td key={idx} className="px-6 py-3 text-center text-sm text-gray-600">
                              {value === '✓' ? (
                                <span className="text-green-500 font-bold">✓</span>
                              ) : value === '✗' ? (
                                <span className="text-red-400">✗</span>
                              ) : (
                                value
                              )}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAQ Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-16"
        >
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                q: 'Can I switch plans later?',
                a: 'Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes, all plans come with a 14-day free trial. No credit card required to start.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and bank transfers for enterprise plans.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Yes, you can cancel your subscription at any time. No cancellation fees.',
              },
              {
                q: 'Do you offer discounts for non-profits?',
                a: 'Yes, we offer special pricing for non-profit organizations. Contact our sales team for details.',
              },
              {
                q: 'Is my data secure?',
                a: 'Yes, we use enterprise-grade security with encryption, secure authentication, and regular backups.',
              },
            ].map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition-shadow"
              >
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center text-white shadow-xl"
        >
          <h2 className="text-2xl font-bold mb-2">Ready to Get Started?</h2>
          <p className="text-blue-100 mb-6">Join thousands of businesses using our POS system today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all hover:scale-105 shadow-lg"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="bg-blue-500/30 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-500/40 transition-all hover:scale-105 backdrop-blur-sm"
            >
              Contact Sales
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
