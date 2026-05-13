import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mirrors gokite.ai's dark palette: charcoal background, near-white text,
        // electric-cyan accent for CTAs and highlight numbers.
        bg: { DEFAULT: "#0a0a0b", 1: "#101012", 2: "#17171a" },
        line: { DEFAULT: "#1f1f23", 2: "#2a2a30" },
        ink: { DEFAULT: "#f4f4f5", muted: "#a1a1aa", dim: "#71717a" },
        accent: { DEFAULT: "#34e1ff", hover: "#5ae9ff", soft: "#34e1ff14" },
        good: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(52,225,255,0.18), 0 8px 24px -8px rgba(52,225,255,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
