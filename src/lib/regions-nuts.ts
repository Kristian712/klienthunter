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

/**
 * Okresy (LAU 1) podle kraje — 77 kódů, ověřeno proti indexu ČSÚ (14. 9. 2026: přesně těchto 77
 * kódů v `RegistrySubject.district`). Praha je jediný okres svého kraje.
 */
export const DISTRICTS: Record<string, Array<{ code: string; name: string }>> = {
  CZ010: [{ code: 'CZ0100', name: 'Praha' }],
  CZ020: [
    { code: 'CZ0201', name: 'Benešov' }, { code: 'CZ0202', name: 'Beroun' }, { code: 'CZ0203', name: 'Kladno' },
    { code: 'CZ0204', name: 'Kolín' }, { code: 'CZ0205', name: 'Kutná Hora' }, { code: 'CZ0206', name: 'Mělník' },
    { code: 'CZ0207', name: 'Mladá Boleslav' }, { code: 'CZ0208', name: 'Nymburk' }, { code: 'CZ0209', name: 'Praha-východ' },
    { code: 'CZ020A', name: 'Praha-západ' }, { code: 'CZ020B', name: 'Příbram' }, { code: 'CZ020C', name: 'Rakovník' },
  ],
  CZ031: [
    { code: 'CZ0311', name: 'České Budějovice' }, { code: 'CZ0312', name: 'Český Krumlov' }, { code: 'CZ0313', name: 'Jindřichův Hradec' },
    { code: 'CZ0314', name: 'Písek' }, { code: 'CZ0315', name: 'Prachatice' }, { code: 'CZ0316', name: 'Strakonice' }, { code: 'CZ0317', name: 'Tábor' },
  ],
  CZ032: [
    { code: 'CZ0321', name: 'Domažlice' }, { code: 'CZ0322', name: 'Klatovy' }, { code: 'CZ0323', name: 'Plzeň-město' },
    { code: 'CZ0324', name: 'Plzeň-jih' }, { code: 'CZ0325', name: 'Plzeň-sever' }, { code: 'CZ0326', name: 'Rokycany' }, { code: 'CZ0327', name: 'Tachov' },
  ],
  CZ041: [{ code: 'CZ0411', name: 'Cheb' }, { code: 'CZ0412', name: 'Karlovy Vary' }, { code: 'CZ0413', name: 'Sokolov' }],
  CZ042: [
    { code: 'CZ0421', name: 'Děčín' }, { code: 'CZ0422', name: 'Chomutov' }, { code: 'CZ0423', name: 'Litoměřice' }, { code: 'CZ0424', name: 'Louny' },
    { code: 'CZ0425', name: 'Most' }, { code: 'CZ0426', name: 'Teplice' }, { code: 'CZ0427', name: 'Ústí nad Labem' },
  ],
  CZ051: [{ code: 'CZ0511', name: 'Česká Lípa' }, { code: 'CZ0512', name: 'Jablonec nad Nisou' }, { code: 'CZ0513', name: 'Liberec' }, { code: 'CZ0514', name: 'Semily' }],
  CZ052: [{ code: 'CZ0521', name: 'Hradec Králové' }, { code: 'CZ0522', name: 'Jičín' }, { code: 'CZ0523', name: 'Náchod' }, { code: 'CZ0524', name: 'Rychnov nad Kněžnou' }, { code: 'CZ0525', name: 'Trutnov' }],
  CZ053: [{ code: 'CZ0531', name: 'Chrudim' }, { code: 'CZ0532', name: 'Pardubice' }, { code: 'CZ0533', name: 'Svitavy' }, { code: 'CZ0534', name: 'Ústí nad Orlicí' }],
  CZ063: [{ code: 'CZ0631', name: 'Havlíčkův Brod' }, { code: 'CZ0632', name: 'Jihlava' }, { code: 'CZ0633', name: 'Pelhřimov' }, { code: 'CZ0634', name: 'Třebíč' }, { code: 'CZ0635', name: 'Žďár nad Sázavou' }],
  CZ064: [
    { code: 'CZ0641', name: 'Blansko' }, { code: 'CZ0642', name: 'Brno-město' }, { code: 'CZ0643', name: 'Brno-venkov' }, { code: 'CZ0644', name: 'Břeclav' },
    { code: 'CZ0645', name: 'Hodonín' }, { code: 'CZ0646', name: 'Vyškov' }, { code: 'CZ0647', name: 'Znojmo' },
  ],
  CZ071: [{ code: 'CZ0711', name: 'Jeseník' }, { code: 'CZ0712', name: 'Olomouc' }, { code: 'CZ0713', name: 'Prostějov' }, { code: 'CZ0714', name: 'Přerov' }, { code: 'CZ0715', name: 'Šumperk' }],
  CZ072: [{ code: 'CZ0721', name: 'Kroměříž' }, { code: 'CZ0722', name: 'Uherské Hradiště' }, { code: 'CZ0723', name: 'Vsetín' }, { code: 'CZ0724', name: 'Zlín' }],
  CZ080: [
    { code: 'CZ0801', name: 'Bruntál' }, { code: 'CZ0802', name: 'Frýdek-Místek' }, { code: 'CZ0803', name: 'Karviná' },
    { code: 'CZ0804', name: 'Nový Jičín' }, { code: 'CZ0805', name: 'Opava' }, { code: 'CZ0806', name: 'Ostrava-město' },
  ],
};

export function districtName(code: string): string {
  for (const list of Object.values(DISTRICTS)) { const hit = list.find(d => d.code === code); if (hit) return hit.name; }
  return code;
}
