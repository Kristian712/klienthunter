'use client';

import { useEffect, useState } from 'react';

import { reportError } from '@/lib/report-error';

/**
 * Co uvidí uživatel, když klientská komponenta spadne.
 *
 * Do téhle chvíle aplikace neměla žádnou hranici chyby, takže jakýkoli pád znamenal bílou
 * stránku s větou „Application error: a client-side exception has occurred" — bez vysvětlení,
 * bez cesty ven a bez jediné informace pro mě.
 *
 * Nejčastější příčina navíc není chyba v kódu, ale nasazení. Vercel po přepnutí na novou verzi
 * přestane servírovat statické soubory té předchozí: chunky starého buildu vracejí 404 (ověřeno
 * — `page-d7324f08d2d23e73.js` → 404 hned po nasazení další verze). Kdo měl v tu chvíli
 * otevřenou kartu nebo mu prohlížeč podstrčil uloženou HTML, sáhl po souboru, který už
 * neexistuje, dostal `ChunkLoadError` a tuhle bílou stránku.
 *
 * Na to je správná reakce načíst stránku znovu — přijde čerstvá HTML s novými názvy souborů
 * a je po problému. Děláme to automaticky a právě jednou; kdyby chyba byla ve skutečnosti
 * jinde, druhé kolo by nastartovalo nekonečnou smyčku, a to je horší než chybová hláška.
 */

/**
 * Kdy jsme naposledy zkusili načíst novou verzi. Časové razítko, ne příznak — příznak by se
 * musel někde uklízet, a první verze tohohle souboru ho uklízela přesně v tom renderu, kde měl
 * držet, takže se stránka zacyklila v nekonečném obnovování. Razítko vyprší samo.
 */
const RELOADED_KEY = 'kh-chunk-reload';
const RELOAD_COOLDOWN_MS = 30_000;

/** Text bez next-intl: hranice chyby musí fungovat i tehdy, když spadl právě překladový kontext. */
const T = {
  cs: {
    reloading: 'Načítám novou verzi aplikace…',
    title: 'Něco se pokazilo',
    body: 'Stránku se nepodařilo zobrazit. Zkuste to prosím znovu — pokud to bude opakovat, napište mi a pošlete kód chyby níž.',
    retry: 'Zkusit znovu',
    home: 'Zpět na hledání',
    detail: 'Co se stalo',
  },
  sk: {
    reloading: 'Načítavam novú verziu aplikácie…',
    title: 'Niečo sa pokazilo',
    body: 'Stránku sa nepodarilo zobraziť. Skúste to prosím znova — ak sa to bude opakovať, napíšte mi a pošlite kód chyby nižšie.',
    retry: 'Skúsiť znova',
    home: 'Späť na hľadanie',
    detail: 'Čo sa stalo',
  },
  en: {
    reloading: 'Loading the new version…',
    title: 'Something went wrong',
    body: 'The page could not be displayed. Please try again — if it keeps happening, tell me and include the error code below.',
    retry: 'Try again',
    home: 'Back to search',
    detail: 'What happened',
  },
};

/** Pád způsobený tím, že soubor z minulého buildu už na serveru není. */
function isStaleBuild(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(error.message) ||
    /Failed to fetch dynamically imported module/i.test(error.message) ||
    /importing a module script failed/i.test(error.message)
  );
}

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(false);

  // Jazyk z adresy, ne z kontextu — ten v tuhle chvíli nemusí existovat.
  const seg = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'cs';
  const t = T[seg as keyof typeof T] ?? T.cs;

  // Hlášení jde ven vždycky, i u zastaralého buildu — právě podle počtu těch hlášení se pozná,
  // jestli je automatické načtení nové verze potřeba, nebo jestli se za tím schovává něco jiného.
  useEffect(() => {
    reportError(error, seg);
    // `seg` se odvozuje z adresy a mezi dvěma pády na téže stránce se nemění.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (!isStaleBuild(error)) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0); } catch { /* soukromé okno */ }
    // Už jsme to právě zkusili a nepomohlo to. Druhé kolo by byla smyčka, ne oprava.
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
    try { sessionStorage.setItem(RELOADED_KEY, String(Date.now())); } catch { /* přijdeme o pojistku */ }
    setReloading(true);
    window.location.reload();
  }, [error]);

  if (reloading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-sm text-ink-muted">{t.reloading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-line p-6">
        <h1 className="text-xl font-extrabold tracking-tight">{t.title}</h1>
        <p className="text-sm text-ink-muted mt-2">{t.body}</p>
        {/*
          Hláška, pokud nějaká přežila produkční build. Next ji z klientských chyb vymazává,
          takže tady většinou bude jen `digest` — ale když je hláška k dispozici, je pro
          uživatele i pro mě o řád užitečnější než osmnáct náhodných znaků.
        */}
        {(error.message || error.digest) && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-faint">{t.detail}</p>
            {error.message && (
              <p className="text-xs text-ink-muted mt-1 font-mono break-words">{error.message}</p>
            )}
            {error.digest && (
              <p className="text-[11px] text-ink-faint mt-1 font-mono">kód: {error.digest}</p>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 mt-5">
          <button onClick={reset} className="btn-primary">{t.retry}</button>
          <a href={`/${seg === 'sk' || seg === 'en' ? seg : 'cs'}/search`} className="btn-outline btn-sm">
            {t.home}
          </a>
        </div>
      </div>
    </div>
  );
}
