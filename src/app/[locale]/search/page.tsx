'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, Globe, Users, ExternalLink,
  Mail, MapPin, X, Clock, ChevronDown,
  FileText, Table2, PhoneCall,
} from 'lucide-react';
import { LEAD_FILTERS, GROUP_LABELS, GROUP_ORDER, matchesAll, localized } from '@/lib/lead-filters';
import { leadReason } from '@/lib/lead-reason';
import { reachHint, reachScore } from '@/lib/reach-score';
import { scoreBreakdown } from '@/lib/lead-score';
import { YIELD_NOTE, yieldFor } from '@/lib/nace-map';
import { SCENARIOS, SCENARIO_BY_PROFESSION, scenarioById } from '@/lib/scenarios';
import { EMPTY_PROFILE, type UserProfile } from '@/lib/profile';
import { REGIONS, INDUSTRIES, POPULAR_CHIPS } from '@/lib/search-options';
import { LeadScore, GOOD_LEAD } from '@/components/LeadScore';
import { ResultsMap, type MapLead } from '@/components/ResultsMap';
import { LEAD_STATUSES, isDone, statusDef, type LeadStatus } from '@/lib/lead-tags';
import { OnboardingModal } from '@/components/OnboardingModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusinessResult {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  /** Souřadnice. Dnes je nese jen OpenStreetMap — u řádků z ARESu chybí. */
  lat?: number | null;
  lon?: number | null;
  /** Značky přihlášeného uživatele. Server je posílá už filtrované na něj. */
  tags?: Array<{ status: string; note?: string | null }>;
  website?: string;
  /** The firm's own "Kontakt" page, read from the link on its site. */
  contactUrl?: string;
  hasWebsite: boolean;
  websiteStatus?: string | null;
  websiteEvidence?: string;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  /**
   * Whether the three flags above are an answer at all. They are only ever read off the firm's
   * own homepage, so on a row where we found no page they are all false because nobody looked.
   * Rows written before this column existed default to false — read as unchecked, which is the
   * honest way round.
   */
  socialsChecked: boolean;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedInUrl?: string;
  websiteIsOld: boolean;
  websiteScore: number;
  websiteAgeNote: string;
  reviewCount: number;
  rating?: number;
  googleMapsUrl?: string;
  source?: string;
  category?: string;
  /** How good a sales opportunity this is, 0–100. Computed when the row is saved. */
  leadScore: number;
  /** Registry fields, present only on rows discovered through ARES. */
  ico?: string;
  foundedAt?: string | null;
  vatPayer?: boolean;
  vatUnreliable?: boolean;
  /** Kód právní formy z ARESu. `112` s.r.o., `101` živnostník, `121` a.s. … */
  legalForm?: string | null;
  /** Počet provozoven s aktivním živnostenským oprávněním. NULL = nezeptali jsme se. */
  activePremises?: number | null;
}

/** Průběh hledání, které běží na pozadí. Odpovídá řádku `SearchJob` v databázi. */
interface JobState {
  id: string;
  searchId: string;
  /** `paused` = došel čas jedné invokace, další fáze naváže při příštím dotazu na průběh. */
  status: 'queued' | 'running' | 'paused' | 'done' | 'failed';
  foundCount: number;
  processedCount: number;
  startedAt: string | null;
  error: string | null;
  /** Kolikátá fáze (město) je na řadě, kolik jich je celkem a jak se ta právě běžící jmenuje. */
  stageIndex: number;
  stageCount: number;
  stageLabel: string | null;
}

/** Kde si pamatujeme, jestli má mapa skrývat vyřízené firmy. */
const HIDE_DONE_KEY = 'kh-hide-done';

type WebStatus = 'HAS' | 'NONE' | 'UNKNOWN';

/** Results saved before three-state classification have no status; their `false` proved nothing. */
function webStatus(b: BusinessResult): WebStatus {
  if (b.websiteStatus === 'HAS' || b.websiteStatus === 'NONE' || b.websiteStatus === 'UNKNOWN') {
    return b.websiteStatus;
  }
  return b.hasWebsite ? 'HAS' : 'UNKNOWN';
}

/**
 * Filtering lives in `@/lib/lead-filters` — the same registry the API route uses. This page
 * only remembers *which* filters are on; it knows nothing about what any of them mean, so a
 * new filter appears here the moment it is added to the registry.
 */

/**
 * Proč tenhle řádek sedí tam, kde sedí.
 *
 * Dřív to byly dvě nálepky s názvy splněných kritérií („Nová firma (do 1 roku)"). Nálepka je
 * jméno filtru, ne důvod k telefonátu — a u dvaceti řádků si ten důvod nikdo nedomýšlí. Teď je
 * to věta z `lead-reason.ts`, složená ze stejných splněných kritérií, takže vysvětluje přesně
 * to pořadí, které uživatel vidí. Varování o nespolehlivém plátci DPH je součástí té věty.
 */
function rowSummary(b: BusinessResult, criteria: string[], locale: string) {
  const { matched, unanswered, total } = scoreBreakdown(b, criteria);

  // Celá věta místo dvou útržků. Skládá se ze stejných splněných kritérií, takže říká totéž
  // co nálepky — jen tak, že si to člověk může přečíst a rovnou podle toho zavolat. Varování
  // o nespolehlivém plátci DPH je součástí věty, proto tady už nestojí zvlášť.
  const reason = leadReason(b, criteria, locale);

  // The hover on the number says what the number counted. A bare "78 / 100" is a verdict the
  // user has to trust; "splňuje 2 ze 3 kritérií" is a claim they can check.
  let scoreTitle = localized(S.meetsOf, locale)
    .replace('{n}', String(matched.length))
    .replace('{total}', String(total));
  if (unanswered.length > 0) {
    scoreTitle += localized(S.unanswered, locale).replace('{k}', String(unanswered.length));
  }

  return { reason, scoreTitle };
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function FbIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
}
function IgIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>;
}
function LiIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>;
}
function WaIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;
}

/** Lidský název oboru podle slugu. Slug, který v nabídce není, se ukáže tak, jak přišel. */
function industryLabelFor(value: string, locale: string): string {
  const groups = INDUSTRIES[locale] ?? INDUSTRIES.en;
  for (const g of groups) {
    const hit = g.items.find(i => i.value === value);
    if (hit) return hit.label;
  }
  return value;
}

// ── Phone helpers ─────────────────────────────────────────────────────────────

function isCzMobile(phone: string): boolean {
  const d = phone.replace(/[\s\-()+]/g, '');
  const local = d.startsWith('420') ? d.slice(3) : d;
  return local.length === 9 && (local.startsWith('6') || local.startsWith('7'));
}

/**
 * A web search for this firm, by name and town.
 *
 * The honest fallback for a row we could not resolve: most of what the app returns comes from
 * ARES, which carries no website, no phone and no e-mail — so without this the row offers the
 * reader nothing to do at all. It is a search, not a claim: the button says so, and where the
 * user lands is up to what the search engine finds.
 */
/**
 * Vyhledávání firmy na Facebooku podle názvu a města.
 *
 * Není to dohledaný profil — profil dohledat neumíme a nikdy nebudeme: Facebook i Instagram
 * mají v robots.txt `User-agent: * / Disallow: /` a výslovně zakazují automatizovaný sběr dat,
 * takže stránku profilu nesmíme ani načíst, natož ověřit, že patří té firmě. Tlačítko tedy
 * nic netvrdí, jen ušetří opsání názvu do vyhledávacího pole.
 */
function facebookSearchHref(b: BusinessResult): string {
  const town = (b.address ?? '').split(',').pop()?.replace(/\d/g, '').trim() ?? '';
  return `https://www.facebook.com/search/top?q=${encodeURIComponent([b.name, town].filter(Boolean).join(' '))}`;
}

function lookupHref(b: BusinessResult): string {
  // The last part of an ARES address is "70030 Ostrava"; the postcode only narrows a web search
  // by accident, so it goes.
  const town = (b.address ?? '').split(',').pop()?.replace(/\d/g, '').trim() ?? '';
  return `https://www.google.com/search?q=${encodeURIComponent([b.name, town].filter(Boolean).join(' '))}`;
}

function whatsappHref(phone: string): string {
  const d = phone.replace(/[\s\-()+]/g, '');
  const num = d.startsWith('420') ? d : `420${d}`;
  return `https://wa.me/${num}`;
}

// ── Contact strategy ──────────────────────────────────────────────────────────

/**
 * Which channels this row actually offers, and what is worth knowing about each.
 *
 * Dřív tady stály věty jako „Nejvyšší šance odpovědi, nejlépe 9–11h" nebo „Messenger funguje
 * dobře u starší klientely (40+)". Žádné takové číslo aplikace nemá — byly vymyšlené, a to
 * druhé navíc soudilo lidi podle věku. Je to stejná chyba, kvůli které se přepisoval zbytek
 * appky: tvrdit něco, co data neunesou. Nové popisky říkají jen to, co je skutečně pravda —
 * co ten kanál je a na co si u něj dát pozor. Rozhodnutí zůstává na uživateli.
 */

const CONTACT = {
  heading: { cs: 'Jak kontaktovat', sk: 'Ako kontaktovať', en: 'How to get in touch' },
  reach:   { cs: 'Dosažitelnost',   sk: 'Dosiahnuteľnosť',  en: 'Reachability' },
  call:    { cs: 'Zavolat',          sk: 'Zavolať',          en: 'Call' },
  callTip: { cs: 'Číslo je mobilní — voláte nejspíš přímo majiteli, ne na recepci.',
             sk: 'Číslo je mobilné — voláte najskôr priamo majiteľovi, nie na recepciu.',
             en: 'It is a mobile number, so you are most likely reaching the owner directly.' },
  wa:      { cs: 'WhatsApp',         sk: 'WhatsApp',         en: 'WhatsApp' },
  waTip:   { cs: 'Stejné číslo, jen písemně — když se nechcete vnucovat hovorem.',
             sk: 'To isté číslo, len písomne — keď sa nechcete vnucovať hovorom.',
             en: 'Same number in writing, if a phone call feels too intrusive.' },
  ig:      { cs: 'Zpráva na Instagramu', sk: 'Správa na Instagrame', en: 'Instagram message' },
  igTip:   { cs: 'Zpráva od neznámého účtu se schová do žádostí — nemusí si jí všimnout.',
             sk: 'Správa od neznámeho účtu sa schová do žiadostí — nemusia si ju všimnúť.',
             en: 'A message from an unknown account lands in requests and is easy to miss.' },
  fb:      { cs: 'Zpráva na Facebooku', sk: 'Správa na Facebooku', en: 'Facebook message' },
  fbTip:   { cs: 'Stránku spravuje někdo z firmy; zpráva od cizího účtu často končí v žádostech.',
             sk: 'Stránku spravuje niekto z firmy; správa od cudzieho účtu často končí v žiadostiach.',
             en: 'Someone at the business runs the page; messages from strangers often sit in requests.' },
  contact: { cs: 'Otevřít kontakty', sk: 'Otvoriť kontakty', en: 'Open contact page' },
  contactTip: { cs: 'Stránka „Kontakt" na webu firmy — adresa, otevírací doba a většinou i jméno člověka, se kterým budete mluvit.',
             sk: 'Stránka „Kontakt" na webe firmy — adresa, otváracie hodiny a väčšinou aj meno človeka, s ktorým budete hovoriť.',
             en: 'The firm\u2019s own contact page — address, opening hours and usually the name of the person you will talk to.' },
  web:     { cs: 'Otevřít web',      sk: 'Otvoriť web',      en: 'Open website' },
  webTip:  { cs: 'Web firmy tak, jak jsme ho ověřili. Kontakty bývají v patičce nebo v menu.',
             sk: 'Web firmy tak, ako sme ho overili. Kontakty bývajú v pätičke alebo v menu.',
             en: 'The website as we verified it. Contacts are usually in the footer or the menu.' },
  fbSearch:{ cs: 'Hledat na Facebooku', sk: 'Hľadať na Facebooku', en: 'Search on Facebook' },
  fbSearchTip: { cs: 'Profil jsme nedohledali — Facebook to automatizovaně neumožňuje. Tohle otevře jeho vyhledávání podle názvu a města, ať to nemusíte psát ručně.',
             sk: 'Profil sme nedohľadali — Facebook to automatizovane neumožňuje. Toto otvorí jeho vyhľadávanie podľa názvu a mesta, aby ste to nemuseli písať ručne.',
             en: 'We could not find the profile — Facebook does not allow that automatically. This opens its search by name and town so you do not have to type it.' },
  lookup:  { cs: 'Najít firmu na webu', sk: 'Nájsť firmu na webe', en: 'Look the firm up' },
  lookupTip: { cs: 'Otevře vyhledávání podle názvu a města. Její web ani profil jsme nedohledali — tohle je nejrychlejší způsob, jak zkusit najít, kde se firma prezentuje.',
             sk: 'Otvorí vyhľadávanie podľa názvu a mesta. Jej web ani profil sme nedohľadali — toto je najrýchlejší spôsob, ako skúsiť nájsť, kde sa firma prezentuje.',
             en: 'Opens a web search by name and town. We could not find a site or profile for this firm, so this is the fastest way to try.' },
  email:   { cs: 'E-mail',           sk: 'E-mail',           en: 'E-mail' },
  emailTip:{ cs: 'Písemně a doložitelně. U nevyžádané nabídky platí § 7 zák. 480/2004 Sb. — viz podmínky.',
             sk: 'Písomne a doložiteľne. Pri nevyžiadanej ponuke platí § 7 zák. 480/2004 Zb. — viď podmienky.',
             en: 'Written and on the record. Unsolicited offers fall under § 7 of Act 480/2004 — see the terms.' },
  landTip: { cs: 'Pevná linka — ozve se nejspíš provozovna, ne majitel. Ptejte se rovnou, kdo řeší web.',
             sk: 'Pevná linka — ozve sa najskôr prevádzka, nie majiteľ. Pýtajte sa rovno, kto rieši web.',
             en: 'A landline, so expect the premises rather than the owner. Ask straight away who handles the website.' },
  webUnv:  { cs: 'Tuhle adresu uvedl zdroj, ale při našem ověření neodpověděla. Může být dočasně mimo provoz.',
             sk: 'Túto adresu uviedol zdroj, ale pri našom overení neodpovedala. Môže byť dočasne mimo prevádzky.',
             en: 'A source gave this address, but it did not answer when we checked. It may be temporarily down.' },
};

/**
 * Co je na řádku místo kontaktů, dokud není uživatel přihlášený.
 *
 * Rozmazané pruhy jsou schválně **prázdné** — nejsou to skutečné údaje pod filtrem. Kdyby tu
 * telefon byl a jen se zamlžil přes CSS, přečte si ho kdokoli v odpovědi na síti; ukázka proto
 * kontakty vůbec nestahuje a server je ani neposílá. Popisek to říká nahlas, protože slibovat
 * „skryto" nad něčím, co je ve skutečnosti čitelné, je přesně ta lež, kterou tahle aplikace
 * nikde nedělá.
 */
function LockedContacts({ locale }: { locale: string }) {
  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
        {localized(S.demoLocked, locale)}
      </p>
      <div className="flex items-center gap-2 flex-wrap" aria-hidden="true">
        <span className="h-6 w-28 rounded-lg bg-ink/10" />
        <span className="h-6 w-36 rounded-lg bg-ink/[0.07]" />
        <span className="h-6 w-20 rounded-lg bg-ink/[0.05]" />
      </div>
    </div>
  );
}

function ContactStrategy({ b, locale }: { b: BusinessResult; locale: string }) {
  const mobile = b.phone ? isCzMobile(b.phone) : false;
  const L = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);
  /**
   * Dosažitelnost patří přesně sem, nad seznam cest ke kontaktu: je to jeho shrnutí do jednoho
   * čísla. Vedle skóre leadu stojí schválně jinde a menší — to říká „stojí za oslovení",
   * tohle „a jde to vůbec".
   */
  const reach = reachScore(b);

  /**
   * `value` je samotný údaj — číslo, e-mail, doména. Tlačítko nese akci, `value` nese fakt:
   * bez něj by po sloučení dvou dřívějších bloků do jednoho zmizelo z řádku telefonní číslo
   * a nedalo by se zkopírovat.
   */
  type Method = { key: string; icon: React.ReactNode; label: string; href: string; tip: string; value?: string };
  const methods: Method[] = [];

  // First, because it is the page the firm itself keeps for being contacted on.
  if (b.contactUrl) {
    methods.push({ key: 'contact', icon: <ExternalLink size={11} />, label: L(CONTACT.contact),
                   href: b.contactUrl, tip: L(CONTACT.contactTip) });
  } else if (b.website) {
    // I web, který zdroj uvedl a nám neodpověděl. Stránka může být chvíli mimo provoz a mrtvý
    // web je sám o sobě důvod firmu oslovit — jen se u něj nesmí tvrdit, že jsme ho ověřili.
    const overeny = webStatus(b) === 'HAS';
    methods.push({ key: 'web', icon: <Globe size={11} />, label: L(CONTACT.web),
                   href: b.website, tip: L(overeny ? CONTACT.webTip : CONTACT.webUnv),
                   value: b.website.replace(/^https?:\/\//, '') });
  }

  if (b.phone) {
    methods.push({ key: 'call', icon: <PhoneCall size={11} />, label: L(CONTACT.call),
                   href: `tel:${b.phone}`, tip: L(mobile ? CONTACT.callTip : CONTACT.landTip),
                   value: b.phone });
    if (mobile) {
      methods.push({ key: 'wa', icon: <WaIcon />, label: L(CONTACT.wa),
                     href: whatsappHref(b.phone), tip: L(CONTACT.waTip) });
    }
  }

  if (b.hasInstagram && b.instagramUrl) {
    methods.push({ key: 'ig', icon: <IgIcon />, label: L(CONTACT.ig),
                   href: b.instagramUrl, tip: L(CONTACT.igTip) });
  }

  if (b.hasFacebook && b.facebookUrl) {
    methods.push({ key: 'fb', icon: <FbIcon />, label: L(CONTACT.fb),
                   href: b.facebookUrl, tip: L(CONTACT.fbTip) });
  }

  if (b.email) {
    methods.push({ key: 'email', icon: <Mail size={11} />, label: L(CONTACT.email),
                   href: `mailto:${b.email}`, tip: L(CONTACT.emailTip), value: b.email });
  }

  /**
   * Firma bez webu, u které profil neznáme — přesně ta skupina, kterou uživatel oslovuje přes
   * sítě a dosud si ji dohledával ručně. Nabídneme vyhledávání, ne výsledek.
   */
  if (webStatus(b) !== 'HAS' && !b.facebookUrl && !b.hasFacebook) {
    methods.push({ key: 'fbSearch', icon: <FbIcon />, label: L(CONTACT.fbSearch),
                   href: facebookSearchHref(b), tip: L(CONTACT.fbSearchTip) });
  }

  // Only when nothing else worked. A row from ARES has a name, an address and an IČO and
  // nothing you can call — leaving it with no action at all is what made the whole list feel
  // broken, even though every fact on it was true.
  if (methods.length === 0) {
    methods.push({ key: 'lookup', icon: <Search size={11} />, label: L(CONTACT.lookup),
                   href: lookupHref(b), tip: L(CONTACT.lookupTip) });
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
          {L(CONTACT.heading)}
        </p>
        <span className="flex items-center gap-1.5 shrink-0" title={L(reachHint(b))}>
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">{L(CONTACT.reach)}</span>
          {/* Proužek místo druhého velkého čísla: řádek už jedno má a dvě soutěžící čísla
              se čtou hůř než jedno číslo a jedna délka. */}
          <span className="h-1 w-12 rounded-full bg-ink/10 overflow-hidden" aria-hidden>
            <span className="block h-full bg-ink" style={{ width: `${reach}%` }} />
          </span>
          <span className="text-[10px] tnum text-ink-muted">{reach}</span>
        </span>
      </div>
      <div className="space-y-2">
        {methods.map((m, i) => (
          <div key={m.key} className="flex items-start gap-2.5">
            <a
              href={m.href}
              target={m.key !== 'call' && m.key !== 'email' ? '_blank' : undefined}
              // A search engine has no business knowing which firm our user is about to call.
              referrerPolicy="no-referrer"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs shrink-0 border transition-colors ${
                i === 0
                  ? 'border-ink text-ink font-semibold hover:bg-ink hover:text-white'
                  : 'border-line text-ink-muted hover:border-ink hover:text-ink'
              }`}
            >
              {m.icon}
              {m.label}
            </a>
            <span className="text-[11px] text-ink-faint leading-tight pt-1 min-w-0">
              {m.value && <span className="font-mono text-ink-muted break-all">{m.value}</span>}
              {m.value && ' · '}
              {m.tip}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Row-level chrome, in three languages.
 *
 * Every one of these used to be a Czech literal, which quietly shipped Czech to the Slovak and
 * English builds. The wording is also deliberately factual: "Zastaralý web" is something we
 * measured, whereas the old "Potřebuje nový web" was a sales opinion the data cannot support.
 */
const S = {
  // I tady mluvíme o tom, co jsme našli my, ne o tom, co firma má: sítě čteme jen z odkazů na
  // jejím webu a firma může mít Facebook, na který ze svých stránek neodkazuje.
  noSocial:    { cs: 'Sítě jsme nenašli', sk: 'Siete sme nenašli', en: 'We found no profiles' },
  // Provenience se u odkazu musí říct: jedno je tvrzení firmy, druhé tvrzení mapéra, a ani
  // jedno jsme neověřili — Facebook a Instagram zakazují automatizovaný přístup, takže profil
  // sami načíst nesmíme.
  socialSourceTip: { cs: 'odkaz uvádí web firmy nebo OpenStreetMap; profil sami neověřujeme',
                     sk: 'odkaz uvádza web firmy alebo OpenStreetMap; profil sami neoverujeme',
                     en: 'the link comes from the firm\u2019s site or OpenStreetMap; we do not verify the profile itself' },
  noSocialTip: { cs: 'Na webu firmy jsme nenašli odkaz na žádnou sociální síť.',
                 sk: 'Na webe firmy sme nenašli odkaz na žiadnu sociálnu sieť.',
                 en: 'We found no link to a social profile on the firm’s website.' },
  // „Web nemá" je doložené tvrzení: prošly se domény z názvu i doména z e-mailu. Co doložené
  // není, má vlastní štítek — viz `webUnknown`.
  webNone:     { cs: 'Web nemá',        sk: 'Web nemá',         en: 'No website' },
  webUnknown:  { cs: 'Web neověřen',    sk: 'Web neoverený',    en: 'Website unverified' },
  webUnverifiedTip: { cs: 'Tuhle adresu uvedl zdroj, ale při našem ověření neodpověděla. Web může být dočasně mimo provoz, nebo už nefunguje.',
                      sk: 'Túto adresu uviedol zdroj, ale pri našom overení neodpovedala. Web môže byť dočasne mimo prevádzky, alebo už nefunguje.',
                      en: 'A source gave this address, but it did not answer when we checked. The site may be temporarily down, or gone.' },
  webOld:      { cs: 'Zastaralý web',   sk: 'Zastaraný web',    en: 'Outdated website' },
  webHas:      { cs: 'Mají web',        sk: 'Majú web',         en: 'Has a website' },
  scoreWord:   { cs: 'Skóre',           sk: 'Skóre',            en: 'Score' },
  // ODbL je share-alike: cokoliv odvozeného z OSM musí zdroj pojmenovat. Byla to jediná věta
  // v tomhle bloku, která zůstala natvrdo česky — a přitom je to licenční podmínka, ne popisek.
  // Hledání selhává čtyřmi různými způsoby a každý znamená pro uživatele něco jiného. Dokud
  // se všechny slily do jedné hlášky (nebo do žádné), nedalo se z ní poznat, jestli má počkat,
  // přihlásit se znovu, nebo zúžit dotaz.
  errLogin:   { cs: 'Přihlaste se prosím znovu.', sk: 'Prihláste sa prosím znova.', en: 'Please sign in again.' },
  errDemoUsed:{ cs: 'Ukázkové hledání jste už využili. Zaregistrujte se zdarma a hledejte dál — registrace je bez platební karty.',
                sk: 'Ukážkové hľadanie ste už využili. Zaregistrujte sa zadarmo a hľadajte ďalej — registrácia je bez platobnej karty.',
                en: 'You have used the demo search. Register for free to keep going — no card required.' },
  demoTitle:  { cs: 'Ukázka bez přihlášení',  sk: 'Ukážka bez prihlásenia',  en: 'Preview without an account' },
  demoBody:   { cs: 'Tohle je prvních pět firem z hledání. Telefony, e-maily a weby posíláme jen přihlášeným — v ukázce se nestahují vůbec, takže tu nejsou ani skryté.',
                sk: 'Toto je prvých päť firiem z hľadania. Telefóny, e-maily a weby posielame len prihláseným — v ukážke sa nesťahujú vôbec, takže tu nie sú ani skryté.',
                en: 'These are the first five firms from the search. Phones, e-mails and websites go to signed-in users only — the preview never downloads them, so they are not hidden here, they are absent.' },
  demoCta:    { cs: 'Registrovat se zdarma',  sk: 'Registrovať sa zadarmo',  en: 'Register for free' },
  demoPerk:   { cs: '5 hledání měsíčně, 20 výsledků na hledání, kontakty a export do CSV.',
                sk: '5 hľadaní mesačne, 20 výsledkov na hľadanie, kontakty a export do CSV.',
                en: '5 searches a month, 20 results each, contacts and CSV export.' },
  emptyByFilter: {
    cs: 'Firem jsme našli {n}, ale zvolenému filtru nevyhověla ani jedna. To je platný výsledek, ne chyba — zkuste filtr vypnout nebo zvolit jiný scénář.',
    sk: 'Firiem sme našli {n}, ale zvolenému filtru nevyhovela ani jedna. To je platný výsledok, nie chyba — skúste filter vypnúť alebo zvoliť iný scenár.',
    en: 'We found {n} firms, but not one matches the filter you picked. That is a valid result, not a fault — try turning the filter off or picking another scenario.',
  },
  loadingCity:    { cs: 'Hledám v ARESu a OpenStreetMap…',
                    sk: 'Hľadám v ARESe a OpenStreetMap…',
                    en: 'Searching ARES and OpenStreetMap…' },
  // Dřív tu stálo „může trvat 1–2 minuty", což po rozpadu na města neplatí. Slíbený čas,
  // který se nedodrží, je horší než žádný.
  loadingWholeCz: { cs: 'Procházím krajská města jedno po druhém. Výsledky přibývají průběžně.',
                    sk: 'Prechádzam krajské mestá jedno po druhom. Výsledky pribúdajú priebežne.',
                    en: 'Going through the regional capitals one by one. Results come in as they are found.' },
  jobRunning:  { cs: 'Hledám na pozadí',  sk: 'Hľadám na pozadí',  en: 'Searching in the background' },
  jobQueued:   { cs: 'Spouštím hledání…',  sk: 'Spúšťam hľadanie…',  en: 'Starting the search…' },
  jobFound:    { cs: 'nalezeno firem',     sk: 'nájdených firiem',   en: 'firms found' },
  jobDone:     { cs: 'zpracováno',         sk: 'spracovaných',       en: 'processed' },
  jobLeft:     { cs: 'zbývá zhruba {t}',   sk: 'zostáva zhruba {t}', en: 'about {t} left' },
  jobCanLeave: { cs: 'Kartu můžete zavřít — hledání běží dál a výsledky tu na vás počkají.',
                 sk: 'Kartu môžete zavrieť — hľadanie beží ďalej a výsledky tu na vás počkajú.',
                 en: 'You can close the tab — the search keeps running and the results will wait for you.' },
  // Bez skloňování schválně: „Hledám v Brně" by znamenalo vyskloňovat čtrnáct jmen měst ve
  // třech jazycích. Pomlčka řekne totéž a nezalže ani u Ústí nad Labem.
  jobStage:    { cs: '{city} — {i}. ze {n} měst',  sk: '{city} — {i}. zo {n} miest',
                 en: '{city} — city {i} of {n}' },
  // Nahrazuje `jobCanLeave` u hledání po městech. Tam kartu zavřít nelze: navazující fázi
  // spouští právě dotaz na průběh, takže zavřenou kartou se hledání zastaví.
  jobStaged:   { cs: 'Hledání pokračuje město po městě, dokud máte tuhle stránku otevřenou.',
                 sk: 'Hľadanie pokračuje mesto po meste, kým máte túto stránku otvorenú.',
                 en: 'The search continues city by city for as long as this page stays open.' },
  jobFailed:   { cs: 'Hledání se zastavilo',  sk: 'Hľadanie sa zastavilo',  en: 'The search stopped' },
  jobPartial:  { cs: 'Co se stihlo najít, zůstalo uložené a dá se exportovat.',
                 sk: 'Čo sa stihlo nájsť, zostalo uložené a dá sa exportovať.',
                 en: 'What was found is saved and can be exported.' },
  demoLocked: { cs: 'Kontakty jsou jen pro přihlášené',
                sk: 'Kontakty sú len pre prihlásených',
                en: 'Contacts are for signed-in users' },
  errPlan:    { cs: 'Vyčerpali jste počet hledání ve svém plánu.',
                sk: 'Vyčerpali ste počet hľadaní vo svojom pláne.',
                en: 'You have used up the searches in your plan.' },
  errBurst:   { cs: 'Hledání jde rychle za sebou. Dejte tomu pár minut — data taháme z veřejných rejstříků, které je potřeba šetřit.',
                sk: 'Hľadania idú rýchlo za sebou. Dajte tomu pár minút — dáta ťaháme z verejných registrov, ktoré treba šetriť.',
                en: 'That is a lot of searches in a row. Give it a few minutes — the data comes from public registers we have to go easy on.' },
  /**
   * Rada „zvolte jeden kraj" tu stála i pro uživatele, který jeden kraj vybraný měl — takže mu
   * aplikace poradila udělat to, co už udělal, a on neměl co zkusit. Zúžení navíc není to, co
   * tenhle stav způsobuje: hledání padá na čase, který trvá ověřování webů, ne na velikosti
   * kraje. Nová hláška říká, co se stalo, a nabízí jen to, co uživatel opravdu udělat může.
   */
  errTimeout: { cs: 'Hledání nestihlo doběhnout v časovém limitu — trvá to ověřování webů u nalezených firem, ne velikost kraje. Zkuste to prosím znovu; když to spadne i podruhé, dejte mi vědět.',
                sk: 'Hľadanie nestihlo dobehnúť v časovom limite — spôsobuje to overovanie webov u nájdených firiem, nie veľkosť kraja. Skúste to prosím znova; ak to spadne aj druhýkrát, dajte mi vedieť.',
                en: 'The search ran out of time — that is the website checking on the firms we found, not the size of the region. Please try again; if it fails a second time, tell me.' },
  /** Celá ČR je jediný případ, kde je zúžení skutečně ta správná rada. */
  errTimeoutWholeCz: { cs: 'Hledání přes celou ČR nestihlo doběhnout v časovém limitu. Zvolte prosím jeden kraj — nad celou republikou je firem tolik, že se ověřování webů do limitu nevejde.',
                sk: 'Hľadanie cez celú ČR nestihlo dobehnúť v časovom limite. Zvoľte prosím jeden kraj — nad celou republikou je firiem toľko, že sa overovanie webov do limitu nezmestí.',
                en: 'A nationwide search ran out of time. Please pick a single region — across the whole country there are too many firms for the website checks to finish in time.' },
  errServer:  { cs: 'Hledání se nepodařilo — chyba na naší straně. Zkuste to prosím znovu.',
                sk: 'Hľadanie sa nepodarilo — chyba na našej strane. Skúste to prosím znova.',
                en: 'The search failed on our side. Please try again.' },
  errNetwork: { cs: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.',
                sk: 'Nepodarilo sa spojiť so serverom. Skontrolujte pripojenie a skúste to znova.',
                en: 'Could not reach the server. Check your connection and try again.' },
  attribution: { cs: 'Část dat: © přispěvatelé OpenStreetMap (ODbL) · údaje o firmách z veřejného rejstříku ARES',
                 sk: 'Časť dát: © prispievatelia OpenStreetMap (ODbL) · údaje o firmách z verejného registra ARES',
                 en: 'Some data: © OpenStreetMap contributors (ODbL) · business records from the Czech ARES register' },
  meetsOf:     { cs: 'Splňuje {n} z {total} kritérií',
                 sk: 'Spĺňa {n} z {total} kritérií',
                 en: 'Meets {n} of {total} criteria' },
  // Appended when a criterion could not be judged. Saying "nesplňuje" about something we never
  // looked up would be the app claiming more than it knows.
  unanswered:  { cs: ' · u {k} nemáme data',
                 sk: ' · pri {k} nemáme dáta',
                 en: ' · no data for {k}' },
};

/**
 * Same rule as the website badge. Social profiles are only ever read off the firm's own
 * homepage, so on a row where no page was found all three flags are false because nobody
 * looked — and "Bez soc. sítí" was the app saying so out loud. `socialsChecked` records
 * whether there was ever an answer to give.
 */
function SocialLinks({ b, locale }: { b: BusinessResult; locale: string }) {
  const hasSocial = b.hasFacebook || b.hasInstagram || b.hasLinkedIn;
  if (!hasSocial) {
    if (!b.socialsChecked) return null;
    return (
      <span className="badge" title={localized(S.noSocialTip, locale)}>
        <Users size={10} />{localized(S.noSocial, locale)}
      </span>
    );
  }
  /**
   * Náhradní odkaz, když víme o profilu, ale neznáme jeho adresu, je vždycky *vyhledávání*,
   * nikdy uhodnutá adresa profilu. `instagram.com/<název firmy>` tu dřív stálo jako by to byl
   * její profil — přitom to je adresa, kterou jsme si vymysleli, a klidně patří někomu jinému.
   */
  const q = encodeURIComponent(b.name ?? '');
  const links: Array<[boolean, string, React.ReactNode, string]> = [
    [b.hasFacebook,  b.facebookUrl  ?? `https://www.facebook.com/search/top?q=${q}`,                       <FbIcon key="f" />, 'Facebook'],
    [b.hasInstagram, b.instagramUrl ?? `https://www.instagram.com/explore/search/keyword/?q=${q}`,         <IgIcon key="i" />, 'Instagram'],
    [b.hasLinkedIn,  b.linkedInUrl  ?? `https://www.linkedin.com/search/results/all/?keywords=${q}`,       <LiIcon key="l" />, 'LinkedIn'],
  ];
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {links.filter(([on]) => on).map(([, href, icon, label]) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
           title={`${label} — ${localized(S.socialSourceTip, locale)}`}
           className="badge hover:border-ink hover:text-ink transition-colors">
          {icon} {label}
        </a>
      ))}
    </span>
  );
}

/**
 * The website badge — and the rule the whole row follows: we print what we found, and stay
 * quiet about what we did not.
 *
 * This used to render "Web neuveden" for every unresolved row, in the same strip as "IČO" and
 * "Mají web", where everything else is a fact about the firm. Readers took it for one, and for
 * most rows it was wrong: ARES has no website column at all and OpenStreetMap tags a website on
 * a minority of what it maps, so a firm with a perfectly good site was labelled as lacking one
 * on the strength of us never having looked. There is no wording that fixes that, because the
 * problem was making a statement at all. So UNKNOWN now renders nothing.
 */
function WebsiteStatusBadge({ b, locale }: { b: BusinessResult; locale: string }) {
  const status = webStatus(b);
  /**
   * Tři stavy, tři různé věty — a žádná mlčky.
   *
   * Dřív se UNKNOWN nevykresloval vůbec, protože se za ním schovávalo „nedívali jsme se" a psát
   * o tom cokoli by byla lež. Od chvíle, kdy dohledávání umí říct „prošel jsem všechny domény
   * z názvu a nic tam není", je NONE doložené tvrzení — a zbytek se má přiznat nahlas, ne
   * splynout s ním. Důvod je v obou případech v bublině (`websiteEvidence`).
   */
  if (status === 'UNKNOWN') {
    return (
      <span className="badge text-ink-faint" title={b.websiteEvidence || undefined}>
        <Globe size={10} />{localized(S.webUnknown, locale)}
      </span>
    );
  }
  if (status === 'NONE') {
    return (
      <span className="badge-red" title={b.websiteEvidence || undefined}>
        <Globe size={10} />{localized(S.webNone, locale)}
      </span>
    );
  }
  const scoreLabel = b.websiteScore && b.websiteScore !== 50 ? ` (${b.websiteScore}/100)` : '';
  const tooltip = b.websiteAgeNote
    ? `${b.websiteAgeNote}${scoreLabel}`
    : (scoreLabel ? `${localized(S.scoreWord, locale)}${scoreLabel}` : '');
  if (b.websiteIsOld) {
    return (
      <span className="badge-accent" title={tooltip || undefined}>
        <Clock size={10} />{localized(S.webOld, locale)}{scoreLabel}
      </span>
    );
  }
  return (
    <span className="badge" title={tooltip || undefined}>
      <Globe size={10} />{localized(S.webHas, locale)}{scoreLabel}
    </span>
  );
}

/**
 * A row can come from more than one source — the search merges them and stores the ids joined
 * by `+`. Google Maps and Firmy.cz are marked as historical: those sources were switched off
 * in Vlna 2 for licensing reasons and only older rows still carry them.
 */
const SOURCE_LABELS: Record<string, string> = {
  ares:   'ARES',
  osm:    'OpenStreetMap',
  csv:    'Vlastní import',
  google: 'Google Maps (historické)',
  firmy:  'Firmy.cz (historické)',
};

function isHistoricalSource(source?: string): boolean {
  return (source ?? '').split('+').some(id => id === 'google' || id === 'firmy');
}

/**
 * Odkud řádek pochází — ale jen když se to od zbytku tabulky liší.
 *
 * Když hledání vrátí 494 firem z ARESu a 6 z OpenStreetMap, napsat „ARES" na každý řádek
 * znamená pětsetkrát zopakovat, co je vidět z toho, že to nikde nestojí. Zajímavá je menšina:
 * šest řádků, které přišly z mapy, a u kterých proto bývá telefon. Tady je štítek informace,
 * všude jinde šum. Když je zdroj v tabulce jediný, nezobrazí se vůbec nic.
 */
function SourceBadge({ source, common }: { source?: string; common?: string | null }) {
  const own = source ?? 'ares';
  if (own === common) return null;
  const ids = own.split('+').filter(Boolean);
  return (
    <>
      {ids.map(id => (
        <span key={id} className="text-[10px] uppercase tracking-wider text-ink-faint">
          {SOURCE_LABELS[id] ?? id}
        </span>
      ))}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SearchPage() {
  const t = useTranslations('search');
  const locale = useLocale();
  const isCs = locale === 'cs' || locale === 'sk';

  const [userPlan, setUserPlan] = useState<string>('FREE');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUserPlan(d.user?.plan ?? 'FREE')).catch(() => {});
  }, []);

  const [region, setRegion]               = useState('');
  const [customRegion, setCustomRegion]   = useState('');
  const [industry, setIndustry]           = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  /** Text v našeptávači oborů. Prázdný, dokud uživatel nezačne psát. */
  const [industryQuery, setIndustryQuery] = useState('');
  const [industryOpen, setIndustryOpen]   = useState(false);
  /** Id ze SCENARIOS. Předvyplní se podle profese z onboardingu, uživatel ho může přepnout. */
  const [scenario, setScenario]           = useState('all');

  // ── Profile ───────────────────────────────────────────────────────────────
  // The profile decides two things: what the form starts out as, and how the results are
  // ranked. Both are just defaults — everything stays editable in place.
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [showOnboarding, setShowOnboarding] = useState(false);

  /** Fill in only what the user has not already typed, so a reload never eats their input. */
  function applyProfile(p: UserProfile) {
    setProfile(p);
    if (p.targetRegion)   setRegion(r => r || p.targetRegion!);
    if (p.targetIndustry) {
      setIndustry(i => i || p.targetIndustry!);
      // Bez tohohle by našeptávač zůstal prázdný, i když je obor z profilu vybraný — uživatel
      // by viděl prázdné pole a nevěděl, co se vlastně bude hledat.
      setIndustryQuery(q => q || industryLabelFor(p.targetIndustry!, locale));
    }
    // Scénář je jen výchozí hodnota přepínače; jakmile s ním uživatel hnul, profil ho nepřebíjí.
    if (p.profession && SCENARIO_BY_PROFESSION[p.profession]) {
      setScenario(sc => (sc === 'all' ? SCENARIO_BY_PROFESSION[p.profession!] : sc));
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d.user) return;
        applyProfile(d.user as UserProfile);
        // `?welcome=1` comes from the registration redirect; `onboardedAt` covers everyone who
        // arrived some other way and has never been asked.
        const welcomed = new URLSearchParams(window.location.search).has('welcome');
        if (welcomed || !d.user.onboardedAt) setShowOnboarding(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  function closeOnboarding(saved: UserProfile | null) {
    setShowOnboarding(false);
    if (saved) applyProfile(saved);
    else setProfile(p => ({ ...p, onboardedAt: new Date().toISOString() }));
    // Drop `?welcome=1` so a refresh does not reopen the modal.
    window.history.replaceState({}, '', window.location.pathname);
  }

  /**
   * Filtr „Jen fungující podniky" startuje zapnutý.
   *
   * Bez něj je v každém výsledku zhruba třetina lidí, kteří mají živnost, ale žádnou aktivní
   * provozovnu — na mapě se přes ně nedá klikat a v seznamu se v nich nedá číst. Vypnout ho jde
   * jedním kliknutím na tentýž chip, takže výchozí zapnutí nic neschovává natrvalo.
   */
  const [active, setActive]               = useState<Set<string>>(new Set(['working']));
  const [results, setResults]             = useState<BusinessResult[]>([]);
  const [searchId, setSearchId]           = useState<string | null>(null);
  /** Výsledky pocházejí z ukázky pro nepřihlášené: pět řádků, kontakty server vůbec neposlal. */
  const [isDemo, setIsDemo]               = useState(false);
  /** Běžící hledání na pozadí. `null` = žádné neběží ani nedoběhlo v tomhle okně. */
  const [job, setJob]                     = useState<JobState | null>(null);
  /** Seznam, nebo mapa. Výchozí je seznam — mapa umí zobrazit jen firmy se souřadnicemi. */
  const [view, setView]                   = useState<'list' | 'map'>('list');
  /**
   * Skrývat na mapě firmy, se kterými už uživatel skončil (osloveno / klient / nezájem).
   *
   * Výchozí zapnuto: po pár týdnech práce je většina bodů na mapě hotová věc a nová
   * příležitost se v nich hledá hůř než první den. Platí to jen pro mapu — v seznamu zůstanou
   * všechny řádky, protože zmizet uživateli řádek, který si sám označil, je ta nejhorší
   * možná odměna za označování.
   */
  const [hideDone, setHideDone]           = useState(true);
  /**
   * Značky, které uživatel nastavil v tomhle sezení.
   *
   * Drží se zvlášť od `results`, aby se změna projevila okamžitě a nečekala na doběhnutí
   * požadavku ani na další kolo dotazování — a hlavně aby ji další dávka výsledků nepřepsala.
   */
  const [tags, setTags]                   = useState<Record<string, LeadStatus>>({});
  /** Kolik řádků už máme. V refu, ne ve stavu — čte to interval, který se kvůli tomu nemá restartovat. */
  const resultsRef = useRef(0);
  const [loading, setLoading]             = useState(false);
  const [loadingMsg, setLoadingMsg]       = useState('');
  const [error, setError]                 = useState('');
  const [hasSearched, setHasSearched]     = useState(false);

  const effectiveRegion   = region === '__custom__'   ? customRegion   : region;
  /**
   * Co se pošle do API. Vybraná položka vyhrává; když uživatel jen píše a nic nevybral, jde
   * jeho text — pipeline si s ním poradí (`resolveNiche` hledá i podle českých slov), takže
   * „jiný obor" už nepotřebuje vlastní volbu v seznamu.
   */
  const effectiveIndustry = industry || industryQuery.trim() || customIndustry;

  /**
   * Text v poli je zároveň vybraná hodnota — po výběru oboru v něm stojí jeho název. Kdyby se
   * ten text bral i jako filtr nabídky, propustil by od té chvíle jedinou položku: právě ten
   * vybraný obor. Uživatel by pak obor nemohl přepnout, protože by mu nabídka nabízela jen to,
   * co už má. Vybraná hodnota se proto jako filtr nepočítá — jakmile uživatel začne psát,
   * `onChange` výběr zruší a filtrování se rozjede normálně.
   */
  const industryPicked = Boolean(industry) && industryQuery === industryLabelFor(industry, locale);

  /** Obory, které odpovídají tomu, co uživatel napsal. Bez diakritiky, aby „zubar" našel „Zubaři". */
  const industryMatches = (() => {
    const groups = INDUSTRIES[locale] ?? INDUSTRIES.en;
    const all = groups.flatMap(g => g.items.map(i => ({ ...i, group: g.group })));
    const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = industryPicked ? '' : norm(industryQuery.trim());
    // Bez filtru se nabídne všechno. Dřív tu byl strop 40, jenže českých oborů je 41 — poslední
    // („Podlaháři") tak nešel vybrat nikdy, ani s prázdným polem.
    if (!q) return all;
    return all.filter(i => norm(i.label).includes(q) || norm(i.group).includes(q));
  })();

  /**
   * Očekávaná výtěžnost pro vybraný obor. Ukazuje se před hledáním, aby uživatel dopředu věděl,
   * že u kadeřnic bude webů málo — jinak by po hledání usoudil, že je aplikace rozbitá.
   */
  const yieldNote = (() => {
    if (!effectiveIndustry) return null;
    const note = YIELD_NOTE[yieldFor(effectiveIndustry)];
    return note ? localized(note, locale) : null;
  })();

  /** Every active filter has to hold — combining is always AND. Best opportunities first. */
  const filtered = results
    .filter(b => matchesAll(b, active))
    .sort((a, b) => b.leadScore - a.leadScore || a.name.localeCompare(b.name, 'cs'));

  /**
   * Nejčastější zdroj mezi zobrazenými řádky. Řádky, které z něj pocházejí, štítek nedostanou —
   * viz `SourceBadge`. Počítá se z filtrovaných dat, ne ze všech: co je v tabulce většina, to
   * čtenář bere jako výchozí stav, i když to v celém výsledku většina není.
   */
  const commonSource = (() => {
    const counts = new Map<string, number>();
    for (const b of filtered) {
      const id = b.source ?? 'ares';
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    let best: string | null = null;
    let most = 0;
    // `Array.from`, ne iterace přes Map — cílový ES v tsconfigu ji přímo neumí.
    for (const [id, n] of Array.from(counts.entries())) if (n > most) { best = id; most = n; }
    return best;
  })();

  const toggle = (id: string) =>
    setActive(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  /**
   * How many rows this chip would leave if it were the *next* one turned on. Showing the count
   * against the already-filtered set stops the user from clicking their way to zero results.
   */
  const countFor = (id: string) => {
    const withIt = new Set(active).add(id);
    return results.filter(b => matchesAll(b, withIt)).length;
  };

  const isWholeCzech = (r: string) =>
    ['celá čr', 'cela cr', 'celá cr'].includes(r.toLowerCase().trim());

  /**
   * Obnovení hledání z adresy.
   *
   * Bez tohohle by zavření karty znamenalo ztrátu obrazovky, i když jsou výsledky v databázi:
   * `job` je stav komponenty a reload ho smaže. `?job=<id>` v adrese je to, co uživateli dovolí
   * kartu zavřít a vrátit se — a je to zároveň cíl odkazů z přehledu hledání.
   */
  /**
   * Volba „skrýt vyřízené" přežije obnovení stránky.
   *
   * Čte se až po připojení komponenty, ne při inicializaci stavu: `localStorage` na serveru
   * neexistuje a odlišný první render by Reactu rozhodil hydrataci.
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HIDE_DONE_KEY);
      if (saved !== null) setHideDone(saved === '1');
    } catch { /* soukromé okno */ }
  }, []);

  const toggleHideDone = () => {
    setHideDone(prev => {
      const next = !prev;
      try { localStorage.setItem(HIDE_DONE_KEY, next ? '1' : '0'); } catch { /* soukromé okno */ }
      return next;
    });
  };

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('job');
    if (!id) return;
    setHasSearched(true);
    setLoading(true);
    fetch(`/api/jobs/${id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return;
        resultsRef.current = d.results.length;
        setResults(d.results);
        setSearchId(d.job.searchId);
        setJob(d.job);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /**
   * Dotazování na běžící job.
   *
   * Co dvě sekundy se zeptáme na stav a na řádky, které od minula přibyly — posílá se jen
   * přírůstek (`from`), ne celých pět set firem pokaždé. Interval se zruší, jakmile je job
   * hotový nebo spadlý, i když uživatel mezitím odejde na jinou stránku.
   *
   * Když se dotaz nepovede, nic se nemaže: rozpracované výsledky na obrazovce zůstanou a další
   * kolo to zkusí znovu. Jediná chyba sítě nemá zahodit práci, která už je v databázi.
   */
  useEffect(() => {
    if (!job || job.status === 'done' || job.status === 'failed') return;
    let stopped = false;

    // Když jedno kolo trvá dýl než dvě sekundy, druhé se nespustí. Bez tohohle by si obě
    // vyzvedla řádky od stejného offsetu a v seznamu by byly dvakrát.
    let running = false;

    const tick = async () => {
      if (running || stopped) return;
      running = true;
      try {
        const res = await fetch(`/api/jobs/${job.id}?from=${resultsRef.current}`);
        if (!res.ok) return;
        const data = await res.json();
        if (stopped) return;
        if (data.results?.length) {
          /**
           * Posun offsetu patří sem, ne dovnitř `setResults`.
           *
           * Updater předaný do `setState` musí být čistá funkce — React ho ve vývojovém
           * režimu schválně volá dvakrát, aby nečisté updatery odhalil. Když se v něm
           * inkrementoval ref, napočítal dvojnásobek, klient si od serveru vyžádal řádky
           * od příliš vysokého offsetu a doplňování se v půlce zastavilo.
           */
          resultsRef.current += data.results.length;
          setResults(prev => [...prev, ...data.results]);
        }
        setJob(j => (j ? { ...j, ...data.job } : j));
      } catch {
        /* síť vypadla — zkusíme to za dvě sekundy znovu */
      } finally {
        running = false;
      }
    };

    void tick();
    const timer = setInterval(tick, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, [job?.id, job?.status]);

  /**
   * Odhad zbývajícího času z toho, co už proběhlo.
   *
   * Žádný model, jen trojčlenka: kolik sekund zabralo `processedCount` firem, tolik ku jedné
   * zabere i zbytek. Dokud není zpracovaných aspoň deset, neukazuje se nic — první sekundy
   * zkresluje načítání ze zdrojů a odhad z nich by byl číslo vycucané z prstu.
   */
  const remainingLabel = (() => {
    if (!job || !job.startedAt || job.status !== 'running') return null;
    // U hledání po městech by to bylo číslo bez významu: `startedAt` je začátek posledního
    // běhu, kdežto `processedCount` je součet přes všechny. Radši nic než vymyšlený odhad.
    if (job.stageCount > 1) return null;
    if (job.processedCount < 10 || job.foundCount <= job.processedCount) return null;
    const elapsed = (Date.now() - new Date(job.startedAt).getTime()) / 1000;
    const perFirm = elapsed / job.processedCount;
    const seconds = Math.round((job.foundCount - job.processedCount) * perFirm);
    if (seconds < 5) return null;
    if (seconds < 90) return `${seconds} s`;
    return `${Math.round(seconds / 60)} min`;
  })();

  /**
   * Uloží, kde je uživatel s danou firmou.
   *
   * Nejdřív se to projeví na obrazovce a teprve pak jde požadavek na server. Kdyby to bylo
   * naopak, každé kliknutí by na půl sekundy nedělalo nic. Když zápis selže, značka se vrátí
   * zpátky — nechat na mapě barvu, která se neuložila, by bylo horší než chybová hláška.
   */
  const setLeadStatus = async (leadId: string, status: LeadStatus) => {
    const previous = tags[leadId];
    setTags(t => ({ ...t, [leadId]: status }));
    try {
      const res = await fetch(`/api/leads/${leadId}/tag`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('save failed');
    } catch {
      setTags(t => {
        const next = { ...t };
        if (previous) next[leadId] = previous; else delete next[leadId];
        return next;
      });
    }
  };

  /** Stav firmy: co uživatel právě naklikal, jinak co přišlo ze serveru. */
  const statusOf = (b: BusinessResult): string | null =>
    tags[b.id] ?? b.tags?.[0]?.status ?? null;

  /**
   * Co uvidí mapa. Vyřízené firmy se z ní vyndají tady, ne uvnitř mapy — ta má kreslit, ne
   * rozhodovat, co je vidět. Seznam níž pracuje pořád s `filtered`, tedy se vším.
   */
  const mapLeads   = hideDone ? filtered.filter(b => !isDone(statusOf(b))) : filtered;
  const hiddenDone = filtered.length - mapLeads.length;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRegion || !effectiveIndustry) return;
    setLoading(true);
    setError('');
    setResults([]);
    resultsRef.current = 0;
    setJob(null);
    setActive(new Set());
    setHasSearched(true);
    setLoadingMsg(localized(
      isWholeCzech(effectiveRegion) ? S.loadingWholeCz : S.loadingCity,
      locale,
    ));
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: effectiveRegion, industry: effectiveIndustry }),
      });
      if (!res.ok) {
        // Podle stavu, ne podle těla odpovědi: u 504 vrací platforma HTML, ne JSON, takže
        // `res.json()` na něm vyhodí výjimku — a dřív spadl celý handler, spinner zmizel
        // a uživatel zůstal koukat na prázdnou stránku bez vysvětlení.
        // 429 znamená dvě různé věci: přihlášenému „moc rychle za sebou", nepřihlášenému
        // „ukázka je vyčerpaná". Rozliší je kód v těle, a když tělo není JSON, zůstane
        // původní hláška.
        let code = '';
        if (res.status === 429) {
          code = await res.json().then(d => d?.code ?? '').catch(() => '');
        }
        const byStatus =
          res.status === 401 ? S.errLogin  :
          res.status === 403 ? S.errPlan   :
          code === 'DEMO_USED' ? S.errDemoUsed :
          res.status === 429 ? S.errBurst  :
          res.status === 504 || res.status === 408
            ? (isWholeCzech(effectiveRegion) ? S.errTimeoutWholeCz : S.errTimeout) :
          S.errServer;
        setError(localized(byStatus, locale));
        return;
      }
      const data = await res.json();

      // Scénář se promítne hned, jako předem zapnuté filtry. Uživatel je pak vidí mezi
      // ostatními chipy a může je vypnout — nic se před ním neschovává.
      setActive(new Set(scenarioById(scenario).filters));

      // Ukázka pro nepřihlášené doběhne rovnou v odpovědi — pět řádků, není co sledovat.
      if (data.demo) {
        setResults(data.results);
        setSearchId(null);
        setIsDemo(true);
        return;
      }

      // Přihlášené hledání běží na pozadí. Odpověď nese jen id; výsledky si vyzvedáváme sami.
      setIsDemo(false);
      setSearchId(data.searchId ?? null);
      setJob({
        id: data.jobId, searchId: data.searchId, status: 'queued',
        foundCount: 0, processedCount: 0, startedAt: null, error: null,
        // Kolik fází hledání má, ví server. Než odpoví poprvé, tvrdíme jednu — jinak by
        // se na vteřinu ukázalo „1. ze 0 měst".
        stageIndex: 0, stageCount: 1, stageLabel: null,
      });
      // Adresa je teď odkaz na tenhle běh. Kdo kartu zavře a otevře ji znovu, uvidí totéž.
      window.history.replaceState({}, '', `${window.location.pathname}?job=${data.jobId}`);
    } catch {
      setError(localized(S.errNetwork, locale));
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const popularChips = POPULAR_CHIPS[locale] ?? POPULAR_CHIPS.en;
  const isPro = userPlan === 'PRO' || userPlan === 'BUSINESS';

  return (
    <div className="min-h-screen bg-surface pt-16">
      {showOnboarding && (
        <OnboardingModal locale={locale} initial={profile} onDone={closeOnboarding} />
      )}

      <div className="border-b border-line bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-ink mb-1">{t('title')}</h1>
          <p className="text-ink-muted text-sm">
            {localized({
              cs: 'Vyberte kraj a obor. Data z veřejného rejstříku ARES a z OpenStreetMap.',
              sk: 'Vyberte kraj a odbor. Dáta z verejného registra ARES a z OpenStreetMap.',
              en: 'Pick a region and a trade. Data from the ARES public registry and OpenStreetMap.',
            }, locale)}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Search form ── */}
        <form onSubmit={handleSearch} className="card mb-6">
          {/*
            Zkratky na nejčastější obory patří nad celý řádek, ne dovnitř sloupce s oborem.
            Dokud byly uvnitř, byl ten sloupec o dva řádky vyšší než sousední — a protože se
            mřížka zarovnává na spodní hranu, výběr regionu klesl dolů a nad ním zela prázdná
            plocha přes půl karty. Nahoře navíc čtou líp: je to volba, ne dekorace pole.
          */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {popularChips.map(chip => (
              <button
                key={chip.value}
                type="button"
                // Název bereme od oboru, ne od chipu: chip „Reality" míří na obor „Realitní
                // kancelář" a jeho vlastní popisek by v poli zůstal jako text, který nesedí na
                // žádnou položku nabídky.
                onClick={() => { setIndustry(chip.value); setIndustryQuery(industryLabelFor(chip.value, locale)); }}
                className={industry === chip.value ? 'chip-active' : 'chip'}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Scénář. Jen vybírá a řadí to, co se stáhne — do vyhledávání nezasahuje. */}
          <div className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-line">
            <span className="w-full md:w-auto md:mr-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              {localized({ cs: 'Scénář', sk: 'Scenár', en: 'Scenario' }, locale)}
            </span>
            {SCENARIOS.map(sc => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScenario(sc.id)}
                className={scenario === sc.id ? 'chip-active' : 'chip'}
              >
                {localized(sc.label, locale)}
              </button>
            ))}
            <p className="w-full text-[11px] text-ink-faint leading-snug mt-0.5">
              {localized(scenarioById(scenario).hint, locale)}
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-4 items-start">

            {/* Region select */}
            <div className="md:col-span-2">
              <label className="label">
                {t('region_label')}
              </label>
              <div className="relative">
                <select
                  className="input appearance-none pr-9 cursor-pointer"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  required={region !== '__custom__'}
                >
                  <option value="">{localized({ cs: '— Vyberte region —', sk: '— Vyberte región —', en: '— Select region —' }, locale)}</option>
                  {REGIONS.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">{localized({ cs: 'Jiné město (zadat ručně)', sk: 'Iné mesto (zadať ručne)', en: 'Other (type manually)' }, locale)}</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              </div>
              {region === '__custom__' && (
                <input
                  className="input mt-2"
                  placeholder={localized({ cs: 'Název města nebo oblasti…', sk: 'Názov mesta alebo oblasti…', en: 'City or region name…' }, locale)}
                  value={customRegion}
                  onChange={e => setCustomRegion(e.target.value)}
                  required
                  autoFocus
                />
              )}
            </div>

            {/* Industry — našeptávač.
                Dřív to byl rozbalovací seznam se 41 položkami v sedmi skupinách plus zvláštní
                volba „jiný obor". Kdo hledá zubaře, musel je najít očima; kdo hledá něco, co
                v seznamu není, musel napřed pochopit, že si má rozkliknout poslední položku.
                Psaní zvládne obojí naráz: filtruje seznam a zároveň je to ten volný text. */}
            <div className="md:col-span-2">
              <label className="label">
                {t('industry_label')}
              </label>

              <div className="relative">
                <input
                  className="input pr-9"
                  value={industryQuery}
                  placeholder={isCs ? 'Začněte psát: zubaři, restaurace, autoservis…' : 'Start typing: dentists, restaurants…'}
                  onChange={e => { setIndustryQuery(e.target.value); setIndustry(''); setIndustryOpen(true); }}
                  // Text se označí, aby první stisknutá klávesa přepsala vybraný obor a nepsala se
                  // za něj — jinak by z „Kadeřnictví" + „zub" vzniklo „Kadeřnictvízub", což
                  // neodpovídá žádnému oboru. `onMouseUp` musí zabránit výchozímu chování, jinak
                  // by kliknutí myší označení hned zrušilo a postavilo kurzor na konec.
                  onFocus={e => { setIndustryOpen(true); e.currentTarget.select(); }}
                  onMouseUp={e => e.preventDefault()}
                  // Kliknutí na položku seznamu způsobí blur dřív, než se stihne zpracovat —
                  // proto se zavírá se zpožděním, ne okamžitě.
                  onBlur={() => setTimeout(() => setIndustryOpen(false), 150)}
                  aria-expanded={industryOpen}
                  aria-autocomplete="list"
                  role="combobox"
                />
                {industryOpen && (
                  <ul className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-surface-subtle border border-ink">
                    {industryMatches.map(item => (
                      <li key={item.value}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-ink hover:text-white transition-colors"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            setIndustry(item.value);
                            setIndustryQuery(item.label);
                            setIndustryOpen(false);
                          }}
                        >
                          {item.label}
                          <span className="text-ink-faint ml-2 text-xs">{item.group}</span>
                        </button>
                      </li>
                    ))}
                    {industryMatches.length === 0 && (
                      /* Dřív se nabídka při nula shodách nevykreslila vůbec a pole vypadalo mrtvě.
                         Uživatel ale svůj text posílá do hledání dál — pipeline si s volným
                         výrazem poradí — takže se to říká rovnou. */
                      <li className="px-3 py-2 text-sm text-ink-faint">
                        {isCs
                          ? 'Žádný obor tomu neodpovídá. Hledat půjde i tak — pošleme to jako text.'
                          : 'No trade matches that. You can still search — we will send it as free text.'}
                      </li>
                    )}
                  </ul>
                )}
              </div>

            </div>

            {/* Odsazení o výšku popisku: sloupec s tlačítkem žádný nemá, a bez toho by tlačítko
                v mřížce zarovnané nahoru sedělo nad poli místo vedle nich. */}
            <button type="submit" disabled={loading || !effectiveRegion || !effectiveIndustry}
              className="btn-primary h-[42px] md:mt-[23px]">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {t('searching')}
                </span>
              ) : t('search_button')}
            </button>
          </div>

          {/* Pod mřížkou, ne v ní: uvnitř sloupce tahle věta rozhodila zarovnání polí. */}
          {yieldNote && (
            <p className="text-[11px] text-ink-faint mt-2 leading-snug max-w-2xl">{yieldNote}</p>
          )}

          {/* Kolečko se točí jen v tlačítku. Dvě identická pár centimetrů od sebe byla jen hluk. */}
          {loading && loadingMsg && (
            <p className="mt-4 text-sm text-ink-muted border-t border-line pt-4">{loadingMsg}</p>
          )}
        </form>

        {error && (
          <div className="rounded-lg border border-ink px-4 py-3 text-sm font-medium text-ink mb-4">{error}</div>
        )}

        {job && job.status !== 'done' && (
          <div className="mb-6 border border-line rounded-xl p-5">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                {localized(job.status === 'failed' ? S.jobFailed
                  : job.status === 'queued' ? S.jobQueued : S.jobRunning, locale)}
              </p>
              {job.status !== 'failed' && job.foundCount > 0 && (
                <p className="tnum text-xs text-ink-muted">
                  {job.foundCount} {localized(S.jobFound, locale)} · {job.processedCount} {localized(S.jobDone, locale)}
                  {remainingLabel && ` · ${localized(S.jobLeft, locale).replace('{t}', remainingLabel)}`}
                </p>
              )}
            </div>

            {job.status !== 'failed' && (
              <>
                {/* Které město je na řadě. U jednofázového hledání se neukazuje — „Zlín —
                    1. z 1 měst" by byl jen hluk. */}
                {job.stageCount > 1 && job.stageLabel && (
                  <p className="tnum text-xs text-ink-muted mt-2">
                    {localized(S.jobStage, locale)
                      .replace('{city}', job.stageLabel)
                      .replace('{i}', String(Math.min(job.stageIndex + 1, job.stageCount)))
                      .replace('{n}', String(job.stageCount))}
                  </p>
                )}

                {/* Pruh průběhu. Dokud neznáme počet nalezených firem, nemá co ukazovat —
                    prázdný pruh je poctivější než animace, která předstírá postup. U hledání
                    po městech se počítá z fází: `foundCount` je jen to, co zdroje vrátily
                    dosud, takže by pruh po každé fázi skákal zpátky. */}
                <div className="h-1 bg-line mt-3 overflow-hidden">
                  <div className="h-1 bg-ink transition-all duration-500"
                       style={{ width: job.stageCount > 1
                         ? `${Math.round(job.stageIndex / job.stageCount * 100)}%`
                         : job.foundCount > 0
                           ? `${Math.min(100, Math.round(job.processedCount / job.foundCount * 100))}%`
                           : '0%' }} />
                </div>
                <p className="text-xs text-ink-faint mt-3">
                  {localized(job.stageCount > 1 ? S.jobStaged : S.jobCanLeave, locale)}
                </p>
              </>
            )}

            {job.status === 'failed' && (
              <>
                <p className="text-sm text-ink-muted mt-2">{job.error}</p>
                <p className="text-xs text-ink-faint mt-2">{localized(S.jobPartial, locale)}</p>
              </>
            )}
          </div>
        )}

        {results.length > 0 && (
          <>
            {/* ── Filters ──────────────────────────────────────────────────────────
                Rendered by looping the registry, so a filter added in lead-filters.ts shows up
                here with no change to this file. The number on a chip is how many firms would
                remain if it were switched on next — filters combine with AND. */}
            {isDemo && (
              <div className="mb-8 border border-line rounded-xl p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-1">
                  {localized(S.demoTitle, locale)}
                </p>
                <p className="text-sm text-ink-muted max-w-2xl">{localized(S.demoBody, locale)}</p>
                <div className="flex items-center gap-3 flex-wrap mt-4">
                  <a href={`/${locale}/auth/register`} className="btn-primary">
                    {localized(S.demoCta, locale)}
                  </a>
                  <span className="text-xs text-ink-faint">{localized(S.demoPerk, locale)}</span>
                </div>
              </div>
            )}

            <div className="mb-8">
              <div className="flex items-baseline justify-between flex-wrap gap-3 pb-3 mb-4 border-b border-line">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-lg font-extrabold tracking-tight">{isCs ? 'Výsledky' : 'Results'}</h2>
                  <span className="tnum text-sm text-ink-muted">
                    {isCs ? `${filtered.length} z ${results.length} firem` : `${filtered.length} of ${results.length}`}
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
                  {/* Seznam / mapa. Mapa umí zobrazit jen firmy se souřadnicemi, takže je to
                      druhý pohled na tatáž data, ne náhrada seznamu. */}
                  <div className="flex gap-1">
                    {(['list', 'map'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        className={view === v ? 'chip-active' : 'chip'}
                      >
                        {v === 'list'
                          ? localized({ cs: 'Seznam', sk: 'Zoznam', en: 'List' }, locale)
                          : localized({ cs: 'Mapa', sk: 'Mapa', en: 'Map' }, locale)}
                      </button>
                    ))}
                  </div>
                  {active.size > 0 && (
                    <button onClick={() => setActive(new Set())}
                      className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors">
                      <X size={12} />{isCs ? 'Zrušit filtry' : 'Clear filters'}
                    </button>
                  )}
                  {searchId && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open(`/api/export/${searchId}?format=csv`, '_blank')}
                        className="btn-outline btn-sm gap-1.5"
                        title={isCs ? 'Exportovat do CSV (pro CRM)' : 'Export to CSV (for CRM)'}
                      >
                        <FileText size={13} />{isCs ? 'CSV export' : 'CSV'}
                      </button>
                      {isPro && (
                        <button
                          onClick={() => window.open(`/api/export/${searchId}`, '_blank')}
                          className="btn-outline btn-sm gap-1.5"
                          title={isCs ? 'Exportovat do Excelu' : 'Export to Excel'}
                        >
                          <Table2 size={13} />{t('export_excel')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {GROUP_ORDER.map(group => {
                  const items = LEAD_FILTERS.filter(f => f.group === group);
                  if (items.length === 0) return null;
                  return (
                    <div key={group} className="flex flex-wrap items-center gap-2">
                      <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                        {localized(GROUP_LABELS[group], locale)}
                      </span>
                      {items.map(f => {
                        const on = active.has(f.id);
                        const n  = countFor(f.id);
                        return (
                          <button
                            key={f.id}
                            onClick={() => toggle(f.id)}
                            disabled={!on && n === 0}
                            className={on ? 'chip-active' : 'chip'}
                          >
                            {localized(f.label, locale)}
                            <span className={`tnum ${on ? 'text-white/60' : 'text-ink-faint'}`}>{n}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {view === 'map' && (
              <ResultsMap
                locale={locale}
                total={mapLeads.length}
                onSetStatus={setLeadStatus}
                hideDone={hideDone}
                hiddenDone={hiddenDone}
                onToggleHideDone={toggleHideDone}
                leads={mapLeads.map((b): MapLead => ({
                  id: b.id, name: b.name, address: b.address, phone: b.phone, email: b.email,
                  website: b.website, category: b.category, ico: b.ico,
                  lat: b.lat, lon: b.lon,
                  hasWebsite: webStatus(b) === 'HAS',
                  websiteStatus: b.websiteStatus, leadScore: b.leadScore,
                  status: statusOf(b),
                }))}
              />
            )}

            {/* ── Results ──────────────────────────────────────────────────────────
                A row, not a card: one hairline between neighbours, the score on the left, and
                a 3px accent edge on the ones worth calling first. */}
            <div className={`border-t border-line ${view === 'map' ? 'hidden' : ''}`}>
              {filtered.map((b, i) => {
                const good = b.leadScore >= GOOD_LEAD;
                const { reason, scoreTitle } = rowSummary(b, profile.targetFilters, locale);
                return (
                  <div
                    key={b.id}
                    className="row stagger flex items-start gap-4 py-5 pl-4 pr-1 border-l-[3px]"
                    style={{
                      '--i': Math.min(i, 20),
                      borderLeftColor: good ? 'rgb(var(--accent))' : 'transparent',
                    } as React.CSSProperties}
                  >
                    <LeadScore value={b.leadScore} title={scoreTitle} />

                    <div className="flex-1 min-w-0">
                      {/* Name + source */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-ink leading-tight">{b.name}</h3>
                            <SourceBadge source={b.source} common={commonSource} />
                          </div>
                          {b.address && (
                            <p className="text-xs text-ink-faint mt-1 flex items-center gap-1">
                              <MapPin size={11} />{b.address}
                            </p>
                          )}
                        </div>
                        {/* Only rows found before Vlna 2 carry a directory link. */}
                        {b.googleMapsUrl && isHistoricalSource(b.source) && (
                          <a href={b.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                             className="shrink-0 btn-ghost btn-sm p-1.5" title="Původní zdroj záznamu">
                            <ExternalLink size={13} />
                          </a>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        <WebsiteStatusBadge b={b} locale={locale} />
                        <SocialLinks b={b} locale={locale} />
                        {b.ico && (
                          <span className="badge" title="IČO z veřejného rejstříku ARES">IČO {b.ico}</span>
                        )}

                        {/* Kde jsem s touhle firmou. Select, ne pět chipů — pět tlačítek na
                            každém z pěti set řádků by z výsledků udělalo houštinu, a na mapě,
                            kde je na výběr místo, chipy zůstávají. */}
                        {!isDemo && (
                          <select
                            value={statusOf(b) ?? 'new'}
                            onChange={e => setLeadStatus(b.id, e.target.value as LeadStatus)}
                            aria-label={localized({ cs: 'Stav', sk: 'Stav', en: 'Status' }, locale)}
                            className="text-[11px] border border-line rounded-lg px-1.5 py-0.5 bg-surface-subtle cursor-pointer hover:border-ink transition-colors"
                            style={{ color: statusDef(statusOf(b))?.color ?? undefined }}
                          >
                            {LEAD_STATUSES.map(st => (
                              <option key={st.id} value={st.id}>{localized(st.label, locale)}</option>
                            ))}
                          </select>
                        )}
                        {b.vatUnreliable && (
                          <span className="badge-red" title="Finanční správa firmu vede jako nespolehlivého plátce DPH">
                            Nespolehlivý plátce DPH
                          </span>
                        )}
                      </div>

                      {isDemo
                        ? <LockedContacts locale={locale} />
                        : <ContactStrategy b={b} locale={locale} />}

                      {/* Věta „proč oslovit" pro úzké obrazovky. Pravý sloupec se pod 1024 px
                          schovává, takže na telefonu by ji jinak nikdo nikdy neviděl — a je to
                          ta jediná věta, kvůli které má řádek smysl číst. */}
                      <p className="lg:hidden text-xs text-ink-muted leading-relaxed mt-3">{reason}</p>
                    </div>

                    {/* Why this score (desktop) */}
                    {(
                      <div className="hidden lg:block shrink-0 w-52 min-w-0 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-1">
                          {isCs ? 'Proč' : 'Why'}
                        </p>
                        <p className="text-xs text-ink-muted leading-relaxed">{reason}</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-20 text-ink-faint">
                  {/*
                    Dvě různé prázdnoty. „Nic jsme nenašli" a „našli jsme 500 firem, ale žádná
                    neprošla filtrem" znamenají pro uživatele něco úplně jiného, a rada „zkus
                    jiný region" je u toho druhého případu falešná stopa — region byl v pořádku.
                  */}
                  <p className="mb-4">
                    {results.length > 0
                      ? localized(S.emptyByFilter, locale).replace('{n}', String(results.length))
                      : t('no_results')}
                  </p>
                  {active.size > 0 && (
                    <button onClick={() => setActive(new Set())} className="btn-outline btn-sm mx-auto">
                      {isCs ? 'Zrušit filtry' : 'Clear filters'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ODbL is share-alike: anything derived from OSM has to name the source. */}
            {results.some(b => (b.source ?? '').split('+').includes('osm')) && (
              <p className="mt-4 text-center text-[11px] text-ink-faint">
                {localized(S.attribution, locale)}
              </p>
            )}
          </>
        )}

        {!hasSearched && (
          <div className="card text-center py-16 text-ink-faint border-dashed">
            <Search size={40} className="mx-auto mb-3 opacity-20" />
            <p className="font-medium text-ink-muted mb-1">{isCs ? 'Vyber kraj a obor výše' : 'Select region and industry above'}</p>
            <p className="text-sm">{isCs ? 'např. Jihomoravský kraj + Instalatér, nebo Celá ČR + Kadeřnictví' : 'e.g. London + Plumber'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
