import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPlanLimits, sessionFrom } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { leadScore } from '@/lib/lead-score';
import { enrichAndVerify, mergeLeads, type VerifiedCandidate } from '@/lib/lead-pipeline';
import {
  ANONYMOUS_RESULTS, ANONYMOUS_SEARCHES, countHits, hashIp, recordHit,
} from '@/lib/rate-limit';
import { runSearchJob } from '@/lib/search-job';
import { discoverAll } from '@/lib/sources';
import { waitUntil } from '@vercel/functions';

/**
 * Strop funkce. Bylo 60 s — což bylo naše číslo, ne limit platformy: Vercel dnes s Fluid Compute
 * dává 300 s na všech plánech. Práce navíc běží po odeslání odpovědi, takže těch 300 s je celé
 * k dispozici hledání, ne čekajícímu prohlížeči.
 */
export const maxDuration = 300;

const SearchSchema = z.object({
  region: z.string().min(1),
  industry: z.string().min(1),
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

/**
 * Nárazová pojistka nad rámec měsíčního limitu plánu.
 *
 * Každé hledání střílí dotaz na veřejný Overpass, který ve svých podmínkách výslovně žádá,
 * aby ho nikdo nepoužíval jako backendovou infrastrukturu. Měsíční limit plánu tohle neřeší
 * ze dvou důvodů: plány VIP, BUSINESS a admin ho mají nastavený na nekonečno, a i konečný
 * limit dovolí vystřílet celý měsíční příděl během minuty. Kdyby Overpass zablokoval naši
 * IP, přijdou o kontakty všichni uživatelé najednou — proto tenhle strop platí pro každého
 * včetně adminů.
 *
 * Dvanáct za pět minut je nad rámec toho, co stihne člověk, který si výsledky opravdu čte:
 * jedno hledání trvá i s ověřováním webů desítky sekund.
 */
const BURST_WINDOW_MS = 5 * 60 * 1000;
const BURST_MAX = 12;

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
      const { region, industry } = SearchSchema.parse(body);
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
      const city = wholeCz ? '' : region.split(',')[0].trim();

      const [aresLeads, osmLeads] = await discoverAll(industry, city, ANONYMOUS_RESULTS);
      const candidates = mergeLeads([osmLeads, aresLeads], ANONYMOUS_RESULTS);
      const verified = await enrichAndVerify(candidates, {
        probeNetwork: !wholeCz, deadlineAt, region, industry,
      });

      return NextResponse.json({ demo: true, results: verified.map(toDemoRow) });
    }

    const payload = session;
    const body = await req.json();
    const { region, industry } = SearchSchema.parse(body);

    // Počítáme už založená hledání, ne dokončená — jinak by série souběžných požadavků
    // proklouzla všechna najednou, protože žádné z nich by v tu chvíli ještě nebylo hotové.
    const burstSince = new Date(Date.now() - BURST_WINDOW_MS);
    const recent = await prisma.search.count({
      where: { userId: payload.userId, createdAt: { gte: burstSince } },
    });
    if (recent >= BURST_MAX) {
      return NextResponse.json(
        { error: 'Too many searches in a short time', code: 'RATE_LIMITED' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(BURST_WINDOW_MS / 1000)) } },
      );
    }

    const limits = getPlanLimits(payload.plan, payload.isVip, payload.isAdmin);

    if (limits.searches !== Infinity) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const searchCount = await prisma.search.count({
        where: { userId: payload.userId, createdAt: { gte: thirtyDaysAgo } },
      });
      if (searchCount >= limits.searches) {
        return NextResponse.json({ error: 'Search limit reached for your plan' }, { status: 403 });
      }
    }

    // Kritéria uživatele si načítá runner na pozadí — v cestě požadavku by to byl jen další
    // round trip do databáze mezi uživatelem a odpovědí, kterou čeká.
    const search = await prisma.search.create({
      data: { userId: payload.userId, query: industry, region },
    });

    /**
     * Odsud dál se nečeká.
     *
     * Založíme job, vrátíme jeho id — a vlastní hledání běží dál v téže invokaci díky
     * `waitUntil`, jen už bez prohlížeče na druhém konci. Uživatel může kartu zavřít; výsledky
     * se plní do databáze po dávkách a on se k nim vrátí, kdy chce.
     *
     * `resultsPerSearch` z plánu jde do `targetCount` — je to vstupní strop, ne výsledek.
     * `foundCount` zůstává nulový a runner ho plní tím, co zdroje opravdu vrátily; u hledání
     * po fázích ho přičítá po každém městě.
     */
    const job = await prisma.searchJob.create({
      data: {
        userId: payload.userId,
        searchId: search.id,
        region,
        industry,
        targetCount: limits.resultsPerSearch === Infinity ? 500 : limits.resultsPerSearch,
      },
    });

    // Lokální `next dev` žádný kontext požadavku nemá a `waitUntil` v něm vyhodí výjimku.
    // Tam se prostě počká — vývojáře to nezdrží a chování zůstane stejné.
    const work = runSearchJob(job.id);
    try {
      waitUntil(work);
    } catch {
      await work;
    }

    return NextResponse.json({ jobId: job.id, searchId: search.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('Search error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
