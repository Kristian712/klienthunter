'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { industryLabel } from '@/lib/search-options';
import { ALL_INDUSTRIES } from '@/lib/industries';
import { formatDate } from '@/lib/format-date';
import { nuts3ForRegion } from '@/lib/regions-nuts';
import type { Digest } from '@/lib/digest';

/**
 * „Nové firmy ve vašem kraji" — denní dávka na přehledu.
 *
 * Čísla jdou z indexu ČSÚ bez hledání; tlačítko založí skutečné hledání (index → ARES →
 * kontakty → skóre), takže seznam s telefony je jedno kliknutí daleko. Karta říká, kam index
 * sahá: dump ČSÚ dvakrát měsíčně plus denní dávky změn z ARESu (lib/registry-feed.ts).
 */
const T = {
  title:    { cs: 'Nové firmy ve vašem kraji', sk: 'Nové firmy vo vašom kraji', en: 'New firms in your region' },
  window:   { cs: 'vznik za posledních {n} dní', sk: 'vznik za posledných {n} dní', en: 'founded in the last {n} days' },
  until:    { cs: 'nejnovější vznik v indexu {d}', sk: 'najnovší vznik v indexe {d}', en: 'newest founding in the index {d}' },
  all:      { cs: 'všechny obory', sk: 'všetky odbory', en: 'all trades' },
  newBadge: { cs: '{n} nových od vaší poslední návštěvy', sk: '{n} nových od vašej poslednej návštevy', en: '{n} new since your last visit' },
  // „Každý den" jen když denní feed opravdu běží (poslední dávka do dvou dnů). Jinak se řekne,
  // kdy doběhl naposledy, nebo že index drží jen dump ČSÚ.
  nothingNew: { cs: 'Od vaší poslední návštěvy nic nového.', sk: 'Od vašej poslednej návštevy nič nové.', en: 'Nothing new since your last visit.' },
  feedDaily:  { cs: 'Index se doplňuje každý den z ARESu.', sk: 'Index sa dopĺňa každý deň z ARESu.', en: 'The index is topped up daily from ARES.' },
  feedStale:  { cs: 'Denní doplňování z ARESu naposledy proběhlo {d}.', sk: 'Denné dopĺňanie z ARESu naposledy prebehlo {d}.', en: 'The daily top-up from ARES last ran on {d}.' },
  feedNever:  { cs: 'Index se zatím obnovuje jen z dumpu ČSÚ, dvakrát měsíčně.', sk: 'Index sa zatiaľ obnovuje len z dumpu ČSÚ, dvakrát mesačne.', en: 'For now the index refreshes only from the CZSO dump, twice a month.' },
  latest:   { cs: 'Nejnovější', sk: 'Najnovšie', en: 'Latest' },
  open:     { cs: 'Otevřít jako hledání', sk: 'Otvoriť ako hľadanie', en: 'Open as a search' },
  opening:  { cs: 'Zakládám hledání…', sk: 'Zakladám hľadanie…', en: 'Starting the search…' },
  // Šance na kontakt změřená 14. 9. 2026 (11 % všech nových firem, 19 % obchodních společností); píše se míň.
  openHint: { cs: 'Dohledá jména, sídla a kontakty a seřadí podle vašich kritérií. Počítá se jako jedno hledání. Telefon nebo e-mail se u nové firmy najde zhruba u každé desáté, u obchodních společností asi u každé páté.',
              sk: 'Dohľadá mená, sídla a kontakty a zoradí podľa vašich kritérií. Počíta sa ako jedno hľadanie. Telefón alebo e-mail sa pri novej firme nájde zhruba pri každej desiatej, pri obchodných spoločnostiach asi pri každej piatej.',
              en: 'Looks up names, addresses and contacts and ranks by your criteria. Counts as one search. A phone or e-mail turns up for roughly one new firm in ten, about one in five among companies.' },
  noRegion: { cs: 'Nastavte si v profilu kraj a obor a přehled vám bude ukazovat, kolik firem v něm nově vzniklo.',
              sk: 'Nastavte si v profile kraj a odbor a prehľad vám bude ukazovať, koľko firiem v ňom novo vzniklo.',
              en: 'Set your region and trade in the profile and this card will show how many firms were founded there.' },
  setProfile: { cs: 'Doplnit profil', sk: 'Doplniť profil', en: 'Complete the profile' },
  foreign:  { cs: 'Index pokrývá jen české kraje. Pro {r} tu čísla nejsou.',
              sk: 'Index pokrýva len české kraje. Pre {r} tu čísla nie sú.',
              en: 'The index covers Czech regions only. No numbers for {r}.' },
  noIndex:  { cs: 'Index firem ještě není naplněný. Spusťte import v adminu.',
              sk: 'Index firiem ešte nie je naplnený. Spustite import v admine.',
              en: 'The firm index is empty. Run the import in the admin.' },
  loading:  { cs: 'Načítám nové firmy…', sk: 'Načítavam nové firmy…', en: 'Loading new firms…' },
  err:      { cs: 'Přehled nových firem se nepodařilo načíst.', sk: 'Prehľad nových firiem sa nepodarilo načítať.', en: 'Could not load the new-firms overview.' },
  errSearch: { cs: 'Hledání se nepodařilo založit. Zkuste to na stránce Vyhledávání.',
               sk: 'Hľadanie sa nepodarilo založiť. Skúste to na stránke Vyhľadávanie.',
               en: 'Could not start the search. Try the Search page.' },
};

export function NewFirmsDigest({ locale, isAdmin }: { locale: string; isAdmin: boolean }) {
  const router = useRouter();
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  const [digest, setDigest] = useState<Digest | null>(null);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/digest')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Digest) => {
        if (!alive) return;
        setDigest(d);
        // Viděno: od teď se „nové" počítá od nejmladší firmy v indexu. Až po vykreslení,
        // aby odznak stihl uživatel přečíst.
        if (d.indexUntil) setTimeout(() => { fetch('/api/digest', { method: 'PATCH' }).catch(err => console.error('digest/seen:', err)); }, 1500);
      })
      .catch(err => { console.error('digest:', err); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  const open = async () => {
    if (!digest?.region) return;
    setOpening(true); setOpenError(false);
    try {
      const res = await fetch('/api/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: digest.region,
          industry: digest.industry ?? ALL_INDUSTRIES,
          filters: ['new_firm_30d'],
          scenario: 'new',
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.jobId) { setOpenError(true); return; }
      router.push(`/${locale}/search?job=${d.jobId}`);
    } catch (err) {
      console.error('digest/open:', err);
      setOpenError(true);
    } finally {
      setOpening(false);
    }
  };

  const head = (
    <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
      <span className="icon-tile icon-tile--event h-7 w-7"><Sparkles size={14} /></span>{t(T.title)}
    </h2>
  );

  if (failed) return <div className="card mb-6">{head}<p className="text-sm text-ink-muted">{t(T.err)}</p></div>;
  // Načítání: titulek a jedna věta, aby karta při doběhnutí odpovědi neposkočila.
  if (!digest) {
    return (
      <div className="card mb-6" aria-busy="true">
        {head}
        <p className="text-sm text-ink-faint flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />{t(T.loading)}
        </p>
      </div>
    );
  }

  if (!digest.region) {
    return (
      <div className="card mb-6">
        {head}
        <p className="text-sm text-ink-muted">{t(T.noRegion)}</p>
        <Link href={`/${locale}/profile`} className="btn-outline btn-sm mt-3 inline-flex">{t(T.setProfile)} <ArrowRight size={14} /></Link>
      </div>
    );
  }
  if (!digest.indexUntil) {
    // Prázdný index: admin dostane pokyn, uživatel nic — karta bez čísel by jen mátla.
    if (!isAdmin) return null;
    return <div className="card mb-6"><p className="text-sm text-ink-muted">{t(T.noIndex)}</p></div>;
  }
  if (!nuts3ForRegion(digest.region)) {
    return <div className="card mb-6">{head}<p className="text-sm text-ink-muted">{t(T.foreign).replace('{r}', digest.region)}</p></div>;
  }

  const regionShort = digest.region.split(',').pop()?.trim() ?? digest.region;
  const mineLabel = digest.industry ? industryLabel(digest.industry, locale) : t(T.all);

  return (
    <div className="card-glow mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {head}
          <p className="text-xs text-ink-faint">
            {regionShort} · {t(T.window).replace('{n}', String(digest.windowDays))} · {t(T.until).replace('{d}', formatDate(digest.indexUntil, locale))}
          </p>
        </div>
        {digest.newSinceLast !== null && digest.newSinceLast > 0 && (
          <span className="badge-warm"><Sparkles size={10} />{t(T.newBadge).replace('{n}', String(digest.newSinceLast))}</span>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[auto_auto_1fr] sm:items-end">
        <div>
          <p className="tnum text-4xl font-extrabold tracking-tight text-ink">{digest.totalMine.toLocaleString(locale === 'en' ? 'en-GB' : 'cs-CZ')}</p>
          <p className="text-xs text-ink-muted mt-1">{mineLabel}</p>
        </div>
        {digest.industry && (
          <div className="sm:border-l sm:border-line sm:pl-4">
            <p className="tnum text-2xl font-bold text-ink-muted">{digest.totalAll.toLocaleString(locale === 'en' ? 'en-GB' : 'cs-CZ')}</p>
            <p className="text-xs text-ink-faint mt-1">{t(T.all)}</p>
          </div>
        )}
        <div className="sm:justify-self-end">
          <button type="button" onClick={open} disabled={opening} className="btn-primary">
            {opening ? t(T.opening) : t(T.open)} <ArrowRight size={14} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-ink-faint mt-2">{t(T.openHint)}</p>
      {openError && <p className="mt-2 text-sm font-medium border border-ink px-3 py-2">{t(T.errSearch)}</p>}
      {digest.newSinceLast === 0 && (
        <p className="text-xs text-ink-faint mt-2">
          {t(T.nothingNew)}{' '}
          {!digest.feedAt ? t(T.feedNever)
            : Date.now() - new Date(digest.feedAt).getTime() < 2 * 24 * 60 * 60 * 1000 ? t(T.feedDaily)
            : t(T.feedStale).replace('{d}', formatDate(digest.feedAt, locale))}
        </p>
      )}

      {digest.preview.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-2">{t(T.latest)}</p>
          <ul className="divide-y divide-line">
            {digest.preview.map(f => (
              <li key={f.ico} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{f.name}</p>
                  {f.address && <p className="text-xs text-ink-faint truncate">{f.address}</p>}
                </div>
                <span className="tnum shrink-0 text-xs text-ink-muted">{formatDate(f.foundedAt, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
