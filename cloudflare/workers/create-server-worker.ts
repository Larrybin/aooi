// @ts-ignore OpenNext generates this before Wrangler bundles the worker.
import { runWithCloudflareRequestContext } from '../../.open-next/cloudflare/init.js';

type CloudflareFetchHandler<Env> = (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  signal?: AbortSignal
) => Promise<Response> | Response;

type CloudflareFetchModule<Env> = {
  handler: CloudflareFetchHandler<Env>;
};

function syncWorkerStringBindingsToProcessEnv(env: unknown) {
  if (!env || typeof env !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== 'string' || value.length === 0) {
      continue;
    }

    process.env[key] = value;
  }
}

function printServerWorkerAuthDebug(request: Request) {
  if (process.env.CF_LOCAL_AUTH_DEBUG !== 'true') {
    return;
  }

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/auth/')) {
    return;
  }

  console.error('[server-worker-auth-debug] incoming request', {
    requestUrl: request.url,
    requestOrigin: request.headers.get('origin'),
    requestHost: request.headers.get('host'),
    requestForwardedHost: request.headers.get('x-forwarded-host'),
    requestForwardedProto: request.headers.get('x-forwarded-proto'),
    requestReferer: request.headers.get('referer'),
  });
}

export function createServerWorker<Env>(
  loadModule: () => Promise<CloudflareFetchModule<Env>>
) {
  let handlerPromise: Promise<CloudflareFetchHandler<Env>> | undefined;

  return {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
      syncWorkerStringBindingsToProcessEnv(env);
      printServerWorkerAuthDebug(request);
      handlerPromise ??= loadModule().then(({ handler }) => handler);

      return runWithCloudflareRequestContext(request, env, ctx, async () =>
        (await handlerPromise)(request, env, ctx, request.signal)
      );
    },
  };
}
