import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { appUrl, stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const PortalSchema = z.object({
  locale: z.enum(['cs', 'sk', 'en']),
});

/**
 * Otevře zákaznický portál Stripe: změna tarifu, zrušení, výměna karty, faktury.
 *
 * Nic z toho neděláme sami — každou změnu ohlásí Stripe webhookem a teprve ten přepíše
 * `plan`. Route jen vrátí adresu portálu. Portál musí být v dashboardu Stripe zapnutý
 * (Settings → Billing → Customer portal), jinak Stripe vrátí chybu.
 */
export async function POST(req: NextRequest) {
  try {
    const session = sessionFrom(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Prázdné nebo nevalidní tělo je chyba volajícího (400), ne pád serveru (500).
    const { locale } = PortalSchema.parse(await req.json().catch(() => ({})));

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer for this account', code: 'NO_CUSTOMER' }, { status: 404 });
    }

    const portal = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl(req.nextUrl.origin)}/${locale}/pricing`,
      locale,
    });
    return NextResponse.json({ url: portal.url });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    // Zákazník ze starého Stripe účtu (viz checkout) — předplatné tu není, portál nemá co ukázat.
    if ((err as { code?: string })?.code === 'resource_missing') {
      return NextResponse.json({ error: 'No customer', code: 'NO_CUSTOMER' }, { status: 404 });
    }
    console.error('/api/stripe/portal:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
