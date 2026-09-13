/**
 * Kraj → kód NUTS 3. Okres v indexu z ČSÚ je LAU 1 (`CZ0724`), kraj je jeho prvních pět znaků
 * (`CZ072`), takže „celý kraj" je `district LIKE 'CZ072%'`. Dnešní hledání přes ARES umí jen
 * krajské město (`textovaAdresa`); index dává poprvé opravdu celý kraj.
 *
 * Klíč je druhá část hodnoty regionu z `search-options.ts` („Zlín, Zlínský kraj" → „Zlínský kraj").
 */
export const KRAJ_NUTS3: Record<string, string> = {
  'Czech Republic':        'CZ010', // Praha, Czech Republic
  'Hlavní město Praha':    'CZ010',
  'Středočeský kraj':      'CZ020',
  'Jihočeský kraj':        'CZ031',
  'Plzeňský kraj':         'CZ032',
  'Karlovarský kraj':      'CZ041',
  'Ústecký kraj':          'CZ042',
  'Liberecký kraj':        'CZ051',
  'Královéhradecký kraj':  'CZ052',
  'Pardubický kraj':       'CZ053',
  'Kraj Vysočina':         'CZ063',
  'Jihomoravský kraj':     'CZ064',
  'Olomoucký kraj':        'CZ071',
  'Zlínský kraj':          'CZ072',
  'Moravskoslezský kraj':  'CZ080',
};

/** NUTS 3 pro hodnotu regionu, nebo `null` pro cizí město či volný text. */
export function nuts3ForRegion(region: string): string | null {
  const parts = region.split(',').map(p => p.trim());
  const kraj = parts[parts.length - 1];
  return KRAJ_NUTS3[kraj] ?? null;
}
