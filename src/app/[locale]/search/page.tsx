'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, Download, Globe, Users, Star, ExternalLink, Phone, Mail, MapPin, SlidersHorizontal, X } from 'lucide-react';

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
  reviewCount: number;
  rating?: number;
  googleMapsUrl?: string;
}

// Each criterion can be: null = ignore, true = must have, false = must NOT have
interface Filters {
  website:  boolean | null;
  social:   boolean | null;
  reviews:  boolean | null; // true = 10+, false = <10
  rating:   boolean | null; // true = 3.5+, false = <3.5
}

const EMPTY_FILTERS: Filters = { website: null, social: null, reviews: null, rating: null };

function applyFilters(b: BusinessResult, f: Filters): boolean {
  const hasSocial = b.hasFacebook || b.hasInstagram || b.hasLinkedIn;
  if (f.website !== null  && b.hasWebsite !== f.website) return false;
  if (f.social  !== null  && hasSocial    !== f.social)  return false;
  if (f.reviews !== null) {
    const enough = b.reviewCount >= 10;
    if (enough !== f.reviews) return false;
  }
  if (f.rating !== null) {
    const good = (b.rating ?? 0) >= 3.5;
    if (good !== f.rating) return false;
  }
  return true;
}

function activeFilterCount(f: Filters) {
  return Object.values(f).filter(v => v !== null).length;
}

export default function SearchPage() {
  const t = useTranslations('search');
  const locale = useLocale();
  const isCs = locale === 'cs';

  const [region, setRegion]       = useState('');
  const [industry, setIndustry]   = useState('');
  const [filters, setFilters]     = useState<Filters>(EMPTY_FILTERS);
  const [results, setResults]     = useState<BusinessResult[]>([]);
  const [searchId, setSearchId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const filtered = results.filter(b => applyFilters(b, filters));

  const setFilter = <K extends keyof Filters>(key: K, val: boolean | null) => {
    setFilters(prev => ({ ...prev, [key]: prev[key] === val ? null : val }));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!region || !industry) return;
    setLoading(true);
    setError('');
    setResults([]);
    setFilters(EMPTY_FILTERS);
    setHasSearched(true);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, industry }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error'); return; }
      setResults(data.results);
      setSearchId(data.searchId);
    } finally {
      setLoading(false);
    }
  };

  const hasSocial = (b: BusinessResult) => b.hasFacebook || b.hasInstagram || b.hasLinkedIn;
  const problemCount = (b: BusinessResult) => {
    let n = 0;
    if (!b.hasWebsite) n++;
    if (!hasSocial(b)) n++;
    if (b.reviewCount < 10) n++;
    if ((b.rating ?? 5) < 3.5) n++;
    return n;
  };

  // Count of results per filter option (always against full results, not current filtered)
  const count = (key: keyof Filters, val: boolean) =>
    results.filter(b => applyFilters(b, { ...EMPTY_FILTERS, [key]: val })).length;

  type TriBtn = { label: string; count: number; active: boolean; onClick: () => void; color: string };

  const TriButton = ({ label, count: n, active, onClick, color }: TriBtn) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        active
          ? color + ' shadow-sm'
          : 'border-ink/10 text-ink-faint hover:border-ink/20 hover:text-ink-muted bg-white'
      }`}
    >
      {label}
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/30' : 'bg-ink/5'}`}>
        {n}
      </span>
    </button>
  );

  return (
    <div className="min-h-screen bg-surface pt-16">
      {/* Header */}
      <div className="border-b border-ink/5 bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-ink mb-1">{t('title')}</h1>
          <p className="text-ink-muted text-sm">
            {isCs ? 'Najdi firmy bez webu, bez soc. sítí nebo se špatnými recenzemi' : 'Find businesses without website, social media or with poor reviews'}
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
                <input className="input pl-9" placeholder={t('region_placeholder')} value={region}
                  onChange={e => setRegion(e.target.value)} required />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('industry_label')}</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input className="input pl-9" placeholder={t('industry_placeholder')} value={industry}
                  onChange={e => setIndustry(e.target.value)} required />
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
              ) : (
                <><Search size={16} />{t('search_button')}</>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <>
            {/* ── Filter panel ── */}
            <div className="card mb-4 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-ink-faint" />
                  <span className="text-sm font-medium text-ink">
                    {isCs ? 'Filtrovat výsledky' : 'Filter results'}
                  </span>
                  {activeFilterCount(filters) > 0 && (
                    <span className="badge-purple text-[10px]">
                      {activeFilterCount(filters)} {isCs ? 'aktivní' : 'active'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-faint">
                    {isCs
                      ? `${filtered.length} z ${results.length} firem`
                      : `${filtered.length} of ${results.length} businesses`}
                  </span>
                  {activeFilterCount(filters) > 0 && (
                    <button
                      onClick={() => setFilters(EMPTY_FILTERS)}
                      className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink transition-colors"
                    >
                      <X size={12} />
                      {isCs ? 'Resetovat' : 'Reset'}
                    </button>
                  )}
                  {searchId && (
                    <button onClick={() => window.open(`/api/export/${searchId}`, '_blank')}
                      className="btn-outline btn-sm gap-1.5">
                      <Download size={13} />
                      {t('export_excel')}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Website */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Webová stránka' : 'Website'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <TriButton
                      label={isCs ? 'Má web' : 'Has website'}
                      count={count('website', true)}
                      active={filters.website === true}
                      onClick={() => setFilter('website', true)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700"
                    />
                    <TriButton
                      label={isCs ? 'Bez webu' : 'No website'}
                      count={count('website', false)}
                      active={filters.website === false}
                      onClick={() => setFilter('website', false)}
                      color="border-red-300 bg-red-50 text-red-700"
                    />
                  </div>
                </div>

                {/* Social */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Sociální sítě' : 'Social media'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <TriButton
                      label={isCs ? 'Má soc. sítě' : 'Has social'}
                      count={count('social', true)}
                      active={filters.social === true}
                      onClick={() => setFilter('social', true)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700"
                    />
                    <TriButton
                      label={isCs ? 'Bez soc. sítí' : 'No social'}
                      count={count('social', false)}
                      active={filters.social === false}
                      onClick={() => setFilter('social', false)}
                      color="border-red-300 bg-red-50 text-red-700"
                    />
                  </div>
                </div>

                {/* Reviews */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Počet recenzí' : 'Reviews'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <TriButton
                      label={isCs ? '10 a více' : '10 or more'}
                      count={count('reviews', true)}
                      active={filters.reviews === true}
                      onClick={() => setFilter('reviews', true)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700"
                    />
                    <TriButton
                      label={isCs ? 'Méně než 10' : 'Fewer than 10'}
                      count={count('reviews', false)}
                      active={filters.reviews === false}
                      onClick={() => setFilter('reviews', false)}
                      color="border-yellow-300 bg-yellow-50 text-yellow-700"
                    />
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
                    {isCs ? 'Hodnocení' : 'Rating'}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <TriButton
                      label={isCs ? '3.5 a více' : '3.5 or above'}
                      count={count('rating', true)}
                      active={filters.rating === true}
                      onClick={() => setFilter('rating', true)}
                      color="border-emerald-300 bg-emerald-50 text-emerald-700"
                    />
                    <TriButton
                      label={isCs ? 'Pod 3.5' : 'Below 3.5'}
                      count={count('rating', false)}
                      active={filters.rating === false}
                      onClick={() => setFilter('rating', false)}
                      color="border-purple-300 bg-purple-50 text-purple-700"
                    />
                  </div>
                </div>

              </div>

              {/* Active filter summary */}
              {activeFilterCount(filters) > 0 && (
                <div className="mt-3 pt-3 border-t border-ink/5 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-ink-faint">{isCs ? 'Aktivní filtry:' : 'Active filters:'}</span>
                  {filters.website !== null && (
                    <span className={`badge text-xs ${filters.website ? 'badge-green' : 'badge-red'}`}>
                      <Globe size={10} />
                      {filters.website
                        ? (isCs ? 'Má web' : 'Has website')
                        : (isCs ? 'Bez webu' : 'No website')}
                      <button onClick={() => setFilter('website', filters.website!)} className="ml-1 hover:opacity-70"><X size={9} /></button>
                    </span>
                  )}
                  {filters.social !== null && (
                    <span className={`badge text-xs ${filters.social ? 'badge-green' : 'badge-red'}`}>
                      <Users size={10} />
                      {filters.social
                        ? (isCs ? 'Má soc. sítě' : 'Has social')
                        : (isCs ? 'Bez soc. sítí' : 'No social')}
                      <button onClick={() => setFilter('social', filters.social!)} className="ml-1 hover:opacity-70"><X size={9} /></button>
                    </span>
                  )}
                  {filters.reviews !== null && (
                    <span className={`badge text-xs ${filters.reviews ? 'badge-green' : 'badge-yellow'}`}>
                      <Star size={10} />
                      {filters.reviews
                        ? (isCs ? '10+ recenzí' : '10+ reviews')
                        : (isCs ? 'Méně než 10 recenzí' : 'Fewer than 10 reviews')}
                      <button onClick={() => setFilter('reviews', filters.reviews!)} className="ml-1 hover:opacity-70"><X size={9} /></button>
                    </span>
                  )}
                  {filters.rating !== null && (
                    <span className={`badge text-xs ${filters.rating ? 'badge-green' : 'badge-red'}`}>
                      <Star size={10} />
                      {filters.rating
                        ? (isCs ? 'Hodnocení 3.5+' : 'Rating 3.5+')
                        : (isCs ? 'Hodnocení pod 3.5' : 'Rating below 3.5')}
                      <button onClick={() => setFilter('rating', filters.rating!)} className="ml-1 hover:opacity-70"><X size={9} /></button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Results */}
            <div className="space-y-3">
              {filtered.map(b => {
                const problems = problemCount(b);
                return (
                  <div key={b.id} className="card p-0 overflow-hidden hover:shadow-card-hover transition-shadow">
                    <div className="flex items-start gap-4 p-5">
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

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className={b.hasWebsite ? 'badge-green' : 'badge-red'}>
                            <Globe size={10} />
                            {b.hasWebsite ? (isCs ? 'Má web' : 'Has website') : (isCs ? 'Bez webu' : 'No website')}
                          </span>
                          <span className={hasSocial(b) ? 'badge-green' : 'badge-red'}>
                            <Users size={10} />
                            {hasSocial(b) ? (isCs ? 'Má soc. sítě' : 'Has social') : (isCs ? 'Bez soc. sítí' : 'No social')}
                          </span>
                          {b.rating !== null && b.rating !== undefined && (
                            <span className={(b.rating ?? 5) < 3.5 ? 'badge-red' : b.reviewCount < 10 ? 'badge-yellow' : 'badge-green'}>
                              <Star size={10} />
                              {b.rating.toFixed(1)} ({b.reviewCount} {isCs ? 'rec.' : 'rev.'})
                            </span>
                          )}
                          {b.hasFacebook && <span className="badge badge-purple">FB</span>}
                          {b.hasInstagram && <span className="badge badge-purple">IG</span>}
                          {b.hasLinkedIn && <span className="badge badge-purple">LI</span>}
                        </div>
                      </div>

                      {problems > 0 && (
                        <div className="hidden lg:block flex-shrink-0 text-right">
                          <p className="text-xs font-medium text-ink-faint mb-1">{isCs ? 'Problémy' : 'Issues'}</p>
                          <div className="space-y-0.5">
                            {!b.hasWebsite && <p className="text-xs text-red-600">→ {isCs ? 'Chybí web' : 'No website'}</p>}
                            {!hasSocial(b) && <p className="text-xs text-orange-600">→ {isCs ? 'Chybí soc. sítě' : 'No social'}</p>}
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
                  {activeFilterCount(filters) > 0 && (
                    <button onClick={() => setFilters(EMPTY_FILTERS)} className="btn-outline btn-sm mx-auto">
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
            <p className="text-sm">{isCs ? 'např. Praha + restaurace' : 'e.g. London + restaurant'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
