import { site } from '@/site';

import { maybeHandleAuthRuntimeDiagnosticsRequest } from './auth-runtime-diagnostics';
import { createServerWorker } from './create-server-worker';

type PublicWebEnv = Record<string, unknown> & {
  NEXT_PUBLIC_APP_URL?: string;
  REMOVER_CLEANUP_SECRET?: string;
};

const publicWebWorker = createServerWorker<PublicWebEnv>(
  () =>
    import('../../.open-next/server-functions/default/handler.mjs') as Promise<{
      handler: (
        request: Request,
        env: PublicWebEnv,
        ctx: ExecutionContext,
        signal?: AbortSignal
      ) => Promise<Response> | Response;
    }>,
  {
    beforeFetch(request) {
      return maybeHandleAuthRuntimeDiagnosticsRequest({
        request,
        workerTarget: 'public-web',
        role: 'auth-ui',
      });
    },
  }
);

function getStringBinding(env: PublicWebEnv, key: keyof PublicWebEnv) {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

// Each remover product owns its own cleanup route and guards it with a site
// check, so a shared path would 404 on every site but one.
const CLEANUP_PATH_BY_SITE_KEY: Record<string, string> = {
  'ai-remover': '/api/remover/cleanup',
  'background-remover': '/api/background-remover/cleanup',
};

function resolveCleanupPath(siteKey: string) {
  const cleanupPath = CLEANUP_PATH_BY_SITE_KEY[siteKey];
  if (!cleanupPath) {
    throw new Error(
      `[remover-cleanup] no cleanup route is mapped for site "${siteKey}"`
    );
  }

  return cleanupPath;
}

const serverPublicWebWorker = {
  fetch: publicWebWorker.fetch,
  async scheduled(
    _controller: unknown,
    env: PublicWebEnv,
    ctx: ExecutionContext
  ) {
    const cleanupSecret = getStringBinding(env, 'REMOVER_CLEANUP_SECRET');
    if (!cleanupSecret) {
      throw new Error(
        '[remover-cleanup] REMOVER_CLEANUP_SECRET is not configured'
      );
    }

    const appUrl = getStringBinding(env, 'NEXT_PUBLIC_APP_URL');
    if (!appUrl) {
      throw new Error(
        '[remover-cleanup] NEXT_PUBLIC_APP_URL is not configured'
      );
    }

    const siteKey: string = site.key;
    const cleanupPath = resolveCleanupPath(siteKey);
    const cleanupUrl = new URL(cleanupPath, appUrl);
    const response = await publicWebWorker.fetch(
      new Request(cleanupUrl.toString(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanupSecret}`,
        },
      }),
      env,
      ctx
    );

    if (!response.ok) {
      // A cron has no caller to report to, so name the target explicitly here.
      console.error('[remover-cleanup] scheduled cleanup failed', {
        siteKey,
        cleanupPath,
        status: response.status,
      });
      throw new Error(
        `[remover-cleanup] scheduled cleanup failed with status ${response.status}`
      );
    }
  },
};

export default serverPublicWebWorker;
