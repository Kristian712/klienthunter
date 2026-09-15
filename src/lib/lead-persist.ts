import { analyzeBusinessFull } from './business-checks';
import { prisma } from './db';
import type { Prisma } from '@prisma/client';
import { leadScore } from './lead-score';
import { contactPageUrl, extractContacts } from './sources';
import { socialFromUrl } from './website-status';
import type { VerifiedCandidate } from './lead-pipeline';
import { withoutOptouts } from './optout';

/**
 * The last step of both a search and a CSV import: turn verdicts into rows.
 *
 * Split out of `lead-pipeline.ts` so that everything up to this point stays free of Prisma
 * and can run in a plain script without a database.
 */
export async function persistResults(
  searchId: string,
  verified: VerifiedCandidate[],
  /**
   * The searching user's criteria from onboarding. Results belong to exactly one user's search,
   * so scoring them against that user's definition of a good client is well defined. Omitted
   * (or empty, for someone who skipped onboarding) means the neutral default in `lead-score.ts`.
   */
  criteria?: readonly string[] | null,
) {
  const persist = async ({ c, verdict }: VerifiedCandidate) => {
    // The probe already downloaded the page, so scoring and contact extraction cost no extra
    // request — and touch no page robots.txt kept us out of.
    const checks = verdict.html && verdict.url
      ? await analyzeBusinessFull(verdict.url, verdict.html)
      : null;
    const contacts = verdict.html ? extractContacts(verdict.html, verdict.url) : {};
    // Free: the same HTML the probe already downloaded. Gives the row a button that opens the
    // page where the firm actually publishes how to reach it.
    const contactPage = verdict.html && verdict.url ? contactPageUrl(verdict.html, verdict.url) : undefined;
    const social = checks ? {} : socialFromUrl(c.signals.claimedUrl ?? '');

    const row = {
      phone:         c.phone ?? contacts.phone,
      email:         c.email ?? contacts.email ?? checks?.email,
      websiteStatus: verdict.status,
      websiteIsOld:  checks?.websiteIsOld ?? false,
      // Pořadí zdrojů: odkaz z vlastní homepage firmy je její vlastní tvrzení a vyhrává;
      // tag z OpenStreetMap je tvrzení mapéra a nastupuje, když web nemáme nebo na profil
      // neodkazoval. Ověřit ani jedno nejde — Meta automatizovaný sběr zakazuje.
      hasFacebook:   checks?.hasFacebook  || Boolean(c.facebookUrl)  || Boolean(social.fb),
      hasInstagram:  checks?.hasInstagram || Boolean(c.instagramUrl) || Boolean(social.ig),
      hasLinkedIn:   checks?.hasLinkedIn  ?? Boolean(social.li),
      // The three flags above are only an answer when we had a page to read them off, or when a
      // source handed us a social URL outright. Otherwise they are all false because we never
      // looked, and the UI has to be able to tell the difference.
      socialsChecked:
        checks !== null ||
        Boolean(social.fb || social.ig || social.li) ||
        Boolean(c.facebookUrl || c.instagramUrl),
      foundedAt:      c.foundedAt,
      vatPayer:       c.vatPayer,
      vatUnreliable:  c.vatUnreliable,
      legalForm:      c.legalForm,
      activePremises: c.activePremises,
      // Rejstříková pole, která se dřív četla a zahazovala. `trades` je JSON, zbytek sloupce.
      nace:             c.nace ?? [],
      trades:           c.trades && c.trades.length ? (c.trades as unknown as Prisma.InputJsonValue) : undefined,
      employeeCategory: c.employeeCategory,
      inInsolvency:     c.inInsolvency,
      registryUpdatedAt: c.registryUpdatedAt,
    };

    const write = () => prisma.businessResult.create({
      data: {
        ...row,
        searchId,
        placeId:         c.placeId,
        name:            c.name,
        address:         c.address,
        lat:             c.lat,
        lon:             c.lon,
        ruianCode:       c.ruianCode,
        website:         verdict.url,
        contactUrl:      contactPage,
        ico:             c.ico,
        // Datum prvního nálezu kontaktu. U opakovaného běhu ho `persistFromPrior` přenáší ze
        // staršího řádku; tady jde jen o firmy, které se sondovaly teď — u nich je to teď.
        contactFoundAt:  c.source !== 'csv' && (row.phone || row.email) ? new Date() : null,
        matchedBy:       c.matchedBy,
        hasWebsite:      verdict.status === 'HAS',
        websiteEvidence: verdict.evidence,
        facebookUrl:     checks?.facebookUrl  ?? c.facebookUrl  ?? social.fb,
        instagramUrl:    checks?.instagramUrl ?? c.instagramUrl ?? social.ig,
        linkedInUrl:     checks?.linkedInUrl  ?? social.li,
        websiteScore:    checks?.websiteScore ?? 50,
        websiteAgeNote:  checks?.websiteAgeNote ?? '',
        // Computed here rather than on read so the number a user sorted by yesterday is the
        // same number today — and so the database can order by it.
        leadScore:       leadScore(row, criteria),
        category:        c.category,
        source:          c.source,
      },
    });

    /**
     * Zápis se jednou zopakuje a jeho selhání se zaloguje.
     *
     * Dřív tu bylo `.catch(() => null)`. Neúspěšný zápis tedy zmizel beze stopy: hledání se
     * tvářilo jako hotové, počítadlo hlásilo, kolik firem prošlo, a v seznamu jich byla část.
     * Většina takových chyb je chvilkový výpadek spojení do databáze, který druhý pokus přežije.
     */
    try {
      return await write();
    } catch (first) {
      try {
        return await write();
      } catch (err) {
        console.error('lead-persist: řádek se nepodařilo uložit:', c.name, err ?? first);
        return null;
      }
    }
  };

  // Subjekt, který požádal o vyřazení, se do nového hledání nezapíše — platí od okamžiku žádosti
  // (lib/optout.ts). Jeden dotaz na dávku.
  const allowed = await withoutOptouts(verified.map(v => v.c)).then(cs => new Set(cs));
  return (await Promise.all(verified.filter(v => allowed.has(v.c)).map(persist))).filter(Boolean);
}

/** Dřívější řádek téže firmy, ze kterého se při opakovaném běhu bere kontakt i web. */
export type PriorRow = Prisma.BusinessResultGetPayload<{ select: typeof PRIOR_SELECT }>;

export const PRIOR_SELECT = {
  ico: true, placeId: true, phone: true, email: true, website: true, contactUrl: true,
  hasWebsite: true, websiteStatus: true, websiteEvidence: true, websiteIsOld: true, websiteScore: true,
  websiteAgeNote: true, hasFacebook: true, hasInstagram: true, hasLinkedIn: true, socialsChecked: true,
  facebookUrl: true, instagramUrl: true, linkedInUrl: true, vatPayer: true, vatUnreliable: true,
  activePremises: true, trades: true, employeeCategory: true, contactFoundAt: true, createdAt: true,
} satisfies Prisma.BusinessResultSelect;

/**
 * Opakovaný běh uloženého hledání: firma, u které minule telefon nebo e-mail byl, se znovu
 * nesonduje. Její web a kontakty se opíšou z dřívějšího řádku, rejstříková pole (jméno, sídlo,
 * datum vzniku, insolvence…) se berou čerstvá z kandidáta. Sondy tak zbývají jen firmám,
 * které minule kontakt neměly — a právě u nich má opakování smysl.
 *
 * Co se přenáší, je z data `contactFoundAt` (nebo vzniku řádku) vidět u firmy v seznamu.
 */
export async function persistFromPrior(
  searchId: string,
  pairs: Array<{ c: import('./lead-pipeline').Candidate; prior: PriorRow }>,
  criteria?: readonly string[] | null,
) {
  const allowed = await withoutOptouts(pairs.map(p => p.c)).then(cs => new Set(cs));
  const data: Prisma.BusinessResultCreateManyInput[] = pairs.filter(p => allowed.has(p.c)).map(({ c, prior }) => {
    const row = {
      phone:         c.phone ?? prior.phone,
      email:         c.email ?? prior.email,
      website:       prior.website,
      contactUrl:    prior.contactUrl,
      websiteStatus: prior.websiteStatus,
      hasWebsite:    prior.hasWebsite,
      websiteIsOld:  prior.websiteIsOld,
      hasFacebook:   prior.hasFacebook,
      hasInstagram:  prior.hasInstagram,
      hasLinkedIn:   prior.hasLinkedIn,
      socialsChecked: prior.socialsChecked,
      foundedAt:     c.foundedAt,
      vatPayer:      c.vatPayer ?? prior.vatPayer,
      vatUnreliable: c.vatUnreliable ?? prior.vatUnreliable,
      legalForm:     c.legalForm,
      activePremises: c.activePremises ?? prior.activePremises,
      nace:          c.nace ?? [],
      trades:        c.trades && c.trades.length ? (c.trades as unknown as Prisma.InputJsonValue) : prior.trades ?? undefined,
      employeeCategory: c.employeeCategory ?? prior.employeeCategory,
      inInsolvency:  c.inInsolvency,
      registryUpdatedAt: c.registryUpdatedAt,
      address:       c.address,
      category:      c.category,
      source:        c.source,
    };
    return {
      ...row,
      searchId,
      placeId:         c.placeId,
      name:            c.name,
      lat:             c.lat,
      lon:             c.lon,
      ruianCode:       c.ruianCode,
      ico:             c.ico,
      websiteEvidence: prior.websiteEvidence,
      facebookUrl:     prior.facebookUrl,
      instagramUrl:    prior.instagramUrl,
      linkedInUrl:     prior.linkedInUrl,
      websiteScore:    prior.websiteScore,
      websiteAgeNote:  prior.websiteAgeNote,
      leadScore:       leadScore(row, criteria),
      contactFoundAt:  prior.contactFoundAt ?? prior.createdAt,
      matchedBy:       c.matchedBy,
    };
  });
  if (data.length === 0) return 0;
  try {
    return (await prisma.businessResult.createMany({ data })).count;
  } catch (err) {
    console.error('lead-persist: přenos řádků z minulého běhu selhal:', err);
    return 0;
  }
}
