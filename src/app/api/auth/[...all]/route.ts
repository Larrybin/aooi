import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';
import { isAuthSpikeOAuthUpstreamMockEnabled } from '@/shared/lib/auth-spike-oauth-config';
import { setResponseHeader } from '@/shared/lib/api/response-headers';

export const dynamic = 'force-dynamic';

function withNoStore(response: Response): Response {
  return setResponseHeader(response, 'Cache-Control', 'no-store');
}

function normalizeAuthSpikeRedirectLocation(
  response: Response,
  request: Request
): Response {
  if (!isAuthSpikeOAuthUpstreamMockEnabled()) {
    return response;
  }

  const location = response.headers.get('location')?.trim();
  if (!location) {
    return response;
  }

  try {
    const requestOrigin = new URL(request.url).origin;
    const locationUrl = new URL(location, request.url);

    if (locationUrl.origin === requestOrigin) {
      return response;
    }

    const normalizedLocation = new URL(locationUrl.toString());
    normalizedLocation.protocol = new URL(requestOrigin).protocol;
    normalizedLocation.host = new URL(requestOrigin).host;

    return setResponseHeader(response, 'Location', normalizedLocation.toString());
  } catch {
    return response;
  }
}

function toStandardAuthRequest(request: Request): Request {
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: new Headers(request.headers),
  };

  if (request.method !== 'GET' && request.method !== 'HEAD' && request.body) {
    init.body = request.body;
    init.duplex = 'half';
  }

  return new Request(request.url, init);
}

async function createHandler(request: Request) {
  const auth = await getAuth(request);
  return toNextJsHandler(auth.handler);
}

export async function GET(request: Request) {
  const handler = await createHandler(request);
  const response = normalizeAuthSpikeRedirectLocation(
    await handler.GET(toStandardAuthRequest(request)),
    request
  );
  return withNoStore(response);
}

export async function POST(request: Request) {
  const handler = await createHandler(request);
  const response = normalizeAuthSpikeRedirectLocation(
    await handler.POST(toStandardAuthRequest(request)),
    request
  );
  return withNoStore(response);
}
