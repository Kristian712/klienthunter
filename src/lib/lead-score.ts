import { resolveFilters, type FilterableLead, type LeadFilter } from './lead-filters';

/**
 * How well a firm matches what *this* user is looking for.
 *
 * The old score answered one question — "if I sell websites, who do I call first?" — and paid
 * +40 for a missing site and −20 for a fast modern one. That is a useful number for exactly one
 * profession and actively misleading for an accountant, a photographer or an estate agent, who
 * do not care whether their client has a website.
 *
 * So the score no longer guesses what a business *needs*. It measures fit against criteria the
 * user picked for themselves during onboarding:
 *
 *     score = 100 × (credit earned / criteria chosen) − penalty for an unreliable VAT payer
 *
 * where each criterion is worth 1 when the firm meets it, 0 when it demonstrably does not, and
 * `UNKNOWN_CREDIT` when we never learned the answer — see the note on that constant.
 *
 * Two consequences worth keeping in mind:
 *
 * 1. The criteria are the ids of entries in `lead-filters.ts`, so the vocabulary of "my ideal
 *    client" and the vocabulary of the filter chips are the same list. Adding a filter adds a
 *    criterion for free.
 * 2. Criteria *rank*, they do not *narrow*. If they also narrowed, every surviving row would
 *    match every criterion, every score would be 100, and the column would carry no
 *    information. Narrowing stays with the filter chips in the search UI.
 *
 * The number is still computed once, at write time (`lead-persist.ts`), from the profile of the
 * user whose search produced the row. Rows belong to exactly one user's search, so a per-user
 * score is well defined, the database can still `orderBy` it, and yesterday's ordering is
 * reproducible today.
 */

/**
 * Scoring for someone who skipped onboarding. Reachability and a few years of trading are the
 * only two things worth assuming about a stranger's ideal client — neither mentions a website.
 */
export const DEFAULT_CRITERIA = ['has_contact', 'established_3y'] as const;

/**
 * The one signal that is bad news regardless of what you sell: the tax office publicly lists
 * this firm as an unreliable VAT payer. Not a criterion, because nobody's ideal client is
 * defined by it — a flat deduction instead.
 */
const UNRELIABLE_PENALTY = 25;

/**
 * What an unanswerable criterion is worth. Half a point, deliberately between the two certainties.
 *
 * Our sources know disjoint things: OpenStreetMap has the phone numbers but no founding dates,
 * ARES has the founding dates but no phone numbers. Scoring a missing answer as a miss punished
 * a firm for which source found it — an accountant hunting new firms saw every OSM row at 50/100
 * and never once got the "call this one first" highlight, because the ceiling was unreachable.
 *
 * Scoring it as a match would be worse: ignorance would outrank knowledge, and a row we know
 * nothing about would tie with a row we verified. Half-credit orders the three cases the only
 * way that makes sense — confirmed match > unknown > confirmed miss — and keeps 100 reachable
 * for a firm that genuinely ticks every box.
 */
const UNKNOWN_CREDIT = 0.5;

export type ScoreInput = FilterableLead;

export interface ScoreBreakdown {
  score: number;
  /** The user's criteria this firm meets, in the order they were chosen. */
  matched: LeadFilter[];
  /** Criteria the firm demonstrably fails. Excludes the unanswerable ones. */
  missed: LeadFilter[];
  /** Criteria we had no data to judge. Never presented as either a match or a miss. */
  unanswered: LeadFilter[];
  /** How many criteria were actually scored — after unknown ids were dropped. */
  total: number;
  unreliable: boolean;
}

/**
 * Unknown ids are dropped rather than rejected, so a criterion removed in a later release
 * degrades a stale profile instead of breaking it. If nothing survives, fall back to the
 * default so a user never ends up with every row scored zero.
 */
function criteriaFor(criteria?: readonly string[] | null): LeadFilter[] {
  const chosen = criteria?.length ? resolveFilters([...criteria]) : [];
  return chosen.length > 0 ? chosen : resolveFilters([...DEFAULT_CRITERIA]);
}

export function scoreBreakdown(
  input: FilterableLead,
  criteria?: readonly string[] | null,
): ScoreBreakdown {
  const active = criteriaFor(criteria);
  const matched: LeadFilter[] = [];
  const missed: LeadFilter[] = [];
  const unanswered: LeadFilter[] = [];

  let credit = 0;
  for (const filter of active) {
    if (filter.unknown?.(input)) {
      unanswered.push(filter);
      credit += UNKNOWN_CREDIT;
    } else if (filter.test(input)) {
      matched.push(filter);
      credit += 1;
    } else {
      missed.push(filter);
    }
  }

  const unreliable = input.vatUnreliable === true;
  const share = active.length > 0 ? credit / active.length : 0;
  const raw = share * 100 - (unreliable ? UNRELIABLE_PENALTY : 0);

  return {
    score: Math.max(0, Math.min(100, Math.round(raw))),
    matched,
    missed,
    unanswered,
    total: active.length,
    unreliable,
  };
}

export function leadScore(input: FilterableLead, criteria?: readonly string[] | null): number {
  return scoreBreakdown(input, criteria).score;
}
