'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import { Search, Phone, MapPin, ExternalLink, Globe } from 'lucide-react';
import type { FirmyLead } from '@/lib/firmy-scraper';

export default function FirmyPage() {
  const locale = useLocale();

  const [query, setQuery]         = useState('');
  const [region, setRegion]       = useState('');
  const [leads, setLeads]         = useState<FirmyLead[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setLeads([]);
    setHasSearched(true);
    try {
      const res = await fetch('/api/firmy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), region: region.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'Chyba.'); return; }
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface pt-16">
      <div className="border-b border-ink/5 bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Firmy.cz Finder</h1>
          <p className="text-ink-muted text-sm">Prohledá Firmy.cz a najde firmy bez webu – výrazně více výsledků než Google Maps.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <form onSubmit={handleSearch} className="card mb-6">
          <div className="grid sm:grid-cols-5 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="label"><Search size={13} className="inline mr-1" />Obor / profese</label>
              <input className="input" placeholder="instalatér, kadeřník, elektrikář…" value={query} onChange={e => setQuery(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label"><MapPin size={13} className="inline mr-1" />Město / region</label>
              <input className="input" placeholder="Praha, Brno, Ostrava…" value={region} onChange={e => setRegion(e.target.value)} />
            </div>
            <button type="submit" disabled={loading || !query.trim()} className="btn-primary h-[42px]">
              {loading ? <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Hledám…</span>
                : <><Search size={16} />Hledat</>}
            </button>
          </div>
          {loading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-brand-600 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
              <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              Prohledávám 3 stránky Firmy.cz… chvíli počkej.
            </div>
          )}
        </form>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>}

        {leads.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm text-ink-muted">
                Z <strong className="text-ink">{total}</strong> firem nemá web <strong className="text-ink">{leads.length}</strong> — seřazeno abecedně
              </p>
            </div>
            <div className="space-y-3">
              {leads.map((lead, i) => (
                <div key={i} className="card p-0 overflow-hidden hover:shadow-card-hover transition-shadow">
                  <div className="flex items-start gap-4 p-5">
                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-sm shrink-0">
                      <Globe size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-ink">{lead.name}</h3>
                        <a href={lead.firmyUrl} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 btn-ghost btn-sm p-1.5" title="Otevřít na Firmy.cz">
                          <ExternalLink size={13} />
                        </a>
                      </div>
                      {lead.address && (
                        <p className="text-xs text-ink-faint mt-0.5 flex items-center gap-1">
                          <MapPin size={11} />{lead.address}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-xs text-ink-muted hover:text-brand-600 transition-colors">
                            <Phone size={11} />{lead.phone}
                          </a>
                        )}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <span className="badge-red"><Globe size={10} /> Bez webu</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {hasSearched && !loading && !error && leads.length === 0 && total > 0 && (
          <div className="card text-center py-16 text-ink-faint">
            <Globe size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-ink-muted mb-1">Všechny nalezené firmy mají web</p>
            <p className="text-sm">Zkus jiný obor nebo region.</p>
          </div>
        )}

        {!hasSearched && (
          <div className="card text-center py-16 text-ink-faint border-dashed">
            <Search size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-ink-muted mb-1">Zadej obor a město výše</p>
            <p className="text-sm">např. <strong className="text-ink">instalatér</strong> + <strong className="text-ink">Praha</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}
