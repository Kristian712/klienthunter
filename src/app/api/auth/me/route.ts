import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * Odpověď závisí na cookie, takže se nesmí předpočítat při buildu.
 *
 * Next 14 pozná dynamickou trasu podle `cookies()`/`headers()` z `next/headers`, ale čtení
 * `req.cookies` na `NextRequest` mu jako signál nestačí — GET handler pak skončí jako statický
 * a Vercel ho servíruje z prerenderu (`x-vercel-cache: PRERENDER`). Odpověď zamrzlá z buildu je
 * `{ user: null }`, takže i přihlášený uživatel vypadá jako odhlášený a přijde o funkce svého
 * tarifu. Tohle je jediná API trasa, které se to stalo — ostatní jsou POST nebo mají parametr.
 */
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('auth-token')?.value;
    if (!token) return NextResponse.json({ user: null });
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true, email: true, name: true, plan: true, isAdmin: true, isVip: true,
        stripeSubscriptionId: true, currentPeriodEnd: true,
        subscriptionStatus: true, trialEndsAt: true,
      },
    });
    if (!user) return NextResponse.json({ user: null });
    // Ceník potřebuje vědět, jestli má uživatel co spravovat v portálu. Stačí ano/ne —
    // Stripe ID do prohlížeče nepatří, nemá tam co dělat.
    const { stripeSubscriptionId, ...rest } = user;
    return NextResponse.json({ user: { ...rest, hasSubscription: Boolean(stripeSubscriptionId) } });
  } catch {
    return NextResponse.json({ user: null });
  }
}
