'use client';

import { useEffect } from 'react';

import { reportError } from '@/lib/report-error';

/**
 * Poslední záchrana: chyba, která spadla v kořenovém layoutu, se do `[locale]/error.tsx`
 * nedostane — ten je uvnitř toho layoutu. Tahle hranice musí vykreslit vlastní `<html>`,
 * protože nahrazuje celý dokument, a nesmí spoléhat na nic z aplikace: ani na styly, ani na
 * překlady, ani na fonty. Odtud se dá jen znovu načíst.
 */

/**
 * Texty bez next-intl. Do teď byla tahle stránka natvrdo česky, takže Slovák nebo Angličan
 * dostal v nejhorší možný okamžik cizí jazyk. Jazyk se čte z adresy — kontext překladů
 * v tuhle chvíli neexistuje, protože právě spadl celý layout.
 */
const T = {
  cs: {
    title: 'Aplikaci se nepodařilo načíst',
    body: 'Zkuste stránku načíst znovu. Pokud to bude opakovat, napište mi a pošlete kód chyby.',
    detail: 'Co se stalo',
    retry: 'Zkusit znovu',
  },
  sk: {
    title: 'Aplikáciu sa nepodarilo načítať',
    body: 'Skúste stránku načítať znova. Ak sa to bude opakovať, napíšte mi a pošlite kód chyby.',
    detail: 'Čo sa stalo',
    retry: 'Skúsiť znova',
  },
  en: {
    title: 'The application failed to load',
    body: 'Please try loading the page again. If it keeps happening, tell me and include the error code.',
    detail: 'What happened',
    retry: 'Try again',
  },
};

/**
 * Barvy natvrdo, protože `globals.css` se sem nenačte. Jsou to tytéž hodnoty jako tokeny
 * tmavého tématu, aby pád nevypadal jako jiná aplikace — dřív tu byla bílá stránka uprostřed
 * tmavého webu. Kontrast: text 16,7 : 1, tlumený 9,4, nejslabší 6,6, tlačítko 11,5
 * (tmavý text na světle modré; světlý by měl jen 1,45).
 */
const C = {
  surface: '#060607',
  card: '#111113',
  line: 'rgba(255,255,255,0.12)',
  ink: '#F5F5F6',
  muted: '#AAAAB0',
  faint: '#8C8C93',
  accent: '#FAFAFA',
  accentInk: '#080809',
};

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const seg = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'cs';
  const t = T[seg as keyof typeof T] ?? T.cs;
  const lang = seg === 'sk' || seg === 'en' ? seg : 'cs';

  useEffect(() => {
    reportError(error, lang);
    // `lang` se odvozuje z adresy a mezi dvěma pády na téže stránce se nemění.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  return (
    <html lang={lang} style={{ colorScheme: 'dark', background: C.surface }}>
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem', background: C.surface, color: C.ink }}>
        <div style={{ maxWidth: '32rem', margin: '4rem auto', background: C.card, border: `1px solid ${C.line}`, borderRadius: '8px', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>{t.title}</h1>
          <p style={{ fontSize: '0.875rem', color: C.muted, marginTop: '0.5rem' }}>{t.body}</p>
          {(error.message || error.digest) && (
            <div style={{ marginTop: '1rem', borderTop: `1px solid ${C.line}`, paddingTop: '0.75rem' }}>
              <p style={{ fontSize: '0.6875rem', color: C.faint, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                {t.detail}
              </p>
              {error.message && (
                <p style={{ fontSize: '0.75rem', color: C.muted, fontFamily: 'monospace', marginTop: '0.25rem', wordBreak: 'break-word' }}>
                  {error.message}
                </p>
              )}
              {error.digest && (
                <p style={{ fontSize: '0.6875rem', color: C.faint, fontFamily: 'monospace', marginTop: '0.25rem' }}>
                  kód: {error.digest}
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => reset()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', border: 'none', borderRadius: '8px', background: C.accent, color: C.accentInk, fontWeight: 600, cursor: 'pointer' }}
          >
            {t.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
