import Stripe from 'stripe';
import type { Plan } from '@prisma/client';

/**
 * Jediné místo, kde aplikace mluví se Stripe.
 *
 * Klíč i ID cen jdou výhradně z prostředí. V kódu není jediné ID natvrdo: testovací a ostrý
 * účet mají jiné ceny a přepínat se má proměnnými, ne editací souboru. Když něco chybí, spadne
 * to hned při prvním použití se srozumitelnou větou — ne uprostřed platby s „undefined".
 *
 * Verze API je připnutá schválně. Bez ní by SDK bralo výchozí verzi účtu a odpověď Stripe by
 * se mohla změnit tím, že někdo klikne v dashboardu na „upgrade".
 *
 * DPH: Stripe sám daň nepočítá. Provozovatel dnes není plátce DPH a prodává v ČR, takže se
 * nic neúčtuje navíc. Až přijde prodej do zahraničí nebo registrace k DPH, patří sem Stripe Tax
 * (`automatic_tax` v Checkout Session) — a to funguje až po zaregistrování v dashboardu,
 * jinak Stripe tiše nevybere nic. Nezapomenout.
 */

export const STRIPE_API_VERSION = '2026-08-26.dahlia' as const;

let client: Stripe | undefined;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} není nastavená. Platby bez ní nefungují — doplň proměnnou v prostředí.`);
  }
  return value;
}

/** Klient se tvoří líně: build ani stránky, které se Stripe netýkají, klíč nepotřebují. */
export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(required('STRIPE_SECRET_KEY'), {
      apiVersion: STRIPE_API_VERSION,
      appInfo: { name: 'KlientHunter', url: 'https://klienthunter.vercel.app' },
    });
  }
  return client;
}

/**
 * Zkušební období u obou placených tarifů, ve dnech.
 *
 * Stripe ho z ceny v dashboardu do Checkoutu nepřevezme — jde jen parametrem při zakládání
 * session, proto žije tady. Karta se zadává hned, strhává se až po skončení zkušební doby.
 */
export const TRIAL_DAYS = 7;

/**
 * Kolik dní zkušebního období dostane uživatel, který právě kupuje. `undefined` = žádné.
 *
 * Jen poprvé. `subscriptionStatus` je `none` jedině u účtu, který předplatné nikdy neměl —
 * po zrušení zůstane `canceled`. Bez téhle podmínky by stačilo každý týden zrušit a koupit
 * znovu a PRO by bylo navždy zadarmo.
 */
export function trialDaysFor(subscriptionStatus: string | null | undefined): number | undefined {
  return !subscriptionStatus || subscriptionStatus === 'none' ? TRIAL_DAYS : undefined;
}

/** Tarify, které se dají koupit. FREE nemá cenu, takže tu schválně chybí. */
export type PaidPlan = Extract<Plan, 'PRO' | 'BUSINESS'>;

export const PAID_PLANS: PaidPlan[] = ['PRO', 'BUSINESS'];

/** ID ceny ve Stripe pro daný tarif. */
export function priceIdFor(plan: PaidPlan): string {
  return required(plan === 'PRO' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_BUSINESS');
}

/**
 * Tarif podle ID ceny. Opačný směr než `priceIdFor` — používá ho webhook, který ze Stripe
 * dostane cenu a musí z ní udělat `plan`. Neznámá cena vrací `null`, ne FREE: neznámou cenu
 * nesmíme tiše vyložit jako „nic nekoupil".
 */
export function planForPrice(priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  for (const plan of PAID_PLANS) {
    if (process.env[plan === 'PRO' ? 'STRIPE_PRICE_PRO' : 'STRIPE_PRICE_BUSINESS'] === priceId) return plan;
  }
  return null;
}

/**
 * Základ pro návratové adresy Checkoutu a portálu.
 *
 * Přednost má `NEXT_PUBLIC_APP_URL`, protože za proxy nebo v náhledu Vercelu bývá origin
 * požadavku něco jiného, než kam má zákazník po platbě přistát. Bez proměnné se vezme origin.
 */
export function appUrl(requestOrigin: string): string {
  return (process.env.NEXT_PUBLIC_APP_URL || requestOrigin).replace(/\/$/, '');
}
