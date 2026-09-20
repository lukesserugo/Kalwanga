import Link from 'next/link';

export default function PrivacyPage() {
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

      {/* Privacy Content */}
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm mb-8">Last Updated: January 2024</p>

          <div className="prose max-w-none">
            <p className="text-gray-600">
              At POS System, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Point of Sale system.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Information We Collect</h2>
            <p className="text-gray-600">
              We collect information that you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This may include your name, email address, phone number, and business information.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">How We Use Your Information</h2>
            <p className="text-gray-600">
              We use the information we collect to provide, maintain, and improve our services, to process transactions, to send you technical notices and support messages, and to communicate with you about products, services, and promotions.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Data Security</h2>
            <p className="text-gray-600">
              We implement appropriate technical and organizational measures to protect the security of your personal information. However, please note that no method of transmission over the internet or method of electronic storage is 100% secure.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Your Rights</h2>
            <p className="text-gray-600">
              You have the right to access, correct, or delete your personal information at any time. You may also object to the processing of your information or request that we restrict the processing of your information.
            </p>

            <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Contact Us</h2>
            <p className="text-gray-600">
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:privacy@pos-system.com" className="text-blue-600 hover:text-blue-800">
                privacy@pos-system.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
