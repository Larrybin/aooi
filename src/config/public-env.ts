import { readPublicAssetPath } from './public-asset-path';

export type PublicEnvConfigs = {
  app_url: string;
  app_name: string;
  app_logo: string;
  app_favicon: string;
  app_og_image: string;
  theme: string;
  locale: string;
};

export const DEFAULT_APP_URL = 'http://localhost:3000';

export const DEFAULT_PUBLIC_ENV_CONFIGS: Readonly<PublicEnvConfigs> =
  Object.freeze({
    app_url: DEFAULT_APP_URL,
    app_name: 'Roller Rabbit',
    app_logo: '/logo.png',
    app_favicon: '/favicon.ico',
    app_og_image: '/logo.png',
    theme: 'default',
    locale: 'en',
  });

type ResolvePublicEnvConfigsOptions = {
  nextPublicAppUrl?: string | null;
  nextPublicAppName?: string | null;
  nextPublicAppLogo?: string | null;
  nextPublicAppFavicon?: string | null;
  nextPublicAppPreviewImage?: string | null;
  nextPublicAppOgImage?: string | null;
  nextPublicTheme?: string | null;
  nextPublicDefaultLocale?: string | null;
  nodeEnv?: string | null;
  buildTime?: boolean;
  browserOrigin?: string | null;
};

export function isBuildTimeEnv(
  env?: Partial<Pick<NodeJS.ProcessEnv, 'npm_lifecycle_event' | 'NEXT_PHASE'>>
): boolean {
  const runtimeEnv = env ?? process.env;
  const lifecycleEvent = runtimeEnv.npm_lifecycle_event;
  if (lifecycleEvent?.startsWith('build')) return true;

  const nextPhase = runtimeEnv.NEXT_PHASE;
  if (nextPhase?.includes('build')) return true;

  return false;
}

export function normalizeAppUrl(value: string): string {
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

export function readBrowserOrigin(): string | null {
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
}: {
  rawAppUrl?: string | null;
  nodeEnv?: string | null;
  buildTime?: boolean;
  browserOrigin?: string | null;
} = {}): string {
  const effectiveNodeEnv = nodeEnv ?? process.env.NODE_ENV;
  const effectiveBuildTime = buildTime ?? isBuildTimeEnv();

  if (rawAppUrl && rawAppUrl.trim()) {
    return normalizeAppUrl(rawAppUrl);
  }

  if (browserOrigin && browserOrigin.trim()) {
    return normalizeAppUrl(browserOrigin);
  }

  if (effectiveNodeEnv === 'production' && !effectiveBuildTime) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL is required in production; refusing to fall back to localhost.'
    );
  }

  return DEFAULT_APP_URL;
}

export function resolvePublicEnvConfigs(
  options: ResolvePublicEnvConfigsOptions = {}
): PublicEnvConfigs {
  return {
    app_url: resolveAppUrl({
      rawAppUrl: options.nextPublicAppUrl,
      nodeEnv: options.nodeEnv,
      buildTime: options.buildTime,
      browserOrigin: options.browserOrigin,
    }),
    app_name:
      options.nextPublicAppName?.trim() || DEFAULT_PUBLIC_ENV_CONFIGS.app_name,
    app_logo: readPublicAssetPath(
      options.nextPublicAppLogo ?? undefined,
      DEFAULT_PUBLIC_ENV_CONFIGS.app_logo,
      'NEXT_PUBLIC_APP_LOGO'
    ),
    app_favicon: readPublicAssetPath(
      options.nextPublicAppFavicon ?? undefined,
      DEFAULT_PUBLIC_ENV_CONFIGS.app_favicon,
      'NEXT_PUBLIC_APP_FAVICON'
    ),
    app_og_image: readPublicAssetPath(
      options.nextPublicAppPreviewImage ??
        options.nextPublicAppOgImage ??
        undefined,
      DEFAULT_PUBLIC_ENV_CONFIGS.app_og_image,
      'NEXT_PUBLIC_APP_PREVIEW_IMAGE'
    ),
    theme: options.nextPublicTheme?.trim() || DEFAULT_PUBLIC_ENV_CONFIGS.theme,
    locale:
      options.nextPublicDefaultLocale?.trim() ||
      DEFAULT_PUBLIC_ENV_CONFIGS.locale,
  };
}
