import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

const intlMiddleware = createMiddleware({
  locales: ['cs', 'en'],
  defaultLocale: 'cs',
  localePrefix: 'always',
});

const protectedPaths = ['/dashboard', '/search', '/saved'];
const adminPaths = ['/admin'];

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathnameWithoutLocale = pathname.replace(/^\/(cs|en)/, '');
  const locale = pathname.split('/')[1] || 'cs';

  const isProtected = protectedPaths.some(p => pathnameWithoutLocale.startsWith(p));
  const isAdmin = adminPaths.some(p => pathnameWithoutLocale.startsWith(p));

  if (isProtected || isAdmin) {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
    }
    try {
      const payload = verifyToken(token);
      if (isAdmin && !payload.isAdmin) {
        return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
      }
    } catch {
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
