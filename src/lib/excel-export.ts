import * as XLSX from 'xlsx';
import { BusinessResult } from '@prisma/client';

export function exportToExcel(businesses: BusinessResult[], filename = 'klienthunter-export'): Buffer {
  const rows = businesses.map((b) => ({
    'Název firmy': b.name,
    'Telefon': b.phone || '',
    'Email': b.email || '',
    'Adresa': b.address || '',
    'Web': b.website || '',
    'Má web': b.hasWebsite ? 'ANO' : 'NE',
    'Má Facebook': b.hasFacebook ? 'ANO' : 'NE',
    'Má Instagram': b.hasInstagram ? 'ANO' : 'NE',
    'Má LinkedIn': b.hasLinkedIn ? 'ANO' : 'NE',
    'Počet recenzí': b.reviewCount,
    'Hodnocení': b.rating ?? '',
    'Google Maps': b.googleMapsUrl || '',
    'Kategorie': b.category || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 30 }, { wch: 18 }, { wch: 28 }, { wch: 35 },
    { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Firmy');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
