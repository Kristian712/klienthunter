import { localized } from '@/lib/lead-filters';
import { HOSTING_UNVERIFIED, LEGAL_UPDATED, OPERATOR, OPERATOR_INCOMPLETE, type LegalBlock } from '@/lib/legal';

/**
 * Renders a legal document from data, so the Czech, Slovak and English versions cannot drift
 * apart the way they did when each page hand-wrote `isCs ? '…' : '…'` — which silently served
 * Czech to every Slovak visitor and had no third branch at all.
 *
 * The warning strip at the top is deliberate. If the operator is not fully identified or the
 * hosting facts are not verified (see `OPERATOR` and `HOSTING` in lib/legal.ts), the page says so
 * out loud instead of quietly shipping a document that looks complete. The wording is for
 * visitors, not a to-do note for the developer: they are the ones who read it.
 */

const T = {
  updated: { cs: 'Naposledy upraveno', sk: 'Naposledy upravené', en: 'Last updated' },
  warning: {
    cs: 'Některé údaje v tomto dokumentu se ještě doplňují. Než službu začnete platit, ověřte si prosím aktuální znění, případně se zeptejte na uvedeném e-mailu.',
    sk: 'Niektoré údaje v tomto dokumente sa ešte dopĺňajú. Kým začnete za službu platiť, overte si prosím aktuálne znenie, prípadne sa opýtajte na uvedenom e-maile.',
    en: 'Some details in this document are still being completed. Before you start paying for the service, please check the current version or ask at the e-mail address given.',
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

      {(OPERATOR_INCOMPLETE || HOSTING_UNVERIFIED) && (
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
                    <span className="mt-2 h-px w-3 shrink-0 bg-ink-faint" aria-hidden />
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
        {OPERATOR.ico && ` · IČO ${OPERATOR.ico}`}
        {OPERATOR.address && ` · ${OPERATOR.address}`}
        {' · '}
        <a href={`mailto:${OPERATOR.email}`} className="text-accent underline underline-offset-2 decoration-accent/40 hover:decoration-accent transition-colors">
          {OPERATOR.email}
        </a>
      </p>
    </div>
  );
}
