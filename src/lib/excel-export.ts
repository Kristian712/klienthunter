import * as XLSX from 'xlsx';
import { BusinessResult } from '@prisma/client';
import { leadReason } from './lead-reason';
import { resolveStatus, type WebsiteStatus } from './website-status';

/**
 * UNKNOWN is deliberately an empty cell, not a word.
 *
 * A spreadsheet gets sorted, filtered and pasted into other people's documents, and any word we
 * put here would travel with the row as if it were a finding about the firm. It is not one: it
 * only means nobody could confirm a page. The empty cell says exactly that much and no more —
 * the same convention `vatLabel()` below already uses for a register we never asked.
 */
export const WEBSITE_LABEL_CS: Record<WebsiteStatus, string> = {
  HAS: 'ANO',
  NONE: 'NE',
  UNKNOWN: '',
};

/** NULL means the VAT register was never asked, which is not the same as "not registered". */
function vatLabel(value: boolean | null | undefined): string {
  if (value === true) return 'ANO';
  if (value === false) return 'NE';
  return '';
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
): Buffer {
  const rows = businesses.map((b) => ({
    'Název firmy': b.name,
    'IČO': b.ico || '',
    'Telefon': b.phone || '',
    'Email': b.email || '',
    'Adresa': b.address || '',
    'Web': b.website || '',
    'Kontaktní stránka': b.contactUrl || '',
    'Má web': WEBSITE_LABEL_CS[resolveStatus(b)],
    // Odkaz, ne ANO/NE. Kdo si export otevře, chce na profil kliknout, ne se dozvědět, že
    // existuje. Prázdná buňka dál znamená „nevíme" i „nenašli jsme" — rozlišit to umí sloupec
    // „Sítě ověřeny" níž.
    'Facebook': b.facebookUrl || '',
    'Instagram': b.instagramUrl || '',
    'LinkedIn': b.linkedInUrl || '',
    'Sítě ověřeny': b.socialsChecked ? 'ANO' : '',
    'Plátce DPH': vatLabel(b.vatPayer),
    'Nespolehlivý plátce': vatLabel(b.vatUnreliable),
    // Ratings and review counts came only from Google Places, which had to go for licensing
    // reasons. `reviewCount` is written as a hard 0 and `rating` is never set, so the two columns
    // exported nothing but zeroes and blanks — a made-up "0 recenzí" about every firm in the file.
    'Skóre': b.leadScore,
    'Proč oslovit': leadReason(b, criteria, 'cs'),
    'Kategorie': b.category || '',
    'Zdroj': b.source,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // One entry per column above, in the same order.
  ws['!cols'] = [
    { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 35 },
    { wch: 30 }, { wch: 34 }, { wch: 10 }, { wch: 38 }, { wch: 38 },
    { wch: 38 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 7 },
    { wch: 70 }, { wch: 20 }, { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Firmy');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
