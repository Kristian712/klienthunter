import { NextResponse } from 'next/server';
import { metaAdsEnabled } from '@/lib/sources/meta-ads';

export const dynamic = 'force-dynamic';

/**
 * Co je v tomhle nasazení zapnuté. Veřejné a bez dat — jen aby UI umělo zamknout filtry,
 * které stojí na zdroji bez klíče, a říct proč, místo aby tiše vracely prázdno.
 */
export async function GET() {
  return NextResponse.json({ metaAds: metaAdsEnabled() });
}
