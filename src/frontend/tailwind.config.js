/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Obsidian neutral palette anchoring all dark surfaces to the TrafficFL editorial visual identity
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#272A33",
          800: "#1B1D22",
          900: "#111318",
          950: "#090A0D",
        },
        navy: {
          900: "#0D0F14",
          800: "#161920",
          700: "#272A33",
        },
        tfl: {
          bg: "#090A0D",
          rail: "#0D0F14",
          surface: "#111318",
          elevated: "#161920",
          input: "#1B1D22",
          accent: "#9AC2FA",
          accentHover: "#B0D0FC",
          accentMuted: "#60A5FA",
          ink: "#0A0D14",
        },
        traffic: {
          green: "#10B981",
          yellow: "#F59E0B",
          red: "#EF4444",
          blue: "#60A5FA",
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', '"Times New Roman"', 'serif'],
      },
      screens: {
        'xs': '420px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      }
    },
  },
  plugins: [],
}
