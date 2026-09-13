/**
 * Víc oborů v jednom hledání — a „všechny obory".
 *
 * Obor byl dosud jedna hodnota z nabídky nebo volný text. Uživatel, který obsluhuje účetní,
 * právníky i zubaře, musel hledat třikrát. Teď se obory skládají: v databázi (`Search.query`,
 * `SearchJob.industry`) zůstává jeden řetězec, jen může nést víc hodnot oddělených
 * `INDUSTRY_SEP`. Žádná změna schématu, přehled, export i uložená hledání čtou totéž pole
 * jako dřív a `industryLabel()` ho umí přečíst.
 *
 * `ALL_INDUSTRIES` znamená „bez omezení oboru". To umí jen index z ČSÚ (lib/sources/registry.ts)
 * s filtrem podle vzniku: ARES odmítne dotaz na město bez NACE, protože vrací tisíce subjektů.
 * Bez filtru vzniku tedy „všechny obory" nejdou spustit a UI to říká dopředu.
 */
export const INDUSTRY_SEP = ' + ';
export const ALL_INDUSTRIES = '*';
export const MAX_INDUSTRIES = 5;

export function isAllIndustries(industry: string): boolean {
  return industry.trim() === ALL_INDUSTRIES;
}

/** Jednotlivé obory z uloženého řetězce. `*` vrací prázdné pole — žádný obor, ne obor „*". */
export function splitIndustries(industry: string): string[] {
  if (isAllIndustries(industry)) return [];
  return industry.split(INDUSTRY_SEP).map(s => s.trim()).filter(Boolean);
}

export function joinIndustries(industries: string[]): string {
  return Array.from(new Set(industries.map(s => s.trim()).filter(Boolean))).slice(0, MAX_INDUSTRIES).join(INDUSTRY_SEP);
}

export const ALL_INDUSTRIES_LABEL = { cs: 'Všechny obory', sk: 'Všetky odbory', en: 'All trades' };
