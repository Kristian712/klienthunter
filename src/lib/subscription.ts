/**
 * Stav předplatného tak, jak ho potřebuje aplikace — ne jak ho posílá Stripe.
 *
 * Přístup k placeným funkcím řídí `plan` (viz `plans.ts` a `/api/search`), protože ten umí
 * i případy, které se Stripe netýkají: admin, VIP, tarif nastavený ručně. Tenhle soubor řeší
 * druhou otázku — co má uživatel vidět: kolik dní zbývá ze zkušebního období a jestli mu
 * neprošla karta. Držet obojí v jednom poli by znamenalo, že se jednou splete.
 */

export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';

export interface SubscriptionView {
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | string | null;
  trialEndsAt?: Date | string | null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Má uživatel právě teď zaplaceno u Stripe?
 *
 * Odpovídá na otázku o **předplatném**, ne o přístupu do aplikace. Kdo má tarif od admina
 * nebo je VIP, tady vyjde `false` a přesto všechno funguje — tak to má být, protože žádné
 * předplatné nemá. Na přístup je `getPlanLimits`.
 *
 * `past_due` je tu záměrně `true`: Stripe ještě zkouší kartu strhnout a služba mezitím běží.
 */
export function hasActiveSubscription(user: SubscriptionView): boolean {
  const status = user.subscriptionStatus as SubscriptionStatus | undefined;
  if (status !== 'active' && status !== 'trialing' && status !== 'past_due') return false;

  // Zaplacené období musí ještě běžet. Kdyby webhook o konci nedorazil, tohle je záchranná brzda.
  const end = toDate(user.currentPeriodEnd);
  return end === null || end.getTime() > Date.now();
}

/** Kolik celých dní zbývá ze zkušebního období. `null`, když žádné neběží. */
export function trialDaysLeft(user: SubscriptionView): number | null {
  if (user.subscriptionStatus !== 'trialing') return null;
  const end = toDate(user.trialEndsAt);
  if (!end) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  return days > 0 ? days : 0;
}

/** Neprošla platba a Stripe to ještě zkouší. Uživatel o tom má vědět dřív, než mu tarif spadne. */
export function paymentFailing(user: SubscriptionView): boolean {
  return user.subscriptionStatus === 'past_due';
}
