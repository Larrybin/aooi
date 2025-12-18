import { NextRequest, NextResponse } from 'next/server';

import { proxy } from '@/proxy';

function getHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name);
  return value && value.trim() ? value.trim() : null;
}

function generateRequestId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getOrCreateRequestId(request: NextRequest): string {
  return (
    getHeaderValue(request.headers, 'x-request-id') ||
    getHeaderValue(request.headers, 'x-vercel-id') ||
    getHeaderValue(request.headers, 'cf-ray') ||
    generateRequestId()
  );
}

export async function middleware(request: NextRequest) {
  const requestId = getOrCreateRequestId(request);
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

  // Non-API requests: reuse existing proxy (i18n + auth gating) and add requestId.
  const proxied = await proxy(request);
  proxied.headers.set('x-request-id', requestId);
  return proxied;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next|_vercel|.*\\..*).*)',
  ],
};
