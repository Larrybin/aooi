import { NextResponse, type NextRequest } from 'next/server';
import { proxy } from '@/request-proxy';

import { getOrCreateRequestId } from '@/shared/lib/request-id';

export async function middleware(request: NextRequest) {
  const requestId = getOrCreateRequestId(request.headers);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  // Keep /api logic minimal: only inject requestId.
  if (request.nextUrl.pathname.startsWith('/api')) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLocaleAdminPath =
    pathname === '/en/admin' ||
    pathname.startsWith('/en/admin/') ||
    pathname === '/zh/admin' ||
    pathname.startsWith('/zh/admin/');

  if (isAdminPath || isLocaleAdminPath) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-request-id': requestId,
      },
    });
  }

  // Non-API requests: reuse existing proxy (i18n + auth gating) and add requestId.
  const proxied = await proxy(request);
  proxied.headers.set('x-request-id', requestId);
  return proxied;
}

export const config = {
  matcher: ['/api/:path*', '/((?!_next|_vercel|.*\\..*).*)'],
};
