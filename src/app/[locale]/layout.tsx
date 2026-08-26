import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { localized } from '@/lib/lead-filters';
import '../globals.css';

/**
 * One font, exposed as a CSS variable so Tailwind's `font-sans` and the raw CSS in
 * `globals.css` resolve to the same family. Weights are declared explicitly because the
 * design leans on 800 for headlines and 400 for everything else.
 */
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
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
  description: {
    cs: 'Firmy z veřejných rejstříků a map, seřazené podle tvých vlastních kritérií. Data z ARESu a OpenStreetMap, export do Excelu.',
    sk: 'Firmy z verejných registrov a máp, zoradené podľa tvojich vlastných kritérií. Dáta z ARESu a OpenStreetMap, export do Excelu.',
    en: 'Businesses from public registers and maps, ranked by criteria you choose. Data from ARES and OpenStreetMap, Excel export.',
  },
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
    <html lang={locale} className={inter.variable}>
      <body className="font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer locale={locale} />
          {/*
            Cookie banner deliberately removed. The app sets exactly one cookie — the `auth-token`
            that keeps you signed in — and a cookie strictly necessary for a service the user asked
            for needs no consent under § 89 odst. 3 zákona č. 127/2005 Sb. The banner also claimed
            we analyse traffic, which we do not: there is no analytics script anywhere in the app,
            and neither of its buttons gated anything. Asking for consent you do not need, to do
            something you do not do, is worse than not asking.
          */}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
