import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeIco, requestOptout, sendOptoutMail } from '@/lib/optout';
import { countHits, hashIp, recordHit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Kolik žádostí z jedné adresy za den. Formulář je veřejný a bez přihlášení. */
const OPTOUTS_PER_IP = 10;

const Body = z.object({
  ico: z.string().trim().min(1).max(12),
  email: z.string().trim().email().max(200),
});

/**
 * Žádost o trvalé vyřazení. Vyřazení platí OKAMŽITĚ — zápis se nečeká na nikoho. Potvrzení
 * e-mailem a kontrola v adminu přijdou potom; neplatnou žádost admin zamítne a subjekt se vrátí.
 *
 * Odpověď je stejná pro nové i opakované IČO a neříká, jestli subjekt v databázi vůbec je:
 * formulář nesmí sloužit jako ověřovač, kdo v seznamu figuruje.
 */
export async function POST(req: NextRequest) {
  try {
    const ipHash = hashIp(req);
    if ((await countHits(ipHash, 'optout')) >= OPTOUTS_PER_IP) {
      return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMIT' }, { status: 429 });
    }
    const { ico: rawIco, email } = Body.parse(await req.json());
    const ico = normalizeIco(rawIco);
    if (!ico) return NextResponse.json({ error: 'Invalid ICO', code: 'INVALID_ICO' }, { status: 422 });

    await recordHit(ipHash, 'optout');
    const { token } = await requestOptout(ico, email);

    const base = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const mail = await sendOptoutMail(email, `${base}/api/optout/confirm?token=${token}`);

    return NextResponse.json({ ok: true, mail });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors, code: 'INVALID' }, { status: 422 });
    console.error('/api/optout:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
