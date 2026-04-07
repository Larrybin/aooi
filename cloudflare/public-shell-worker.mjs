import {
  handleCdnCgiImageRequest,
  handleImageRequest,
} from '../.open-next/cloudflare/images.js';
import { runWithCloudflareRequestContext } from '../.open-next/cloudflare/init.js';
import { maybeGetSkewProtectionResponse } from '../.open-next/cloudflare/skew-protection.js';
import { handler as middlewareHandler } from '../.open-next/middleware/handler.mjs';

export { DOQueueHandler } from '../.open-next/.build/durable-objects/queue.js';
export { DOShardedTagCache } from '../.open-next/.build/durable-objects/sharded-tag-cache.js';
export { BucketCachePurge } from '../.open-next/.build/durable-objects/bucket-cache-purge.js';

const IMAGE_PATH = `${globalThis.__NEXT_BASE_PATH__}/_next/image${
  globalThis.__TRAILING_SLASH__ ? '/' : ''
}`;

const localeSet = new Set([
  'en',
  'zh',
  'ar',
  'bn',
  'cs',
  'da',
  'de',
  'el',
  'es',
  'fa',
  'fi',
  'fr',
  'he',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'ms',
  'nl',
  'no',
  'pl',
  'pt',
  'pt-BR',
  'ro',
  'ru',
  'sv',
  'th',
  'tl-PH',
  'tr',
  'uk',
  'ur',
  'vi',
  'zh-TW',
]);

const publicShellPaths = new Set([
  '/',
  '/sign-in',
  '/sign-up',
  '/api/auth',
  '/api/config/get-configs',
  '/sitemap.xml',
  '/robots.txt',
]);

const localizedPublicShellPaths = new Set(['/', '/sign-in', '/sign-up']);

function splitLocalePath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return { locale: null, pathWithoutLocale: '/' };
  }

  const [maybeLocale, ...rest] = segments;
  if (!localeSet.has(maybeLocale)) {
    return { locale: null, pathWithoutLocale: pathname };
  }

  return {
    locale: maybeLocale,
    pathWithoutLocale: rest.length === 0 ? '/' : `/${rest.join('/')}`,
  };
}

function isStaticAssetPath(pathname) {
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/cdn-cgi/') ||
    pathname === '/favicon.ico'
  ) {
    return true;
  }

  const lastSegment = pathname.split('/').pop() || '';
  return lastSegment.includes('.');
}

function isPublicShellPath(pathname) {
  if (pathname === '/api/auth' || pathname.startsWith('/api/auth/')) {
    return true;
  }

  if (publicShellPaths.has(pathname)) {
    return true;
  }

  const { locale, pathWithoutLocale } = splitLocalePath(pathname);
  if (!locale) {
    return false;
  }

  return localizedPublicShellPaths.has(pathWithoutLocale);
}

function buildFallbackResponse(request, env) {
  const fallbackOrigin = env.CF_FALLBACK_ORIGIN?.trim();
  if (!fallbackOrigin) {
    return new Response('Cloudflare public shell does not serve this route.', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-cloudflare-surface': 'public-shell',
      },
    });
  }

  const sourceUrl = new URL(request.url);
  let targetUrl;

  try {
    targetUrl = new URL(fallbackOrigin);
  } catch {
    return new Response('Cloudflare fallback origin is invalid.', {
      status: 500,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-cloudflare-surface': 'public-shell-fallback-invalid-origin',
      },
    });
  }

  if (sourceUrl.origin === targetUrl.origin) {
    return new Response('Cloudflare fallback loop detected.', {
      status: 500,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-cloudflare-surface': 'public-shell-fallback-loop',
      },
    });
  }

  targetUrl.pathname = sourceUrl.pathname;
  targetUrl.search = sourceUrl.search;
  targetUrl.hash = sourceUrl.hash;

  return new Response(null, {
    status: 307,
    headers: {
      location: targetUrl.toString(),
      'x-cloudflare-surface': 'public-shell-fallback',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    return runWithCloudflareRequestContext(request, env, ctx, async () => {
      const response = maybeGetSkewProtectionResponse(request);
      if (response) {
        return response;
      }

      const url = new URL(request.url);
      if (url.pathname.startsWith('/cdn-cgi/image/')) {
        return handleCdnCgiImageRequest(url, env);
      }

      if (url.pathname === IMAGE_PATH) {
        return handleImageRequest(url, request.headers, env);
      }

      if (
        !isStaticAssetPath(url.pathname) &&
        !isPublicShellPath(url.pathname)
      ) {
        return buildFallbackResponse(request, env);
      }

      const reqOrResp = await middlewareHandler(request, env, ctx);
      if (reqOrResp instanceof Response) {
        return reqOrResp;
      }

      // Load the default server only after Cloudflare bindings have been
      // copied into process.env for this worker instance.
      const { handler: defaultHandler } = await import(
        '../.open-next/server-functions/default/handler.mjs'
      );

      return defaultHandler(reqOrResp, env, ctx, request.signal);
    });
  },
};
