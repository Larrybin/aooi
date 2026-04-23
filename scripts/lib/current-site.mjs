import { readCurrentSiteConfig } from './site-config.mjs';

export function getCurrentSite() {
  return readCurrentSiteConfig();
}

export function getCurrentSiteAppUrl() {
  return getCurrentSite().brand.appUrl;
}

export function getCurrentSiteOrigin() {
  return new URL(getCurrentSiteAppUrl()).origin;
}
