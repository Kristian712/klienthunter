import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['cs', 'en'],
  defaultLocale: 'cs',
  localePrefix: 'always',
});

const protectedPaths = ['/dashboard', '/search', '/saved'];
const adminPaths = ['/admin'];

// Lightweight JWT decoder for Edge Runtime (no Node.js crypto needed).
// Cryptographic verification still happens in every API route via jsonwebtoken.
function decodeJWT(token: string): { userId?: string; isAdmin?: boolean; exp?: number } | null {
  try {
    const [, payload] = token.split('.');
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const data = JSON.parse(json);
    if (!data.userId) return null;
    if (data.exp && data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathnameWithoutLocale = pathname.replace(/^\/(cs|en)/, '');
  const locale = pathname.split('/')[1] || 'cs';

  const isProtected = protectedPaths.some(p => pathnameWithoutLocale.startsWith(p));
  const isAdmin = adminPaths.some(p => pathnameWithoutLocale.startsWith(p));

  if (isProtected || isAdmin) {
    const token = request.cookies.get('auth-token')?.value;
    const payload = token ? decodeJWT(token) : null;

    if (!payload) {
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
    }
    if (isAdmin && !payload.isAdmin) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
