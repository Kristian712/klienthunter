import * as XLSX from 'xlsx';
import { BusinessResult } from '@prisma/client';
import { resolveStatus, type WebsiteStatus } from './website-status';

export const WEBSITE_LABEL_CS: Record<WebsiteStatus, string> = {
  HAS: 'ANO',
  NONE: 'NE',
  UNKNOWN: 'NEOVĚŘENO',
};

/** NULL means the VAT register was never asked, which is not the same as "not registered". */
function vatLabel(value: boolean | null | undefined): string {
  if (value === true) return 'ANO';
  if (value === false) return 'NE';
  return '';
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
    'Má Facebook': b.hasFacebook ? 'ANO' : 'NE',
    'Má Instagram': b.hasInstagram ? 'ANO' : 'NE',
    'Má LinkedIn': b.hasLinkedIn ? 'ANO' : 'NE',
    'Plátce DPH': vatLabel(b.vatPayer),
    'Nespolehlivý plátce': vatLabel(b.vatUnreliable),
    'Počet recenzí': b.reviewCount,
    'Hodnocení': b.rating ?? '',
    'Kategorie': b.category || '',
    'Zdroj': b.source,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 30 }, { wch: 10 }, { wch: 18 }, { wch: 28 }, { wch: 35 },
    { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Firmy');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
