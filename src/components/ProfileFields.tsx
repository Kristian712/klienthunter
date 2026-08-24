'use client';

import { ChevronDown } from 'lucide-react';
import { GROUP_LABELS, GROUP_ORDER, LEAD_FILTERS, localized } from '@/lib/lead-filters';
import { PROFESSIONS, professionById, type UserProfile } from '@/lib/profile';
import { INDUSTRIES, POPULAR_CHIPS, REGIONS } from '@/lib/search-options';

/**
 * The four questions of the onboarding, as separate controlled blocks.
 *
 * The modal asks them one per step; the settings page shows all four at once. Sharing the
 * blocks rather than the layout means the two screens can never drift into asking slightly
 * different questions — which is the failure mode that makes a saved profile untrustworthy.
 */

const CUSTOM = '__custom__';

export interface ProfileDraft {
  profession: string;
  professionText: string;
  /** A value from INDUSTRIES, or CUSTOM when the user typed their own. */
  industry: string;
  customIndustry: string;
  region: string;
  customRegion: string;
  city: string;
  criteria: string[];
}

const KNOWN_INDUSTRIES = new Set(
  Object.values(INDUSTRIES).flatMap(groups => groups.flatMap(g => g.items.map(i => i.value))),
);
const KNOWN_REGIONS = new Set(REGIONS.flatMap(g => g.items.map(r => r.value)));

export function toDraft(profile: UserProfile): ProfileDraft {
  const industry = profile.targetIndustry ?? '';
  const region = profile.targetRegion ?? '';
  const industryKnown = industry !== '' && KNOWN_INDUSTRIES.has(industry);
  const regionKnown = region !== '' && KNOWN_REGIONS.has(region);

  return {
    profession: profile.profession ?? '',
    professionText: profile.professionText ?? '',
    industry: industryKnown ? industry : industry ? CUSTOM : '',
    customIndustry: industryKnown ? '' : industry,
    region: regionKnown ? region : region ? CUSTOM : '',
    customRegion: regionKnown ? '' : region,
    city: profile.targetCity ?? '',
    criteria: profile.targetFilters ?? [],
  };
}

/** Everything empty becomes null, so a cleared field is stored as "unset" rather than "". */
export function draftToPayload(draft: ProfileDraft) {
  const text = (v: string) => (v.trim() ? v.trim() : null);
  return {
    profession: draft.profession || null,
    professionText: draft.profession === 'other' ? text(draft.professionText) : null,
    targetIndustry: draft.industry === CUSTOM ? text(draft.customIndustry) : text(draft.industry),
    targetRegion: draft.region === CUSTOM ? text(draft.customRegion) : text(draft.region),
    targetCity: text(draft.city),
    targetFilters: draft.criteria,
  };
}

export const EMPTY_DRAFT: ProfileDraft = {
  profession: '', professionText: '', industry: '', customIndustry: '',
  region: '', customRegion: '', city: '', criteria: [],
};

type Patch = (next: Partial<ProfileDraft>) => void;

interface FieldProps {
  draft: ProfileDraft;
  patch: Patch;
  locale: string;
}

const T = {
  professionQ:  { cs: 'Co nabízíte?',                sk: 'Čo ponúkate?',                 en: 'What do you offer?' },
  professionHint:{ cs: 'Podle toho vám předvyplníme, co u firem sledovat. Můžete to kdykoli změnit.',
                  sk: 'Podľa toho vám predvyplníme, čo u firiem sledovať. Môžete to kedykoľvek zmeniť.',
                  en: 'We use this to pre-tick what to look for. You can change it any time.' },
  professionOwn:{ cs: 'Napište, co nabízíte…',       sk: 'Napíšte, čo ponúkate…',        en: 'Describe what you offer…' },
  industryQ:    { cs: 'Komu to nabízíte?',           sk: 'Komu to ponúkate?',            en: 'Who do you offer it to?' },
  industryHint: { cs: 'Obor firem, které chcete oslovit.', sk: 'Odbor firiem, ktoré chcete osloviť.', en: 'The trade of the firms you want to reach.' },
  industryPick: { cs: '— Nebo vyberte obor —',       sk: '— Alebo vyberte odbor —',      en: '— Or select a trade —' },
  industryOther:{ cs: 'Jiný obor (zadat ručně)',     sk: 'Iný odbor (zadať ručne)',      en: 'Other (type manually)' },
  industryOwn:  { cs: 'Název oboru…',                sk: 'Názov odboru…',                en: 'Trade name…' },
  regionQ:      { cs: 'Kde?',                        sk: 'Kde?',                         en: 'Where?' },
  regionHint:   { cs: 'Kraj, ve kterém chcete hledat.', sk: 'Kraj, v ktorom chcete hľadať.', en: 'The region you want to search.' },
  regionPick:   { cs: '— Vyberte region —',          sk: '— Vyberte región —',           en: '— Select a region —' },
  regionOther:  { cs: 'Jiné město (zadat ručně)',    sk: 'Iné mesto (zadať ručne)',      en: 'Other (type manually)' },
  regionOwn:    { cs: 'Název města nebo oblasti…',   sk: 'Názov mesta alebo oblasti…',   en: 'City or area name…' },
  cityQ:        { cs: 'Město (nepovinné)',           sk: 'Mesto (nepovinné)',            en: 'Town (optional)' },
  cityHint:     { cs: 'Jen pro vaši poznámku — hledá se v celém kraji.', sk: 'Len pre vašu poznámku — hľadá sa v celom kraji.', en: 'For your own note — the search covers the whole region.' },
  criteriaQ:    { cs: 'Co má firma splňovat?',       sk: 'Čo má firma spĺňať?',          en: 'What should a firm meet?' },
  criteriaHint: { cs: 'Nepovinné. Podle toho výsledky seřadíme — čím víc toho firma splňuje, tím výš bude. Nic to neodfiltruje.',
                  sk: 'Nepovinné. Podľa toho výsledky zoradíme — čím viac toho firma spĺňa, tým vyššie bude. Nič to neodfiltruje.',
                  en: 'Optional. We rank by this — the more a firm meets, the higher it sits. Nothing gets filtered out.' },
  criteriaNone: { cs: 'Nic nevybráno — seřadíme podle dostupnosti kontaktu a délky působení.',
                  sk: 'Nič nevybrané — zoradíme podľa dostupnosti kontaktu a dĺžky pôsobenia.',
                  en: 'Nothing selected — we rank by reachable contact and years trading.' },
};

export function ProfessionField({ draft, patch, locale }: FieldProps) {
  return (
    <div>
      <p className="font-semibold">{localized(T.professionQ, locale)}</p>
      <p className="text-sm text-ink-muted mt-1 mb-3">{localized(T.professionHint, locale)}</p>

      <div className="flex flex-wrap gap-2">
        {PROFESSIONS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              // Swapping trade re-suggests criteria, but only while the user has not curated
              // their own list — overwriting a deliberate choice would be rude.
              const previous = professionById(draft.profession);
              const untouched =
                draft.criteria.length === 0 ||
                (previous && sameSet(draft.criteria, previous.suggests));
              patch({
                profession: p.id,
                criteria: untouched ? p.suggests : draft.criteria,
              });
            }}
            className={draft.profession === p.id ? 'chip-active' : 'chip'}
          >
            {localized(p.label, locale)}
          </button>
        ))}
      </div>

      {draft.profession === 'other' && (
        <input
          className="input mt-3"
          placeholder={localized(T.professionOwn, locale)}
          value={draft.professionText}
          onChange={e => patch({ professionText: e.target.value })}
          maxLength={120}
          autoFocus
        />
      )}
    </div>
  );
}

function sameSet(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every(x => b.includes(x));
}

export function IndustryField({ draft, patch, locale }: FieldProps) {
  const chips = POPULAR_CHIPS[locale] ?? POPULAR_CHIPS.en;
  const groups = INDUSTRIES[locale] ?? INDUSTRIES.en;

  return (
    <div>
      <p className="font-semibold">{localized(T.industryQ, locale)}</p>
      <p className="text-sm text-ink-muted mt-1 mb-3">{localized(T.industryHint, locale)}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {chips.map(chip => (
          <button
            key={chip.value}
            type="button"
            onClick={() => patch({ industry: chip.value })}
            className={draft.industry === chip.value ? 'chip-active' : 'chip'}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <select
          className="input appearance-none pr-9 cursor-pointer"
          value={draft.industry}
          onChange={e => patch({ industry: e.target.value })}
        >
          <option value="">{localized(T.industryPick, locale)}</option>
          {groups.map(group => (
            <optgroup key={group.group} label={group.group}>
              {group.items.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </optgroup>
          ))}
          <option value={CUSTOM}>{localized(T.industryOther, locale)}</option>
        </select>
        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
      </div>

      {draft.industry === CUSTOM && (
        <input
          className="input mt-2"
          placeholder={localized(T.industryOwn, locale)}
          value={draft.customIndustry}
          onChange={e => patch({ customIndustry: e.target.value })}
          maxLength={120}
          autoFocus
        />
      )}
    </div>
  );
}

export function RegionField({ draft, patch, locale }: FieldProps) {
  return (
    <div>
      <p className="font-semibold">{localized(T.regionQ, locale)}</p>
      <p className="text-sm text-ink-muted mt-1 mb-3">{localized(T.regionHint, locale)}</p>

      <div className="relative">
        <select
          className="input appearance-none pr-9 cursor-pointer"
          value={draft.region}
          onChange={e => patch({ region: e.target.value })}
        >
          <option value="">{localized(T.regionPick, locale)}</option>
          {REGIONS.map(group => (
            <optgroup key={group.group} label={group.group}>
              {group.items.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </optgroup>
          ))}
          <option value={CUSTOM}>{localized(T.regionOther, locale)}</option>
        </select>
        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
      </div>

      {draft.region === CUSTOM && (
        <input
          className="input mt-2"
          placeholder={localized(T.regionOwn, locale)}
          value={draft.customRegion}
          onChange={e => patch({ customRegion: e.target.value })}
          maxLength={120}
          autoFocus
        />
      )}

      <p className="font-semibold mt-5">{localized(T.cityQ, locale)}</p>
      <p className="text-sm text-ink-muted mt-1 mb-2">{localized(T.cityHint, locale)}</p>
      <input
        className="input"
        value={draft.city}
        onChange={e => patch({ city: e.target.value })}
        maxLength={120}
      />
    </div>
  );
}

export function CriteriaField({ draft, patch, locale }: FieldProps) {
  const toggle = (id: string) =>
    patch({
      criteria: draft.criteria.includes(id)
        ? draft.criteria.filter(x => x !== id)
        : [...draft.criteria, id],
    });

  return (
    <div>
      <p className="font-semibold">{localized(T.criteriaQ, locale)}</p>
      <p className="text-sm text-ink-muted mt-1 mb-4">{localized(T.criteriaHint, locale)}</p>

      <div className="space-y-2.5">
        {GROUP_ORDER.map(group => {
          const items = LEAD_FILTERS.filter(f => f.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="flex flex-wrap items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                {localized(GROUP_LABELS[group], locale)}
              </span>
              {items.map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  className={draft.criteria.includes(f.id) ? 'chip-active' : 'chip'}
                >
                  {localized(f.label, locale)}
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {draft.criteria.length === 0 && (
        <p className="text-xs text-ink-faint mt-4">{localized(T.criteriaNone, locale)}</p>
      )}
    </div>
  );
}
