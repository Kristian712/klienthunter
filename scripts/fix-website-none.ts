/**
 * Přepíše staré verdikty „Web nemá", které stály jen na neúspěšném hádání domén z názvu, na „nevíme".
 *
 *   npx tsx scripts/fix-website-none.ts            # jen spočítá, co by se změnilo
 *   npx tsx scripts/fix-website-none.ts --apply    # opravdu přepíše
 *
 * Proč: měření na vzorku 100 firem (11.–12. 9. 2026) ukázalo, že „Web nemá" odvozené jen z toho,
 * že žádná doména z názvu firmy nesedí, je špatně zhruba v každém třetím případě — firmy mají
 * web pod značkou, která z obchodního jména nevyplývá. Nové hledání už takový verdikt nevydává
 * (viz `verifyWebsite`), ale řádky uložené dřív by lež nesly dál.
 *
 * Co se přepisuje: jen `websiteStatus = NONE`, jehož evidence začíná „prověřeno … domén" a neříká,
 * že se ptal i vyhledávač. „Web nemá" doložené vyhledávačem zůstává. Skript je idempotentní —
 * podruhé už nic nenajde — a přepočítá i uložené skóre firmy, protože „nemá web" do něj vstupovalo
 * jako splněné kritérium a „nevíme" jen jako polovina.
 */

import { prisma } from '../src/lib/db';
import { leadScore } from '../src/lib/lead-score';

const CHUNK = 500;

/** Evidence starého verdiktu → věta, která říká, co se opravdu zjistilo. */
function newEvidence(old: string): string {
  const co = old.replace(/\s*—\s*žádný web firmy jsme nenašli\s*$/, '');
  return `nedoloženo: ${co}, ale web jsme nenašli jen podle názvu — to nestačí na tvrzení, že firma web nemá`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const where = {
    websiteStatus: 'NONE',
    websiteEvidence: { startsWith: 'prověřeno ' },
    NOT: { websiteEvidence: { contains: 'vyhledávač' } },
  };

  const total = await prisma.businessResult.count({ where });
  console.log(`Řádků k přepsání: ${total}${apply ? '' : ' (bez --apply se nic nemění)'}`);
  if (!apply || total === 0) return;

  let done = 0;
  for (;;) {
    const rows = await prisma.businessResult.findMany({
      where,
      take: CHUNK,
      include: { search: { select: { user: { select: { targetFilters: true } } } } },
    });
    if (rows.length === 0) break;

    await prisma.$transaction(
      rows.map(r => {
        const next = { ...r, websiteStatus: 'UNKNOWN', hasWebsite: false };
        return prisma.businessResult.update({
          where: { id: r.id },
          data: {
            websiteStatus: 'UNKNOWN',
            hasWebsite: false,
            websiteEvidence: newEvidence(r.websiteEvidence),
            leadScore: leadScore(next, r.search.user.targetFilters),
          },
        });
      }),
    );
    done += rows.length;
    console.log(`  přepsáno ${done}/${total}`);
  }
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
