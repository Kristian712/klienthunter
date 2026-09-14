import * as XLSX from 'xlsx';
import { BusinessResult } from '@prisma/client';
import { leadReason } from './lead-reason';
import { websiteAudit } from './website-audit';
import { naceLabel } from './nace-codes';
import { localized } from './lead-filters';
import { reachScore } from './reach-score';
import { resolveStatus, type WebsiteStatus } from './website-status';

/**
 * UNKNOWN is deliberately an empty cell, not a word.
 *
 * A spreadsheet gets sorted, filtered and pasted into other people's documents, and any word we
 * put here would travel with the row as if it were a finding about the firm. It is not one: it
 * only means nobody could confirm a page. The empty cell says exactly that much and no more —
 * the same convention `vatLabel()` below already uses for a register we never asked.
 */
/**
 * Tři stavy, tři různé buňky. Prázdno u UNKNOWN by se v Excelu četlo jako „ne" — a to je přesně
 * ta záměna, kvůli které aplikace o firmách s webem tvrdila, že ho nemají.
 */
export const WEBSITE_LABEL: Record<WebsiteStatus, { cs: string; sk: string; en: string }> = {
  HAS:     { cs: 'ANO', sk: 'ÁNO', en: 'YES' },
  NONE:    { cs: 'NE',  sk: 'NIE', en: 'NO' },
  UNKNOWN: { cs: 'NEOVĚŘENO', sk: 'NEOVERENÉ', en: 'UNVERIFIED' },
};

const YES = { cs: 'ANO', sk: 'ÁNO', en: 'YES' };
const NO  = { cs: 'NE',  sk: 'NIE', en: 'NO' };

/** NULL means the VAT register was never asked, which is not the same as "not registered". */
function vatLabel(value: boolean | null | undefined, locale: string): string {
  if (value === true) return localized(YES, locale);
  if (value === false) return localized(NO, locale);
  return '';
}

/**
 * Hlavičky sloupců ve třech jazycích. Export je to, co odchází ze systému ven a co uživatel
 * posílá dál — anglický zákazník dostával list s českými nadpisy a větou „Proč oslovit" česky,
 * i když celé rozhraní měl anglicky.
 */
export const EXPORT_COLUMNS = [
  { key: 'name',       cs: 'Název firmy',          sk: 'Názov firmy',          en: 'Business name' },
  { key: 'ico',        cs: 'IČO',                  sk: 'IČO',                  en: 'Company ID' },
  { key: 'phone',      cs: 'Telefon',              sk: 'Telefón',              en: 'Phone' },
  { key: 'email',      cs: 'Email',                sk: 'Email',                en: 'Email' },
  { key: 'address',    cs: 'Adresa',               sk: 'Adresa',               en: 'Address' },
  { key: 'website',    cs: 'Web',                  sk: 'Web',                  en: 'Website' },
  { key: 'contactUrl', cs: 'Kontaktní stránka',    sk: 'Kontaktná stránka',    en: 'Contact page' },
  { key: 'hasWeb',     cs: 'Má web',               sk: 'Má web',               en: 'Has website' },
  { key: 'facebook',   cs: 'Facebook',             sk: 'Facebook',             en: 'Facebook' },
  { key: 'instagram',  cs: 'Instagram',            sk: 'Instagram',            en: 'Instagram' },
  { key: 'linkedin',   cs: 'LinkedIn',             sk: 'LinkedIn',             en: 'LinkedIn' },
  { key: 'socials',    cs: 'Sítě ověřeny',         sk: 'Siete overené',        en: 'Socials checked' },
  { key: 'vat',        cs: 'Plátce DPH',           sk: 'Platiteľ DPH',         en: 'VAT registered' },
  { key: 'vatBad',     cs: 'Nespolehlivý plátce',  sk: 'Nespoľahlivý platiteľ', en: 'Unreliable VAT payer' },
  { key: 'score',      cs: 'Skóre',                sk: 'Skóre',                en: 'Score' },
  { key: 'reach',      cs: 'Dosažitelnost',        sk: 'Dosiahnuteľnosť',      en: 'Reachability' },
  { key: 'reason',     cs: 'Proč oslovit',         sk: 'Prečo osloviť',        en: 'Why contact' },
  { key: 'audit',      cs: 'Audit webu',           sk: 'Audit webu',           en: 'Website audit' },
  { key: 'category',   cs: 'Kategorie',            sk: 'Kategória',            en: 'Category' },
  { key: 'source',     cs: 'Zdroj',                sk: 'Zdroj',                en: 'Source' },
] as const;

/** Hodnoty jednoho řádku v pořadí `EXPORT_COLUMNS`. Sdílí to XLSX i CSV, aby se nerozešly. */
export function exportRow(b: BusinessResult, criteria: readonly string[] | null | undefined, locale: string): Array<string | number> {
  return [
    b.name,
    b.ico || '',
    b.phone || '',
    b.email || '',
    b.address || '',
    b.website || '',
    b.contactUrl || '',
    localized(WEBSITE_LABEL[resolveStatus(b)], locale),
    b.facebookUrl || '',
    b.instagramUrl || '',
    b.linkedInUrl || '',
    b.socialsChecked ? localized(YES, locale) : '',
    vatLabel(b.vatPayer, locale),
    vatLabel(b.vatUnreliable, locale),
    b.leadScore,
    reachScore(b),
    leadReason(b, criteria, locale),
    // Věta do nabídky („Web působí zastarale (42/100): bez HTTPS…"), stejná jako na řádku.
    websiteAudit(b, locale)?.sentence ?? '',
    // Kód i název: „73110 Činnosti reklamních agentur" — kód pro stroje, název pro lidi.
    b.category ? `${b.category} ${naceLabel(b.category) ?? ''}`.trim() : '',
    b.source,
  ];
}

/**
 * Skóre a důvod patří do exportu ze stejného důvodu, z jakého jsou v tabulce: soubor se sype do
 * CRM nebo do sdíleného listu a člověk, který ho tam otevře, u řádku nemá jak zjistit, proč
 * zrovna tahle firma. Věta je počítaná z týchž kritérií jako pořadí, takže export a obrazovka
 * říkají totéž.
 */
export function exportToExcel(
  businesses: BusinessResult[],
  filename = 'klienthunter-export',
  criteria?: readonly string[] | null,
  locale: string = 'cs',
): Buffer {
  const rows = businesses.map(b => {
    const values = exportRow(b, criteria, locale);
    return Object.fromEntries(EXPORT_COLUMNS.map((c, i) => [localized(c, locale), values[i]]));
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // One entry per column above, in the same order.
  ws['!cols'] = [
    { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 35 },
    { wch: 30 }, { wch: 34 }, { wch: 10 }, { wch: 38 }, { wch: 38 },
    { wch: 38 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 7 },
    { wch: 14 }, { wch: 70 }, { wch: 60 }, { wch: 20 }, { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, localized({ cs: 'Firmy', sk: 'Firmy', en: 'Businesses' }, locale));

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
