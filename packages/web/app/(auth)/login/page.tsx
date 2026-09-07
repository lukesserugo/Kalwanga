import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-blue-600">POS System</h1>
          </Link>
          <h2 className="mt-6 text-2xl font-semibold text-gray-900">Welcome Back</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your account to continue</p>
        </div>
        
        <div className="bg-white rounded-xl shadow-soft p-6">
          <SignIn 
            routing="path" 
            path="/login"
            signUpUrl="/sign-up"
            afterSignInUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none",
                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white",
                footerActionLink: "text-blue-600 hover:text-blue-800",
              }
            }}
          />
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/sign-up" className="font-medium text-blue-600 hover:text-blue-800">
              Sign up
            </Link>
          </p>
          <Link href="/forgot-password" className="mt-2 inline-block text-sm text-gray-500 hover:text-gray-700">
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  );
}
