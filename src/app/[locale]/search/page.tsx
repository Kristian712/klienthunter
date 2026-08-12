'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Search, Globe, Users, ExternalLink,
  Phone, Mail, MapPin, X, Clock, ChevronDown, Check, Send,
  FileText, Table2, MessageSquare, Copy, Smartphone, PhoneCall,
} from 'lucide-react';
import { buildGreeting } from '@/lib/czech-vocative';
import { OSM_ATTRIBUTION } from '@/lib/attribution';
import { LEAD_FILTERS, GROUP_LABELS, matchesAll, type FilterGroup } from '@/lib/lead-filters';
import { LeadScore, GOOD_LEAD } from '@/components/LeadScore';

// ── Regions ───────────────────────────────────────────────────────────────────

const REGIONS = [
  { group: 'Česká republika — kraje', items: [
    { value: 'Celá ČR',                                    label: 'Celá ČR (všechny kraje)' },
    { value: 'Praha, Czech Republic',                      label: 'Praha (Hlavní město Praha)' },
    { value: 'Středočeský kraj, Czech Republic',           label: 'Středočeský kraj' },
    { value: 'České Budějovice, Jihočeský kraj',           label: 'Jihočeský kraj' },
    { value: 'Plzeň, Plzeňský kraj',                       label: 'Plzeňský kraj' },
    { value: 'Karlovy Vary, Karlovarský kraj',             label: 'Karlovarský kraj' },
    { value: 'Ústí nad Labem, Ústecký kraj',               label: 'Ústecký kraj' },
    { value: 'Liberec, Liberecký kraj',                    label: 'Liberecký kraj' },
    { value: 'Hradec Králové, Královéhradecký kraj',       label: 'Královéhradecký kraj' },
    { value: 'Pardubice, Pardubický kraj',                 label: 'Pardubický kraj' },
    { value: 'Jihlava, Kraj Vysočina',                     label: 'Kraj Vysočina' },
    { value: 'Brno, Jihomoravský kraj',                    label: 'Jihomoravský kraj' },
    { value: 'Olomouc, Olomoucký kraj',                    label: 'Olomoucký kraj' },
    { value: 'Zlín, Zlínský kraj',                         label: 'Zlínský kraj' },
    { value: 'Ostrava, Moravskoslezský kraj',              label: 'Moravskoslezský kraj' },
  ]},
  { group: 'Slovensko — kraje', items: [
    { value: 'Bratislava, Slovakia',                       label: 'Bratislavský kraj' },
    { value: 'Trnava, Slovakia',                           label: 'Trnavský kraj' },
    { value: 'Trenčín, Slovakia',                          label: 'Trenčianský kraj' },
    { value: 'Nitra, Slovakia',                            label: 'Nitrianský kraj' },
    { value: 'Žilina, Slovakia',                           label: 'Žilinský kraj' },
    { value: 'Banská Bystrica, Slovakia',                  label: 'Banskobystrický kraj' },
    { value: 'Prešov, Slovakia',                           label: 'Prešovský kraj' },
    { value: 'Košice, Slovakia',                           label: 'Košický kraj' },
  ]},
  { group: 'Německo', items: [
    { value: 'Berlin, Germany',   label: 'Berlín' },
    { value: 'Munich, Germany',   label: 'Mnichov' },
    { value: 'Hamburg, Germany',  label: 'Hamburg' },
    { value: 'Frankfurt, Germany',label: 'Frankfurt' },
  ]},
  { group: 'Rakousko', items: [
    { value: 'Vienna, Austria',   label: 'Vídeň' },
    { value: 'Graz, Austria',     label: 'Graz' },
    { value: 'Linz, Austria',     label: 'Linz' },
  ]},
  { group: 'Velká Británie', items: [
    { value: 'London, UK',        label: 'Londýn' },
    { value: 'Manchester, UK',    label: 'Manchester' },
    { value: 'Birmingham, UK',    label: 'Birmingham' },
  ]},
  { group: 'USA', items: [
    { value: 'New York, USA',     label: 'New York' },
    { value: 'Los Angeles, USA',  label: 'Los Angeles' },
    { value: 'Chicago, USA',      label: 'Chicago' },
    { value: 'Houston, USA',      label: 'Houston' },
  ]},
  { group: 'Polsko', items: [
    { value: 'Warsaw, Poland',    label: 'Varšava' },
    { value: 'Krakow, Poland',    label: 'Krakov' },
    { value: 'Wroclaw, Poland',   label: 'Wroclaw' },
  ]},
];

// ── Industries ────────────────────────────────────────────────────────────────

const INDUSTRIES: Record<string, { group: string; items: { value: string; label: string }[] }[]> = {
  cs: [
    { group: 'Řemesla', items: [
      { value: 'plumber',          label: 'Instalatér' },
      { value: 'electrician',      label: 'Elektrikář' },
      { value: 'carpenter',        label: 'Tesař / Truhlář' },
      { value: 'painter',          label: 'Malíř pokojů' },
      { value: 'roofer',           label: 'Pokrývač' },
      { value: 'landscaper',       label: 'Zahradník' },
      { value: 'locksmith',        label: 'Zámečník' },
      { value: 'glazier',          label: 'Sklenář' },
      { value: 'chimney sweep',    label: 'Kominík' },
    ]},
    { group: 'Jídlo & pití', items: [
      { value: 'restaurant',       label: 'Restaurace' },
      { value: 'cafe',             label: 'Kavárna' },
      { value: 'bakery',           label: 'Pekárna' },
      { value: 'butcher shop',     label: 'Řeznictví' },
    ]},
    { group: 'Krása & wellness', items: [
      { value: 'hair salon',       label: 'Kadeřnictví' },
      { value: 'beauty salon',     label: 'Kosmetický salon' },
      { value: 'nail studio',      label: 'Nehtové studio' },
      { value: 'massage',          label: 'Masáže' },
      { value: 'yoga studio',      label: 'Jóga studio' },
    ]},
    { group: 'Auto', items: [
      { value: 'car repair',       label: 'Autoservis' },
      { value: 'tire shop',        label: 'Pneuservis' },
    ]},
    { group: 'Zdravotnictví', items: [
      { value: 'general practitioner', label: 'Praktický lékař' },
      { value: 'dentist',          label: 'Zubař' },
      { value: 'physiotherapist',  label: 'Fyzioterapeut' },
      { value: 'pharmacy',         label: 'Lékárna' },
      { value: 'optician',         label: 'Optika' },
      { value: 'veterinarian',     label: 'Veterinář' },
    ]},
    { group: 'Právní & finance', items: [
      { value: 'lawyer',           label: 'Právník / Advokát' },
      { value: 'accountant',       label: 'Účetní' },
      { value: 'real estate agency', label: 'Realitní kancelář' },
    ]},
    { group: 'Vzdělávání & sport', items: [
      { value: 'driving school',   label: 'Autoškola' },
      { value: 'language school',  label: 'Jazyková škola' },
      { value: 'gym',              label: 'Fitness centrum' },
      { value: 'personal trainer', label: 'Osobní trenér' },
    ]},
    { group: 'Ostatní služby', items: [
      { value: 'photographer',     label: 'Fotograf' },
      { value: 'cleaning service', label: 'Úklid' },
      { value: 'florist',          label: 'Květinářství' },
      { value: 'tailor',           label: 'Krejčí' },
    ]},
  ],
  sk: [
    { group: 'Remeslá', items: [
      { value: 'plumber',          label: 'Inštalatér' },
      { value: 'electrician',      label: 'Elektrikár' },
      { value: 'carpenter',        label: 'Tesár / Stolár' },
      { value: 'painter',          label: 'Maliar' },
      { value: 'roofer',           label: 'Pokrývač' },
      { value: 'landscaper',       label: 'Záhradník' },
      { value: 'locksmith',        label: 'Zámočník' },
    ]},
    { group: 'Jedlo & pitie', items: [
      { value: 'restaurant',       label: 'Reštaurácia' },
      { value: 'cafe',             label: 'Kaviareň' },
      { value: 'bakery',           label: 'Pekáreň' },
      { value: 'butcher shop',     label: 'Mäsiarstvo' },
    ]},
    { group: 'Krása & wellness', items: [
      { value: 'hair salon',       label: 'Kaderníctvo' },
      { value: 'beauty salon',     label: 'Kozmetický salón' },
      { value: 'nail studio',      label: 'Nechtové štúdio' },
      { value: 'massage',          label: 'Masáže' },
    ]},
    { group: 'Auto', items: [
      { value: 'car repair',       label: 'Autoservis' },
      { value: 'tire shop',        label: 'Pneuservis' },
    ]},
    { group: 'Zdravotníctvo', items: [
      { value: 'general practitioner', label: 'Praktický lekár' },
      { value: 'dentist',          label: 'Zubár' },
      { value: 'physiotherapist',  label: 'Fyzioterapeut' },
      { value: 'veterinarian',     label: 'Veterinár' },
    ]},
    { group: 'Právne & financie', items: [
      { value: 'lawyer',           label: 'Advokát' },
      { value: 'accountant',       label: 'Účtovník' },
      { value: 'real estate agency', label: 'Realitná kancelária' },
    ]},
    { group: 'Iné služby', items: [
      { value: 'photographer',     label: 'Fotograf' },
      { value: 'cleaning service', label: 'Upratovanie' },
      { value: 'gym',              label: 'Fitnescentrum' },
      { value: 'driving school',   label: 'Autoškola' },
    ]},
  ],
  en: [
    { group: 'Trades', items: [
      { value: 'plumber',          label: 'Plumber' },
      { value: 'electrician',      label: 'Electrician' },
      { value: 'carpenter',        label: 'Carpenter' },
      { value: 'painter',          label: 'Painter' },
      { value: 'roofer',           label: 'Roofer' },
      { value: 'landscaper',       label: 'Landscaper' },
      { value: 'locksmith',        label: 'Locksmith' },
    ]},
    { group: 'Food & drink', items: [
      { value: 'restaurant',       label: 'Restaurant' },
      { value: 'cafe',             label: 'Cafe' },
      { value: 'bakery',           label: 'Bakery' },
      { value: 'butcher shop',     label: 'Butcher' },
    ]},
    { group: 'Beauty & wellness', items: [
      { value: 'hair salon',       label: 'Hair salon' },
      { value: 'beauty salon',     label: 'Beauty salon' },
      { value: 'nail studio',      label: 'Nail studio' },
      { value: 'massage',          label: 'Massage' },
    ]},
    { group: 'Auto', items: [
      { value: 'car repair',       label: 'Car repair' },
      { value: 'tire shop',        label: 'Tire shop' },
    ]},
    { group: 'Healthcare', items: [
      { value: 'general practitioner', label: 'GP / Doctor' },
      { value: 'dentist',          label: 'Dentist' },
      { value: 'physiotherapist',  label: 'Physiotherapist' },
      { value: 'veterinarian',     label: 'Vet' },
    ]},
    { group: 'Legal & finance', items: [
      { value: 'lawyer',           label: 'Lawyer' },
      { value: 'accountant',       label: 'Accountant' },
      { value: 'real estate agency', label: 'Real estate agency' },
    ]},
    { group: 'Services', items: [
      { value: 'photographer',     label: 'Photographer' },
      { value: 'cleaning service', label: 'Cleaning service' },
      { value: 'gym',              label: 'Gym' },
      { value: 'driving school',   label: 'Driving school' },
    ]},
  ],
};

// Popular categories shown as quick chips (localized)
const POPULAR_CHIPS: Record<string, { value: string; label: string }[]> = {
  cs: [
    { value: 'hair salon',    label: 'Kadeřnictví' },
    { value: 'restaurant',    label: 'Restaurace' },
    { value: 'car repair',    label: 'Autoservis' },
    { value: 'plumber',       label: 'Instalatér' },
    { value: 'dentist',       label: 'Zubař' },
    { value: 'real estate agency', label: 'Reality' },
    { value: 'lawyer',        label: 'Právník' },
    { value: 'electrician',   label: 'Elektrikář' },
  ],
  sk: [
    { value: 'hair salon',    label: 'Kaderníctvo' },
    { value: 'restaurant',    label: 'Reštaurácia' },
    { value: 'car repair',    label: 'Autoservis' },
    { value: 'plumber',       label: 'Inštalatér' },
    { value: 'dentist',       label: 'Zubár' },
    { value: 'electrician',   label: 'Elektrikár' },
  ],
  en: [
    { value: 'hair salon',    label: 'Hair salon' },
    { value: 'restaurant',    label: 'Restaurant' },
    { value: 'car repair',    label: 'Car repair' },
    { value: 'plumber',       label: 'Plumber' },
    { value: 'dentist',       label: 'Dentist' },
    { value: 'electrician',   label: 'Electrician' },
  ],
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface BusinessResult {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  hasWebsite: boolean;
  websiteStatus?: string | null;
  websiteEvidence?: string;
  hasFacebook: boolean;
  hasInstagram: boolean;
  hasLinkedIn: boolean;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedInUrl?: string;
  websiteIsOld: boolean;
  websiteScore: number;
  websiteAgeNote: string;
  websiteMs?: number | null;
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
}

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
const GROUP_ORDER: FilterGroup[] = ['web', 'contact', 'company'];

/**
 * Why this row scores what it scores — the two strongest reasons, in the order they matter.
 * Two, not five: a list of everything slightly wrong with a firm is noise, the first two lines
 * are what a person actually says on the phone.
 */
function topReasons(b: BusinessResult): string[] {
  const status = webStatus(b);
  const out: string[] = [];
  if (status === 'UNKNOWN')    out.push('Nemá dohledatelný web');
  else if (status === 'NONE')  out.push('Nemá web');
  else if (b.websiteIsOld)     out.push('Web působí zastarale');
  else if (typeof b.websiteMs === 'number' && b.websiteMs >= 2500)
                               out.push(`Web se načítá ${(b.websiteMs / 1000).toFixed(1)} s`);
  if (!b.hasFacebook && !b.hasInstagram && !b.hasLinkedIn) out.push('Bez sociálních sítí');
  if (b.phone || b.email)      out.push('Je na koho se obrátit');
  if (b.vatUnreliable)         out.push('Nespolehlivý plátce DPH');
  return out.slice(0, 2);
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

// ── Phone helpers ─────────────────────────────────────────────────────────────

function isCzMobile(phone: string): boolean {
  const d = phone.replace(/[\s\-()+]/g, '');
  const local = d.startsWith('420') ? d.slice(3) : d;
  return local.length === 9 && (local.startsWith('6') || local.startsWith('7'));
}

function whatsappHref(phone: string): string {
  const d = phone.replace(/[\s\-()+]/g, '');
  const num = d.startsWith('420') ? d : `420${d}`;
  return `https://wa.me/${num}`;
}

// ── Contact strategy ──────────────────────────────────────────────────────────

/**
 * Which channel to try first, and why. Ordered, not colour-coded: the first entry is the
 * recommendation, the rest are fallbacks, and greyer type says that better than five brand
 * colours competing for attention inside one row.
 */
function ContactStrategy({ b }: { b: BusinessResult }) {
  const mobile = b.phone ? isCzMobile(b.phone) : false;

  type Method = { key: string; icon: React.ReactNode; label: string; href: string; tip: string };
  const methods: Method[] = [];

  if (b.phone && mobile) {
    methods.push({
      key: 'call',
      icon: <PhoneCall size={11} />,
      label: 'Zavolej přímo',
      href: `tel:${b.phone}`,
      tip: 'Nejvyšší šance odpovědi. Nejlépe 9–11h nebo 14–16h.',
    });
    methods.push({
      key: 'wa',
      icon: <WaIcon />,
      label: 'WhatsApp',
      href: whatsappHref(b.phone),
      tip: 'Majitelé malých firem čtou WA pravidelně — stručná zpráva funguje.',
    });
  }

  if (b.hasInstagram && b.instagramUrl) {
    methods.push({
      key: 'ig',
      icon: <IgIcon />,
      label: 'DM na Instagramu',
      href: b.instagramUrl,
      tip: 'Pro vizuální obory (kadeřnictví, kosmetika…) velmi vysoká odezva.',
    });
  }

  if (b.hasFacebook && b.facebookUrl) {
    methods.push({
      key: 'fb',
      icon: <FbIcon />,
      label: 'DM na Facebooku',
      href: b.facebookUrl,
      tip: 'Messenger funguje dobře u starší klientely (40+).',
    });
  }

  if (b.email) {
    methods.push({
      key: 'email',
      icon: <Mail size={11} />,
      label: 'E-mail',
      href: `mailto:${b.email}`,
      tip: 'Nejnižší odezva u cold outreach. Použij jen pokud není nic jiného.',
    });
  }

  if (methods.length === 0) return null;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider mb-2">
        Jak kontaktovat
      </p>
      <div className="space-y-2">
        {methods.map((m, i) => (
          <div key={m.key} className="flex items-start gap-2.5">
            <a
              href={m.href}
              target={m.key !== 'call' && m.key !== 'email' ? '_blank' : undefined}
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
            <span className="text-[11px] text-ink-faint leading-tight pt-1">{m.tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SocialLinks({ b }: { b: BusinessResult }) {
  const hasSocial = b.hasFacebook || b.hasInstagram || b.hasLinkedIn;
  if (!hasSocial) {
    return (
      <span className="badge"><Users size={10} />Bez soc. sítí</span>
    );
  }
  const links: Array<[boolean, string, React.ReactNode, string]> = [
    [b.hasFacebook,  b.facebookUrl  ?? `https://www.facebook.com/search/results/?q=${encodeURIComponent(b.name ?? '')}`,        <FbIcon key="f" />, 'Facebook'],
    [b.hasInstagram, b.instagramUrl ?? `https://www.instagram.com/${encodeURIComponent(b.name ?? '')}`,                        <IgIcon key="i" />, 'Instagram'],
    [b.hasLinkedIn,  b.linkedInUrl  ?? `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(b.name ?? '')}`, <LiIcon key="l" />, 'LinkedIn'],
  ];
  return (
    <span className="flex items-center gap-1.5 flex-wrap">
      {links.filter(([on]) => on).map(([, href, icon, label]) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" title={label}
           className="badge hover:border-ink hover:text-ink transition-colors">
          {icon} {label}
        </a>
      ))}
    </span>
  );
}

function WebsiteStatusBadge({ b }: { b: BusinessResult }) {
  const status = webStatus(b);
  if (status === 'NONE') {
    return (
      <span className="badge-red" title={b.websiteEvidence || undefined}>
        <Globe size={10} />Nemají web
      </span>
    );
  }
  if (status === 'UNKNOWN') {
    return (
      <span className="badge" title={b.websiteEvidence || 'Žádný zdroj web nepotvrdil ani nevyvrátil'}>
        <Globe size={10} />Web neuveden
      </span>
    );
  }
  const scoreLabel = b.websiteScore && b.websiteScore !== 50 ? ` (${b.websiteScore}/100)` : '';
  const tooltip = b.websiteAgeNote ? `${b.websiteAgeNote}${scoreLabel}` : (scoreLabel ? `Skóre${scoreLabel}` : '');
  if (b.websiteIsOld) {
    return (
      <span className="badge-accent" title={tooltip || undefined}>
        <Clock size={10} />Potřebuje nový web{scoreLabel}
      </span>
    );
  }
  return (
    <span className="badge" title={tooltip || undefined}>
      <Globe size={10} />Mají web{scoreLabel}
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

function SourceBadge({ source }: { source?: string }) {
  const ids = (source ?? 'ares').split('+').filter(Boolean);
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

function generateMessage(b: BusinessResult, industry: string): string {
  const greeting = buildGreeting(b.name);
  const status = webStatus(b);

  // The wording below claims the firm has no site, so it is only for a proven NONE.
  if (status === 'NONE') {
    return `${greeting} 👋

jsem Kristián a dělám weby na míru – moderní, rychlé a dobře vypadající na mobilu i počítači.

Zaujalo mě, že zatím web nemáte. Přitom ${industry || 'vaše služby'} lidé hledají nejčastěji právě na internetu – web může být jeden z nejlepších způsobů jak získat nové zákazníky. Rád vám zdarma ukážu jak by mohl vypadat – bez závazků.

Třeba znáte i někoho komu by se web hodil – budu za doporučení moc vděčný 🙏

Kristián · https://webovkyvanek.cz/`;
  }

  if (status === 'UNKNOWN') {
    return `${greeting} 👋

jsem Kristián a dělám weby na míru – moderní, rychlé a dobře vypadající na mobilu i počítači.

Narazil jsem na vaši firmu a napadlo mě, jestli by se vám nehodila lepší prezentace na internetu. Rád vám zdarma ukážu jak by web mohl vypadat – bez závazků.

Třeba znáte i někoho komu by se web hodil – budu za doporučení moc vděčný 🙏

Kristián · https://webovkyvanek.cz/`;
  }

  if (b.websiteIsOld) {
    return `${greeting} 👋

jsem Kristián a specializuji se na moderní weby.

Narazil jsem na váš web – myslím, že by si zasloužil osvěžení. Rychlejší načítání, aktuální design a správné zobrazení na mobilu. Rád vám zdarma ukážu jak by mohl nový vypadat – žádný závazek.

Třeba znáte i někoho pro koho by nový web byl přínos – budu za doporučení moc rád 🙏

Kristián · https://webovkyvanek.cz/`;
  }

  return `${greeting} 👋

jsem Kristián – pomáhám firmám získávat více zákazníků přes internet.

Zaujala mě vaše firma a váš web vypadá dobře! Přesto věřím, že každá online prezentace má prostor se zlepšovat – rychlost, SEO, nebo to jak web přesvědčí návštěvníka zavolat. Rád se na to podívám a řeknu vám svůj názor zdarma, bez závazků.

Třeba znáte i někoho, komu by se nový web hodil – budu za doporučení moc vděčný 🙏

Kristián · https://webovkyvanek.cz/`;
}

function MessageBox({ b, industry }: { b: BusinessResult; industry: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const msg = generateMessage(b, industry);

  const copy = () => {
    navigator.clipboard.writeText(msg).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mt-3 border-t border-line pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink transition-colors font-medium"
      >
        <MessageSquare size={12} />
        {open ? 'Skrýt zprávu' : 'Zobrazit zprávu pro oslovení'}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 relative">
          <textarea
            readOnly
            value={msg}
            rows={8}
            className="w-full text-xs text-ink-muted bg-surface-subtle border border-line rounded-lg p-3 resize-none font-mono leading-relaxed"
          />
          <button
            onClick={copy}
            className={`absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              copied
                ? 'bg-ink text-white'
                : 'bg-white border border-line text-ink-muted hover:text-ink hover:border-ink'
            }`}
          >
            {copied ? <><Check size={11} /> Zkopírováno</> : <><Copy size={11} /> Kopírovat</>}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Prepares the e-mail and hands it over — the app never sends it. Unsolicited commercial mail
 * needs the recipient's prior consent under § 7 zákona 480/2004 Sb., and we have none, so the
 * decision to press send stays with the user, in the user's own mailbox.
 */
function DraftEmailButton({ businessId, email }: { businessId: string; email: string }) {
  const [status, setStatus] = useState<'idle'|'loading'|'ready'|'error'>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [mailto, setMailto] = useState('');

  const prepare = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessResultId: businessId }),
      });
      const d = await res.json();
      if (!res.ok) { setStatus('error'); setErrMsg(d.error || 'Chyba'); return; }

      await navigator.clipboard.writeText(d.body).catch(() => {});
      setMailto(
        `mailto:${encodeURIComponent(d.to || email)}` +
        `?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`,
      );
      setStatus('ready');
    } catch {
      setStatus('error');
      setErrMsg('Koncept se nepodařilo připravit.');
    }
  };

  if (status === 'ready') {
    return (
      <a href={mailto} className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-ink">
        <Check size={12} /> Zkopírováno – otevřít ve schránce
      </a>
    );
  }
  if (status === 'error') return <span className="text-xs font-medium text-ink" title={errMsg}>{errMsg || 'Chyba'}</span>;

  return (
    <button onClick={prepare} disabled={status === 'loading'}
      className="flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-accent disabled:opacity-40 transition-colors">
      {status === 'loading'
        ? <><svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Připravuji…</>
        : <><Send size={12} /> Zkopírovat koncept</>}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SearchPage() {
  const t = useTranslations('search');
  const locale = useLocale();
  const isCs = locale === 'cs';

  const [userPlan, setUserPlan] = useState<string>('FREE');

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => setUserPlan(d.user?.plan ?? 'FREE')).catch(() => {});
  }, []);

  const [region, setRegion]               = useState('');
  const [customRegion, setCustomRegion]   = useState('');
  const [industry, setIndustry]           = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [active, setActive]               = useState<Set<string>>(new Set());
  const [results, setResults]             = useState<BusinessResult[]>([]);
  const [searchId, setSearchId]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(false);
  const [loadingMsg, setLoadingMsg]       = useState('');
  const [error, setError]                 = useState('');
  const [hasSearched, setHasSearched]     = useState(false);

  const effectiveRegion   = region === '__custom__'   ? customRegion   : region;
  const effectiveIndustry = industry === '__custom__' ? customIndustry : industry;

  /** Every active filter has to hold — combining is always AND. Best opportunities first. */
  const filtered = results
    .filter(b => matchesAll(b, active))
    .sort((a, b) => b.leadScore - a.leadScore || a.name.localeCompare(b.name, 'cs'));

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveRegion || !effectiveIndustry) return;
    setLoading(true);
    setError('');
    setResults([]);
    setActive(new Set());
    setHasSearched(true);
    setLoadingMsg(isWholeCzech(effectiveRegion)
      ? (isCs ? 'Prohledávám všech 14 krajů… může trvat 1–2 minuty.' : 'Searching all 14 regions… may take 1–2 min.')
      : isCs ? 'Hledám v ARESu a OpenStreetMap…' : 'Searching ARES and OpenStreetMap…');
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: effectiveRegion, industry: effectiveIndustry }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setError(isCs ? 'Přihlaste se prosím.' : 'Please log in.');
        else if (res.status === 403) setError(isCs ? 'Limit vyhledávání vyčerpán.' : 'Search limit reached.');
        else setError(data.error || 'Error');
        return;
      }
      setResults(data.results);
      setSearchId(data.searchId);
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  const popularChips = POPULAR_CHIPS[locale] ?? POPULAR_CHIPS.en;
  const isPro = userPlan === 'PRO' || userPlan === 'BUSINESS';

  return (
    <div className="min-h-screen bg-surface pt-16">
      <div className="border-b border-line bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-ink mb-1">{t('title')}</h1>
          <p className="text-ink-muted text-sm">
            {isCs ? 'Vyber kraj a obor — výsledky z veřejného rejstříku ARES a OpenStreetMap' : 'Select a region and industry to find potential clients'}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* ── Search form ── */}
        <form onSubmit={handleSearch} className="card mb-6">
          <div className="grid md:grid-cols-5 gap-4 items-end">

            {/* Region select */}
            <div className="md:col-span-2">
              <label className="label">
                <MapPin size={13} className="inline mr-1" />
                {t('region_label')}
              </label>
              <div className="relative">
                <select
                  className="input appearance-none pr-9 cursor-pointer"
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  required={region !== '__custom__'}
                >
                  <option value="">{isCs ? '— Vyberte region —' : '— Select region —'}</option>
                  {REGIONS.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">{isCs ? 'Jiné město (zadat ručně)' : 'Other (type manually)'}</option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              </div>
              {region === '__custom__' && (
                <input
                  className="input mt-2"
                  placeholder={isCs ? 'Název města nebo oblasti…' : 'City or region name…'}
                  value={customRegion}
                  onChange={e => setCustomRegion(e.target.value)}
                  required
                  autoFocus
                />
              )}
            </div>

            {/* Industry select */}
            <div className="md:col-span-2">
              <label className="label">
                <Search size={13} className="inline mr-1" />
                {t('industry_label')}
              </label>

              {/* Popular chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {popularChips.map(chip => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => setIndustry(chip.value)}
                    className={industry === chip.value ? 'chip-active' : 'chip'}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <select
                  className="input appearance-none pr-9 cursor-pointer"
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  required={industry !== '__custom__'}
                >
                  <option value="">
                    {locale === 'cs' ? '— Nebo vyberte obor —' : locale === 'sk' ? '— Alebo vyberte odbor —' : '— Or select industry —'}
                  </option>
                  {(INDUSTRIES[locale] ?? INDUSTRIES.en).map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map(item => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">
                    {locale === 'cs' ? 'Jiný obor (zadat ručně)' : locale === 'sk' ? 'Iný odbor (zadať ručne)' : 'Other (type manually)'}
                  </option>
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
              </div>
              {industry === '__custom__' && (
                <input
                  className="input mt-2"
                  placeholder={isCs ? 'Název oboru…' : 'Industry name…'}
                  value={customIndustry}
                  onChange={e => setCustomIndustry(e.target.value)}
                  required
                  autoFocus
                />
              )}
            </div>

            <button type="submit" disabled={loading || !effectiveRegion || !effectiveIndustry}
              className="btn-primary h-[42px]">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {t('searching')}
                </span>
              ) : <><Search size={16} />{t('search_button')}</>}
            </button>
          </div>

          {loading && loadingMsg && (
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted border-t border-line pt-4">
              <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              {loadingMsg}
            </div>
          )}
        </form>

        {error && (
          <div className="rounded-lg border border-ink px-4 py-3 text-sm font-medium text-ink mb-4">{error}</div>
        )}

        {results.length > 0 && (
          <>
            {/* ── Filters ──────────────────────────────────────────────────────────
                Rendered by looping the registry, so a filter added in lead-filters.ts shows up
                here with no change to this file. The number on a chip is how many firms would
                remain if it were switched on next — filters combine with AND. */}
            <div className="mb-8">
              <div className="flex items-baseline justify-between flex-wrap gap-3 pb-3 mb-4 border-b border-line">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-lg font-extrabold tracking-tight">{isCs ? 'Výsledky' : 'Results'}</h2>
                  <span className="tnum text-sm text-ink-muted">
                    {isCs ? `${filtered.length} z ${results.length} firem` : `${filtered.length} of ${results.length}`}
                  </span>
                </div>

                <div className="flex items-center gap-4 flex-wrap">
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
                        {isCs ? GROUP_LABELS[group].cs : GROUP_LABELS[group].en}
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
                            {isCs ? f.label.cs : f.label.en}
                            <span className={`tnum ${on ? 'text-white/60' : 'text-ink-faint'}`}>{n}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Results ──────────────────────────────────────────────────────────
                A row, not a card: one hairline between neighbours, the score on the left, and
                a 3px accent edge on the ones worth calling first. */}
            <div className="border-t border-line">
              {filtered.map((b, i) => {
                const good    = b.leadScore >= GOOD_LEAD;
                const reasons = topReasons(b);
                return (
                  <div
                    key={b.id}
                    className="row stagger flex items-start gap-4 py-5 pl-4 pr-1 border-l-[3px]"
                    style={{
                      '--i': Math.min(i, 20),
                      borderLeftColor: good ? 'rgb(var(--accent))' : 'transparent',
                    } as React.CSSProperties}
                  >
                    <LeadScore value={b.leadScore} />

                    <div className="flex-1 min-w-0">
                      {/* Name + source */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-ink leading-tight">{b.name}</h3>
                            <SourceBadge source={b.source} />
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

                      {/* Contacts */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {b.phone && (() => {
                          const mobile = isCzMobile(b.phone!);
                          return (
                            <span className="flex items-center gap-1.5">
                              <a href={`tel:${b.phone}`}
                                 className={`flex items-center gap-1 text-xs transition-colors hover:text-accent ${mobile ? 'text-ink font-medium' : 'text-ink-muted'}`}>
                                {mobile ? <Smartphone size={11} /> : <Phone size={11} />}
                                {b.phone}
                                {mobile && <span className="text-[10px] text-ink-faint font-normal">(mobil)</span>}
                              </a>
                              {mobile && (
                                <a href={whatsappHref(b.phone!)} target="_blank" rel="noopener noreferrer"
                                   title="Napsat přes WhatsApp" className="badge hover:border-ink hover:text-ink transition-colors">
                                  <WaIcon /> WA
                                </a>
                              )}
                            </span>
                          );
                        })()}
                        {b.email && (
                          <a href={`mailto:${b.email}`} className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent transition-colors">
                            <Mail size={11} />{b.email}
                          </a>
                        )}
                        {b.website && (
                          <a href={b.website} target="_blank" rel="noopener noreferrer"
                             className="flex items-center gap-1 text-xs text-ink-muted hover:text-accent transition-colors truncate max-w-[220px]">
                            <Globe size={11} />{b.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                        {b.email && <DraftEmailButton businessId={b.id} email={b.email} />}
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 mt-3 items-center">
                        <WebsiteStatusBadge b={b} />
                        <SocialLinks b={b} />
                        {b.ico && (
                          <span className="badge" title="IČO z veřejného rejstříku ARES">IČO {b.ico}</span>
                        )}
                        {b.vatUnreliable && (
                          <span className="badge-red" title="Finanční správa firmu vede jako nespolehlivého plátce DPH">
                            Nespolehlivý plátce DPH
                          </span>
                        )}
                      </div>

                      <ContactStrategy b={b} />
                      <MessageBox b={b} industry={effectiveIndustry} />
                    </div>

                    {/* Why this score (desktop) */}
                    {reasons.length > 0 && (
                      <div className="hidden lg:block shrink-0 w-44 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint mb-1">
                          {isCs ? 'Proč' : 'Why'}
                        </p>
                        {reasons.map(r => (
                          <p key={r} className="text-xs text-ink-muted leading-relaxed">{r}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-20 text-ink-faint">
                  <p className="mb-4">{t('no_results')}</p>
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
                Část dat: {OSM_ATTRIBUTION} · údaje o firmách z veřejného rejstříku ARES
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
