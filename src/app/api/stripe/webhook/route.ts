import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { planForPrice, stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * Jediné místo, které smí měnit `plan` podle platby.
 *
 * Stripe sem posílá, co se s předplatným stalo — zaplaceno, běží zkušební období, změněno,
 * zrušeno, neuhrazeno. Prohlížeč do toho nemluví: kdyby se tarif nastavoval podle návratu ze
 * Checkoutu, stačilo by otevřít `?checkout=success` ručně. Tady se každá zpráva ověří podpisem
 * a teprve pak se čte.
 *
 * **Tělo požadavku se čte syrové** (`req.text()`). Podpis je počítaný z bajtů, jak je Stripe
 * poslal; `req.json()` by je přeparsovalo a ověření by selhalo pokaždé.
 *
 * **Idempotence** stojí na dvou nezávislých věcech. Zaprvé se každá událost zapíše do
 * `StripeEvent` dřív, než se zpracuje — druhé doručení té samé neprojde přes primární klíč
 * a skončí hned. Zadruhé se stav uživatele počítá vždycky celý z předplatného a zapisuje se
 * absolutně, nikdy rozdílově, takže i kdyby se událost přece jen zpracovala dvakrát, výsledek
 * je stejný. Jedno hlídá počet, druhé následky.
 *
 * V logu je typ události a výsledek, nikdy celé tělo — jsou v něm osobní údaje zákazníka.
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

  /**
   * Zabrání události, kterou už jsme viděli.
   *
   * Zapisuje se před zpracováním, ne po něm: kdyby se čekalo na konec, dvě souběžná doručení
   * (Stripe umí i to) by proběhla obě. Unikátní klíč je jediné, co tady spolehlivě rozhodne.
   */
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    console.log(`stripe webhook ${event.type}: už zpracováno, přeskočeno`);
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        // Jen předplatné. Jednorázové platby tahle aplikace nemá; kdyby přišly, nemají co měnit.
        if (session.mode !== 'subscription' || !session.subscription) break;
        /**
         * `payment_status` se hlídá schválně, ale `no_payment_required` je plnohodnotné ano:
         * přesně to vrací session se zkušebním obdobím, kde se první den nic nestrhává.
         * Bez téhle větve by uživatel s trialem zaplatil nulu a nedostal nic.
         */
        if (session.payment_status === 'unpaid') break;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        await apply(subscription, event.type);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        // Pokrývá i konec zkušebního období, změnu ceny a přechod do `past_due`.
        await apply(event.data.object, event.type);
        break;
      case 'invoice.payment_failed': {
        /**
         * Stripe u neúspěšné platby stav předplatného stejně přepne a pošle
         * `customer.subscription.updated`. Tahle větev je pojistka pro případ, že by se ta
         * druhá událost ztratila: uživateli se musí ukázat, že mu neprošla karta, jinak se to
         * dozví až ve chvíli, kdy mu předplatné spadne.
         */
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
        const subscriptionRef = invoice.subscription;
        if (!subscriptionRef) break;
        const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef.id;
        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        await apply(subscription, event.type);
        break;
      }
      default:
        // Ostatní události nás nezajímají. 200, aby je Stripe neposílal znovu.
        console.log(`stripe webhook ${event.type}: ignorováno`);
        break;
    }
  } catch (err) {
    /**
     * 500 schválně: Stripe událost zopakuje, a přesně to chceme — výpadek databáze nesmí
     * znamenat zákazníka, který zaplatil a tarif nedostal. Záznam v `StripeEvent` se přitom
     * musí smazat, jinak by opakované doručení skončilo na „už zpracováno" a chyba by se
     * tím zabetonovala.
     */
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
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

/** Stavy, které si aplikace pamatuje kvůli uživateli. Cokoli jiného je pro něj `canceled`. */
const SHOWN_STATUSES = new Set<Stripe.Subscription.Status>(['trialing', 'active', 'past_due']);

/** Zapíše do databáze stav odpovídající tomuhle předplatnému. Absolutně, ne rozdílově. */
async function apply(subscription: Stripe.Subscription, eventType: string): Promise<void> {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  // Uživatel podle zákazníka ve Stripe; záložně podle metadat, která Checkout na předplatné psal.
  const user =
    (await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true, stripeSubscriptionId: true } })) ??
    (subscription.metadata?.userId
      ? await prisma.user.findUnique({ where: { id: subscription.metadata.userId }, select: { id: true, stripeSubscriptionId: true } })
      : null);
  if (!user) {
    /**
     * Zaplaceno a není komu to přiřadit.
     *
     * Nezakládat účet: e-mail z platby nemusí patřit nikomu z aplikace a tichý nový účet by
     * znamenal, že peníze někam odešly a nikdo se to nedozví. Řádek v `UnmatchedPayment` je
     * fronta k ručnímu spárování — na rozdíl od řádky v logu se neztratí.
     */
    await prisma.unmatchedPayment
      .create({
        data: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          email: subscription.metadata?.email ?? null,
          note: `událost ${eventType}, stav ${subscription.status}`,
        },
      })
      .catch(() => undefined);
    console.warn(`stripe webhook ${eventType}: zákazník ${customerId} nemá uživatele — zapsáno k ručnímu spárování`);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000) : null;
  const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
  const status = SHOWN_STATUSES.has(subscription.status) ? subscription.status : 'canceled';

  if (subscription.status === 'past_due') {
    // TODO(e-maily): až bude odesílání pošty, poslat tady upozornění „platba neprošla,
    // zkontrolujte kartu". Teď se jen nechává tarif běžet, dokud Stripe nevzdá (`unpaid`),
    // a uživatel varování vidí v aplikaci.
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
        subscriptionStatus: status,
        trialEndsAt: trialEnd,
      },
    });
    console.log(`stripe webhook ${eventType}: uživatel ${user.id} → ${plan} (${status})`);
    return;
  }

  /**
   * Konec předplatného — zrušené, neuhrazené, nedokončené.
   *
   * Downgrade platí jen pro to předplatné, které u uživatele evidujeme. Když si zákazník
   * v portálu pořídil nové a Stripe teprve teď doručí zrušení toho starého, nesmí mu to
   * shodit tarif, který právě platí. Účet ani data se nemažou, jen padá přístup k placenému.
   */
  if (user.stripeSubscriptionId && user.stripeSubscriptionId !== subscription.id) {
    console.log(`stripe webhook ${eventType}: staré předplatné ${subscription.id}, tarif zůstává`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      stripePriceId: null,
      currentPeriodEnd: null,
      subscriptionStatus: 'canceled',
      trialEndsAt: null,
    },
  });
  console.log(`stripe webhook ${eventType}: uživatel ${user.id} → FREE (${subscription.status})`);
}
