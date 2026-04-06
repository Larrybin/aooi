import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';
import { setResponseHeader } from '@/shared/lib/api/response-headers';

export const dynamic = 'force-dynamic';

function withNoStore(response: Response): Response {
  return setResponseHeader(response, 'Cache-Control', 'no-store');
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
  const response = await handler.GET(toStandardAuthRequest(request));
  return withNoStore(response);
}

export async function POST(request: Request) {
  const handler = await createHandler(request);
  const response = await handler.POST(toStandardAuthRequest(request));
  return withNoStore(response);
}
