'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import { INDUSTRIES } from '@/lib/search-options';
import { PROFESSIONS, professionById, type UserProfile } from '@/lib/profile';
import { SCENARIO_BY_PROFESSION, scenarioById } from '@/lib/scenarios';
import { draftToPayload, toDraft, type ProfileDraft } from './ProfileFields';

/**
 * Jedna otázka, hned po registraci: čím se živíte.
 *
 * Dřív to byly čtyři kroky — profese, obor, kraj, kritéria. Každý z nich byl obhajitelný a
 * dohromady stály mezi člověkem a prvním výsledkem. Onboarding, který se dá odklikat za pět
 * vteřin, vyplní víc profilů než ten, který se vyplní pořádně a jen zřídka.
 *
 * Z jedné odpovědi se odvodí dvě věci: kritéria, podle kterých se výsledky řadí (ta u profesí
 * byla vždycky), a výchozí scénář hledání. Obor se nabídne jako tři tlačítka, kraj zůstává ve
 * formuláři, kde ho uživatel stejně vidí. Cokoli z toho jde později změnit v účtu.
 *
 * Přeskočení je plnohodnotný výsledek, ne dark pattern: tlačítko je v hlavičce a i po přeskočení
 * se uživatel označí za dotázaného, takže se ho aplikace už nikdy neptá.
 */

const T = {
  title:   { cs: 'Čím se živíte?', sk: 'Čím sa živíte?', en: 'What do you do?' },
  lead:    { cs: 'Jedna odpověď a hledání bude předvyplněné. Kdykoli to změníte v účtu.',
             sk: 'Jedna odpoveď a hľadanie bude predvyplnené. Kedykoľvek to zmeníte v účte.',
             en: 'One answer and your search arrives pre-filled. Change it any time in your account.' },
  skip:    { cs: 'Přeskočit', sk: 'Preskočiť', en: 'Skip' },
  pick:    { cs: 'Co budete hledat', sk: 'Čo budete hľadať', en: 'What you will look for' },
  scenario:{ cs: 'Výchozí scénář:', sk: 'Východiskový scenár:', en: 'Default scenario:' },
  finish:  { cs: 'Hotovo, hledat', sk: 'Hotovo, hľadať', en: 'Done, search' },
  saving:  { cs: 'Ukládám…', sk: 'Ukladám…', en: 'Saving…' },
  otherLabel: { cs: 'Čemu se věnujete?', sk: 'Čomu sa venujete?', en: 'What is your trade?' },
  failed:  { cs: 'Uložení se nepovedlo. Zkuste to znovu, nebo onboarding přeskočte.',
             sk: 'Uloženie sa nepodarilo. Skúste to znova, alebo onboarding preskočte.',
             en: 'Saving failed. Try again, or skip the onboarding.' },
};

interface Props {
  locale: string;
  initial: UserProfile;
  /** Receives the saved profile, or `null` when the user skipped. */
  onDone: (profile: UserProfile | null) => void;
}

/** Lidský název oboru v jazyce uživatele; klíč je slug z NICHE_MAP. */
function industryLabel(value: string, locale: string): string {
  const groups = INDUSTRIES[locale] ?? INDUSTRIES.en;
  for (const g of groups) {
    const hit = g.items.find(i => i.value === value);
    if (hit) return hit.label;
  }
  return value;
}

export function OnboardingModal({ locale, initial, onDone }: Props) {
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // A modal that leaves the page scrolling behind it reads as a bug on a phone.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  const patch = (next: Partial<ProfileDraft>) => setDraft(d => ({ ...d, ...next }));

  async function save(payload: Record<string, unknown>): Promise<UserProfile | null> {
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('save failed');
    const data = await res.json();
    return data.user as UserProfile;
  }

  /**
   * Výběr profese rovnou přednastaví kritéria. Uživatel je uvidí vypsaná na obrazovce hledání
   * a může je tam přepnout — tady by čtvrtá otázka o kritériích jen zdržovala.
   */
  function choose(id: string) {
    const p = professionById(id);
    patch({ profession: id, criteria: p ? [...p.suggests] : [] });
  }

  async function finish() {
    setSaving(true);
    setFailed(false);
    try {
      const saved = await save({ ...draftToPayload(draft), onboarded: true });
      onDone(saved);
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  async function skip() {
    // Best effort: if the flag will not save, the worst case is being asked again next time —
    // not a reason to trap someone in a modal they asked to leave.
    try { await save({ onboarded: true }); } catch { /* ignore */ }
    onDone(null);
  }

  const chosen = professionById(draft.profession);
  const scenario = scenarioById(draft.profession ? SCENARIO_BY_PROFESSION[draft.profession] : 'all');

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-start md:items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label={localized(T.title, locale)}
    >
      <div className="bg-white border border-ink w-full max-w-2xl my-4">

        <div className="flex items-start justify-between gap-6 px-6 pt-6 pb-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight">{localized(T.title, locale)}</h2>
            <p className="text-sm text-ink-muted mt-1">{localized(T.lead, locale)}</p>
          </div>
          <button
            onClick={skip}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors shrink-0"
          >
            <X size={12} />{localized(T.skip, locale)}
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="flex flex-wrap gap-2">
            {PROFESSIONS.map(p => (
              <button
                key={p.id}
                onClick={() => choose(p.id)}
                className={draft.profession === p.id ? 'chip-active' : 'chip'}
              >
                {localized(p.label, locale)}
              </button>
            ))}
          </div>

          {draft.profession === 'other' && (
            <div className="mt-4">
              <label className="label">{localized(T.otherLabel, locale)}</label>
              <input
                className="input"
                value={draft.professionText ?? ''}
                onChange={e => patch({ professionText: e.target.value })}
                autoFocus
              />
            </div>
          )}

          {chosen && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-3">
                {localized(T.pick, locale)}
              </p>
              <div className="flex flex-wrap gap-2">
                {chosen.industries.map(value => (
                  <button
                    key={value}
                    onClick={() => patch({ industry: value })}
                    className={draft.industry === value ? 'chip-active' : 'chip'}
                  >
                    {industryLabel(value, locale)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink-faint mt-3">
                {localized(T.scenario, locale)} {localized(scenario.label, locale)}
              </p>
            </div>
          )}
        </div>

        {failed && (
          <p className="mx-6 mb-4 border border-ink px-4 py-3 text-sm font-medium">
            {localized(T.failed, locale)}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line">
          <button onClick={finish} className="btn-primary" disabled={saving || !draft.profession}>
            {saving ? localized(T.saving, locale) : localized(T.finish, locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
