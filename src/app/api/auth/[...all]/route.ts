import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';
import { setResponseHeader } from '@/shared/lib/api/response-headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function withNoStore(response: Response): Response {
  return setResponseHeader(response, 'Cache-Control', 'no-store');
}

async function createHandler(request: Request) {
  const auth = await getAuth(request);
  return toNextJsHandler(auth.handler);
}

export async function GET(request: Request) {
  const handler = await createHandler(request);
  const response = await handler.GET(request);
  return withNoStore(response);
}

export async function POST(request: Request) {
  const handler = await createHandler(request);
  const response = await handler.POST(request);
  return withNoStore(response);
}
