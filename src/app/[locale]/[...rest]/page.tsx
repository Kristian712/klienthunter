import { notFound } from 'next/navigation';

/**
 * Každá adresa pod jazykem, pro kterou neexistuje stránka.
 *
 * Next by ji jinak obsloužil svou kořenovou 404, která stojí mimo `[locale]/layout.tsx` —
 * bez tmavého tématu, lišty a v angličtině. Konkrétní trasy mají přednost před catch-all,
 * takže tohle chytá opravdu jen to, co nikam nevede.
 */
export default function UnknownPage() {
  notFound();
}
