'use client';

import { useState, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { Search, Users, ExternalLink, Globe, ChevronDown, ChevronUp, Copy, Check, MessageSquare, Zap } from 'lucide-react';
import type { IgLead } from '@/lib/instagram-scraper';

function IgIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  );
}

function generateMessage(lead: IgLead): string {
  return `Ahoj ${lead.fullName} 👋

Narazil jsem na tvůj Instagram – máte super práci!

Jsem Kristián, je mi 17 let a dělám weby na míru. Všiml jsem si, že zatím nemáš vlastní web – přitom může skvěle doplnit tvůj Instagram a přivádět nové zákazníky přímo k tobě.

Rád ti zdarma ukážu jak by mohl vypadat – bez závazků. Stačí napsat 🙏

Kristián · https://webovkyvanek.cz/`;
}

function MessageBox({ lead }: { lead: IgLead }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = generateMessage(lead);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message]);

  return (
    <div className="border-t border-ink/5">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full px-5 py-2.5 text-xs font-medium text-ink-muted hover:text-[#E1306C] hover:bg-pink-50/50 transition-colors">
        <MessageSquare size={13} />
        {open ? 'Skrýt zprávu' : 'Zobrazit zprávu k odeslání'}
        {open ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
      </button>
      {open && (
        <div className="px-5 pb-4">
          <div className="relative bg-surface-subtle rounded-xl border border-ink/5 p-4">
            <pre className="text-xs text-ink-muted whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
            <button onClick={copy}
              className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-ink/10 text-ink-muted hover:text-[#E1306C] hover:border-pink-300 shadow-sm'}`}>
              {copied ? <><Check size={12} /> Zkopírováno!</> : <><Copy size={12} /> Kopírovat</>}
            </button>
          </div>
          <p className="text-[11px] text-ink-faint mt-2">💡 Pošli přes Instagram DM na profil.</p>
        </div>
      )}
    </div>
  );
}

export default function InstagramPage() {
  const [niche, setNiche]         = useState('');
  const [location, setLocation]   = useState('');
  const [leads, setLeads]         = useState<IgLead[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim()) return;
    setLoading(true);
    setError('');
    setLeads([]);
    setHasSearched(true);
    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: niche.trim(), location: location.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error || 'Chyba.'); return; }
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  };

  const activityColor = (label: string) =>
    label === 'Velmi aktivní' ? 'bg-emerald-100 text-emerald-700' :
    label === 'Aktivní' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700';

  return (
    <div className="min-h-screen bg-surface pt-16">
      <div className="border-b border-ink/5 bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ background: 'linear-gradient(135deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)' }}>
              <IgIcon size={18} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Instagram Finder</h1>
          </div>
          <p className="text-ink-muted text-sm">Najde Instagram profily živnostníků a firem bez webu – ideální pro oslovení přes DM.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <form onSubmit={handleSearch} className="card mb-6">
          <div className="grid sm:grid-cols-5 gap-4 items-end">
            <div className="sm:col-span-2">
              <label className="label"><IgIcon /> Obor / profese</label>
              <input className="input" placeholder="kadeřník, fotograf, kosmetika…" value={niche} onChange={e => setNiche(e.target.value)} required />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Město (volitelné)</label>
              <input className="input" placeholder="Praha, Brno, Ostrava…" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <button type="submit" disabled={loading || !niche.trim()} className="h-[42px] px-5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
              {loading ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Hledám…</>
                : <><Search size={15} />Hledat</>}
            </button>
          </div>
          {loading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[#dc2743] bg-pink-50 border border-pink-200 rounded-xl px-4 py-3">
              <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              Hledám profily a kontroluji weby… může trvat 30–60 sekund.
            </div>
          )}
        </form>

        {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>}

        {leads.length > 0 && (
          <>
            <div className="mb-4">
              <p className="text-sm text-ink-muted">
                Z <strong className="text-ink">{total}</strong> profilů nemá web <strong className="text-ink">{leads.length}</strong> — seřazeno podle počtu followerů
              </p>
            </div>
            <div className="space-y-3">
              {leads.map((lead, i) => (
                <div key={i} className="card p-0 overflow-hidden hover:shadow-card-hover transition-shadow">
                  <div className="flex items-start gap-4 p-5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 text-sm font-bold"
                      style={{ background: 'linear-gradient(135deg, #f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
                      <IgIcon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-ink">{lead.fullName}</h3>
                          <p className="text-xs text-ink-faint">@{lead.username}</p>
                        </div>
                        <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-pink-50 text-[#dc2743] hover:bg-pink-100 transition-colors">
                          <IgIcon size={11} /> Profil <ExternalLink size={10} />
                        </a>
                      </div>
                      {lead.biography && (
                        <p className="text-xs text-ink-faint mt-1 line-clamp-2">{lead.biography}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <span className="badge-red"><Globe size={10} /> Bez webu</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${activityColor(lead.activityLabel)}`}>
                          <Zap size={10} /> {lead.activityLabel}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-ink/5 text-ink-muted">
                          <Users size={10} /> {lead.followers.toLocaleString('cs-CZ')} followerů
                        </span>
                      </div>
                    </div>
                  </div>
                  <MessageBox lead={lead} />
                </div>
              ))}
            </div>
          </>
        )}

        {hasSearched && !loading && !error && leads.length === 0 && total > 0 && (
          <div className="card text-center py-16 text-ink-faint">
            <IgIcon size={40} />
            <p className="font-medium text-ink-muted mt-3 mb-1">Všechny profily mají web</p>
            <p className="text-sm">Zkus jiný obor nebo vynech město.</p>
          </div>
        )}

        {!hasSearched && (
          <div className="card text-center py-16 text-ink-faint border-dashed">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg, #f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
              <IgIcon size={28} />
            </div>
            <p className="font-medium text-ink-muted mb-1">Zadej obor výše</p>
            <p className="text-sm">např. <strong className="text-ink">kadeřník</strong> + <strong className="text-ink">Praha</strong></p>
          </div>
        )}
      </div>
    </div>
  );
}
