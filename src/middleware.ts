import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

const intlMiddleware = createMiddleware({
  locales: ['cs', 'en'],
  defaultLocale: 'cs',
  localePrefix: 'always',
});

const protectedPaths = ['/dashboard', '/search', '/saved'];

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathnameWithoutLocale = pathname.replace(/^\/(cs|en)/, '');

  const isProtected = protectedPaths.some((path) =>
    pathnameWithoutLocale.startsWith(path)
  );

  if (isProtected) {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      const locale = pathname.split('/')[1] || 'cs';
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
    }
    try {
      verifyToken(token);
    } catch {
      const locale = pathname.split('/')[1] || 'cs';
      return NextResponse.redirect(new URL(`/${locale}/auth/login`, request.url));
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
