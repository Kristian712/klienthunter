'use client';

import { useEffect, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { KanbanSquare, Phone, Mail, Globe, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/lead-tags';
import { formatDate } from '@/lib/format-date';

/**
 * Nástěnka označených firem — Osloveno · Jedná se · Klient, Nezájem sbalené dole.
 *
 * Karta se přetáhne myší (HTML5 drag & drop, bez knihovny) nebo přepne šipkami na dotyku;
 * obojí volá tentýž PUT /api/leads/[id]/tag jako přepínač stavu u řádku výsledků, takže
 * hledání a nástěnka říkají o firmě totéž. Přesun je optimistický: karta skočí hned, při
 * chybě se vrátí a řekne proč.
 */
export interface PipelineCard {
  id: string; status: string; note: string | null; updatedAt: string;
  name: string; phone: string | null; email: string | null; website: string | null; address: string | null;
  ico: string | null; score: number; searchId: string; searchLabel: string;
}

const COLUMNS: LeadStatus[] = ['contacted', 'talking', 'client'];

const T = {
  title:  { cs: 'Nástěnka', sk: 'Nástenka', en: 'Pipeline' },
  lead:   { cs: 'Firmy, které jste si označili, napříč všemi hledáními. Přetáhněte kartu do dalšího sloupce.',
            sk: 'Firmy, ktoré ste si označili, naprieč všetkými hľadaniami. Presuňte kartu do ďalšieho stĺpca.',
            en: 'Firms you tagged, across all searches. Drag a card to the next column.' },
  empty:  { cs: 'Zatím prázdné. Označte firmu ve výsledcích jako „Osloveno" a objeví se tady.',
            sk: 'Zatiaľ prázdne. Označte firmu vo výsledkoch ako „Oslovené" a objaví sa tu.',
            en: 'Empty so far. Tag a firm in the results as “Contacted” and it appears here.' },
  rejected: { cs: 'Nezájem', sk: 'Nezáujem', en: 'Not interested' },
  drop:   { cs: 'Sem přetáhnout', sk: 'Sem presunúť', en: 'Drop here' },
  err:    { cs: 'Přesun se nepovedl, karta je zpátky.', sk: 'Presun sa nepodaril, karta je späť.', en: 'The move failed; the card is back.' },
  loadFailed: { cs: 'Nástěnku se teď nepodařilo načíst. Vaše značky jsou v pořádku — obnovte stránku.',
                sk: 'Nástenku sa teraz nepodarilo načítať. Vaše značky sú v poriadku — obnovte stránku.',
                en: 'The board could not be loaded right now. Your tags are safe — reload the page.' },
  moveBack: { cs: 'Zpět do', sk: 'Späť do', en: 'Back to' },
  rejectDrop: { cs: 'Sem přetáhněte firmu, která nemá zájem', sk: 'Sem presuňte firmu, ktorá nemá záujem', en: 'Drop a firm that is not interested here' },
  fromSearch: { cs: 'z hledání', sk: 'z hľadania', en: 'from search' },
  moveTo: { cs: 'Přesunout do', sk: 'Presunúť do', en: 'Move to' },
};

export function Pipeline({ locale }: { locale: string }) {
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  const [cards, setCards] = useState<PipelineCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState('');
  const [over, setOver] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  useEffect(() => {
    fetch('/api/pipeline')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(d => setCards(d.cards ?? []))
      .catch(err => { console.error('pipeline:', err); setFailed(true); });
  }, []);

  const move = async (id: string, status: LeadStatus) => {
    if (!cards) return;
    const before = cards;
    const card = cards.find(c => c.id === id);
    if (!card || card.status === status) return;
    setError('');
    setCards(cards.map(c => (c.id === id ? { ...c, status, updatedAt: new Date().toISOString() } : c)));
    try {
      const res = await fetch(`/api/leads/${id}/tag`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: card.note ?? undefined }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch (err) {
      console.error('pipeline/move:', err);
      setCards(before);
      setError(t(T.err));
    }
  };

  const onDrop = (e: DragEvent, status: LeadStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/kh-lead');
    setOver(null);
    if (id) void move(id, status);
  };

  if (failed) {
    return (
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <span className="icon-tile icon-tile--reach h-7 w-7"><KanbanSquare size={14} /></span>{t(T.title)}
        </h2>
        <p className="text-sm text-ink-muted">{t(T.loadFailed)}</p>
      </div>
    );
  }
  if (!cards) return null;

  const head = (
    <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
      <span className="icon-tile icon-tile--reach h-7 w-7"><KanbanSquare size={14} /></span>{t(T.title)}
    </h2>
  );

  if (cards.length === 0) {
    return (
      <div className="card mb-6">
        {head}
        <p className="text-sm text-ink-muted">{t(T.empty)}</p>
      </div>
    );
  }

  const rejected = cards.filter(c => c.status === 'rejected');

  return (
    <div className="card mb-6">
      {head}
      <p className="text-xs text-ink-faint mb-4">{t(T.lead)}</p>
      {error && <p className="mb-3 text-sm font-medium border border-ink px-3 py-2">{error}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map(status => {
          const def = LEAD_STATUSES.find(s => s.id === status)!;
          const list = cards.filter(c => c.status === status);
          return (
            <section
              key={status}
              onDragOver={e => { e.preventDefault(); if (over !== status) setOver(status); }}
              onDragLeave={() => setOver(null)}
              onDrop={e => onDrop(e, status)}
              className={`rounded-xl border p-2 min-h-[8rem] transition-colors ${over === status ? 'border-accent bg-accent/5' : 'border-line bg-surface'}`}
            >
              <header className="flex items-center gap-2 px-1.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: def.color }} />
                {localized(def.label, locale)}
                <span className="tnum ml-auto text-ink-faint">{list.length}</span>
              </header>
              <div className="space-y-2">
                {list.map(c => (
                  <article
                    key={c.id}
                    draggable
                    onDragStart={e => { e.dataTransfer.setData('text/kh-lead', c.id); e.dataTransfer.effectAllowed = 'move'; }}
                    className="rounded-lg border border-line bg-surface-subtle p-3 text-sm shadow-card cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/${locale}/search?search=${c.searchId}`} className="font-medium leading-snug hover:text-accent transition-colors">{c.name}</Link>
                      <span className="tnum shrink-0 text-xs font-bold text-ink-faint">{c.score}</span>
                    </div>
                    {c.address && <p className="text-[11px] text-ink-faint truncate mt-0.5">{c.address}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 font-mono text-ink hover:underline"><Phone size={10} />{c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-ink-muted hover:text-ink truncate max-w-[12rem]"><Mail size={10} />{c.email}</a>}
                      {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-ink-muted hover:text-ink"><Globe size={10} />web</a>}
                    </div>
                    {c.note && <p className="mt-2 text-[11px] text-ink-muted border-l-2 border-line pl-2 leading-snug">{c.note}</p>}
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink-faint">
                      <span className="truncate">{t(T.fromSearch)} {c.searchLabel} · {formatDate(c.updatedAt, locale)}</span>
                      {/* Dotyk drag & drop neumí: šipky posunou kartu o sloupec zpět nebo dál, 36 px na prst. */}
                      <span className="flex shrink-0 gap-1">
                        {COLUMNS.indexOf(status) > 0 && (
                          <button type="button" onClick={() => move(c.id, COLUMNS[COLUMNS.indexOf(status) - 1])}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line hover:border-ink hover:text-ink"
                            aria-label={`${t(T.moveBack)} ${localized(LEAD_STATUSES.find(s => s.id === COLUMNS[COLUMNS.indexOf(status) - 1])!.label, locale)}`}>
                            <ChevronLeft size={14} />
                          </button>
                        )}
                        {COLUMNS.indexOf(status) < COLUMNS.length - 1 && (
                          <button type="button" onClick={() => move(c.id, COLUMNS[COLUMNS.indexOf(status) + 1])}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line hover:border-ink hover:text-ink"
                            aria-label={`${t(T.moveTo)} ${localized(LEAD_STATUSES.find(s => s.id === COLUMNS[COLUMNS.indexOf(status) + 1])!.label, locale)}`}>
                            <ChevronRight size={14} />
                          </button>
                        )}
                        <button type="button" onClick={() => move(c.id, 'rejected')}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line hover:border-ink hover:text-ink"
                          aria-label={`${t(T.moveTo)} ${t(T.rejected)}`} title={t(T.rejected)}>
                          <X size={14} />
                        </button>
                      </span>
                    </div>
                  </article>
                ))}
                {list.length === 0 && (
                  <p className="px-1.5 py-6 text-center text-[11px] text-ink-faint">{t(T.drop)}</p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Nezájem: vždycky jako místo k přetažení, i prázdné — dřív se sloupec ukázal až s první kartou,
          takže první firmu tam z nástěnky nešlo dostat. */}
      <div className={`mt-3 rounded-xl border border-dashed p-3 transition-colors ${over === 'rejected' ? 'border-accent bg-accent/5' : 'border-line'}`}
           onDragOver={e => { e.preventDefault(); if (over !== 'rejected') setOver('rejected'); }}
           onDragLeave={() => setOver(null)} onDrop={e => onDrop(e, 'rejected')}>
        <button type="button" onClick={() => setShowRejected(v => !v)} className="flex items-center gap-2 text-xs text-ink-faint hover:text-ink">
          <ChevronDown size={12} className={`transition-transform ${showRejected ? '' : '-rotate-90'}`} />
          {t(T.rejected)} <span className="tnum">{rejected.length}</span>
          {rejected.length === 0 && <span className="text-ink-faint">· {t(T.rejectDrop)}</span>}
        </button>
        {rejected.length > 0 && (
          <div>
          {showRejected && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {rejected.map(c => (
                <li key={c.id} draggable onDragStart={e => e.dataTransfer.setData('text/kh-lead', c.id)}
                    className="badge cursor-grab">
                  {c.name}
                  <button type="button" onClick={() => move(c.id, 'contacted')} className="ml-1 hover:text-ink" aria-label={`${t(T.moveBack)} ${localized(LEAD_STATUSES[1].label, locale)}`}><ChevronLeft size={11} /></button>
                </li>
              ))}
            </ul>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
