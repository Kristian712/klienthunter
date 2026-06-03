'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Search, Download, Bookmark, Globe, Users, Star } from 'lucide-react';

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

export default function SearchPage() {
  const t = useTranslations('search');
  const locale = useLocale();
  const [region, setRegion] = useState('');
  const [industry, setIndustry] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const filtered = results.filter((b) => {
    if (filter === 'no_website') return !b.hasWebsite;
    if (filter === 'no_social') return !b.hasFacebook && !b.hasInstagram && !b.hasLinkedIn;
    if (filter === 'low_reviews') return b.reviewCount < 10;
    if (filter === 'low_rating') return (b.rating ?? 5) < 3.5;
    return true;
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!region || !industry) return;
    setLoading(true);
    setError('');
    setResults([]);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, industry }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError(locale === 'cs' ? 'Pro vyhledávání se musíte přihlásit.' : 'Please log in to search.');
        } else if (res.status === 403) {
          setError(locale === 'cs' ? 'Dosáhli jste limitu vyhledávání. Upgradujte plán.' : 'Search limit reached. Please upgrade.');
        } else {
          setError(data.error || 'Error');
        }
        return;
      }
      setResults(data.results);
      setSearchId(data.searchId);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!searchId) return;
    window.open(`/api/export/${searchId}`, '_blank');
  };

  const hasSocial = (b: BusinessResult) => b.hasFacebook || b.hasInstagram || b.hasLinkedIn;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('title')}</h1>

      {/* Search form */}
      <form onSubmit={handleSearch} className="card mb-6">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('region_label')}</label>
            <input
              className="input"
              placeholder={t('region_placeholder')}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('industry_label')}</label>
            <input
              className="input"
              placeholder={t('industry_placeholder')}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
            />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary px-8">
          <Search size={16} className="mr-2" />
          {loading ? t('searching') : t('search_button')}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Filters + export */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t(`filter_${f}` as any)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{t('results_count', { count: filtered.length })}</span>
              <button onClick={handleExport} className="btn-secondary text-sm gap-2">
                <Download size={15} />
                {t('export_excel')}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('columns.name')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('columns.phone')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('columns.website')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('columns.social')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('columns.reviews')}</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">{t('columns.rating')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{b.name}</div>
                      {b.address && <div className="text-xs text-gray-400 mt-0.5">{b.address}</div>}
                      {b.email && <div className="text-xs text-primary-600 mt-0.5">{b.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.phone || '–'}</td>
                    <td className="px-4 py-3">
                      {b.hasWebsite ? (
                        <span className="badge-green">
                          <Globe size={11} />
                          {t('has_website')}
                        </span>
                      ) : (
                        <span className="badge-red">
                          <Globe size={11} />
                          {t('no_website')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {hasSocial(b) ? (
                        <span className="badge-green">
                          <Users size={11} />
                          {t('has_social')}
                        </span>
                      ) : (
                        <span className="badge-red">
                          <Users size={11} />
                          {t('no_social')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.reviewCount}</td>
                    <td className="px-4 py-3">
                      {b.rating ? (
                        <span className={b.rating < 3.5 ? 'badge-red' : 'badge-green'}>
                          <Star size={11} />
                          {b.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">{t('no_results')}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
