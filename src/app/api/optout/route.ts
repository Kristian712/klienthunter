import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeIco, requestOptout, sendOptoutMail } from '@/lib/optout';
import { countHits, hashIp, recordHit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Kolik žádostí z jedné adresy za den. Formulář je veřejný a bez přihlášení. */
const OPTOUTS_PER_IP = 10;

const Body = z.object({
  ico: z.string().trim().min(1).max(12),
  /** Nepovinný. Vyřazení na něm nezávisí — je jen pro případný dotaz k nejasné žádosti. */
  email: z.string().trim().max(200).optional().transform(v => (v ? v : null))
          .refine(v => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Invalid e-mail'),
});

/**
 * Žádost o trvalé vyřazení. Vyřazení platí OKAMŽITĚ — zápis se nečeká na nikoho a žádné
 * potvrzení nepotřebuje. Kontrola v adminu přijde potom; neplatnou žádost admin zamítne a
 * subjekt se vrátí.
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

    // Pošta jde přes lib/mail.ts (Resend). Vyřazení platí i bez ní; když e-mail nedojde, nic se nestane. Odpověď o tom
    // schválně nic neříká — nesmí vzniknout dojem, že něco odešlo.
    if (email) {
      const base = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
      await sendOptoutMail(email, `${base}/api/optout/confirm?token=${token}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors, code: 'INVALID' }, { status: 422 });
    console.error('/api/optout:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
