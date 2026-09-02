/**
 * The pick-lists behind both the search form and the onboarding modal.
 *
 * These used to live at the top of the search page. The onboarding modal asks the same two
 * questions ("which trade?", "where?") and must offer the same options, so a second copy would
 * have drifted the first time anyone added a region.
 *
 * `value` is what goes to the search API and is deliberately English — it is a query string for
 * OpenStreetMap, not something a user reads. `label` is what a user reads.
 */

/**
 * The fourteen regional capitals, in the order the region list shows them.
 *
 * Two jobs at once. It is the batch list behind "Celá ČR" — a whole-country query is rejected
 * by ARES outright (HTTP 400 the moment the result would pass a thousand rows), so the only
 * way to cover the country is to walk it city by city and merge. And it is the single place
 * where the mapping "region → the town we actually search" is written down, so the labels
 * below cannot drift away from what the search really does.
 *
 * Why a town and not the region: measured on 2 September 2026, ARES honours only `kodObce`,
 * `kodCastiObce`, `kodUlice`, `kodMestskeCastiObvodu` and `textovaAdresa`. There is no key for
 * a region, and the region's name does not appear in any address — `textovaAdresa` of
 * "Zlínský kraj" returns zero rows, while "Zlín" returns 723.
 *
 * Středočeský kraj is the one region with no capital of its own (it is administered from
 * Prague, which is a region in itself), so it gets Kladno — the largest town inside it,
 * measured at 532 rows.
 */
export const CZ_STAGES: { value: string; label: string }[] = [
  { value: 'Praha, Czech Republic',                label: 'Praha' },
  { value: 'Kladno, Středočeský kraj',             label: 'Kladno' },
  { value: 'České Budějovice, Jihočeský kraj',     label: 'České Budějovice' },
  { value: 'Plzeň, Plzeňský kraj',                 label: 'Plzeň' },
  { value: 'Karlovy Vary, Karlovarský kraj',       label: 'Karlovy Vary' },
  { value: 'Ústí nad Labem, Ústecký kraj',         label: 'Ústí nad Labem' },
  { value: 'Liberec, Liberecký kraj',              label: 'Liberec' },
  { value: 'Hradec Králové, Královéhradecký kraj', label: 'Hradec Králové' },
  { value: 'Pardubice, Pardubický kraj',           label: 'Pardubice' },
  { value: 'Jihlava, Kraj Vysočina',               label: 'Jihlava' },
  { value: 'Brno, Jihomoravský kraj',              label: 'Brno' },
  { value: 'Olomouc, Olomoucký kraj',              label: 'Olomouc' },
  { value: 'Zlín, Zlínský kraj',                   label: 'Zlín' },
  { value: 'Ostrava, Moravskoslezský kraj',        label: 'Ostrava' },
];

export const REGIONS = [
  // Popisky říkají město, ne kraj, protože se hledá město. Do teď stálo v nabídce „Zlínský
  // kraj" a hledal se Zlín — uživatel se to dozvěděl až z výsledků, ve kterých chybělo
  // Uherské Hradiště. Radši to říct předem.
  { group: 'Česká republika — kraje', items: [
    { value: 'Celá ČR',                                    label: 'Celá ČR (14 krajských měst)' },
    { value: 'Praha, Czech Republic',                      label: 'Praha (Hlavní město Praha)' },
    { value: 'Kladno, Středočeský kraj',                   label: 'Středočeský kraj (Kladno a okolí)' },
    { value: 'České Budějovice, Jihočeský kraj',           label: 'Jihočeský kraj (České Budějovice a okolí)' },
    { value: 'Plzeň, Plzeňský kraj',                       label: 'Plzeňský kraj (Plzeň a okolí)' },
    { value: 'Karlovy Vary, Karlovarský kraj',             label: 'Karlovarský kraj (Karlovy Vary a okolí)' },
    { value: 'Ústí nad Labem, Ústecký kraj',               label: 'Ústecký kraj (Ústí nad Labem a okolí)' },
    { value: 'Liberec, Liberecký kraj',                    label: 'Liberecký kraj (Liberec a okolí)' },
    { value: 'Hradec Králové, Královéhradecký kraj',       label: 'Královéhradecký kraj (Hradec Králové a okolí)' },
    { value: 'Pardubice, Pardubický kraj',                 label: 'Pardubický kraj (Pardubice a okolí)' },
    { value: 'Jihlava, Kraj Vysočina',                     label: 'Kraj Vysočina (Jihlava a okolí)' },
    { value: 'Brno, Jihomoravský kraj',                    label: 'Jihomoravský kraj (Brno a okolí)' },
    { value: 'Olomouc, Olomoucký kraj',                    label: 'Olomoucký kraj (Olomouc a okolí)' },
    { value: 'Zlín, Zlínský kraj',                         label: 'Zlínský kraj (Zlín a okolí)' },
    { value: 'Ostrava, Moravskoslezský kraj',              label: 'Moravskoslezský kraj (Ostrava a okolí)' },
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

export const INDUSTRIES: Record<string, { group: string; items: { value: string; label: string }[] }[]> = {
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
      { value: 'hotel',            label: 'Hotely a penziony' },
      { value: 'freight',          label: 'Autodoprava' },
      { value: 'builder',          label: 'Stavební a zednické práce' },
      { value: 'flooring',         label: 'Podlaháři' },
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
      { value: 'glazier',          label: 'Sklenár' },
      { value: 'chimney sweep',    label: 'Kominár' },
      { value: 'tailor',           label: 'Krajčír' },
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
      { value: 'pharmacy',         label: 'Lekáreň' },
      { value: 'optician',         label: 'Optika' },
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
      { value: 'hotel',            label: 'Hotely a penzióny' },
      { value: 'freight',          label: 'Autodoprava' },
      { value: 'builder',          label: 'Stavebné a murárske práce' },
      { value: 'flooring',         label: 'Podlahári' },
      { value: 'florist',          label: 'Kvetinárstvo' },
      { value: 'language school',  label: 'Jazyková škola' },
      { value: 'personal trainer', label: 'Osobný tréner' },
      { value: 'yoga studio',      label: 'Jóga štúdio' },
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
      { value: 'glazier',          label: 'Glazier' },
      { value: 'chimney sweep',    label: 'Chimney sweep' },
      { value: 'tailor',           label: 'Tailor' },
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
      { value: 'pharmacy',         label: 'Pharmacy' },
      { value: 'optician',         label: 'Optician' },
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
      { value: 'hotel',            label: 'Hotels and guest houses' },
      { value: 'freight',          label: 'Road freight' },
      { value: 'builder',          label: 'Builders' },
      { value: 'flooring',         label: 'Flooring fitters' },
      { value: 'florist',          label: 'Florist' },
      { value: 'language school',  label: 'Language school' },
      { value: 'personal trainer', label: 'Personal trainer' },
      { value: 'yoga studio',      label: 'Yoga studio' },
    ]},
  ],
};

/**
 * The readable name of a trade, for places that show a past search back to the user.
 *
 * What gets stored with a search is `value` — an English OpenStreetMap query string. That is
 * right for the search itself and wrong for the history list, where a Czech user was reading
 * "hair salon" for a search they started by clicking "Kadeřnictví". The stored value is not
 * always in the list either (the field also takes free text), so anything unknown comes back
 * unchanged rather than disappearing.
 */
export function industryLabel(value: string, locale: string): string {
  const lists = [INDUSTRIES[locale], INDUSTRIES.cs, INDUSTRIES.en].filter(Boolean);
  for (const groups of lists) {
    for (const group of groups) {
      const hit = group.items.find(i => i.value === value);
      if (hit) return hit.label;
    }
  }
  return value;
}

// Popular categories shown as quick chips (localized)
export const POPULAR_CHIPS: Record<string, { value: string; label: string }[]> = {
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
