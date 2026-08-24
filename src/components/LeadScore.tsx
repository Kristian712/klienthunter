/**
 * The number the whole product is for: how good a sales opportunity this lead is.
 *
 * Rendered big and in the accent colour above the threshold, because this is the moment a user
 * grasps what the tool does — a list of firms is a list, a list ordered by opportunity is a
 * working day planned.
 */
export const GOOD_LEAD = 70;

/**
 * `title` lets the results page say what the number actually counted — "splňuje 2 ze 3
 * kritérií" is a far better hover than a bare score, and only the caller knows the criteria.
 * Without it the old wording stays, which is what the landing page wants.
 */
export function LeadScore({
  value,
  size = 'md',
  title,
}: {
  value: number;
  size?: 'md' | 'lg';
  title?: string;
}) {
  const good = value >= GOOD_LEAD;
  return (
    <div className="shrink-0 w-14 text-right" title={title ?? `Skóre příležitosti ${value} / 100`}>
      <div
        className={`tnum font-extrabold leading-none tracking-tight ${
          size === 'lg' ? 'text-[40px]' : 'text-[32px]'
        } ${good ? 'text-accent' : 'text-ink-faint'}`}
      >
        {value}
      </div>
      <div className="mt-1.5 h-[3px] w-full bg-line">
        <div
          className={`h-full ${good ? 'bg-accent' : 'bg-ink-faint'}`}
          style={{ width: `${Math.max(4, value)}%` }}
        />
      </div>
    </div>
  );
}
