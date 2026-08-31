import { createRobotsCache } from './robots';
import { ENRICHMENT_SOURCES, type RawLead } from './sources';
import { resolveNiche } from './nace-map';
import { buildNameIndex, discoverWebsite, tldForRegion } from './website-discovery';
import {
  classify,
  createProbeCache,
  isRealWebsite,
  isSameBusiness,
  runPool,
  significantTokens,
  siteFromEmail,
  type WebsiteSignals,
  type WebsiteVerdict,
} from './website-status';

/**
 * The part of a search that is the same whether the leads came from ARES, OpenStreetMap or a
 * spreadsheet the user uploaded: merge duplicates, ask the registers what they know, verify
 * the websites.
 *
 * Deliberately free of Prisma — writing the rows lives in `lead-persist.ts` — so the
 * verification scripts can import this module without a database.
 *
 * Everything here runs against a wall clock. The API routes have sixty seconds, and a lead
 * whose website could not be checked in time is still a lead — it is just UNKNOWN.
 */
export const CONCURRENCY = 12;
const ENRICH_CONCURRENCY = 8;

/**
 * Headroom kept back from the pool's deadline for the discovery probes.
 *
 * `runPool` only checks the clock before it *starts* a task, and one discovery can still spend
 * several seconds on dead hosts after that. Stopping it early leaves the persist step the time
 * it needs, and a firm whose website we ran out of time for is simply reported without one.
 */
const DISCOVERY_HEADROOM_MS = 6_000;

/**
 * Nejdelší doba, kterou smí zabrat jedna firma. Po ní se bere, co je, a jde se dál.
 *
 * Tohle je ta věc, která dělala z hledání ruletu. `runPool` se dívá na hodiny jen *než* úlohu
 * spustí — úloha nastartovaná těsně před koncem rozpočtu si pak mohla vzít, kolik chtěla, a
 * `Promise.all` čekal na všechny. V praxi to znamenalo, že o době běhu nerozhodoval počet firem,
 * ale nejpomalejší řetěz čekání: Liberecký kraj se 443 firmami trval 51 s, Moravskoslezský
 * s 86 firmami 47 s. Pětinásobně méně práce, skoro stejný čas.
 *
 * Osm sekund je nad rámec toho, co poctivá firma potřebuje: čtyři DNS dotazy paralelně plus
 * nejvýš čtyři HTTP dotazy po dvou sekundách. Firma, která se do toho nevejde, se vrátí bez
 * ověřeného webu — což je stav, se kterým aplikace odjakživa počítá.
 */
const PER_CANDIDATE_MS = 8_000;

/**
 * Vrátí, co stihne práce, jinak náhradní výsledek. Nikdy nevyhodí výjimku.
 *
 * Požadavky, které v tu chvíli letí, doběhnou na pozadí a nikoho nezajímají — mají vlastní
 * dvousekundový limit, takže brzy zemřou samy.
 */
function withCap<T>(work: Promise<T>, onTimeout: () => T, ms: number): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(onTimeout()), ms);
    const settle = (value: T) => { clearTimeout(timer); resolve(value); };
    work.then(settle, () => settle(onTimeout()));
  });
}

/** One business awaiting a website verdict, with everything the sources told us about it. */
export interface Candidate {
  /** One or more source ids joined by `+`, e.g. `osm+ares`. */
  source: string;
  placeId: string;
  name: string;
  ico?: string;
  dic?: string;
  phone?: string;
  email?: string;
  /** Profil na sociální síti, jak ho uvedl zdroj. Neověřený — viz `RawLead`. */
  facebookUrl?: string;
  instagramUrl?: string;
  address?: string;
  /** Souřadnice, když je zdroj uvedl. Dnes je má jen OpenStreetMap. */
  lat?: number;
  lon?: number;
  /** Kód adresního místa RÚIAN z ARESu — klíč k souřadnicím z otevřených dat ČÚZK. */
  ruianCode?: number;
  /** Kód obce. Určuje, který soubor adresních míst se z RÚIAN stáhne. */
  obecCode?: number;
  category?: string;
  foundedAt?: Date;
  vatPayer?: boolean;
  vatUnreliable?: boolean;
  signals: WebsiteSignals;
}

export function toCandidate(lead: RawLead): Candidate {
  return {
    source: lead.sourceId,
    placeId: lead.externalId,
    name: lead.name,
    ico: lead.ico,
    dic: lead.dic,
    phone: lead.phone,
    email: lead.email,
    facebookUrl: lead.facebookUrl,
    instagramUrl: lead.instagramUrl,
    address: lead.address,
    lat: lead.lat,
    lon: lead.lon,
    ruianCode: lead.ruianCode,
    obecCode: lead.obecCode,
    category: lead.category,
    foundedAt: lead.foundedAt,
    signals: {
      claimedUrl: lead.website,
      osmSaysEmpty: lead.sourceId === 'osm' && !lead.website,
      registryHasNoField: lead.sourceId === 'ares',
    },
  };
}

/** Folds a second source's record into an existing candidate. */
function absorb(target: Candidate, lead: RawLead): void {
  if (!target.dic) target.dic = lead.dic;
  if (!target.phone) target.phone = lead.phone;
  if (!target.email) target.email = lead.email;
  if (!target.facebookUrl) target.facebookUrl = lead.facebookUrl;
  if (!target.instagramUrl) target.instagramUrl = lead.instagramUrl;
  if (!target.category) target.category = lead.category;

  // IČO is the key everything else hangs off, and only the registry has it.
  if (!target.ico) target.ico = lead.ico;
  if (!target.address) target.address = lead.address;
  // Souřadnice nese OSM, kód adresního místa ARES — po sloučení má firma obojí.
  if (target.lat === undefined) { target.lat = lead.lat; target.lon = lead.lon; }
  if (!target.ruianCode) { target.ruianCode = lead.ruianCode; target.obecCode = lead.obecCode; }
  // An OSM record merged with an ARES one inherits the founding date it could never have.
  if (!target.foundedAt) target.foundedAt = lead.foundedAt;

  // Asymmetric on purpose: a website claim from any source counts, silence from one source
  // never cancels a claim from another.
  if (!isRealWebsite(target.signals.claimedUrl) && lead.website) {
    target.signals.claimedUrl = lead.website;
  }
  if (lead.sourceId === 'ares') target.signals.registryHasNoField = true;
  if (!target.source.split('+').includes(lead.sourceId)) target.source += `+${lead.sourceId}`;
}

/**
 * Merges the sources into one candidate list, earlier batches winning the slots.
 *
 * An inverted index on name tokens keeps this from being a quadratic scan: with a few hundred
 * leads per source, comparing every pair would cost more than the ARES request did.
 */
export function mergeLeads(batches: RawLead[][], limit: number): Candidate[] {
  const candidates: Candidate[] = [];
  const byToken = new Map<string, Candidate[]>();
  const byIco = new Map<string, Candidate>();

  for (const batch of batches) {
    for (const lead of batch) {
      const exact = lead.ico ? byIco.get(lead.ico) : undefined;
      if (exact) {
        absorb(exact, lead);
        continue;
      }

      const tokens = significantTokens(lead.name);
      const nearby = new Set<Candidate>();
      for (const token of tokens) {
        for (const c of byToken.get(token) ?? []) nearby.add(c);
      }

      const twin = Array.from(nearby).find(c => isSameBusiness(c, lead));
      if (twin) {
        absorb(twin, lead);
        if (twin.ico) byIco.set(twin.ico, twin);
        continue;
      }

      // No match, and no room left — later batches may still merge into what we have.
      if (candidates.length >= limit) continue;

      const created = toCandidate(lead);
      candidates.push(created);
      if (created.ico) byIco.set(created.ico, created);
      for (const token of tokens) {
        const bucket = byToken.get(token);
        if (bucket) bucket.push(created);
        else byToken.set(token, [created]);
      }
    }
  }

  return candidates;
}

export interface VerifiedCandidate {
  c: Candidate;
  verdict: WebsiteVerdict;
}

/**
 * Asks the registers and probes the websites at the same time. The two touch different hosts
 * and different fields, so running them one after the other would only burn the budget twice.
 *
 * `probeNetwork: false` skips every HTTP probe — a nationwide run would need thousands of them
 * and would never finish, so it yields HAS or UNKNOWN from what the sources already said.
 */
export async function enrichAndVerify(
  candidates: Candidate[],
  { probeNetwork, deadlineAt, region = '', industry = '', onBatch, batchSize = 25 }:
    {
      probeNetwork: boolean;
      deadlineAt: number;
      region?: string;
      industry?: string;
      /**
       * Zavolá se průběžně, jakmile je hotová další dávka firem.
       *
       * Bez tohohle se všechno zapisovalo až po doběhnutí celého poolu — a job, který spadl
       * v půlce, po sobě nenechal nic. Volání se čeká (await), takže když je databáze pomalá,
       * pool se sám přibrzdí místo aby se zápisy hromadily.
       *
       * Nepovinné: synchronní cesty (ukázka bez přihlášení, import CSV) ho neposílají a chovají
       * se přesně jako dřív.
       */
      onBatch?: (batch: VerifiedCandidate[]) => Promise<void>;
      batchSize?: number;
    },
): Promise<VerifiedCandidate[]> {
  const robots = createRobotsCache();
  const probe = createProbeCache(robots);

  // Built from the whole result set, because that is what makes "dental" generic and "ajna"
  // distinctive without anyone maintaining a word list per trade.
  const nameIndex = buildNameIndex(candidates.map(c => c.name));
  const tld = tldForRegion(region);
  const discoveryDeadline = deadlineAt - DISCOVERY_HEADROOM_MS;
  // The trade the user searched for, as words a Czech page would actually contain. Used as the
  // second fact a guessed domain has to satisfy — see `verifyPage`.
  const tradeWords = Array.from(new Set([industry, ...resolveNiche(industry).keywords]))
    .map(w => w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim())
    .filter(w => w.length >= 4);

  const enrichOne = async (c: Candidate) => {
    const lead: RawLead = {
      sourceId: c.source,
      externalId: c.placeId,
      name: c.name,
      ico: c.ico,
      dic: c.dic,
    };
    const patches = await Promise.all(
      ENRICHMENT_SOURCES.map(s => s.enrich(lead).catch(() => ({} as Partial<RawLead>))),
    );
    for (const patch of patches) {
      // The trade register knows where the business actually operates; the registered seat of
      // a sole trader is usually their flat, so this address is worth overwriting with.
      if (patch.address) c.address = patch.address;
      if (patch.vatPayer !== undefined) c.vatPayer = patch.vatPayer;
      if (patch.vatUnreliable !== undefined) c.vatUnreliable = patch.vatUnreliable;
    }
  };

  /**
   * The e-mail domain is resolved here rather than in `toCandidate` because `absorb` can still
   * add an e-mail from a second source after the candidate was created. Reading it at the last
   * moment means the merge order cannot decide whether we look.
   */
  const verify = async (c: Candidate): Promise<WebsiteVerdict> => {
    const signals: WebsiteSignals = { ...c.signals, emailDomainUrl: siteFromEmail(c.email) };
    if (!probeNetwork) return classify(signals);

    // A URL a source actually stated outranks a domain we derived.
    const target = isRealWebsite(signals.claimedUrl) ? signals.claimedUrl : signals.emailDomainUrl;
    const verdict = classify(signals, target ? await probe(target) : undefined);
    if (verdict.status === 'HAS') return verdict;

    /**
     * Nothing the sources gave us led to a website — which is the normal case, not the
     * exception: ARES has no website column at all. Rather than leave the row blank, look the
     * firm up under the domains its own name suggests. `discoverWebsite` only reports a hit the
     * fetched page proves, so this can add websites but never invent one.
     */
    const found = await discoverWebsite(
      { name: c.name, ico: c.ico },
      nameIndex,
      { tld, deadlineAt: discoveryDeadline, probe, tradeWords },
    );
    if (!found) return verdict;
    return {
      status: 'HAS',
      url: found.url,
      evidence: found.evidence,
      html: found.html,
    };
  };

  // Nasbírané, ale ještě nezapsané výsledky. Pool je plní z dvanácti pracovníků naráz, takže
  // se do něj sahá jen tady a jen celým odebráním obsahu.
  const pending: VerifiedCandidate[] = [];
  const flush = async (force: boolean) => {
    if (!onBatch) return;
    if (!force && pending.length < batchSize) return;
    const batch = pending.splice(0, pending.length);
    if (batch.length > 0) await onBatch(batch);
  };

  const [verdicts] = await Promise.all([
    runPool<Candidate, VerifiedCandidate>(
      candidates,
      async c => {
        // Když se firma do stropu nevejde, platí verdikt z toho, co řekly zdroje — tedy totéž,
        // co dostane celostátní hledání, které se po síti neptá vůbec.
        const result = { c, verdict: await withCap(verify(c), () => classify(c.signals), PER_CANDIDATE_MS) };
        pending.push(result);
        await flush(false);
        return result;
      },
      CONCURRENCY,
      deadlineAt,
      c => ({ c, verdict: classify(c.signals) }),
    ),
    runPool<Candidate, void>(
      candidates.filter(c => c.ico),
      // Dotazy do rejstříků mají vlastní timeouty, ale ty jsou delší než náš strop. Bez tohohle
      // by celý požadavek mohl viset na jednom pomalém dotazu do ARESu i po konci rozpočtu.
      c => withCap(enrichOne(c), () => undefined, PER_CANDIDATE_MS),
      ENRICH_CONCURRENCY,
      deadlineAt,
      () => undefined,
    ),
  ]);

  // Zbytek, který na plnou dávku nedosáhl.
  await flush(true);

  return verdicts;
}
