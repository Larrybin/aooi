import type { ReactNode } from 'react';

import { defaultTheme } from '@/config/theme';
import { logger } from '@/shared/lib/logger.server';

import { getActiveTheme, type ThemeName } from './active-theme';

type ThemeLandingPageName = 'landing' | 'pricing';
type ThemeLandingLayoutName = 'landing' | 'landing-marketing';

type AnyComponent<
  Props extends Record<string, unknown> = Record<string, unknown>,
> = (props: Props) => ReactNode | Promise<ReactNode>;
type Loader = () => Promise<unknown>;

function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function getOwnLoader(record: object, key: string): Loader | undefined {
  if (!hasOwn(record, key)) {
    return;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'function' ? (value as Loader) : undefined;
}

const themeLandingPages: Record<
  ThemeName,
  Record<ThemeLandingPageName, Loader>
> = {
  default: {
    landing: () => import('@/themes/default/pages/landing'),
    pricing: () => import('@/themes/default/pages/pricing'),
  },
};

const themeLandingLayouts: Record<
  ThemeName,
  Record<ThemeLandingLayoutName, Loader>
> = {
  default: {
    landing: () => import('@/themes/default/layouts/landing'),
    'landing-marketing': () =>
      import('@/themes/default/layouts/landing-marketing'),
  },
};

async function loadLandingThemeEntry({
  kind,
  name,
  theme,
  registry,
  logKey,
}: {
  kind: 'page' | 'layout';
  name: string;
  theme?: string;
  registry: Record<ThemeName, object>;
  logKey: string;
}): Promise<AnyComponent> {
  const activeTheme = theme || getActiveTheme();
  const loadTheme: ThemeName = hasOwn(registry, activeTheme)
    ? (activeTheme as ThemeName)
    : defaultTheme;

  if (loadTheme !== activeTheme) {
    logger.warn('theme: unknown theme, fallback to default', {
      requestedTheme: activeTheme,
      fallbackTheme: loadTheme,
      [logKey]: name,
    });
  }

  const loader =
    getOwnLoader(registry[loadTheme], name) ??
    getOwnLoader(registry[defaultTheme as ThemeName], name);

  if (!loader) {
    logger.error(`theme: unknown landing ${kind}`, {
      [logKey]: name,
      theme: loadTheme,
      fallbackTheme: defaultTheme,
    });
    throw new Error(`Unknown theme landing ${kind}: ${name}`);
  }

  const themeModule = (await loader()) as { default?: unknown };
  if (typeof themeModule.default !== 'function') {
    throw new Error(`Invalid theme landing ${kind} module: ${name}`);
  }

  return themeModule.default as AnyComponent;
}

/**
 * load theme page (landing group only)
 */
export async function getThemePage(
  pageName: ThemeLandingPageName,
  theme?: string
) {
  return await loadLandingThemeEntry({
    kind: 'page',
    name: pageName,
    theme,
    registry: themeLandingPages,
    logKey: 'pageName',
  });
}

/**
 * load theme layout (landing group only)
 */
export async function getThemeLayout(
  layoutName: ThemeLandingLayoutName,
  theme?: string
): Promise<AnyComponent> {
  return await loadLandingThemeEntry({
    kind: 'layout',
    name: layoutName,
    theme,
    registry: themeLandingLayouts,
    logKey: 'layoutName',
  });
}
