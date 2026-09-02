/**
 * Odeslání pádu z prohlížeče na server.
 *
 * Chybové hranice v Next.js dostávají v produkci jen `digest` — osmnáctiznakový otisk, ke
 * kterému nikde není druhá půlka, protože hlášku Next z produkčního buildu úmyslně vymaže.
 * V logu funkce se přitom objeví jen chyby, které spadly na serveru, takže pád v klientské
 * komponentě dosud nezanechal vůbec žádnou stopu.
 *
 * Tahle funkce zapíše chybu do konzole prohlížeče (pro toho, kdo se dívá) a pošle ji na
 * `/api/client-error`, kde skončí v logu funkce (pro mě, o den později). Nic nevrací a nikdy
 * nevyhodí výjimku: hlášení chyby nesmí být další chyba.
 *
 * Vlastní modul, ne export z `error.tsx` — soubory `error.tsx` a `global-error.tsx` jsou pro
 * Next speciální a importovat mezi nimi je zbytečně křehké.
 */

/** Ať se do logu nevejde celý stack trace o pěti kilobajtech. */
const MAX_STACK = 2000;

export function reportError(error: Error & { digest?: string }, locale: string): void {
  // Konzole první: kdyby síť selhala, aspoň tohle uvidí ten, kdo má otevřené vývojářské nástroje.
  console.error('[KlientHunter]', error);

  try {
    const body = JSON.stringify({
      message: error?.message ?? '',
      digest: error?.digest ?? '',
      stack: (error?.stack ?? '').slice(0, MAX_STACK),
      path: typeof window !== 'undefined' ? window.location.pathname : '',
      locale,
    });

    // `keepalive` kvůli tomu, že po pádu může uživatel kartu hned zavřít — bez něj by
    // prohlížeč nedokončený požadavek zrušil a hlášení by se ztratilo.
    void fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Offline, blokovaný požadavek, cokoli. Uživateli se nic říkat nebude.
  }
}
