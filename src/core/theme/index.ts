import { envConfigs } from '@/config';
import { defaultTheme } from '@/config/theme';
import { logger } from '@/shared/lib/logger.server';

/**
 * get active theme
 */
export function getActiveTheme(): string {
  const theme = envConfigs.theme as string;

  if (theme) {
    return theme;
  }

  return defaultTheme;
}

/**
 * load theme page
 */
export async function getThemePage(pageName: string, theme?: string) {
  const loadTheme = theme || getActiveTheme();

  try {
    // load theme page
    const themeModule = await import(`@/themes/${loadTheme}/pages/${pageName}`);
    return themeModule.default;
  } catch (error) {
    logger.warn('theme: failed to load page', {
      pageName,
      theme: loadTheme,
      error,
    });

    // fallback to default theme
    if (loadTheme !== defaultTheme) {
      try {
        const fallbackModule = await import(
          `@/themes/${defaultTheme}/pages/${pageName}`
        );
        return fallbackModule.default;
      } catch (fallbackError) {
        logger.error('theme: failed to load fallback page', {
          pageName,
          theme: defaultTheme,
          error: fallbackError,
        });
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * load theme layout
 */
export async function getThemeLayout(layoutName: string, theme?: string) {
  const loadTheme = theme || getActiveTheme();

  try {
    // load theme layout
    const themeModule = await import(
      `@/themes/${loadTheme}/layouts/${layoutName}`
    );
    return themeModule.default;
  } catch (error) {
    logger.warn('theme: failed to load layout', {
      layoutName,
      theme: loadTheme,
      error,
    });

    // fallback to default theme
    if (loadTheme !== defaultTheme) {
      try {
        const fallbackModule = await import(
          `@/themes/${defaultTheme}/layouts/${layoutName}`
        );
        return fallbackModule.default;
      } catch (fallbackError) {
        logger.error('theme: failed to load fallback layout', {
          layoutName,
          theme: defaultTheme,
          error: fallbackError,
        });
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * load theme block
 */
export async function getThemeBlock(blockName: string, theme?: string) {
  const loadTheme = theme || getActiveTheme();

  try {
    // load theme block
    const themeModule = await import(
      `@/themes/${loadTheme}/blocks/${blockName}`
    );
    return (
      themeModule.default || themeModule[blockName] || themeModule
    );
  } catch (error) {
    logger.error('theme: failed to load block', {
      blockName,
      theme: loadTheme,
      error,
    });

    // fallback to default theme
    if (loadTheme !== defaultTheme) {
      try {
        const fallbackModule = await import(
          `@/themes/${defaultTheme}/blocks/${blockName}`
        );
        return (
          fallbackModule.default || fallbackModule[blockName] || fallbackModule
        );
      } catch (fallbackError) {
        logger.error('theme: failed to load fallback block', {
          blockName,
          theme: defaultTheme,
          error: fallbackError,
        });
        throw fallbackError;
      }
    }

    throw error;
  }
}
