import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const LOCALES = ['cs', 'en', 'sk'] as const;
type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = 'cs';

/** Kde si pamatujeme volbu jazyka. Zapisuje ji jedině přepínač v liště, viz `Navbar.tsx`. */
const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * Jazyk určuje adresa, a když ta ho neuvádí, volba uživatele. Nikdy prohlížeč.
 *
 * `localeDetection` je u next-intl ve výchozím stavu zapnuté a bylo to zapnuté i tady, protože
 * se ta volba nikdy nevyplnila. Znamenalo to dvě věci: holá doména poslala každého, kdo má
 * v prohlížeči slovenštinu, na `/sk` — a `NEXT_LOCALE` se zapisovala při každé návštěvě
 * jakékoli stránky, takže jediné omylem otevřené `/sk` přepnulo jazyk na rok dopředu.
 * Uživatel pak psal `klienthunter.vercel.app`, dostal slovenštinu a neměl jak se jí zbavit.
 *
 * Teď je detekce vypnutá a přesměrování z holé domény si obsluhujeme sami: cookie, kterou
 * zapsal přepínač, jinak čeština.
 */
const intlMiddleware = createMiddleware({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeDetection: false,
});

function chosenLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  return LOCALES.includes(saved as Locale) ? (saved as Locale) : DEFAULT_LOCALE;
}

// Only admin pages need strict middleware protection.
// Dashboard/search/profile are client components that call the API,
// which has its own auth. Middleware JWT decode was causing silent redirects.
const adminPaths = ['/admin'];

function decodeJWT(token: string): { userId?: string; isAdmin?: boolean; accessExpiresAt?: string } | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const json = atob(padded);
    const data = JSON.parse(json);
    if (!data.userId) return null;
    if (data.exp && data.exp < Date.now() / 1000) return null;
    if (data.accessExpiresAt && new Date(data.accessExpiresAt) < new Date()) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Adresa bez jazyka (typicky holá doména z adresního řádku nebo záložka). Rozhoduje volba
  // uživatele, ne hlavička `Accept-Language`.
  const firstSegment = pathname.split('/')[1];
  if (!LOCALES.includes(firstSegment as Locale)) {
    const target = new URL(`/${chosenLocale(request)}${pathname === '/' ? '' : pathname}`, request.url);
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target);
  }

  // Dřív tenhle výraz neuměl `sk`, takže pod `/sk/admin` zůstala cesta „bez locale" i s prefixem,
  // podmínka níž nesedla a admin sekce se v slovenštině nechránila vůbec.
  const pathnameWithoutLocale = pathname.replace(/^\/(cs|en|sk)/, '');
  const locale = firstSegment;

  const isAdmin = adminPaths.some(p => pathnameWithoutLocale.startsWith(p));

  if (isAdmin) {
    const token = request.cookies.get('auth-token')?.value;
    const payload = token ? decodeJWT(token) : null;
    if (!payload) {
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
    }
    if (!payload.isAdmin) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
