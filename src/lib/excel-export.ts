import * as XLSX from 'xlsx';
import { BusinessResult } from '@prisma/client';
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
 * Social flags are only ever read off the firm's own homepage. On a row where we never found one
 * they are all `false` for the sole reason that nobody looked, so printing "NE" would invent an
 * answer. `socialsChecked` is what tells the two apart.
 */
export function socialLabel(has: boolean, checked: boolean): string {
  if (!checked) return '';
  return has ? 'ANO' : 'NE';
}

export function exportToExcel(businesses: BusinessResult[], filename = 'klienthunter-export'): Buffer {
  const rows = businesses.map((b) => ({
    'Název firmy': b.name,
    'IČO': b.ico || '',
    'Telefon': b.phone || '',
    'Email': b.email || '',
    'Adresa': b.address || '',
    'Web': b.website || '',
    'Má web': WEBSITE_LABEL_CS[resolveStatus(b)],
    'Má Facebook': socialLabel(b.hasFacebook, b.socialsChecked),
    'Má Instagram': socialLabel(b.hasInstagram, b.socialsChecked),
    'Má LinkedIn': socialLabel(b.hasLinkedIn, b.socialsChecked),
    'Plátce DPH': vatLabel(b.vatPayer),
    'Nespolehlivý plátce': vatLabel(b.vatUnreliable),
    // Ratings and review counts came only from Google Places, which had to go for licensing
    // reasons. `reviewCount` is written as a hard 0 and `rating` is never set, so the two columns
    // exported nothing but zeroes and blanks — a made-up "0 recenzí" about every firm in the file.
    'Kategorie': b.category || '',
    'Zdroj': b.source,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 35 },
    { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Firmy');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
