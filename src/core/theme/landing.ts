import type { ReactNode } from 'react';

import { defaultTheme } from '@/config/theme';
import { logger } from '@/shared/lib/logger.server';

import { getActiveTheme, type ThemeName } from './active-theme';

type ThemeLandingPageName = 'landing' | 'pricing' | 'showcases';
type ThemeLandingLayoutName = 'landing' | 'landing-marketing';

type AnyComponent<Props extends Record<string, unknown> = Record<string, unknown>> =
  (props: Props) => ReactNode | Promise<ReactNode>;
type Loader = () => Promise<unknown>;

const themeLandingPages: Record<ThemeName, Record<ThemeLandingPageName, Loader>> =
  {
    default: {
      landing: () => import('@/themes/default/pages/landing'),
      pricing: () => import('@/themes/default/pages/pricing'),
      showcases: () => import('@/themes/default/pages/showcases'),
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

/**
 * load theme page (landing group only)
 */
export async function getThemePage(
  pageName: ThemeLandingPageName,
  theme?: string
) {
  const activeTheme = theme || getActiveTheme();
  const loadTheme: ThemeName =
    activeTheme in themeLandingPages ? (activeTheme as ThemeName) : defaultTheme;

  if (loadTheme !== activeTheme) {
    logger.warn('theme: unknown theme, fallback to default', {
      requestedTheme: activeTheme,
      fallbackTheme: loadTheme,
      pageName,
    });
  }

  const loader =
    themeLandingPages[loadTheme]?.[pageName] ??
    themeLandingPages[defaultTheme as ThemeName]?.[pageName];

  if (!loader) {
    logger.error('theme: unknown landing page', {
      pageName,
      theme: loadTheme,
      fallbackTheme: defaultTheme,
    });
    throw new Error(`Unknown theme landing page: ${pageName}`);
  }

  const themeModule = (await loader()) as { default?: unknown };
  if (typeof themeModule.default !== 'function') {
    throw new Error(`Invalid theme landing page module: ${pageName}`);
  }
  return themeModule.default as AnyComponent;
}

/**
 * load theme layout (landing group only)
 */
export async function getThemeLayout(
  layoutName: ThemeLandingLayoutName,
  theme?: string
): Promise<AnyComponent> {
  const activeTheme = theme || getActiveTheme();
  const loadTheme: ThemeName =
    activeTheme in themeLandingLayouts
      ? (activeTheme as ThemeName)
      : defaultTheme;

  if (loadTheme !== activeTheme) {
    logger.warn('theme: unknown theme, fallback to default', {
      requestedTheme: activeTheme,
      fallbackTheme: loadTheme,
      layoutName,
    });
  }

  const loader =
    themeLandingLayouts[loadTheme]?.[layoutName] ??
    themeLandingLayouts[defaultTheme as ThemeName]?.[layoutName];

  if (!loader) {
    logger.error('theme: unknown landing layout', {
      layoutName,
      theme: loadTheme,
      fallbackTheme: defaultTheme,
    });
    throw new Error(`Unknown theme landing layout: ${layoutName}`);
  }

  const themeModule = (await loader()) as { default?: unknown };
  if (typeof themeModule.default !== 'function') {
    throw new Error(`Invalid theme landing layout module: ${layoutName}`);
  }
  return themeModule.default as AnyComponent;
}

