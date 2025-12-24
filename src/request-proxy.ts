import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/core/i18n/config';
import { defaultLocale, locales, type Locale } from '@/config/locale';
import { ADMIN_ENTRY_PATH } from '@/shared/constants/admin-entry';

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle internationalization first
  let response = intlMiddleware(request);

  // Extract locale from pathname
  const localeSegment = pathname.split('/')[1];
  const isValidLocale = locales.includes(localeSegment as Locale);
  const pathWithoutLocale = isValidLocale
    ? pathname.slice(localeSegment.length + 1)
    : pathname;

  // Only check authentication for admin routes
  if (
    pathWithoutLocale.startsWith('/admin') ||
    pathWithoutLocale.startsWith(ADMIN_ENTRY_PATH) ||
    pathWithoutLocale.startsWith('/settings') ||
    pathWithoutLocale.startsWith('/activity')
  ) {
    // Check if session cookie exists
    const sessionCookie = getSessionCookie(request);

    // If no session token found, redirect to sign-in
    if (!sessionCookie) {
      const signInUrl = new URL(
        isValidLocale ? `/${localeSegment}/sign-in` : '/sign-in',
        request.url
      );
      // Add the current path (including search params) as callback - use relative path for multi-language support
      const callbackPath = pathWithoutLocale + request.nextUrl.search;
      signInUrl.searchParams.set('callbackUrl', callbackPath);
      return NextResponse.redirect(signInUrl);
    }

    // For admin routes, we need to check RBAC permissions
    // Note: Full permission check happens in the page/API route level
    // This is a lightweight session check to prevent unauthorized access
    // The detailed permission check (admin.access and specific permissions)
    // will be done in the layout or individual pages using requirePermission()
  }

  if (
    pathWithoutLocale === ADMIN_ENTRY_PATH ||
    pathWithoutLocale.startsWith(`${ADMIN_ENTRY_PATH}/`)
  ) {
    const rewriteTo = request.nextUrl.clone();
    const suffix = pathWithoutLocale.slice(ADMIN_ENTRY_PATH.length);
    const adminPathname = `/admin${suffix}`;
    rewriteTo.pathname = isValidLocale
      ? `/${localeSegment}${adminPathname}`
      : `/${defaultLocale}${adminPathname}`;

    response = NextResponse.rewrite(rewriteTo, { headers: response.headers });
    response.headers.set('x-rewrite-to', rewriteTo.pathname);
    return response;
  }

  // When `localeDetection=false`, unprefixed routes (e.g. /pricing) don't carry locale information.
  // Our app routes are rooted under `app/[locale]`, so we internally rewrite to the default locale
  // while keeping the URL unchanged for the user.
  if (!isValidLocale) {
    const rewriteTo = request.nextUrl.clone();
    rewriteTo.pathname =
      pathname === '/' ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`;

    response = NextResponse.rewrite(rewriteTo, { headers: response.headers });
    response.headers.set('x-rewrite-to', rewriteTo.pathname);
  }

  response.headers.set('x-pathname', request.nextUrl.pathname);
  response.headers.set('x-url', request.url);

  // For all other routes (including /, /sign-in, /sign-up, /sign-out), just return the intl response
  return response;
}
