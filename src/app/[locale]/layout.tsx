import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { Navbar } from '@/components/Navbar';
import { CookieBanner } from '@/components/CookieBanner';
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

export const metadata: Metadata = {
  title: 'KlientHunter – Najdi firmy, které potřebují nový web',
  description: 'Najdi firmy bez webu, se zastaralým nebo pomalým webem. Data z ARESu a OpenStreetMap, export do Excelu.',
};

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
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
