import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { activeAccount, sessionFrom } from '@/lib/auth';
import { PAID_PLANS, stripe, type PaidPlan } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/** Události, které webhook opravdu zpracovává (src/app/api/stripe/webhook/route.ts). */
const EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
];

function webhookUrl(req: NextRequest): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return `${base.replace(/\/$/, '')}/api/stripe/webhook`;
}

async function admin(req: NextRequest) {
  const payload = sessionFrom(req);
  if (!payload) return null;
  const me = await activeAccount(payload.userId);
  return me?.isAdmin ? payload : null;
}

/**
 * Kontrola Stripe z adminu: režim klíče, ceny tarifů, webhook. Bez tohohle se „zaplatil a tarif
 * se nepřepnul" zjišťuje až od zákazníka. Žádný klíč ani secret neopouští server — jen stavy.
 */
export async function GET(req: NextRequest) {
  try {
    if (!(await admin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const key = process.env.STRIPE_SECRET_KEY ?? '';
    const mode = key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'live' : key ? 'test' : null;
    if (!mode) return NextResponse.json({ mode, prices: [], webhook: null, webhookSecretSet: false, url: webhookUrl(req) });

    const s = stripe();
    const prices = await Promise.all(PAID_PLANS.map(async (plan: PaidPlan) => {
      const id = process.env[plan === 'PRO' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_BUSINESS'];
      if (!id) return { plan, ok: false, note: 'proměnná chybí' };
      try {
        const p = await s.prices.retrieve(id);
        return { plan, ok: p.active && p.type === 'recurring', amount: (p.unit_amount ?? 0) / 100, currency: p.currency, interval: p.recurring?.interval, active: p.active };
      } catch (err) {
        return { plan, ok: false, note: err instanceof Error ? err.message : 'cena nenalezena' };
      }
    }));

    const url = webhookUrl(req);
    const list = await s.webhookEndpoints.list({ limit: 100 });
    const hit = list.data.find(w => w.url === url);
    const missing = hit ? EVENTS.filter(e => !hit.enabled_events.includes('*') && !hit.enabled_events.includes(e)) : EVENTS;
    return NextResponse.json({
      mode, prices, url,
      webhookSecretSet: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      webhook: hit ? { id: hit.id, status: hit.status, events: hit.enabled_events, missing, apiVersion: hit.api_version } : null,
      others: list.data.filter(w => w.url !== url).map(w => ({ url: w.url, status: w.status })),
    });
  } catch (err) {
    console.error('/api/admin/stripe:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}

/**
 * Založí webhook endpoint pro tuhle aplikaci (nebo doplní chybějící události u existujícího).
 * Podepisovací secret Stripe ukáže jen při založení — vrátí se jednou adminovi, aby ho vložil
 * do Vercelu jako STRIPE_WEBHOOK_SECRET. Nikam se neukládá.
 */
export async function POST(req: NextRequest) {
  try {
    if (!(await admin(req))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const s = stripe();
    const url = webhookUrl(req);
    const list = await s.webhookEndpoints.list({ limit: 100 });
    const hit = list.data.find(w => w.url === url);
    if (hit) {
      const events = Array.from(new Set([...hit.enabled_events, ...EVENTS])) as Stripe.WebhookEndpointUpdateParams.EnabledEvent[];
      const updated = await s.webhookEndpoints.update(hit.id, { enabled_events: hit.enabled_events.includes('*') ? undefined : events, disabled: false });
      return NextResponse.json({ created: false, id: updated.id, status: updated.status, events: updated.enabled_events, secret: null });
    }
    const created = await s.webhookEndpoints.create({ url, enabled_events: EVENTS, description: 'KlientHunter — tarify podle předplatného' });
    console.info(`admin/stripe: webhook ${created.id} založen pro ${url}`);
    return NextResponse.json({ created: true, id: created.id, status: created.status, events: created.enabled_events, secret: created.secret ?? null });
  } catch (err) {
    console.error('/api/admin/stripe POST:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 });
  }
}
