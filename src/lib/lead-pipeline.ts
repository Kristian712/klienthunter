import { createRobotsCache } from './robots';
import { ENRICHMENT_SOURCES, type RawLead } from './sources';
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
  address?: string;
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
    address: lead.address,
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
  if (!target.category) target.category = lead.category;

  // IČO is the key everything else hangs off, and only the registry has it.
  if (!target.ico) target.ico = lead.ico;
  if (!target.address) target.address = lead.address;
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
  { probeNetwork, deadlineAt }: { probeNetwork: boolean; deadlineAt: number },
): Promise<VerifiedCandidate[]> {
  const robots = createRobotsCache();
  const probe = createProbeCache(robots);

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

    // One probe per candidate. A URL a source actually stated outranks a domain we derived.
    const target = isRealWebsite(signals.claimedUrl) ? signals.claimedUrl : signals.emailDomainUrl;
    return classify(signals, target ? await probe(target) : undefined);
  };

  const [verdicts] = await Promise.all([
    runPool<Candidate, VerifiedCandidate>(
      candidates,
      async c => ({ c, verdict: await verify(c) }),
      CONCURRENCY,
      deadlineAt,
      c => ({ c, verdict: classify(c.signals) }),
    ),
    runPool<Candidate, void>(
      candidates.filter(c => c.ico),
      enrichOne,
      ENRICH_CONCURRENCY,
      deadlineAt,
      () => undefined,
    ),
  ]);

  return verdicts;
}
