/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // CDC specified colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          300: '#7dd3fc',
          500: '#3b82f6', // #3B82F6 - accent primaire
          600: '#2563eb', // hover state
          700: '#1d4ed8', // active state
        },
        gray: {
          50: '#f9fafb', // #F9FAFB - fond très clair
          100: '#f3f4f6',
          200: '#e5e7eb', // #E5E7EB - bordures
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280', // #6B7280 - texte secondaire
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937', // #1F2937 - texte primaire
          900: '#111827',
        },
        success: '#10b981', // #10B981 - succès
        warning: '#f97316', // #F97316 - avertissement
        error: '#ef4444', // #EF4444 - rouge alerte
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      maxWidth: {
        'mobile': '28rem', // 448px - max width for mobile-only design
      },
    },
  },
  plugins: [],
}