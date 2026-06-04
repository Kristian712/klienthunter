import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f0ff',
          100: '#e4e4ff',
          200: '#cdcbff',
          300: '#aba8ff',
          400: '#8278fd',
          500: '#6152f8',
          600: '#5232ed',
          700: '#4525d9',
          800: '#3a1fb6',
          900: '#311c90',
          950: '#1d0f5c',
        },
        surface: {
          DEFAULT: 'rgb(var(--surface) / <alpha-value>)',
          subtle:  'rgb(var(--surface-subtle) / <alpha-value>)',
          muted:   'rgb(var(--surface-muted) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          muted:   'rgb(var(--ink-muted) / <alpha-value>)',
          faint:   'rgb(var(--ink-faint) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card':  '0 1px 3px 0 rgba(14,14,26,.06), 0 1px 2px -1px rgba(14,14,26,.06)',
        'card-hover': '0 4px 16px 0 rgba(14,14,26,.10), 0 1px 4px -1px rgba(14,14,26,.08)',
        'glow':  '0 0 40px -8px rgba(97,82,248,.45)',
        'inner-brand': 'inset 0 1px 0 rgba(255,255,255,.12)',
      },
      backgroundImage: {
        'hero-grid': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236152f8' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
