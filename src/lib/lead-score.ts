/**
 * How good an opportunity a lead is — not how good the business is.
 *
 * The number answers one question: "if I sell websites, who do I call first?" A firm with no
 * site, a reachable phone number and ten years of trading scores high; a firm with a fast
 * modern site scores low even though it is obviously the healthier company.
 *
 * Everything here is derived from fields the sources already filled, so the score costs no
 * extra request and recomputes identically for a row written a year ago.
 */

/** A page that takes longer than this to answer its first byte is worth pitching a rebuild to. */
export const SLOW_WEBSITE_MS = 2_500;

/** Three years of trading is the point where a business is past its risky start. */
const ESTABLISHED_YEARS = 3;

export interface ScoreInput {
  websiteStatus?: string | null;
  websiteIsOld?: boolean | null;
  /** Response time of the site in ms, when it was measured. */
  websiteMs?: number | null;
  phone?: string | null;
  email?: string | null;
  hasFacebook?: boolean | null;
  hasInstagram?: boolean | null;
  hasLinkedIn?: boolean | null;
  foundedAt?: Date | string | null;
  vatPayer?: boolean | null;
  vatUnreliable?: boolean | null;
}

export function yearsSince(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

export function isSlowWebsite(input: ScoreInput): boolean {
  return typeof input.websiteMs === 'number' && input.websiteMs >= SLOW_WEBSITE_MS;
}

export function leadScore(input: ScoreInput): number {
  const has = input.websiteStatus === 'HAS';
  const weakSite = Boolean(input.websiteIsOld) || isSlowWebsite(input);
  const social = Boolean(input.hasFacebook || input.hasInstagram || input.hasLinkedIn);
  const age = yearsSince(input.foundedAt);

  let score = 0;

  // The whole product exists for this line: no verified site is the strongest buying signal.
  if (!has) score += 40;
  else if (weakSite) score += 25;
  else score -= 20;

  // A lead you cannot reach is not a lead.
  if (input.phone || input.email) score += 20;

  if (age !== null && age >= ESTABLISHED_YEARS) score += 15;
  if (input.vatPayer) score += 10;
  if (!social) score += 10;

  // The tax office publicly calls this firm an unreliable payer. Chase it last.
  if (input.vatUnreliable) score -= 25;

  return Math.max(0, Math.min(100, Math.round(score)));
}
