import {
  handleCdnCgiImageRequest,
  handleImageRequest,
} from '../../.open-next/cloudflare/images.js';
import { runWithCloudflareRequestContext } from '../../.open-next/cloudflare/init.js';
import { handler as middlewareHandler } from '../../.open-next/middleware/handler.mjs';
import {
  CLOUDFLARE_SERVICE_BINDINGS,
  resolveWorkerTarget,
} from '../../src/shared/config/cloudflare-worker-splits';
import { buildForwardedWorkerRequest } from './router-forwarding';

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

const routerWorker = {
  async fetch(request: Request, env: RouterEnv, ctx: ExecutionContext) {
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

export default routerWorker;
