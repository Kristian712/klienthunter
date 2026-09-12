/**
 * Datum a čas jedním způsobem v celé aplikaci.
 *
 * Devět míst si formát psalo samo a rozešla se: ceník používal `en-GB`, profil a přehled `en-US`.
 * Anglický zákazník ve zkušebním období tak četl konec zkušebky na ceníku jako „12/09/2026"
 * a v profilu jako „9/12/2026" — z dvojice se nedalo poznat, kdy mu strhnou peníze. `en-GB` je
 * u nejednoznačných dat bezpečnější volba, protože pořadí den–měsíc odpovídá zbytku Evropy.
 *
 * Slovenština dostává vlastní locale, ne češtinu: formát je stejný, ale názvy měsíců (kdyby se
 * někde použily) by česky vypadaly jako nedodělaný překlad.
 */
const INTL_LOCALE: Record<string, string> = { cs: 'cs-CZ', sk: 'sk-SK', en: 'en-GB' };

function intlFor(locale: string): string {
  return INTL_LOCALE[locale] ?? INTL_LOCALE.cs;
}

/** `1. 3. 2026`, `1. 3. 2026`, `01/03/2026`. Prázdný řetězec u chybějícího nebo vadného data. */
export function formatDate(value: string | Date | null | undefined, locale: string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(intlFor(locale));
}

/** Hodina a minuta ve stejném jazyce jako `formatDate`. */
export function formatTime(value: string | Date | null | undefined, locale: string): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(intlFor(locale), { hour: '2-digit', minute: '2-digit' });
}
