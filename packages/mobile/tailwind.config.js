const tokensPreset = require("@pos/tokens/tailwind-preset").default;
const nativewindPreset = require("nativewind/preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [tokensPreset, nativewindPreset],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
