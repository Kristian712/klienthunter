'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { localized } from '@/lib/lead-filters';
import { LANGUAGES, switchLocale } from '@/lib/locale-switch';
import { OSM_ATTRIBUTION_L, RES_ATTRIBUTION_L } from '@/lib/attribution';
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
  optout:   { cs: 'Nechci být v seznamu', sk: 'Nechcem byť v zozname', en: 'Remove me from the list' },
  privacy:  { cs: 'Ochrana údajů', sk: 'Ochrana údajov', en: 'Privacy' },
  terms:    { cs: 'Obchodní podmínky', sk: 'Obchodné podmienky', en: 'Terms of Service' },
  language: { cs: 'Jazyk',     sk: 'Jazyk',     en: 'Language' },
  dataSources: { cs: 'Zdroje dat', sk: 'Zdroje dát', en: 'Data sources' },
  sources: {
    cs: `Data: ARES a živnostenský rejstřík (MF ČR), registr plátců DPH (FS ČR), ${RES_ATTRIBUTION_L.cs}, ${OSM_ATTRIBUTION_L.cs}`,
    sk: `Dáta: ARES a živnostenský register (MF ČR), register platiteľov DPH (FS ČR), ${RES_ATTRIBUTION_L.sk}, ${OSM_ATTRIBUTION_L.sk}`,
    en: `Data: ARES and the Czech trade register, the Czech VAT payer register, ${RES_ATTRIBUTION_L.en}, ${OSM_ATTRIBUTION_L.en}`,
  },
};

export function Footer({ locale }: { locale: string }) {
  const pathname = usePathname();
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  const chooseLocale = (next: string) => switchLocale(pathname, next);

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
              <Link href={`/${locale}/data-sources`} className="block text-sm text-ink-muted hover:text-ink">{t(T.dataSources)}</Link>
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
              <Link href={`/${locale}/optout`} className="block text-sm text-ink-muted hover:text-ink">{t(T.optout)}</Link>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint mb-3">{t(T.language)}</p>
            <div className="space-y-2">
              {/* Tlačítka, ne odkazy na /cs, /sk, /en. Ty vedly vždycky na úvodní stránku a hlavně
                  nezapisovaly cookii `NEXT_LOCALE`, kterou middleware bere jako jedinou volbu
                  jazyka — uživatel tedy přišel o stránku, na které byl, a při příštím otevření
                  holé domény ho to stejně vrátilo do češtiny. Lišta to dělá správně, patička teď taky. */}
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => chooseLocale(l.code)}
                  className={`block text-sm text-left hover:text-ink ${l.code === locale ? 'text-accent font-semibold' : 'text-ink-muted'}`}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-line mt-10 pt-6 flex flex-col md:flex-row justify-between gap-2 text-xs text-ink-faint">
          {/* Jméno a IČO na každé stránce. Sídlo majitel z patičky vyndal (13. 9. 2026) — zůstává
              v obchodních podmínkách a v zásadách ochrany údajů, které patička odkazuje; § 435
              obč. zák. chce údaje „v rámci informací zpřístupňovaných veřejnosti", ne nutně
              v patičce. */}
          <span>
            © 2026 KlientHunter · {OPERATOR.name}
            {OPERATOR.ico && ` · IČO ${OPERATOR.ico}`}
          </span>
          <span>{t(T.sources)}</span>
        </div>
      </div>
    </footer>
  );
}
