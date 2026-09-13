import { leadReason } from './lead-reason';
import { localized } from './lead-filters';
import { websiteAudit } from './website-audit';
import type { BusinessResult } from '@prisma/client';

/**
 * Export ve tvaru, který CRM načte bez ručního mapování sloupců.
 *
 * Obecné CSV má devatenáct sloupců a v Pipedrive nebo Raynetu je člověk musí při importu
 * jeden po druhém přiřadit k polím. Tady jsou jen sloupce, které CRM zná, pojmenované tak,
 * jak je jmenuje ono — a věta „proč oslovit" s auditem webu jde do poznámky, aby zůstala
 * u firmy i v cizím systému.
 *
 *  - Pipedrive: hlavičky ve tvaru `Organization - Name`, jak je generuje jeho vlastní
 *    šablona pro import z tabulky; čárka jako oddělovač, protože importér je anglický.
 *  - Raynet CRM (české): hlavičky česky podle importu klientů; středník jako v českém Excelu.
 *
 * Žádné sloupce navíc: co CRM nezná, by se stejně muselo mapovat ručně nebo zahodit.
 */
export type CrmFormat = 'pipedrive' | 'raynet';

export const CRM_FORMATS: Array<{ id: CrmFormat; label: string; sep: ',' | ';' }> = [
  { id: 'pipedrive', label: 'Pipedrive', sep: ',' },
  { id: 'raynet',    label: 'Raynet CRM', sep: ';' },
];

export function isCrmFormat(value: string | null): value is CrmFormat {
  return value === 'pipedrive' || value === 'raynet';
}

const NOTE_HEAD = { cs: 'KlientHunter', sk: 'KlientHunter', en: 'KlientHunter' };
const SCORE = { cs: 'skóre', sk: 'skóre', en: 'score' };

function note(b: BusinessResult, criteria: readonly string[] | null | undefined, locale: string): string {
  const parts = [
    `${localized(NOTE_HEAD, locale)} · ${localized(SCORE, locale)} ${b.leadScore}/100`,
    leadReason(b, criteria, locale),
    websiteAudit(b, locale)?.sentence ?? '',
    b.ico ? `IČO ${b.ico}` : '',
  ].filter(Boolean);
  return parts.join(' — ');
}

/** Štítek podle skóre: CRM z něj udělá filtr „nejdřív ty nejlepší". */
function label(b: BusinessResult): string {
  return b.leadScore >= 70 ? 'Hot' : b.leadScore >= 40 ? 'Warm' : 'Cold';
}

export function crmTable(
  format: CrmFormat,
  businesses: BusinessResult[],
  criteria: readonly string[] | null | undefined,
  locale: string,
): { headers: string[]; rows: Array<Array<string | number>> } {
  if (format === 'pipedrive') {
    return {
      headers: ['Organization - Name', 'Organization - Address', 'Organization - Phone', 'Organization - Email', 'Organization - Website', 'Organization - Label', 'Organization - IČO', 'Note - Content'],
      rows: businesses.map(b => [
        b.name, b.address || '', b.phone || '', b.email || '', b.website || '', label(b), b.ico || '', note(b, criteria, locale),
      ]),
    };
  }
  return {
    headers: ['Název', 'IČ', 'Telefon', 'E-mail', 'WWW', 'Adresa', 'Kategorie', 'Poznámka'],
    rows: businesses.map(b => [
      b.name, b.ico || '', b.phone || '', b.email || '', b.website || '', b.address || '', label(b), note(b, criteria, locale),
    ]),
  };
}
