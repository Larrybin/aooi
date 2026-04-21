import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createIntlMiddleware from 'next-intl/middleware';

import { routing } from '@/infra/platform/i18n/config';
import { defaultLocale, locales, type Locale } from '@/config/locale';
import { ADMIN_PATH } from '@/shared/constants/admin-entry';
import { upsertMiddlewareRequestHeader } from '@/shared/lib/middleware-request-headers';

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extract locale from pathname
  const localeSegment = pathname.split('/')[1];
  const isValidLocale = locales.includes(localeSegment as Locale);
  const pathWithoutLocale = isValidLocale
    ? pathname.slice(localeSegment.length + 1)
    : pathname;

  const isAdminPath =
    pathWithoutLocale === ADMIN_PATH ||
    pathWithoutLocale.startsWith(`${ADMIN_PATH}/`);
  const shouldRewriteDocsIndex =
    pathWithoutLocale === '/docs' || pathWithoutLocale === '/docs/';

  // Handle internationalization first
  let response = intlMiddleware(request);

  // Only check authentication for protected routes (admin/settings/activity).
  if (
    isAdminPath ||
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

  // When `localeDetection=false`, unprefixed routes (e.g. /pricing) don't carry locale information.
  // Our app routes are rooted under `app/[locale]`, so we internally rewrite to the default locale
  // while keeping the URL unchanged for the user.
  if (shouldRewriteDocsIndex) {
    const rewriteTo = request.nextUrl.clone();
    rewriteTo.pathname = isValidLocale
      ? `/${localeSegment}/docs/index`
      : `/${defaultLocale}/docs/index`;

    response = NextResponse.rewrite(rewriteTo, { headers: response.headers });
    response.headers.set('x-rewrite-to', rewriteTo.pathname);
  } else if (!isValidLocale) {
    const rewriteTo = request.nextUrl.clone();
    rewriteTo.pathname =
      pathname === '/' ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`;

    response = NextResponse.rewrite(rewriteTo, { headers: response.headers });
    response.headers.set('x-rewrite-to', rewriteTo.pathname);
  }

  response.headers.set('x-pathname', request.nextUrl.pathname);
  response.headers.set('x-url', request.url);
  upsertMiddlewareRequestHeader(response.headers, 'x-pathname', pathname);
  upsertMiddlewareRequestHeader(response.headers, 'x-url', request.url);

  // For all other routes (including /, /sign-in, /sign-up, /sign-out), just return the intl response
  return response;
}
