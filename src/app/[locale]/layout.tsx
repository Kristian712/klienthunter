import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { localized } from '@/lib/lead-filters';
import '../globals.css';

/**
 * Tři písma, každé s jednou prací — stejná sada, jakou používá webovkyvanek.cz, aby appka
 * a web mluvily jedním hlasem.
 *
 *  - Bricolage Grotesque 800 na displeje a nadpisy. Nese celý charakter; těsný proklad se
 *    nastavuje až v `tailwind.config.ts`, ne tady.
 *  - Inter na běžný text. Nejlépe čitelný grotesk na malé velikosti, co je zadarmo.
 *  - JetBrains Mono na čísla a malé verzálkové popisky. Číslice mají stejnou šířku, takže
 *    sloupec počtů v tabulce nepoulá při každé změně.
 *
 * Všechna jako CSS proměnné, aby `font-sans`/`font-display`/`font-mono` v Tailwindu a raw CSS
 * v `globals.css` sahaly na tutéž rodinu.
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

/**
 * Per-locale, because a static export would have served Czech titles to the Slovak and English
 * pages. The wording is also no longer about websites: the app ranks by whatever criteria the
 * user picked, so the title cannot promise one trade over another.
 */
const META = {
  title: {
    cs: 'KlientHunter – Najdi firmy, které můžou být tvoji klienti',
    sk: 'KlientHunter – Nájdi firmy, ktoré môžu byť tvoji klienti',
    en: 'KlientHunter – Find businesses that could be your clients',
  },
  // Popisek slibuje jen to, co dostane každý účet, i ten zdarma. Export do Excelu patří
  // placeným tarifům, takže by v obecném popisu byl slib, který většina čtenářů nedostane.
  description: {
    cs: 'Firmy z veřejných rejstříků a map, seřazené podle tvých vlastních kritérií. Data z ARESu a OpenStreetMap, výsledky ke stažení v CSV.',
    sk: 'Firmy z verejných registrov a máp, zoradené podľa tvojich vlastných kritérií. Dáta z ARESu a OpenStreetMap, výsledky na stiahnutie v CSV.',
    en: 'Businesses from public registers and maps, ranked by criteria you choose. Data from ARES and OpenStreetMap, results downloadable as CSV.',
  },
};

/**
 * Tmavé téma i pro prohlížeč samotný.
 *
 * `themeColor` obarví lištu mobilního Safari a Chrome, `colorScheme` řekne prohlížeči ještě
 * před načtením CSS, že stránka je tmavá — jinak by na okamžik bliklo bílé plátno a lišta by
 * zůstala světlá nad tmavým webem. V Next 14 patří obojí do `viewport`, ne do `metadata`.
 */
export const viewport: Viewport = {
  themeColor: '#0A0A0B',
  colorScheme: 'dark',
};

export function generateMetadata({ params: { locale } }: { params: { locale: string } }): Metadata {
  return {
    title: localized(META.title, locale),
    description: localized(META.description, locale),
  };
}

export default function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = useMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${bricolage.variable} ${mono.variable}`}>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer locale={locale} />
          {/*
            Cookie banner deliberately removed. The app sets two cookies: `auth-token`, which keeps
            you signed in, and `NEXT_LOCALE`, which is written only when you click the language
            switcher. Both serve a function the user asked for, so neither needs consent under
            § 89 odst. 3 zákona č. 127/2005 Sb. There is no analytics or advertising script
            anywhere in the app. Asking for consent you do not need, to do something you do not
            do, is worse than not asking. The privacy policy lists both cookies and the browser
            storage keys.
          */}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
