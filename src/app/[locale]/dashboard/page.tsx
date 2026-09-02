'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Search, ArrowRight, Crown, Clock, BarChart3, Upload, Trash2 } from 'lucide-react';
import { industryLabel } from '@/lib/search-options';

interface Search {
  id: string; query: string; region: string; createdAt: string;
  _count: { results: number };
}
/** Stav hledání běžícího na pozadí. Páruje se se `Search` přes `searchId`. */
interface Job {
  id: string; searchId: string; status: 'queued' | 'running' | 'paused' | 'done' | 'failed';
  foundCount: number; processedCount: number; error: string | null;
}

const JOB_LABEL: Record<Job['status'], { cs: string; en: string }> = {
  queued:  { cs: 'čeká',    en: 'queued' },
  running: { cs: 'běží',    en: 'running' },
  // Hledání po městech, které vyčerpalo čas jedné invokace. Naváže samo, jakmile uživatel
  // otevře jeho výsledky — proto „pokračuje", ne „stojí".
  paused:  { cs: 'pokračuje', en: 'continues' },
  done:    { cs: 'hotovo',  en: 'done' },
  failed:  { cs: 'spadlo',  en: 'failed' },
};
interface User {
  name?: string; email: string; plan: string; isAdmin: boolean; isVip: boolean;
}

const PLAN_LABELS: Record<string, string> = { FREE: 'Zdarma', PRO: 'Pro', BUSINESS: 'Business' };

export default function DashboardPage() {
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';
  const [user, setUser]       = useState<User | null>(null);
  const [searches, setSearches] = useState<Search[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [loading, setLoading] = useState(true);
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
    const res = await fetch(`/api/searches/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setSearches(list => list.filter(s => s.id !== id));
    setDeleting(null);
  };

  useEffect(() => {
    fetch('/api/profile', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        setUser(d.user);
        setSearches(d.searches ?? []);
        setLoading(false);
      });
  }, []);

  /**
   * Stavy hledání. Načítají se zvlášť, protože `/api/profile` o jobech nic neví — a hlavně
   * proto, že tenhle dotaz zároveň uklidí joby, které se zasekly (viz `sweepStaleJobs`).
   */
  useEffect(() => {
    fetch('/api/jobs', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { jobs: [] }))
      .then(d => setJobs(Object.fromEntries((d.jobs ?? []).map((j: Job) => [j.searchId, j]))))
      .catch(() => {});
  }, []);

  if (loading) return (
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <svg className="animate-spin h-6 w-6 text-ink-faint" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pt-24">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">
          {user?.name ? `${isCs ? 'Vítejte' : 'Welcome'}, ${user.name}!` : (isCs ? 'Přehled' : 'Dashboard')}
        </h1>
        <div className="flex items-center gap-2 border border-line rounded-lg px-4 py-2">
          <Crown size={16} className="text-ink-faint" />
          <span className="text-sm font-medium text-ink">
            {PLAN_LABELS[user?.plan ?? 'FREE']}
            {user?.isVip && ' · VIP'}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link href={`/${locale}/search`} className="card-hover flex items-center gap-4 group">
          <Search size={20} className="shrink-0 text-ink" />
          <div>
            <div className="font-semibold">{isCs ? 'Nové vyhledávání' : 'New search'}</div>
            <div className="text-sm text-ink-muted">{isCs ? 'Najít nové firmy' : 'Find new businesses'}</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-ink-faint group-hover:text-accent transition-colors" />
        </Link>
        <Link href={`/${locale}/import`} className="card-hover flex items-center gap-4 group">
          <Upload size={20} className="shrink-0 text-ink" />
          <div>
            <div className="font-semibold">{isCs ? 'Import CSV' : 'CSV import'}</div>
            <div className="text-sm text-ink-muted">{isCs ? 'Ověřit vlastní seznam' : 'Verify your own list'}</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-ink-faint group-hover:text-accent transition-colors" />
        </Link>
        <Link href={`/${locale}/profile`} className="card-hover flex items-center gap-4 group">
          <BarChart3 size={20} className="shrink-0 text-ink" />
          <div>
            <div className="font-semibold">{isCs ? 'Můj profil' : 'My profile'}</div>
            <div className="text-sm text-ink-muted">{isCs ? 'Historie a nastavení' : 'History & settings'}</div>
          </div>
          <ArrowRight size={18} className="ml-auto text-ink-faint group-hover:text-accent transition-colors" />
        </Link>
      </div>

      {/* Recent searches */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">{isCs ? 'Poslední vyhledávání' : 'Recent searches'}</h2>
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
                      ze serveru, takže se uživatel může vrátit ke kterémukoli běhu. */}
                  <Link href={`/${locale}/search?job=${job?.id ?? ''}`} className="font-medium hover:text-accent transition-colors">
                    {industryLabel(s.query, locale)}
                  </Link>
                  <span className="text-ink-faint mx-2">·</span>
                  <span className="text-ink-muted">{s.region}</span>
                  {job && (
                    <span className={`badge ml-2 ${job.status === 'failed' ? 'badge-red' : ''}`}>
                      {/* Přes `?.`, protože stav přichází ze serveru jako řetězec: nový stav
                          přidaný v budoucnu má zůstat neznámým štítkem, ne pádem stránky. */}
                      {isCs ? JOB_LABEL[job.status]?.cs ?? job.status : JOB_LABEL[job.status]?.en ?? job.status}
                      {job.status === 'running' && ` ${job.processedCount}/${job.foundCount}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-ink-faint tnum">{s._count.results} {isCs ? 'firem' : 'businesses'}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-faint tnum">
                    <Clock size={11} />
                    {new Date(s.createdAt).toLocaleDateString(isCs ? 'cs-CZ' : 'en-US')}
                  </span>
                  <button
                    onClick={() => remove(s.id)}
                    disabled={deleting === s.id}
                    title={isCs ? 'Smazat' : 'Delete'}
                    className="p-1.5 rounded-lg text-ink-faint hover:text-accent transition-colors disabled:opacity-40"
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
