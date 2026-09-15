import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendMail } from '@/lib/mail';
import { countHits, hashIp, recordHit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().email().max(200),
  locale: z.enum(['cs', 'sk', 'en']).default('cs'),
});

/** Kolik žádostí o reset z jedné IP za 24 h. Víc nemá poctivý uživatel proč posílat. */
const FORGOT_PER_IP = 10;
const RESET_TTL_MIN = 60;

const T = {
  subject: { cs: 'Obnova hesla · KlientHunter', sk: 'Obnova hesla · KlientHunter', en: 'Password reset · KlientHunter' },
  body: {
    cs: (url: string) => `Dobrý den,\n\nněkdo (nejspíš vy) požádal o obnovu hesla k účtu v KlientHunteru. Nové heslo si nastavíte na tomto odkazu, platí ${RESET_TTL_MIN} minut:\n\n${url}\n\nPokud jste o obnovu nežádali, tento e-mail ignorujte — heslo zůstává beze změny.\n\nKlientHunter`,
    sk: (url: string) => `Dobrý deň,\n\nniekto (najskôr vy) požiadal o obnovu hesla k účtu v KlientHunteri. Nové heslo si nastavíte na tomto odkaze, platí ${RESET_TTL_MIN} minút:\n\n${url}\n\nAk ste o obnovu nežiadali, tento e-mail ignorujte — heslo zostáva bez zmeny.\n\nKlientHunter`,
    en: (url: string) => `Hello,\n\nsomeone (probably you) asked to reset the password for your KlientHunter account. Set a new password at this link; it is valid for ${RESET_TTL_MIN} minutes:\n\n${url}\n\nIf you did not ask for this, ignore this e-mail — your password stays as it is.\n\nKlientHunter`,
  },
};

/**
 * Žádost o obnovu hesla. Odpověď je vždy stejná (200), ať účet existuje nebo ne — jinak by
 * formulář prozrazoval, kdo má u nás účet. Token jde do e-mailu, v databázi je jen jeho otisk.
 */
export async function POST(req: NextRequest) {
  try {
    const { email, locale } = Body.parse(await req.json());
    const ipHash = hashIp(req);
    if (await countHits(ipHash, 'forgot') >= FORGOT_PER_IP) {
      return NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 });
    }
    await recordHit(ipHash, 'forgot');

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() }, select: { id: true, email: true } });
    if (user) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await prisma.passwordReset.create({
        data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60 * 1000) },
      });
      const base = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      const url = `${base}/${locale}/auth/reset?token=${token}`;
      const result = await sendMail({ to: user.email, subject: T.subject[locale], text: T.body[locale](url) });
      if (result !== 'sent') console.warn('forgot: mail', result, 'for', user.id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'Invalid e-mail', code: 'INVALID' }, { status: 422 });
    console.error('/api/auth/forgot:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
