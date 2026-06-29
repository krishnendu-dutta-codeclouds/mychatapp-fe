/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // supports class-based dark mode switching
  theme: {
    extend: {
      colors: {
        white: 'rgb(var(--color-white) / <alpha-value>)',
        emerald: {
          50: 'rgb(var(--theme-color-50) / <alpha-value>)',
          100: 'rgb(var(--theme-color-100) / <alpha-value>)',
          300: 'rgb(var(--theme-color-300) / <alpha-value>)',
          400: 'rgb(var(--theme-color-400) / <alpha-value>)',
          500: 'rgb(var(--theme-color-500) / <alpha-value>)',
          600: 'rgb(var(--theme-color-600) / <alpha-value>)',
          700: 'rgb(var(--theme-color-700) / <alpha-value>)',
        },
        // Custom premium chat colors
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e', // Emerald/WhatsApp Green
          600: '#16a34a',
          700: '#15803d',
        },
        dark: {
          50: '#27272a',  // Zinc 800
          100: '#18181b', // Zinc 900
          200: '#09090b', // Zinc 950
        },
        zinc: {
          50: 'rgb(var(--zinc-50) / <alpha-value>)',
          100: 'rgb(var(--zinc-100) / <alpha-value>)',
          200: 'rgb(var(--zinc-200) / <alpha-value>)',
          300: 'rgb(var(--zinc-300) / <alpha-value>)',
          400: 'rgb(var(--zinc-400) / <alpha-value>)',
          500: 'rgb(var(--zinc-500) / <alpha-value>)',
          600: 'rgb(var(--zinc-600) / <alpha-value>)',
          700: 'rgb(var(--zinc-700) / <alpha-value>)',
          800: 'rgb(var(--zinc-800) / <alpha-value>)',
          850: 'rgb(var(--zinc-850) / <alpha-value>)',
          900: 'rgb(var(--zinc-900) / <alpha-value>)',
          950: 'rgb(var(--zinc-950) / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
