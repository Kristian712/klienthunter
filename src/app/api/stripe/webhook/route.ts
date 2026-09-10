import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { planForPrice, stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Jediné místo, které smí měnit `plan` podle platby.
 *
 * Stripe sem posílá, co se s předplatným stalo — zaplaceno, změněno, zrušeno, neuhrazeno.
 * Prohlížeč do toho nemluví: kdyby se tarif nastavoval podle návratu ze Checkoutu, stačilo by
 * otevřít `?checkout=success` ručně. Tady se každá zpráva ověří podpisem a teprve pak se čte.
 *
 * **Idempotence.** Stripe tutéž událost klidně pošle dvakrát a pořadí nezaručuje. Handler proto
 * nikdy nic „přičítá" — z předplatného vždycky spočítá celý stav (tarif, ID, konec období)
 * a ten zapíše. Dvě stejné zprávy skončí stejně, a když přijde starší zpráva o jiném,
 * už nahrazeném předplatném, downgrade se neprovede (viz `apply`).
 *
 * **Tělo požadavku se čte syrové** (`req.text()`). Podpis je počítaný z bajtů, jak je Stripe
 * poslal; `req.json()` by je přeparsovalo a ověření by selhalo pokaždé.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('/api/stripe/webhook: STRIPE_WEBHOOK_SECRET není nastavený');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch (err) {
    console.error('/api/stripe/webhook: neplatný podpis:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Jen předplatné. Jednorázové platby tahle aplikace nemá; kdyby přišly, nemají co měnit.
        if (session.mode !== 'subscription' || !session.subscription) break;
        // `payment_status` se hlídá schválně: u odložených způsobů platby (převod) je session
        // hotová dřív, než dorazí peníze. Tarif pak nastaví až `customer.subscription.updated`.
        if (session.payment_status !== 'paid') break;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        await apply(subscription);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await apply(event.data.object);
        break;
      default:
        // Ostatní události nás nezajímají. 200, aby je Stripe neposílal znovu.
        break;
    }
  } catch (err) {
    // 500 schválně: Stripe událost zopakuje, a přesně to chceme — výpadek databáze nesmí
    // znamenat zákazníka, který zaplatil a tarif nedostal.
    console.error(`/api/stripe/webhook ${event.type}:`, err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Stavy, ve kterých má zákazník za co platit — a tedy má tarif.
 *
 * `past_due` je tu schválně: Stripe ještě zkouší kartu strhnout (typicky dva týdny) a vypnout
 * službu kvůli jedné odmítnuté platbě by znamenalo přijít o zákazníka, který jen měnil kartu.
 * Tarif padá až u `unpaid`, kdy Stripe vzdal, a u `canceled`.
 */
const PAID_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due']);

/** Zapíše do databáze stav odpovídající tomuhle předplatnému. Absolutně, ne rozdílově. */
async function apply(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  // Uživatel podle zákazníka ve Stripe; záložně podle metadat, která Checkout na předplatné psal.
  const user =
    (await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true, stripeSubscriptionId: true } })) ??
    (subscription.metadata?.userId
      ? await prisma.user.findUnique({ where: { id: subscription.metadata.userId }, select: { id: true, stripeSubscriptionId: true } })
      : null);
  if (!user) {
    // Neznámý zákazník není chyba handleru — třeba smazaný účet. Zalogovat, nevracet 500.
    console.warn(`/api/stripe/webhook: zákazník ${customerId} nemá uživatele`);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;

  if (subscription.status === 'past_due') {
    // TODO(e-maily): až bude odesílání pošty, poslat tady upozornění „platba neprošla,
    // zkontrolujte kartu". Teď se jen nechává tarif běžet, dokud Stripe nevzdá (`unpaid`).
  }

  if (PAID_STATUSES.has(subscription.status)) {
    const plan = planForPrice(priceId);
    if (!plan) {
      // Cena, kterou aplikace nezná — skoro jistě špatně nastavené STRIPE_PRICE_*. Výjimka
      // vede na 500, Stripe událost zopakuje, a po opravě proměnných projde.
      throw new Error(`neznámá cena ${priceId} u předplatného ${subscription.id}`);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        currentPeriodEnd: periodEnd,
      },
    });
    return;
  }

  /**
   * Konec předplatného — zrušené, neuhrazené, nedokončené.
   *
   * Downgrade platí jen pro to předplatné, které u uživatele evidujeme. Když si zákazník
   * v portálu pořídil nové a Stripe teprve teď doručí zrušení toho starého, nesmí mu to
   * shodit tarif, který právě platí.
   */
  if (user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
    },
  });
}
