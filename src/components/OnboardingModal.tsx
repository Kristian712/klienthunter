'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { localized } from '@/lib/lead-filters';
import type { UserProfile } from '@/lib/profile';
import {
  CriteriaField, IndustryField, ProfessionField, RegionField,
  draftToPayload, toDraft, type ProfileDraft,
} from './ProfileFields';

/**
 * Four questions, once, right after registering.
 *
 * The point is not the data — it is that the second visit costs one click. Without it the user
 * faces an empty form that assumes nothing about them, and the app has to guess how to rank
 * results, which is exactly the guess that used to hard-code "sells websites".
 *
 * Skipping is a first-class outcome, not a dark pattern: the button sits in the header on every
 * step, and skipping still marks the user as asked so they are never nagged again.
 */

const T = {
  title:   { cs: 'Než začnete',            sk: 'Než začnete',              en: 'Before you start' },
  lead:    { cs: 'Čtyři otázky a hledání budete mít předvyplněné. Příště stačí kliknout na Hledat.',
             sk: 'Štyri otázky a hľadanie budete mať predvyplnené. Nabudúce stačí kliknúť na Hľadať.',
             en: 'Four questions and your search arrives pre-filled. Next time it is one click.' },
  step:    { cs: 'Krok',                   sk: 'Krok',                     en: 'Step' },
  of:      { cs: 'ze',                     sk: 'zo',                       en: 'of' },
  skip:    { cs: 'Přeskočit',              sk: 'Preskočiť',                en: 'Skip' },
  back:    { cs: 'Zpět',                   sk: 'Späť',                     en: 'Back' },
  next:    { cs: 'Pokračovat',             sk: 'Pokračovať',               en: 'Continue' },
  finish:  { cs: 'Hotovo, hledat',         sk: 'Hotovo, hľadať',           en: 'Done, search' },
  saving:  { cs: 'Ukládám…',               sk: 'Ukladám…',                 en: 'Saving…' },
  failed:  { cs: 'Uložení se nepovedlo. Zkuste to znovu, nebo onboarding přeskočte.',
             sk: 'Uloženie sa nepodarilo. Skúste to znova, alebo onboarding preskočte.',
             en: 'Saving failed. Try again, or skip the onboarding.' },
};

const STEPS = [ProfessionField, IndustryField, RegionField, CriteriaField];

interface Props {
  locale: string;
  initial: UserProfile;
  /** Receives the saved profile, or `null` when the user skipped. */
  onDone: (profile: UserProfile | null) => void;
}

export function OnboardingModal({ locale, initial, onDone }: Props) {
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(initial));
  const [step, setStep] = useState(0);
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

  const Step = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 flex items-start md:items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-label={localized(T.title, locale)}
    >
      <div className="bg-white border border-ink w-full max-w-2xl my-4">

        <div className="flex items-start justify-between gap-6 px-6 pt-6 pb-4 border-b border-line">
          <div>
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

        <div className="px-6 py-6 min-h-[15rem]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-4">
            {localized(T.step, locale)} {step + 1} {localized(T.of, locale)} {STEPS.length}
          </p>
          <Step draft={draft} patch={patch} locale={locale} />
        </div>

        {failed && (
          <p className="mx-6 mb-4 border border-ink px-4 py-3 text-sm font-medium">
            {localized(T.failed, locale)}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-line">
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-6 ${i <= step ? 'bg-ink' : 'bg-line'}`}
                aria-hidden
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="btn-outline btn-sm" disabled={saving}>
                {localized(T.back, locale)}
              </button>
            )}
            {last ? (
              <button onClick={finish} className="btn-primary" disabled={saving}>
                {saving ? localized(T.saving, locale) : localized(T.finish, locale)}
              </button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} className="btn-primary">
                {localized(T.next, locale)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
