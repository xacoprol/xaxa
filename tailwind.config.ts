import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          DEFAULT: "#102038",
          50: "#eef2f7",
          100: "#d5dee9",
          200: "#aab9cf",
          700: "#1a3355",
          800: "#142843",
          900: "#102038",
        },
        teal: {
          DEFAULT: "#08a080",
          50: "#e6f7f3",
          100: "#c5efe6",
          200: "#8fdecd",
          500: "#08a080",
          600: "#078f72",
          700: "#06755d",
          800: "#055c4a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16,32,56,0.04), 0 8px 24px rgba(16,32,56,0.07)",
      },
    },
  },
  plugins: [],
};
export default config;
