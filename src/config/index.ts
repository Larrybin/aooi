import { readPublicAssetPath } from './public-asset-path';

export type ConfigMap = Record<string, string>;

const DEFAULT_APP_URL = 'http://localhost:3000';

type ResolveAppUrlOptions = {
  rawAppUrl?: string | null;
  nodeEnv?: string | null;
  buildTime?: boolean;
  browserOrigin?: string | null;
};

function isBuildTime(): boolean {
  const lifecycleEvent = process.env.npm_lifecycle_event;
  if (lifecycleEvent?.startsWith('build')) return true;

  const nextPhase = process.env.NEXT_PHASE;
  if (nextPhase?.includes('build')) return true;

  return false;
}

function normalizeAppUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('NEXT_PUBLIC_APP_URL must not be empty');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch (error: unknown) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must be a valid URL (got: ${trimmed}, error: ${String(error)})`
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must use http/https (got: ${trimmed})`
    );
  }

  return url.origin;
}

function readBrowserOrigin(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.location.origin;
}

export function resolveAppUrl({
  rawAppUrl,
  nodeEnv,
  buildTime,
  browserOrigin,
}: ResolveAppUrlOptions = {}): string {
  if (rawAppUrl && rawAppUrl.trim()) {
    return normalizeAppUrl(rawAppUrl);
  }

  if (browserOrigin && browserOrigin.trim()) {
    return normalizeAppUrl(browserOrigin);
  }

  if ((nodeEnv ?? process.env.NODE_ENV) === 'production' && !buildTime) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is required in production; refusing to fall back to localhost.'
    );
  }

  return DEFAULT_APP_URL;
}

function readAppUrl(): string {
  return resolveAppUrl({
    rawAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
    buildTime: isBuildTime(),
    browserOrigin: readBrowserOrigin(),
  });
}

export const envConfigs = {
  app_url: readAppUrl(),
  app_name: process.env.NEXT_PUBLIC_APP_NAME ?? 'Roller Rabbit',
  app_logo: readPublicAssetPath(
    process.env.NEXT_PUBLIC_APP_LOGO,
    '/logo.png',
    'NEXT_PUBLIC_APP_LOGO'
  ),
  app_favicon: readPublicAssetPath(
    process.env.NEXT_PUBLIC_APP_FAVICON,
    '/favicon.ico',
    'NEXT_PUBLIC_APP_FAVICON'
  ),
  app_og_image: readPublicAssetPath(
    process.env.NEXT_PUBLIC_APP_PREVIEW_IMAGE ??
      process.env.NEXT_PUBLIC_APP_OG_IMAGE,
    '/logo.png',
    'NEXT_PUBLIC_APP_PREVIEW_IMAGE'
  ),
  theme: process.env.NEXT_PUBLIC_THEME ?? 'default',
  locale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'en',
};
