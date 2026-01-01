import type { ReactNode } from 'react';

import { defaultTheme } from '@/config/theme';
import { logger } from '@/shared/lib/logger.server';

import { getActiveTheme, type ThemeName } from './active-theme';

export { getActiveTheme } from './active-theme';

type ThemePageName =
  | 'landing'
  | 'pricing'
  | 'blog'
  | 'blog-detail'
  | 'page-detail';
type ThemeLayoutName = 'landing' | 'landing-marketing';
type ThemeBlockName =
  | 'header'
  | 'footer'
  | 'hero'
  | 'features'
  | 'features-list'
  | 'features-accordion'
  | 'features-step'
  | 'logos'
  | 'stats'
  | 'testimonials'
  | 'faq'
  | 'cta'
  | 'subscribe'
  | 'pricing'
  | 'blog'
  | 'blog-detail'
  | 'page-detail'
  | 'marketing-header'
  | 'marketing-footer';

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

const themePages: Record<ThemeName, Record<ThemePageName, Loader>> = {
  default: {
    landing: () => import('@/themes/default/pages/landing'),
    pricing: () => import('@/themes/default/pages/pricing'),
    blog: () => import('@/themes/default/pages/blog'),
    'blog-detail': () => import('@/themes/default/pages/blog-detail'),
    'page-detail': () => import('@/themes/default/pages/page-detail'),
  },
};

const themeLayouts: Record<ThemeName, Record<ThemeLayoutName, Loader>> = {
  default: {
    landing: () => import('@/themes/default/layouts/landing'),
    'landing-marketing': () =>
      import('@/themes/default/layouts/landing-marketing'),
  },
};

const themeBlocks: Record<ThemeName, Record<ThemeBlockName, Loader>> = {
  default: {
    header: () =>
      import('@/themes/default/blocks/header').then((mod) => ({
        default: mod.Header,
      })),
    footer: () =>
      import('@/themes/default/blocks/footer').then((mod) => ({
        default: mod.Footer,
      })),
    hero: () =>
      import('@/themes/default/blocks/hero').then((mod) => ({
        default: mod.Hero,
      })),
    features: () =>
      import('@/themes/default/blocks/features').then((mod) => ({
        default: mod.Features,
      })),
    'features-list': () =>
      import('@/themes/default/blocks/features-list').then((mod) => ({
        default: mod.FeaturesList,
      })),
    'features-accordion': () =>
      import('@/themes/default/blocks/features-accordion').then((mod) => ({
        default: mod.FeaturesAccordion,
      })),
    'features-step': () =>
      import('@/themes/default/blocks/features-step').then((mod) => ({
        default: mod.FeaturesStep,
      })),
    logos: () =>
      import('@/themes/default/blocks/logos').then((mod) => ({
        default: mod.Logos,
      })),
    stats: () =>
      import('@/themes/default/blocks/stats').then((mod) => ({
        default: mod.Stats,
      })),
    testimonials: () =>
      import('@/themes/default/blocks/testimonials').then((mod) => ({
        default: mod.Testimonials,
      })),
    faq: () =>
      import('@/themes/default/blocks/faq').then((mod) => ({
        default: mod.FAQ,
      })),
    cta: () =>
      import('@/themes/default/blocks/cta').then((mod) => ({
        default: mod.CTA,
      })),
    subscribe: () =>
      import('@/themes/default/blocks/subscribe').then((mod) => ({
        default: mod.Subscribe,
      })),
    pricing: () =>
      import('@/themes/default/blocks/pricing').then((mod) => ({
        default: mod.Pricing,
      })),
    blog: () =>
      import('@/themes/default/blocks/blog').then((mod) => ({
        default: mod.Blog,
      })),
    'blog-detail': () =>
      import('@/themes/default/blocks/blog-detail').then((mod) => ({
        default: mod.BlogDetail,
      })),
    'page-detail': () =>
      import('@/themes/default/blocks/page-detail').then((mod) => ({
        default: mod.PageDetail,
      })),
    'marketing-header': () =>
      import('@/themes/default/blocks/marketing-header').then((mod) => ({
        default: mod.MarketingHeader,
      })),
    'marketing-footer': () =>
      import('@/themes/default/blocks/marketing-footer').then((mod) => ({
        default: mod.MarketingFooter,
      })),
  },
};

/**
 * load theme page
 */
export async function getThemePage(pageName: string, theme?: string) {
  const activeTheme = theme || getActiveTheme();
  const loadTheme: ThemeName = hasOwn(themePages, activeTheme)
    ? (activeTheme as ThemeName)
    : defaultTheme;

  if (loadTheme !== activeTheme) {
    logger.warn('theme: unknown theme, fallback to default', {
      requestedTheme: activeTheme,
      fallbackTheme: loadTheme,
      pageName,
    });
  }

  const loader =
    getOwnLoader(themePages[loadTheme], pageName) ??
    getOwnLoader(themePages[defaultTheme as ThemeName], pageName);

  if (!loader) {
    logger.error('theme: unknown page', {
      pageName,
      theme: loadTheme,
      fallbackTheme: defaultTheme,
    });
    throw new Error(`Unknown theme page: ${pageName}`);
  }

  const themeModule = (await loader()) as { default?: unknown };
  if (typeof themeModule.default !== 'function') {
    throw new Error(`Invalid theme page module: ${pageName}`);
  }
  return themeModule.default as AnyComponent;
}

/**
 * load theme layout
 */
export async function getThemeLayout(
  layoutName: string,
  theme?: string
): Promise<AnyComponent> {
  const activeTheme = theme || getActiveTheme();
  const loadTheme: ThemeName = hasOwn(themeLayouts, activeTheme)
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
    getOwnLoader(themeLayouts[loadTheme], layoutName) ??
    getOwnLoader(themeLayouts[defaultTheme as ThemeName], layoutName);

  if (!loader) {
    logger.error('theme: unknown layout', {
      layoutName,
      theme: loadTheme,
      fallbackTheme: defaultTheme,
    });
    throw new Error(`Unknown theme layout: ${layoutName}`);
  }

  const themeModule = (await loader()) as { default?: unknown };
  if (typeof themeModule.default !== 'function') {
    throw new Error(`Invalid theme layout module: ${layoutName}`);
  }
  return themeModule.default as AnyComponent;
}

/**
 * load theme block
 */
export async function getThemeBlock(
  blockName: string,
  theme?: string
): Promise<AnyComponent> {
  const activeTheme = theme || getActiveTheme();
  const loadTheme: ThemeName = hasOwn(themeBlocks, activeTheme)
    ? (activeTheme as ThemeName)
    : defaultTheme;

  if (loadTheme !== activeTheme) {
    logger.warn('theme: unknown theme, fallback to default', {
      requestedTheme: activeTheme,
      fallbackTheme: loadTheme,
      blockName,
    });
  }

  const loader =
    getOwnLoader(themeBlocks[loadTheme], blockName) ??
    getOwnLoader(themeBlocks[defaultTheme as ThemeName], blockName);

  if (!loader) {
    logger.error('theme: unknown block', {
      blockName,
      theme: loadTheme,
      fallbackTheme: defaultTheme,
    });
    throw new Error(`Unknown theme block: ${blockName}`);
  }

  const themeModule = (await loader()) as { default?: unknown };
  if (typeof themeModule.default !== 'function') {
    throw new Error(`Invalid theme block module: ${blockName}`);
  }
  return themeModule.default as AnyComponent;
}
