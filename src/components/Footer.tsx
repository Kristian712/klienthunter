'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localized } from '@/lib/lead-filters';
import { OSM_ATTRIBUTION } from '@/lib/attribution';
import { OPERATOR } from '@/lib/legal';

/**
 * One footer for every page, mounted in the layout.
 *
 * It used to live inline at the bottom of the landing page only — which meant a signed-in user
 * on the search screen had no route to the privacy policy or the terms at all. Those documents
 * have to be reachable from wherever the service is actually used, not just from the shop window.
 *
 * It is also where the OpenStreetMap attribution belongs. ODbL is a share-alike licence and
 * naming the source is the condition we rely on to use the data, so it should not depend on the
 * user having scrolled to the end of one particular screen.
 */

const T = {
  product:  { cs: 'Produkt',   sk: 'Produkt',   en: 'Product' },
  search:   { cs: 'Hledání',   sk: 'Hľadanie',  en: 'Search' },
  pricing:  { cs: 'Ceník',     sk: 'Cenník',    en: 'Pricing' },
  support:  { cs: 'Podpora',   sk: 'Podpora',   en: 'Support' },
  contact:  { cs: 'Kontakt',   sk: 'Kontakt',   en: 'Contact' },
  legal:    { cs: 'Právní',    sk: 'Právne',    en: 'Legal' },
  privacy:  { cs: 'Ochrana údajů', sk: 'Ochrana údajov', en: 'Privacy' },
  terms:    { cs: 'Podmínky',  sk: 'Podmienky', en: 'Terms' },
  language: { cs: 'Jazyk',     sk: 'Jazyk',     en: 'Language' },
  sources: {
    cs: `Data: ARES a živnostenský rejstřík (MF ČR), registr plátců DPH (FS ČR), ${OSM_ATTRIBUTION}`,
    sk: `Dáta: ARES a živnostenský register (MF ČR), register platiteľov DPH (FS ČR), ${OSM_ATTRIBUTION}`,
    en: `Data: ARES and the Czech trade register, the Czech VAT payer register, © OpenStreetMap contributors (ODbL)`,
  },
};

export function Footer({ locale }: { locale: string }) {
  const pathname = usePathname();
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);

  // Přihlášení a registrace jsou celoobrazovkové a mají vlastní patičku s uvedením zdrojů.
  // Další zápatí pod nimi by byl jen šum na stránce, která má vést k jedinému tlačítku.
  if (pathname.includes('/auth/')) return null;

  return (
    <footer className="border-t border-line px-5 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">{t(T.product)}</p>
            <div className="space-y-2">
              <Link href={`/${locale}/search`} className="block text-sm text-ink-muted hover:text-ink">{t(T.search)}</Link>
              <Link href={`/${locale}/pricing`} className="block text-sm text-ink-muted hover:text-ink">{t(T.pricing)}</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">{t(T.support)}</p>
            <Link href={`/${locale}/contact`} className="block text-sm text-ink-muted hover:text-ink">{t(T.contact)}</Link>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">{t(T.legal)}</p>
            <div className="space-y-2">
              <Link href={`/${locale}/privacy`} className="block text-sm text-ink-muted hover:text-ink">{t(T.privacy)}</Link>
              <Link href={`/${locale}/terms`} className="block text-sm text-ink-muted hover:text-ink">{t(T.terms)}</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">{t(T.language)}</p>
            <div className="space-y-2">
              <Link href="/cs" className="block text-sm text-ink-muted hover:text-ink">Čeština</Link>
              <Link href="/sk" className="block text-sm text-ink-muted hover:text-ink">Slovenčina</Link>
              <Link href="/en" className="block text-sm text-ink-muted hover:text-ink">English</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-line mt-10 pt-6 flex flex-col md:flex-row justify-between gap-2 text-xs text-ink-faint">
          <span>© 2026 KlientHunter · {OPERATOR.name}</span>
          <span>{t(T.sources)}</span>
        </div>
      </div>
    </footer>
  );
}
