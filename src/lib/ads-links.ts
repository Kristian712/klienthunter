/**
 * Odkazy na veřejné knihovny reklam — čisté funkce bez serverových závislostí.
 *
 * Žijí zvlášť od `sources/meta-ads.ts` schválně: ten importuje Prisma, a když si z něj stránka
 * hledání (klientská komponenta) brala jediný odkaz, dostala se Prisma do jejího serverového
 * bundle. Render `/cs/search` pak na Vercelu padal na `PrismaClientInitializationError`
 * (chybí query engine) a proces končil kódem 128 — zjištěno v runtime logu 26. 9. 2026.
 */

/** Odkaz do Google Ads Transparency Center — jen podle domény, API nemá. Viz průzkum 15. 9. 2026. */
export function googleAdsTransparencyUrl(domain: string): string {
  return `https://adstransparency.google.com/?region=CZ&domain=${encodeURIComponent(domain)}`;
}
