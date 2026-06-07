import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import axios from 'axios';

const Schema = z.object({ businessResultId: z.string().min(1) });

function generateEmailText(name: string, hasWebsite: boolean, websiteIsOld: boolean): string {
  if (!hasWebsite) {
    return `Dobrý den, ${name} 👋

Jsem Kristián, je mi 17 let a dělám weby na míru – moderní, rychlé a dobře vypadající na mobilu i počítači.

Zaujalo mě, že zatím web nemáte. Přitom dnes může být web jeden z nejlepších způsobů jak získat nové zákazníky. Rád vám zdarma ukážu, jak by mohl vypadat – bez jakýchkoliv závazků.

A pokud web teď nepotřebujete, ale napadne vás někdo komu by se hodil – budu za doporučení moc vděčný 🙏

S pozdravem
Kristián · https://webovkyvanek.cz/`;
  }
  return `Dobrý den, ${name} 👋

Jsem Kristián, je mi 17 let a specializuji se na moderní weby.

Narazil jsem na váš web a napadlo mě, že by si mohl zasloužit osvěžení – rychlejší načítání, aktuální design a správné zobrazení na mobilu. Rád vám zdarma ukážu jak by mohl nový vypadat. Žádný závazek.

Pokud zájem nebude, třeba znáte někoho pro koho by nový web byl přínos 🙏

S pozdravem
Kristián · https://webovkyvanek.cz/`;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { userId } = verifyToken(token);

    const { businessResultId } = Schema.parse(await req.json());

    const [user, business] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { brevoApiKey: true, brevoSenderEmail: true, name: true } }),
      prisma.businessResult.findUnique({ where: { id: businessResultId }, select: { name: true, email: true, hasWebsite: true, websiteIsOld: true } }),
    ]);

    if (!user?.brevoApiKey || !user?.brevoSenderEmail) {
      return NextResponse.json({ error: 'Brevo není nastaveno. Nastav API klíč v Profilu.' }, { status: 400 });
    }
    if (!business?.email) {
      return NextResponse.json({ error: 'Firma nemá email.' }, { status: 400 });
    }

    const senderName = user.name || 'Kristián';
    const textContent = generateEmailText(business.name, business.hasWebsite, business.websiteIsOld);
    const subject = business.hasWebsite
      ? `Váš web by si zasloužil osvěžení – ukázka zdarma`
      : `Web pro ${business.name} – ukázka zdarma`;

    await axios.post('https://api.brevo.com/v3/smtp/email', {
      sender: { name: senderName, email: user.brevoSenderEmail },
      to: [{ email: business.email, name: business.name }],
      subject,
      textContent,
    }, {
      headers: { 'api-key': user.brevoApiKey, 'Content-Type': 'application/json' },
      timeout: 10_000,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } }; message?: string };
    const msg = e?.response?.data?.message ?? e?.message ?? 'Chyba při odesílání.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
