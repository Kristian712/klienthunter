'use client';

import { useState, useCallback, useEffect } from 'react';
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
            💡 Zkopíruj a pošli přes Facebook Messenger.
          </p>
        </div>
      )}
    </div>
  );
}

type Step = 'url' | 'paste' | 'results';

export default function FacebookFinderPage() {
  const locale = useLocale();

  const [step, setStep]               = useState<Step>('url');
  const [groupUrl, setGroupUrl]       = useState('');
  const [fbUrl, setFbUrl]             = useState('');
  const [pastedJson, setPastedJson]   = useState('');
  const [leads, setLeads]             = useState<FbLead[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [snippetCopied, setSnippetCopied] = useState(false);

  useEffect(() => {
    if (!groupUrl.trim()) { setFbUrl(''); return; }
    let slug = groupUrl.trim()
      .replace(/^https?:\/\/(www\.|m\.|mbasic\.)?facebook\.com\/groups\//i, '')
      .replace(/^https?:\/\/fb\.com\/groups\//i, '')
      .replace(/[/?#].*$/, '');
    setFbUrl(slug ? `https://www.facebook.com/groups/${slug}` : '');
  }, [groupUrl]);

  // JS snippet that runs in Facebook group page console and copies member data
  const jsSnippet = `(function(){const r=new Map();document.querySelectorAll('a[href*="facebook.com/"][role="link"],h2 a[href*="facebook.com"],h3 a[href*="facebook.com"],strong a[href*="facebook.com"]').forEach(el=>{const n=(el.innerText||'').trim();const h=el.href||'';if(!n||n.length<3||n.length>80)return;if(h.includes('/groups/')||h.includes('/events/')||h.includes('/hashtag/'))return;try{const k=new URL(h).pathname;const e=r.get(k);e?e.count++:r.set(k,{name:n,url:h,count:1});}catch(e){}});const d=JSON.stringify([...r.values()]);navigator.clipboard.writeText(d).then(()=>alert('Hotovo! Zkopírováno '+r.size+' lidí. Vrať se na KlientHunter a vlož výsledek.'));})();`;

  const copySnippet = useCallback(async () => {
    await navigator.clipboard.writeText(jsSnippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 3000);
  }, [jsSnippet]);

  const goToPaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (fbUrl) setStep('paste');
  };

  const analyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedJson.trim()) return;
    setLoading(true);
    setError('');
    try {
      let data: Array<{name: string; url: string; count?: number}>;
      try { data = JSON.parse(pastedJson); }
      catch { setError('Neplatný formát — vlož přesně to co skript zkopíroval do schránky.'); setLoading(false); return; }

      const res = await fetch('/api/facebook-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const result = await res.json();
      if (!res.ok || result.error) { setError(result.error || 'Chyba.'); return; }
      setLeads(result.leads ?? []);
      setTotal(result.total ?? 0);
      setStep('results');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface pt-16">

      {/* Header */}
      <div className="border-b border-ink/5 bg-surface">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1877F2] text-white shadow-sm">
              <FbIcon size={18} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Facebook Finder</h1>
          </div>
          <p className="text-ink-muted text-sm">
            Najde lidi ve Facebook skupině, kteří nemají web — ideální klienti pro tvorbu webu.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          {(['url', 'paste', 'results'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                step === s ? 'bg-[#1877F2] text-white' :
                (['url','paste','results'].indexOf(step) > i) ? 'bg-emerald-500 text-white' :
                'bg-ink/10 text-ink-faint'
              }`}>{i + 1}</div>
              <span className={step === s ? 'text-ink font-medium' : 'text-ink-faint'}>
                {s === 'url' ? 'Odkaz na skupinu' : s === 'paste' ? 'Vložit zdroják' : 'Výsledky'}
              </span>
              {i < 2 && <span className="text-ink-faint mx-1">→</span>}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Enter group URL ── */}
        {step === 'url' && (
          <form onSubmit={goToPaste} className="card">
            <h2 className="font-semibold text-ink mb-1">Krok 1 — Zadej odkaz na skupinu</h2>
            <p className="text-sm text-ink-muted mb-4">
              Zkopíruj URL z adresního řádku, když máš skupinu otevřenou.
            </p>
            <input
              className="input mb-3"
              placeholder="facebook.com/groups/nazevskupiny"
              value={groupUrl}
              onChange={e => setGroupUrl(e.target.value)}
              required
            />
            {fbUrl && (
              <div className="bg-surface-subtle rounded-xl px-4 py-3 mb-4 text-sm">
                <p className="text-ink-faint text-xs mb-1">Budeme pracovat s touto adresou:</p>
                <code className="text-brand-600 break-all text-xs">{fbUrl}</code>
              </div>
            )}
            <button
              type="submit"
              disabled={!fbUrl}
              className="h-[42px] px-5 rounded-xl font-semibold text-sm text-white flex items-center gap-2 disabled:opacity-50"
              style={{ backgroundColor: '#1877F2' }}
            >
              Pokračovat →
            </button>
          </form>
        )}

        {/* ── STEP 2: Console snippet + paste JSON ── */}
        {step === 'paste' && (
          <form onSubmit={analyze} className="space-y-4">
            <div className="card">
              <h2 className="font-semibold text-ink mb-3">Krok 2 — Spusť skript v konzoli a vlož výsledek</h2>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-subtle">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center">1</span>
                  <div>
                    <p className="text-sm font-medium text-ink">Otevři skupinu v prohlížeči</p>
                    <a href={fbUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-[#1877F2] hover:underline">
                      <ExternalLink size={11} /> {fbUrl}
                    </a>
                    <p className="text-xs text-ink-faint mt-0.5">Musíš být přihlášen a člen skupiny.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-subtle">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center">2</span>
                  <div>
                    <p className="text-sm font-medium text-ink">Otevři konzoli prohlížeče</p>
                    <p className="text-xs text-ink-faint mt-0.5">
                      <strong>Mac:</strong> Cmd+Option+J &nbsp;|&nbsp; <strong>Windows:</strong> Ctrl+Shift+J
                    </p>
                    <p className="text-xs text-ink-faint">Otevře se záložka Console v DevTools.</p>
                  </div>
                </div>

                {/* Step 3 — copy snippet */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-subtle">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center">3</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink mb-2">Zkopíruj a vlož tento kód do konzole, stiskni Enter</p>
                    <div className="relative">
                      <pre className="bg-gray-900 text-green-400 rounded-xl p-3 text-[10px] overflow-x-auto whitespace-pre-wrap break-all leading-relaxed font-mono">
                        {jsSnippet}
                      </pre>
                      <button
                        type="button"
                        onClick={copySnippet}
                        className={`absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          snippetCopied ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {snippetCopied ? <><Check size={11} /> Zkopírováno</> : <><Copy size={11} /> Kopírovat</>}
                      </button>
                    </div>
                    <p className="text-xs text-ink-faint mt-1.5">
                      Po spuštění se zobrazí dialog "Hotovo!" a data se zkopírují do schránky.
                    </p>
                  </div>
                </div>

                {/* Step 4 — paste result */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-subtle">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1877F2] text-white text-xs font-bold flex items-center justify-center">4</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ink mb-2">Vlož výsledek sem (Cmd+V / Ctrl+V)</p>
                    <textarea
                      className="input font-mono text-xs resize-none"
                      rows={4}
                      placeholder='[{"name":"Jan Novák","url":"https://www.facebook.com/jan.novak","count":1},...]'
                      value={pastedJson}
                      onChange={e => setPastedJson(e.target.value)}
                      required
                    />
                    {pastedJson.trim().startsWith('[') && (
                      <p className="text-[11px] text-emerald-600 mt-1">✓ Vypadá dobře</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={loading || !pastedJson.trim()}
                className="h-[42px] px-6 rounded-xl font-semibold text-sm text-white flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: '#1877F2' }}>
                {loading ? (
                  <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg> Analyzuji…</>
                ) : <><Search size={15} /> Najít lidi bez webu</>}
              </button>
              <button type="button" onClick={() => { setStep('url'); setPastedJson(''); setError(''); }}
                className="btn-outline h-[42px]">← Zpět</button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Results ── */}
        {step === 'results' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-ink-muted">
                  Z <strong className="text-ink">{total}</strong> přispěvatelů nemá web{' '}
                  <strong className="text-ink">{leads.length}</strong>
                </p>
              </div>
              <button
                onClick={() => { setStep('url'); setLeads([]); setPastedJson(''); setGroupUrl(''); }}
                className="btn-outline btn-sm"
              >
                Nové hledání
              </button>
            </div>

            {leads.length === 0 ? (
              <div className="card text-center py-16 text-ink-faint">
                <Users size={40} className="mx-auto mb-3 opacity-20" />
                <p className="font-medium text-ink-muted mb-1">Všichni přispěvatelé mají web</p>
                <p className="text-sm">Zkus jinou skupinu.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map((lead, i) => (
                  <div key={i} className="card p-0 overflow-hidden hover:shadow-card-hover transition-shadow">
                    <div className="flex items-start gap-4 p-5">
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#1877F2]/10 text-[#1877F2]">
                          <Zap size={16} />
                        </div>
                        <span className="text-[10px] text-ink-faint">#{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-ink">{lead.name}</h3>
                          <a
                            href={lead.facebookPageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition-colors"
                          >
                            <FbIcon size={11} /> Profil <ExternalLink size={10} />
                          </a>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <Globe size={10} /> Bez webu
                          </span>
                          {lead.postCount > 1 && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-ink/5 text-ink-muted">
                              <Users size={10} /> {lead.postCount}× přispěl
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <MessageBox lead={lead} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
