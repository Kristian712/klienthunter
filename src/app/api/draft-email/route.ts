import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveStatus } from '@/lib/website-status';

/**
 * Writes the e-mail; it never sends it.
 *
 * § 7 zákona 480/2004 Sb. treats unsolicited commercial mail as an offence with a ceiling of
 * 10 000 000 Kč, and ÚOOÚ has repeatedly held that a published `info@` address is no more
 * fair game than a personal one. There is no consent to rely on here, so the app hands the
 * draft to the user and lets them decide, from their own mailbox, whether to send it.
 */
const Schema = z.object({ businessResultId: z.string().min(1) });

function generateEmailText(name: string, senderName: string, hasWebsite: boolean): string {
  if (!hasWebsite) {
    return `Dobrý den, ${name} 👋

Jsem ${senderName} a dělám weby na míru – moderní, rychlé a dobře vypadající na mobilu i počítači.

Zaujalo mě, že zatím web nemáte. Přitom dnes může být web jeden z nejlepších způsobů jak získat nové zákazníky. Rád vám zdarma ukážu, jak by mohl vypadat – bez jakýchkoliv závazků.

A pokud web teď nepotřebujete, ale napadne vás někdo komu by se hodil – budu za doporučení moc vděčný 🙏

S pozdravem
${senderName} · https://webovkyvanek.cz/`;
  }
  return `Dobrý den, ${name} 👋

Jsem ${senderName} a specializuji se na moderní weby.

Narazil jsem na váš web a napadlo mě, že by si mohl zasloužit osvěžení – rychlejší načítání, aktuální design a správné zobrazení na mobilu. Rád vám zdarma ukážu jak by mohl nový vypadat. Žádný závazek.

Pokud zájem nebude, třeba znáte někoho pro koho by nový web byl přínos 🙏

S pozdravem
${senderName} · https://webovkyvanek.cz/`;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId } = verifyToken(token);

    const { businessResultId } = Schema.parse(await req.json());

    const [user, business] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      prisma.businessResult.findUnique({
        where: { id: businessResultId },
        select: { name: true, email: true, hasWebsite: true, websiteStatus: true },
      }),
    ]);

    if (!business) return NextResponse.json({ error: 'Firma nenalezena.' }, { status: 404 });

    // Both templates make a claim about the firm's website. Writing one on a guess is how you
    // tell a company with a site that it has none, so an unverified firm gets no draft at all.
    const status = resolveStatus(business);
    if (status === 'UNKNOWN') {
      return NextResponse.json(
        { error: 'Web firmy není ověřený – text by mohl tvrdit nesmysl.' },
        { status: 400 },
      );
    }

    const senderName = user?.name || 'Kristián';
    const hasWebsite = status === 'HAS';

    return NextResponse.json({
      to: business.email ?? '',
      subject: hasWebsite
        ? 'Váš web by si zasloužil osvěžení – ukázka zdarma'
        : `Web pro ${business.name} – ukázka zdarma`,
      body: generateEmailText(business.name, senderName, hasWebsite),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    return NextResponse.json({ error: 'Koncept se nepodařilo připravit.' }, { status: 500 });
  }
}
