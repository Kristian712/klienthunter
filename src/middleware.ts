import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['cs', 'en', 'sk'],
  defaultLocale: 'cs',
  localePrefix: 'always',
});

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
  const pathnameWithoutLocale = pathname.replace(/^\/(cs|en)/, '');
  const locale = pathname.split('/')[1] || 'cs';

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
