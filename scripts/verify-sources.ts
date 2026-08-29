/**
 * Měří, co nové zdroje Vlny 2 opravdu dávají — kolik leadů, kolik kontaktů a za jak dlouho.
 *
 * Nesmí sahat na databázi (proto volá `src/lib/sources` a `lead-pipeline` přímo) a nesmí
 * odhadovat: každé číslo je z živého dotazu na ARES, Overpass, ARES-RŽP a ADIS.
 *
 * Spuštění:  npx tsx scripts/verify-sources.ts
 */

import { discoverAll } from '../src/lib/sources';
import { enrichAndVerify, mergeLeads } from '../src/lib/lead-pipeline';

/** Stejný limit, jaký má funkce na Vercelu. Co se do něj nevejde, je chyba, ne pomalý den. */
const FUNCTION_LIMIT_MS = 60_000;
const NETWORK_BUDGET_MS = 45_000;
const LIMIT = 60;

/**
 * Obory se zadávají anglickými klíči z `NICHE_MAP` — přesně tak, jak je posílá formulář
 * v `search/page.tsx`. Český název by spadl do záložní větve `resolveNiche` (hledání podle
 * názvu, žádné OSM), takže by skript měřil něco jiného než appka.
 */
const CASES: Array<{ niche: string; city: string }> = [
  { niche: 'hair salon', city: 'Brno' },
  { niche: 'restaurant', city: 'Olomouc' },
  { niche: 'car repair', city: 'Plzeň' },
];

function pct(part: number, total: number): string {
  return total === 0 ? '—' : `${Math.round((part / total) * 100)} %`;
}

async function runCase(niche: string, city: string) {
  const started = Date.now();

  const [aresLeads, osmLeads] = await discoverAll(niche, city, LIMIT);
  const discovered = Date.now() - started;

  const candidates = mergeLeads([osmLeads, aresLeads], LIMIT);
  const verified = await enrichAndVerify(candidates, {
    probeNetwork: true,
    deadlineAt: started + NETWORK_BUDGET_MS,
  });

  const total = verified.length;
  const withPhone = verified.filter(v => v.c.phone).length;
  const withEmail = verified.filter(v => v.c.email).length;
  const withIco = verified.filter(v => v.c.ico).length;
  const withVat = verified.filter(v => v.c.vatPayer !== undefined).length;

  const status = { HAS: 0, NONE: 0, UNKNOWN: 0 };
  for (const v of verified) status[v.verdict.status]++;

  // Vlna 3: pokrytí datem vzniku. Když spadne, změnil ARES tvar odpovědi.
  //
  // Medián načtení webu a počet pomalých webů odsud zmizel spolu s filtrem „Pomalý web":
  // rychlost stránky není signál, který by aplikace k něčemu potřebovala, a měřit ji jen kvůli
  // řádku ve výpisu by znamenalo držet celou cestu tou hodnotou přes databázi až do UI.
  const withFounded = verified.filter(v => v.c.foundedAt).length;

  const elapsed = Date.now() - started;

  console.log(`\n── ${niche} · ${city} ${'─'.repeat(Math.max(0, 40 - niche.length - city.length))}`);
  console.log(`ARES ${aresLeads.length} + OSM ${osmLeads.length} → po sloučení ${candidates.length}`);
  console.log(`discovery ${(discovered / 1000).toFixed(1)} s · celkem ${(elapsed / 1000).toFixed(1)} s`
    + (elapsed > FUNCTION_LIMIT_MS ? '  ⚠️  PŘES 60 s LIMIT' : ''));
  console.log(`telefon ${withPhone} (${pct(withPhone, total)}) · e-mail ${withEmail} (${pct(withEmail, total)})`);
  console.log(`IČO ${withIco} (${pct(withIco, total)}) · DPH zjištěno ${withVat} (${pct(withVat, total)})`);
  console.log(`web: HAS ${status.HAS} · NONE ${status.NONE} · UNKNOWN ${status.UNKNOWN}`);
  console.log(`datum vzniku ${withFounded} (${pct(withFounded, total)})`);

  return { elapsed, total, withPhone, withEmail, status };
}

async function main() {
  console.log('Ověřuji zdroje Vlny 2 (ARES, OSM, ARES-RŽP, ADIS DPH) na živých endpointech…');

  let slowest = 0;
  let leads = 0;
  let contacts = 0;

  for (const c of CASES) {
    const r = await runCase(c.niche, c.city);
    slowest = Math.max(slowest, r.elapsed);
    leads += r.total;
    contacts += r.withPhone + r.withEmail;
  }

  console.log(`\n═══ Souhrn ═══`);
  console.log(`${leads} leadů celkem, ${contacts} kontaktních údajů`);
  console.log(`nejpomalejší běh: ${(slowest / 1000).toFixed(1)} s z ${FUNCTION_LIMIT_MS / 1000} s limitu`);
  if (slowest > FUNCTION_LIMIT_MS) {
    console.error('CHYBA: hledání se nevejde do limitu funkce.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
