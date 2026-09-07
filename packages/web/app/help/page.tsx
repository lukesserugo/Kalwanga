import Link from 'next/link';

export default function HelpPage() {
  const faqs = [
    {
      question: 'How do I get started with the POS system?',
      answer: 'Simply create an account, set up your business profile, and start adding products. Our onboarding guide will walk you through the process.',
    },
    {
      question: 'Can I use the POS system offline?',
      answer: 'Yes, our POS system works offline. All transactions are stored locally and synced automatically when you reconnect to the internet.',
    },
    {
      question: 'How do I manage inventory?',
      answer: 'You can add products, track stock levels, set reorder points, and receive low stock alerts. Our inventory management system makes it easy to keep track of your products.',
    },
    {
      question: 'What payment methods are supported?',
      answer: 'We support cash, credit/debit cards, mobile money, bank transfers, and gift cards. You can also integrate with popular payment gateways.',
    },
    {
      question: 'How do I add staff members?',
      answer: 'Go to Settings > Users to add staff members. You can assign different roles and permissions to control access.',
    },
    {
      question: 'Can I generate reports?',
      answer: 'Yes, you can generate various reports including sales reports, inventory reports, customer reports, and financial reports.',
    },
    {
      question: 'How do I handle returns and refunds?',
      answer: 'You can process returns and refunds directly from the POS interface. The system will automatically update inventory and customer records.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, we use enterprise-grade security with encryption, secure authentication, and regular backups to protect your data.',
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

      {/* Help Content */}
      <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Help Center</h1>
          <p className="mt-4 text-xl text-gray-600">Find answers to common questions and get started quickly.</p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Link
            href="/docs/getting-started"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-2">🚀</div>
            <h3 className="font-medium text-gray-900">Getting Started</h3>
          </Link>
          <Link
            href="/docs/inventory"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-2">📦</div>
            <h3 className="font-medium text-gray-900">Inventory</h3>
          </Link>
          <Link
            href="/docs/sales"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-2">💳</div>
            <h3 className="font-medium text-gray-900">Sales & Payments</h3>
          </Link>
          <Link
            href="/docs/reports"
            className="bg-white rounded-lg shadow p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-medium text-gray-900">Reports</h3>
          </Link>
        </div>

        {/* FAQ Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900">{faq.question}</h3>
              <p className="mt-2 text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">Still have questions?</p>
          <Link href="/contact" className="mt-2 inline-block text-blue-600 hover:text-blue-800 font-medium">
            Contact Support →
          </Link>
        </div>
      </div>
    </div>
  );
}
