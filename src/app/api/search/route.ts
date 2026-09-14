import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sessionFrom } from '@/lib/auth';
import { leadScore } from '@/lib/lead-score';
import { enrichAndVerify, mergeLeads, type VerifiedCandidate } from '@/lib/lead-pipeline';
import {
  ANONYMOUS_RESULTS, ANONYMOUS_SEARCHES, countHits, hashIp, recordHit,
} from '@/lib/rate-limit';
import { splitIndustries } from '@/lib/industries';
import { startSearch } from '@/lib/start-search';
import { CZ_STAGES } from '@/lib/search-options';
import { discoverAll } from '@/lib/sources';

/**
 * Strop funkce. Bylo 60 s — což bylo naše číslo, ne limit platformy: Vercel dnes s Fluid Compute
 * dává 300 s na všech plánech. Práce navíc běží po odeslání odpovědi, takže těch 300 s je celé
 * k dispozici hledání, ne čekajícímu prohlížeči.
 */
export const maxDuration = 300;

const SearchSchema = z.object({
  region: z.string().min(1),
  industry: z.string().min(1),
  /**
   * Filtry a scénář, se kterými hledání startuje. Nejsou jen popisek do uloženého hledání:
   * filtr podle vzniku přepíná zdroj firem na index z ČSÚ (search-job.ts), a to se musí
   * vědět dřív, než běh začne — autosave přes PATCH přijde až po něm.
   */
  filters: z.array(z.string()).max(50).optional(),
  scenario: z.string().max(40).optional(),
  districts: z.array(z.string().regex(/^CZ0[0-9A-C]{3}$/)).max(80).optional(),
});

const WHOLE_CZ_TRIGGERS = ['celá čr', 'cela cr', 'celá cr', 'celé česko'];

function isWholeCz(region: string): boolean {
  return WHOLE_CZ_TRIGGERS.includes(region.toLowerCase().trim());
}

/**
 * Kolik z minuty, kterou funkce má, smí strávit na síti.
 *
 * Číslo není odhad, je to odečet. `maxDuration` je 60 s a musí se do něj vejít tři věci po sobě:
 *
 *     rozpočet na síť  +  strop na jednu firmu  +  zápis do databáze a odpověď
 *          40 s        +         8 s            +          ~5 s               = 53 s
 *
 * Prostřední člen tam musí být, protože `runPool` kontroluje hodiny jen *než* úlohu spustí —
 * úloha nastartovaná v poslední vteřině rozpočtu doběhne až o svůj strop později (viz
 * `PER_CANDIDATE_MS` v lead-pipeline.ts). Dřív ten člen nebyl ohraničený vůbec a hledání
 * přebíhalo rozpočet o šest i víc sekund, takže se celkem dostalo přes 60 s a Vercel funkci
 * zabil — uživatel dostal 504 a hlášku o vypršení.
 *
 * Rozpočet běží od tohohle okamžiku, tedy včetně dotazů do ARESu a na Overpass. Ty samy kolísají
 * mezi třemi a dvanácti sekundami, takže je nelze nechat mimo.
 *
 * Co se do rozpočtu nevejde, se přeskočí, nečeká se na to: firma s neověřeným webem je pořád
 * firma, kdežto požadavek, který vypršel, není k ničemu.
 */
const NETWORK_BUDGET_MS = 40_000;

// Nárazová pojistka a limity tarifu žijí v lib/start-search.ts.

/**
 * Co z výsledku uvidí někdo bez účtu.
 *
 * Kontakty se neškrtají v prohlížeči, ale tady: rozmazání přes CSS je jen obrázek přes text,
 * který si kdokoli přečte v odpovědi na síti. Ukázkový řádek proto telefon, e-mail, adresu webu
 * ani kontaktní stránku vůbec **neobsahuje** — nejde je odkrýt, protože tam nejsou.
 *
 * Co zůstává: jméno a sídlo (veřejný údaj z ARESu), skóre a to, jestli jsme web našli. To je
 * přesně ta část, kvůli které má smysl se registrovat, a nic z toho není kontakt.
 */
function toDemoRow(v: VerifiedCandidate) {
  const { c, verdict } = v;
  const scored = {
    websiteStatus: verdict.status,
    hasWebsite: verdict.status === 'HAS',
    phone: c.phone,
    email: c.email,
    category: c.category,
    address: c.address,
    foundedAt: c.foundedAt,
    vatPayer: c.vatPayer,
    vatUnreliable: c.vatUnreliable,
  };
  return {
    // Bez `id` z databáze — ukázkové hledání se neukládá, takže žádné id neexistuje.
    id: `demo:${c.placeId}`,
    name: c.name,
    address: c.address,
    ico: c.ico,
    category: c.category,
    source: c.source,
    websiteStatus: verdict.status,
    hasWebsite: verdict.status === 'HAS',
    // Skóre počítáme z plných dat, jen je nezveřejňujeme — číslo samo kontakt neprozradí.
    leadScore: leadScore(scored, null),
    vatUnreliable: c.vatUnreliable,
    foundedAt: c.foundedAt ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = sessionFrom(req);

    // Propadlá session není totéž co „nikdo tu není". Kdyby se vypršelý token tiše propadl do
    // ukázky, uživatel s účtem by najednou dostal pět rozmazaných řádků a nikde by se nedozvěděl,
    // že se má znovu přihlásit. Cookie, která nesedí, tedy končí 401 jako dřív.
    if (!session && req.cookies.get('auth-token')) {
      return NextResponse.json({ error: 'Unauthorized', code: 'SESSION_EXPIRED' }, { status: 401 });
    }

    // ── Ukázka pro nepřihlášené ────────────────────────────────────────────────
    // Jedno hledání na IP za 24 hodin, pět řádků, žádné kontakty a nic se neukládá do databáze.
    // Přísné je to schválně: jedno hledání znamená dotaz do ARESu, dotaz na Overpass a stovky
    // DNS i HTTP requestů na cizí weby, takže bez stropu by to byl nástroj na to, nechat si
    // zablokovat IP u Overpassu.
    if (!session) {
      const body = await req.json();
      const parsed = SearchSchema.parse(body);
      // Ukázka je jeden obor: víc oborů nebo „všechny" by stálo víc dotazů, než si nepřihlášený
      // smí vzít, a index z ČSÚ ukázka schválně nepoužívá.
      const region = parsed.region;
      const industry = splitIndustries(parsed.industry)[0];
      if (!industry) return NextResponse.json({ error: 'Pick a trade for the demo', code: 'DEMO_ONE_TRADE' }, { status: 422 });
      const ipHash = hashIp(req);

      if (await countHits(ipHash, 'search') >= ANONYMOUS_SEARCHES) {
        return NextResponse.json(
          { error: 'Demo search already used', code: 'DEMO_USED' },
          { status: 429 },
        );
      }
      await recordHit(ipHash, 'search');

      const deadlineAt = Date.now() + NETWORK_BUDGET_MS;
      const wholeCz = isWholeCz(region);
      /**
       * Ukázka „celé ČR" je pět řádků z první fáze skutečného hledání, tedy z Prahy.
       *
       * Bez města šel do ARESu dotaz na celou republiku. Ten se odmítne dřív, než něco vrátí,
       * a v ukázce pak zbyly konglomeráty, které mají v rejstříku desítky oborů — Grandhotel
       * Pupp jako výsledek hledání kadeřnictví. Pět opravdových pražských firem řekne
       * o aplikaci pravdu, tohle o ní lhalo.
       */
      const city = wholeCz ? CZ_STAGES[0].label : region.split(',')[0].trim();

      const [aresLeads, osmLeads] = await discoverAll(industry, city, ANONYMOUS_RESULTS);
      const candidates = mergeLeads([osmLeads, aresLeads], ANONYMOUS_RESULTS);
      const verified = await enrichAndVerify(candidates, {
        // Pět řádků se ověří i u „celé ČR" — je to jedno město a pět sond, ne tisíce.
        probeNetwork: true, deadlineAt, region, industry,
      });

      return NextResponse.json({ demo: true, results: verified.map(toDemoRow) });
    }

    const payload = session;
    const body = await req.json();
    const { region, industry, filters, scenario, districts } = SearchSchema.parse(body);

    // Limity tarifu, nárazová pojistka, založení běhu a spuštění na pozadí jsou v lib/start-search.ts —
    // totéž používá „Spustit znovu" u uloženého hledání.
    const started = await startSearch({ userId: payload.userId, industry, region, filters, scenario, districts });
    if (!started.ok) {
      const message = started.code === 'PLAN_LIMIT' ? 'Search limit reached for your plan'
        : started.code === 'RATE_LIMITED' ? 'Too many searches in a short time'
        : started.code === 'ALL_NEEDS_EVENT' ? 'All trades need a founding-date filter' : 'Unauthorized';
      return NextResponse.json(
        { error: message, code: started.code },
        { status: started.status, headers: started.retryAfterS ? { 'Retry-After': String(started.retryAfterS) } : undefined },
      );
    }

    return NextResponse.json({ jobId: started.jobId, searchId: started.searchId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
