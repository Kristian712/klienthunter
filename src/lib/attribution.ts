/**
 * Attribution strings the UI has to render.
 *
 * Kept in its own dependency-free module so a client component can import it without pulling
 * axios and every data source into the browser bundle.
 *
 * ODbL is share-alike: anything we publish that is derived from OpenStreetMap must name the
 * source. This is not decoration — it is the licence condition we rely on to use the data.
 */
export const OSM_ATTRIBUTION = '© přispěvatelé OpenStreetMap (ODbL)';

/**
 * Totéž ve třech jazycích. Slovenská patička dřív interpolovala českou variantu, takže
 * uprostřed slovenské věty stálo „© přispěvatelé". Uvedení zdroje je licenční podmínka,
 * ne dekorace — má být čitelné v jazyce, ve kterém se stránka zobrazuje.
 */
export const OSM_ATTRIBUTION_L = {
  cs: '© přispěvatelé OpenStreetMap (ODbL)',
  sk: '© prispievatelia OpenStreetMap (ODbL)',
  en: '© OpenStreetMap contributors (ODbL)',
};
