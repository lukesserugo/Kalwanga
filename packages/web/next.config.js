/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['img.clerk.com'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  
  // ✅ Fixed: Only redirect authenticated users to dashboard (handled in page.tsx)
  // Remove the redirect entirely - we'll handle it in the landing page component
  // async redirects() {
  //   return [
  //     {
  //       source: '/',
  //       destination: '/dashboard',
  //       permanent: false,
  //     },
  //   ];
  // },
  
  // Make environment variables available to the client
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
      };
    }
    return config;
  },
  
  // React configuration
  reactStrictMode: true,
  
  // Security
  poweredByHeader: false,
  
  // Build output
  distDir: '.next',
  
  // For standalone build
  output: 'standalone',
  
  // Experimental features (optional)
  experimental: {
    // Enable if you need it
    // serverActions: true,
  },
};

module.exports = nextConfig;
