/**
 * Přepnutí jazyka na jednom místě.
 *
 * Byla to dvě různá chování: lišta zapisovala cookii `NEXT_LOCALE` a zůstávala na téže stránce,
 * patička byly prosté odkazy na `/cs`, `/sk` a `/en`, které vedly na úvod a cookii nezapisovaly
 * vůbec. Middleware přitom bere tu cookii jako jedinou volbu jazyka, takže po kliknutí v patičce
 * uživatel přišel o stránku, na které byl, a holá doména ho příště stejně vrátila do češtiny.
 */

/** Jazyky psané tak, jak si je čte jejich vlastní mluvčí — ne přeložené do jazyka stránky. */
export const LANGUAGES = [
  { code: 'cs', label: 'Čeština' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'en', label: 'English' },
] as const;

/**
 * Zapíše volbu a přejde na tutéž stránku v novém jazyce.
 *
 * Cesta se skládá po segmentech, ne přes `replace`: `usePathname()` query string ani kotvu nenese,
 * takže z `/cs/search?job=abc` bylo `/en/search` — a rozdělané hledání zmizelo z obrazovky.
 * Query i kotva se proto berou z `window.location`.
 */
export function switchLocale(pathname: string, next: string): void {
  document.cookie = `NEXT_LOCALE=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  const parts = pathname.split('/');
  parts[1] = next;
  window.location.href = parts.join('/') + window.location.search + window.location.hash;
}
