'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { localized } from '@/lib/lead-filters';

/**
 * Stránka 404 uvnitř aplikace.
 *
 * Bez ní Next ukazoval svou výchozí 404 — bílou, anglicky a bez navigace, i na tmavém webu
 * a v češtině. Tahle se vykreslí v layoutu jazyka, takže má lištu, patičku i tmavé téma.
 * Neznámé adresy sem posílá `[...rest]/page.tsx`.
 */
const T = {
  title: { cs: 'Tahle stránka neexistuje', sk: 'Táto stránka neexistuje', en: 'This page does not exist' },
  body: {
    cs: 'Odkaz může být starý nebo překlepnutý. Zkuste to z hledání nebo z úvodu.',
    sk: 'Odkaz môže byť starý alebo s preklepom. Skúste to z hľadania alebo z úvodu.',
    en: 'The link may be old or mistyped. Try the search or the home page.',
  },
  search: { cs: 'Vyhledat firmy', sk: 'Vyhľadať firmy', en: 'Search businesses' },
  home: { cs: 'Na úvod', sk: 'Na úvod', en: 'Home' },
};

export default function NotFound() {
  const locale = useLocale();
  const t = (x: { cs: string; sk: string; en: string }) => localized(x, locale);

  return (
    <div className="min-h-[70vh] pt-14 flex items-center px-5">
      <div className="container">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink-faint">404</p>
        <h1 className="display-sm mt-3 max-w-2xl">
          {t(T.title)}<span className="text-accent">.</span>
        </h1>
        <p className="mt-4 text-ink-muted max-w-lg">{t(T.body)}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/${locale}/search`} className="btn-primary">{t(T.search)}</Link>
          <Link href={`/${locale}`} className="btn-outline">{t(T.home)}</Link>
        </div>
      </div>
    </div>
  );
}
