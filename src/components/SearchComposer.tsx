'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Database, Filter, Scissors } from 'lucide-react';
import {
  GROUP_LABELS, GROUP_ORDER, LEAD_FILTERS, NEW_FIRM_WINDOW_DAYS, SCOPE_TEXT, effectiveWindowDays, localized, registryWindowDays, scopeOf,
  type FilterGroup, type LeadFilter,
} from '@/lib/lead-filters';
import { DISTRICTS, isWholeCz, nuts3ForRegion } from '@/lib/regions-nuts';
import { ALL_INDUSTRIES } from '@/lib/industries';
import { formatDate } from '@/lib/format-date';

/**
 * Skládačka podmínek PŘED spuštěním hledání.
 *
 * Dvě skupiny, každá jinak: „Zužuje výběr" jsou pole z indexu ČSÚ — hledá se v celém kraji,
 * výsledek je úplný a index umí říct počet dopředu. „Prořezává nalezené" jsou věci, které se
 * zjišťují u každé stažené firmy — nechají jen ty z nalezených, které projdou. Uživatel to musí
 * poznat na první pohled, jinak si „neplátce DPH v kraji" přečte jako prohledaný kraj.
 *
 * Přepínač mezi režimy je okno podle vzniku: s ním jede index (celý kraj, firmy do 5 let),
 * bez něj ARES (krajské město, všechny stáří, bez počtů). Okres a zaměstnanci existují jen
 * v indexu, takže jejich zapnutí okno samo přidá a řekne to.
 */
export interface IndexCounts {
  total: number;
  windowDays: number;
  legal: Record<string, number>;
  employees: Record<string, number>;
  windows: Record<string, number>;
  districts: Record<string, number>;
}

const T = {
  toggle:    { cs: 'Další podmínky', sk: 'Ďalšie podmienky', en: 'More conditions' },
  on:        { cs: 'zapnuto', sk: 'zapnuté', en: 'on' },
  districts: { cs: 'Okresy', sk: 'Okresy', en: 'Districts' },
  allKraj:   { cs: 'celý kraj', sk: 'celý kraj', en: 'whole region' },
  wholeCz:   { cs: 'celá ČR', sk: 'celá ČR', en: 'whole Czechia' },
  unknownEmp:{ cs: 'počet neuveden u {n} firem', sk: 'počet neuvedený pri {n} firmách', en: 'count not stated for {n} firms' },
  // Mez „bez oboru jen 5 let" musí být vidět PŘED spuštěním (majitel 15. 9. 2026) — ale jednou
  // větou, ne odstavcem (majitel 20. 9. 2026). Proč: ARES bez oboru nehledá, index ČSÚ sahá 5 let.
  noIndustryLead: { cs: 'Bez oboru jen firmy vzniklé od {since} (starší najdete s oborem).',
                    sk: 'Bez odboru len firmy vzniknuté od {since} (staršie nájdete s odborom).',
                    en: 'Without a trade only firms founded since {since} (pick a trade for older ones).' },
  windowLead:     { cs: 'Firmy vzniklé od {since}.', sk: 'Firmy vzniknuté od {since}.', en: 'Firms founded since {since}.' },
  autoWindow:{ cs: 'Okres a zaměstnanci jsou jen v indexu, proto se zapnulo „Vznik do 5 let".',
               sk: 'Okres a zamestnanci sú len v indexe, preto sa zaplo „Vznik do 5 rokov".',
               en: 'Districts and employees exist only in the index, so “Founded within 5 years” was turned on.' },
  // „nejnovějších": index řadí podle vzniku sestupně (sources/registry.ts), takže strop tarifu
  // ořízne ty starší — uživatel s 2 000 shodami a stropem 500 má vědět, které dostane.
  idxLine:   { cs: 'Odpovídá {n} firem, stáhne se {limit} nejnovějších · index ČSÚ, {where}{legal}',
               sk: 'Zodpovedá {n} firiem, stiahne sa {limit} najnovších · index ČSÚ, {where}{legal}',
               en: '{n} firms match, the {limit} newest will be fetched · CZSO index, {where}{legal}' },
  idxCounting: { cs: 'Počítám firmy · index ČSÚ, {where}…', sk: 'Počítam firmy · index ČSÚ, {where}…', en: 'Counting firms · CZSO index, {where}…' },
  // Obor se v ARESu hledá dvěma větvemi: kódem NACE (jistý) a slovem v názvu firmy (sedí zhruba
  // u poloviny až dvou třetin, změřeno 14. 9. 2026). U každé firmy ve výsledcích je vidět, kterou prošla.
  aresLine:  { cs: 'ARES · {city} a okolí · obor podle NACE nebo slova v názvu · všechny stáří · nejvýš {limit} firem',
               sk: 'ARES · {city} a okolie · odbor podľa NACE alebo slova v názve · všetky veky · najviac {limit} firiem',
               en: 'ARES · {city} and surroundings · trade by NACE or a word in the name · any age · at most {limit} firms' },
  foreign:   { cs: 'Mimo české kraje index není — hledá se jen v ARESu / OpenStreetMap.',
               sk: 'Mimo českých krajov index nie je — hľadá sa len v ARESe / OpenStreetMap.',
               en: 'Outside Czech regions there is no index — ARES / OpenStreetMap only.' },
  legalSole: { cs: ' · živnostníci', sk: ' · živnostníci', en: ' · sole traders' },
  legalCo:   { cs: ' · obchodní společnosti', sk: ' · obchodné spoločnosti', en: ' · companies' },
  preset:    { cs: 'profil', sk: 'profil', en: 'profile' },
  noCountArs:{ cs: 'bez indexu se počty neukazují', sk: 'bez indexu sa počty neukazujú', en: 'no counts without the index' },
  zeroTitle: { cs: 'Těmto podmínkám neodpovídá žádná firma', sk: 'Týmto podmienkam nezodpovedá žiadna firma', en: 'No firm matches these conditions' },
  zeroBody:  { cs: 'Index pro ně nenašel ani jednu firmu, takže hledání je zamčené — skončilo by prázdné a spotřebovalo by jedno z vašich hledání. Uberte některou podmínku: {list}.',
               sk: 'Index pre ne nenašiel ani jednu firmu, takže hľadanie je zamknuté — skončilo by prázdne a spotrebovalo by jedno z vašich hľadaní. Uberte niektorú podmienku: {list}.',
               en: 'The index found not a single firm for them, so the search is locked — it would come back empty and use up one of your searches. Remove a condition: {list}.' },
  districtsSel: { cs: 'vybrané okresy', sk: 'vybrané okresy', en: 'selected districts' },
};

const INDEX_ONLY = new Set(['has_employees', 'no_employees']);

export function SearchComposer({
  locale, region, industry, active, toggle, districts, setDistricts, presetIds, limit, metaAds = true, onIndexTotal,
}: {
  locale: string;
  region: string;
  industry: string;
  active: Set<string>;
  toggle: (id: string, on?: boolean) => void;
  districts: string[];
  setDistricts: (next: string[]) => void;
  presetIds: string[];
  /** Strop výsledků z tarifu. */
  limit: number;
  /** Je nastavený token Meta Ad Library API? Bez něj se filtry se zdrojem Meta vůbec nenabízejí. */
  metaAds?: boolean;
  /** Kolik firem index pro současné podmínky najde; null = neví (ARES režim, počítá se). Stránka podle toho zamkne hledání. */
  onIndexTotal?: (total: number | null) => void;
}) {
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<IndexCounts | null>(null);
  const [counting, setCounting] = useState(false);
  const [autoNote, setAutoNote] = useState(false);
  const reqId = useRef(0);

  const nuts3 = region ? nuts3ForRegion(region) : null;
  // Celá ČR: index pokrývá celou republiku (bez okresů), počty i hledání bez oboru fungují.
  const wholeCz = Boolean(region) && isWholeCz(region);
  const indexable = Boolean(nuts3) || wholeCz;
  const ids = useMemo(() => Array.from(active), [active]);
  // Bez oboru se hledá v indexu i bez filtru podle vzniku (celé okno, pět let) — viz lead-filters.
  const windowDays = effectiveWindowDays(ids, industry);
  const implicitWindow = windowDays !== null && registryWindowDays(ids) === null;
  const indexMode = indexable && windowDays !== null;
  // Zdroj bez klíče (Meta) se neukazuje vůbec: zamčený chip je slib, který nasazení neplní.
  // Rozhodnutí majitele 15. 9. 2026 — token s 60denní platností teď udržovat nechce.
  const offered = LEAD_FILTERS.filter(f => metaAds || f.source !== 'Meta');
  const indexFilters = offered.filter(f => scopeOf(f) === 'index');
  const rowFilters = offered.filter(f => scopeOf(f) === 'row');
  const onCount = ids.filter(id => LEAD_FILTERS.some(f => f.id === id)).length + districts.length;

  /** Počty z indexu — s odstupem, ať každé kliknutí nedělá deset dotazů naráz. */
  useEffect(() => {
    if (!indexable) { setCounts(null); return; }
    const my = ++reqId.current;
    setCounting(true);
    const timer = setTimeout(() => {
      fetch('/api/index/counts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, industry: industry || ALL_INDUSTRIES, filters: ids, districts }),
      })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (my === reqId.current) { setCounts(d?.counts ?? null); setCounting(false); } })
        .catch(err => { console.error('composer/counts:', err); if (my === reqId.current) setCounting(false); });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, industry, ids.join(','), districts.join(',')]);

  // Stránka potřebuje vědět, že by hledání skončilo nulou — zamkne tlačítko Vyhledat.
  useEffect(() => {
    onIndexTotal?.(indexMode && counts && !counting ? counts.total : null);
  }, [indexMode, counts, counting, onIndexTotal]);

  /** Volba, která existuje jen v indexu, si okno zapne sama a řekne to. */
  const ensureWindow = () => {
    // I při implicitním oknu (bez oboru) se chip zapne výslovně: kdyby uživatel obor dodatečně
    // vybral, okres by jinak potichu přestal platit.
    if (registryWindowDays(ids) === null) { toggle('new_firm_5y', true); setAutoNote(true); }
  };
  const toggleIndexOnly = (id: string) => {
    if (!active.has(id)) ensureWindow();
    toggle(id);
  };
  const toggleDistrict = (code: string) => {
    if (!districts.includes(code)) ensureWindow();
    setDistricts(districts.includes(code) ? districts.filter(d => d !== code) : [...districts, code]);
  };

  const countFor = (f: LeadFilter): number | null => {
    if (!counts) return null;
    if (f.id in counts.legal) return counts.legal[f.id];
    if (f.id in counts.employees) return counts.employees[f.id];
    if (f.id in counts.windows) return counts.windows[f.id];
    return null;
  };

  const chip = (f: LeadFilter, onClick: () => void, withCount: boolean) => {
    const on = active.has(f.id);
    const n = withCount ? countFor(f) : null;
    return (
      <button key={f.id} type="button" onClick={onClick} aria-pressed={on}
        title={f.hint ? localized(f.hint, locale) : undefined}
        className={on ? 'chip-active' : 'chip'}>
        {localized(f.label, locale)}
        {n !== null && <span className={`tnum ${on ? 'text-accent-ink/70' : 'text-ink-faint'}`}>{n.toLocaleString(locale === 'en' ? 'en-GB' : 'cs-CZ')}</span>}
        {on && presetIds.includes(f.id) && <span className="text-[10px] uppercase tracking-wider opacity-70">{t(T.preset)}</span>}
      </button>
    );
  };

  const groupRows = (filters: LeadFilter[], withCount: boolean, onToggle: (f: LeadFilter) => void) =>
    GROUP_ORDER.map(group => {
      const items = filters.filter(f => f.group === group);
      if (!items.length) return null;
      return (
        <div key={group} className="flex flex-wrap items-center gap-1.5">
          <span className="w-full sm:w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{localized(GROUP_LABELS[group as FilterGroup], locale)}</span>
          {items.map(f => chip(f, () => onToggle(f), withCount))}
        </div>
      );
    });

  // ── Řádek „Co se prohledá" ──
  const kraj = region.split(',').pop()?.trim() ?? region;
  const city = region.split(',')[0]?.trim() ?? region;
  const where = wholeCz ? t(T.wholeCz)
    : districts.length
    ? districts.map(c => DISTRICTS[nuts3 ?? '']?.find(d => d.code === c)?.name ?? c).join(', ')
    : `${t(T.allKraj)} · ${kraj}`;
  const legalText = active.has('sole_trader') && !active.has('company_form') ? t(T.legalSole)
    : active.has('company_form') && !active.has('sole_trader') ? t(T.legalCo) : '';
  const since = windowDays !== null ? formatDate(new Date(Date.now() - windowDays * 86_400_000).toISOString(), locale) : '';
  const leadLine = indexMode ? t(implicitWindow ? T.noIndustryLead : T.windowLead).replace('{since}', since) : null;
  const scopeLine = !region ? null
    : !indexable ? t(T.foreign)
    : indexMode
      ? (counts && !counting
        ? t(T.idxLine).replace('{where}', where).replace('{since}', since).replace('{legal}', legalText)
            .replace('{n}', counts.total.toLocaleString(locale === 'en' ? 'en-GB' : 'cs-CZ')).replace('{limit}', String(Math.min(limit, counts.total) || limit))
        : t(T.idxCounting).replace('{where}', where))
      : t(T.aresLine).replace('{city}', city).replace('{limit}', String(limit));

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}
        className="flex items-center gap-2 text-sm font-medium text-ink hover:text-accent transition-colors">
        <Filter size={14} />
        {t(T.toggle)}
        {onCount > 0 && <span className="badge-accent tnum">{onCount} {t(T.on)}</span>}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Zužuje výběr */}
          <section className="rounded-xl border border-accent/30 bg-accent/[0.04] p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="icon-tile icon-tile--who h-7 w-7"><Database size={14} /></span>{t(SCOPE_TEXT.index.title)}
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-ink-muted">{t(SCOPE_TEXT.index.note)}</p>
            {!indexable && region && <p className="mt-2 text-[11px] text-ink-faint">{t(T.foreign)}</p>}
            <div className="mt-3 space-y-2.5">
              {groupRows(indexFilters, indexable, f => (INDEX_ONLY.has(f.id) ? toggleIndexOnly(f.id) : toggle(f.id)))}
              {counts && (
                <p className="text-[11px] text-ink-faint pl-0 sm:pl-24">{t(T.unknownEmp).replace('{n}', counts.employees.unknown.toLocaleString('cs-CZ'))}</p>
              )}
              {nuts3 && DISTRICTS[nuts3] && DISTRICTS[nuts3].length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="w-full sm:w-24 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t(T.districts)}</span>
                  {DISTRICTS[nuts3].map(d => {
                    const on = districts.includes(d.code);
                    const n = counts?.districts[d.code];
                    return (
                      <button key={d.code} type="button" onClick={() => toggleDistrict(d.code)} aria-pressed={on} className={on ? 'chip-active' : 'chip'}>
                        {d.name}{n !== undefined && <span className={`tnum ${on ? 'text-accent-ink/70' : 'text-ink-faint'}`}>{n.toLocaleString('cs-CZ')}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {autoNote && windowDays !== null && <p className="text-[11px] text-warm">{t(T.autoWindow)}</p>}
              {indexable && !indexMode && <p className="text-[11px] text-ink-faint">{t(T.noCountArs)}</p>}
            </div>
          </section>

          {/* Prořezává nalezené */}
          <section className="rounded-xl border border-line bg-surface-muted/40 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="icon-tile icon-tile--standing h-7 w-7"><Scissors size={14} /></span>{t(SCOPE_TEXT.row.title)}
            </h3>
            <p className="mt-1 text-[11px] leading-snug text-ink-muted">{t(SCOPE_TEXT.row.note)}</p>
            <div className="mt-3 space-y-2.5">
              {groupRows(rowFilters, false, f => toggle(f.id))}
            </div>
          </section>
        </div>
      )}

      {scopeLine && (
        <p className="mt-3 text-xs text-ink-muted">
          {leadLine && <span className="font-semibold text-ink mr-1.5">{leadLine}</span>}
          {scopeLine}
        </p>
      )}
      {indexMode && counts && !counting && counts.total === 0 && (
        <div role="alert" className="mt-3 rounded-lg border border-ink bg-ink/[0.06] px-3 py-2.5">
          <p className="text-xs font-semibold text-ink">{t(T.zeroTitle)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            {t(T.zeroBody).replace('{list}', [
              ...LEAD_FILTERS.filter(f => active.has(f.id)).map(f => t(f.label)),
              ...(districts.length ? [t(T.districtsSel)] : []),
            ].join(' · ') || '—')}
          </p>
        </div>
      )}
    </div>
  );
}
