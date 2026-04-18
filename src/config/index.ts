import {
  readBrowserOrigin,
  resolveAppUrl,
  resolvePublicEnvConfigs,
  isBuildTimeEnv,
} from './public-env';

export type ConfigMap = Record<string, string>;

function isBuildTime(): boolean {
  return isBuildTimeEnv();
}

function readAppUrl(): string {
  return resolveAppUrl({
    rawAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
    buildTime: isBuildTime(),
    browserOrigin: readBrowserOrigin(),
  });
}

export const envConfigs = resolvePublicEnvConfigs({
  nextPublicAppUrl: readAppUrl(),
  nextPublicAppName: process.env.NEXT_PUBLIC_APP_NAME,
  nextPublicAppLogo: process.env.NEXT_PUBLIC_APP_LOGO,
  nextPublicAppFavicon: process.env.NEXT_PUBLIC_APP_FAVICON,
  nextPublicAppPreviewImage: process.env.NEXT_PUBLIC_APP_PREVIEW_IMAGE,
  nextPublicAppOgImage: process.env.NEXT_PUBLIC_APP_OG_IMAGE,
  nextPublicTheme: process.env.NEXT_PUBLIC_THEME,
  nextPublicDefaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  nodeEnv: process.env.NODE_ENV,
  buildTime: isBuildTime(),
  browserOrigin: readBrowserOrigin(),
});
