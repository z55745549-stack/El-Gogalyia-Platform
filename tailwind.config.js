/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Alexandria', 'system-ui', '-apple-system', 'sans-serif'],
        alexandria: ['Alexandria', 'sans-serif'],
      },
      colors: {
        // Official Brand Color System
        brand: {
          teal: '#00E0BA',
          purple: '#91008D',
          pink: '#FF3483',
          yellow: '#FFCF00',
        },
        teal: {
          brand: '#00E0BA',
        },
        purple: {
          brand: '#91008D',
        },
        pink: {
          brand: '#FF3483',
        },
        yellow: {
          brand: '#FFCF00',
        },
        // Neutral palette for SaaS surfaces
        surface: {
          light: '#FFFFFF',
          'light-bg': '#F7F7F8',
          'light-subtle': '#F0F1F3',
          dark: '#181820',
          'dark-bg': '#0D0D12',
          'dark-secondary': '#13131A',
          'dark-elevated': '#1E1E28',
        },
        border: {
          light: '#E5E7EB',
          dark: '#2A2A35',
        },
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card-hover': '0 6px 20px -4px rgba(0, 0, 0, 0.08)',
        'card-dark': '0 4px 20px 0 rgba(0, 0, 0, 0.4)',
        'card-dark-hover': '0 8px 30px -4px rgba(0, 0, 0, 0.6)',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
}
