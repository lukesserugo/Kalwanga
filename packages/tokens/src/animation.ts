export const backgroundImage = {
  "brand-gradient": "linear-gradient(to right, #F97316, #EF4444)",
  "brand-gradient-v": "linear-gradient(to bottom, #F97316, #EF4444)",
  "brand-gradient-radial": "radial-gradient(circle at center, #F97316, #EF4444)",
  "brand-gradient-hero":
    "linear-gradient(135deg, #EA580C 0%, #EF4444 50%, #E11D48 100%)",
} as const;

export const transitionDuration = {
  250: "250ms",
  350: "350ms",
} as const;

export const animation = {
  "fade-in": "fadeIn 0.5s ease-in-out",
  "slide-up": "slideUp 0.3s ease-out",
  "slide-down": "slideDown 0.3s ease-out",
  "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  shimmer: "shimmer 2s infinite linear",
  "badge-pop": "badgePop 300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;

export const keyframes = {
  fadeIn: {
    "0%": { opacity: "0" },
    "100%": { opacity: "1" },
  },
  slideUp: {
    "0%": { transform: "translateY(10px)", opacity: "0" },
    "100%": { transform: "translateY(0)", opacity: "1" },
  },
  slideDown: {
    "0%": { transform: "translateY(-10px)", opacity: "0" },
    "100%": { transform: "translateY(0)", opacity: "1" },
  },
  shimmer: {
    "0%": { backgroundPosition: "-1000px 0" },
    "100%": { backgroundPosition: "1000px 0" },
  },
  badgePop: {
    "0%": { transform: "scale(0.6)" },
    "60%": { transform: "scale(1.15)" },
    "100%": { transform: "scale(1)" },
  },
} as const;
