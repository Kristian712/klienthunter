import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider, useMessages } from 'next-intl';
import { Navbar } from '@/components/Navbar';
import { CookieBanner } from '@/components/CookieBanner';
import { ThemeProvider } from '@/components/ThemeProvider';
import '../globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'] });

export const metadata: Metadata = {
  title: 'KlientHunter – Najdi firmy, které potřebují tvou pomoc',
  description: 'Vyhledávej firmy bez webu, bez sociálních sítí nebo se špatnými recenzemi. Exportuj kontakty a získávej nové klienty.',
};

// Inline script: apply theme BEFORE first paint to avoid flash
const themeScript = `
(function(){
  var t = localStorage.getItem('kh_theme') || 'system';
  var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
})();
`;

export default function RootLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = useMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <CookieBanner />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
