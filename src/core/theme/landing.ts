import {
  getThemeLayout as getThemeLayoutInternal,
  getThemePage as getThemePageInternal,
} from './index';

type ThemeLandingPageName = 'landing' | 'pricing';
type ThemeLandingLayoutName = 'landing' | 'landing-marketing';

export async function getThemePage(
  pageName: ThemeLandingPageName,
  theme?: string
) {
  return await getThemePageInternal(pageName, theme);
}

export async function getThemeLayout(
  layoutName: ThemeLandingLayoutName,
  theme?: string
) {
  return await getThemeLayoutInternal(layoutName, theme);
}
