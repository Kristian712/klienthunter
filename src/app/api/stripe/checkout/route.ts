import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { appUrl, priceIdFor, stripe, trialDaysFor } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const CheckoutSchema = z.object({
  plan: z.enum(['PRO', 'BUSINESS']),
  locale: z.enum(['cs', 'sk', 'en']),
});

/**
 * Založí Stripe Checkout pro předplatné a vrátí adresu, kam prohlížeč přesměrovat.
 *
 * Co tahle route **nedělá**: nemění `plan`. Tarif nastaví až webhook, když Stripe potvrdí
 * platbu — prohlížeč o výsledku platby nerozhoduje a nic, co odsud odejde, se do databáze
 * jako tarif nezapisuje. Jediné, co se tu ukládá, je ID zákazníka, aby další nákup nebo portál
 * navazovaly na stejný účet ve Stripe.
 */
export async function POST(req: NextRequest) {
  try {
    const session = sessionFrom(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan, locale } = CheckoutSchema.parse(await req.json());

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true, email: true, name: true, plan: true,
        stripeCustomerId: true, stripeSubscriptionId: true, subscriptionStatus: true,
      },
    });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    /**
     * Kdo už předplatné má, mění ho v portálu, ne druhým Checkoutem. Dva běžící subscriptions
     * na jednom zákazníkovi jsou dvě faktury měsíčně — a webhook by je střídavě přepisoval.
     */
    if (user.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Subscription already active — manage it in the billing portal', code: 'HAS_SUBSCRIPTION' },
        { status: 409 },
      );
    }

    const api = stripe();
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await api.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
    }

    const base = appUrl(req.nextUrl.origin);
    const checkout = await api.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // Bez `payment_method_types`: které způsoby platby se nabídnou, se řídí v dashboardu.
      line_items: [{ price: priceIdFor(plan), quantity: 1 }],
      client_reference_id: user.id,
      metadata: { userId: user.id, plan },
      subscription_data: {
        metadata: { userId: user.id, plan },
        // Zkušební období jen napoprvé (viz `trialDaysFor`). Checkout ho zákazníkovi ukáže sám:
        // „7 dní zdarma, pak 499 Kč měsíčně" — i s tím, kdy se karta poprvé strhne.
        trial_period_days: trialDaysFor(user.subscriptionStatus),
      },
      locale,
      allow_promotion_codes: true,
      // Adresy nesou jazyk, ve kterém uživatel klikl — jinak by po platbě přistál v češtině.
      success_url: `${base}/${locale}/pricing?checkout=success`,
      cancel_url: `${base}/${locale}/pricing?checkout=cancel`,
      // Štítek pro dashboard Stripe, aby šly tyhle sessions odlišit od případných budoucích toků.
      integration_identifier: 'klienthunter-subscription-qkzwvrmt',
    });

    if (!checkout.url) {
      return NextResponse.json({ error: 'Stripe returned no checkout URL' }, { status: 502 });
    }
    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    console.error('/api/stripe/checkout:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
