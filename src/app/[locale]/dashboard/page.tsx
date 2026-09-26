'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Search, ArrowRight, Crown, Clock, BarChart3, Upload, Trash2, Bookmark, RefreshCw, Sparkles, Phone, Globe, Users, ShieldCheck, Megaphone, PhoneCall, FileText, BedDouble } from 'lucide-react';
import { FEATURED_SCENARIOS, scenarioById, type ScenarioIcon } from '@/lib/scenarios';

/** Ikony sekcí; jména drží lib/scenarios. */
const SECTION_ICON: Record<ScenarioIcon, React.ReactNode> = {
  globe: <Globe size={16} />, social: <Users size={16} />, shield: <ShieldCheck size={16} />,
  megaphone: <Megaphone size={16} />, sparkles: <Sparkles size={16} />, phone: <PhoneCall size={16} />,
  search: <Search size={16} />, list: <FileText size={16} />, bed: <BedDouble size={16} />,
};
import { clearUser } from '@/lib/client-auth';
import { industryLabel } from '@/lib/search-options';
import { formatDate } from '@/lib/format-date';
import { localized } from '@/lib/lead-filters';
import { NewFirmsDigest } from '@/components/NewFirmsDigest';
import { Pipeline } from '@/components/Pipeline';

interface Search {
  id: string; query: string; region: string; createdAt: string;
  _count: { results: number };
}
/** Stav hledání běžícího na pozadí. Páruje se se `Search` přes `searchId`. */
interface Job {
  id: string; searchId: string; status: 'queued' | 'running' | 'paused' | 'done' | 'failed';
  foundCount: number; processedCount: number; error: string | null;
}

const JOB_LABEL: Record<Job['status'], { cs: string; sk: string; en: string }> = {
  queued:  { cs: 'čeká',    sk: 'čaká',   en: 'queued' },
  running: { cs: 'běží',    sk: 'beží',   en: 'running' },
  // Hledání po městech, které vyčerpalo čas jedné invokace. Naváže samo, jakmile uživatel
  // otevře jeho výsledky — proto „pokračuje", ne „stojí".
  paused:  { cs: 'pokračuje', sk: 'pokračuje', en: 'continues' },
  done:    { cs: 'hotovo',  sk: 'hotovo', en: 'done' },
  failed:  { cs: 'spadlo',  sk: 'spadlo', en: 'failed' },
};
interface User {
  name?: string; email: string; plan: string; isAdmin: boolean; isVip: boolean;
}
/** Uložené hledání = kořen se jménem; viz `/api/searches`. */
interface SavedSearch {
  id: string; name: string; query: string; region: string; runs: number;
  latestId: string; latestAt: string; latestCount: number; newCount: number;
  /** Firmy, které v seznamu už byly a poprvé mají telefon nebo e-mail. */
  contactNewCount: number;
  /** `profile` = výchozí kombinace z dotazníku, ještě neupravená. */
  origin: string | null;
}

const PLAN_LABELS: Record<string, { cs: string; sk: string; en: string }> = { FREE: { cs: 'Zdarma', sk: 'Zadarmo', en: 'Free' }, PRO: { cs: 'Pro', sk: 'Pro', en: 'Pro' }, BUSINESS: { cs: 'Business', sk: 'Business', en: 'Business' } };

export default function DashboardPage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';
  const [user, setUser]       = useState<User | null>(null);
  const [searches, setSearches] = useState<Search[]>([]);
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [rerunError, setRerunError] = useState('');
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  /** Stavy hledání nedorazily — štítky „běží / hotovo" chybí a seznam to má říct, ne mlčet. */
  const [jobsFailed, setJobsFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  /**
   * Deleting a search takes its results with it (the relation cascades). Imported lists are
   * the user's own contact data, so this has to be one click away — not a support request.
   */
  const remove = async (id: string) => {
    const ok = window.confirm(isCs
      ? 'Smazat toto hledání i všechny jeho výsledky? Nejde to vrátit.'
      : 'Delete this search and all its results? This cannot be undone.');
    if (!ok) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/searches/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error(`delete ${res.status}`);
      setSearches(list => list.filter(s => s.id !== id));
      // I mezi uloženými: smazaný kořen nebo běh tam nesmí zůstat viset.
      setSaved(list => list.filter(s => s.id !== id && s.latestId !== id));
    } catch (err) {
      console.error('dashboard/delete:', err);
      setRerunError(isCs ? 'Smazání se nepovedlo. Zkuste to prosím znovu.' : 'Could not delete. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    // Propadlá session vypadala jako prázdný účet: 401 se uložilo jako „žádná hledání" a uživatel
    // si myslel, že o data přišel. Jméno v `localStorage` ho navíc dál ukazovalo přihlášeného.
    fetch('/api/profile', { credentials: 'include' })
      .then(async res => {
        if (res.status === 401) {
          clearUser();
          window.location.href = `/${locale}/auth/login`;
          return;
        }
        if (!res.ok) throw new Error(`profile ${res.status}`);
        const d = await res.json();
        setUser(d.user);
        setSearches(d.searches ?? []);
        setLoading(false);
        // Uložená hledání s „co je nové" počítá seznam hledání, ne profil.
        fetch('/api/searches', { credentials: 'include' })
          .then(r => (r.ok ? r.json() : { saved: [] }))
          .then(x => setSaved(x.saved ?? []))
          .catch(err => console.error('dashboard/searches:', err));
      })
      .catch(err => {
        console.error('dashboard/profile:', err);
        setLoadError(true);
        setLoading(false);
      });
  }, [locale]);

  /**
   * Stavy hledání. Načítají se zvlášť, protože `/api/profile` o jobech nic neví — a hlavně
   * proto, že tenhle dotaz zároveň uklidí joby, které se zasekly (viz `sweepStaleJobs`).
   */
  useEffect(() => {
    fetch('/api/jobs', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => setJobs(Object.fromEntries((d.jobs ?? []).map((j: Job) => [j.searchId, j]))))
      .catch(err => { console.error('dashboard/jobs:', err); setJobsFailed(true); });
  }, []);

  if (loading) return (
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <svg className="animate-spin h-6 w-6 text-ink-faint" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
    </div>
  );

  // Server neodpověděl. Prázdný přehled by tvrdil, že uživatel nic nemá — to je horší než chyba.
  if (loadError) return (
    <div className="min-h-screen pt-16 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-ink-muted">
        {isCs ? 'Přehled se teď nepodařilo načíst. Vaše hledání se nikam neztratila.'
              : 'The dashboard could not be loaded right now. Your searches are safe.'}
      </p>
      <button className="btn-outline btn-sm" onClick={() => window.location.reload()}>
        {isCs ? 'Zkusit znovu' : 'Try again'}
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="eyebrow mb-3">{isCs ? 'Přehled' : 'Dashboard'}</p>
          <h1 className="display-sm">
            {user?.name ? `${isCs ? 'Vítejte' : 'Welcome'}, ${user.name}` : (isCs ? 'Přehled' : 'Dashboard')}<span className="text-accent">.</span>
          </h1>
        </div>
        <Link href={`/${locale}/pricing`} className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-subtle px-4 py-2 hover:border-ink transition-colors">
          <Crown size={14} className="text-warm" />
          <span className="text-sm font-medium text-ink">
            {localized(PLAN_LABELS[user?.plan ?? 'FREE'] ?? PLAN_LABELS.FREE, locale)}
            {user?.isVip && ' · VIP'}
          </span>
        </Link>
      </div>

      {/*
        Sekce podle záměru: čtyři vstupy do hledání, které pokryjí většinu profesí (tvůrce webů,
        marketér, účetní, kdokoli, kdo volá). Každý odkaz předá scénář do hledání přes `?scenario=`,
        takže uživatel začne s poskládanými podmínkami, ne s prázdným formulářem.
      */}
      <h2 className="text-lg font-semibold mb-3">{isCs ? 'Koho hledáte' : 'Who are you looking for'}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {FEATURED_SCENARIOS.map(id => {
          const sc = scenarioById(id);
          return (
            <Link key={id} href={`/${locale}/search?scenario=${id}`} className="card-hover group flex flex-col gap-3">
              <span className="flex items-center gap-3">
                <span className="icon-tile icon-tile--who">{SECTION_ICON[sc.icon ?? 'search']}</span>
                <span className="font-semibold leading-tight">{localized(sc.label, locale)}</span>
              </span>
              {sc.forWhom && (
                <span className="text-[11px] uppercase tracking-wider text-ink-faint">
                  {isCs ? 'pro' : 'for'} {localized(sc.forWhom, locale)}
                </span>
              )}
              <span className="text-sm text-ink-muted leading-relaxed">{localized(sc.hint, locale)}</span>
              <span className="mt-auto flex items-center gap-1 text-sm text-ink-faint group-hover:text-accent transition-colors">
                {isCs ? 'Hledat' : 'Search'} <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link href={`/${locale}/search`} className="card-hover flex items-center gap-4 group">
          <span className="icon-tile icon-tile--who"><Search size={16} /></span>
          <div>
            <div className="font-semibold">{isCs ? 'Nové vyhledávání' : 'New search'}</div>
            <div className="text-sm text-ink-muted">{isCs ? 'Najít nové firmy' : 'Find new businesses'}</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-ink-faint group-hover:text-accent transition-colors" />
        </Link>
        <Link href={`/${locale}/import`} className="card-hover flex items-center gap-4 group">
          <span className="icon-tile icon-tile--standing"><Upload size={16} /></span>
          <div>
            <div className="font-semibold">{isCs ? 'Import CSV' : 'CSV import'}</div>
            <div className="text-sm text-ink-muted">{isCs ? 'Ověřit vlastní seznam' : 'Verify your own list'}</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-ink-faint group-hover:text-accent transition-colors" />
        </Link>
        <Link href={`/${locale}/profile`} className="card-hover flex items-center gap-4 group">
          <span className="icon-tile icon-tile--reach"><BarChart3 size={16} /></span>
          <div>
            <div className="font-semibold">{isCs ? 'Můj profil' : 'My profile'}</div>
            <div className="text-sm text-ink-muted">{isCs ? 'Historie a nastavení' : 'History & settings'}</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-ink-faint group-hover:text-accent transition-colors" />
        </Link>
      </div>

      {/* Denní dávka: kolik firem v kraji uživatele nově vzniklo, bez hledání. Viz lib/digest.ts. */}
      {user && <NewFirmsDigest locale={locale} isAdmin={user.isAdmin} />}

      {/* Nástěnka označených firem napříč hledáními. Viz components/Pipeline.tsx. */}
      <Pipeline locale={locale} />

      {/* Uložená hledání: kombinace, ke které se uživatel vrací, a kolik je v ní nového od minula.
          Bez jediného uloženého by tu nebylo nic — a nováček by o funkci nevěděl. */}
      {saved.length === 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <span className="icon-tile icon-tile--who h-7 w-7"><Bookmark size={14} /></span>{isCs ? 'Uložená hledání' : 'Saved searches'}
          </h2>
          <p className="text-sm text-ink-muted">
            {isCs
              ? 'Zatím žádné. Hledání si pojmenujete tlačítkem „Uložit" nad výsledky; pak ho spustíte znovu jedním klikem a uvidíte, které firmy a kontakty od minula přibyly.'
              : 'None yet. Name a search with the “Save” button above its results; then rerun it in one click and see which firms and contacts are new since last time.'}
          </p>
        </div>
      )}
      {saved.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <span className="icon-tile icon-tile--who h-7 w-7"><Bookmark size={14} /></span>{isCs ? 'Uložená hledání' : 'Saved searches'}
          </h2>
          <p className="text-xs text-ink-faint mb-4">
            {isCs ? '„Nové" = firmy, které v dřívějších bězích nebyly a přibyly od chvíle, kdy jste hledání naposledy otevřeli.'
                  : '“New” = firms that were not in earlier runs and appeared since you last opened the search.'}
          </p>
          {rerunError && <p className="mb-3 text-sm font-medium border border-ink px-3 py-2">{rerunError}</p>}
          <div className="divide-y divide-line">
            {saved.map(s => (
              <div key={s.id} className="flex items-center justify-between py-3 gap-3 flex-wrap">
                <div className="min-w-0">
                  <Link href={`/${locale}/search?search=${s.latestId}`} className="font-medium hover:text-accent transition-colors">
                    {s.name}
                  </Link>
                  <span className="text-ink-faint mx-2">·</span>
                  <span className="text-ink-muted">{industryLabel(s.query, locale)}, {s.region}</span>
                  {s.newCount > 0 && (
                    <span className="badge-accent ml-2"><Sparkles size={10} />{s.newCount} {isCs ? 'nových' : 'new'}</span>
                  )}
                  {s.contactNewCount > 0 && (
                    <span className="badge-accent ml-2" title={isCs ? 'Firmy, které v seznamu už byly a teď se u nich poprvé dohledal telefon nebo e-mail.' : 'Firms already on the list that now have a phone or e-mail for the first time.'}>
                      <Phone size={10} />{s.contactNewCount} {isCs ? (s.contactNewCount === 1 ? 'nový kontakt' : s.contactNewCount < 5 ? 'nové kontakty' : 'nových kontaktů') : (s.contactNewCount === 1 ? 'new contact' : 'new contacts')}
                    </span>
                  )}
                  {s.origin === 'profile' && (
                    <span className="badge ml-2 text-ink-faint"
                          title={isCs ? 'Založeno z dotazníku po registraci. Jakmile cokoli změníte, je to vaše hledání.' : 'Created from the sign-up questionnaire. Once you change anything it is yours.'}>
                      {isCs ? 'výchozí podle oboru' : 'default for your trade'}
                    </span>
                  )}
                  {s.runs === 1 && s.latestCount === 0 && (
                    <span className="text-xs text-ink-faint ml-2">{isCs ? 'ještě nespuštěno' : 'not run yet'}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-faint tnum">
                    {s.runs}× · {s.latestCount} {isCs ? 'firem' : 'businesses'} · {formatDate(s.latestAt, locale)}
                  </span>
                  <button
                    onClick={async () => {
                      setRerunning(s.id); setRerunError('');
                      try {
                        const res = await fetch(`/api/searches/${s.id}/rerun`, { method: 'POST' });
                        const d = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setRerunError(d.code === 'IMPORT'
                            ? (isCs ? 'Nahraný seznam se znovu spustit nedá — importujte soubor znovu.' : 'An uploaded list cannot be re-run — import the file again.')
                            : res.status === 403
                            ? (isCs ? 'Vyčerpali jste hledání ve svém tarifu.' : 'You have used up the searches in your plan.')
                            : res.status === 429
                              ? (isCs ? 'Příliš mnoho hledání za sebou. Zkuste to za pár minut.' : 'Too many searches in a row. Try again in a few minutes.')
                              : (isCs ? 'Spuštění se nepovedlo. Zkuste to prosím znovu.' : 'Could not start. Please try again.'));
                          return;
                        }
                        window.location.href = `/${locale}/search?job=${d.jobId}`;
                      } catch (err) {
                        console.error('dashboard/rerun:', err);
                        setRerunError(isCs ? 'Nepodařilo se spojit se serverem.' : 'Could not reach the server.');
                      } finally {
                        setRerunning(null);
                      }
                    }}
                    disabled={rerunning === s.id}
                    className="btn-outline btn-sm gap-1.5"
                  >
                    <RefreshCw size={14} />{isCs ? 'Spustit znovu' : 'Run again'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent searches */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="icon-tile icon-tile--standing h-7 w-7"><Clock size={14} /></span>{isCs ? 'Poslední vyhledávání' : 'Recent searches'}
        </h2>
        {jobsFailed && searches.length > 0 && (
          <p className="text-xs text-ink-faint mb-3">
            {isCs ? 'Stavy běžících hledání se nepodařilo načíst — seznam je úplný, jen bez štítků „běží / hotovo".'
                  : 'Search states could not be loaded — the list is complete, just without the running / done labels.'}
          </p>
        )}
        {searches.length === 0 ? (
          <div className="text-center py-10 text-ink-faint">
            <Search size={40} className="mx-auto mb-3 opacity-30" />
            <p>{isCs ? 'Zatím žádná vyhledávání.' : 'No searches yet.'}</p>
            <Link href={`/${locale}/search`} className="btn-primary mt-4 inline-flex">
              {isCs ? 'Vyhledat firmy' : 'Search businesses'}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {searches.map(s => {
              const job = jobs[s.id];
              return (
              <div key={s.id} className="flex items-center justify-between py-3 gap-3">
                <div className="min-w-0">
                  {/* Odkaz otevře hledání znovu — i to, které ještě běží. Průběh se dopočítá
                      ze serveru, takže se uživatel může vrátit ke kterémukoli běhu.
                      Import CSV a hledání starší, než kam sahá seznam jobů, žádný job nemají;
                      ty se otevřou přes `?search=`, které načte řádky rovnou z databáze. Dřív
                      z toho bylo prázdné `?job=` a odkaz vedl na čistý formulář. */}
                  <Link href={job ? `/${locale}/search?job=${job.id}` : `/${locale}/search?search=${s.id}`}
                        className="font-medium hover:text-accent transition-colors">
                    {industryLabel(s.query, locale)}
                  </Link>
                  <span className="text-ink-faint mx-2">·</span>
                  <span className="text-ink-muted">{s.region}</span>
                  {job && (
                    <span className={`badge ml-2 ${job.status === 'failed' ? 'badge-red' : ''}`}>
                      {/* Přes `?.`, protože stav přichází ze serveru jako řetězec: nový stav
                          přidaný v budoucnu má zůstat neznámým štítkem, ne pádem stránky. */}
                      {JOB_LABEL[job.status] ? localized(JOB_LABEL[job.status], locale) : job.status}
                      {job.status === 'running' && ` ${job.processedCount}/${job.foundCount}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-ink-faint tnum">{s._count.results} {isCs ? 'firem' : 'businesses'}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-faint tnum">
                    <Clock size={11} />
                    {formatDate(s.createdAt, locale)}
                  </span>
                  <button
                    onClick={() => remove(s.id)}
                    disabled={deleting === s.id}
                    title={isCs ? 'Smazat' : 'Delete'}
                    aria-label={isCs ? 'Smazat hledání' : 'Delete search'}
                    className="p-1.5 min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-lg text-ink-faint hover:text-ink hover:bg-ink/[0.06] transition-colors disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
