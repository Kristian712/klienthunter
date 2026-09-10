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
