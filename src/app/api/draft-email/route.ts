import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { outreachBody, outreachSubject, toSender } from '@/lib/outreach';

/**
 * Writes the e-mail; it never sends it.
 *
 * § 7 zákona 480/2004 Sb. treats unsolicited commercial mail as an offence with a ceiling of
 * 10 000 000 Kč, and ÚOOÚ has repeatedly held that a published `info@` address is no more
 * fair game than a personal one. There is no consent to rely on here, so the app hands the
 * draft to the user and lets them decide, from their own mailbox, whether to send it.
 *
 * The text itself comes from `lib/outreach.ts`, built out of the sender's own profile. This
 * route used to hold two hard-coded templates that both claimed something about the recipient's
 * website — which is why it also used to refuse the job whenever the website check came back
 * UNKNOWN. The new text makes no such claim, so every verified or unverified firm gets a draft.
 */
const Schema = z.object({
  businessResultId: z.string().min(1),
  locale: z.enum(['cs', 'sk', 'en']).default('cs'),
});

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId } = verifyToken(token);

    const { businessResultId, locale } = Schema.parse(await req.json());

    const [user, business] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, profession: true, professionText: true, outreachSignature: true },
      }),
      prisma.businessResult.findUnique({
        where: { id: businessResultId },
        select: { name: true, email: true },
      }),
    ]);

    if (!business) return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });

    const sender = toSender(user ?? {});

    return NextResponse.json({
      to: business.email ?? '',
      subject: outreachSubject(sender, locale),
      body: outreachBody(sender, business.name, locale),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    return NextResponse.json({ error: 'Koncept se nepodařilo připravit.' }, { status: 500 });
  }
}
