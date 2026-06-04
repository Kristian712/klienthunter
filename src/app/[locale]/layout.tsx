import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { Navbar } from '@/components/Navbar';
import { CookieBanner } from '@/components/CookieBanner';
import '../globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'KlientHunter – Najdi firmy, které potřebují tvou pomoc',
  description: 'Vyhledávej firmy bez webu, bez sociálních sítí nebo se špatnými recenzemi. Exportuj kontakty a získávej nové klienty.',
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
    <html lang={locale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
