import { NextRequest, NextResponse } from 'next/server';

/**
 * Kam se hlásí pád, který se stal v prohlížeči.
 *
 * Chybová hranice do teď ukázala uživateli `digest` — osmnáct znaků, ke kterým jsem nikde neměl
 * druhou půlku. Next.js totiž z produkčního buildu hlášku chyby úmyslně vymaže a nechá jen ten
 * otisk; v logu funkce se přitom objeví jen chyby, které spadly na serveru. Pád v klientské
 * komponentě tedy nezanechal žádnou stopu vůbec: uživatel napsal „ukázalo se něco se pokazilo"
 * a víc se zjistit nedalo.
 *
 * Tahle route nic neukládá do databáze. Jen zapíše řádek do logu funkce, takže se v protokolu
 * Vercelu dá `digest` spárovat s hláškou, adresou a prohlížečem. Žádná autentizace: chyba se
 * může stát i nepřihlášenému a v odpovědi se nic nevrací, takže není co získat.
 */

export const dynamic = 'force-dynamic';

/** Ochrana logu před stránkou, která by v cyklu posílala kilobajtové zprávy. */
const MAX = 500;

const clip = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, MAX) : '';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.error('[client-error]', {
      message: clip(body?.message) || '(bez hlášky)',
      digest: clip(body?.digest),
      stack: clip(body?.stack),
      path: clip(body?.path),
      locale: clip(body?.locale),
      userAgent: clip(req.headers.get('user-agent')),
    });
  } catch (err) {
    console.error('[client-error] nepodařilo se přečíst hlášení:', err);
  }

  // Vždycky 204: hlášení chyby nesmí být další chyba.
  return new NextResponse(null, { status: 204 });
}
