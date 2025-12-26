import 'server-only';

import { betterAuth } from 'better-auth';

import { getAuthOptions } from './config';

type AuthInstance = Awaited<ReturnType<typeof betterAuth>>;

const authByRequest = new WeakMap<Request, Promise<AuthInstance>>();

async function getAuthPromiseForRequest(
  request?: Request
): Promise<AuthInstance> {
  if (!request) {
    return betterAuth(await getAuthOptions());
  }

  const cached = authByRequest.get(request);
  if (cached) {
    return cached;
  }

  const promise = getAuthOptions()
    .then((options) => betterAuth(options))
    .catch((error) => {
      authByRequest.delete(request);
      throw error;
    });
  authByRequest.set(request, promise);
  return promise;
}

// Dynamic auth - with full database configuration
// Always use this in API routes that need database access
export async function getAuth(request?: Request): Promise<AuthInstance> {
  return getAuthPromiseForRequest(request);
}
