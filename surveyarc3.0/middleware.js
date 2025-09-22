import { NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';

const intlMiddleware = createIntlMiddleware({
  locales: ['en', 'hi'],
  defaultLocale: 'en',
});

export function middleware(req) {
  const { pathname } = req.nextUrl;
  const intlResponse = intlMiddleware(req);

  const locale = pathname.split('/')[1];
  const pathAfterLocale = pathname.split('/').slice(2).join('/');

  if (pathAfterLocale.startsWith('org')) {
    const currentOrgId = req.cookies.get('currentOrgId')?.value;
    const currentUserId = req.cookies.get('currentUserId')?.value;
    const subscriptionEnd = req.cookies.get('subscriptionEnd')?.value;

    if (!currentOrgId || !currentUserId) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${locale}/login`;
      return NextResponse.redirect(loginUrl);
    }

    if (subscriptionEnd) {
      const endDate = new Date(subscriptionEnd);
      const now = new Date();
      if (now > endDate) {
        const redirectUrl = req.nextUrl.clone();
        redirectUrl.pathname = `/${locale}/org/${currentOrgId}/dashboard`;
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return intlResponse;
}

export const config = {
  matcher: [
    '/((?!_next|favicon.ico|.*\\..*).*)',
  ],
};
