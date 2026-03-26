import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-lato)", "Lato", "var(--font-noto-sans)", "sans-serif"],
        sans: ["var(--font-lato)", "Lato", "var(--font-noto-sans)", "sans-serif"],
      },
      colors: {
        // freeCodeCamp design system — dark theme
        fcc: {
          // Backgrounds
          "bg-primary":    "#0a0a23",
          "bg-secondary":  "#1b1b32",
          "bg-tertiary":   "#2a2a40",
          "bg-quaternary": "#3b3b4f",
          // Foregrounds
          "fg-primary":    "#ffffff",
          "fg-secondary":  "#f5f6f7",
          "fg-tertiary":   "#dfdfe2",
          "fg-muted":      "#d0d0d5",
          // Accent — for dark backgrounds
          purple: "#dbb8ff",
          yellow: "#f1be32",
          blue:   "#99c9ff",
          green:  "#acd157",
          // Accent — for light backgrounds
          "purple-dark": "#5a01a7",
          "yellow-dark": "#4d3800",
          "blue-dark":   "#002ead",
          "green-dark":  "#00471b",
          // Utility
          focus: "#198eee",
        },
        // Puzzle cell states
        cell: {
          yes: "#acd157",       // fcc green
          "yes-text": "#00471b",
          no:  "#ff6b6b",       // warm red (accessible on dark bg)
          "no-text": "#4a0000",
          empty: "#2a2a40",     // fcc bg-tertiary
          "empty-hover": "#3b3b4f",
        },
      },
    },
  },
  plugins: [],
};

export default config;
