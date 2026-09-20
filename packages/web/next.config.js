// packages/web/next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['img.clerk.com'],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Make environment variables available to the client
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
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

    // IMPORTANT: Do NOT touch `config.devtool` when `dev === true`.
    // Next.js manages devtool in development and will print a warning
    // and revert if you override it. Leave it alone in dev.

    // Production-only: disable source maps in the webpack bundle.
    // `productionBrowserSourceMaps: false` below already covers the
    // browser bundles; this is belt-and-suspenders for the server bundle.
    if (!dev) {
      config.devtool = false;
    }

    return config;
  },

  // Production source maps — off by default.
  productionBrowserSourceMaps: false,

  reactStrictMode: true,
  poweredByHeader: false,
  distDir: '.next',
  output: 'standalone',

  experimental: {
    // serverActions: true,
  },

  /**
   * Proxy uploaded files to the Express backend.
   *
   * The API stores image URLs as relative paths (`/uploads/...`).
   * Without this rewrite, the browser resolves them against the
   * Next.js origin (port 3000) and 404s. This forwards them to
   * the backend (port 3001), which serves them via express.static.
   *
   * Only affects paths starting with `/uploads`. Every other route
   * is untouched, so existing API calls via NEXT_PUBLIC_API_URL
   * continue to work exactly as before.
   */
  async rewrites() {
    const API_BASE = (
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    ).replace(/\/$/, '');

    return [
      {
        source: '/uploads/:path*',
        destination: `${API_BASE}/uploads/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
