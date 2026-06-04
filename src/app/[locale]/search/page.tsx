'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, Download, Globe, Users, Star, ExternalLink,
  Phone, Mail, MapPin, SlidersHorizontal, X, AlertTriangle, Clock,
} from 'lucide-react';

interface BusinessResult {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  hasWebsite: boolean;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  websiteIsOld: boolean;
  websiteScore: number;
  websiteAgeNote: string;
  reviewCount: number;
  rating?: number;
  googleMapsUrl?: string;
}

// null = don't care, true = must have/be, false = must not have/be
interface Filters {
  website:    boolean | null;
  oldWebsite: boolean | null; // true = old web, false = modern web
  social:     boolean | null;
  reviews:    boolean | null;
  rating:     boolean | null;
}

const EMPTY: Filters = { website: null, oldWebsite: null, social: null, reviews: null, rating: null };

function match(b: BusinessResult, f: Filters): boolean {
  const social = b.hasFacebook || b.hasInstagram || b.hasLinkedIn;
  if (f.website    !== null && b.hasWebsite    !== f.website)    return false;
  if (f.oldWebsite !== null && b.websiteIsOld  !== f.oldWebsite) return false;
  if (f.social     !== null && social          !== f.social)     return false;
  if (f.reviews    !== null && (b.reviewCount >= 10) !== f.reviews) return false;
  if (f.rating     !== null && ((b.rating ?? 0) >= 3.5) !== f.rating) return false;
  // If "old website" filter is on but website doesn't exist, exclude
  if (f.oldWebsite !== null && !b.hasWebsite) return false;
  return true;
}

const activeCount = (f: Filters) => Object.values(f).filter(v => v !== null).length;

function WebsiteScoreBadge({ score, isOld, note, isCs }: { score: number; isOld: boolean; note: string; isCs: boolean }) {
  if (score === 0) return null;
  if (isOld) {
    return (
      <span className="badge badge-yellow gap-1" title={note}>
        <Clock size={10} />
        {isCs ? `Starý web (${score}/100)` : `Old site (${score}/100)`}
        {note && <span className="hidden sm:inline opacity-60"> · {note}</span>}
      </span>
    );
  }
  if (score >= 65) {
    return (
      <span className="badge badge-green gap-1">
        <Globe size={10} />
        {isCs ? `Moderní web (${score}/100)` : `Modern site (${score}/100)`}
      </span>
    );
  }
  return null;
}

export default function SearchPage() {
  const t = useTranslations('search');
  const locale = useLocale();
  const isCs = locale === 'cs';

  const [region, setRegion]       = useState('');
  const [industry, setIndustry]   = useState('');
  const [filters, setFilters]     = useState<Filters>(EMPTY);
  const [results, setResults]     = useState<BusinessResult[]>([]);
  const [searchId, setSearchId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError]         = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const filtered = results.filter(b => match(b, filters));

  const setF = <K extends keyof Filters>(key: K, val: boolean) =>
    setFilters(prev => ({ ...prev, [key]: prev[key] === val ? null : val }));

  // Count of results matching a single criterion (over full results)
  const cnt = (key: keyof Filters, val: boolean) =>
    results.filter(b => match(b, { ...EMPTY, [key]: val })).length;

  const isWholeCzech = (r: string) =>
    ['celá čr','cela cr','celé česko','czech republic','czechia','česká republika','ceska republika']
      .includes(r.toLowerCase().trim());

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResults([]);
    setFilters(EMPTY);
    setHasSearched(true);
    if (isWholeCzech(region)) {
      setLoadingMsg(isCs
        ? 'Prohledávám všech 14 krajů ČR… může to trvat 1–2 minuty.'
        : 'Searching all 14 Czech regions… this may take 1–2 minutes.');
    } else {
      setLoadingMsg('');
    }
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, industry }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setError(isCs ? 'Přihlaste se prosím.' : 'Please log in.');
        else if (res.status === 403) setError(isCs ? 'Limit vyhledávání vyčerpán. Upgradujte plán.' : 'Search limit reached. Upgrade your plan.');
        else setError(data.error || 'Error');
        return;
      }
      setResults(data.results);
      setSearchId(data.searchId);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const hasSocial = (b: BusinessResult) => b.hasFacebook || b.hasInstagram || b.hasLinkedIn;

  const problemCount = (b: BusinessResult) => {
    let n = 0;
    if (!b.hasWebsite) n++;
    else if (b.websiteIsOld) n++;       // has web but it's old = problem
    if (!hasSocial(b)) n++;
    if (b.reviewCount < 10) n++;
    if ((b.rating ?? 5) < 3.5) n++;
    return n;
  };

  type TriProps = { label: string; n: number; active: boolean; onClick: () => void; color: string };
  const Tri = ({ label, n, active, onClick, color }: TriProps) => (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        active ? color + ' shadow-sm' : 'border-ink/10 text-ink-faint hover:border-ink/20 hover:text-ink-muted bg-white'
      }`}>
      {label}
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/30' : 'bg-ink/5'}`}>{n}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-surface pt-16">
      <div className="border-b border-ink/5 bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-ink mb-1">{t('title')}</h1>
          <p className="text-ink-muted text-sm">
            {isCs
              ? 'Zadej "Celá ČR" jako region pro vyhledávání v celé republice'
              : 'Enter a city or region — or "Czech Republic" to search nationwide'}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* Search form */}
        <form onSubmit={handleSearch} className="card mb-6">
          <div className="grid md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="label">{t('region_label')}</label>
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input className="input pl-9" placeholder={isCs ? 'Praha, Brno, nebo "Celá ČR"…' : 'City or "Czech Republic"…'}
                  value={region} onChange={e => setRegion(e.target.value)} required />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('industry_label')}</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input className="input pl-9" placeholder={t('industry_placeholder')}
                  value={industry} onChange={e => setIndustry(e.target.value)} required />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary h-[42px]">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {t('searching')}
                </span>
              ) : <><Search size={16} />{t('search_button')}</>}
            </button>
          </div>

          {loading && loadingMsg && (
            <div className="mt-4 flex items-center gap-2 text-sm text-brand-600 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
              <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {loadingMsg}
            </div>
          )}

          <p className="text-[11px] text-ink-faint mt-3 flex items-center gap-1">
            <AlertTriangle size={11} />
            {isCs
              ? 'Tip: "Celá ČR" prohledá všech 14 krajů a sloučí výsledky (trvá 1–2 min).'
              : 'Tip: "Czech Republic" searches all 14 regions and merges results (takes 1–2 min).'}
          </p>
        </form>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>
        )}

        {results.length > 0 && (
          <>
            {/* ── Filter panel ── */}
            <div className="card mb-4 p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-ink-faint" />
                  <span className="text-sm font-medium text-ink">
                    {isCs ? 'Filtrovat výsledky' : 'Filter results'}
                  </span>
                  {activeCount(filters) > 0 && (
                    <span className="badge-purple text-[10px]">
                      {activeCount(filters)} {isCs ? 'aktivní' : 'active'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-ink-faint">
                    {isCs ? `${filtered.length} z ${results.length} firem` : `${filtered.length} of ${results.length}`}
                  </span>
                  {activeCount(filters) > 0 && (
                    <button onClick={() => setFilters(EMPTY)}
                      className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink transition-colors">
                      <X size={12} />{isCs ? 'Resetovat' : 'Reset'}
                    </button>
                  )}
                  {searchId && (
                    <button onClick={() => window.open(`/api/export/${searchId}`, '_blank')}
                      className="btn-outline btn-sm gap-1.5">
                      <Download size={13} />{t('export_excel')}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Website presence */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Web' : 'Website'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Tri label={isCs ? 'Má web' : 'Has website'} n={cnt('website', true)}
                      active={filters.website === true} onClick={() => setF('website', true)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700" />
                    <Tri label={isCs ? 'Bez webu' : 'No website'} n={cnt('website', false)}
                      active={filters.website === false} onClick={() => setF('website', false)}
                      color="border-red-300 bg-red-50 text-red-700" />
                  </div>
                </div>

                {/* Website quality */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Kvalita webu' : 'Site quality'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Tri label={isCs ? 'Starý web' : 'Old site'} n={cnt('oldWebsite', true)}
                      active={filters.oldWebsite === true} onClick={() => setF('oldWebsite', true)}
                      color="border-yellow-300 bg-yellow-50 text-yellow-700" />
                    <Tri label={isCs ? 'Moderní web' : 'Modern site'} n={cnt('oldWebsite', false)}
                      active={filters.oldWebsite === false} onClick={() => setF('oldWebsite', false)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700" />
                  </div>
                </div>

                {/* Social */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Sociální sítě' : 'Social'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Tri label={isCs ? 'Má soc. sítě' : 'Has social'} n={cnt('social', true)}
                      active={filters.social === true} onClick={() => setF('social', true)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700" />
                    <Tri label={isCs ? 'Bez soc. sítí' : 'No social'} n={cnt('social', false)}
                      active={filters.social === false} onClick={() => setF('social', false)}
                      color="border-red-300 bg-red-50 text-red-700" />
                  </div>
                </div>

                {/* Reviews */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Recenze' : 'Reviews'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Tri label={isCs ? '10 a více' : '10+'} n={cnt('reviews', true)}
                      active={filters.reviews === true} onClick={() => setF('reviews', true)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700" />
                    <Tri label={isCs ? 'Méně než 10' : '<10'} n={cnt('reviews', false)}
                      active={filters.reviews === false} onClick={() => setF('reviews', false)}
                      color="border-yellow-300 bg-yellow-50 text-yellow-700" />
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Hodnocení' : 'Rating'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Tri label="3.5+" n={cnt('rating', true)}
                      active={filters.rating === true} onClick={() => setF('rating', true)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700" />
                    <Tri label={isCs ? 'Pod 3.5' : '<3.5'} n={cnt('rating', false)}
                      active={filters.rating === false} onClick={() => setF('rating', false)}
                      color="border-purple-300 bg-purple-50 text-purple-700" />
                  </div>
                </div>
              </div>

              {/* Active filter pills */}
              {activeCount(filters) > 0 && (
                <div className="mt-3 pt-3 border-t border-ink/5 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-ink-faint">{isCs ? 'Aktivní:' : 'Active:'}</span>
                  {filters.website !== null && (
                    <span className={`badge text-xs ${filters.website ? 'badge-green' : 'badge-red'}`}>
                      <Globe size={10} />
                      {filters.website ? (isCs ? 'Má web' : 'Has website') : (isCs ? 'Bez webu' : 'No website')}
                      <button onClick={() => setF('website', filters.website!)}><X size={9} /></button>
                    </span>
                  )}
                  {filters.oldWebsite !== null && (
                    <span className={`badge text-xs ${filters.oldWebsite ? 'badge-yellow' : 'badge-green'}`}>
                      <Clock size={10} />
                      {filters.oldWebsite ? (isCs ? 'Starý web' : 'Old site') : (isCs ? 'Moderní web' : 'Modern site')}
                      <button onClick={() => setF('oldWebsite', filters.oldWebsite!)}><X size={9} /></button>
                    </span>
                  )}
                  {filters.social !== null && (
                    <span className={`badge text-xs ${filters.social ? 'badge-green' : 'badge-red'}`}>
                      <Users size={10} />
                      {filters.social ? (isCs ? 'Má soc. sítě' : 'Has social') : (isCs ? 'Bez soc. sítí' : 'No social')}
                      <button onClick={() => setF('social', filters.social!)}><X size={9} /></button>
                    </span>
                  )}
                  {filters.reviews !== null && (
                    <span className={`badge text-xs ${filters.reviews ? 'badge-green' : 'badge-yellow'}`}>
                      <Star size={10} />
                      {filters.reviews ? (isCs ? '10+ recenzí' : '10+ reviews') : (isCs ? 'Méně než 10' : 'Fewer than 10')}
                      <button onClick={() => setF('reviews', filters.reviews!)}><X size={9} /></button>
                    </span>
                  )}
                  {filters.rating !== null && (
                    <span className={`badge text-xs ${filters.rating ? 'badge-green' : 'badge-red'}`}>
                      <Star size={10} />
                      {filters.rating ? 'Rating 3.5+' : (isCs ? 'Hodnocení pod 3.5' : 'Rating <3.5')}
                      <button onClick={() => setF('rating', filters.rating!)}><X size={9} /></button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Results */}
            <div className="space-y-3">
              {filtered.map(b => {
                const problems = problemCount(b);
                const social = hasSocial(b);
                return (
                  <div key={b.id} className="card p-0 overflow-hidden hover:shadow-card-hover transition-shadow">
                    <div className="flex items-start gap-4 p-5">
                      {/* Problem score */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        problems >= 3 ? 'bg-red-100 text-red-600' :
                        problems === 2 ? 'bg-orange-100 text-orange-600' :
                        problems === 1 ? 'bg-yellow-100 text-yellow-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {problems > 0 ? problems : '✓'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-ink">{b.name}</h3>
                            {b.address && (
                              <p className="text-xs text-ink-faint mt-0.5 flex items-center gap-1">
                                <MapPin size={11} />{b.address}
                              </p>
                            )}
                          </div>
                          {b.googleMapsUrl && (
                            <a href={b.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                               className="flex-shrink-0 btn-ghost btn-sm p-1.5">
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>

                        {/* Contacts */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          {b.phone && (
                            <a href={`tel:${b.phone}`} className="flex items-center gap-1 text-xs text-ink-muted hover:text-brand-600 transition-colors">
                              <Phone size={11} />{b.phone}
                            </a>
                          )}
                          {b.email && (
                            <a href={`mailto:${b.email}`} className="flex items-center gap-1 text-xs text-ink-muted hover:text-brand-600 transition-colors">
                              <Mail size={11} />{b.email}
                            </a>
                          )}
                          {b.website && (
                            <a href={b.website} target="_blank" rel="noopener noreferrer"
                               className="flex items-center gap-1 text-xs text-ink-muted hover:text-brand-600 transition-colors truncate max-w-[200px]">
                              <Globe size={11} />{b.website.replace(/^https?:\/\//, '')}
                            </a>
                          )}
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className={b.hasWebsite ? 'badge-green' : 'badge-red'}>
                            <Globe size={10} />
                            {b.hasWebsite ? (isCs ? 'Má web' : 'Has website') : (isCs ? 'Bez webu' : 'No website')}
                          </span>

                          {/* Website quality badge (only when has website) */}
                          {b.hasWebsite && (
                            <WebsiteScoreBadge
                              score={b.websiteScore}
                              isOld={b.websiteIsOld}
                              note={b.websiteAgeNote}
                              isCs={isCs}
                            />
                          )}

                          <span className={social ? 'badge-green' : 'badge-red'}>
                            <Users size={10} />
                            {social ? (isCs ? 'Má soc. sítě' : 'Has social') : (isCs ? 'Bez soc. sítí' : 'No social')}
                          </span>
                          {b.rating !== null && b.rating !== undefined && (
                            <span className={(b.rating ?? 5) < 3.5 ? 'badge-red' : b.reviewCount < 10 ? 'badge-yellow' : 'badge-green'}>
                              <Star size={10} />
                              {b.rating.toFixed(1)} ({b.reviewCount} {isCs ? 'rec.' : 'rev.'})
                            </span>
                          )}
                          {b.hasFacebook  && <span className="badge badge-purple">FB</span>}
                          {b.hasInstagram && <span className="badge badge-purple">IG</span>}
                          {b.hasLinkedIn  && <span className="badge badge-purple">LI</span>}
                        </div>
                      </div>

                      {/* Issue list (desktop) */}
                      {problems > 0 && (
                        <div className="hidden lg:block flex-shrink-0 text-right min-w-[130px]">
                          <p className="text-xs font-medium text-ink-faint mb-1">{isCs ? 'Problémy' : 'Issues'}</p>
                          <div className="space-y-0.5">
                            {!b.hasWebsite && <p className="text-xs text-red-600">→ {isCs ? 'Chybí web' : 'No website'}</p>}
                            {b.hasWebsite && b.websiteIsOld && <p className="text-xs text-yellow-600">→ {isCs ? 'Starý web' : 'Old website'}</p>}
                            {!social && <p className="text-xs text-orange-600">→ {isCs ? 'Chybí soc. sítě' : 'No social'}</p>}
                            {b.reviewCount < 10 && <p className="text-xs text-yellow-600">→ {isCs ? 'Málo recenzí' : 'Few reviews'}</p>}
                            {(b.rating ?? 5) < 3.5 && <p className="text-xs text-purple-600">→ {isCs ? 'Nízké hodnocení' : 'Low rating'}</p>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="card text-center py-16 text-ink-faint">
                  <Search size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="mb-3">{t('no_results')}</p>
                  {activeCount(filters) > 0 && (
                    <button onClick={() => setFilters(EMPTY)} className="btn-outline btn-sm mx-auto">
                      {isCs ? 'Zrušit filtry' : 'Clear filters'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {!hasSearched && (
          <div className="card text-center py-16 text-ink-faint border-dashed">
            <Search size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-ink-muted mb-1">
              {isCs ? 'Zadej region a obor výše' : 'Enter region and industry above'}
            </p>
            <p className="text-sm">{isCs ? 'např. Praha + restaurace, nebo Celá ČR + instalatér' : 'e.g. London + restaurant'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
