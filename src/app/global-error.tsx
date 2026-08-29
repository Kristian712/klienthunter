'use client';

/**
 * Poslední záchrana: chyba, která spadla v kořenovém layoutu, se do `[locale]/error.tsx`
 * nedostane — ten je uvnitř toho layoutu. Tahle hranice musí vykreslit vlastní `<html>`,
 * protože nahrazuje celý dokument, a nesmí spoléhat na nic z aplikace: ani na styly, ani na
 * překlady, ani na fonty. Odtud se dá jen znovu načíst.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="cs">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem', color: '#111' }}>
        <div style={{ maxWidth: '32rem', margin: '4rem auto', border: '1px solid #e5e5e5', padding: '1.5rem' }}>
          <h1 style={{ fontSize: '1.25rem', margin: 0 }}>Aplikaci se nepodařilo načíst</h1>
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
            Zkuste stránku načíst znovu. Pokud to bude opakovat, napište mi a pošlete kód chyby.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.6875rem', color: '#999', fontFamily: 'monospace' }}>kód: {error.digest}</p>
          )}
          <button
            onClick={() => reset()}
            style={{ marginTop: '1rem', padding: '0.5rem 1rem', border: '1px solid #111', background: '#111', color: '#fff', cursor: 'pointer' }}
          >
            Zkusit znovu
          </button>
        </div>
      </body>
    </html>
  );
}
