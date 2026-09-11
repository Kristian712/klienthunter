import type { Config } from 'tailwindcss';

/**
 * Tmavý podklad, světlý text, jeden akcent.
 *
 * Každá barva jde přes CSS proměnnou z `globals.css`. Dřív tu linky a akcent byly natvrdo
 * (`rgba(16,16,17,.10)`, `#e63900`), takže se jako jediné neotáčely s tématem — na tmavém
 * podkladu by všechny okraje zmizely a akcent by měl jiný odstín než `--accent`. Hodnoty
 * i naměřený kontrast jsou u proměnných v `globals.css`.
 *
 * `darkMode: 'class'` zůstává, i když se žádná třída nepřidává: web je tmavý pro všechny
 * a přepínač neexistuje. Výchozí `media` by jinak rozsvítilo každý zapomenutý `dark:`
 * podle nastavení systému.
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
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          /** Hover akcentového tlačítka. O stupeň světlejší, text na něm je pořád tmavý. */
          hover:   'rgb(var(--accent-hover) / <alpha-value>)',
          /** Text na akcentové ploše. Na světle modré projde jen tmavý (11,5 : 1), světlý má 1,45 : 1. */
          ink:     'rgb(var(--accent-ink) / <alpha-value>)',
          soft:    'rgb(var(--accent) / 0.12)',
        },
        /**
         * Linky. Poloprůhledná bílá, ne plná šedá: na kartě i na stránce pak mají stejný
         * vztah k podkladu a nemusí se ladit zvlášť pro každou plochu.
         *
         *  - `line`   dekorativní oddělení (1,26 : 1 — schválně tiché, nenese informaci)
         *  - `line-strong`  okraj, který drží hierarchii (menu, odznaky, chipy)
         *  - `field`  hranice formulářového pole a obrysového tlačítka: 3,3 : 1 vůči kartě
         *             i stránce, tedy nad 3 : 1, které WCAG 1.4.11 chce u ovládacích prvků
         */
        line: 'rgb(var(--line) / 0.10)',
        'line-strong': 'rgb(var(--line) / 0.20)',
        field: 'rgb(var(--line) / 0.36)',
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
      /**
       * Výchozí barvy, které Tailwind jinak bere ze světlého světa: preflight dává každému
       * `border` šedou #e5e7eb (na tmavém ostrá čára), ring je modrý a mezera kolem focus
       * ringu bílá — na tmavém by kolem každého fokusovaného tlačítka svítil bílý proužek.
       */
      borderColor: {
        DEFAULT: 'rgb(var(--line) / 0.10)',
      },
      ringColor: {
        DEFAULT: 'rgb(var(--accent))',
      },
      ringOffsetColor: {
        DEFAULT: 'rgb(var(--surface))',
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
