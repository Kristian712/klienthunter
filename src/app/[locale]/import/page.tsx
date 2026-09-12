'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import Papa from 'papaparse';
import { Upload, FileSpreadsheet, Download, ShieldCheck, AlertTriangle } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { MAX_IMPORT_ROWS } from '@/lib/plans';

/**
 * Import of the user's own list.
 *
 * The file is parsed here in the browser: the mapping screen needs the headers anyway, so
 * sending the raw file to the server would mean handling an upload for nothing. Only the
 * mapped rows travel to `/api/import`, where they go through the same verification as a
 * search — same website probe, same registers, same robots.txt rules.
 */

/** Fields we can use. Everything except the name is optional. */
const FIELDS = [
  { key: 'name',    required: true,
    label: { cs: 'Název firmy', sk: 'Názov firmy', en: 'Business name' },
    hints: ['nazev', 'název', 'firma', 'name', 'company', 'obchodni'] },
  { key: 'ico',     required: false,
    label: { cs: 'IČO', sk: 'IČO', en: 'Company ID' },
    hints: ['ico', 'ičo', 'ic', 'reg'] },
  { key: 'website', required: false,
    label: { cs: 'Web', sk: 'Web', en: 'Website' },
    hints: ['web', 'www', 'url', 'stranky', 'stránky', 'site'] },
  { key: 'phone',   required: false,
    label: { cs: 'Telefon', sk: 'Telefón', en: 'Phone' },
    hints: ['tel', 'phone', 'mobil'] },
  { key: 'email',   required: false,
    label: { cs: 'E-mail', sk: 'E-mail', en: 'E-mail' },
    hints: ['mail', 'email', 'e-mail'] },
  { key: 'address', required: false,
    label: { cs: 'Adresa', sk: 'Adresa', en: 'Address' },
    hints: ['adres', 'address', 'ulice', 'sidlo', 'sídlo'] },
] as const;

/**
 * Texty stránky. Dřív byla lokalizovaná jediná věc — nadpis, a i ten větví `cs ? … : en`,
 * takže Slovák dostal anglický nadpis nad českým tělem. Zbytek appky používá `localized()`
 * s fallbackem sk → cs, tak ho používá i tahle stránka.
 */
const T = {
  title:      { cs: 'Import vlastního seznamu', sk: 'Import vlastného zoznamu', en: 'Import your own list' },
  intro:      { cs: 'Nahrajte CSV se svými firmami. Doplníme jim údaje z rejstříku ARES a ověříme, jestli mají web – stejně jako u běžného hledání.',
                sk: 'Nahrajte CSV so svojimi firmami. Doplníme im údaje z registra ARES a overíme, či majú web – rovnako ako pri bežnom hľadaní.',
                en: 'Upload a CSV of your businesses. We add data from the ARES register and check whether they have a website — the same way a search does.' },
  pick:       { cs: 'Vyberte soubor CSV', sk: 'Vyberte súbor CSV', en: 'Choose a CSV file' },
  pickHint:   { cs: 'první řádek musí být hlavička s názvy sloupců',
                sk: 'prvý riadok musí byť hlavička s názvami stĺpcov',
                en: 'the first row must be a header with column names' },
  mapTitle:   { cs: 'Které sloupce jsou které?', sk: 'Ktoré stĺpce sú ktoré?', en: 'Which column is which?' },
  required:   { cs: 'Povinný je jen název firmy.', sk: 'Povinný je len názov firmy.', en: 'Only the business name is required.' },
  none:       { cs: '— nepoužít —', sk: '— nepoužiť —', en: '— skip —' },
  working:    { cs: 'Zpracovávám…', sk: 'Spracovávam…', en: 'Working…' },
  needName:   { cs: 'Vyberte sloupec s názvem firmy.', sk: 'Vyberte stĺpec s názvom firmy.', en: 'Choose the column with the business name.' },
  takesTime:  { cs: 'Import trvá až minutu – ověřujeme weby jeden po druhém. Nezavírejte stránku.',
                sk: 'Import trvá až minútu – overujeme weby jeden po druhom. Nezatvárajte stránku.',
                en: 'The import takes up to a minute — we check the websites one by one. Keep the page open.' },
  openList:   { cs: 'Otevřít seznam', sk: 'Otvoriť zoznam', en: 'Open the list' },
  overview:   { cs: 'Přehled importů', sk: 'Prehľad importov', en: 'Import overview' },
  csv:        { cs: 'Stáhnout CSV', sk: 'Stiahnuť CSV', en: 'Download CSV' },
  excel:      { cs: 'Stáhnout Excel', sk: 'Stiahnuť Excel', en: 'Download Excel' },
  gdpr1:      { cs: 'Nahraná data zpracováváme jen pro vás a nikomu je nepředáváme. Kdykoli je smažete v ',
                sk: 'Nahraté dáta spracovávame len pre vás a nikomu ich neodovzdávame. Kedykoľvek ich zmažete v ',
                en: 'We process the uploaded data only for you and pass it to no one. You can delete it any time in the ' },
  gdprLink:   { cs: 'přehledu', sk: 'prehľade', en: 'overview' },
  gdpr2:      { cs: ' – smazáním importu zmizí i všechny jeho řádky. Za to, že máte právo tyto kontakty zpracovávat, odpovídáte vy.',
                sk: ' – zmazaním importu zmiznú aj všetky jeho riadky. Za to, že máte právo tieto kontakty spracovávať, zodpovedáte vy.',
                en: ' — deleting an import removes all its rows. You are responsible for having the right to process these contacts.' },
  errRead:    { cs: 'Soubor se nepodařilo přečíst. Je to opravdu CSV?',
                sk: 'Súbor sa nepodarilo prečítať. Je to naozaj CSV?',
                en: 'The file could not be read. Is it really a CSV?' },
  errEmpty:   { cs: 'Soubor je prázdný nebo nemá hlavičku s názvy sloupců.',
                sk: 'Súbor je prázdny alebo nemá hlavičku s názvami stĺpcov.',
                en: 'The file is empty or has no header row.' },
  errLogin:   { cs: 'Přihlaste se prosím znovu.', sk: 'Prihláste sa prosím znova.', en: 'Please sign in again.' },
  errLimit:   { cs: 'Vyčerpali jste hledání ve svém tarifu. Import se počítá stejně jako hledání.',
                sk: 'Vyčerpali ste hľadania vo svojom tarife. Import sa počíta rovnako ako hľadanie.',
                en: 'You have used up the searches in your plan. An import counts as a search.' },
  errServer:  { cs: 'Import se nepovedl – chyba na naší straně. Zkuste to prosím znovu.',
                sk: 'Import sa nepodaril – chyba na našej strane. Skúste to prosím znova.',
                en: 'The import failed on our side. Please try again.' },
  errNetwork: { cs: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.',
                sk: 'Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie a skúste to znova.',
                en: 'Could not reach the server. Check your connection and try again.' },
  pricing:    { cs: 'Zobrazit tarify', sk: 'Zobraziť tarify', en: 'See plans' },
  signIn:     { cs: 'Přihlásit se', sk: 'Prihlásiť sa', en: 'Sign in' },
  excelPro:   { cs: 'Excel je součástí tarifu Pro.', sk: 'Excel je súčasťou tarifu Pro.', en: 'Excel is part of the Pro plan.' },
} as const;

/**
 * Skloňování počtů: 1 řádek / 2–4 řádky / 5+ řádků. Bez tohohle stálo na stránce „Načteno
 * 1 řádků". Slovenština má vlastní tvary, angličtina si vystačí s dvojicí.
 */
type Forms = { cs: [string, string, string]; sk: [string, string, string]; en: [string, string] };

function plural(n: number, forms: Forms, locale: string): string {
  if (locale === 'en') return `${n} ${forms.en[n === 1 ? 0 : 1]}`;
  const set = locale === 'sk' ? forms.sk : forms.cs;
  return `${n} ${set[n === 1 ? 0 : n >= 2 && n <= 4 ? 1 : 2]}`;
}

const ROWS: Forms  = { cs: ['řádek', 'řádky', 'řádků'], sk: ['riadok', 'riadky', 'riadkov'], en: ['row', 'rows'] };
const FIRMS: Forms = { cs: ['firmu', 'firmy', 'firem'], sk: ['firmu', 'firmy', 'firiem'], en: ['business', 'businesses'] };
const FIRMS_FOUND: Forms = { cs: ['firma', 'firmy', 'firem'], sk: ['firma', 'firmy', 'firiem'], en: ['business', 'businesses'] };

type FieldKey = typeof FIELDS[number]['key'];
type Mapping = Partial<Record<FieldKey, string>>;
type Row = Record<string, string>;

/** Pre-selects the obvious columns so most files need no clicking at all. */
function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const taken = new Set<string>();
  for (const field of FIELDS) {
    const found = headers.find(h => {
      if (taken.has(h)) return false;
      const norm = h.toLowerCase().trim();
      return field.hints.some(hint => norm.includes(hint));
    });
    if (found) {
      mapping[field.key] = found;
      taken.add(found);
    }
  }
  return mapping;
}

/**
 * Text souboru bez ohledu na to, v čem ho kdo uložil.
 *
 * Excel na českých Windows ukládá CSV ve Windows-1250, ne v UTF-8. Papa Parse čte UTF-8, takže
 * z „Květinářství Růže" byla změť, firma se pak nespárovala s ARESem — a uživatele to stálo
 * jedno hledání z tarifu. Zkusíme tedy nejdřív UTF-8 s `fatal: true` a při první neplatné
 * sekvenci spadneme na Windows-1250.
 */
async function readText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1250').decode(buffer);
  }
}

interface ImportResult {
  searchId: string;
  imported: number;
  skipped: number;
}

export default function ImportPage() {
  const locale = useLocale();
  const [filename, setFilename] = useState('');
  const [headers, setHeaders]   = useState<string[]>([]);
  const [rows, setRows]         = useState<Row[]>([]);
  const [mapping, setMapping]   = useState<Mapping>({});
  const [error, setError]       = useState('');
  const [errorAction, setErrorAction] = useState<'login' | 'pricing' | null>(null);
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState<ImportResult | null>(null);
  const [isPro, setIsPro]       = useState(false);

  // Tarif jen kvůli tlačítku Excel: tomu, kdo ho nemá, se dřív ukázalo a po kliknutí mu
  // vyskočil syrový JSON `{"error":"Excel export requires Pro plan"}`.
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setIsPro(['PRO', 'BUSINESS'].includes(d.user?.plan) || !!d.user?.isVip || !!d.user?.isAdmin))
      .catch(err => console.error('import/me:', err));
  }, []);

  const t = (key: keyof typeof T) => localized(T[key], locale);

  const reset = () => {
    setHeaders([]); setRows([]); setMapping({}); setError(''); setErrorAction(null); setDone(null);
  };

  const onFile = async (file: File) => {
    reset();
    setFilename(file.name);
    let text: string;
    try {
      text = await readText(file);
    } catch (err) {
      console.error('import/read:', err);
      setError(t('errRead'));
      return;
    }
    const res = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });
    const cols = (res.meta.fields ?? []).filter(Boolean);
    if (cols.length === 0 || res.data.length === 0) {
      setError(t('errEmpty'));
      return;
    }
    setHeaders(cols);
    setRows(res.data);
    setMapping(guessMapping(cols));
  };

  const nameColumn = mapping.name;
  // Rows without a name have nothing to search for, so they never leave the browser.
  const named = nameColumn ? rows.filter(r => (r[nameColumn] ?? '').trim()).length : 0;
  // Nad strop se stejně nic nezpracuje, tak to řekneme dopředu a tolik řádků taky pošleme.
  const usable = Math.min(named, MAX_IMPORT_ROWS);
  const overCap = named > MAX_IMPORT_ROWS;

  const submit = async () => {
    if (!nameColumn) return;
    setBusy(true);
    setError('');
    setErrorAction(null);
    try {
      const payload = rows
        .map(r => {
          const out: Record<string, string> = { name: (r[nameColumn] ?? '').trim() };
          for (const field of FIELDS) {
            if (field.key === 'name') continue;
            const col = mapping[field.key];
            const value = col ? (r[col] ?? '').trim() : '';
            if (value) out[field.key] = value;
          }
          return out;
        })
        .filter(r => r.name)
        .slice(0, MAX_IMPORT_ROWS);

      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ filename, rows: payload }),
      });
      if (!res.ok) {
        // Podle stavu a kódu, ne podle `data.error` — ten je anglický a psaný pro vývojáře.
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) { setError(t('errLogin')); setErrorAction('login'); return; }
        if (res.status === 403 && data.code === 'PLAN_LIMIT') { setError(t('errLimit')); setErrorAction('pricing'); return; }
        console.error('import:', res.status, data);
        setError(t('errServer'));
        return;
      }
      setDone(await res.json());
    } catch (err) {
      console.error('import:', err);
      setError(t('errNetwork'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pt-24">
      <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
      <p className="text-ink-muted mb-8">{t('intro')}</p>

      {/* Krok 1 – soubor */}
      <div className="card mb-6">
        {/* Pole je `sr-only`, ne `hidden`: s `display: none` by se na něj z klávesnice nedalo
            dostat. Když na pole přijde fokus z klávesnice, rozsvítí se kroužek kolem celé plochy.
            Záměrně `:focus-visible`, ne `focus-within` — klik myší na label přesune fokus do pole
            a kroužek by po zavření dialogu zůstal svítit. */}
        <label className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-line-strong bg-surface rounded-lg cursor-pointer hover:border-accent transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface-subtle">
          <Upload size={24} className="text-ink" />
          <span className="font-medium">{filename || t('pick')}</span>
          <span className="text-xs text-ink-faint">{t('pickHint')}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
        </label>
      </div>

      {/* Krok 2 – mapování sloupců */}
      {headers.length > 0 && !done && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-1">{t('mapTitle')}</h2>
          <p className="text-sm text-ink-muted mb-4">
            {localized({
              cs: `Načteno ${plural(rows.length, ROWS, 'cs')}. `,
              sk: `Načítaných ${plural(rows.length, ROWS, 'sk')}. `,
              en: `Loaded ${plural(rows.length, ROWS, 'en')}. `,
            }, locale)}
            {t('required')}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {FIELDS.map(field => (
              <label key={field.key} className="text-sm">
                <span className="block mb-1 font-medium">
                  {localized(field.label, locale)}{field.required && <span className="text-accent"> *</span>}
                </span>
                <select
                  className="input w-full"
                  value={mapping[field.key] ?? ''}
                  onChange={e =>
                    setMapping(m => ({ ...m, [field.key]: e.target.value || undefined }))
                  }
                >
                  <option value="">{t('none')}</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <button
              className="btn-primary"
              disabled={!nameColumn || usable === 0 || busy}
              onClick={submit}
            >
              {busy
                ? t('working')
                : localized({
                    cs: `Importovat ${plural(usable, FIRMS, 'cs')}`,
                    sk: `Importovať ${plural(usable, FIRMS, 'sk')}`,
                    en: `Import ${plural(usable, FIRMS, 'en')}`,
                  }, locale)}
            </button>
            {!nameColumn && (
              <span className="text-sm text-ink-muted flex items-center gap-1.5">
                <AlertTriangle size={14} /> {t('needName')}
              </span>
            )}
          </div>
          {overCap && (
            <p className="text-xs text-ink-muted mt-3">
              {localized({
                cs: `Soubor má ${plural(named, ROWS, 'cs')}. Zpracujeme prvních ${MAX_IMPORT_ROWS}, zbytek nahrajte v dalším souboru.`,
                sk: `Súbor má ${plural(named, ROWS, 'sk')}. Spracujeme prvých ${MAX_IMPORT_ROWS}, zvyšok nahrajte v ďalšom súbore.`,
                en: `The file has ${plural(named, ROWS, 'en')}. We process the first ${MAX_IMPORT_ROWS}; upload the rest as another file.`,
              }, locale)}
            </p>
          )}
          <p className="text-xs text-ink-faint mt-3">{t('takesTime')}</p>
        </div>
      )}

      {error && (
        <div className="card mb-6 border-ink text-sm font-medium text-ink flex flex-wrap items-center gap-3">
          <span>{error}</span>
          {errorAction === 'login' && (
            <Link href={`/${locale}/auth/login`} className="btn-outline btn-sm">{t('signIn')}</Link>
          )}
          {errorAction === 'pricing' && (
            <Link href={`/${locale}/pricing`} className="btn-outline btn-sm">{t('pricing')}</Link>
          )}
        </div>
      )}

      {/* Krok 3 – hotovo */}
      {done && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-ink-faint" />
            {localized({
              cs: `Hotovo – ${plural(done.imported, FIRMS_FOUND, 'cs')}`,
              sk: `Hotovo – ${plural(done.imported, FIRMS_FOUND, 'sk')}`,
              en: `Done — ${plural(done.imported, FIRMS_FOUND, 'en')}`,
            }, locale)}
          </h2>
          {done.skipped > 0 && (
            <p className="text-sm text-ink-muted mb-3">
              {localized({
                cs: `${plural(done.skipped, ROWS, 'cs')} jsme nezpracovali – jedno hledání zvládne omezený počet firem. Zbytek nahrajte v dalším souboru.`,
                sk: `${plural(done.skipped, ROWS, 'sk')} sme nespracovali – jedno hľadanie zvládne obmedzený počet firiem. Zvyšok nahrajte v ďalšom súbore.`,
                en: `We skipped ${plural(done.skipped, ROWS, 'en')} — one search handles a limited number of businesses. Upload the rest as another file.`,
              }, locale)}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {/* Bez tohohle odkazu byl import slepá ulička: seznam se uložil, ale otevřít ho
                v aplikaci nešlo — import nemá job, takže odkaz z přehledu vedl na prázdný
                formulář. `?search=` načte řádky rovnou z databáze. */}
            <Link href={`/${locale}/search?search=${done.searchId}`} className="btn-primary btn-sm">
              {t('openList')}
            </Link>
            <button className="btn-outline btn-sm" onClick={() => window.open(`/api/export/${done.searchId}?format=csv&locale=${locale}`, '_blank')}>
              <Download size={14} /> {t('csv')}
            </button>
            {isPro ? (
              <button className="btn-outline btn-sm" onClick={() => window.open(`/api/export/${done.searchId}?locale=${locale}`, '_blank')}>
                <Download size={14} /> {t('excel')}
              </button>
            ) : (
              <Link href={`/${locale}/pricing`} className="btn-outline btn-sm">
                <Download size={14} /> {t('excelPro')}
              </Link>
            )}
            <Link href={`/${locale}/dashboard`} className="btn-outline btn-sm">
              {t('overview')}
            </Link>
          </div>
        </div>
      )}

      {/* GDPR */}
      <div className="card text-sm text-ink-muted flex gap-3">
        <ShieldCheck size={16} className="text-ink-faint shrink-0 mt-0.5" />
        <p>
          {t('gdpr1')}
          <Link href={`/${locale}/dashboard`} className="text-accent underline underline-offset-2 decoration-accent/60 hover:decoration-accent transition-colors">
            {t('gdprLink')}
          </Link>
          {t('gdpr2')}
        </p>
      </div>
    </div>
  );
}
