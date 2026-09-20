/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Existing semantic palettes ────────────────────────
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        secondary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },

        // ── Brand palette (orange → red) ──────────────────────
        // The primary accent used across the storefront: CTAs,
        // active nav, prices, focus rings, and gradient headlines.
        // Mirrors Tailwind's default orange scale, exposed under
        // `brand-*` so utilities read `bg-brand-500` instead of
        // `bg-orange-500` — makes intent explicit and lets you
        // reskin the whole app by editing this one block.
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
          950: '#431407',
        },
        'brand-accent': {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#450A0A',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        // Monospace used for SKUs, slugs, barcodes, receipt numbers.
        // Keep it aligned with the sans so it inherits the same
        // rendering characteristics on every platform.
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },

      fontSize: {
        // The app uses 10px and 11px frequently for badges and
        // micro-labels. Expose them as named tokens so authors
        // never have to reach for arbitrary values.
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }], // 10px
        '3xs': ['0.6875rem', { lineHeight: '1rem' }],    // 11px
      },

      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '128': '32rem',
      },

      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
        // The storefront's content container is 1600px, wider than
        // Tailwind's `max-w-7xl` (80rem / 1280px). Expose it as a
        // named token so every page-level wrapper reads
        // `max-w-container` instead of an arbitrary value.
        container: '1600px',
      },

      borderRadius: {
        '4xl': '2rem',
      },

      boxShadow: {
        soft: '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        card: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
        'card-hover':
          '0 10px 25px rgba(0,0,0,0.1), 0 6px 10px rgba(0,0,0,0.08)',
        // Brand-tinted shadow for primary CTAs. Subtle enough to
        // read as elevation on white, warm enough to hint at the
        // gradient beneath.
        brand:
          '0 4px 14px 0 rgba(249, 115, 22, 0.25)',
        'brand-lg':
          '0 10px 30px -5px rgba(249, 115, 22, 0.35)',
      },

      backgroundImage: {
        // Named gradient so callers write
        //   `bg-brand-gradient`
        // instead of the long `bg-gradient-to-r from-orange-500 to-red-500`.
        'brand-gradient':
          'linear-gradient(to right, #F97316, #EF4444)',
        'brand-gradient-v':
          'linear-gradient(to bottom, #F97316, #EF4444)',
        'brand-gradient-radial':
          'radial-gradient(circle at center, #F97316, #EF4444)',
        // The hero pattern used on the shop landing, categories
        // page, and checkout header. Slightly darker end stops.
        'brand-gradient-hero':
          'linear-gradient(135deg, #EA580C 0%, #EF4444 50%, #E11D48 100%)',
      },

      transitionDuration: {
        250: '250ms',
        350: '350ms',
      },

      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow':
          'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        // Used on skeleton loaders and the shimmer badge on the
        // storefront hero.
        shimmer: 'shimmer 2s infinite linear',
        // Cart badge bump — plays when `cart:updated` fires.
        'badge-pop':
          'badgePop 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        badgePop: {
          '0%': { transform: 'scale(0.6)' },
          '60%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
      },

      // Named z-index stops so the fixed header, drawers, modals,
      // and the cart FAB never accidentally stack on top of each
      // other during a refactor.
      zIndex: {
        header: '50',
        drawer: '50',
        modal: '50',
        toast: '60',
        fab: '40',
      },
    },
  },
  plugins: [],
};
