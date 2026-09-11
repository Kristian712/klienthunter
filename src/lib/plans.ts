/**
 * Co který tarif dovolí.
 *
 * Bydlí ve vlastním souboru, protože to čte i ceník v prohlížeči. `auth.ts` sem nesmí — nese
 * JWT tajemství a při načtení bez něj spadne, což je v klientském bundlu jistota. Tohle je
 * jediné místo, kde limity jsou; ceník z něj bere čísla, aby nemohl slibovat něco jiného,
 * než co API vynucuje.
 */
export const PLAN_LIMITS = {
  FREE:     { searches: 5,        resultsPerSearch: 20 },
  PRO:      { searches: 100,      resultsPerSearch: 200 },
  BUSINESS: { searches: Infinity, resultsPerSearch: 500 },
  VIP:      { searches: Infinity, resultsPerSearch: 500 },
} as const;

export function getPlanLimits(plan: string, isVip: boolean, isAdmin: boolean = false) {
  if (isAdmin || isVip) return PLAN_LIMITS.VIP; // admins + VIP = unlimited
  return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.FREE;
}

/**
 * Zkušební období u obou placených tarifů, ve dnech.
 *
 * Stripe ho z ceny v dashboardu do Checkoutu nepřevezme — jde jen parametrem při zakládání
 * session (`/api/stripe/checkout`). Karta se zadává hned, strhává se až po skončení zkušební doby.
 * Ceník z téhož čísla píše „7 dní zdarma", takže se nabídka a skutečnost nemůžou rozejít.
 */
export const TRIAL_DAYS = 7;

/**
 * Kolik dní zkušebního období dostane uživatel, který právě kupuje. `undefined` = žádné.
 *
 * Jen poprvé. `subscriptionStatus` je `none` jedině u účtu, který předplatné nikdy neměl —
 * po zrušení zůstane `canceled`. Bez téhle podmínky by stačilo každý týden zrušit a koupit
 * znovu a PRO by bylo navždy zadarmo. Stejné pravidlo rozhoduje na ceníku, jestli se trial
 * vůbec nabídne: nabídnout ho někomu, komu ho Checkout pak nedá, by byla klamavá nabídka.
 */
export function trialDaysFor(subscriptionStatus: string | null | undefined): number | undefined {
  return !subscriptionStatus || subscriptionStatus === 'none' ? TRIAL_DAYS : undefined;
}
