/**
 * Rozsah indexu z ČSÚ — v samostatném modulu bez Prismy, aby ho mohla číst i stránka
 * o zdrojích dat a klient, aniž by si do bundlu přitáhly databázi.
 *
 * Rozsah je záměrně konzervativní (majitel, 13. 9. 2026): Neon free má 0,5 GB a přesné číslo
 * zbylého místa se čte až z běžící aplikace. Změřeno 13. 9. 2026: 24 měsíců = 250 370 řádků,
 * 42 MB včetně indexů. Okno se rozšíří podle skutečnosti.
 */
export const REGISTRY_INDEX_MONTHS = 60;
