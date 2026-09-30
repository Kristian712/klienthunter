import { NextResponse } from 'next/server';
import { metaAdsEnabled } from '@/lib/sources/meta-ads';
import { webSearchEnabled } from '@/lib/sources/web-search';

export const dynamic = 'force-dynamic';

/**
 * Co je v tomhle nasazení zapnuté. Veřejné a bez dat — jen aby UI umělo zamknout filtry,
 * které stojí na zdroji bez klíče, a říct proč, místo aby tiše vracely prázdno.
 */
export async function GET() {
  // `webSearch`: bez vyhledávače nevznikne ověřené „web nemá" a sekce „bez webu" zůstanou
  // prázdné — UI to musí říct, ne tvářit se, že firmy bez webu nejsou.
  return NextResponse.json({ metaAds: metaAdsEnabled(), webSearch: webSearchEnabled() });
}
