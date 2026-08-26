import { localized } from '@/lib/lead-filters';
import { LEGAL_UPDATED, OPERATOR, OPERATOR_INCOMPLETE, type LegalBlock } from '@/lib/legal';

/**
 * Renders a legal document from data, so the Czech, Slovak and English versions cannot drift
 * apart the way they did when each page hand-wrote `isCs ? '…' : '…'` — which silently served
 * Czech to every Slovak visitor and had no third branch at all.
 *
 * The warning strip at the top is deliberate. If the operator is not yet identified (see
 * `OPERATOR` in lib/legal.ts), the page says so out loud instead of quietly shipping a privacy
 * policy that names nobody. An unfinished document that admits it is unfinished is honest; one
 * that looks complete is a trap for whoever reads it.
 */

const T = {
  updated: { cs: 'Naposledy upraveno', sk: 'Naposledy upravené', en: 'Last updated' },
  warning: {
    cs: 'Tento dokument zatím neuvádí sídlo ani IČO provozovatele. Než službu spustíš pro veřejnost, doplň je — bez nich není správce údajů řádně identifikovaný.',
    sk: 'Tento dokument zatiaľ neuvádza sídlo ani IČO prevádzkovateľa. Kým službu spustíš pre verejnosť, doplň ich — bez nich nie je správca údajov riadne identifikovaný.',
    en: 'This document does not yet state the operator’s registered address or company number. Fill them in before launching publicly — without them the data controller is not properly identified.',
  },
};

export function LegalDocument({
  title,
  intro,
  blocks,
  locale,
}: {
  title: { cs: string; sk?: string; en: string };
  intro?: { cs: string; sk?: string; en: string };
  blocks: LegalBlock[];
  locale: string;
}) {
  const t = (x: { cs: string; sk?: string; en: string }) => localized(x, locale);

  return (
    <div className="max-w-3xl mx-auto px-5 py-16 pt-28">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{t(title)}</h1>

      <p className="mt-3 text-sm text-ink-faint">
        {t(T.updated)}: {LEGAL_UPDATED}
      </p>

      {OPERATOR_INCOMPLETE && (
        <p className="mt-6 border border-line border-l-2 border-l-ink px-4 py-3 text-sm text-ink-muted">
          {t(T.warning)}
        </p>
      )}

      {intro && <p className="mt-8 text-ink-muted leading-relaxed">{t(intro)}</p>}

      <div className="mt-10 space-y-9">
        {blocks.map((block, i) => (
          <section key={i}>
            <h2 className="text-base font-semibold text-ink">
              {i + 1}. {t(block.heading)}
            </h2>
            {block.body?.map((p, j) => (
              <p key={j} className="mt-3 text-ink-muted leading-relaxed">
                {t(p)}
              </p>
            ))}
            {block.bullets && (
              <ul className="mt-3 space-y-1.5">
                {block.bullets.map((b, j) => (
                  <li key={j} className="flex gap-2.5 text-ink-muted leading-relaxed">
                    <span className="mt-2 h-px w-3 shrink-0 bg-line" aria-hidden />
                    <span>{t(b)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="mt-14 border-t border-line pt-6 text-sm text-ink-faint">
        {OPERATOR.name}
        {OPERATOR.address && ` · ${OPERATOR.address}`}
        {OPERATOR.ico && ` · IČO ${OPERATOR.ico}`}
        {' · '}
        <a href={`mailto:${OPERATOR.email}`} className="text-ink underline underline-offset-2 hover:text-accent transition-colors">
          {OPERATOR.email}
        </a>
      </p>
    </div>
  );
}
