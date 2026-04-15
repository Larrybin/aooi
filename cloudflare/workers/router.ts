import {
  CLOUDFLARE_LOCAL_WORKER_URL_VARS,
  buildVersionOverridesHeader,
  CLOUDFLARE_SERVICE_BINDINGS,
  type CloudflareServerWorkerTarget,
  resolveWorkerTarget,
} from '../../src/shared/config/cloudflare-worker-splits';

type WorkerServiceBinding = {
  fetch(
    request: Request,
    init?: RequestInit & { cf?: Record<string, unknown> }
  ): Promise<Response>;
};

type RouterEnv = Record<string, string | WorkerServiceBinding> & {
  PUBLIC_WEB_WORKER: WorkerServiceBinding;
  AUTH_WORKER: WorkerServiceBinding;
  PAYMENT_WORKER: WorkerServiceBinding;
  ADMIN_WORKER: WorkerServiceBinding;
  MEMBER_WORKER: WorkerServiceBinding;
  CHAT_WORKER: WorkerServiceBinding;
};

type RouterRuntime = {
  handleCdnCgiImageRequest: (
    url: URL,
    env: RouterEnv
  ) => Promise<Response> | Response;
  handleImageRequest: (
    url: URL,
    headers: Headers,
    env: RouterEnv
  ) => Promise<Response> | Response;
  runWithCloudflareRequestContext: <T>(
    request: Request,
    env: RouterEnv,
    ctx: ExecutionContext,
    callback: () => Promise<T> | T
  ) => Promise<T>;
  middlewareHandler: (
    request: Request,
    env: RouterEnv,
    ctx: ExecutionContext
  ) => Promise<Request | Response>;
};

let routerRuntimePromise: Promise<RouterRuntime> | undefined;

function normalizeForwardedUrl(
  originalRequest: Request,
  middlewareRequest: Request,
  env: RouterEnv,
  workerTarget: CloudflareServerWorkerTarget
): string {
  const originalUrl = new URL(originalRequest.url);
  const middlewareUrl = new URL(middlewareRequest.url);
  const forwardedUrl = new URL(middlewareUrl.toString());
  const localWorkerUrl = env[CLOUDFLARE_LOCAL_WORKER_URL_VARS[workerTarget]];
  if (typeof localWorkerUrl === 'string' && localWorkerUrl.trim()) {
    const targetUrl = new URL(localWorkerUrl);
    forwardedUrl.protocol = targetUrl.protocol;
    forwardedUrl.host = targetUrl.host;
  } else {
    forwardedUrl.protocol = originalUrl.protocol;
    forwardedUrl.host = originalUrl.host;
  }

  return forwardedUrl.toString();
}

function buildForwardedHeaders(
  originalRequest: Request,
  middlewareRequest: Request,
  env: RouterEnv
): Headers {
  const headers = new Headers(middlewareRequest.headers);
  const originalUrl = new URL(originalRequest.url);
  const originalOrigin =
    originalRequest.headers.get('origin') || originalUrl.origin;
  const forwardedHost =
    originalRequest.headers.get('x-forwarded-host') ||
    originalRequest.headers.get('host') ||
    originalUrl.host;
  const forwardedProto =
    originalRequest.headers.get('x-forwarded-proto') ||
    originalUrl.protocol.replace(/:$/, '');

  headers.set('origin', originalOrigin);
  headers.set('x-forwarded-host', forwardedHost);
  headers.set('x-forwarded-proto', forwardedProto);

  const versionOverrides = buildVersionOverridesHeader(
    Object.fromEntries(
      Object.entries(env).filter(
        ([, value]) => typeof value === 'string'
      ) as Array<[string, string]>
    )
  );
  if (versionOverrides) {
    headers.set('Cloudflare-Workers-Version-Overrides', versionOverrides);
  }

  return headers;
}

export function buildForwardedWorkerRequest(
  originalRequest: Request,
  middlewareRequest: Request,
  env: RouterEnv,
  workerTarget: CloudflareServerWorkerTarget
): Request {
  const forwardedUrl = normalizeForwardedUrl(
    originalRequest,
    middlewareRequest,
    env,
    workerTarget
  );
  const normalizedRequest = new Request(forwardedUrl, middlewareRequest);
  const headers = buildForwardedHeaders(originalRequest, middlewareRequest, env);

  return new Request(normalizedRequest, { headers });
}

function loadRouterRuntime(): Promise<RouterRuntime> {
  routerRuntimePromise ??= Promise.all([
    // @ts-ignore OpenNext generates this module after Next build.
    import('../../.open-next/cloudflare/images.js'),
    // @ts-ignore OpenNext generates this module after Next build.
    import('../../.open-next/cloudflare/init.js'),
    // @ts-ignore OpenNext generates this module after Next build.
    import('../../.open-next/middleware/handler.mjs'),
  ]).then(([imagesModule, initModule, middlewareModule]) => ({
    handleCdnCgiImageRequest: imagesModule.handleCdnCgiImageRequest,
    handleImageRequest: imagesModule.handleImageRequest,
    runWithCloudflareRequestContext: initModule.runWithCloudflareRequestContext,
    middlewareHandler: middlewareModule.handler,
  }));

  return routerRuntimePromise;
}

export default {
  async fetch(request: Request, env: RouterEnv, ctx: ExecutionContext) {
    const {
      handleCdnCgiImageRequest,
      handleImageRequest,
      runWithCloudflareRequestContext,
      middlewareHandler,
    } = await loadRouterRuntime();

    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      const url = new URL(request.url);

      if (url.pathname.startsWith('/cdn-cgi/image/')) {
        return handleCdnCgiImageRequest(url, env);
      }

      if (
        url.pathname ===
        `${globalThis.__NEXT_BASE_PATH__}/_next/image${
          globalThis.__TRAILING_SLASH__ ? '/' : ''
        }`
      ) {
        return handleImageRequest(url, request.headers, env);
      }

      const reqOrResp = await middlewareHandler(request, env, ctx);
      if (reqOrResp instanceof Response) {
        return reqOrResp;
      }

      const workerTarget = resolveWorkerTarget(new URL(reqOrResp.url).pathname);
      const serviceBindingName = CLOUDFLARE_SERVICE_BINDINGS[workerTarget];
      const serviceBinding = env[serviceBindingName];
      if (!serviceBinding) {
        throw new Error(
          `Missing Cloudflare service binding for ${workerTarget} (${serviceBindingName})`
        );
      }

      const forwardedRequest = buildForwardedWorkerRequest(
        request,
        reqOrResp,
        env,
        workerTarget
      );
      return serviceBinding.fetch(forwardedRequest, {
        redirect: 'manual',
        cf: {
          cacheEverything: false,
        },
      });
    });
  },
};
