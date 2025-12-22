import { envConfigs } from '@/config';
import { defaultTheme } from '@/config/theme';

export type ThemeName = 'default';

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

