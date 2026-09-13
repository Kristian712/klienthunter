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
        /**
         * Druhý, teplý akcent (jantar). Nese události a „nové": vznik firmy, nové od minule,
         * zkušební období. Modrá zůstává akcím a výběru — dvě barvy, dva významy, nic víc.
         */
        warm: {
          DEFAULT: 'rgb(var(--warm) / <alpha-value>)',
          ink:     'rgb(var(--warm-ink) / <alpha-value>)',
          soft:    'rgb(var(--warm) / 0.14)',
        },
        /** Barvy skupin filtrů: kdo · co se stalo · jak na tom je · jak oslovit. Jen pro ikonky a tečky. */
        group: {
          who:      'rgb(var(--g-who) / <alpha-value>)',
          event:    'rgb(var(--g-event) / <alpha-value>)',
          standing: 'rgb(var(--g-standing) / <alpha-value>)',
          reach:    'rgb(var(--g-reach) / <alpha-value>)',
        },
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
        // Živější vzhled (13. 9. 2026): 8 px bylo strohé. Základ je 12 px, karty a panely 16–20.
        DEFAULT: '8px',
        lg:  '12px',
        xl:  '16px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        /** Měkká záře pod hlavním tlačítkem a zvýrazněnou kartou — hloubka bez rámečků. */
        glow:      '0 8px 30px -6px rgb(var(--accent) / 0.45)',
        'glow-warm': '0 8px 30px -6px rgb(var(--warm) / 0.45)',
        card:      '0 1px 0 rgb(var(--line) / 0.06) inset, 0 12px 40px -20px rgba(0, 0, 0, .8)',
        pop:       '0 12px 32px rgba(0, 0, 0, .6)',
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
