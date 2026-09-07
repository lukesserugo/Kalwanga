import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold text-blue-600">POS System</Link>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="text-gray-600 hover:text-gray-900">
                Sign In
              </Link>
              <Link href="/sign-up" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Terms Content */}
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm mb-8">Last Updated: January 2024</p>

          <div className="prose max-w-none">
            <p className="text-gray-600">
              Welcome to POS System. By using our Point of Sale system, you agree to be bound by these Terms of Service.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-600">
              By creating an account, using our services, or accessing our platform, you agree to comply with and be bound by these Terms of Service.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2. Description of Service</h2>
            <p className="text-gray-600">
              POS System provides a comprehensive Point of Sale solution that includes sales processing, inventory management, customer relationship management, and reporting tools.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3. User Accounts</h2>
            <p className="text-gray-600">
              You are responsible for maintaining the security of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4. Payments and Subscriptions</h2>
            <p className="text-gray-600">
              Some features of our service may require payment. You agree to pay all fees associated with your chosen subscription plan. Fees are non-refundable except as required by law.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5. Intellectual Property</h2>
            <p className="text-gray-600">
              All content, features, and functionality of our platform are owned by POS System and are protected by intellectual property laws.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">6. Limitation of Liability</h2>
            <p className="text-gray-600">
              POS System shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">7. Termination</h2>
            <p className="text-gray-600">
              We may terminate or suspend your account immediately, without prior notice, for any reason, including without limitation if you breach these Terms.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">8. Contact Us</h2>
            <p className="text-gray-600">
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:legal@pos-system.com" className="text-blue-600 hover:text-blue-800">
                legal@pos-system.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
