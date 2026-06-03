'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, Download, Globe, Users, Star, ExternalLink, Phone, Mail, MapPin, SlidersHorizontal } from 'lucide-react';

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

const FILTERS = ['all', 'no_website', 'no_social', 'low_reviews', 'low_rating'] as const;
type Filter = typeof FILTERS[number];

const FILTER_LABELS: Record<Filter, { cs: string; en: string; color: string }> = {
  all:         { cs: 'Všechny', en: 'All', color: 'bg-ink/5 text-ink hover:bg-ink/10' },
  no_website:  { cs: 'Bez webu', en: 'No website', color: 'bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-200' },
  no_social:   { cs: 'Bez soc. sítí', en: 'No social', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100 ring-1 ring-orange-200' },
  low_reviews: { cs: 'Málo recenzí', en: 'Few reviews', color: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 ring-1 ring-yellow-200' },
  low_rating:  { cs: 'Nízké hodnocení', en: 'Low rating', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100 ring-1 ring-purple-200' },
};

export default function SearchPage() {
  const t = useTranslations('search');
  const locale = useLocale();
  const isCs = locale === 'cs';

  const [region, setRegion]     = useState('');
  const [industry, setIndustry] = useState('');
  const [filter, setFilter]     = useState<Filter>('all');
  const [results, setResults]   = useState<BusinessResult[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const filtered = results.filter(b => {
    if (filter === 'no_website')  return !b.hasWebsite;
    if (filter === 'no_social')   return !b.hasFacebook && !b.hasInstagram && !b.hasLinkedIn;
    if (filter === 'low_reviews') return b.reviewCount < 10;
    if (filter === 'low_rating')  return (b.rating ?? 5) < 3.5;
    return true;
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!region || !industry) return;
    setLoading(true);
    setError('');
    setResults([]);
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
                <input
                  className="input pl-9"
                  placeholder={t('region_placeholder')}
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('industry_label')}</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  className="input pl-9"
                  placeholder={t('industry_placeholder')}
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  required
                />
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
            {/* Filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <SlidersHorizontal size={15} className="text-ink-faint" />
                {FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filter === f
                        ? 'bg-brand-600 text-white shadow-sm'
                        : FILTER_LABELS[f].color
                    }`}
                  >
                    {isCs ? FILTER_LABELS[f].cs : FILTER_LABELS[f].en}
                    {f !== 'all' && (
                      <span className="ml-1 opacity-60">
                        ({results.filter(b => {
                          if (f === 'no_website')  return !b.hasWebsite;
                          if (f === 'no_social')   return !b.hasFacebook && !b.hasInstagram && !b.hasLinkedIn;
                          if (f === 'low_reviews') return b.reviewCount < 10;
                          if (f === 'low_rating')  return (b.rating ?? 5) < 3.5;
                          return true;
                        }).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-ink-faint">
                  {t('results_count', { count: filtered.length })}
                </span>
                {searchId && (
                  <button
                    onClick={() => window.open(`/api/export/${searchId}`, '_blank')}
                    className="btn-outline btn-sm gap-1.5"
                  >
                    <Download size={13} />
                    {t('export_excel')}
                  </button>
                )}
              </div>
            </div>

            {/* Results */}
            <div className="space-y-3">
              {filtered.map(b => {
                const problems = problemCount(b);
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

                      {/* Main info */}
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

                        {/* Contact row */}
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

                        {/* Badge row */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className={b.hasWebsite ? 'badge-green' : 'badge-red'}>
                            <Globe size={10} />
                            {b.hasWebsite ? (isCs ? 'Má web' : 'Has website') : (isCs ? 'Bez webu' : 'No website')}
                          </span>
                          <span className={hasSocial(b) ? 'badge-green' : 'badge-red'}>
                            <Users size={10} />
                            {hasSocial(b)
                              ? (isCs ? 'Má soc. sítě' : 'Has social')
                              : (isCs ? 'Bez soc. sítí' : 'No social')}
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

                      {/* Problem hint */}
                      {problems > 0 && (
                        <div className="hidden lg:block flex-shrink-0 text-right">
                          <p className="text-xs font-medium text-ink-faint mb-1">
                            {isCs ? 'Problémy' : 'Issues'}
                          </p>
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
                  <p>{t('no_results')}</p>
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
            <p className="text-sm">
              {isCs ? 'např. Praha + restaurace' : 'e.g. London + restaurant'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
