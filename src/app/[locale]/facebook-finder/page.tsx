'use client';

import { useState, useCallback } from 'react';
import { useLocale } from 'next-intl';
import {
  Search, Globe, Users, ExternalLink,
  Copy, Check, ChevronDown, ChevronUp, MessageSquare, Zap,
} from 'lucide-react';
import type { FbLead } from '@/lib/facebook-scraper';

function FbIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function generateMessage(lead: FbLead): string {
  return `Dobrý den, ${lead.name} 👋

Zaujalo mě vaše aktivní působení ve facebookové skupině – vidím, že v oboru opravdu makáte.

Jsem Kristián, je mi 17 let a dělám weby na míru – moderní, rychlé, dobře vypadající na mobilu i počítači.

Všiml jsem si, že zatím web nemáte. Přitom může být web jeden z nejlepších způsobů jak oslovit nové zákazníky. Rád vám zdarma ukážu, jak by mohl vypadat – bez jakýchkoliv závazků.

A pokud web teď nepotřebujete, ale napadne vás někdo komu by se hodil – budu za doporučení moc vděčný 🙏

Kristián · https://webovkyvanek.cz/`;
}

function MessageBox({ lead }: { lead: FbLead }) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const message = generateMessage(lead);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message]);

  return (
    <div className="border-t border-ink/5">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full px-5 py-2.5 text-xs font-medium text-ink-muted hover:text-[#1877F2] hover:bg-blue-50/50 transition-colors"
      >
        <MessageSquare size={13} />
        {open ? 'Skrýt zprávu' : 'Zobrazit zprávu k odeslání'}
        {open ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
      </button>

      {open && (
        <div className="px-5 pb-4">
          <div className="relative bg-surface-subtle rounded-xl border border-ink/5 p-4">
            <pre className="text-xs text-ink-muted whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
            <button
              onClick={copy}
              className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-white border border-ink/10 text-ink-muted hover:text-[#1877F2] hover:border-blue-300 shadow-sm'
              }`}
            >
              {copied
                ? <span className="flex items-center gap-1"><Check size={12} /> Zkopírováno!</span>
                : <span className="flex items-center gap-1"><Copy size={12} /> Kopírovat</span>}
            </button>
          </div>
          <p className="text-[11px] text-ink-faint mt-2">
            💡 Zkopíruj a pošli přes Facebook Messenger přímo na profil.
          </p>
        </div>
      )}
    </div>
  );
}

export default function FacebookFinderPage() {
  const locale = useLocale();

  const [groupInput, setGroupInput]   = useState('');
  const [leads, setLeads]             = useState<FbLead[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [cookiesSet, setCookiesSet]   = useState<boolean | null>(null);

  // Check if FB cookies are configured
  useState(() => {
    fetch('/api/profile/facebook-cookies')
      .then(r => r.json())
      .then(d => setCookiesSet(d.connected ?? false));
  });

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupInput.trim()) return;
    setLoading(true);
    setError('');
    setLeads([]);
    setHasSearched(true);
    try {
      const res = await fetch('/api/facebook-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupInput: groupInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 401 ? 'Přihlaste se prosím.' : data.error || 'Chyba.');
        return;
      }
      if (data.error) { setError(data.error); return; }
      setLeads(data.leads ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface pt-16">

      {/* ── Header ── */}
      <div className="border-b border-ink/5 bg-surface">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1877F2] text-white shadow-sm">
              <FbIcon size={18} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Facebook Finder</h1>
          </div>
          <p className="text-ink-muted text-sm">
            Zadej obor a město — najdeme Facebook stránky podnikatelů v tomto oboru, kteří zatím nemají web.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* ── Cookies missing banner ── */}
        {cookiesSet === false && (
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 px-4 py-3 mb-5 flex items-center justify-between gap-3">
            <p className="text-sm text-yellow-800">
              Pro vyhledávání v Facebook skupinách je potřeba nastavit <strong>Facebook cookies</strong>.
            </p>
            <a href={`/${locale}/profile`} className="shrink-0 text-xs font-semibold text-yellow-800 underline underline-offset-2">
              Nastavit v Profilu →
            </a>
          </div>
        )}

        {/* ── Search form ── */}
        <form onSubmit={handleSearch} className="card mb-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label"><FbIcon /> Odkaz nebo název skupiny</label>
              <input
                className="input"
                placeholder="facebook.com/groups/nazevskupiny"
                value={groupInput}
                onChange={e => setGroupInput(e.target.value)}
                required
              />
              <p className="text-[11px] text-ink-faint mt-1.5">
                Funguje pro skupiny, do kterých máš přístup přes svůj Facebook účet.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !groupInput.trim() || cookiesSet === false}
              className="shrink-0 h-[42px] px-5 rounded-xl font-semibold text-sm text-white flex items-center gap-2 transition-all disabled:opacity-50"
              style={{ backgroundColor: '#1877F2' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Načítám…
                </>
              ) : (
                <><Search size={15} /> Hledat</>
              )}
            </button>
          </div>

          {loading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-[#1877F2] bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Načítám členy skupiny a kontroluji profily… může trvat 30–60 sekund.
            </div>
          )}
        </form>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4">
            {error}
          </div>
        )}

        {/* ── Results ── */}
        {leads.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-ink-muted">
                Nalezeno <strong className="text-ink">{leads.length}</strong> přispěvatelů bez webu – seřazeno podle aktivity
              </span>
            </div>

            <div className="space-y-3">
              {leads.map((lead, i) => (
                <div key={i} className="card p-0 overflow-hidden hover:shadow-card-hover transition-shadow">
                  <div className="flex items-start gap-4 p-5">

                    {/* Rank + activity circle */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        lead.activityScore >= 80 ? 'bg-emerald-100 text-emerald-600' :
                        lead.activityScore >= 55 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        <Zap size={16} />
                      </div>
                      <span className="text-[10px] text-ink-faint font-medium">#{i + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + FB link */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-ink">{lead.name}</h3>
                        <a
                          href={lead.facebookPageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Otevřít Facebook profil"
                          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition-colors"
                        >
                          <FbIcon size={11} /> Profil <ExternalLink size={10} />
                        </a>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        {/* No website */}
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <Globe size={10} /> Bez webu
                        </span>

                        {/* Activity */}
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          lead.activityScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          lead.activityScore >= 55 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          <Zap size={10} /> {lead.activityLabel}
                        </span>

                        {/* Post count */}
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-ink/5 text-ink-muted">
                          <Users size={10} />
                          {lead.postCount} {lead.postCount === 1 ? 'příspěvek' : lead.postCount < 5 ? 'příspěvky' : 'příspěvků'} ve skupině
                        </span>

                        {/* Page badge */}
                        {lead.isPage && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#1877F2]/10 text-[#1877F2]">
                            <FbIcon size={10} /> Firemní stránka
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <MessageBox lead={lead} />
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── No results after search ── */}
        {hasSearched && !loading && !error && leads.length === 0 && (
          <div className="card text-center py-16 text-ink-faint">
            <Users size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-ink-muted mb-1">Žádní přispěvatelé bez webu nenalezeni</p>
            <p className="text-sm">Zkus jinou skupinu, nebo skupina může být soukromá.</p>
          </div>
        )}

        {/* ── Initial empty state ── */}
        {!hasSearched && (
          <div className="card text-center py-16 text-ink-faint border-dashed">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1877F2]/10 mx-auto mb-4">
              <FbIcon size={28} />
            </div>
            <p className="font-medium text-ink-muted mb-1">Zadej odkaz na Facebook skupinu</p>
            <p className="text-sm max-w-sm mx-auto">
              např. <strong className="text-ink">facebook.com/groups/instalateriprahaaoko</strong> — najdeme členy bez webu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
