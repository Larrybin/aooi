import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';

async function createHandler(request: Request) {
  const auth = await getAuth(request);
  return toNextJsHandler(auth.handler);
}

export async function GET(request: Request) {
  const handler = await createHandler(request);
  return handler.GET(request);
}

export async function POST(request: Request) {
  const handler = await createHandler(request);
  return handler.POST(request);
}
