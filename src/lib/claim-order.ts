/**
 * Řazení výsledků s ohledem na nároky — část bez databáze, sdílená serverem i prohlížečem.
 *
 * Cíl: dva platící uživatelé se stejným profilem a krajem nemají dostat tytéž firmy na prvních
 * pozicích. Ne že je nesmí dostat vůbec — firma s cizím nárokem jde ve skóre dolů, ne pryč.
 * Databázová část (dotaz na nároky, sůl) je v `claims.ts`; sem patří jen čistá aritmetika.
 */

/**
 * Jak dlouho cizí nárok platí. Třicet dní je délka jednoho obchodního cyklu u malé firmy: kdo
 * ji oslovil a do měsíce nic neuzavřel, nejspíš už neuzavře, a další zájemce má mít volno.
 * Odhad majitele (13. 9. 2026), ne změřená hodnota.
 */
export const CLAIM_TTL_DAYS = 30;

/**
 * O kolik bodů skóre spadne firma s cizím nárokem. Třicet = „o jednu třídu níž": stobodová firma
 * skončí mezi sedmdesátkami, ne pod dvacítkami — je vidět, jen ne první. Odhad, ne pravda;
 * majitel ho bude ladit, až uvidí chování na dvou reálných účtech.
 */
export const CLAIM_PENALTY = 30;

export type ClaimMark = 'mine' | 'other' | null;

/**
 * Klíč firmy napříč hledáními i účty: IČO, jinak OSM id.
 *
 * Známé omezení, které bereme: tatáž firma bez IČO v jednom hledání (řádek z OpenStreetMap,
 * nespárovaný s ARESem) a s IČO v druhém dá dva různé klíče a nárok se mine. Spárování se
 * dělá při hledání (`mergeLeads`), ne tady, a zpětně ho z uložených řádků nedoplníme.
 * Zhruba 29 % řádků v databázi IČO nemá (měřeno 13. 9. 2026).
 */
export function firmKeyOf(row: { ico?: string | null; placeId: string }): string {
  return row.ico?.trim() ? row.ico.trim() : `osm:${row.placeId}`;
}

/** Skóre, podle kterého se řadí: cizí nárok sráží, vlastní ne. */
export function rankedScore(leadScore: number, claim: ClaimMark): number {
  return claim === 'other' ? leadScore - CLAIM_PENALTY : leadScore;
}

/**
 * Deterministické promíchání remíz: FNV-1a z (klíč firmy + sůl uživatele).
 *
 * Sůl posílá server (hash userId), takže pořadí je stabilní pro tentýž účet i po vyprázdnění
 * `localStorage`, a dva účty vidí u stejně bodovaných firem jiné pořadí. Nic náhodného —
 * stejný vstup, stejné číslo, při každém načtení.
 */
export function mixRank(firmKey: string, salt: string): number {
  let h = 0x811c9dc5;
  const s = `${firmKey}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export interface Rankable {
  name: string;
  leadScore: number;
  firmKey?: string;
  claim?: ClaimMark;
}

/** Komparátor pro seznam: skóre po srážce, pak hash, pak název — ať je pořadí úplné a stabilní. */
export function compareRanked(salt: string) {
  return (a: Rankable, b: Rankable): number =>
    rankedScore(b.leadScore, b.claim ?? null) - rankedScore(a.leadScore, a.claim ?? null)
    || (a.firmKey && b.firmKey ? mixRank(a.firmKey, salt) - mixRank(b.firmKey, salt) : 0)
    || a.name.localeCompare(b.name, 'cs');
}
