import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/infra/platform/auth';
import {
  normalizeAuthSpikeRedirectLocationValue,
  resolveAuthSpikeRedirectRequestUrl,
  toRelativeSameOriginAuthSpikeRedirectLocationValue,
} from '@/infra/platform/auth/auth-spike-redirect';
import { isAuthSpikeOAuthUpstreamMockEnabled } from '@/infra/platform/auth/oauth-spike-config';
import { getAuthOriginDebug } from '@/infra/platform/auth/config';
import { setResponseHeader } from '@/shared/lib/api/response-headers';
import { getRuntimeEnvString } from '@/infra/runtime/env.server';

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

  const runtimeBaseUrl = getAuthOriginDebug(request).runtimeBaseUrl;
  const requestUrlForNormalization = resolveAuthSpikeRedirectRequestUrl(request, {
    runtimeBaseUrl,
  });
  const normalizedLocation = normalizeAuthSpikeRedirectLocationValue(
    location,
    requestUrlForNormalization
  );
  const rewrittenLocation =
    normalizedLocation &&
    toRelativeSameOriginAuthSpikeRedirectLocationValue(
      normalizedLocation,
      requestUrlForNormalization
    );
  if (getRuntimeEnvString('CF_LOCAL_AUTH_DEBUG') === 'true') {
    process.stderr.write(
      `[auth-redirect-debug] ${JSON.stringify({
        requestUrl: request.url,
        requestUrlForNormalization,
        runtimeBaseUrl,
        rawLocation: location,
        normalizedLocation,
        rewrittenLocation,
      })}\n`
    );
  }
  const finalLocation = rewrittenLocation || normalizedLocation;
  if (!finalLocation || finalLocation === location) {
    return response;
  }

  return setResponseHeader(response, 'Location', finalLocation);
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
