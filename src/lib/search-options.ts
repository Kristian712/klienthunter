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

export const REGIONS = [
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
