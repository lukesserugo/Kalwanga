export const fontFamily = {
  sans: ["Inter", "system-ui", "sans-serif"],
  mono: [
    "JetBrains Mono",
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "Consolas",
    "monospace",
  ],
} as const;

export const fontSize = {
  "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
  "3xs": ["0.6875rem", { lineHeight: "1rem" }],
} as const;
