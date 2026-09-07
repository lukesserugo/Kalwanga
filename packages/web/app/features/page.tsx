import Link from 'next/link';

export default function FeaturesPage() {
  const features = [
    {
      title: 'Point of Sale',
      description: 'Fast and intuitive POS interface for processing sales quickly with barcode scanning and customer management.',
      icon: '🛒',
    },
    {
      title: 'Inventory Management',
      description: 'Track stock levels, manage products, get low stock alerts, and handle multiple business units.',
      icon: '📦',
    },
    {
      title: 'Customer Management',
      description: 'Build customer relationships with loyalty programs, purchase history, and personalized service.',
      icon: '👥',
    },
    {
      title: 'Sales Analytics',
      description: 'Comprehensive reports and analytics to understand your business performance and make data-driven decisions.',
      icon: '📊',
    },
    {
      title: 'Multi-User Support',
      description: 'Role-based access control for staff management with different permission levels for employees and managers.',
      icon: '👤',
    },
    {
      title: 'Payment Processing',
      description: 'Accept multiple payment methods including cash, credit/debit cards, mobile money, and gift cards.',
      icon: '💳',
    },
    {
      title: 'Real-time Sync',
      description: 'All data syncs in real-time across all devices, ensuring your team always has the latest information.',
      icon: '🔄',
    },
    {
      title: 'Offline Mode',
      description: 'Continue processing sales even without internet connection. Data syncs automatically when back online.',
      icon: '📶',
    },
    {
      title: 'Gift Cards & Loyalty',
      description: 'Increase customer retention with gift cards and loyalty programs that reward repeat business.',
      icon: '🎁',
    },
  ];

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

      {/* Hero Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl">
              Everything You Need to Run Your Business
            </h1>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              From sales to inventory to customer management, our POS system has all the features you need.
            </p>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to Get Started?</h2>
          <p className="mt-4 text-xl text-blue-100">Join thousands of businesses using our POS system today.</p>
          <Link
            href="/sign-up"
            className="mt-8 inline-block bg-white text-blue-600 px-8 py-3 rounded-lg text-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </div>
  );
}
