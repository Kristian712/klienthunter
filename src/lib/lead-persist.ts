import { analyzeBusinessFull } from './business-checks';
import { prisma } from './db';
import { leadScore } from './lead-score';
import { contactPageUrl, extractContacts } from './sources';
import { socialFromUrl } from './website-status';
import type { VerifiedCandidate } from './lead-pipeline';

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
      hasFacebook:   checks?.hasFacebook  ?? Boolean(social.fb),
      hasInstagram:  checks?.hasInstagram ?? Boolean(social.ig),
      hasLinkedIn:   checks?.hasLinkedIn  ?? Boolean(social.li),
      // The three flags above are only an answer when we had a page to read them off, or when a
      // source handed us a social URL outright. Otherwise they are all false because we never
      // looked, and the UI has to be able to tell the difference.
      socialsChecked: checks !== null || Boolean(social.fb || social.ig || social.li),
      foundedAt:     c.foundedAt,
      vatPayer:      c.vatPayer,
      vatUnreliable: c.vatUnreliable,
    };

    return prisma.businessResult.create({
      data: {
        ...row,
        searchId,
        placeId:         c.placeId,
        name:            c.name,
        address:         c.address,
        website:         verdict.url,
        contactUrl:      contactPage,
        ico:             c.ico,
        hasWebsite:      verdict.status === 'HAS',
        websiteEvidence: verdict.evidence,
        facebookUrl:     checks?.facebookUrl  ?? social.fb,
        instagramUrl:    checks?.instagramUrl ?? social.ig,
        linkedInUrl:     checks?.linkedInUrl  ?? social.li,
        websiteScore:    checks?.websiteScore ?? 50,
        websiteAgeNote:  checks?.websiteAgeNote ?? '',
        // Computed here rather than on read so the number a user sorted by yesterday is the
        // same number today — and so the database can order by it.
        leadScore:       leadScore(row, criteria),
        // Ratings, review counts and opening hours came only from Google Places, which had to
        // go for licensing reasons. The columns stay for the rows written before that.
        reviewCount:     0,
        category:        c.category,
        source:          c.source,
      },
    }).catch(() => null);
  };

  return (await Promise.all(verified.map(persist))).filter(Boolean);
}
