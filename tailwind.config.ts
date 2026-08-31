import type { Config } from 'tailwindcss';

/**
 * White, black, grey — and one accent.
 *
 * `brand` keeps its name and its 50–950 shape so existing markup keeps compiling, but every
 * step is now the vermilion ramp. Anything that used to be brand-purple is therefore on the
 * new accent automatically; `accent` is the alias to reach for in new code.
 *
 * `darkMode: 'class'` stays even though the app no longer has a dark theme. Tailwind's default
 * is `media`, so removing this line would make any leftover `dark:` utility fire on a machine
 * set to dark — the class simply never gets added now.
 */
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
          50:  '#fff1ec',
          100: '#ffdfd3',
          200: '#ffc0ab',
          300: '#ff9573',
          400: '#ff6233',
          500: '#f5450d',
          600: '#e63900',
          700: '#bf2e00',
          800: '#991f00',
          900: '#7a1c03',
          950: '#420e03',
        },
        accent: {
          DEFAULT: '#e63900',
          soft:    '#fff1ec',
          ink:     '#bf2e00',
        },
        /**
         * Jediná barva linek v aplikaci. Hairline nahrazuje karty a stíny.
         *
         * Je poloprůhledná, ne plná šedá: na teplém podkladu `#f6f5f2` vypadá plná `#e5e5e5`
         * studeně a vystupuje víc než text, který ohraničuje.
         */
        line: 'rgba(16, 16, 17, 0.10)',
        /** Silnější varianta pro místa, kde linka nese hierarchii, ne jen oddělení. */
        'line-strong': 'rgba(16, 16, 17, 0.18)',
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
        sans:    ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        /** Nadpisy a displeje. Charakter značky sedí v tomhle písmu, ne v barvě. */
        display: ['var(--font-display)', 'Bricolage Grotesque', 'var(--font-inter)', 'sans-serif'],
        /** Čísla a verzálkové mikropopisky. Stejně široké číslice drží sloupce v klidu. */
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        // Nothing rounder than 8px anywhere. `xl`/`2xl` are remapped rather than removed so
        // older markup cannot reintroduce the bubbly look.
        lg:  '8px',
        xl:  '8px',
        '2xl': '8px',
        '3xl': '8px',
      },
      fontSize: {
        // Fluid display sizes. The landing headline is meant to fill a third of the screen.
        'display':    ['clamp(2.75rem, 9vw, 6.5rem)', { lineHeight: '0.88', letterSpacing: '-0.045em' }],
        'display-sm': ['clamp(2rem, 5vw, 3.25rem)',   { lineHeight: '0.92', letterSpacing: '-0.035em' }],
      },
    },
  },
  plugins: [],
};

export default config;
